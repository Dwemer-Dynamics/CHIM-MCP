#!/bin/bash

# Node.js Installation Script for CHIM MCP Server
# This script installs Node.js 20.x (LTS) on Debian/Ubuntu

echo "================================================"
echo "Installing Node.js 20.x LTS for CHIM MCP Server"
echo "================================================"

# Check if already installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "Node.js is already installed: $NODE_VERSION"
    
    # Check if npm is also available
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        echo "npm is already installed: $NPM_VERSION"
        echo ""
        echo "✓ Node.js and npm are ready!"
        exit 0
    fi
fi

echo ""
echo "Installing Node.js from NodeSource repository..."
echo ""

# Update package list
sudo apt-get update

# Install dependencies
sudo apt-get install -y ca-certificates curl gnupg

# Create keyrings directory
sudo mkdir -p /etc/apt/keyrings

# Download and add NodeSource GPG key
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

# Add NodeSource repository (Node.js 20.x LTS)
NODE_MAJOR=20
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

# Update package list again
sudo apt-get update

# Install Node.js (includes npm)
sudo apt-get install -y nodejs

# Verify installation
echo ""
echo "================================================"
echo "Installation Complete!"
echo "================================================"
echo ""

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✓ Node.js: $NODE_VERSION"
else
    echo "✗ Node.js installation failed"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "✓ npm: $NPM_VERSION"
else
    echo "✗ npm installation failed"
    exit 1
fi

echo ""
echo "You can now install and build the CHIM MCP Server:"
echo "  cd /home/dwemer/chim-mcp-server"
echo "  npm install"
echo "  npm run build"
echo ""
