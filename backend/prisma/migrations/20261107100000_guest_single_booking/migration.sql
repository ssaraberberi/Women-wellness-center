-- Guest and single-class booking. Additive only: no column is dropped or
-- rewritten, existing rows keep their values.

-- Where a booking came from: the website and guests are told apart.
ALTER TYPE "BookingSource" ADD VALUE IF NOT EXISTS 'MEMBER_WEB';
ALTER TYPE "BookingSource" ADD VALUE IF NOT EXISTS 'GUEST_WEB';
ALTER TYPE "BookingSource" ADD VALUE IF NOT EXISTS 'GUEST_APP';

-- A single class booked without a package owes its price through an order.
ALTER TABLE "orders" ADD COLUMN "booking_id" UUID;
CREATE UNIQUE INDEX "orders_booking_id_key" ON "orders"("booking_id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "class_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Private links to one booking (digest only).
CREATE TABLE "booking_manage_tokens" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_manage_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_manage_tokens_token_hash_key" ON "booking_manage_tokens"("token_hash");
CREATE INDEX "booking_manage_tokens_booking_id_idx" ON "booking_manage_tokens"("booking_id");
ALTER TABLE "booking_manage_tokens" ADD CONSTRAINT "booking_manage_tokens_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "class_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
