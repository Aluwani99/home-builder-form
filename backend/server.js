import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SharePoint functions
import { saveToSharePoint, uploadFileToSharePoint, getSiteId } from './services/sharepoint.js';
import getGraphClient from './config/auth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const upload = multer();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Frontend path
const frontendPath = path.join(__dirname, 'public');
console.log(`📁 Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Backend is running...',
    frontendPath,
    mode: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Form submission
app.post('/api/submit-form', upload.array('fileUpload'), async (req, res) => {
  try {
    const client = await getGraphClient();
    const siteId = await getSiteId(client);

    const uploadedFileUrls = [];
    const builderName = req.body.builderName || 'unknown';

    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = path.extname(file.originalname);
        const sanitizedName = builderName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const newFileName = `${sanitizedName}_${Date.now()}${ext}`;
        const fileUrl = await uploadFileToSharePoint(file.buffer, newFileName, client, siteId, 'Shared Documents');
        uploadedFileUrls.push(fileUrl);
      }
    }

    const savedItem = await saveToSharePoint({ ...req.body, uploadedFileUrls }, client, siteId);

    res.json({
      success: true,
      message: 'Form submitted successfully',
      itemId: savedItem.id,
      uploadedFileUrls
    });

  } catch (err) {
    console.error('❌ Error processing form:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      details: 'Failed to process form submission'
    });
  }
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/api/health`);
});
