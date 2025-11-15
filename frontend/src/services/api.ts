/**
 * API Service
 * 
 * This service provides methods for making authenticated requests to the backend API.
 * It supports both Connect mode (JWT authentication) and standalone mode (Basic Auth).
 * 
 * The service automatically detects the mode and uses the appropriate authentication:
 * - Connect mode: Uses JWT tokens from Connect context (AP.request)
 * - Standalone mode: Uses credentials from sessionStorage (axios with Bearer token)
 */

import axios from 'axios';
import { ReportData, IssueSuggestion } from '../types';
import { ReportTemplate } from '../types/template';
import { isConnectApp, makeConnectRequest, getJWT } from '../utils/connectUtils';

// Base URL for API requests
// Can be overridden with REACT_APP_API_URL environment variable
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Helper function to get Jira credentials from sessionStorage (for legacy/standalone mode)
 * 
 * @returns Base64-encoded credentials string or null if not found
 */
const getCredentials = (): string | null => {
  return sessionStorage.getItem('jira_credentials');
};

/**
 * Helper function to create axios request configuration with authentication
 * 
 * This function creates the appropriate authentication headers based on the current mode:
 * - Connect mode: Adds JWT token from Connect context
 * - Standalone mode: Adds Bearer token with credentials from sessionStorage
 * 
 * @returns Promise that resolves to axios request configuration object
 */
const createAuthenticatedRequest = async () => {
  const config: any = {};
  
  // Always try standalone mode first (check sessionStorage)
  const credentials = getCredentials();
  const baseUrl = sessionStorage.getItem('jira_base_url');
  
  if (credentials && baseUrl) {
    // We have standalone credentials - use them
    config.headers = {
      'Authorization': `Bearer ${credentials}`, // Bearer token with base64-encoded email:token
    };
    // Include baseUrl in headers so backend can use it
    config.headers['X-Jira-Base-Url'] = baseUrl;
    return config;
  }
  
  // No standalone credentials - try Connect mode
  if (isConnectApp()) {
    // Check if we have a JWT in URL (real Connect mode)
    const urlParams = new URLSearchParams(window.location.search);
    const hasJWT = urlParams.has('jwt');
    
    if (hasJWT) {
      // Connect mode: use JWT from URL or Connect context
      const jwt = await getJWT();
      if (jwt) {
        config.headers = {
          'Authorization': `JWT ${jwt}`, // JWT token for Connect
        };
        // Also add jwt as query parameter for Connect (some setups need it)
        config.params = {
          jwt,
        };
      }
    }
  }
  
  return config;
};

/**
 * Helper to determine if we should use Connect API (AP.request) or regular axios
 * 
 * Uses Connect API when:
 * - Running in Connect mode (AP object available)
 * - AP.request method is available
 * - AND we have a JWT token in the URL (really in Connect mode)
 * 
 * Otherwise falls back to regular axios requests with Bearer token.
 * 
 * @returns true if should use Connect API, false otherwise
 */
const shouldUseConnectAPI = (): boolean => {
  // Check if we have a JWT in the URL (real Connect mode)
  const urlParams = new URLSearchParams(window.location.search);
  const hasJWT = urlParams.has('jwt');
  
  // Only use Connect API if we have AP.request AND a JWT token
  return hasJWT && isConnectApp() && typeof window !== 'undefined' && typeof window.AP !== 'undefined' && typeof window.AP.request !== 'undefined';
};

/**
 * API Service Object
 * 
 * Provides methods for all API interactions:
 * - Authentication
 * - Fetching reports
 * - Exporting documents (Word, PPT)
 * - Searching issues
 */
