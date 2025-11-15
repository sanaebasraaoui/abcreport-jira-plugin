/**
 * Lifecycle Routes
 * 
 * These routes handle app installation and uninstallation events from Jira.
 * When a Jira administrator installs or uninstalls the Connect app, Jira sends
 * POST requests to these endpoints.
 * 
 * Installation Event (/installed):
 * - Jira sends installation data including sharedSecret, clientKey, and baseUrl
 * - This is when you should store the sharedSecret for JWT verification
 * - The sharedSecret is unique per installation and must be kept secure
 * 
 * Uninstallation Event (/uninstalled):
 * - Jira sends the clientKey to identify which installation was removed
 * - This is when you should clean up any stored data for that installation
 * 
 * Note: These endpoints don't require authentication because Jira verifies
 * the requests are coming from a legitimate Jira instance.
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Handle App Installation
 * 
 * This endpoint is called by Jira when the app is installed in a Jira instance.
 * Jira sends installation data including:
 * - clientKey: Unique identifier for this installation
 * - sharedSecret: Secret used to verify JWT tokens (CRITICAL - must be stored securely)
 * - baseUrl: URL of the Jira instance
 * - key: Same as clientKey (for compatibility)
 * - oauthClientId: OAuth client ID (if using OAuth)
 * - publicKey: Public key (if using public key verification)
 * 
 * POST /lifecycle/installed
 */
router.post('/installed', async (req: Request, res: Response) => {
  try {
    // Extract installation data from request body
    const { clientKey, sharedSecret, baseUrl, key, oauthClientId, publicKey } = req.body;
    
    console.log('App installed:', {
      clientKey,
      baseUrl,
      key,
      hasSharedSecret: !!sharedSecret,
      hasOAuthClientId: !!oauthClientId,
    });

    // IMPORTANT: Store installation data securely
    // In production, you should:
    // 1. Store clientKey and sharedSecret in a secure database
    // 2. Encrypt the sharedSecret before storing
    // 3. Store baseUrl to identify the Jira instance
    // 4. Set up any necessary database records
    // 5. Update configuration or environment variables
    // 
    // For now, we just log it. In production, implement database storage:
    // await db.installations.create({
    //   clientKey,
    //   sharedSecret: encrypt(sharedSecret), // Encrypt before storing
    //   baseUrl,
    //   installedAt: new Date(),
    // });

    // Return 204 No Content (success, no response body needed)
    res.status(204).send();
  } catch (error: any) {
    console.error('Installation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle App Uninstallation
 * 
 * This endpoint is called by Jira when the app is uninstalled from a Jira instance.
 * Jira sends the clientKey to identify which installation was removed.
 * 
 * You should use this opportunity to:
 * - Delete stored installation data
 * - Clean up any cached data for that installation
 * - Revoke any OAuth tokens
 * - Free up any resources
 * 
 * POST /lifecycle/uninstalled
 */
router.post('/uninstalled', async (req: Request, res: Response) => {
  try {
    // Extract clientKey from request body
    const { clientKey } = req.body;
    
    console.log('App uninstalled:', { clientKey });

    // IMPORTANT: Clean up installation data
    // In production, you should:
    // 1. Delete installation record from database
    // 2. Delete any cached data for this installation
    // 3. Revoke OAuth tokens if applicable
    // 4. Clean up any resources
    //
    // For now, we just log it. In production, implement cleanup:
    // await db.installations.delete({ clientKey });

    // Return 204 No Content (success, no response body needed)
    res.status(204).send();
  } catch (error: any) {
    console.error('Uninstallation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

