#!/bin/bash
# Quick test of the autonomous scheduler

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     DEVONN.AI SCHEDULER - QUICK TEST                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cd ~/.openclaw/workspace

# Test 1: Submit various task types
echo "[Test 1] Submitting tasks of different types..."
npx tsx cli/devonn.ts submit system '{"action": "health_check"}' --priority 9
npx tsx cli/devonn.ts submit terminal '{"command": "echo Hello"}' --priority 7
npx tsx cli/devonn.ts submit intelligence '{"prompt": "Analyze logs"}' --priority 6
npx tsx cli/devonn.ts submit web '{"action": "fetch_data", "url": "https://example.com"}' --priority 5
npx tsx cli/devonn.ts submit orchestrator '{"workflow": "deploy_stack"}' --priority 8
echo ""

# Test 2: Check status
echo "[Test 2] Checking system status..."
npx tsx cli/devonn.ts status
echo ""

# Test 3: List tasks
echo "[Test 3] Listing all tasks..."
npx tsx cli/devonn.ts list
echo ""

echo "✅ Test complete. Start the scheduler with: npm start"
