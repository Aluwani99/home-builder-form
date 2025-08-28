#!/bin/bash

echo "Starting Home Builder Form application..."
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Install production dependencies only
echo "Installing dependencies..."
npm install --production

# Start the application
echo "Starting server..."
node server.js