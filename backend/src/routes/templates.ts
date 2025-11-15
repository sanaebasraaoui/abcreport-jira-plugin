/**
 * Template Routes
 * 
 * API routes for managing report templates.
 * Supports CRUD operations for templates with user-based authorization.
 */

import { Router, Request, Response } from 'express';
import { TemplateService } from '../services/templateService';
import { ReportTemplate } from '../types/template';
import { verifyConnectJWT, getConnectAuth } from '../middleware/connectAuth';
import { extractJiraCredentials } from '../middleware/auth';

const router = Router();
const templateService = new TemplateService();

/**
 * Get user ID from request
 * In Connect mode, use Jira user account ID
 * In standalone mode, use email from credentials
 */
const getUserId = (req: Request): string => {
  // Try Connect mode first (from JWT)
  if (req.context && req.jwt) {
    return req.jwt.sub || req.context.clientKey || 'connect-user';
  }
  
  // Fall back to standalone mode (email from credentials)
  if (req.jiraCredentials && req.jiraCredentials.email) {
    return req.jiraCredentials.email;
  }
  
  // Default fallback - use a default user ID so we can still get default template
  return 'default-user';
};

/**
 * Get all templates for the current user
 * 
 * GET /api/templates
 */
router.get('/', verifyConnectJWT, extractJiraCredentials, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const includeShared = req.query.includeShared !== 'false';
    const templates = templateService.getTemplatesForUser(userId, includeShared);
    res.json(templates);
  } catch (error: any) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get default template for the current user
 * 
 * IMPORTANT: This route must come BEFORE /:templateId to avoid routing conflicts
 * GET /api/templates/default
 */
router.get('/default', verifyConnectJWT, extractJiraCredentials, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const template = templateService.getDefaultTemplate(userId);
    res.json(template);
  } catch (error: any) {
    console.error('Error getting default template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific template by ID
 * 
 * IMPORTANT: This route must come AFTER /default to avoid routing conflicts
 * GET /api/templates/:templateId
 */
router.get('/:templateId', verifyConnectJWT, extractJiraCredentials, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    
    // Don't treat "default" as a templateId - redirect to getDefaultTemplate logic
    if (templateId === 'default') {
      const userId = getUserId(req);
      const template = templateService.getDefaultTemplate(userId);
      return res.json(template);
    }
    
    const userId = getUserId(req);
    const template = templateService.getTemplate(templateId, userId);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found or access denied' });
    }
    
    res.json(template);
  } catch (error: any) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new template
 * 
 * POST /api/templates
 * 
 * Body: {
 *   name: string;
 *   description?: string;
 *   fieldMapping: FieldMappingConfig;
 *   issueSelection: IssueSelectionConfig;
 *   isShared?: boolean;
 * }
 */
router.post('/', verifyConnectJWT, extractJiraCredentials, async (req: Request, res: Response) => {
  try {
    // Get userId from request (either from JWT/Connect context or from credentials)
    // If userId is provided in body, use it (for backward compatibility)
    // Otherwise, extract it from the request
    let userId = req.body.userId;
    
    if (!userId) {
      // Extract userId from request (from JWT or credentials)
      userId = getUserId(req);
    } else {
      // userId provided in body - verify it matches the authenticated user
      const authenticatedUserId = getUserId(req);
      // Only allow userId override if it matches authenticated user (for security)
      if (userId !== authenticatedUserId) {
        userId = authenticatedUserId;
      }
    }
    
    const { name, description, fieldMapping, issueSelection, isShared } = req.body;
    
    if (!name || !fieldMapping || !issueSelection) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, fieldMapping, issueSelection' 
      });
    }
    
    const template = templateService.createTemplate({
      name,
      description,
      userId,
      isShared: isShared || false,
      fieldMapping,
      issueSelection,
    });
    
    res.status(201).json(template);
  } catch (error: any) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update an existing template
 * 
 * PUT /api/templates/:templateId
 * 
 * Body: {
 *   name?: string;
 *   description?: string;
 *   fieldMapping?: FieldMappingConfig;
 *   issueSelection?: IssueSelectionConfig;
 *   isShared?: boolean;
 * }
 */
router.put('/:templateId', verifyConnectJWT, extractJiraCredentials, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const userId = getUserId(req);
    const updates = req.body;
    
    const updatedTemplate = templateService.updateTemplate(templateId, userId, updates);
    
    if (!updatedTemplate) {
      return res.status(404).json({ error: 'Template not found or access denied' });
    }
    
    res.json(updatedTemplate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a template
 * 
 * DELETE /api/templates/:templateId
 */
router.delete('/:templateId', verifyConnectJWT, extractJiraCredentials, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const userId = getUserId(req);
    
    const deleted = templateService.deleteTemplate(templateId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Template not found, access denied, or cannot delete default template' });
    }
    
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clone a template
 * 
 * POST /api/templates/:templateId/clone
 * 
 * Body: {
 *   name: string; // Name for the cloned template
 * }
 */
router.post('/:templateId/clone', verifyConnectJWT, extractJiraCredentials, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const userId = getUserId(req);
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }
    
    const clonedTemplate = templateService.cloneTemplate(templateId, userId, name);
    
    if (!clonedTemplate) {
      return res.status(404).json({ error: 'Template not found or access denied' });
    }
    
    res.status(201).json(clonedTemplate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

