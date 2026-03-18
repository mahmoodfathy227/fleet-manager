-- ====================================================
-- Call Logs: add time to follow-up date
-- Change follow_up_date from DATE to TIMESTAMP so date + time can be stored
-- ====================================================

ALTER TABLE call_logs
ALTER COLUMN follow_up_date TYPE TIMESTAMP WITHOUT TIME ZONE
USING follow_up_date::timestamp;

COMMENT ON COLUMN call_logs.follow_up_date IS 'Date and time when follow-up is due (stored as timestamp)';
