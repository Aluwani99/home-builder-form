// test-env-loading.js
import dotenv from 'dotenv';
import fs from 'fs';

console.log('Testing environment variable loading...');
console.log('Current directory:', process.cwd());

// Try different ways to load .env
try {
  // Method 1: Default
  dotenv.config();
  console.log('Method 1 - Default config:');
  console.log('  SHAREPOINT_CLIENT_ID:', process.env.SHAREPOINT_CLIENT_ID || 'NOT SET');
  
  // Method 2: Explicit path
  delete process.env.SHAREPOINT_CLIENT_ID; // Clear first
  dotenv.config({ path: '.env' });
  console.log('Method 2 - Explicit path:');
  console.log('  SHAREPOINT_CLIENT_ID:', process.env.SHAREPOINT_CLIENT_ID || 'NOT SET');
  
  // Method 3: Check file exists
  console.log('.env file exists:', fs.existsSync('.env'));
  if (fs.existsSync('.env')) {
    console.log('.env file content:');
    console.log(fs.readFileSync('.env', 'utf8'));
  }
  
} catch (error) {
  console.log('Error loading .env:', error.message);
}