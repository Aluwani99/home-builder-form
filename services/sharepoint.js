import dotenv from 'dotenv';
dotenv.config();

// Map province names to environment variable keys
const PROVINCE_MAPPING = {
  'Eastern Cape': { site: 'EASTERN_CAPE', list: 'EASTERN_CAPE' },
  'Free State': { site: 'FREE_STATE', list: 'FREE_STATE' },
  'Gauteng': { site: 'GAUTENG', list: 'GAUTENG' },
  'KwaZulu Natal': { site: 'KWAZULU_NATAL', list: 'KWAZULU_NATAL' },
  'Limpopo': { site: 'LIMPOPO', list: 'LIMPOPO' },
  'Mpumalanga': { site: 'MPUMALANGA', list: 'MPUMALANGA' },
  'North West': { site: 'NORTH_WEST', list: 'NORTH_WEST' },
  'Northern Cape': { site: 'NORTHERN_CAPE', list: 'NORTHERN_CAPE' },
  'Western Cape': { site: 'WESTERN_CAPE', list: 'WESTERN_CAPE' }
};

/**
 * Get SharePoint site URL and list name based on province
 * @param {string} province - The selected province
 * @returns {object} siteUrl and listName for the province
 */
export function getSharePointConfig(province) {
  const provinceKey = PROVINCE_MAPPING[province];
  if (!provinceKey) {
    throw new Error(`No SharePoint configuration found for province: ${province}`);
  }
  
  const siteUrl = process.env[`SHAREPOINT_SITE_${provinceKey.site}`];
  const listName = process.env[`SHAREPOINT_LIST_${provinceKey.list}`];
  
  if (!siteUrl || !listName) {
    throw new Error(`SharePoint configuration incomplete for province: ${province}`);
  }
  
  return { siteUrl, listName };
}

/**
 * Get SharePoint site ID for a specific province
 * @param {GraphClient} client - authenticated Microsoft Graph client
 * @param {string} province - The selected province
 * @returns {Promise<string>} site ID
 */
export async function getSiteId(client, province) {
  const { siteUrl } = getSharePointConfig(province);
  
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const siteRelativePath = url.pathname;

  console.log(`🔄 Looking for site: ${siteUrl}`);
  
  try {
    // Get site metadata (including site ID)
    const site = await client.api(`/sites/${hostname}:${siteRelativePath}`).get();
    console.log(`✅ Site ID for ${siteUrl} is ${site.id}`);
    return site.id;
  } catch (error) {
    console.error(`❌ Failed to find site: ${siteUrl}`);
    console.error(`Error details:`, error.message);
    throw error;
  }
}

/**
 * Create a folder in SharePoint if it doesn't exist
 * @param {GraphClient} client - authenticated Microsoft Graph client
 * @param {string} siteId - SharePoint Site ID
 * @param {string} parentFolderPath - Parent folder path
 * @param {string} folderName - Name of the folder to create
 * @returns {Promise<string>} - returns folder path
 */
export async function createFolder(client, siteId, parentFolderPath, folderName) {
  // Remove leading/trailing slashes and encode
  const cleanParentPath = parentFolderPath.replace(/^\/|\/$/g, '');
  const encodedFolderName = encodeURIComponent(folderName);
  
  try {
    // Check if folder already exists using the correct API format
    const checkPath = `/sites/${siteId}/drive/root:/${cleanParentPath}/${encodedFolderName}`;
    await client.api(checkPath).get();
    console.log(`✅ Folder already exists: ${cleanParentPath}/${folderName}`);
    return `${cleanParentPath}/${folderName}`;
  } catch (error) {
    if (error.statusCode === 404) {
      // Folder doesn't exist, create it
      console.log(`🔄 Creating folder: ${cleanParentPath}/${folderName}`);
      const createPath = `/sites/${siteId}/drive/root:/${cleanParentPath}:/children`;
      const folderData = {
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename"
      };
      
      await client.api(createPath).post(folderData);
      console.log(`✅ Created folder: ${cleanParentPath}/${folderName}`);
      return `${cleanParentPath}/${folderName}`;
    }
    throw error;
  }
}

