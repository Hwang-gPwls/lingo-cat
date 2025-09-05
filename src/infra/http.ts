import http from 'node:http';
import { envConfig } from '../config/env';
import { getDedupStats } from '../middlewares/deduplication';

interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  environment: {
    nodeVersion: string;
    port: number;
    targetLangs: string[];
    threadMode: boolean;
  };
  cache?: {
    size: number;
    oldestEntry: number | null;
  };
}

/**
 * Create and start HTTP server for health checks and monitoring
 */
export const startHealthServer = (port: number = envConfig.port): http.Server => {
  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url || '';
    
    if (url === '/healthz' || url === '/health') {
      handleHealthCheck(req, res);
    } else if (url === '/readiness') {
      handleReadinessCheck(req, res);
    } else if (url === '/liveness') {
      handleLivenessCheck(req, res);
    } else if (url === '/metrics') {
      handleMetrics(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(port, () => {
    console.log(`[healthz] HTTP server listening on port ${port}`);
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('[healthz] Received SIGTERM, shutting down gracefully');
    server.close(() => {
      console.log('[healthz] HTTP server closed');
    });
  });

  return server;
};

/**
 * Handle health check requests - general health status
 */
const handleHealthCheck = (req: http.IncomingMessage, res: http.ServerResponse): void => {
  try {
    const health: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: {
        nodeVersion: process.version,
        port: envConfig.port,
        targetLangs: envConfig.targetLangs,
        threadMode: envConfig.threadMode
      },
      cache: getDedupStats()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  } catch (error) {
    console.error('[healthz] Health check failed:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'error', 
      error: 'Internal server error',
      timestamp: new Date().toISOString() 
    }));
  }
};

/**
 * Handle readiness check - is the service ready to receive traffic?
 */
const handleReadinessCheck = (req: http.IncomingMessage, res: http.ServerResponse): void => {
  try {
    // Check if essential environment variables are set
    const isReady = !!(
      envConfig.geminiApiKey &&
      envConfig.slackBotToken &&
      envConfig.slackAppToken &&
      envConfig.targetLangs.length > 0
    );

    if (isReady) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ready',
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'not ready',
        reason: 'Missing required configuration',
        timestamp: new Date().toISOString()
      }));
    }
  } catch (error) {
    console.error('[healthz] Readiness check failed:', error);
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'not ready',
      error: 'Readiness check failed',
      timestamp: new Date().toISOString()
    }));
  }
};

/**
 * Handle liveness check - is the service alive?
 */
const handleLivenessCheck = (req: http.IncomingMessage, res: http.ServerResponse): void => {
  try {
    // Simple liveness check - if we can respond, we're alive
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  } catch (error) {
    console.error('[healthz] Liveness check failed:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'error',
      error: 'Liveness check failed',
      timestamp: new Date().toISOString()
    }));
  }
};

/**
 * Handle basic metrics endpoint
 */
const handleMetrics = (req: http.IncomingMessage, res: http.ServerResponse): void => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cache: getDedupStats(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.error('[healthz] Metrics endpoint failed:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Metrics collection failed',
      timestamp: new Date().toISOString()
    }));
  }
};
