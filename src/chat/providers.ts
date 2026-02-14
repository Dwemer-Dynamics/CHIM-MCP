import { McpConfig } from '../config.js';

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ProviderToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ProviderToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ProviderToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface ProviderChatResponse {
  id: string;
  choices: Array<{
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ProviderToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function getRequestHeaders(config: McpConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey || ''}`,
  };

  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/Dwemer-Dynamics/chim-mcp-server';
    headers['X-Title'] = 'CHIM MCP Server';
  }

  return headers;
}

function getProviderLabel(config: McpConfig): string {
  switch (config.provider) {
    case 'openai':
      return 'OpenAI-compatible (OpenAI)';
    case 'google':
      return 'OpenAI-compatible (Google)';
    case 'nanogpt':
      return 'OpenAI-compatible (NanoGPT)';
    case 'openrouter':
      return 'OpenRouter';
    default:
      return 'Provider';
  }
}

export async function callChatProvider(
  config: McpConfig,
  messages: ProviderMessage[],
  tools: ProviderToolDefinition[]
): Promise<ProviderChatResponse> {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: getRequestHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages,
      tools,
      tool_choice: 'auto',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const providerLabel = getProviderLabel(config);
    throw new Error(`${providerLabel} API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<ProviderChatResponse>;
}
