import { Router, Request, Response, NextFunction } from 'express';
import { JiraClient } from '../services/jiraClient';
import { ConnectJiraClient, ConnectAuth } from '../services/connectJiraClient';
import { ReportService } from '../services/reportService';
import { WordExportService } from '../services/wordExportService';
import { PptExportService } from '../services/pptExportService';
import { TimesheetService } from '../services/timesheetService';
import { TemplateService } from '../services/templateService';
import { getWeekNumbers } from '../utils/weekUtils';
import { extractIssueFields } from '../utils/jiraFieldUtils';
import { extractJiraCredentials } from '../middleware/auth';
import { verifyConnectJWT, getConnectAuth } from '../middleware/connectAuth';
import { config } from '../config';

const router = Router();
const reportService = new ReportService();
const wordExportService = new WordExportService();
const pptExportService = new PptExportService();
const timesheetService = new TimesheetService();
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
  if (req.jiraCredentials) {
    return req.jiraCredentials.email;
  }
  
  // Default fallback - use a default user ID so we can still get default template
  // This allows the app to work even if authentication hasn't been completed yet
  return 'default-user';
};

// Middleware to get appropriate Jira client (Connect or legacy)
const getJiraClientMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Try Connect authentication first
  if (req.context && req.jwt) {
    const connectAuth = getConnectAuth(req);
    if (connectAuth && connectAuth.sharedSecret) {
      // Use Connect JWT authentication
      (req as any).jiraClient = new ConnectJiraClient(connectAuth);
      return next();
    }
  }
  
  // Fall back to legacy authentication
  if (req.jiraCredentials) {
    // Get baseUrl from credentials or header
    const baseUrl = (req.jiraCredentials as any).baseUrl || req.headers['x-jira-base-url'] as string || config.jira.baseUrl;
    if (!baseUrl) {
      res.status(400).json({ error: 'Jira base URL is required. Please authenticate with your Jira instance URL.' });
      return;
    }
    // Create JiraClient with custom baseUrl
    const credentials = req.jiraCredentials;
    const axios = require('axios').default;
    const auth = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64');
    const customClient = axios.create({
      baseURL: `${baseUrl}/rest/api/3`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    // Create a wrapper that matches JiraClient interface
    // We need to use the actual JiraClient class but with custom baseUrl
    // Since JiraClient constructor uses config.jira.baseUrl, we'll create a custom instance
    const customJiraClient = new JiraClient(credentials);
    // Override the client's baseURL
    (customJiraClient as any).client = customClient;
    
    // Override getIssueChildren to use /search/jql endpoint
    const originalGetIssueChildren = customJiraClient.getIssueChildren.bind(customJiraClient);
    customJiraClient.getIssueChildren = async (issueKey: string) => {
      const parentIssue = await customJiraClient.getIssue(issueKey);
      const issueType = parentIssue.fields.issuetype?.name?.toLowerCase() || '';
      
      let jql: string;
      if (issueType.includes('epic')) {
        jql = `"Epic Link" = ${issueKey} ORDER BY status ASC`;
      } else {
        jql = `parent = ${issueKey} ORDER BY status ASC`;
      }
      
      try {
        const response = await customClient.post('/search/jql', {
          jql,
          fields: ['summary', 'status', 'labels', 'issuetype', 'parent', 'timespent', 'timeestimate', 'aggregatetimespent', 'aggregatetimeestimate'],
          maxResults: 1000,
        });
        return response.data.issues || [];
      } catch (error: any) {
        if (!issueType.includes('epic')) {
          jql = `"Epic Link" = ${issueKey} ORDER BY status ASC`;
          const response = await customClient.post('/search/jql', {
            jql,
            fields: ['summary', 'status', 'labels', 'issuetype', 'parent', 'timespent', 'timeestimate', 'aggregatetimespent', 'aggregatetimeestimate'],
            maxResults: 1000,
          });
          return response.data.issues || [];
        }
        throw error;
      }
    };
    
    (req as any).jiraClient = customJiraClient;
    return next();
  }
  
  // No authentication found
  res.status(401).json({ error: 'Authentication required. Please install the Connect app or provide credentials.' });
};

// Helper function to get Jira client from request
const getJiraClient = (req: Request): JiraClient | ConnectJiraClient => {
  if ((req as any).jiraClient) {
    return (req as any).jiraClient;
  }
  
  // Fallback for backward compatibility
  if (req.jiraCredentials) {
    return new JiraClient(req.jiraCredentials);
  }
  
  // Try to use Connect auth if available
  const connectAuth = getConnectAuth(req);
  if (connectAuth && connectAuth.sharedSecret) {
    return new ConnectJiraClient(connectAuth);
  }
  
  // Last resort: use default client
  return new JiraClient();
};

// Authentication endpoint - validates credentials
router.post('/auth', async (req: Request, res: Response) => {
  try {
    const { email, apiToken, baseUrl } = req.body;
    
    if (!email || !apiToken) {
      return res.status(400).json({ error: 'Email and API token are required' });
    }

    // Use provided baseUrl or fall back to config
    const jiraBaseUrl = baseUrl || config.jira.baseUrl;
    if (!jiraBaseUrl) {
      return res.status(400).json({ error: 'Jira base URL is required. Please provide your Jira instance URL (e.g., https://your-domain.atlassian.net)' });
    }

    // Test credentials by trying to get current user
    // Create axios instance directly with provided credentials and baseUrl
    const axios = require('axios').default;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const testClient = axios.create({
      baseURL: `${jiraBaseUrl}/rest/api/3`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Try to get current user info via /myself endpoint
    try {
      const response = await testClient.get('/myself');
      res.json({ 
        success: true, 
        user: response.data.displayName || response.data.emailAddress,
        message: 'Authentication successful' 
      });
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return res.status(401).json({ error: 'Invalid Jira credentials' });
      }
      // If /myself doesn't work, just return success (credentials might still be valid)
      res.json({ 
        success: true, 
        message: 'Credentials accepted (validation may vary by Jira instance)' 
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware chain: try Connect JWT, then legacy auth
router.get('/issue/:issueKey', verifyConnectJWT, extractJiraCredentials, getJiraClientMiddleware, async (req: Request, res: Response) => {
  try {
    const { issueKey } = req.params;
    const jiraClient = getJiraClient(req);
    const issue = await jiraClient.getIssue(issueKey);
    res.json(issue);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/issue/:issueKey/children', verifyConnectJWT, extractJiraCredentials, getJiraClientMiddleware, async (req: Request, res: Response) => {
  try {
    const { issueKey } = req.params;
    const jiraClient = getJiraClient(req);
    const children = await jiraClient.getIssueChildren(issueKey);
    res.json(children);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/report/:issueKey', verifyConnectJWT, extractJiraCredentials, getJiraClientMiddleware, async (req: Request, res: Response) => {
  try {
    const { issueKey } = req.params;
    const { templateId } = req.query; // Optional template ID
    const jiraClient = getJiraClient(req);
    
    // Validate and normalize issue key
    const normalizedKey = issueKey.trim().toUpperCase();
    if (!normalizedKey || !/^[A-Z]+-\d+$/.test(normalizedKey)) {
      return res.status(400).json({ 
        error: `Invalid ticket key format: "${issueKey}". Expected format: PROJ-123` 
      });
    }
    
    // Verify the issue exists and get its type
    const issue = await jiraClient.getIssue(normalizedKey);
    
    // Get all children
    const children = await jiraClient.getIssueChildren(normalizedKey);
    
    // Get template if provided, otherwise use default
    let template;
    if (templateId && typeof templateId === 'string') {
      const userId = getUserId(req);
      template = templateService.getTemplate(templateId, userId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found or access denied' });
      }
    } else {
      // Use default template for user
      const userId = getUserId(req);
      template = templateService.getDefaultTemplate(userId);
    }
    
    // Generate report using template
    const report = reportService.generateReport(children, template);
    
    // Generate timesheet
    const timesheet = timesheetService.generateTimesheet(issue, children);
    
    // Get current week numbers
    const weekNumbers = getWeekNumbers();
    
    // Extract additional fields
    const additionalFields = extractIssueFields(issue);
    
    res.json({
      parentIssue: {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        statusCategory: issue.fields.status.statusCategory.name,
        issuetype: issue.fields.issuetype?.name || 'Unknown',
        labels: issue.fields.labels || [],
        assignee: additionalFields.assignee,
        startDate: additionalFields.startDate,
        endDate: additionalFields.duedate,
        confidence: additionalFields.confidence,
      },
      report,
      timesheet,
      weekNumbers,
      childrenCount: children.length,
    });
  } catch (error: any) {
    const statusCode = error.message.includes('does not exist') ? 404 
                     : error.message.includes('permission') ? 403 
                     : 500;
    res.status(statusCode).json({ error: error.message });
  }
});

router.get('/export/:issueKey', verifyConnectJWT, extractJiraCredentials, getJiraClientMiddleware, async (req: Request, res: Response) => {
  try {
    const { issueKey } = req.params;
    const { templateId } = req.query; // Optional template ID
    const jiraClient = getJiraClient(req);
    
    // Verify the issue exists and get full details
    const issue = await jiraClient.getIssue(issueKey);
    
    // Get all children
    const children = await jiraClient.getIssueChildren(issueKey);
    
    // Get template if provided, otherwise use default
    let template;
    if (templateId && typeof templateId === 'string') {
      const userId = getUserId(req);
      template = templateService.getTemplate(templateId, userId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found or access denied' });
      }
    } else {
      const userId = getUserId(req);
      template = templateService.getDefaultTemplate(userId);
    }
    
    // Generate report using template
    const report = reportService.generateReport(children, template);
    
    // Generate timesheet
    const timesheet = timesheetService.generateTimesheet(issue, children);
    
    // Generate Word document with full issue details
    const buffer = await wordExportService.generateDocument(report, issue, timesheet);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="ABC-Manager-Weekly-${issueKey}.docx"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export-ppt/:issueKey', verifyConnectJWT, extractJiraCredentials, getJiraClientMiddleware, async (req: Request, res: Response) => {
  try {
    const { issueKey } = req.params;
    const { templateId } = req.query; // Optional template ID
    const jiraClient = getJiraClient(req);
    
    // Verify the issue exists and get full details
    const issue = await jiraClient.getIssue(issueKey);
    
    // Get all children
    const children = await jiraClient.getIssueChildren(issueKey);
    
    // Get template if provided, otherwise use default
    let template;
    if (templateId && typeof templateId === 'string') {
      const userId = getUserId(req);
      template = templateService.getTemplate(templateId, userId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found or access denied' });
      }
    } else {
      const userId = getUserId(req);
      template = templateService.getDefaultTemplate(userId);
    }
    
    // Generate report using template
    const report = reportService.generateReport(children, template);
    
    // Generate timesheet
    const timesheet = timesheetService.generateTimesheet(issue, children);
    
    // Generate PPT presentation
    const buffer = await pptExportService.generatePresentation(report, issue, timesheet);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="ABC-Manager-Weekly-${issueKey}.pptx"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/search/:query', verifyConnectJWT, extractJiraCredentials, getJiraClientMiddleware, async (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    const { project } = req.query;
    const jiraClient = getJiraClient(req);
    
    const results = await jiraClient.searchIssuesByText(query, project as string | undefined);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

