import { queryEventLogTool, queryEventLog, QueryEventLogParams } from './eventlog.js';
import { getNpcTool, listNpcsTool, getNpc, listNpcs, ListNpcsParams } from './npcs.js';
import { searchOghmaTool, searchOghma, SearchOghmaParams } from './oghma.js';
import { getMemoriesTool, getMemorySummariesTool, getMemories, getMemorySummaries, GetMemoriesParams, GetMemorySummariesParams } from './memory.js';
import { getDiariesTool, getDiaries, GetDiariesParams } from './diaries.js';
import { getSpeechLogTool, getSpeechLog, GetSpeechLogParams } from './speech.js';
import { getConfigTool, getConfig, GetConfigParams } from './config.js';
import { listConnectorsTool, listProfilesTool, listConnectors, listProfiles, ConnectorType } from './connectors.js';
import { getQuestsTool, getQuests, GetQuestsParams } from './quests.js';
import { runQueryTool, runQuery } from './query.js';
import { readFileTool, listFilesTool, searchFilesTool, readFile, listFiles, searchFiles, ReadFileParams, ListFilesParams, SearchFilesParams } from './filesystem.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolHandler {
  (params: unknown): Promise<unknown>;
}

export const toolDefinitions: ToolDefinition[] = [
  queryEventLogTool,
  getNpcTool,
  listNpcsTool,
  searchOghmaTool,
  getMemoriesTool,
  getMemorySummariesTool,
  getDiariesTool,
  getSpeechLogTool,
  getConfigTool,
  listConnectorsTool,
  listProfilesTool,
  getQuestsTool,
  runQueryTool,
  readFileTool,
  listFilesTool,
  searchFilesTool,
];

export const toolHandlers: Record<string, ToolHandler> = {
  query_eventlog: async (params) => queryEventLog(params as QueryEventLogParams),
  get_npc: async (params) => getNpc((params as { name: string }).name),
  list_npcs: async (params) => listNpcs(params as ListNpcsParams),
  search_oghma: async (params) => searchOghma(params as SearchOghmaParams),
  get_memories: async (params) => getMemories(params as GetMemoriesParams),
  get_memory_summaries: async (params) => getMemorySummaries(params as GetMemorySummariesParams),
  get_diaries: async (params) => getDiaries(params as GetDiariesParams),
  get_speech_log: async (params) => getSpeechLog(params as GetSpeechLogParams),
  get_config: async (params) => getConfig(params as GetConfigParams),
  list_connectors: async (params) => listConnectors((params as { type: ConnectorType }).type),
  list_profiles: async () => listProfiles(),
  get_quests: async (params) => getQuests(params as GetQuestsParams),
  run_query: async (params) => runQuery((params as { sql: string }).sql),
  read_file: async (params) => readFile(params as ReadFileParams),
  list_files: async (params) => listFiles(params as ListFilesParams),
  search_files: async (params) => searchFiles(params as SearchFilesParams),
};

export async function executeTool(name: string, params: unknown): Promise<unknown> {
  const handler = toolHandlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(params);
}
