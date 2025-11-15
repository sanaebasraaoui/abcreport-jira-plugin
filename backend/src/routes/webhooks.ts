/**
 * Webhook Routes
 * 
 * These routes handle webhook events from Jira. Webhooks allow Jira to notify
 * your app when certain events occur (e.g., issue created, updated, deleted).
 * 
 * Webhook requests are automatically verified by Jira, so you don't need to
 * authenticate them yourself. However, you should verify the webhook signature
 * in production for security.
 * 
 * The webhook payload structure follows Jira's webhook format:
 * - webhookEvent: Type of event (e.g., "jira:issue_created")
 * - issue: The issue data
 * - user: User who performed the action
 * - changelog: Changes made (for update events)
 * 
 * Current webhooks configured in atlassian-connect.json:
 * - jira:issue_created
 * - jira:issue_updated
 * - jira:issue_deleted
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Handle Issue Created Webhook
 * 
 * Called when a new issue is created in Jira.
 * 
 * POST /webhook/issue-created
 * 
 * @param req.body.webhookEvent - Event type ("jira:issue_created")
 * @param req.body.issue - The newly created issue object
 * @param req.body.user - User who created the issue
 */
router.post('/issue-created', async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;
    console.log('Issue created:', webhookData.issue?.key);
    
    // Process webhook data here
    // In production, you might want to:
    // - Update caches (if you cache issue data)
    // - Trigger background jobs (e.g., send notifications)
    // - Send notifications to other systems
    // - Update related data structures
    // - Log the event for audit purposes
    // - Update analytics/metrics
    // etc.
    
    // Return 204 No Content (success, no response body needed)
    res.status(204).send();
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle Issue Updated Webhook
 * 
 * Called when an issue is updated in Jira.
 * 
 * POST /webhook/issue-updated
 * 
 * @param req.body.webhookEvent - Event type ("jira:issue_updated")
 * @param req.body.issue - The updated issue object
 * @param req.body.user - User who updated the issue
 * @param req.body.changelog - Details of what changed
 */
router.post('/issue-updated', async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;
    console.log('Issue updated:', webhookData.issue?.key);
    
    // Process webhook data here
    // In production, you might want to:
    // - Update caches
    // - Check if status changed (might affect reports)
    // - Trigger notifications if important fields changed
    // - Update related data structures
    // - Sync with external systems
    // etc.
    
    // Return 204 No Content (success, no response body needed)
    res.status(204).send();
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle Issue Deleted Webhook
 * 
 * Called when an issue is deleted in Jira.
 * 
 * POST /webhook/issue-deleted
 * 
 * @param req.body.webhookEvent - Event type ("jira:issue_deleted")
 * @param req.body.issue - The deleted issue object (may be minimal)
 * @param req.body.user - User who deleted the issue
 */
router.post('/issue-deleted', async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;
    console.log('Issue deleted:', webhookData.issue?.key);
    
    // Process webhook data here
    // In production, you might want to:
    // - Remove from caches
    // - Clean up related data
    // - Update analytics/metrics
    // - Notify other systems
    // - Archive data (if you need to keep it)
    // etc.
    
    // Return 204 No Content (success, no response body needed)
    res.status(204).send();
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

