import { readOnlyQuery } from '../db.js';

export const runQueryTool = {
  name: 'run_query',
  description: 'Execute an arbitrary read-only SQL query. Query must start with SELECT or WITH. Use for complex queries not covered by other tools.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      sql: {
        type: 'string',
        description: 'The SQL query to execute (must be SELECT or WITH statement)',
      },
    },
    required: ['sql'],
  },
};

export async function runQuery(sql: string): Promise<unknown[]> {
  // Validate query is read-only
  const trimmedSql = sql.trim().toUpperCase();
  
  if (!trimmedSql.startsWith('SELECT') && !trimmedSql.startsWith('WITH')) {
    throw new Error('Only SELECT and WITH queries are allowed');
  }

  // Check for forbidden keywords that might bypass read-only
  const forbiddenKeywords = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'TRUNCATE', 'GRANT', 'REVOKE', 'EXECUTE', 'CALL'
  ];

  for (const keyword of forbiddenKeywords) {
    if (trimmedSql.includes(keyword)) {
      throw new Error(`Query contains forbidden keyword: ${keyword}`);
    }
  }

  // Execute query in read-only transaction
  return readOnlyQuery(sql);
}
