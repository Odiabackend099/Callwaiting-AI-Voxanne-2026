-- Scorched Earth: Wipe data for Voxanne org
DELETE FROM appointments WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';
DELETE FROM leads WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';

-- Return verification
SELECT COUNT(*) as remaining_appointments FROM appointments WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';
SELECT COUNT(*) as remaining_leads FROM leads WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';
