-- A class has 5 places unless someone says otherwise.
ALTER TABLE "class_types" ALTER COLUMN "default_capacity" SET DEFAULT 5;
ALTER TABLE "studio_settings" ALTER COLUMN "default_class_capacity" SET DEFAULT 5;

-- hand-written: values still on the old default of 8 move to 5. A value the
-- studio chose itself is left alone, and classes already on the timetable
-- keep the places they have.
UPDATE "class_types" SET "default_capacity" = 5 WHERE "default_capacity" = 8;
UPDATE "studio_settings" SET "default_class_capacity" = 5 WHERE "default_class_capacity" = 8;
