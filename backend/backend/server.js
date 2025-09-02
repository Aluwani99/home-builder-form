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

// Configure multer to handle array field names
const upload = multer({ 
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  // Allow any field name that starts with "fileUpload"
  fileFilter: (req, file, cb) => {
    if (file.fieldname.startsWith('fileUpload')) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname), false);
    }
  }
});

// CORS Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

// Other middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Frontend path
const frontendPath = path.join(__dirname, 'public');
console.log(`📁 Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// Health check with SharePoint connectivity test
app.get('/api/health', async (req, res) => {
  try {
    let sharepointStatus = 'Not configured';
    let siteInfo = {};
    
    if (process.env.SHAREPOINT_CLIENT_ID && process.env.SHAREPOINT_CLIENT_SECRET) {
      try {
        const client = await getGraphClient();
        const siteId = await getSiteId(client);
        sharepointStatus = `Connected to SharePoint`;
        siteInfo = { siteId };
      } catch (error) {
        sharepointStatus = `SharePoint connection failed: ${error.message}`;
      }
    }

    res.json({
      status: 'Backend is running...',
      frontendPath,
      sharepointStatus,
      siteInfo,
      mode: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      error: error.message
    });
  }
});

// Form submission - use .any() to accept any field name
app.post('/api/submit-form', upload.any(), async (req, res) => {
  console.log('Form submission received:', req.body);
  console.log('Files received:', req.files ? req.files.map(f => `${f.fieldname}: ${f.originalname}`) : 'No files');
  
  // Check if SharePoint is configured
  if (!process.env.SHAREPOINT_CLIENT_ID || !process.env.SHAREPOINT_CLIENT_SECRET) {
    return res.status(500).json({
      success: false,
      error: 'SharePoint not configured',
      details: 'Missing SharePoint credentials in environment variables'
    });
  }

  try {
    const client = await getGraphClient();
    const siteId = await getSiteId(client);
    console.log(`Using site ID: ${siteId}`);

    const uploadedFileUrls = [];
    const builderName = req.body.builderName || 'unknown';
    const referenceNumber = req.body.referenceNumber || 'no_ref';

    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} files`);
      
      for (const file of req.files) {
        try {
          console.log(`Uploading file: ${file.originalname}, size: ${file.size} bytes`);
          const ext = path.extname(file.originalname);
          const sanitizedName = builderName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const newFileName = `${sanitizedName}_${referenceNumber}${ext}`;
          const fileUrl = await uploadFileToSharePoint(file.buffer, newFileName, client, siteId, 'Shared Documents');
          uploadedFileUrls.push(fileUrl);
          console.log(`Successfully uploaded: ${newFileName}`);
        } catch (fileError) {
          console.error(`Failed to upload file ${file.originalname}:`, fileError);
          // Continue with other files even if one fails
        }
      }
    } else {
      console.log('No files to upload');
    }

    const savedItem = await saveToSharePoint({ ...req.body, uploadedFileUrls }, client, siteId);
    console.log(`Successfully created list item with ID: ${savedItem.id}`);

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
      details: 'Failed to process form submission to SharePoint'
    });
  }
});

// Test endpoint without SharePoint for debugging
app.post('/api/test-submit', upload.any(), async (req, res) => {
  try {
    console.log('Test form submission received:', req.body);
    
    // Log files info without processing them
    if (req.files && req.files.length > 0) {
      console.log(`Received ${req.files.length} files:`);
      req.files.forEach(file => {
        console.log(`- ${file.fieldname}: ${file.originalname} (${file.size} bytes)`);
      });
    }

    // Simulate successful submission
    res.json({
      success: true,
      message: 'Form submitted successfully (test mode)',
      itemId: Math.floor(Math.random() * 10000),
      uploadedFiles: req.files ? req.files.map(f => f.originalname) : []
    });

  } catch (err) {
    console.error('❌ Error processing test form:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      details: 'Failed to process test form submission'
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
  
  // Handle Multer errors specifically
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: `Unexpected file field: ${err.field}. Please check your form field names.`
      });
    }
  }
  
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/api/health`);
  console.log(`📝 Test form endpoint: http://localhost:${port}/api/test-submit`);
  
  // Log SharePoint configuration status
  if (process.env.SHAREPOINT_CLIENT_ID && process.env.SHAREPOINT_CLIENT_SECRET) {
    console.log(`🔐 SharePoint authentication configured`);
    if (process.env.SHAREPOINT_SITE_URL) {
      console.log(`🌐 SharePoint site: ${process.env.SHAREPOINT_SITE_URL}`);
    } else {
      console.log(`⚠️  SHAREPOINT_SITE_URL not set`);
    }
  } else {
    console.log(`⚠️  SharePoint authentication not configured - check environment variables`);
  }
});