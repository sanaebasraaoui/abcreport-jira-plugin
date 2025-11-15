/**
 * Configuration Module
 * 
 * This module loads and manages application configuration from environment variables.
 * It supports both standalone mode (with manual Jira credentials) and Connect mode
 * (where authentication is handled via JWT tokens from Jira).
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration object
 * Contains all configuration settings needed by the application
 */
export const config = {
  /**
   * Jira configuration
   * Used for connecting to Jira API
   */
  jira: {
    // Base URL of the Jira instance (e.g., https://your-domain.atlassian.net)
    // Not required in Connect mode (comes from JWT token)
    baseUrl: process.env.JIRA_BASE_URL || '',
    
    // Email for Basic Auth (used in standalone mode only)
    // Not required in Connect mode
    email: process.env.JIRA_EMAIL || '',
    
    // API token for Basic Auth (used in standalone mode only)
    // Not required in Connect mode
    apiToken: process.env.JIRA_API_TOKEN || '',
    
    // Shared secret for verifying JWT tokens from Jira Connect
    // This is provided by Jira when the app is installed
    // Required for Connect mode after installation
    sharedSecret: process.env.SHARED_SECRET || '',
  },
  
  /**
   * Server configuration
   */
  server: {
    // Port number for the Express server
    // Defaults to 3001 if not specified
    port: parseInt(process.env.PORT || '3001', 10),
  },
  
  /**
   * Frontend configuration
   */
  frontend: {
    // Frontend URL for CORS configuration
    // Used to allow frontend requests from this origin
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  
  /**
   * Connect app configuration
   * Used for Atlassian Connect integration
   */
  connect: {
    // Unique app key for the Connect app
    // Must match the key in atlassian-connect.json
    appKey: process.env.APP_KEY || 'com.abcreport.weekly-report',
    
    // Base URL where this Connect app is hosted
    // Should be the public URL (e.g., ngrok URL for development, production URL for production)
    baseUrl: process.env.CONNECT_BASE_URL || 'http://localhost:3001',
  },
};

/**
 * Validates the application configuration
 * 
 * In Connect mode, JIRA_BASE_URL is not required because it comes from the JWT token.
 * In standalone mode, JIRA_BASE_URL is required.
 * 
 * @throws {Error} If configuration is invalid
 */
export const validateConfig = () => {
  // Check if we're running in Connect mode
  // Connect mode is detected by the presence of SHARED_SECRET or CONNECT_BASE_URL
  const isConnectMode = process.env.SHARED_SECRET || process.env.CONNECT_BASE_URL;
  
  // Only require JIRA_BASE_URL in standalone mode
  if (!isConnectMode && !config.jira.baseUrl) {
    throw new Error('JIRA_BASE_URL is required for standalone mode. For Connect mode, set SHARED_SECRET or CONNECT_BASE_URL.');
  }
  
  // Email and API token are no longer required in config
  // They will be provided by:
  // - User at runtime (standalone mode - via authentication modal)
  // - JWT token from Jira (Connect mode - automatically included in requests)
};