/**
 * Upload a file to a specific folder in SharePoint
 * @param {Buffer} fileContent - raw file data buffer
 * @param {string} fileName - file name with extension
 * @param {GraphClient} client - authenticated Microsoft Graph client
 * @param {string} siteId - SharePoint Site ID
 * @param {string} folderPath - folder path where file should be uploaded
 * @returns {Promise<string>} - returns uploaded file webUrl
 */
export async function uploadFileToSharePoint(fileContent, fileName, client, siteId, folderPath = 'Shared Documents') {
  const encodedFileName = encodeURIComponent(fileName);
  
  // Clean up the folder path
  const cleanFolderPath = folderPath.replace(/^\/|\/$/g, '').replace('Shared Documents/Shared Documents', 'Shared Documents');
  
  const uploadPath = `/sites/${siteId}/drive/root:/${cleanFolderPath}/${encodedFileName}:/content`;

  console.log(`Uploading file "${fileName}" to "${uploadPath}"`);

  try {
    const response = await client.api(uploadPath).put(fileContent);
    
    const webUrl = response.webUrl || `https://nhbrcsa.sharepoint.com${response.parentReference.path}/${fileName}`;
    
    console.log(`✅ Uploaded file URL: ${webUrl}`);
    return webUrl;
  } catch (error) {
    console.error('❌ Error uploading file:', error);
    throw error;
  }
}

/**
 * Save form data to the appropriate SharePoint list based on province
 * @param {object} formData - form fields + uploadedFileUrls
 * @param {GraphClient} client - authenticated Microsoft Graph client
 * @param {string} province - The selected province
 * @returns {Promise<object>} - created list item response
 */
export async function saveToSharePoint(formData, client, province) {
  const { listName } = getSharePointConfig(province);
  const siteId = await getSiteId(client, province);

  console.log(`Looking for list: "${listName}" on site: ${province}`);

  // Get all lists on the site to find target list by name
  const lists = await client.api(`/sites/${siteId}/lists`).get();

  console.log('Available lists on site:');
  lists.value.forEach(list => {
    console.log(`- "${list.displayName}" (name: "${list.name}")`);
  });

  // Find list by exact internal name match
  const targetList = lists.value.find(l => l.name === listName);
  
  if (!targetList) {
    throw new Error(`List "${listName}" not found on site for province ${province}. Available lists: ${lists.value.map(l => `"${l.name}"`).join(', ')}`);
  }

  console.log(`✅ Found list: "${targetList.displayName}" (ID: ${targetList.id})`);

  // Prepare fields to create the new list item
  const fields = {
    Title: formData.builderName,
    ReferenceNumber: formData.referenceNumber,
    Province: formData.province,
    CompetentPerson: formData.competentPerson,
    PropertyDetails: formData.propertyDetails,
    RegistrationNumber: formData.registrationNumber,
    CompanyName: formData.companyName,
  };

  // Add uploaded file URLs as a single string
  if (formData.uploadedFileUrls && formData.uploadedFileUrls.length > 0) {
    fields.Attachments = formData.uploadedFileUrls.join(', ');
  }

  const newItem = { fields };
  const apiPath = `/sites/${siteId}/lists/${targetList.id}/items`;

  console.log('Posting to:', apiPath);
  console.log('Payload:', JSON.stringify(newItem, null, 2));

  try {
    const response = await client.api(apiPath).post(newItem);
    console.log('✅ Successfully created list item:', response.id);
    return response;
  } catch (error) {
    console.error('❌ Failed to create list item:', error.message);
    if (error.body) {
      try {
        const errorBody = JSON.parse(error.body);
        console.error('❌ Error details:', errorBody);
      } catch (e) {
        console.error('❌ Raw error:', error.body);
      }
    }
    throw error;
  }
}

