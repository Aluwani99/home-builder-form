import dotenv from 'dotenv';
dotenv.config();

/**
 * Upload a file to SharePoint document library
 * @param {Buffer} fileContent - raw file data buffer
 * @param {string} fileName - file name with extension
 * @param {GraphClient} client - authenticated Microsoft Graph client
 * @param {string} siteId - SharePoint Site ID
 * @param {string} folderPath - folder in the document library (default "Shared Documents")
 * @returns {Promise<string>} - returns uploaded file webUrl
 */
export async function uploadFileToSharePoint(fileContent, fileName, client, siteId, folderPath = 'Shared Documents') {
  const encodedFileName = encodeURIComponent(fileName);
  const uploadPath = `/sites/${siteId}/drive/root:/${folderPath}/${encodedFileName}:/content`;

  console.log(`Uploading file "${fileName}" to "${uploadPath}"`);

  const response = await client.api(uploadPath).put(fileContent);

  console.log(`Uploaded file URL: ${response.webUrl}`);
  return response.webUrl;
}

/**
 * Get SharePoint site ID from URL environment variables
 * Uses the hostname and path from your .env (SHAREPOINT_SITE_URL)
 * @param {GraphClient} client - authenticated Microsoft Graph client
 * @returns {Promise<string>} site ID
 */
export async function getSiteId(client) {
  if (!process.env.SHAREPOINT_SITE_URL) {
    throw new Error('Missing SHAREPOINT_SITE_URL in env');
  }

  const url = new URL(process.env.SHAREPOINT_SITE_URL);
  const hostname = url.hostname; // e.g. nhbrcsa.sharepoint.com
  const siteRelativePath = url.pathname; // e.g. /sites/DL-GautengInspectorate

  // Get site metadata (including site ID)
  const site = await client.api(`/sites/${hostname}:${siteRelativePath}`).get();

  console.log(`Site ID for ${process.env.SHAREPOINT_SITE_URL} is ${site.id}`);

  return site.id;
}

/**
 * Save form data as a SharePoint list item, including uploaded file URLs
 * @param {object} formData - form fields + uploadedFileUrls
 * @param {GraphClient} client - authenticated Microsoft Graph client
 * @param {string} siteId - SharePoint site ID
 * @returns {Promise<object>} - created list item response
 */
export async function saveToSharePoint(formData, client, siteId) {
  if (!process.env.SHAREPOINT_LIST_NAME) {
    throw new Error('Missing SHAREPOINT_LIST_NAME in env');
  }
  const listName = process.env.SHAREPOINT_LIST_NAME;

  // Get all lists on the site to find target list by name
  const lists = await client.api(`/sites/${siteId}/lists`).get();

  console.log('Lists available on site:');
  lists.value.forEach(list => {
    console.log(`- id: ${list.id}, name: ${list.name}, displayName: ${list.displayName}`);
  });

  const targetList = lists.value.find(l => l.displayName === listName || l.name === listName);
  if (!targetList) {
    throw new Error(`List "${listName}" not found on site.`);
  }

  // Prepare fields to create the new list item
  const fields = {
    Title: formData.builderName,
    Province: formData.province,
    CompetentPerson: formData.competentPerson,
    PropertyDetails: formData.propertyDetails,
    RegistrationNumber: formData.registrationNumber,
    CompanyName: formData.companyName,
  };

  // Add uploaded file URLs as a single string (or adjust to your list field schema)
  if (formData.uploadedFileUrls && formData.uploadedFileUrls.length > 0) {
    // Example: join URLs with commas, or save first URL only depending on list schema
    fields.Attachments = formData.uploadedFileUrls.join(', ');
  }

  const newItem = { fields };

  const apiPath = `/sites/${siteId}/lists/${targetList.id}/items`;

  console.log('Posting to:', apiPath);
  console.log('Payload:', JSON.stringify(newItem, null, 2));

  const response = await client.api(apiPath).post(newItem);
  return response;
}