export const api = {
  /**
   * Authenticate with Jira (standalone mode only)
   * 
   * Validates Jira credentials by attempting to connect to Jira API.
   * This is only used in standalone mode. In Connect mode, authentication
   * is handled automatically.
   * 
   * @param baseUrl - Jira instance base URL (e.g., https://your-domain.atlassian.net)
   * @param email - Jira user email address
   * @param apiToken - Jira API token
   * @returns Promise that resolves to authentication result
   */
  authenticate: async (baseUrl: string, email: string, apiToken: string) => {
    const response = await axios.post(`${API_BASE_URL}/jira/auth`, {
      baseUrl,
      email,
      apiToken,
    });
    return response.data;
  },

  /**
   * Get weekly report for an issue
   * 
   * Fetches the weekly report data for a given Jira issue. The report includes:
   * - Parent issue details
   * - Child issues organized by status (Last week, Current week, Next week, Later)
   * - Timesheet information
   * - Week numbers
   * 
   * @param issueKey - The Jira issue key (e.g., "PROJ-123")
   * @param templateId - Optional template ID to use for field mapping
   * @returns Promise that resolves to ReportData
   */
  getReport: async (issueKey: string, templateId?: string): Promise<ReportData> => {
    const url = templateId
      ? `${API_BASE_URL}/jira/report/${issueKey}?templateId=${templateId}`
      : `${API_BASE_URL}/jira/report/${issueKey}`;
    
    if (shouldUseConnectAPI()) {
      // Connect mode: Use Connect API (AP.request) which handles JWT automatically
      return makeConnectRequest(url, { method: 'GET' });
    } else {
      // Standalone mode: Use regular axios with Bearer token
      const config = await createAuthenticatedRequest();
      const response = await axios.get<ReportData>(url, config);
      return response.data;
    }
  },

  /**
   * Export report to Word document
   * 
   * Downloads the weekly report as a Word document (.docx).
   * 
   * @param issueKey - The Jira issue key
   * @param templateId - Optional template ID to use for field mapping
   * @returns Promise that resolves to a Blob containing the Word document
   */
  exportWord: async (issueKey: string, templateId?: string): Promise<Blob> => {
    const url = templateId
      ? `${API_BASE_URL}/jira/export/${issueKey}?templateId=${templateId}`
      : `${API_BASE_URL}/jira/export/${issueKey}`;
    
    if (shouldUseConnectAPI()) {
      // Connect mode: Use Connect API for blob download
      return makeConnectRequest(url, { method: 'GET', responseType: 'blob' });
    } else {
      // Standalone mode: Use regular axios with blob response type
      const config = await createAuthenticatedRequest();
      const response = await axios.get(url, {
        ...config,
        responseType: 'blob', // Request binary data (Word document)
      });
      return response.data;
    }
  },

  /**
   * Export report to PowerPoint presentation
   * 
   * Downloads the weekly report as a PowerPoint presentation (.pptx).
   * 
   * @param issueKey - The Jira issue key
   * @param templateId - Optional template ID to use for field mapping
   * @returns Promise that resolves to a Blob containing the PPT file
   */
  exportPpt: async (issueKey: string, templateId?: string): Promise<Blob> => {
    const url = templateId
      ? `${API_BASE_URL}/jira/export-ppt/${issueKey}?templateId=${templateId}`
      : `${API_BASE_URL}/jira/export-ppt/${issueKey}`;
    
    if (shouldUseConnectAPI()) {
      // Connect mode: Use Connect API for blob download
      return makeConnectRequest(url, { method: 'GET', responseType: 'blob' });
    } else {
      // Standalone mode: Use regular axios with blob response type
      const config = await createAuthenticatedRequest();
      const response = await axios.get(url, {
        ...config,
        responseType: 'blob', // Request binary data (PPT file)
      });
      return response.data;
    }
  },

  /**
   * Search issues by text
   * 
   * Searches for issues matching the given text query. Only returns issues
   * of eligible types (Epic, Hub, Program, Epic Portfolio). Supports both
   * text search (summary) and key prefix search.
   * 
   * @param query - Search text (can be issue key prefix like "PROJ-" or summary text)
   * @param project - Optional project key to limit search to a specific project
   * @returns Promise that resolves to an array of issue suggestions
   */
  searchIssues: async (query: string, project?: string): Promise<IssueSuggestion[]> => {
    const url = project 
      ? `${API_BASE_URL}/jira/search/${encodeURIComponent(query)}?project=${project}`
      : `${API_BASE_URL}/jira/search/${encodeURIComponent(query)}`;
    
    if (shouldUseConnectAPI()) {
      // Connect mode: Use Connect API
      const fullUrl = project ? `${url}&project=${project}` : url;
      return makeConnectRequest(fullUrl, { method: 'GET' });
    } else {
      // Standalone mode: Use regular axios
      const config = await createAuthenticatedRequest();
      const response = await axios.get<IssueSuggestion[]>(
        url,
        config
      );
      return response.data;
    }
  },

  /**
   * Template Management APIs
   */

  /**
   * Get all templates for the current user
   * 
   * @param includeShared - Whether to include shared templates (default: true)
   * @returns Promise that resolves to an array of templates
   */
  getTemplates: async (includeShared: boolean = true): Promise<ReportTemplate[]> => {
    const url = `${API_BASE_URL}/templates${includeShared ? '' : '?includeShared=false'}`;
    
    if (shouldUseConnectAPI()) {
      return makeConnectRequest(url, { method: 'GET' });
    } else {
      const config = await createAuthenticatedRequest();
      const response = await axios.get<ReportTemplate[]>(url, config);
      return response.data;
    }
  },

  /**
   * Get a specific template by ID
   * 
   * @param templateId - Template ID
   * @returns Promise that resolves to a template
   */
  getTemplate: async (templateId: string): Promise<ReportTemplate> => {
    const url = `${API_BASE_URL}/templates/${templateId}`;
    
    if (shouldUseConnectAPI()) {
      return makeConnectRequest(url, { method: 'GET' });
    } else {
      const config = await createAuthenticatedRequest();
      const response = await axios.get<ReportTemplate>(url, config);
      return response.data;
    }
  },

  /**
   * Get default template for the current user
   * 
   * @returns Promise that resolves to the default template
   */
  getDefaultTemplate: async (): Promise<ReportTemplate> => {
    const url = `${API_BASE_URL}/templates/default`;
    
    if (shouldUseConnectAPI()) {
      return makeConnectRequest(url, { method: 'GET' });
    } else {
      const config = await createAuthenticatedRequest();
      const response = await axios.get<ReportTemplate>(url, config);
      return response.data;
    }
  },

  /**
   * Create a new template
   * 
   * @param template - Template data (without id, createdAt, updatedAt)
   * @returns Promise that resolves to the created template
   */
  createTemplate: async (template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReportTemplate> => {
    const url = `${API_BASE_URL}/templates`;
    
    if (shouldUseConnectAPI()) {
      return makeConnectRequest(url, { method: 'POST', data: template });
    } else {
      const config = await createAuthenticatedRequest();
      const response = await axios.post<ReportTemplate>(url, template, config);
      return response.data;
    }
  },

  /**
   * Update an existing template
   * 
   * @param templateId - Template ID
   * @param updates - Partial template data to update
   * @returns Promise that resolves to the updated template
   */
  updateTemplate: async (templateId: string, updates: Partial<Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ReportTemplate> => {
    const url = `${API_BASE_URL}/templates/${templateId}`;
    
    if (shouldUseConnectAPI()) {
      return makeConnectRequest(url, { method: 'PUT', data: updates });
    } else {
      const config = await createAuthenticatedRequest();
      const response = await axios.put<ReportTemplate>(url, updates, config);
      return response.data;
    }
  },

  /**
   * Delete a template
   * 
   * @param templateId - Template ID
   * @returns Promise that resolves when template is deleted
   */
  deleteTemplate: async (templateId: string): Promise<void> => {
    const url = `${API_BASE_URL}/templates/${templateId}`;
    
    if (shouldUseConnectAPI()) {
      return makeConnectRequest(url, { method: 'DELETE' });
    } else {
      const config = await createAuthenticatedRequest();
      await axios.delete(url, config);
    }
  },

  /**
   * Clone a template
   * 
   * @param templateId - Template ID to clone
   * @param newName - Name for the cloned template
   * @returns Promise that resolves to the cloned template
   */
  cloneTemplate: async (templateId: string, newName: string): Promise<ReportTemplate> => {
    const url = `${API_BASE_URL}/templates/${templateId}/clone`;
    
    if (shouldUseConnectAPI()) {
      return makeConnectRequest(url, { method: 'POST', data: { name: newName } });
    } else {
      const config = await createAuthenticatedRequest();
      const response = await axios.post<ReportTemplate>(url, { name: newName }, config);
      return response.data;
    }
  },
};

