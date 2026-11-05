-- Sign in with Apple: Apple's stable user id, one account per Apple ID.
ALTER TABLE "users" ADD COLUMN "apple_sub" TEXT;
CREATE UNIQUE INDEX "users_apple_sub_key" ON "users"("apple_sub");
