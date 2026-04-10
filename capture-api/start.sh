#!/bin/bash
# Start Capture API

echo "🚀 Starting Capture API..."
echo ""

# Check if already running
if lsof -Pi :3456 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Capture API is already running on port 3456"
    echo "   Visit: http://localhost:3456/health"
    exit 0
fi

# Start server
node server.js &

# Wait a moment
sleep 2

# Test
echo ""
echo "🧪 Testing API..."
curl -s http://localhost:3456/health | jq . 2>/dev/null || curl -s http://localhost:3456/health

echo ""
echo ""
echo "✅ Capture API is running!"
echo ""
echo "Endpoints:"
echo "  POST http://localhost:3456/capture"
echo "  GET  http://localhost:3456/captures"
echo "  GET  http://localhost:3456/search?q=keyword"
echo "  GET  http://localhost:3456/health"
echo ""
echo "Example:"
echo "  curl -X POST http://localhost:3456/capture \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"text\": \"Need to review the API design\", \"source\": \"mobile\"}'"
echo ""
