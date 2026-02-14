import { readOnlyQuery } from '../db.js';

interface OghmaRow {
  topic: string;
  topic_desc: string;
  native_vector: unknown | null;
  knowledge_class: string | null;
  topic_desc_basic: string | null;
  knowledge_class_basic: string | null;
  tags: string | null;
  category: string | null;
}

export interface SearchOghmaParams {
  topic?: string;
  keyword?: string;
  category?: string;
  limit?: number;
}

export const searchOghmaTool = {
  name: 'search_oghma',
  description: 'Search the Oghma knowledge base for world information, lore, and facts about NPCs, locations, quests, etc.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      topic: {
        type: 'string',
        description: 'Search by topic name',
      },
      keyword: {
        type: 'string',
        description: 'Search keyword in topic or description',
      },
      category: {
        type: 'string',
        description: 'Filter by category',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 50)',
        default: 50,
      },
    },
  },
};

export async function searchOghma(params: SearchOghmaParams): Promise<OghmaRow[]> {
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  if (params.topic) {
    conditions.push(`topic ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.topic}%`);
  }

  if (params.keyword) {
    conditions.push(`(topic ILIKE $${paramIndex} OR topic_desc ILIKE $${paramIndex})`);
    paramIndex++;
    queryParams.push(`%${params.keyword}%`);
  }

  if (params.category) {
    conditions.push(`category ILIKE $${paramIndex++}`);
    queryParams.push(`%${params.category}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit ?? 50;

  const query = `
    SELECT topic, topic_desc, knowledge_class, topic_desc_basic, knowledge_class_basic, tags, category
    FROM oghma
    ${whereClause}
    ORDER BY topic
    LIMIT $${paramIndex++}
  `;

  queryParams.push(limit);

  return readOnlyQuery<OghmaRow>(query, queryParams);
}
