-- Migration: Add unique constraint on external_message_id for messages table
-- Prevents duplicate processing of webhook events from Twilio/Resend
-- Date: 2026-01-25
--
-- Purpose: When external API webhooks come in (e.g., SMS delivery status updates),
-- we need to ensure idempotent processing. If a webhook fires twice for the same
-- message, we should not process it twice.
--
-- Solution: Create a unique index on (service_provider, external_message_id)
-- where external_message_id is NOT NULL. This allows:
-- - Multiple NULL values (for messages not yet assigned external IDs)
-- - Only one entry per provider-message combination

-- Create unique index for external message ID deduplication
CREATE UNIQUE INDEX idx_messages_external_id_unique
ON messages(service_provider, external_message_id)
WHERE external_message_id IS NOT NULL;

-- Comment documenting the index
COMMENT ON INDEX idx_messages_external_id_unique IS
'Unique constraint for deduplication of webhook events from external providers.
Prevents double-processing of Twilio/Resend delivery webhooks.';
