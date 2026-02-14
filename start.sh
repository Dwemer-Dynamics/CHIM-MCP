#!/bin/bash
cd "$(dirname "$0")"
nohup node dist/index.js >> /tmp/chim-mcp-server.log 2>&1 &
echo $! > /tmp/chim-mcp-server.pid
