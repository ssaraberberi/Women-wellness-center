-- Email + password sign-in alongside the emailed code, and password reset by emailed code.
ALTER TYPE "OtpPurpose" ADD VALUE 'RESET';
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
