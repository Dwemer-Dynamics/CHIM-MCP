import express, { Request, Response } from 'express';
import { ChatAgent } from '../chat/agent.js';
import { McpServer } from '../mcp/server.js';
import { loadConfig } from '../config.js';

interface ChatRequest {
  message: string;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface ChatResponse {
  response: string;
  error?: string;
}

interface StatusResponse {
  status: 'ok' | 'error';
  version: string;
  config: {
    model: string;
    hasApiKey: boolean;
    maxToolRounds: number;
    apiBadgeId: number | null;
  };
  timestamp: number;
}

export function createRouter(mcpServer: McpServer): express.Router {
  const router = express.Router();

  // Health check / status endpoint - reload config for status too
  router.get('/status', async (_req: Request, res: Response<StatusResponse>) => {
    try {
      const config = await loadConfig();
      res.json({
        status: 'ok',
        version: '1.0.0',
        config: {
          model: config.model,
          hasApiKey: Boolean(config.apiKey),
          maxToolRounds: config.maxToolRounds,
          apiBadgeId: config.apiBadgeId,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        version: '1.0.0',
        config: {
          model: '',
          hasApiKey: false,
          maxToolRounds: 0,
          apiBadgeId: null,
        },
        timestamp: Date.now(),
      });
    }
  });

  // Chat endpoint - reload config on every request
  router.post('/chat', async (req: Request<object, ChatResponse, ChatRequest>, res: Response<ChatResponse>): Promise<void> => {
    try {
      const { message, history = [] } = req.body;

      if (!message) {
        res.status(400).json({
          response: '',
          error: 'Message is required',
        });
        return;
      }

      // Reload config from database for fresh API key and settings
      const config = await loadConfig();
      
      // Create agent with fresh config
      const chatAgent = new ChatAgent(config);
      
      const response = await chatAgent.chat(message, history);

      res.json({
        response,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Chat error:', errorMessage);
      
      res.status(500).json({
        response: '',
        error: errorMessage,
      });
    }
  });

  // Reload config endpoint - for explicit config refresh
  router.post('/reload-config', async (_req: Request, res: Response) => {
    try {
      const config = await loadConfig();
      res.json({
        success: true,
        message: 'Configuration reloaded successfully',
        config: {
          model: config.model,
          hasApiKey: Boolean(config.apiKey),
          maxToolRounds: config.maxToolRounds,
          apiBadgeId: config.apiBadgeId,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  // MCP SSE endpoint
  router.get('/sse', async (req: Request, res: Response) => {
    await mcpServer.handleSseConnection(req, res);
  });

  return router;
}
