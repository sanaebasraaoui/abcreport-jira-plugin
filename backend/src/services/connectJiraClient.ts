/**
 * Connect Jira Client Service
 * 
 * This service provides a client for interacting with the Jira API using JWT authentication
 * for Atlassian Connect apps. This is used when the app runs as a Jira Connect plugin.
 * 
 * Unlike JiraClient (which uses Basic Auth), this client:
 * - Uses JWT tokens for authentication
 * - Automatically signs requests with JWT tokens
 * - Gets the Jira base URL from the JWT token (not from config)
 * 
 * The JWT token is created per-request and includes:
 * - iss: The clientKey (app installation identifier)
 * - qsh: Query string hash (prevents request tampering)
 * - exp: Expiration time (3 minutes)
 */

import axios, { AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JiraIssue, JiraResponse } from '../types/jira';

/**
 * Interface for Connect authentication credentials
 */
export interface ConnectAuth {
  baseUrl: string;      // Jira instance URL (from JWT token)
  clientKey: string;    // Unique identifier for this installation (from JWT token)
  sharedSecret: string; // Secret for signing JWT tokens (provided during installation)
}

/**
 * Jira Client for Atlassian Connect Apps
 * 
 * This client uses JWT authentication instead of Basic Auth. Each request is automatically
 * signed with a JWT token that proves the request is coming from a legitimate Connect app installation.
 */
export class ConnectJiraClient {
  private baseUrl: string;
  private clientKey: string;
  private sharedSecret: string;
  private client: AxiosInstance;

