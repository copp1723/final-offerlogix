-- Migration 0022: Fix conversation status constraint to match application logic
-- Issue: Application uses status values like 'engaged', 'qualified', 'ready_for_handover', 'handed_over'
-- But database constraint only allows 'active', 'closed', 'archived'

BEGIN;

-- Drop the existing constraint
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_values_check;

-- Add the new constraint with all valid status values from the application
ALTER TABLE conversations 
ADD CONSTRAINT conversations_status_values_check 
CHECK (status IN (
    'new',
    'active', 
    'engaged',
    'qualified',
    'ready_for_handover',
    'handed_over',
    'closed', 
    'archived'
));

COMMIT;