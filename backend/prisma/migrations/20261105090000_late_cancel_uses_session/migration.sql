-- hand-written: a late cancellation always uses up the session (the switch is
-- no longer read), and free cancellation ends at least 1 hour before class.
UPDATE "studio_settings" SET "late_cancel_keeps_credit" = true;
UPDATE "studio_settings" SET "free_cancel_hours" = 1 WHERE "free_cancel_hours" < 1;
