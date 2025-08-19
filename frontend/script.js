const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

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
app.post('/api/submit-form', (req, res) => {
  const formData = req.body;
  console.log('Form submission received:', formData);

  // Simulate saving to DB / SharePoint / File / etc
  // Return a success response
  return res.json({ success: true, itemId: 12345 });
});

// Serve frontend if needed
// app.use(express.static('public'))

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
