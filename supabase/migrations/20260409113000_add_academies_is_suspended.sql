ALTER TABLE "public"."academies"
ADD COLUMN IF NOT EXISTS "is_suspended" boolean NOT NULL DEFAULT false;
