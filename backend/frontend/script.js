const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

// Middleware to parse JSON body
app.use(express.json());

// Allow CORS (only needed if frontend is on a different port)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // or specific domain
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// POST route to receive form data
// Form submission
// Form submission
app.post('/api/submit-form', upload.array('fileUpload'), async (req, res) => {
  console.log('Form submission received:', req.body);
  console.log('Files received:', req.files ? req.files.map(f => f.originalname) : 'No files');
  
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  // Check if SharePoint is configured
  if (!process.env.SHAREPOINT_CLIENT_ID || !process.env.SHAREPOINT_CLIENT_SECRET) {
    console.error('SharePoint not configured');
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

    // Ensure proper JSON response
    res.setHeader('Content-Type', 'application/json');
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


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
