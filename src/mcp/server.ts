import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Request, Response } from 'express';
import { toolDefinitions, executeTool } from '../tools/index.js';

export class McpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'chim-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolDefinitions,
      };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await executeTool(name, args || {});
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });

    // List resources (schema information)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'chim://schema',
            name: 'Database Schema',
            description: 'Full database table list with column definitions',
            mimeType: 'application/json',
          },
        ],
      };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === 'chim://schema') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  description: 'CHIM Database Schema',
                  tables: [
                    'eventlog - Event and dialogue history',
                    'core_npc_master - NPC profiles',
                    'oghma - Knowledge base',
                    'memory - NPC memories',
                    'memory_summary - Compressed memories',
                    'diarylog - Diary entries',
                    'speech - Speech/dialogue records',
                    'conf_opts - Configuration key-value store',
                    'core_llm_connector - LLM service configs',
                    'core_tts_connector - TTS service configs',
                    'core_stt_connector - STT service configs',
                    'core_itt_connector - ITT service configs',
                    'core_profiles - CHIM profiles',
                    'quests - Quest log',
                  ],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  async handleSseConnection(req: Request, res: Response): Promise<void> {
    const transport = new SSEServerTransport('/message', res);
    await this.server.connect(transport);

    // Handle client disconnection
    req.on('close', () => {
      transport.close();
    });
  }

  getServer(): Server {
    return this.server;
  }
}
