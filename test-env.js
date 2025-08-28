require('dotenv').config();

console.log('TENANT_ID:', process.env.TENANT_ID);
console.log('SHAREPOINT_CLIENT_ID:', process.env.SHAREPOINT_CLIENT_ID);
console.log('SHAREPOINT_CLIENT_SECRET:', process.env.SHAREPOINT_CLIENT_SECRET ? '***present***' : '***missing***');
