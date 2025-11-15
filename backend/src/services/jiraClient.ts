/**
 * Jira Client Service (Legacy/Basic Auth)
 * 
 * This service provides a client for interacting with the Jira API using Basic Authentication
 * (email + API token). This is used in standalone mode when the app runs as a regular web application.
 * 
 * For Connect mode, use ConnectJiraClient instead, which uses JWT authentication.
 * 
 * This client supports:
 * - Fetching individual issues
 * - Getting child issues (supports both parent field and Epic Link field)
 * - Searching issues using JQL (Jira Query Language)
 * - Searching issues by text (with support for multiple issue types)
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { JiraIssue, IssueChildrenResponse, JiraResponse } from '../types/jira';

/**
 * Interface for Jira credentials used in Basic Authentication
 */
export interface JiraCredentials {
  email: string;    // Jira user email address
  apiToken: string; // Jira API token (generated from Atlassian account settings)
}

/**
 * Jira Client Class
 * 
 * Provides methods to interact with the Jira REST API v3 using Basic Authentication.
 * All requests are authenticated using Basic Auth with email:token.
 */
export class JiraClient {
  private client: AxiosInstance;      // Axios HTTP client instance
  private credentials: JiraCredentials; // Jira credentials (email + API token)

  /**
   * Constructor
   * 
   * Creates a new Jira client with the provided credentials or falls back to config.
   * 
   * @param credentials - Optional Jira credentials. If not provided, uses credentials from config.
   */
  constructor(credentials?: JiraCredentials) {
    // Use provided credentials or fall back to config
    this.credentials = credentials || {
      email: config.jira.email,
      apiToken: config.jira.apiToken,
    };

    // Create Basic Auth header: base64(email:token)
    const auth = Buffer.from(`${this.credentials.email}:${this.credentials.apiToken}`).toString('base64');
    
    // Create axios instance configured for Jira API v3
    this.client = axios.create({
      baseURL: `${config.jira.baseUrl}/rest/api/3`, // Jira REST API v3 base URL
      headers: {
        'Authorization': `Basic ${auth}`, // Basic Auth header
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a new client instance with different credentials
   * 
   * This is useful when you need to make requests with different credentials
   * without modifying the original client.
   * 
   * @param credentials - New Jira credentials to use
   * @returns A new JiraClient instance with the provided credentials
   */
  withCredentials(credentials: JiraCredentials): JiraClient {
    return new JiraClient(credentials);
  }

  /**
   * Expose the underlying axios client for special endpoints
   * 
   * This allows direct access to the axios instance for custom requests
   * that don't have dedicated methods (e.g., /myself endpoint).
   * 
   * @returns The underlying axios client instance
   */
  getClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Get a Jira issue by its key
   * 
   * Fetches a single issue from Jira using its issue key (e.g., "PROJ-123").
   * Validates the issue key format before making the request.
   * 
   * @param issueKey - The issue key (e.g., "PROJ-123")
   * @returns Promise that resolves to the Jira issue
   * @throws Error if issue key format is invalid, issue doesn't exist, or access is denied
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      // Validate issue key format (PROJECT-NUMBER, e.g., PROJ-123)
      const trimmedKey = issueKey.trim();
      if (!trimmedKey || !/^[A-Z]+-\d+$/i.test(trimmedKey)) {
        throw new Error(`Invalid ticket key format: "${trimmedKey}". Expected format: PROJ-123`);
      }

      // Fetch issue from Jira API
      // The expand parameter requests additional data like parent and worklog
      const response = await this.client.get<JiraIssue>(`/issue/${trimmedKey}`, {
        params: {
          expand: 'fields.parent,fields.worklog,names',
        },
      });
      return response.data;
    } catch (error: any) {
      // Handle specific error cases
      if (error.response?.status === 404) {
        throw new Error(`Ticket "${issueKey}" does not exist or you do not have permission to access it.`);
      }
      if (error.response?.status === 403) {
        throw new Error(`You do not have permission to access ticket "${issueKey}".`);
      }
      // Extract error message from Jira response or use generic error
      const errorMsg = error.response?.data?.errorMessages?.[0] || error.message || 'Unknown error';
      throw new Error(`Failed to fetch ticket "${issueKey}": ${errorMsg}`);
    }
  }

  /**
   * Get child issues of a parent issue
   * 
   * Fetches all child issues of a given parent issue. Supports different issue hierarchies:
   * - Epics: Uses "Epic Link" field to find children
   * - Other issue types (Hub, Program, etc.): Uses "parent" field
   * 
   * If the parent field query fails for non-epic issues, it falls back to Epic Link field.
   * 
   * @param issueKey - The parent issue key
   * @returns Promise that resolves to an array of child issues
   * @throws Error if fetching children fails
   */
  async getIssueChildren(issueKey: string): Promise<JiraIssue[]> {
    try {
      // First, get the parent issue to determine its type
      const parentIssue = await this.getIssue(issueKey);
      const issueType = parentIssue.fields.issuetype?.name?.toLowerCase() || '';
      
      let jql: string; // Jira Query Language query
      
      // Build JQL query based on issue type
      // For Epics, use "Epic Link" field
      // For other issue types (Hub, Program, etc.), try parent field first
      if (issueType.includes('epic')) {
        jql = `"Epic Link" = ${issueKey} ORDER BY status ASC`;
      } else {
        // Try parent field first, if that fails we'll try epic link as fallback
        jql = `parent = ${issueKey} ORDER BY status ASC`;
      }
      
      let response;
      try {
        // Execute JQL search to find children using the new /search/jql endpoint
        response = await this.client.post<JiraResponse>('/search/jql', {
          jql,
          fields: ['summary', 'status', 'labels', 'issuetype', 'parent', 'timespent', 'timeestimate', 'aggregatetimespent', 'aggregatetimeestimate'],
          maxResults: 1000, // Maximum number of results to return
        });
      } catch (error: any) {
        // If parent query fails and it's not an epic, try epic link as fallback
        // Some issue hierarchies use Epic Link instead of parent field
        if (!issueType.includes('epic')) {
          jql = `"Epic Link" = ${issueKey} ORDER BY status ASC`;
          response = await this.client.post<JiraResponse>('/search/jql', {
            jql,
            fields: ['summary', 'status', 'labels', 'issuetype', 'parent', 'timespent', 'timeestimate', 'aggregatetimespent', 'aggregatetimeestimate'],
            maxResults: 1000,
          });
        } else {
          throw error;
        }
      }

      return response.data.issues;
    } catch (error: any) {
      const errorDetail = error.response?.data || error.message;
      throw new Error(`Failed to fetch children of ${issueKey}: ${JSON.stringify(errorDetail)}`);
    }
  }

  /**
   * Search issues using JQL (Jira Query Language)
   * 
   * Executes a JQL query to search for issues. JQL is Jira's powerful query language
   * that allows you to search for issues using various criteria.
   * 
   * @param jql - JQL query string (e.g., "project = PROJ AND status = 'In Progress'")
   * @returns Promise that resolves to an array of matching issues
   * @throws Error if the search fails
   */
  async searchIssues(jql: string): Promise<JiraIssue[]> {
    try {
      // Execute JQL search using the new /search/jql endpoint
      const response = await this.client.post<JiraResponse>('/search/jql', {
        jql,
        fields: ['summary', 'status', 'labels', 'issuetype', 'parent'],
        maxResults: 1000,
      });

      return response.data.issues;
    } catch (error: any) {
      throw new Error(`Failed to search issues: ${error.message}`);
    }
  }

  /**
   * Search issues by text
   * 
   * Searches for issues by text, matching against summary and key fields.
   * Only returns issues of eligible types (Epic, Hub, Program, Epic Portfolio).
   * Supports both English and French issue type names.
   * 
   * @param searchText - Text to search for (can be issue key prefix like "PROJ-" or summary text)
   * @param projectKey - Optional project key to limit search to a specific project
   * @returns Promise that resolves to an array of matching issues with key, summary, and issuetype
   */
  async searchIssuesByText(searchText: string, projectKey?: string): Promise<Array<{ key: string; summary: string; issuetype: string }>> {
    try {
      // Escape special JQL characters to prevent injection
      const escapedText = searchText.replace(/"/g, '\\"').replace(/'/g, "\\'");
      
      // Eligible issue types: Epic, Hub, Program, Epic Portfolio
      // Support both English and French names for international deployments
      const eligibleTypes = [
        'Epic',
        'Hub',
        'Program',
        'Epic Portfolio',
        // French versions (if applicable)
        'Épopée',
        'Hub',
        'Programme',
        'Portefeuille d\'Épopées'
      ];
      
      // Build issue type filter for JQL (handle both English and French)
      // Creates: issuetype = "Epic" OR issuetype = "Hub" OR ...
      const typeFilter = eligibleTypes
        .map(type => type.replace(/'/g, "\\'")) // Escape apostrophes in type names
        .map(type => `issuetype = "${type}"`)
        .join(' OR ');
      
      // Check if the search text looks like a key prefix (e.g., "KAN-")
      const isKeyPrefix = /^[A-Z]+-?$/i.test(searchText.trim());
      
      let jql: string;
      if (isKeyPrefix) {
        // If it's a key prefix, search only by key (faster and more accurate)
        jql = `key ~ "${escapedText}*" AND (${typeFilter})`;
      } else {
        // Otherwise, search in summary or key
        jql = `(summary ~ "${escapedText}" OR key ~ "${escapedText}*") AND (${typeFilter})`;
      }
      
      // Optionally filter by project
      if (projectKey) {
        jql = `project = ${projectKey} AND ${jql}`;
      }
      // Order by most recently updated first
      jql += ' ORDER BY updated DESC';
      
      // Execute search using the new /search/jql endpoint
      const response = await this.client.post<JiraResponse>('/search/jql', {
        jql,
        fields: ['summary', 'issuetype'], // Only fetch fields we need
        maxResults: 10, // Limit to 10 results for autocomplete
      });

      // Filter results to ensure only eligible types are returned
      // (in case JQL case-sensitivity issues with different Jira configurations)
      const eligibleTypeNames = eligibleTypes.map(t => t.toLowerCase());
      
      return response.data.issues
        .filter(issue => {
          const issueType = issue.fields.issuetype?.name?.toLowerCase() || '';
          return eligibleTypeNames.some(eligible => 
            issueType.includes(eligible.toLowerCase()) ||
            eligible.toLowerCase().includes(issueType)
          );
        })
        .map(issue => ({
          key: issue.key,
          summary: issue.fields.summary || '',
          issuetype: issue.fields.issuetype?.name || 'Unknown',
        }));
    } catch (error: any) {
      // Return empty array instead of throwing if search fails
      // This prevents UI errors when search is temporarily unavailable
      console.error('Search error:', error.message);
      return [];
    }
  }
}
