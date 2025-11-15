/**
 * Atlassian Connect Authentication Middleware
 * 
 * This module provides middleware for verifying JWT tokens from Atlassian Connect.
 * When Jira loads the Connect app, it includes a JWT token in the request that
 * proves the request is coming from Jira and identifies the installation.
 * 
 * The JWT token contains:
 * - iss: The Jira instance URL
 * - sub: The clientKey (unique identifier for this installation)
 * - aud: The baseUrl from atlassian-connect.json
 * - qsh: Query string hash (for request verification)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * Extend Express Request type to include Connect-specific properties
 * This allows TypeScript to know about these properties when they're added by middleware
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * Connect context information extracted from JWT token
       * Contains information about the Jira instance and installation
       */
      context?: {
        clientKey: string;      // Unique identifier for this installation
        sharedSecret: string;   // Secret used to verify JWT signatures
        baseUrl: string;        // URL of the Jira instance
        key: string;            // Same as clientKey (for compatibility)
        oauthClientId?: string; // OAuth client ID (if using OAuth)
        publicKey?: string;     // Public key (if using public key verification)
      };
      
      /**
       * Decoded JWT token payload
       * Contains information about the request and installation
       */
      jwt?: any;
    }
  }
}

/**
 * Interface for Atlassian Connect JWT token payload
 * These are the standard claims included in Connect JWT tokens
 */
interface ConnectToken {
  iss: string; // JIRA instance URL (issuer)
  sub: string; // clientKey (subject - unique identifier for the installation)
  aud: string; // baseUrl from atlassian-connect.json (audience)
  exp: number; // Expiration time (Unix timestamp)
  iat: number; // Issued at time (Unix timestamp)
  qsh: string; // Query string hash (used to verify the request hasn't been tampered with)
}

/**
 * Middleware to verify JWT token from Atlassian Connect
 * This extracts the JWT from the Authorization header or query string
 * This middleware is optional - if no JWT is present, it just continues (for backward compatibility)
 */
export const verifyConnectJWT = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get JWT from Authorization header
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('JWT ')) {
      token = authHeader.substring(4);
    } else if (req.query?.jwt) {
      token = req.query.jwt as string;
    }

    // If no token, just continue (for backward compatibility with legacy auth)
    if (!token) {
      return next();
    }

    // Decode the token (we'll verify signature later when we have the shared secret)
    const decoded = jwt.decode(token) as ConnectToken;
    
    if (!decoded) {
      // Invalid token format, but continue anyway (other middleware will handle auth)
      return next();
    }

    // Store decoded token in request
    req.jwt = decoded;
    
    // Try to get shared secret from config or from installation data
    // In production, you'd look this up from your database using decoded.sub (clientKey)
    const sharedSecret = config.jira.sharedSecret || '';
    
    if (sharedSecret) {
      // Verify the token signature
      try {
        jwt.verify(token, sharedSecret, { algorithms: ['HS256'] });
      } catch (verifyError) {
        // Token verification failed, but continue anyway (for development/testing)
        console.warn('JWT verification failed:', verifyError);
        return next();
      }
    }

    // Store context in request
    req.context = {
      clientKey: decoded.sub,
      sharedSecret: sharedSecret,
      baseUrl: decoded.iss,
      key: decoded.sub,
    };

    next();
  } catch (error: any) {
    // On error, just continue (for backward compatibility)
    console.warn('Connect JWT processing error:', error.message);
    next();
  }
};

/**
 * Extract Connect authentication info from request
 * This is used to authenticate API calls to Jira
 */
export const getConnectAuth = (req: Request): { baseUrl: string; clientKey: string; sharedSecret: string } | null => {
  if (!req.context) {
    return null;
  }

  return {
    baseUrl: req.context.baseUrl,
    clientKey: req.context.clientKey,
    sharedSecret: req.context.sharedSecret,
  };
};

