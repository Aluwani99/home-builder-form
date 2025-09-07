import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

/**
 * Get authenticated Microsoft Graph client
 * @returns {Promise<Client>} authenticated Graph client
 */
export default async function getGraphClient() {
  if (!process.env.SHAREPOINT_CLIENT_ID || !process.env.SHAREPOINT_CLIENT_SECRET || !process.env.SHAREPOINT_TENANT_ID) {
    throw new Error('Missing SharePoint authentication credentials in environment variables');
  }

  const credential = new ClientSecretCredential(
    process.env.SHAREPOINT_TENANT_ID,
    process.env.SHAREPOINT_CLIENT_ID,
    process.env.SHAREPOINT_CLIENT_SECRET
  );

  // Create Graph client with the credential
  const client = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken('https://graph.microsoft.com/.default');
        return token.token;
      }
    }
  });

  return client;
}