// backend/test-sharepoint.js
import dotenv from 'dotenv';
dotenv.config();

console.log('Testing SharePoint configuration...');
console.log('SHAREPOINT_CLIENT_ID:', process.env.SHAREPOINT_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('SHAREPOINT_CLIENT_SECRET:', process.env.SHAREPOINT_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('SHAREPOINT_TENANT_ID:', process.env.SHAREPOINT_TENANT_ID ? 'SET' : 'NOT SET');

// Test if we can create a Graph client
try {
  const { getGraphClient } = await import('./config/auth.js');
  const client = await getGraphClient();
  console.log('✅ Graph client created successfully');
} catch (error) {
  console.log('❌ Failed to create Graph client:', error.message);
}