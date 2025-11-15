/**
 * Legacy Authentication Middleware
 * 
 * This module provides middleware for extracting Jira credentials in standalone mode.
 * This is used when the app runs as a standalone web application (not as a Connect plugin).
 * 
 * In standalone mode, users manually provide their Jira email and API token via:
 * - Authorization header (Bearer token with base64-encoded email:token)
 * - Request body (jiraEmail and jiraApiToken fields)
 * - Query parameters (jiraEmail and jiraApiToken)
 * 
 * Note: In Connect mode, authentication is handled automatically via JWT tokens,
 * so this middleware is not used.
 */

import { Request, Response, NextFunction } from 'express';
import { JiraCredentials } from '../services/jiraClient';

/**
 * Extend Express Request type to include Jira credentials
 * This allows TypeScript to know about jiraCredentials when added by middleware
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * Jira credentials extracted from the request
       * Contains email and API token for Basic Auth
       */
      jiraCredentials?: JiraCredentials;
    }
  }
}

/**
 * Middleware to extract Jira credentials from request
 * 
 * This middleware checks multiple locations for Jira credentials:
 * 1. Authorization header (Bearer token with base64-encoded email:token)
 * 2. Request body (jiraEmail and jiraApiToken fields)
 * 3. Query parameters (jiraEmail and jiraApiToken)
 * 
 * If credentials are found, they are attached to req.jiraCredentials.
 * If no credentials are found, the request is rejected with a 401 error.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const extractJiraCredentials = (req: Request, res: Response, next: NextFunction): void => {
  // Try to get credentials from Authorization header
  // Format: Authorization: Bearer <base64-encoded-email:token>
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // Extract the base64-encoded credentials
      const encoded = authHeader.substring(7); // Remove "Bearer " prefix
      
      // Decode from base64 to get "email:token" format
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const [email, apiToken] = decoded.split(':');
      
      // If we successfully extracted both email and token, use them
      if (email && apiToken) {
        req.jiraCredentials = { email: email.trim(), apiToken: apiToken.trim() };
        // Also get baseUrl from header if provided
        const baseUrl = req.headers['x-jira-base-url'] as string;
        if (baseUrl) {
          (req.jiraCredentials as any).baseUrl = baseUrl;
        }
        return next();
      }
    } catch (error) {
      // Invalid base64 format, continue to check other locations
    }
  }

  // Try to get credentials from request body
  // Useful for POST requests with JSON body
  if (req.body && req.body.jiraEmail && req.body.jiraApiToken) {
    req.jiraCredentials = {
      email: req.body.jiraEmail,
      apiToken: req.body.jiraApiToken,
    };
    return next();
  }

  // Try to get credentials from query parameters
  // Useful for GET requests where credentials can't be in body
  if (req.query && req.query.jiraEmail && req.query.jiraApiToken) {
    req.jiraCredentials = {
      email: req.query.jiraEmail as string,
      apiToken: req.query.jiraApiToken as string,
    };
    return next();
  }

  // No credentials found in any location
  // For template routes, we allow requests without credentials (they'll use default-user)
  // Don't reject - let the request continue, getUserId will use default-user
  next();
};

