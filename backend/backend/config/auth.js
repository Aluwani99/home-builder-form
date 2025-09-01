// config/auth.js
import fetch from 'node-fetch';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function getAccessToken() {
  // Check if required environment variables are set
  if (!process.env.TENANT_ID || !process.env.SHAREPOINT_CLIENT_ID || !process.env.SHAREPOINT_CLIENT_SECRET) {
    throw new Error('Missing SharePoint authentication environment variables. Please check TENANT_ID, SHAREPOINT_CLIENT_ID, and SHAREPOINT_CLIENT_SECRET.');
  }

  const url = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', process.env.SHAREPOINT_CLIENT_ID);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('client_secret', process.env.SHAREPOINT_CLIENT_SECRET);
  params.append('grant_type', 'client_credentials');

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: params,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Token request failed:', data);
      throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
    }

    const accessToken = data.access_token;
    return accessToken;
  } catch (error) {
    console.error('Error in getAccessToken:', error);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

export default async function getGraphClient() {
  try {
    const accessToken = await getAccessToken();
    
    // Validate the token is not empty
    if (!accessToken) {
      throw new Error('Received empty access token');
    }

    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  } catch (error) {
    console.error('Failed to initialize Graph client:', error);
    throw error;
  }
}