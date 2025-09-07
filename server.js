import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  saveToSharePoint,
  uploadFileToSharePoint,
  getSiteId,
  getSharePointConfig,
  processFileUploads,
  testSiteAccess
} from './services/sharepoint.js';
import getGraphClient from './config/auth.js';

// ✅ ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Create app
const app = express();
const port = process.env.PORT;

// ------------------
// Safety / Debugging
// ------------------
process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('🚨 Unhandled Rejection:', err);
});

// ------------------
// Counter file setup
// ------------------
const counterFile = path.join(process.cwd(), 'counter.json');

function initializeCounter() {
  try {
    if (fs.existsSync(counterFile)) {
      const data = fs.readFileSync(counterFile, 'utf8');
      const counter = JSON.parse(data);
      return counter.lastReferenceNumber || 10000;
    }
  } catch (err) {
    console.error('Error reading counter file:', err);
  }
  return 10000;
}

function saveCounter(value) {
  try {
    fs.writeFileSync(counterFile, JSON.stringify({ lastReferenceNumber: value }, null, 2));
  } catch (err) {
    console.error('Error saving counter:', err);
  }
}

let lastReferenceNumber = initializeCounter();

// ------------------
// Middleware
// ------------------
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend
const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));

// Multer setup
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname.startsWith('fileUpload')) cb(null, true);
    else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname), false);
  }
});

// ------------------
// Health check
// ------------------
app.get('/api/health', async (req, res) => {
  try {
    let sharepointStatus = 'Not configured';
    let siteInfo = {};
    
    if (process.env.SHAREPOINT_CLIENT_ID && process.env.SHAREPOINT_CLIENT_SECRET) {
      try {
        const client = await getGraphClient();
        // Test with a default province
        const siteId = await getSiteId(client, 'Gauteng');
        sharepointStatus = 'Connected to SharePoint';
        siteInfo = { province: 'Gauteng', siteId };
      } catch (err) {
        sharepointStatus = `SharePoint connection failed: ${err.message}`;
      }
    }
    res.json({
      status: 'Backend is running',
      frontendPath,
      sharepointStatus,
      siteInfo,
      mode: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'Error', error: err.message });
  }
});

// ------------------
// Reference generator
// ------------------
app.get('/api/generate-reference', (req, res) => {
  lastReferenceNumber++;
  saveCounter(lastReferenceNumber);
  res.json({ referenceNumber: `NHBRC${lastReferenceNumber}` });
});

// ------------------
// Form submission
// ------------------
app.post('/api/submit-form', upload.any(), async (req, res) => {
  try {
    const province = req.body.province;
    if (!province) return res.status(400).json({ success: false, error: 'Province is required' });

    lastReferenceNumber++;
    saveCounter(lastReferenceNumber);
    const referenceNumber = `NHBRC${lastReferenceNumber}`;

    const client = await getGraphClient();
    const siteId = await getSiteId(client, province);

    console.log(`Using site ID: ${siteId} for province: ${province}`);

    const uploadedFileUrls = await processFileUploads(req.files || [], { ...req.body, referenceNumber }, client, province);

    const savedItem = await saveToSharePoint({ ...req.body, referenceNumber, uploadedFileUrls }, client, province);

    console.log(`Form submitted successfully: Item ID ${savedItem.id}`);

    res.json({
      success: true,
      message: `Form submitted successfully to ${province}`,
      referenceNumber,
      itemId: savedItem.id,
      uploadedFileUrls,
      province
    });
  } catch (err) {
    console.error('Form submission error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------
// Test site access
// ------------------
app.get('/api/test-site-access', async (req, res) => {
  try {
    const province = req.query.province || 'Gauteng';
    const client = await getGraphClient();
    const site = await testSiteAccess(client, province);
    res.json({ success: true, province, site });
  } catch (err) {
    console.error('Site access test failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------
// Debug endpoint - List all available provinces and sites
// ------------------
app.get('/api/debug-provinces', async (req, res) => {
  try {
    const provinces = [
      'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu Natal',
      'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
    ];
    
    const client = await getGraphClient();
    const results = [];
    
    for (const province of provinces) {
      try {
        const siteId = await getSiteId(client, province);
        results.push({ province, siteId, status: 'accessible' });
      } catch (error) {
        results.push({ province, error: error.message, status: 'failed' });
      }
    }
    
    res.json({ success: true, results });
  } catch (err) {
    console.error('Debug provinces error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------
// Debug endpoint - List items in a specific province
// ------------------
app.get('/api/debug-lists', async (req, res) => {
  try {
    const province = req.query.province || 'Gauteng';
    const client = await getGraphClient();
    const siteId = await getSiteId(client, province);
    const lists = await client.api(`/sites/${siteId}/lists`).get();
    res.json({ success: true, province, siteId, lists: lists.value });
  } catch (err) {
    console.error('Debug lists error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------
// Catch-all to serve frontend
// ------------------
app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// ------------------
// Error handling
// ------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: `Unexpected file field: ${err.field}` });
  }
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/api/health`);
  console.log(`📝 Form endpoint: http://localhost:${port}/api/submit-form`);
  console.log(`🔧 Debug endpoints:`);
  console.log(`   - http://localhost:${port}/api/test-site-access`);
  console.log(`   - http://localhost:${port}/api/debug-provinces`);
  console.log(`   - http://localhost:${port}/api/debug-lists`);
  
  // Log SharePoint configuration status
  if (process.env.SHAREPOINT_CLIENT_ID && process.env.SHAREPOINT_CLIENT_SECRET) {
    console.log(`🔐 SharePoint authentication configured`);
    
    // List all available provinces
    const provinces = [
      'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu Natal',
      'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
    ];
    
    console.log(`🌐 Available provinces: ${provinces.join(', ')}`);
    
  } else {
    console.log(`⚠️  SharePoint authentication not configured - check environment variables`);
  }
});