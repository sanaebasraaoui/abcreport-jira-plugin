/**
 * Main Server File
 * 
 * This is the entry point for the Express server. It sets up all routes, middleware,
 * and serves both the API endpoints and the frontend application.
 * 
 * The server supports two modes:
 * 1. Standalone mode: Works as a regular web app with manual Jira authentication
 * 2. Connect mode: Works as a Jira Connect plugin installed in Jira
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config, validateConfig } from './config';
import jiraRoutes from './routes/jira';
import templateRoutes from './routes/templates';
import lifecycleRoutes from './routes/lifecycle';
import webhookRoutes from './routes/webhooks';
import { verifyConnectJWT } from './middleware/connectAuth';

// Create Express application instance
const app = express();

/**
 * Validate application configuration on startup
 * In Connect mode, we don't exit on config errors because the config might
 * not be fully set up until after installation
 */
try {
  validateConfig();
} catch (error: any) {
  console.error('Configuration error:', error.message);
  // Don't exit in Connect mode, as config may not be fully set up yet
  // Only exit if REQUIRE_CONFIG environment variable is explicitly set to 'true'
  if (process.env.REQUIRE_CONFIG === 'true') {
    process.exit(1);
  }
}

/**
 * CORS (Cross-Origin Resource Sharing) middleware
 * Allows frontend to make requests to this backend
 * Also allows requests from Atlassian servers for Connect app installation
 */
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman, or Atlassian servers)
    // This is important for Atlassian Connect installation
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow requests from frontend URL
    if (origin === config.frontend.url) {
      return callback(null, true);
    }
    
    // Allow requests from Atlassian domains (for Connect app installation)
    const atlassianDomains = [
      /\.atlassian\.net$/,
      /\.atlassian\.com$/,
      /\.jira\.com$/,
      /atlassian\.io$/,
    ];
    
    if (atlassianDomains.some(regex => regex.test(origin))) {
      return callback(null, true);
    }
    
    // For development, allow all origins when accessed via tunnel (ngrok or Cloudflare)
    // This ensures Jira can access the app during installation
    callback(null, true);
  },
  credentials: true, // Allow cookies/credentials to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Type', 'Location'],
  maxAge: 86400, // Cache preflight for 24 hours
}));

/**
 * JSON body parser middleware
 * Parses JSON request bodies and makes them available in req.body
 */
app.use(express.json());

/**
 * Static file serving middleware
 * Serves the built React frontend application
 * Also serves any files from the public directory (e.g., icons, images)
 */
app.use(express.static(path.join(__dirname, '../../frontend/build')));
app.use(express.static(path.join(__dirname, '../public')));

// Serve icon.png explicitly
app.get('/icon.png', (req, res) => {
  const iconPath = path.join(__dirname, '../public/icon.png');
  if (fs.existsSync(iconPath)) {
    res.sendFile(iconPath);
  } else {
    // Return a simple 1x1 transparent PNG if icon doesn't exist
    const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.send(transparentPng);
  }
});

/**
 * Atlassian Connect Descriptor Endpoint
 * 
 * This endpoint serves the app descriptor (atlassian-connect.json) that Jira
 * uses to understand how to integrate with this app. The descriptor tells Jira:
 * - What permissions the app needs
 * - Where to send lifecycle events (install/uninstall)
 * - Where to send webhooks
 * - What modules the app provides (general pages, webhooks, etc.)
 * 
 * GET /atlassian-connect.json
 */
