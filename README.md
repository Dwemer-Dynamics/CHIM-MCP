# CHIM MCP Server

An MCP (Model Context Protocol) server that provides AI agents with read-only access to CHIM/HerikaServer and StobeServer runtime data.

## Features

- **MCP SSE Endpoint**: Standard MCP protocol over Server-Sent Events
- **Chat Agent API**: OpenRouter-powered AI assistant with database tool access
- **HerikaServer + StobeServer Integration**: Runtime file inspection across both services
- **Read-Only Database Access**: Safe querying of eventlog, NPCs, memories, oghma, diaries, and arbitrary SQL on `dwemer` or `stobe`

## Installation

```bash
npm install
npm run build
```

## Configuration

All configuration is stored in the PostgreSQL `conf_opts` table and managed through the HerikaServer UI:

- `MCP/enabled` - Whether the server should start
- `MCP/port` - Port (default: 3100)
- `MCP/model` - OpenRouter model identifier
- `MCP/temperature` - Model temperature (0-2)
- `MCP/api_badge_id` - References `core_api_badge.id` for API key
- `MCP/system_prompt` - Optional custom system prompt
- `MCP/max_tool_rounds` - Max tool-call iterations

Note: custom `MCP/system_prompt` values are automatically supplemented with StobeServer context unless they already mention `StobeServer`.

Environment variables in `.env`:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Primary DB connection (defaults to `dwemer`)
- `STOBE_DB_NAME` - Optional Stobe DB name for `run_query` cross-database diagnostics (default: `stobe`)
- `HERIKA_SERVER_PATH` - Optional HerikaServer path override
- `STOBE_SERVER_PATH` - Optional StobeServer path override

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### As DwemerDistro Service
The service is automatically started by DwemerDistro's `start_env` script.

## Available Tools

- `query_eventlog` - Search dialogue/event history
- `get_npc` - Get full NPC profile
- `list_npcs` - List all NPCs
- `search_oghma` - Search knowledge base
- `get_memories` - Query NPC memories
- `get_memory_summaries` - Get compressed memory summaries
- `get_diaries` - Fetch diary entries
- `get_speech_log` - Query speech/dialogue log
- `get_config` - Read config values
- `list_connectors` - List LLM/TTS/STT/ITT connectors
- `list_profiles` - List CHIM profiles
- `get_quests` - Query quest log
- `run_query` - Execute arbitrary read-only SQL (`database: dwemer|stobe`)

Note: named tools are CHIM/dwemer schema-focused. Use `run_query` with `database: stobe` for StobeServer tables.

## License

MIT
