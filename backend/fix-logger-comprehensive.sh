#!/bin/bash

# Comprehensive fix for all logger signature issues
# The scoped logger from createLogger() expects: (message: string, context?: any)
# But code is calling it with objects as the second parameter which TypeScript sees as string

FILES=(
  "src/routes/webhooks.ts"
  "src/jobs/vapi-call-poller.ts"
  "src/jobs/twilio-call-poller.ts"
  "src/services/recording-upload-retry.ts"
  "src/jobs/recording-queue-worker.ts"
  "src/jobs/orphan-recording-cleanup.ts"
  "src/jobs/recording-metrics-monitor.ts"
  "src/services/recording-metrics.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    
    # Use sed to add 'as any' type assertion to all logger context objects
    # This handles: logger.info('message', { ... })
    sed -i.bak -E "s/logger\.(info|error|warn|debug)\('([^']+)',\s*\{/logger.\1('\2', {/g" "$file"
    sed -i.bak -E "s/logger\.(info|error|warn|debug)\('([^']+)', \{([^}]+)\}\)/logger.\1('\2', {\3} as any)/g" "$file"
    
    # Clean up backup files
    rm -f "${file}.bak"
    
    echo "Processed $file"
  else
    echo "Warning: $file not found"
  fi
done

echo "All files processed!"