/**
 * Process file uploads with folder structure and limits
 * @param {Array} files - Array of uploaded files
 * @param {object} formData - Form data
 * @param {GraphClient} client - authenticated Microsoft Graph client
 * @param {string} province - The selected province
 * @returns {Promise<Array>} - Array of uploaded file URLs
 */
export async function processFileUploads(files, formData, client, province) {
  const siteId = await getSiteId(client, province);
  const uploadedFileUrls = [];
  
  // Validate file limit (1-3 files)
  if (files.length > 3) {
    throw new Error('Maximum of 3 files allowed per submission');
  }
  
  if (files.length === 0) {
    console.log('No files to upload');
    return [];
  }

  try {
    // Create folder structure: Shared Documents/Home Builders/{Builder Name}/
const baseFolder = 'D1 Documents';

// Directly create builder folder under baseFolder
const builderFolder = await createFolder(client, siteId, baseFolder, formData.builderName);

    
    // Upload each file to the builder's folder
    for (const file of files) {
      try {
        console.log(`Uploading file: ${file.originalname}, size: ${file.size} bytes`);
        
        // Generate unique filename with reference number
        const ext = file.originalname.split('.').pop();
        const sanitizedName = formData.builderName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const newFileName = `${sanitizedName}_${formData.referenceNumber}_${Date.now()}.${ext}`;
        
        // Upload to the builder's specific folder
        const fileUrl = await uploadFileToSharePoint(
          file.buffer, 
          newFileName, 
          client, 
          siteId, 
          builderFolder
        );
        
        uploadedFileUrls.push(fileUrl);
        console.log(`✅ Successfully uploaded: ${newFileName}`);
        
      } catch (fileError) {
        console.error(`❌ Failed to upload file ${file.originalname}:`, fileError);
        // Continue with other files even if one fails
      }
    }
  } catch (folderError) {
    console.error('❌ Error creating folders:', folderError);
    // Fallback: upload to Shared Documents directly
    console.log('🔄 Falling back to Shared Documents folder');
    
    for (const file of files) {
      try {
        console.log(`Uploading file to Shared Documents: ${file.originalname}`);
        const ext = file.originalname.split('.').pop();
        const sanitizedName = formData.builderName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const newFileName = `${sanitizedName}_${formData.referenceNumber}_${Date.now()}.${ext}`;
        
        const fileUrl = await uploadFileToSharePoint(
          file.buffer, 
          newFileName, 
          client, 
          siteId, 
          'Shared Documents'
        );
        
        uploadedFileUrls.push(fileUrl);
        console.log(`✅ Successfully uploaded to Shared Documents: ${newFileName}`);
      } catch (fileError) {
        console.error(`❌ Failed to upload file ${file.originalname}:`, fileError);
      }
    }
  }

  return uploadedFileUrls;
}

// Add this function to debug site access
export async function testSiteAccess(client, province) {
  try {
    const { siteUrl } = getSharePointConfig(province);
    const url = new URL(siteUrl);
    const hostname = url.hostname;
    const siteRelativePath = url.pathname;

    console.log(`Testing access to: ${siteUrl}`);
    console.log(`Hostname: ${hostname}`);
    console.log(`Site path: ${siteRelativePath}`);

    // Test site access
    const site = await client.api(`/sites/${hostname}:${siteRelativePath}`).get();
    console.log(`✅ Site found: ${site.webUrl}`);
    console.log(`✅ Site ID: ${site.id}`);
    
    return site;
  } catch (error) {
    console.error(`❌ Site access error for ${province}:`, error.message);
    if (error.body) {
      try {
        const errorBody = JSON.parse(error.body);
        console.error(`❌ Error details:`, errorBody);
      } catch (e) {
        console.error(`❌ Raw error:`, error.body);
      }
    }
    throw error;
  }
}