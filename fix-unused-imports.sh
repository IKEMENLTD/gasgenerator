#!/bin/bash

echo "🔧 Fixing unused imports automatically..."

# Run build and capture errors
while true; do
  echo "Running build..."
  ERROR=$(npm run build 2>&1 | grep "Type error:" -A 1 | head -2)
  
  if [ -z "$ERROR" ]; then
    echo "✅ No more unused import errors found!"
    break
  fi
  
  # Extract file path and unused variable
  FILE=$(echo "$ERROR" | grep -oP '^\./[^:]+' | head -1)
  LINE_NUM=$(echo "$ERROR" | grep -oP ':\d+:' | head -1 | tr -d ':')
  UNUSED_VAR=$(echo "$ERROR" | grep -oP "'[^']+' is declared but" | grep -oP "'[^']+" | tr -d "'")
  
  if [ -z "$FILE" ] || [ -z "$UNUSED_VAR" ]; then
    echo "Could not parse error, exiting"
    echo "$ERROR"
    break
  fi
  
  echo "Found unused import: $UNUSED_VAR in $FILE:$LINE_NUM"
  
  # Remove the import line containing the unused variable
  sed -i "/$UNUSED_VAR/d" "$FILE"
  
  echo "Fixed $FILE"
done

echo "🎉 All unused imports removed!"