app.get('/atlassian-connect.json', (req, res) => {
  // Find descriptor file - it's at project root
  // process.cwd() is backend/ when running with tsx watch
  const descriptorPath = path.resolve(process.cwd(), '../atlassian-connect.json');
  try {
    // Read the descriptor file
    const descriptor = fs.readFileSync(descriptorPath, 'utf-8');
    const descriptorJson = JSON.parse(descriptor);
    
    // Dynamically update the baseUrl with the current request origin
    // This allows the descriptor to work correctly even if accessed via different URLs
    // Get the full URL from the request
    // Priority: x-forwarded-host (from tunnel) > host header > default
    // Note: req.get('host') should work for localtunnel as it sends the correct Host header
    const forwardedHost = req.headers['x-forwarded-host'] as string;
    const hostHeader = req.get('host') || req.headers.host || (req.headers['host'] as string);
    let host = forwardedHost || hostHeader || 'localhost:3001';
    
    // Debug: log the host detection (remove in production)
    // console.log('Host detection:', { forwardedHost, hostHeader, finalHost: host });
    
    // Check if this is a request via ngrok, Cloudflare Tunnel, or localtunnel
    const isNgrok = host.includes('ngrok') || forwardedHost?.includes('ngrok');
    const isCloudflare = host.includes('trycloudflare.com') || forwardedHost?.includes('trycloudflare.com');
    const isLocaltunnel = host.includes('loca.lt') || forwardedHost?.includes('loca.lt');
    const isTunnel = isNgrok || isCloudflare || isLocaltunnel;
    
    // Determine protocol: tunnels always use https
    let protocol = 'https'; // Default to https for security
    if (isTunnel) {
      protocol = 'https'; // Tunnels always use https
    } else if (req.headers['x-forwarded-proto']) {
      protocol = req.headers['x-forwarded-proto'] as string;
    } else if (req.secure) {
      protocol = 'https';
    } else if (req.protocol) {
      protocol = req.protocol;
    }
    
    // If CONNECT_BASE_URL is set in environment, use it (highest priority)
    // This allows manual override for tunnels that don't send correct headers
    const envBaseUrl = process.env.CONNECT_BASE_URL;
    
    // If tunnel (ngrok, Cloudflare, or localtunnel), use the tunnel URL directly
    const baseUrl = envBaseUrl 
      ? envBaseUrl
      : (isTunnel 
          ? `${protocol}://${host}`
          : (config.connect.baseUrl || `${protocol}://${host}`));
    
    descriptorJson.baseUrl = baseUrl;
    
    // Update vendor.url to match baseUrl (Jira may validate this)
    if (descriptorJson.vendor) {
      descriptorJson.vendor.url = baseUrl;
    }
    // Set proper headers for Atlassian Connect descriptor
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow from any origin for installation
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    res.json(descriptorJson);
  } catch (error: any) {
    console.error('Error serving descriptor:', error);
    res.status(500).json({ error: 'Failed to load app descriptor' });
  }
});

/**
 * Root Route
 * 
 * This route serves different content based on the request type:
 * - If it's a Connect request (has JWT token in Authorization header),
 *   serve the frontend HTML file (the app running in Jira iframe)
 * - Otherwise, return API information (useful for testing/development)
 * 
 * GET /
 */
app.get('/', (req, res) => {
  // Check if this is a Connect request (has JWT token)
  if (req.headers.authorization?.startsWith('JWT ')) {
    // This is a request from Jira - serve the frontend app
    const frontendPath = path.join(__dirname, '../../frontend/build/index.html');
    if (fs.existsSync(frontendPath)) {
      return res.sendFile(frontendPath);
    }
  }
  
  // Otherwise, return API information
  res.json({
    message: 'ABC Manager - Weekly Report API (Connect App)',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      descriptor: '/atlassian-connect.json',
      lifecycle: '/lifecycle',
      webhooks: '/webhook',
      report: '/api/jira/report/:issueKey',
      export: '/api/jira/export/:issueKey',
      issue: '/api/jira/issue/:issueKey',
      children: '/api/jira/issue/:issueKey/children',
      templates: '/api/templates',
      template: '/api/templates/:templateId'
    },
    note: 'This is a Jira Connect app. Install it in your Jira instance.'
  });
});

/**
 * Lifecycle Routes
 * 
 * These routes handle app installation and uninstallation events from Jira.
 * When the app is installed, Jira sends a POST request to /lifecycle/installed
 * with installation data including the shared secret needed for JWT verification.
 * 
 * No authentication is needed for these routes because Jira verifies the requests.
 * 
 * POST /lifecycle/installed - Called when app is installed in Jira
 * POST /lifecycle/uninstalled - Called when app is uninstalled from Jira
 */
app.use('/lifecycle', lifecycleRoutes);

/**
 * Webhook Routes
 * 
 * These routes handle webhook events from Jira (e.g., issue created, updated, deleted).
 * Jira sends POST requests to these endpoints when configured events occur.
 * 
 * Jira automatically verifies webhook requests, so no additional authentication is needed.
 * 
 * POST /webhook/issue-created - Called when an issue is created
 * POST /webhook/issue-updated - Called when an issue is updated
 * POST /webhook/issue-deleted - Called when an issue is deleted
 */
app.use('/webhook', webhookRoutes);

/**
 * Jira API Routes
 * 
 * These routes handle all Jira-related operations:
 * - Fetching issues
 * - Getting issue children
 * - Generating reports
 * - Exporting reports to Word/PPT
 * - Searching issues
 * 
 * These routes support both Connect mode (JWT authentication) and standalone mode
 * (Basic Auth with email/API token).
 * 
 * All routes under /api/jira
 */
app.use('/api/jira', jiraRoutes);

/**
 * Template API Routes
 * 
 * These routes handle template management:
 * - Get user's templates
 * - Create/update/delete templates
 * - Clone templates
 * - Get default template
 * 
 * All routes under /api/templates
 */
app.use('/api/templates', templateRoutes);

/**
 * Health Check Endpoint
 * 
 * Simple endpoint to check if the server is running.
 * Useful for monitoring and load balancer health checks.
 * 
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Start the server
 * 
 * The server listens on the configured port and starts accepting requests.
 */
const PORT = config.server.port;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Jira base URL: ${config.jira.baseUrl || 'Not configured (Connect mode)'}`);
});

