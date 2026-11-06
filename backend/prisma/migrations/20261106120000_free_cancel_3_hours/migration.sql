-- Free cancellation ends 3 hours before class (a 17:00 class: free until 13:59).
ALTER TABLE "studio_settings" ALTER COLUMN "free_cancel_hours" SET DEFAULT 3;

-- hand-written: a studio still on the old default of 12 moves to 3; a value
-- the studio chose itself is left alone.
UPDATE "studio_settings" SET "free_cancel_hours" = 3 WHERE "free_cancel_hours" = 12;
