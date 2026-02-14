import { toolDefinitions, executeTool } from '../tools/index.js';
import { McpConfig } from '../config.js';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class ChatAgent {
  private config: McpConfig;

  constructor(config: McpConfig) {
    this.config = config;
  }

  private convertToolDefinitions() {
    const tools = toolDefinitions.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
    
    // Debug: log tool count
    console.log(`[Agent] Registered ${tools.length} tools for OpenRouter`);
    
    return tools;
  }

  async chat(userMessage: string, history: Message[] = []): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenRouter API key not configured. Please set MCP/api_badge_id in conf_opts.');
    }

    const messages: Message[] = [
      {
        role: 'system',
        content: this.config.systemPrompt || '',
      },
      ...history,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const tools = this.convertToolDefinitions();
    let roundCount = 0;

    while (roundCount < this.config.maxToolRounds) {
      roundCount++;

      const response = await this.callOpenRouter(messages, tools);
      const choice = response.choices[0];

      if (!choice) {
        throw new Error('No response from OpenRouter');
      }

      const assistantMessage = choice.message;

      // If no tool calls, we have the final response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return assistantMessage.content || '';
      }

      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[Agent] Executing tool: ${toolName}`, toolArgs);

        try {
          const result = await executeTool(toolName, toolArgs);
          
          console.log(`[Agent] Tool ${toolName} succeeded`);

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(result),
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Agent] Tool ${toolName} failed:`, errorMessage);
          
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify({ error: errorMessage }),
          });
        }
      }
    }

    throw new Error(`Maximum tool rounds (${this.config.maxToolRounds}) exceeded`);
  }

  private async callOpenRouter(messages: Message[], tools: unknown[]): Promise<OpenRouterResponse> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': 'https://github.com/Dwemer-Dynamics/chim-mcp-server',
        'X-Title': 'CHIM MCP Server',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        tools,
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<OpenRouterResponse>;
  }
}
