import { readOnlyQuery } from '../db.js';

interface LlmConnectorRow {
  id: number;
  label: string;
  metadata: string | null;
  url: string | null;
  model: string | null;
  provider: string | null;
  driver: string | null;
  reasoning_model: string | null;
  max_tokens: number | null;
  enforce_json: boolean | null;
  prefill_json: boolean | null;
  api_badge_id: number | null;
  json_schema: string | null;
  temperature: number | null;
  presence_penalty: number | null;
  frequency_penalty: number | null;
  repetition_penalty: number | null;
  top_p: number | null;
  top_k: number | null;
  min_p: number | null;
  top_a: number | null;
  service: string | null;
}

interface TtsConnectorRow {
  id: number;
  driver: string | null;
  label: string;
  metadata: string | null;
  api_badge_id: number | null;
  url: string | null;
  voice_field: string | null;
}

interface SttConnectorRow {
  id: number;
  driver: string | null;
  label: string;
  metadata: string | null;
}

interface IttConnectorRow {
  id: number;
  driver: string | null;
  label: string;
  metadata: string | null;
}

interface ProfileRow {
  id: number;
  label: string;
  default_npc: string | null;
  default_narrator: string | null;
  tts_connector_id: number | null;
  itt_connector_id: number | null;
  llm_primary_id: number | null;
  llm_secondary_id: number | null;
  llm_tertiary_id: number | null;
  llm_quaternary_id: number | null;
  llm_formatter_id: number | null;
  llm_fallback_id: number | null;
  metadata: string | null;
  diary_connector_id: number | null;
  slot: number | null;
  prompt: string | null;
}

export type ConnectorType = 'llm' | 'tts' | 'stt' | 'itt';

export const listConnectorsTool = {
  name: 'list_connectors',
  description: 'List LLM, TTS, STT, or ITT connectors with their configuration.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string',
        enum: ['llm', 'tts', 'stt', 'itt'],
        description: 'Type of connector to list',
      },
    },
    required: ['type'],
  },
};

export const listProfilesTool = {
  name: 'list_profiles',
  description: 'List all CHIM profiles with their connector assignments (LLM, TTS, ITT, etc.).',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

export async function listConnectors(type: ConnectorType): Promise<unknown[]> {
  const tableMap = {
    llm: 'core_llm_connector',
    tts: 'core_tts_connector',
    stt: 'core_stt_connector',
    itt: 'core_itt_connector',
  };

  const table = tableMap[type];
  const query = `SELECT * FROM ${table} ORDER BY id`;

  switch (type) {
    case 'llm':
      return readOnlyQuery<LlmConnectorRow>(query);
    case 'tts':
      return readOnlyQuery<TtsConnectorRow>(query);
    case 'stt':
      return readOnlyQuery<SttConnectorRow>(query);
    case 'itt':
      return readOnlyQuery<IttConnectorRow>(query);
    default:
      throw new Error(`Unknown connector type: ${type}`);
  }
}

export async function listProfiles(): Promise<ProfileRow[]> {
  const query = `SELECT * FROM core_profiles ORDER BY slot NULLS LAST, id`;
  return readOnlyQuery<ProfileRow>(query);
}
