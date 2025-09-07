// test-sharepoint-correct.js
import dotenv from 'dotenv';
dotenv.config();

console.log('Testing SharePoint configuration with correct API calls...\n');

// Test if we can create a Graph client
try {
  const authModule = await import('./config/auth.js');
  const getGraphClient = authModule.default;
  const client = await getGraphClient();
  console.log('✅ Graph client created successfully');

  // Test with application permissions - list sites instead of /me
  console.log('Testing sites endpoint (application permissions)...');
  
  // Test getting sites (this should work with application permissions)
  const sites = await client.api('/sites').top(5).get();
  console.log('✅ Sites API call successful');
  console.log(`Found ${sites.value.length} sites`);
  
  // Test getting a specific site (use one of your SharePoint sites)
  const testSiteUrl = process.env.SHAREPOINT_SITE_GAUTENG;
  console.log(`\nTesting access to site: ${testSiteUrl}`);
  
  try {
    const site = await client.api(`/sites/${testSiteUrl}`).get();
    console.log('✅ Site access successful');
    console.log('Site ID:', site.id);
    console.log('Site Name:', site.displayName);
    
    // Test listing document libraries
    console.log('\nTesting document libraries...');
    const libraries = await client.api(`/sites/${site.id}/drives`).get();
    console.log('✅ Document libraries access successful');
    console.log(`Found ${libraries.value.length} libraries`);
    
  } catch (siteError) {
    console.log('❌ Site access failed:', siteError.message);
    
    if (siteError.statusCode === 403) {
      console.log('\n💡 TROUBLESHOOTING: Permission issues');
      console.log('   - Check if your Azure AD app has been granted admin consent');
      console.log('   - Verify the app has Sites.ReadWrite.All permission');
      console.log('   - Make sure the app is added to each SharePoint site');
    }
  }
  
} catch (error) {
  console.log('❌ Failed:', error.message);
}