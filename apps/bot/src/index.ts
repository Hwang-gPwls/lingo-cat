import { createSlackApp } from './app';
import { startHealthServer } from './infra/http';
import { Logger } from './infra/metrics';
import { envConfig } from './config/env';

/**
 * Bootstrap and start the LingoCat application
 */
async function bootstrap(): Promise<void> {
  try {
    Logger.info('Starting LingoCat application', {
      version: '1.0.0',
      nodeVersion: process.version,
      targetLangs: envConfig.targetLangs,
      threadMode: envConfig.threadMode,
      modelName: envConfig.modelName
    });

    // Start health check HTTP server
    const httpServer = startHealthServer(envConfig.port);
    
    // Create and start Slack app
    const slackApp = createSlackApp();
    
    Logger.info('Starting Slack Socket Mode connection...');
    await slackApp.start();
    
    Logger.info('LingoCat is running!', {
      httpPort: envConfig.port,
      socketMode: true,
      status: 'ready'
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      Logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        // Stop Slack app
        await slackApp.stop();
        Logger.info('Slack app stopped');
        
        // Close HTTP server
        httpServer.close(() => {
          Logger.info('HTTP server stopped');
        });
        
        Logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        Logger.error('Error during graceful shutdown', error as Error);
        process.exit(1);
      }
    };

    // Register signal handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      Logger.error('Uncaught exception', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      Logger.error('Unhandled rejection', new Error(String(reason)), {
        promise: promise.toString()
      });
      process.exit(1);
    });

  } catch (error) {
    Logger.error('Failed to start LingoCat application', error as Error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  bootstrap();
}
