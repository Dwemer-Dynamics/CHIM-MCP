import { readOnlyQuery } from '../db.js';

interface SpeechRow {
  sess: string | null;
  speaker: string | null;
  speech: string | null;
  location: string | null;
  listener: string | null;
  topic: string | null;
  localts: string | null;
  gamets: number | null;
  ts: number | null;
  rowid: number;
  companions: string | null;
  audios: string | null;
}

export interface GetSpeechLogParams {
  speaker?: string;
  listener?: string;
  keyword?: string;
  limit?: number;
}

export const getSpeechLogTool = {
  name: 'get_speech_log',
  description: 'Query the speech/dialogue log. Returns speech records with speaker, listener, and dialogue content.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      speaker: {
        type: 'string',
        description: 'Filter by speaker name',
      },
      listener: {
        type: 'string',
        description: 'Filter by listener name',
      },
      keyword: {
        type: 'string',
        description: 'Search keyword in speech content',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 50)',
        default: 50,
      },
    },
  },
};

export async function getSpeechLog(params: GetSpeechLogParams): Promise<SpeechRow[]> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  if (params.speaker) {
    conditions.push(`speaker ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.speaker}%`);
  }

  if (params.listener) {
    conditions.push(`listener ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.listener}%`);
  }

  if (params.keyword) {
    conditions.push(`speech ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.keyword}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 50;

  const query = `
    SELECT sess, speaker, speech, location, listener, topic, localts, gamets, ts, rowid, companions, audios
    FROM speech
    ${whereClause}
    ORDER BY ts DESC
    LIMIT $${paramIndex++}
  `;

  queryParams.push(limit);

  return readOnlyQuery<SpeechRow>(query, queryParams);
}
