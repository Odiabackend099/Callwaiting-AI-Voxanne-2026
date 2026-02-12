-- Add 'phone_provisioning' to credit_transactions type CHECK constraint
-- This allows phone number purchase deductions to be recorded in the ledger.

ALTER TABLE credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN (
    'topup',
    'call_deduction',
    'refund',
    'adjustment',
    'bonus',
    'phone_provisioning'
  ));
