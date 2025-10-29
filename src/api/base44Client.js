import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68e9f706337358e3942ab2c1", 
  requiresAuth: true // Ensure authentication is required for all operations
});
