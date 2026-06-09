#!/bin/bash

echo "============================================"
echo "  Lora Tag Inspector - Start Server"
echo "============================================"
echo ""

cd "$(dirname "$0")"

# Try Python3 first
if command -v python3 &> /dev/null; then
    echo "[Method 1] Starting with Python3"
    echo "URL: http://localhost:3000"
    echo "Press Ctrl+C to stop"
    echo ""
    sleep 1
    if command -v open &> /dev/null; then
        open http://localhost:3000
    elif command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    fi
    python3 -m http.server 3000
    exit 0
fi

# Try Python
if command -v python &> /dev/null; then
    echo "[Method 1] Starting with Python"
    echo "URL: http://localhost:3000"
    echo "Press Ctrl+C to stop"
    echo ""
    sleep 1
    python -m http.server 3000
    exit 0
fi

# Try npx
if command -v npx &> /dev/null; then
    echo "[Method 2] Starting with Node.js npx"
    echo "URL: http://localhost:3000"
    echo "Press Ctrl+C to stop"
    echo ""
    sleep 1
    npx http-server . -p 3000 -c-1
    exit 0
fi

echo "[ERROR] Python or Node.js not found."
echo "Please install one of the following:"
echo "  Python: https://www.python.org/downloads/"
echo "  Node.js: https://nodejs.org/"
echo ""
