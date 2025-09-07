// debug-site-access.js
import dotenv from 'dotenv';
dotenv.config();

console.log('Debugging SharePoint site access...\n');

try {
  const authModule = await import('./config/auth.js');
  const getGraphClient = authModule.default;
  const client = await getGraphClient();
  console.log('✅ Graph client created successfully');

  // Test all your SharePoint sites
  const sitesToTest = [
    { name: 'Eastern Cape', url: process.env.SHAREPOINT_SITE_EASTERN_CAPE },
    { name: 'Free State', url: process.env.SHAREPOINT_SITE_FREE_STATE },
    { name: 'Gauteng', url: process.env.SHAREPOINT_SITE_GAUTENG },
    { name: 'KwaZulu Natal', url: process.env.SHAREPOINT_SITE_KWAZULU_NATAL },
    { name: 'Limpopo', url: process.env.SHAREPOINT_SITE_LIMPOPO },
    { name: 'Mpumalanga', url: process.env.SHAREPOINT_SITE_MPUMALANGA },
    { name: 'North West', url: process.env.SHAREPOINT_SITE_NORTH_WEST },
    { name: 'Northern Cape', url: process.env.SHAREPOINT_SITE_NORTHERN_CAPE },
    { name: 'Western Cape', url: process.env.SHAREPOINT_SITE_WESTERN_CAPE }
  ];

  for (const site of sitesToTest) {
    if (!site.url) {
      console.log(`❌ ${site.name}: URL not set in environment`);
      continue;
    }

    console.log(`\nTesting ${site.name}: ${site.url}`);
    
    try {
      // Convert URL to Graph API format: hostname:port:/sites/site-name
      const url = new URL(site.url);
      const graphSitePath = `${url.hostname}:${url.port || ''}${url.pathname}`;
      
      console.log(`   Graph API path: /sites/${graphSitePath}`);
      
      const siteInfo = await client.api(`/sites/${graphSitePath}`).get();
      console.log(`   ✅ SUCCESS: ${siteInfo.displayName} (${siteInfo.id})`);
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
      if (error.statusCode === 404) {
        console.log('      Site not found - check URL format');
      } else if (error.statusCode === 403) {
        console.log('      Permission denied - check app permissions');
      }
    }
  }

} catch (error) {
  console.log('❌ Failed:', error.message);
}