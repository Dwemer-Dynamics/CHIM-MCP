import { readOnlyQuery } from '../db.js';

interface EventLogRow {
  type: string;
  data: string;
  sess: string;
  gamets: number;
  localts: string;
  ts: number;
  rowid: number;
  people: string | null;
  location: string | null;
  party: string | null;
}

export interface QueryEventLogParams {
  type?: string;
  speaker?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
  gamets_after?: number;
  gamets_before?: number;
}

export const queryEventLogTool = {
  name: 'query_eventlog',
  description: 'Search the eventlog for dialogue and events. Returns matching entries with timestamps, speakers, and content.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string',
        description: 'Filter by event type (e.g., "inputtext", "ginputtext", "narrator_inputtext", "diary")',
      },
      speaker: {
        type: 'string',
        description: 'Filter by speaker/NPC name (fuzzy match)',
      },
      keyword: {
        type: 'string',
        description: 'Search for keyword in event data',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 50)',
        default: 50,
      },
      offset: {
        type: 'number',
        description: 'Number of results to skip (for pagination)',
        default: 0,
      },
      gamets_after: {
        type: 'number',
        description: 'Filter events after this game timestamp',
      },
      gamets_before: {
        type: 'number',
        description: 'Filter events before this game timestamp',
      },
    },
  },
};

export async function queryEventLog(params: QueryEventLogParams): Promise<EventLogRow[]> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  if (params.type) {
    conditions.push(`type = $${paramIndex++}`);
    queryParams.push(params.type);
  }

  if (params.speaker) {
    conditions.push(`people ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.speaker}%`);
  }

  if (params.keyword) {
    conditions.push(`data ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.keyword}%`);
  }

  if (params.gamets_after !== undefined) {
    conditions.push(`gamets > $${paramIndex++}`);
    queryParams.push(params.gamets_after);
  }

  if (params.gamets_before !== undefined) {
    conditions.push(`gamets < $${paramIndex++}`);
    queryParams.push(params.gamets_before);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const query = `
    SELECT type, data, sess, gamets, localts, ts, rowid, people, location, party
    FROM eventlog
    ${whereClause}
    ORDER BY ts DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  queryParams.push(limit, offset);

  return readOnlyQuery<EventLogRow>(query, queryParams);
}
