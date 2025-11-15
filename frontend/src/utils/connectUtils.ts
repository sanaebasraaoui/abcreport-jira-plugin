/**
 * Atlassian Connect Utility Functions
 * 
 * This module provides utility functions for working with Atlassian Connect.
 * These functions help the frontend detect if it's running in Connect mode
 * and interact with the Connect JavaScript API (AP object).
 * 
 * The Connect JavaScript API (AP) is provided by Jira when the app runs
 * inside a Jira iframe. It provides methods for:
 * - Making authenticated requests (AP.request)
 * - Resizing the iframe (AP.resize)
 * - Getting the current location (AP.getLocation)
 * - Getting Connect context (AP.getContext)
 */

/**
 * TypeScript type definition for Atlassian Connect JavaScript API
 * This extends the Window interface to include the AP object
 */
declare global {
  interface Window {
    AP?: {
      /**
       * Resize the iframe to fit content
       * @param width - Width (usually '100%')
       * @param height - Height in pixels (e.g., '800px')
       */
      resize?: (width: string, height: string) => void;
      
      /**
       * Get the current location/URL
       * @param callback - Callback function that receives the location string
       */
      getLocation?: (callback: (location: string) => void) => void;
      
      /**
       * Get Connect context (information about the Jira instance)
       * @param callback - Callback function that receives the context object
       */
      getContext?: (callback: (context: any) => void) => void;
      
      /**
       * Make an authenticated request to an external URL
       * Automatically includes JWT token for authentication
       * @param options - Request options (url, type, data, success, error, headers)
       */
      request?: (options: { 
        url: string; 
        type?: string; 
        data?: any; 
        success?: (data: any) => void; 
        error?: (error: any) => void; 
        headers?: any 
      }) => void;
    };
  }
}

/**
 * Check if the app is running inside Atlassian Connect (Jira)
 * 
 * Determines if the app is running as a Connect plugin by checking
 * if the AP (Atlassian Platform) object is available in the window.
 * 
 * @returns true if running in Connect mode, false otherwise
 */
export const isConnectApp = (): boolean => {
  return typeof window !== 'undefined' && typeof window.AP !== 'undefined';
};

/**
 * Get JWT token from Connect context
 * 
 * Extracts the JWT token from the current URL. In Connect mode, Jira
 * includes the JWT token in the URL query parameters for security.
 * 
 * @returns Promise that resolves to JWT token string or null if not found
 */
export const getJWT = (): Promise<string | null> => {
  return new Promise((resolve) => {
    // Check if running in Connect mode
    if (!isConnectApp() || !window.AP) {
      resolve(null);
      return;
    }

    // Use AP.getLocation to get the current URL
    // In Connect apps, the JWT is included in the URL as a query parameter
    if (window.AP.getLocation) {
      window.AP.getLocation((location: string) => {
        try {
          // Parse the URL to extract the JWT token from query parameters
          const url = new URL(location);
          const jwt = url.searchParams.get('jwt');
          resolve(jwt);
        } catch {
          // If URL parsing fails, return null
          resolve(null);
        }
      });
    } else {
      resolve(null);
    }
  });
};

/**
 * Make authenticated request to backend API using Connect API
 * 
 * Uses the Connect JavaScript API (AP.request) to make authenticated
 * requests. The Connect API automatically includes JWT tokens for
 * authentication, so you don't need to handle them manually.
 * 
 * @param url - The URL to request
 * @param options - Request options (method, data, responseType)
 * @returns Promise that resolves to the response data
 * @throws Error if not running in Connect mode or AP.request is unavailable
 */
export const makeConnectRequest = async (
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; // HTTP method
    data?: any;                                  // Request body data
    responseType?: 'json' | 'blob';             // Expected response type
  } = {}
): Promise<any> => {
  // Check if Connect API is available
  if (!isConnectApp() || !window.AP || !window.AP.request) {
    throw new Error('Not running in Connect mode');
  }

  return new Promise((resolve, reject) => {
    const { method = 'GET', data, responseType = 'json' } = options;

    // Use AP.request to make authenticated request
    // The JWT token is automatically included by Connect
    if (!window.AP || !window.AP.request) {
      reject(new Error('AP.request is not available'));
      return;
    }
    window.AP.request({
      url,
      type: method,
      data: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        'Accept': responseType === 'blob' ? 'application/octet-stream' : 'application/json',
      },
      success: (response: any) => {
        // Handle different response types
        if (responseType === 'blob') {
          // For blob responses (file downloads), return as-is
          resolve(response);
        } else {
          // For JSON responses, try to parse
          try {
            const parsed = typeof response === 'string' ? JSON.parse(response) : response;
            resolve(parsed);
          } catch {
            // If parsing fails, return response as-is
            resolve(response);
          }
        }
      },
      error: (error: any) => {
        reject(error);
      },
    });
  });
};

/**
 * Resize the iframe to fit content
 * 
 * Resizes the Connect app iframe to match the content height.
 * This is useful for ensuring the entire app is visible without
 * requiring scrolling within the iframe.
 * 
 * @param height - Desired height in pixels (default: 800)
 */
export const resizeToFit = (height: number = 800): void => {
  if (isConnectApp() && window.AP && window.AP.resize) {
    window.AP.resize('100%', `${height}px`);
  }
};

/**
 * Get Connect context (Jira instance information)
 * 
 * Retrieves information about the current Jira instance and user context.
 * This can include user information, Jira instance URL, and other context data.
 * 
 * @returns Promise that resolves to the Connect context object
 * @throws Error if not running in Connect mode or AP.getContext is unavailable
 */
export const getConnectContext = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Check if Connect API is available
    if (!isConnectApp() || !window.AP || !window.AP.getContext) {
      reject(new Error('Not running in Connect mode'));
      return;
    }

    // Get context from Connect API
    window.AP.getContext((context: any) => {
      resolve(context);
    });
  });
};

