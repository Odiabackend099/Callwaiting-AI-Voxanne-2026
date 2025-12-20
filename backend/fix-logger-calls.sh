#!/bin/bash

# Fix logger calls to use correct scoped logger signature
# Changes logger.info('module', 'message', context) to logger.info('message', context)

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
    echo "Fixing $file..."
    
    # Fix logger.info('module', 'message', ...) -> logger.info('message', ...)
    perl -i -pe "s/logger\.(info|error|warn|debug)\('([^']+)',\s*'([^']+)'/logger.\$1('\$3'/g" "$file"
    
    # Fix logger.info('module', 'message') -> logger.info('message')
    perl -i -pe "s/logger\.(info|error|warn|debug)\('([^']+)',\s*'([^']+)'\)/logger.\$1('\$3')/g" "$file"
    
    echo "Fixed $file"
  else
    echo "Warning: $file not found"
  fi
done

echo "All logger calls fixed!"
