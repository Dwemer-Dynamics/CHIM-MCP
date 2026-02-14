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

export interface McpConfig {
  enabled: boolean;
  port: number;
  model: string;
  apiBadgeId: number | null;
  apiKey: string | null;
  systemPrompt: string | null;
  maxToolRounds: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant with access to the CHIM (Skyrim mod) database and filesystem. You can help users query NPC profiles, dialogue history, memories, knowledge base entries, diaries, configuration files, logs, and more.

When answering questions:
- Use the available tools to query the database and read files
- Be concise but thorough
- Cite specific data from the database or files when relevant
- If you can't find information, say so clearly

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
  const model = configMap.get('MCP/model') || 'anthropic/claude-sonnet-4';
  const apiBadgeId = configMap.has('MCP/api_badge_id')
    ? parseInt(configMap.get('MCP/api_badge_id')!, 10)
    : null;
  const systemPrompt = configMap.get('MCP/system_prompt') || null;
  const maxToolRounds = parseInt(configMap.get('MCP/max_tool_rounds') || '10', 10);

  // Load API key if badge ID is set
  let apiKey: string | null = null;
  if (apiBadgeId !== null) {
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
