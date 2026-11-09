-- Offers (DUO, discounts, bonuses), DUO pairs, bonus credits, and the log of
-- rows brought over from the old website. Additive only: no column is dropped
-- or rewritten, and existing rows keep their values.

-- CreateEnum
CREATE TYPE "OfferKind" AS ENUM ('BUNDLE', 'DISCOUNT', 'BONUS');

-- CreateEnum
CREATE TYPE "BonusTo" AS ENUM ('REFERRER', 'FRIEND', 'BOTH');

-- CreateEnum
CREATE TYPE "BonusWhen" AS ENUM ('BOOKED', 'PAID', 'FRIEND_PAID', 'VISIT');

-- CreateEnum
CREATE TYPE "OfferClaimRole" AS ENUM ('BUYER', 'FRIEND');

-- CreateEnum
CREATE TYPE "OfferClaimStatus" AS ENUM ('CLAIMED', 'PENDING', 'GRANTED', 'VOID');

-- AlterEnum
ALTER TYPE "CreditTxType" ADD VALUE 'BONUS';

-- AlterTable
ALTER TABLE "class_bookings" ADD COLUMN     "pair_id" UUID;

-- AlterTable
ALTER TABLE "membership_products" ADD COLUMN     "persons" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "membership_purchases" ADD COLUMN     "pair_id" UUID,
ADD COLUMN     "together" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "offer_id" UUID;

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "kind" "OfferKind" NOT NULL,
    "title" TEXT NOT NULL,
    "title_en" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "description_en" TEXT,
    "eligibility" TEXT,
    "eligibility_en" TEXT,
    "product_id" UUID,
    "together" BOOLEAN NOT NULL DEFAULT true,
    "discount_pct" INTEGER,
    "starts_on" DATE,
    "ends_on" DATE,
    "max_redemptions" INTEGER,
    "new_clients_only" BOOLEAN NOT NULL DEFAULT false,
    "friend_required" BOOLEAN NOT NULL DEFAULT false,
    "friend_new" BOOLEAN NOT NULL DEFAULT true,
    "bonus_classes" INTEGER NOT NULL DEFAULT 0,
    "bonus_to" "BonusTo" NOT NULL DEFAULT 'BOTH',
    "bonus_when" "BonusWhen" NOT NULL DEFAULT 'FRIEND_PAID',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_products" (
    "offer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,

    CONSTRAINT "offer_products_pkey" PRIMARY KEY ("offer_id","product_id")
);

-- CreateTable
CREATE TABLE "offer_claims" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "order_id" UUID,
    "role" "OfferClaimRole" NOT NULL DEFAULT 'BUYER',
    "status" "OfferClaimStatus" NOT NULL DEFAULT 'CLAIMED',
    "granted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_refs" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "batch" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_refs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offer_claims_offer_id_idx" ON "offer_claims"("offer_id");

-- CreateIndex
CREATE INDEX "offer_claims_client_id_idx" ON "offer_claims"("client_id");

-- CreateIndex
CREATE INDEX "legacy_refs_batch_idx" ON "legacy_refs"("batch");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_refs_source_source_id_target_key" ON "legacy_refs"("source", "source_id", "target");

-- CreateIndex
CREATE INDEX "class_bookings_pair_id_idx" ON "class_bookings"("pair_id");

-- CreateIndex
CREATE INDEX "membership_purchases_pair_id_idx" ON "membership_purchases"("pair_id");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "membership_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_products" ADD CONSTRAINT "offer_products_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_products" ADD CONSTRAINT "offer_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "membership_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_claims" ADD CONSTRAINT "offer_claims_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_claims" ADD CONSTRAINT "offer_claims_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_claims" ADD CONSTRAINT "offer_claims_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Once per person per offer and role, while the claim stands (a cancelled order frees it).
CREATE UNIQUE INDEX "offer_claims_once" ON "offer_claims"("offer_id", "client_id", "role") WHERE "status" <> 'VOID';
