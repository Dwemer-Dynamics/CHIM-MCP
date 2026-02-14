import express from 'express';
import { loadConfig } from './config.js';
import { pool, closePool } from './db.js';
import { McpServer } from './mcp/server.js';
import { createRouter } from './http/router.js';

async function main() {
  console.log('Starting CHIM MCP Server...');

  // Load configuration from database
  console.log('Loading configuration from database...');
  const config = await loadConfig();

  if (!config.enabled) {
    console.log('MCP server is disabled (MCP/enabled = false). Exiting.');
    process.exit(0);
  }

  console.log(`Configuration loaded:`);
  console.log(`  - Model: ${config.model}`);
  console.log(`  - Provider: ${config.provider}`);
  console.log(`  - Endpoint: ${config.endpoint}`);
  console.log(`  - Connector ID: ${config.llmConnectorId ?? 'none'}`);
  console.log(`  - Port: ${config.port}`);
  console.log(`  - API Key: ${config.apiKey ? 'configured' : 'NOT configured'}`);
  console.log(`  - Max Tool Rounds: ${config.maxToolRounds}`);

  // Initialize MCP server
  const mcpServer = new McpServer();
  console.log('MCP server initialized');

  // Create Express app
  const app = express();
  
  // Middleware
  app.use(express.json({ limit: '10mb' }));
  
  // CORS for local development and cross-origin access from HerikaServer
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  // Mount routes (router will reload config on each request)
  const router = createRouter(mcpServer);
  app.use('/', router);

  // Start HTTP server
  const server = app.listen(config.port, () => {
    console.log(`\n✓ CHIM MCP Server running on port ${config.port}`);
    console.log(`  - SSE endpoint: http://localhost:${config.port}/sse`);
    console.log(`  - Chat API: http://localhost:${config.port}/chat`);
    console.log(`  - Status: http://localhost:${config.port}/status`);
    console.log();
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down gracefully...');
    
    server.close(() => {
      console.log('HTTP server closed');
    });

    await closePool();
    console.log('Database pool closed');
    
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown();
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    shutdown();
  });
}

// Test database connection before starting
pool.query('SELECT 1')
  .then(() => {
    console.log('✓ Database connection successful');
    return main();
  })
  .catch((error) => {
    console.error('✗ Database connection failed:', error);
    console.error('\nMake sure PostgreSQL is running and credentials are correct.');
    console.error('Check the .env file or environment variables.');
    process.exit(1);
  });
