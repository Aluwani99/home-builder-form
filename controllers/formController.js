import { saveToSharePoint } from '../services/sharepoint.js';

export const submitForm = async (req, res) => {
  try {
    console.log('Form data received:', req.body);

    const response = await saveToSharePoint(req.body);

    console.log('SharePoint response:', response);

    res.json({ success: true, itemId: response.id });
  } catch (error) {
    console.error('Error in submitForm:', error);

    res.status(500).json({
      success: false,
      message: 'An error occurred while submitting. Please try again.'
    });
  }
};
