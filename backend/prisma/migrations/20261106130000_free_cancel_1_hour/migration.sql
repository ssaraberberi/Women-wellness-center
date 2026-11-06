-- Free cancellation ends 1 hour before class (a 17:00 class: free until 15:59).
ALTER TABLE "studio_settings" ALTER COLUMN "free_cancel_hours" SET DEFAULT 1;

-- hand-written: the old default (12) and the 3 hours set a moment ago both
-- become 1; a value the studio chose itself is left alone.
UPDATE "studio_settings" SET "free_cancel_hours" = 1 WHERE "free_cancel_hours" IN (12, 3);