  /**
   * Constructor
   * 
   * Creates a new Connect Jira client with authentication credentials.
   * Sets up an axios instance with a request interceptor that automatically
   * signs all requests with JWT tokens.
   * 
   * @param auth - Connect authentication credentials (baseUrl, clientKey, sharedSecret)
   */
  constructor(auth: ConnectAuth) {
    this.baseUrl = auth.baseUrl;        // Jira instance URL
    this.clientKey = auth.clientKey;    // Installation identifier
    this.sharedSecret = auth.sharedSecret; // Secret for JWT signing

    // Create axios instance for Jira API v3
    // Note: No Authorization header yet - it will be added by the interceptor
    this.client = axios.create({
      baseURL: `${this.baseUrl}/rest/api/3`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to automatically sign all requests with JWT
    // This interceptor runs before every request and adds the JWT token
    this.client.interceptors.request.use((config) => {
      // Create JWT token for this specific request
      // The token includes method, path, and query params for request verification
      const token = this.createJWT(config.method?.toUpperCase() || 'GET', config.url || '', config.params || {});
      config.headers.Authorization = `JWT ${token}`;
      return config;
    });
  }

  /**
   * Create JWT token for Atlassian Connect API requests
   * 
   * Creates a JWT token that proves the request is coming from a legitimate Connect app.
   * The token includes a Query String Hash (QSH) that prevents request tampering.
   * 
   * @param method - HTTP method (GET, POST, etc.)
   * @param path - API endpoint path (e.g., "/issue/PROJ-123")
   * @param queryParams - Query parameters as an object
   * @returns Signed JWT token string
   */
  private createJWT(method: string, path: string, queryParams: any = {}): string {
    const now = Math.floor(Date.now() / 1000);
    const expirationTime = now + 180; // Token expires in 3 minutes

    // Build canonical query string from params
    const queryString = this.buildQueryString(queryParams);
    
    // Ensure path starts with /
    const canonicalPath = path.startsWith('/') ? path : `/${path}`;
    
    // Create canonical request string: METHOD&/path&query
    // This format is required by Atlassian Connect
    const canonicalRequest = `${method}&${canonicalPath}&${queryString}`;
    
    // Create Query String Hash (QSH) - SHA256 hash of canonical request
    // This prevents request tampering (changing method, path, or params)
    const qsh = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

    // JWT payload with Connect-specific claims
    const payload = {
      iss: this.clientKey,    // Issuer: the add-on key (unique per installation)
      iat: now,               // Issued at: current timestamp
      exp: expirationTime,    // Expiration: 3 minutes from now
      qsh: qsh,               // Query String Hash: prevents tampering
    };

    // Sign JWT with shared secret using HS256 algorithm
    return jwt.sign(payload, this.sharedSecret, { algorithm: 'HS256' });
  }

  /**
   * Build canonical query string from params object
   * 
   * Creates a query string in the format required by Atlassian Connect:
   * - Parameters are sorted alphabetically
   * - Keys and values are URL-encoded
   * - Parameters are joined with &
   * 
   * @param params - Query parameters as an object
   * @returns Canonical query string (e.g., "key1=value1&key2=value2")
   */
  private buildQueryString(params: any): string {
    const keys = Object.keys(params).sort(); // Sort keys alphabetically
    const pairs = keys.map(key => {
      const value = params[key];
      // URL-encode both key and value
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    });
    return pairs.join('&') || ''; // Join with & or return empty string
  }

  /**
   * Get Jira issue by key
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const trimmedKey = issueKey.trim();
      if (!trimmedKey || !/^[A-Z]+-\d+$/i.test(trimmedKey)) {
        throw new Error(`Invalid ticket key format: "${trimmedKey}". Expected format: PROJ-123`);
      }

      const response = await this.client.get<JiraIssue>(`/issue/${trimmedKey}`, {
        params: {
          expand: 'fields.parent,fields.worklog,names',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Ticket "${issueKey}" does not exist or you do not have permission to access it.`);
      }
      if (error.response?.status === 403) {
        throw new Error(`You do not have permission to access ticket "${issueKey}".`);
      }
      const errorMsg = error.response?.data?.errorMessages?.[0] || error.message || 'Unknown error';
      throw new Error(`Failed to fetch ticket "${issueKey}": ${errorMsg}`);
    }
  }

  /**
   * Get child issues of a parent issue
   */
  async getIssueChildren(issueKey: string): Promise<JiraIssue[]> {
    try {
      const parentIssue = await this.getIssue(issueKey);
      const issueType = parentIssue.fields.issuetype?.name?.toLowerCase() || '';
      
      let jql: string;
      
      if (issueType.includes('epic')) {
        jql = `"Epic Link" = ${issueKey} ORDER BY status ASC`;
      } else {
        jql = `parent = ${issueKey} ORDER BY status ASC`;
      }
      
      let response;
      try {
        response = await this.client.post<JiraResponse>('/search', {
          jql,
          fields: ['summary', 'status', 'labels', 'issuetype', 'parent', 'timespent', 'timeestimate', 'aggregatetimespent', 'aggregatetimeestimate'],
          maxResults: 1000,
        });
      } catch (error: any) {
        // If parent query fails and it's not an epic, try epic link as fallback
        if (!issueType.includes('epic')) {
          jql = `"Epic Link" = ${issueKey} ORDER BY status ASC`;
          response = await this.client.post<JiraResponse>('/search', {
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
   * Search issues using JQL
   */
  async searchIssues(jql: string): Promise<JiraIssue[]> {
    try {
      const response = await this.client.post<JiraResponse>('/search', {
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
   */
  async searchIssuesByText(searchText: string, projectKey?: string): Promise<Array<{ key: string; summary: string; issuetype: string }>> {
    try {
      const escapedText = searchText.replace(/"/g, '\\"').replace(/'/g, "\\'");
      
      const eligibleTypes = [
        'Epic',
        'Hub',
        'Program',
        'Epic Portfolio',
        'Épopée',
        'Hub',
        'Programme',
        'Portefeuille d\'Épopées'
      ];
      
      const typeFilter = eligibleTypes
        .map(type => type.replace(/'/g, "\\'"))
        .map(type => `issuetype = "${type}"`)
        .join(' OR ');
      
      const isKeyPrefix = /^[A-Z]+-?$/i.test(searchText.trim());
      
      let jql: string;
      if (isKeyPrefix) {
        jql = `key ~ "${escapedText}*" AND (${typeFilter})`;
      } else {
        jql = `(summary ~ "${escapedText}" OR key ~ "${escapedText}*") AND (${typeFilter})`;
      }
      
      if (projectKey) {
        jql = `project = ${projectKey} AND ${jql}`;
      }
      jql += ' ORDER BY updated DESC';
      
      const response = await this.client.post<JiraResponse>('/search', {
        jql,
        fields: ['summary', 'issuetype'],
        maxResults: 10,
      });

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
      console.error('Search error:', error.message);
      return [];
    }
  }

  /**
   * Expose axios client for special endpoints
   */
  getClient(): AxiosInstance {
    return this.client;
  }
}

