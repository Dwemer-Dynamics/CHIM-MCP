import { toolDefinitions, executeTool } from '../tools/index.js';
import { McpConfig } from '../config.js';
import { callChatProvider, ProviderMessage, ProviderToolDefinition } from './providers.js';

export class ChatAgent {
  private config: McpConfig;

  constructor(config: McpConfig) {
    this.config = config;
  }

  private convertToolDefinitions(): ProviderToolDefinition[] {
    const tools: ProviderToolDefinition[] = toolDefinitions.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
    
    // Debug: log tool count
    console.log(`[Agent] Registered ${tools.length} tools for ${this.config.provider}`);
    
    return tools;
  }

  async chat(userMessage: string, history: ProviderMessage[] = []): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('No API key configured for MCP provider. Set MCP/llm_connector_id or MCP/api_badge_id in conf_opts.');
    }

    const messages: ProviderMessage[] = [
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

      const response = await callChatProvider(this.config, messages, tools);
      const choice = response.choices[0];

      if (!choice) {
        throw new Error('No response from provider');
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

        try {
          const toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          console.log(`[Agent] Executing tool: ${toolName}`, toolArgs);
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
}
