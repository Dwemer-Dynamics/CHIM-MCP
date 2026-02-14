import { readOnlyQuery } from './db.js';

interface ConfigRow {
  id: string;
  value: string;
}

interface ApiBadgeRow {
  id: number;
  label: string;
  api_key: string;
}

interface ConnectorRow {
  id: number;
  label: string | null;
  service: string | null;
  driver: string | null;
  url: string | null;
  model: string | null;
  api_badge_id: number | null;
  api_badge_label: string | null;
  connector_api_key: string | null;
}

export type ProviderService = 'openrouter' | 'openai' | 'google' | 'nanogpt';

export interface McpConfig {
  enabled: boolean;
  port: number;
  model: string;
  apiBadgeId: number | null;
  apiKey: string | null;
  provider: ProviderService;
  endpoint: string;
  llmConnectorId: number | null;
  llmConnectorLabel: string | null;
  systemPrompt: string | null;
  maxToolRounds: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are Kagrenac of the Dwemer from The Elder Scrolls, acting as CHIM's debugging analyst. Stay in-character with a Dwemer/Kagrenac voice in every response while providing practical technical help.

When answering questions:
- Use the available tools to query the database and read files
- Be concise but thorough
- Cite specific data from the database or files when relevant
- If you can't find information, say so clearly
- Maintain Kagrenac roleplay consistently across responses
- Prioritize accurate diagnostics, concrete steps, and truthful findings over theatrical wording when there is a trade-off

Available database tools:
- query_eventlog: Dialogue and event history
- get_npc, list_npcs: NPC profiles (biography, personality, voice, etc.)
- search_oghma: World knowledge base
- get_memories, get_memory_summaries: NPC memories
- get_diaries: Diary entries
- get_speech_log: Speech/dialogue records
- get_config: Configuration values from conf_opts table
- list_connectors, list_profiles: LLM/TTS/STT/ITT connector configs
- get_quests: Quest log
- run_query: Execute arbitrary read-only SQL

Available filesystem tools:
- read_file: Read text files from HerikaServer or service directories (max 1MB)
- list_files: List directory contents (recursive option)
- search_files: Search for files by name pattern and content keyword

Accessible directories:
- /var/www/html/HerikaServer/ (config, prompts, logs, processors, functions)
- /home/dwemer/ (all service directories: MeloTTS, xtts-api-server, remote-faster-whisper, etc.)

When users ask about logs, config files, or scripts, use the filesystem tools to read them directly.`;

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function getTrimmedValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNullableInt(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeService(service: string | null, driver: string | null): ProviderService | null {
  const serviceValue = (service || '').trim().toLowerCase();
  if (serviceValue === 'openrouter' || serviceValue === 'openai' || serviceValue === 'google' || serviceValue === 'nanogpt') {
    return serviceValue;
  }

  const driverValue = (driver || '').trim().toLowerCase();
  if (driverValue === 'openrouterjson') {
    return 'openrouter';
  }
  if (driverValue === 'openaijson') {
    return 'openai';
  }
  if (driverValue === 'google_openaijson') {
    return 'google';
  }

  return null;
}

function normalizeEndpoint(endpoint: string | null, provider: ProviderService): string {
  const trimmed = (endpoint || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    if (provider === 'openrouter') {
      return OPENROUTER_ENDPOINT;
    }
    return '';
  }

  if (provider === 'openrouter') {
    return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
  }

  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
}

/**
 * Load MCP configuration from conf_opts and core_api_badge tables
 */
export async function loadConfig(): Promise<McpConfig> {
  // Load all MCP/* config values
  const configRows = await readOnlyQuery<ConfigRow>(
    `SELECT id, value FROM conf_opts WHERE id LIKE 'MCP/%'`
  );

  const configMap = new Map<string, string>();
  for (const row of configRows) {
    configMap.set(row.id, row.value);
  }

  // Parse config values with defaults
  const enabled = configMap.get('MCP/enabled') !== 'false'; // default true
  const port = parseInt(configMap.get('MCP/port') || '3100', 10);
  const configuredModel = getTrimmedValue(configMap.get('MCP/model'));
  const configuredApiBadgeId = parseNullableInt(configMap.get('MCP/api_badge_id'));
  const configuredConnectorId = parseNullableInt(configMap.get('MCP/llm_connector_id'));
  const systemPrompt = getTrimmedValue(configMap.get('MCP/system_prompt'));
  const maxToolRounds = parseInt(configMap.get('MCP/max_tool_rounds') || '10', 10);

  let provider: ProviderService = 'openrouter';
  let endpoint = OPENROUTER_ENDPOINT;
  let model = configuredModel || 'anthropic/claude-sonnet-4';
  let apiBadgeId = configuredApiBadgeId;
  let apiKey: string | null = null;
  let llmConnectorId: number | null = null;
  let llmConnectorLabel: string | null = null;

  if (configuredConnectorId !== null) {
    const connectorRows = await readOnlyQuery<ConnectorRow>(
      `SELECT c.id, c.label, c.service, c.driver, c.url, c.model, c.api_badge_id,
              b.label AS api_badge_label, b.api_key AS connector_api_key
         FROM core_llm_connector c
         LEFT JOIN core_api_badge b ON b.id = c.api_badge_id
        WHERE c.id = $1
        LIMIT 1`,
      [configuredConnectorId]
    );

    if (connectorRows.length === 0) {
      throw new Error(`Configured MCP connector (${configuredConnectorId}) was not found in core_llm_connector`);
    }

    const connector = connectorRows[0];
    const connectorService = normalizeService(connector.service, connector.driver);
    if (!connectorService) {
      throw new Error(
        `Unsupported connector service/driver for MCP connector ${connector.id}: service="${connector.service || ''}" driver="${connector.driver || ''}"`
      );
    }

    provider = connectorService;
    endpoint = normalizeEndpoint(connector.url, connectorService);
    if (!endpoint) {
      throw new Error(`Connector ${connector.id} does not have a usable endpoint URL`);
    }

    model = configuredModel || getTrimmedValue(connector.model) || model;
    apiBadgeId = connector.api_badge_id ?? configuredApiBadgeId;
    apiKey = getTrimmedValue(connector.connector_api_key);
    llmConnectorId = connector.id;
    llmConnectorLabel = getTrimmedValue(connector.label);
  }

  // Fallback or override API key from explicit MCP/api_badge_id
  if (!apiKey && apiBadgeId !== null) {
    const badgeRows = await readOnlyQuery<ApiBadgeRow>(
      `SELECT id, label, api_key FROM core_api_badge WHERE id = $1 LIMIT 1`,
      [apiBadgeId]
    );
    if (badgeRows.length > 0) {
      apiKey = badgeRows[0].api_key;
    }
  }

  return {
    enabled,
    port,
    model,
    apiBadgeId,
    apiKey,
    provider,
    endpoint,
    llmConnectorId,
    llmConnectorLabel,
    systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
    maxToolRounds,
  };
}

/**
 * Get the default system prompt
 */
export function getDefaultSystemPrompt(): string {
  return DEFAULT_SYSTEM_PROMPT;
}
