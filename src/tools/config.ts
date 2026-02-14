import { readOnlyQuery } from '../db.js';

interface ConfigRow {
  id: string;
  value: string;
}

export interface GetConfigParams {
  key?: string;
  prefix?: string;
}

export const getConfigTool = {
  name: 'get_config',
  description: 'Read configuration values from conf_opts table. Can fetch specific keys or search by prefix.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      key: {
        type: 'string',
        description: 'Specific config key to fetch (exact match)',
      },
      prefix: {
        type: 'string',
        description: 'Search for keys starting with this prefix (e.g., "Network/", "MCP/")',
      },
    },
  },
};

export async function getConfig(params: GetConfigParams): Promise<ConfigRow[]> {
  if (params.key) {
    const query = 'SELECT id, value FROM conf_opts WHERE id = $1';
    return readOnlyQuery<ConfigRow>(query, [params.key]);
  }

  if (params.prefix) {
    const query = 'SELECT id, value FROM conf_opts WHERE id LIKE $1 ORDER BY id';
    return readOnlyQuery<ConfigRow>(query, [`${params.prefix}%`]);
  }

  // If neither key nor prefix specified, return all
  const query = 'SELECT id, value FROM conf_opts ORDER BY id LIMIT 100';
  return readOnlyQuery<ConfigRow>(query);
}
