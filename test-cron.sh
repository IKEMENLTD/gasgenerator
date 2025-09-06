#!/bin/bash

echo "🧪 Testing cron endpoint..."
echo "=============================="

# Test the cron endpoint
echo "📡 Calling: https://gasgenerator.onrender.com/api/cron/process-queue"
echo ""

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" https://gasgenerator.onrender.com/api/cron/process-queue)

# Extract body and status
body=$(echo "$response" | sed -n '1,/HTTP_STATUS:/p' | sed '$d')
status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)

echo "📊 Response Status: $status"
echo "📋 Response Body:"
echo "$body" | jq . 2>/dev/null || echo "$body"
echo ""

if [ "$status" = "200" ]; then
    echo "✅ Success! Cron endpoint is working"
    echo ""
    echo "📌 Next steps:"
    echo "1. Check cron-job.org dashboard - it should show successful executions"
    echo "2. Test the LINE bot:"
    echo "   - Send 'Gmail自動化'"
    echo "   - Follow the conversation"
    echo "   - Click 'はい' to generate code"
    echo "   - Wait 1-2 minutes for the code"
else
    echo "❌ Failed with status $status"
    echo ""
    echo "⏳ Possible reasons:"
    echo "- Deployment not yet complete (wait 3-5 minutes)"
    echo "- Check Render logs for errors"
fi