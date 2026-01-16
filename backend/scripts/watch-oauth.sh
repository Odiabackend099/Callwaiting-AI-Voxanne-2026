#!/bin/bash
ORG_ID=$1
if [ -z "$ORG_ID" ]; then
  echo "Usage: ./watch-oauth.sh <org_id>"
  exit 1
fi

npx nodemon --watch src \
  --exec "ts-node scripts/verify-oauth.ts $ORG_ID" \
  --delay 2
