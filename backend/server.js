import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveToSharePoint, uploadFileToSharePoint, getSiteId } from './services/sharepoint.js';
import getGraphClient from './config/auth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const upload = multer(); // memory storage

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.send('Backend is running...');
});

// Form submit endpoint
app.post('/api/submit-form', upload.array('fileUpload'), async (req, res) => {
  try {
    console.log('Incoming form data:', req.body);
    console.log('Incoming files:', req.files);

    const client = await getGraphClient();
    const siteId = await getSiteId(client);

    const uploadedFileUrls = [];
    const builderName = req.body.builderName || 'unknown';

    for (const file of req.files) {
      const ext = file.originalname.substring(file.originalname.lastIndexOf('.'));
      const sanitizedBuilderName = builderName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const newFileName = `${sanitizedBuilderName}${ext}`;
      const fileUrl = await uploadFileToSharePoint(file.buffer, newFileName, client, siteId, 'Shared Documents');
      uploadedFileUrls.push(fileUrl);
    }

    const formData = { ...req.body, uploadedFileUrls };
    const savedItem = await saveToSharePoint(formData, client, siteId);

    console.log('✅ Saved to SharePoint:', savedItem);
    res.json({ success: true, itemId: savedItem.id, uploadedFileUrls });
  } catch (error) {
    console.error('❌ Error processing form:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve frontend for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.listen(port, () => {
  console.log(`✅ Server started on http://localhost:${port}`);
});
