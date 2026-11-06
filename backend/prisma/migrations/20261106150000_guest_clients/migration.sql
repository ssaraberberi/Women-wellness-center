-- The desk can add a participant with just a name (phone and email optional),
-- so a client may have no email until she signs up herself.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
