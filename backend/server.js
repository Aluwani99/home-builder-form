import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import SharePoint functions
import { saveToSharePoint, uploadFileToSharePoint, getSiteId } from './services/sharepoint.js';
import getGraphClient from './config/auth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const upload = multer();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Determine frontend path based on environment
let frontendPath;
if (process.env.NODE_ENV === 'production') {
  // In production on Azure, frontend is copied to backend/public
  frontendPath = path.join(__dirname, 'public');
} else {
  // In development, frontend is in sibling directory
  frontendPath = path.join(__dirname, '..', 'frontend');
}

console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Backend is running...',
    frontendPath: frontendPath,
    mode: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Form submit endpoint
app.post('/api/submit-form', upload.array('fileUpload'), async (req, res) => {
  try {
    const client = await getGraphClient();
    const siteId = await getSiteId(client);

    const uploadedFileUrls = [];
    const builderName = req.body.builderName || 'unknown';

    // Process file uploads
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = file.originalname.substring(file.originalname.lastIndexOf('.'));
        const sanitizedBuilderName = builderName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const newFileName = `${sanitizedBuilderName}_${Date.now()}${ext}`;
        const fileUrl = await uploadFileToSharePoint(file.buffer, newFileName, client, siteId, 'Shared Documents');
        uploadedFileUrls.push(fileUrl);
      }
    }

    const formData = { ...req.body, uploadedFileUrls };
    const savedItem = await saveToSharePoint(formData, client, siteId);

    res.json({ 
      success: true, 
      message: 'Form submitted successfully',
      itemId: savedItem.id, 
      uploadedFileUrls
    });
  } catch (error) {
    console.error('❌ Error processing form:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Failed to process form submission' 
    });
  }
});

// Serve the frontend for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

app.listen(port, () => {
  console.log(`✅ Server started on http://localhost:${port}`);
  console.log(`📁 Serving frontend from: ${frontendPath}`);
  console.log(`🏥 Health check: http://localhost:${port}/api/health`);
});
