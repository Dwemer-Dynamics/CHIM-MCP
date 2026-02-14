import { readOnlyQuery } from '../db.js';

interface MemoryRow {
  speaker: string | null;
  message: string | null;
  session: string | null;
  uid: string | null;
  listener: string | null;
  localts: string | null;
  gamets: number | null;
  momentum: number | null;
  rowid: number;
  event: string | null;
  ts: number | null;
}

interface MemorySummaryRow {
  gamets_truncated: number | null;
  n: number | null;
  packed_message: string | null;
  summary: string | null;
  classifier: string | null;
  uid: string | null;
  rowid: number;
  companions: string | null;
  tags: string | null;
}

export interface GetMemoriesParams {
  speaker?: string;
  listener?: string;
  keyword?: string;
  limit?: number;
}

export interface GetMemorySummariesParams {
  keyword?: string;
  classifier?: string;
  limit?: number;
}

export const getMemoriesTool = {
  name: 'get_memories',
  description: 'Query NPC memories from the memory table. Returns individual memory records.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      speaker: {
        type: 'string',
        description: 'Filter by speaker/NPC name',
      },
      listener: {
        type: 'string',
        description: 'Filter by listener/NPC name',
      },
      keyword: {
        type: 'string',
        description: 'Search keyword in message',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 50)',
        default: 50,
      },
    },
  },
};

export const getMemorySummariesTool = {
  name: 'get_memory_summaries',
  description: 'Query compressed memory summaries from memory_summary table. Returns summarized/packed memories.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      keyword: {
        type: 'string',
        description: 'Search keyword in packed message or summary',
      },
      classifier: {
        type: 'string',
        description: 'Filter by classifier type',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 50)',
        default: 50,
      },
    },
  },
};

export async function getMemories(params: GetMemoriesParams): Promise<MemoryRow[]> {
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
    conditions.push(`message ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.keyword}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 50;

  const query = `
    SELECT speaker, message, session, uid, listener, localts, gamets, momentum, rowid, event, ts
    FROM memory
    ${whereClause}
    ORDER BY ts DESC
    LIMIT $${paramIndex++}
  `;

  queryParams.push(limit);

  return readOnlyQuery<MemoryRow>(query, queryParams);
}

export async function getMemorySummaries(params: GetMemorySummariesParams): Promise<MemorySummaryRow[]> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  if (params.keyword) {
    conditions.push(`(packed_message ILIKE $${paramIndex} OR summary ILIKE $${paramIndex})`);
    paramIndex++;
    queryParams.push(`%${params.keyword}%`);
  }

  if (params.classifier) {
    conditions.push(`classifier ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.classifier}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 50;

  const query = `
    SELECT gamets_truncated, n, packed_message, summary, classifier, uid, rowid, companions, tags
    FROM memory_summary
    ${whereClause}
    ORDER BY rowid DESC
    LIMIT $${paramIndex++}
  `;

  queryParams.push(limit);

  return readOnlyQuery<MemorySummaryRow>(query, queryParams);
}
