// config/auth.js
import fetch from 'node-fetch';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch'; // Polyfill for fetch if needed
import dotenv from 'dotenv';
dotenv.config();

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', process.env.SHAREPOINT_CLIENT_ID);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('client_secret', process.env.SHAREPOINT_CLIENT_SECRET);
  params.append('grant_type', 'client_credentials');

  const response = await fetch(url, {
    method: 'POST',
    body: params,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
  }

  // **Make sure to declare and return accessToken properly**
  const accessToken = data.access_token;
  return accessToken;
}

export default async function getGraphClient() {
  const accessToken = await getAccessToken();

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}
