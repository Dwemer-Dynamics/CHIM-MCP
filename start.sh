#!/bin/bash
cd "$(dirname "$0")"

# Self-heal first-run installs: build if dist is missing.
if [ ! -f "dist/index.js" ]; then
  if command -v npm >/dev/null 2>&1; then
    if [ -f "package-lock.json" ]; then
      npm ci
    else
      npm install
    fi
    npm run build
  else
    echo "npm not found and dist/index.js is missing" >> /tmp/chim-mcp-server.log
    exit 1
  fi
fi

nohup node dist/index.js >> /tmp/chim-mcp-server.log 2>&1 &
echo $! > /tmp/chim-mcp-server.pid
