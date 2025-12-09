#!/usr/bin/env python3
"""
ROXANNE DEV SERVER - Local Development with Feature Flags
==========================================================
Use this for local testing. Production uses main.py unchanged.

Feature Flags (via environment):
  ORCHESTRATOR_MODE=stable|v2     # stable = current, v2 = new ConversationManager
  ENDPOINT_MS=180                 # Endpointing delay in ms
  ENABLE_BARGE_IN_V2=false        # Hard cancel TTS/LLM on barge-in
  ENABLE_HUMANIZER=false          # Text humanization for natural TTS

Start locally:
  uvicorn dev_main:app --reload --port 8000

Ngrok for Twilio:
  ngrok http 8000
  Then set Twilio webhook to: https://<ngrok>.ngrok.io/twilio/incoming
"""

import os
import logging

from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# FEATURE FLAGS (read from environment, with safe defaults)
# =============================================================================

ORCHESTRATOR_MODE = os.getenv("ORCHESTRATOR_MODE", "stable")  # stable | v2
ENDPOINT_MS = int(os.getenv("ENDPOINT_MS", "180"))
ENABLE_BARGE_IN_V2 = os.getenv("ENABLE_BARGE_IN_V2", "false").lower() == "true"
ENABLE_HUMANIZER = os.getenv("ENABLE_HUMANIZER", "false").lower() == "true"

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("roxanne-dev")

logger.info("=" * 60)
logger.info("  ROXANNE DEV SERVER - LOCAL TESTING")
logger.info("=" * 60)
logger.info(f"  ORCHESTRATOR_MODE   = {ORCHESTRATOR_MODE}")
logger.info(f"  ENDPOINT_MS         = {ENDPOINT_MS}")
logger.info(f"  ENABLE_BARGE_IN_V2  = {ENABLE_BARGE_IN_V2}")
logger.info(f"  ENABLE_HUMANIZER    = {ENABLE_HUMANIZER}")
logger.info("=" * 60)

# =============================================================================
# IMPORT THE APPROPRIATE APP BASED ON MODE
# =============================================================================

if ORCHESTRATOR_MODE == "v2":
    # V2 mode: use new ConversationManager-based orchestration
    from roxanne_v2 import app
    logger.info("Using ORCHESTRATOR_MODE=v2 (ConversationManager)")
else:
    # Stable mode: use existing main.py
    from main import app
    logger.info("Using ORCHESTRATOR_MODE=stable (legacy)")

# Re-export app for uvicorn
__all__ = ["app"]

# =============================================================================
# LOCAL DEV ENTRYPOINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"Starting dev server on http://localhost:{port}")
    logger.info(f"Twilio webhook: Use ngrok → https://<subdomain>.ngrok.io/twilio/incoming")
    
    uvicorn.run(
        "dev_main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
