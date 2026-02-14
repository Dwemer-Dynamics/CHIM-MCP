import { readOnlyQuery } from '../db.js';

interface QuestRow {
  ts: number | null;
  sess: string | null;
  id_quest: string | null;
  name: string | null;
  editor_id: string | null;
  giver_actor_id: string | null;
  reward: string | null;
  target_id: string | null;
  is_unique: boolean | null;
  mod: string | null;
  stage: number | null;
  briefing: string | null;
  localts: string | null;
  gamets: number | null;
  data: string | null;
  status: string | null;
  rowid: number;
}

export interface GetQuestsParams {
  status?: string;
  keyword?: string;
  limit?: number;
}

export const getQuestsTool = {
  name: 'get_quests',
  description: 'Query the quest log. Returns quest records with name, status, stage, and briefing.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        description: 'Filter by quest status',
      },
      keyword: {
        type: 'string',
        description: 'Search keyword in quest name or briefing',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 50)',
        default: 50,
      },
    },
  },
};

export async function getQuests(params: GetQuestsParams): Promise<QuestRow[]> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  if (params.status) {
    conditions.push(`status ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.status}%`);
  }

  if (params.keyword) {
    conditions.push(`(name ILIKE $${paramIndex} OR briefing ILIKE $${paramIndex})`);
    paramIndex++;
    queryParams.push(`%${params.keyword}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 50;

  const query = `
    SELECT ts, sess, id_quest, name, editor_id, giver_actor_id, reward, target_id, 
           is_unique, mod, stage, briefing, localts, gamets, data, status, rowid
    FROM quests
    ${whereClause}
    ORDER BY ts DESC
    LIMIT $${paramIndex++}
  `;

  queryParams.push(limit);

  return readOnlyQuery<QuestRow>(query, queryParams);
}
