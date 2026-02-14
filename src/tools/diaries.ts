import { readOnlyQuery } from '../db.js';

interface DiaryRow {
  ts: number;
  sess: string | null;
  topic: string | null;
  content: string | null;
  tags: string | null;
  people: string | null;
  localts: string | null;
  location: string | null;
  gamets: number | null;
  rowid: number;
}

export interface GetDiariesParams {
  topic?: string;
  keyword?: string;
  limit?: number;
}

export const getDiariesTool = {
  name: 'get_diaries',
  description: 'Fetch diary entries from diarylog. Returns diary records with topics, content, and metadata.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      topic: {
        type: 'string',
        description: 'Filter by diary topic',
      },
      keyword: {
        type: 'string',
        description: 'Search keyword in content',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 50)',
        default: 50,
      },
    },
  },
};

export async function getDiaries(params: GetDiariesParams): Promise<DiaryRow[]> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  if (params.topic) {
    conditions.push(`topic ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.topic}%`);
  }

  if (params.keyword) {
    conditions.push(`content ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.keyword}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 50;

  const query = `
    SELECT ts, sess, topic, content, tags, people, localts, location, gamets, rowid
    FROM diarylog
    ${whereClause}
    ORDER BY ts DESC
    LIMIT $${paramIndex++}
  `;

  queryParams.push(limit);

  return readOnlyQuery<DiaryRow>(query, queryParams);
}
