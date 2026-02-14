import { readOnlyQuery } from '../db.js';

interface NpcRow {
  id: number;
  npc_name: string;
  npc_favorite: boolean | null;
  lock_profile: boolean | null;
  prompt_head: string | null;
  npc_static_bio: string | null;
  oghma_knowledge_tags: string | null;
  emote_moods: string | null;
  personality: string | null;
  relationships: string | null;
  occupation: string | null;
  appearance: string | null;
  skills: string | null;
  speechstyle: string | null;
  goals: string | null;
  voiceid: string | null;
  metadata: string | null;
  gender: string | null;
  race: string | null;
  refid: string | null;
  profile_id: number | null;
  dynamic_profile: boolean | null;
  extended_data: string | null;
  md5: string | null;
  gamets_last_updated: number | null;
  core: boolean | null;
  base: string | null;
  tags: string | null;
}

interface NpcListRow {
  id: number;
  npc_name: string;
  npc_favorite: boolean | null;
  gender: string | null;
  race: string | null;
  profile_id: number | null;
}

export const getNpcTool = {
  name: 'get_npc',
  description: 'Get full NPC profile from core_npc_master including biography, personality, relationships, and all attributes.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'NPC name (fuzzy match, case-insensitive)',
      },
    },
    required: ['name'],
  },
};

export const listNpcsTool = {
  name: 'list_npcs',
  description: 'List all NPCs with basic info (id, name, favorite, gender, race, profile). Optionally filter by name.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      filter: {
        type: 'string',
        description: 'Filter NPCs by name (fuzzy match)',
      },
      favorites_only: {
        type: 'boolean',
        description: 'Only return favorite NPCs',
        default: false,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 100)',
        default: 100,
      },
    },
  },
};

export async function getNpc(name: string): Promise<NpcRow[]> {
  const query = `
    SELECT *
    FROM core_npc_master
    WHERE npc_name ILIKE $1
    ORDER BY npc_favorite DESC NULLS LAST, npc_name
    LIMIT 10
  `;

  return readOnlyQuery<NpcRow>(query, [`%${name}%`]);
}

export interface ListNpcsParams {
  filter?: string;
  favorites_only?: boolean;
  limit?: number;
}

export async function listNpcs(params: ListNpcsParams): Promise<NpcListRow[]> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  if (params.filter) {
    conditions.push(`npc_name ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.filter}%`);
  }

  if (params.favorites_only) {
    conditions.push('npc_favorite = TRUE');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 100;

  const query = `
    SELECT id, npc_name, npc_favorite, gender, race, profile_id
    FROM core_npc_master
    ${whereClause}
    ORDER BY npc_favorite DESC NULLS LAST, npc_name
    LIMIT $${paramIndex++}
  `;

  queryParams.push(limit);

  return readOnlyQuery<NpcListRow>(query, queryParams);
}
