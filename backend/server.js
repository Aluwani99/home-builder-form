import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import { saveToSharePoint, uploadFileToSharePoint, getSiteId } from './services/sharepoint.js';
import getGraphClient from './config/auth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const upload = multer(); // memory storage for files

app.use(cors());

// This lets us parse JSON fields (other than files)
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('Backend is running...');
});

// Form submit endpoint with file upload
app.post('/api/submit-form', upload.array('fileUpload'), async (req, res) => {
  try {
    console.log('Incoming form data:', req.body);
    console.log('Incoming files:', req.files);

    const client = await getGraphClient();

    // Get SharePoint site ID from URL env variables (hostname & path)
    const siteId = await getSiteId(client);

    // Upload files one by one to "Shared Documents"
    const uploadedFileUrls = [];
    const builderName = req.body.builderName || 'unknown';

    for (const file of req.files) {
      // Extract original file extension including the dot, e.g. ".pdf"
      const ext = file.originalname.substring(file.originalname.lastIndexOf('.'));

      // Sanitize builderName: lowercase, replace spaces and special chars with underscores
      const sanitizedBuilderName = builderName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      // Construct new filename with builderName + original extension
      const newFileName = `${sanitizedBuilderName}${ext}`;

      // Upload file with new name
      const fileUrl = await uploadFileToSharePoint(file.buffer, newFileName, client, siteId, 'Shared Documents');
      uploadedFileUrls.push(fileUrl);
    }

    // Add file URLs array to form data to store in list item
    const formData = { ...req.body, uploadedFileUrls };

    // Save form data + file URLs as a list item in your SharePoint list
    const savedItem = await saveToSharePoint(formData, client, siteId);

    console.log('✅ Saved to SharePoint:', savedItem);
    res.json({ success: true, itemId: savedItem.id, uploadedFileUrls });
  } catch (error) {
    console.error('❌ Error processing form:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Server started on http://localhost:${port}`);
});
