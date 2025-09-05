import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const counterFile = path.join(__dirname, 'counter.json');

// SharePoint functions
import { 
  saveToSharePoint, 
  uploadFileToSharePoint, 
  getSiteId, 
  getSharePointConfig,
  processFileUploads,
  testSiteAccess
} from './services/sharepoint.js';
import getGraphClient from './config/auth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Configure multer
const upload = multer({ 
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
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

// Initialize or read counter
function initializeCounter() {
  try {
    if (fs.existsSync(counterFile)) {
      const data = fs.readFileSync(counterFile, 'utf8');
      const counter = JSON.parse(data);
      return counter.lastReferenceNumber || 10000;
    }
  } catch (error) {
    console.error('Error reading counter file:', error);
  }
  return 10000;
}

function saveCounter(value) {
  try {
    fs.writeFileSync(counterFile, JSON.stringify({ lastReferenceNumber: value }, null, 2));
  } catch (error) {
    console.error('Error saving counter:', error);
  }
}

let lastReferenceNumber = initializeCounter();

// API endpoint to generate reference numbers
app.get('/api/generate-reference', (req, res) => {
  lastReferenceNumber++;
  saveCounter(lastReferenceNumber);
  const referenceNumber = `NHBRC${lastReferenceNumber}`;
  res.json({ referenceNumber });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    let sharepointStatus = 'Not configured';
    
    if (process.env.SHAREPOINT_CLIENT_ID && process.env.SHAREPOINT_CLIENT_SECRET) {
      try {
        const client = await getGraphClient();
        // Test with Gauteng as default
        const siteId = await getSiteId(client, 'Gauteng');
        sharepointStatus = `Connected to SharePoint`;
      } catch (error) {
        sharepointStatus = `SharePoint connection failed: ${error.message}`;
      }
    }

    res.json({
      status: 'Backend is running...',
      frontendPath,
      sharepointStatus,
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

// Form submission endpoint - UPDATED
app.post('/api/submit-form', upload.any(), async (req, res) => {
  try {
    const province = req.body.province;
    if (!province) {
      return res.status(400).json({
        success: false,
        error: 'Province is required'
      });
    }

    // Generate reference number for this submission
    lastReferenceNumber++;
    saveCounter(lastReferenceNumber);
    const referenceNumber = `NHBRC${lastReferenceNumber}`;

    const client = await getGraphClient();
    const siteId = await getSiteId(client, province);
    console.log(`Using site ID: ${siteId} for province: ${province}`);

    // Process file uploads with new folder structure and limits
    const uploadedFileUrls = await processFileUploads(
      req.files || [], 
      { ...req.body, referenceNumber },
      client, 
      province
    );

    const savedItem = await saveToSharePoint({ 
      ...req.body, 
      referenceNumber,
      uploadedFileUrls 
    }, client, province);
    
    console.log(`Successfully created list item with ID: ${savedItem.id} in province: ${province}`);

    res.json({
      success: true,
      message: `Form submitted successfully to ${province}`,
      referenceNumber: referenceNumber,
      itemId: savedItem.id,
      uploadedFileUrls,
      province: province
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

// Test site access endpoint
app.get('/api/test-site-access', async (req, res) => {
  try {
    const province = req.query.province || 'Gauteng';
    const client = await getGraphClient();
    
    console.log(`Testing site access for: ${province}`);
    const site = await testSiteAccess(client, province);
    
    res.json({
      success: true,
      province: province,
      site: {
        id: site.id,
        webUrl: site.webUrl,
        displayName: site.displayName
      }
    });
  } catch (error) {
    console.error('Site access test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      province: req.query.province || 'Gauteng'
    });
  }
});

// Debug endpoint to check available lists
app.get('/api/debug-lists', async (req, res) => {
  try {
    const province = req.query.province || 'Free State';
    const client = await getGraphClient();
    const siteId = await getSiteId(client, province);

    console.log(`🔍 Checking lists for province: ${province}`);
    console.log(`🔍 Site ID: ${siteId}`);

    const lists = await client.api(`/sites/${siteId}/lists`).get();
    
    console.log(`📋 Available lists in ${province}:`);
    lists.value.forEach(list => {
      console.log(`   - "${list.displayName}" (internal name: "${list.name}")`);
    });

    res.json({
      success: true,
      province: province,
      siteId: siteId,
      lists: lists.value.map(list => ({
        id: list.id,
        name: list.name,
        displayName: list.displayName,
        webUrl: list.webUrl,
        createdDateTime: list.createdDateTime
      }))
    });
  } catch (error) {
    console.error('❌ List debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      province: req.query.province
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
      uploadedFiles: req.files ? req.files.map(f => f.originalname) : [],
      province: req.body.province || 'Test Province'
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
    
    // Test province configurations
    const provinces = [
      'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu Natal', 
      'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
    ];
    
    provinces.forEach(province => {
      try {
        const config = getSharePointConfig(province);
        console.log(`✅ ${province}: ${config.siteUrl} -> ${config.listName}`);
      } catch (error) {
        console.log(`❌ ${province}: Configuration error - ${error.message}`);
      }
    });
  } else {
    console.log(`⚠️  SharePoint authentication not configured - check environment variables`);
  }
});