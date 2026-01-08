


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'coach',
    'student',
    'super_admin'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rent_expenses"("academy_id" "uuid", "from_date" "date", "to_date" "date") RETURNS TABLE("location_id" "uuid", "location_name" "text", "classes_count" integer, "rent_total" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  with academy_courts as (
    select c.id as court_id, c.location_id
    from public.academy_locations al
    join public.courts c on c.location_id = al.location_id
    where al.academy_id = get_rent_expenses.academy_id
  ),
  classes_in_range as (
    select cs.id as class_id,
           cs.court_id,
           cs.date::date as class_day
    from public.class_sessions cs
    join academy_courts ac on ac.court_id = cs.court_id
    where cs.date::date >= get_rent_expenses.from_date
      and cs.date::date <= get_rent_expenses.to_date
      and exists (
        select 1 from public.bookings b where b.class_id = cs.id
      )
  ),
  class_costs as (
    select
      cir.class_id,
      ac.location_id,
      cir.class_day,
      coalesce(
        (
          select crf.fee_per_class
          from public.court_rent_fees crf
          where crf.academy_id = get_rent_expenses.academy_id
            and crf.court_id = cir.court_id
            and crf.valid_from <= cir.class_day
            and (crf.valid_to is null or cir.class_day < crf.valid_to)
          order by crf.valid_from desc
          limit 1
        ),
        (
          select lrf.fee_per_class
          from public.location_rent_fees lrf
          where lrf.academy_id = get_rent_expenses.academy_id
            and lrf.location_id = ac.location_id
            and lrf.valid_from <= cir.class_day
            and (lrf.valid_to is null or cir.class_day < lrf.valid_to)
          order by lrf.valid_from desc
          limit 1
        ),
        0
      ) as rent_fee
    from classes_in_range cir
    join academy_courts ac on ac.court_id = cir.court_id
  )
  select
    cc.location_id,
    l.name as location_name,
    count(*)::int as classes_count,
    sum(cc.rent_fee)::numeric as rent_total
  from class_costs cc
  join public.locations l on l.id = cc.location_id
  group by cc.location_id, l.name
  order by rent_total desc;
$$;


ALTER FUNCTION "public"."get_rent_expenses"("academy_id" "uuid", "from_date" "date", "to_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_of_academy"("aid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_academies ua
    where ua.user_id = auth.uid()
      and ua.academy_id = aid
      and ua.role = 'admin'::app_role
  );
$$;


ALTER FUNCTION "public"."is_admin_of_academy"("aid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rent_mode" "text" DEFAULT 'per_student'::"text" NOT NULL,
    CONSTRAINT "academies_rent_mode_check" CHECK (("rent_mode" = ANY (ARRAY['per_student'::"text", 'per_hour'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."academies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."academy_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid",
    "student_id" "uuid",
    "present" boolean DEFAULT false NOT NULL,
    "marked_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text",
    "payload" "jsonb"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid",
    "student_id" "uuid",
    "status" "text" DEFAULT 'reserved'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "coach_id" "uuid",
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visible_to_student" boolean DEFAULT false NOT NULL,
    "visible_to_coach" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."class_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "type" "text" NOT NULL,
    "capacity" integer DEFAULT 1 NOT NULL,
    "coach_id" "uuid",
    "court_id" "uuid",
    "price_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'PYG'::"text" NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."class_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_academy_fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "fee_per_class" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'PYG'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."coach_academy_fees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "specialty" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."coaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "public"."app_role" DEFAULT 'student'::"public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notifications_enabled" boolean,
    "default_academy_id" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."coach_profiles" AS
 SELECT "c"."id" AS "coach_id",
    "c"."user_id",
    "c"."specialty",
    "p"."full_name"
   FROM ("public"."coaches" "c"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "c"."user_id")));


ALTER VIEW "public"."coach_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_rent_fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "court_id" "uuid" NOT NULL,
    "fee_per_class" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'PYG'::"text" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_to" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "court_rent_fees_fee_nonnegative" CHECK (("fee_per_class" >= (0)::numeric)),
    CONSTRAINT "court_rent_fees_valid_range" CHECK ((("valid_to" IS NULL) OR ("valid_to" > "valid_from")))
);


ALTER TABLE "public"."court_rent_fees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_rent_fees_per_student" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "court_id" "uuid" NOT NULL,
    "fee_per_student" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'PYG'::"text" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_to" "date",
    "time_from" time without time zone NOT NULL,
    "time_to" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crfps_fee_nonnegative" CHECK (("fee_per_student" >= (0)::numeric)),
    CONSTRAINT "crfps_time_range" CHECK (("time_from" < "time_to")),
    CONSTRAINT "crfps_valid_range" CHECK ((("valid_to" IS NULL) OR ("valid_to" > "valid_from")))
);


ALTER TABLE "public"."court_rent_fees_per_student" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location_id" "uuid",
    "name" "text" NOT NULL
);


ALTER TABLE "public"."courts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_rent_fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "fee_per_class" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'PYG'::"text" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_to" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "location_rent_fees_fee_nonnegative" CHECK (("fee_per_class" >= (0)::numeric)),
    CONSTRAINT "location_rent_fees_valid_range" CHECK ((("valid_to" IS NULL) OR ("valid_to" > "valid_from")))
);


ALTER TABLE "public"."location_rent_fees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_rent_fees_per_student" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "fee_per_student" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'PYG'::"text" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_to" "date",
    "time_from" time without time zone NOT NULL,
    "time_to" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lrfps_fee_nonnegative" CHECK (("fee_per_student" >= (0)::numeric)),
    CONSTRAINT "lrfps_time_range" CHECK (("time_from" < "time_to")),
    CONSTRAINT "lrfps_valid_range" CHECK ((("valid_to" IS NULL) OR ("valid_to" > "valid_from")))
);


ALTER TABLE "public"."location_rent_fees_per_student" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "academy_id" "uuid"
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid",
    "student_plan_id" "uuid",
    "student_id" "uuid",
    "event_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "class_id" "uuid",
    "user_id" "uuid",
    "event_date" "date"
);


ALTER TABLE "public"."notification_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "student_plan_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'ARS'::"text" NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "method" "text" NOT NULL,
    "status" "text" DEFAULT 'pagado'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pagado'::"text", 'pendiente'::"text", 'anulado'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_usages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_plan_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plan_usages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "classes_included" integer NOT NULL,
    "price_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'PYG'::"text" NOT NULL,
    "expires_days" integer,
    "academy_id" "uuid" NOT NULL
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "platform" "text" DEFAULT 'web'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "plan_id" "uuid",
    "remaining_classes" integer NOT NULL,
    "purchased_at" timestamp with time zone DEFAULT "now"(),
    "base_price" numeric(10,2),
    "discount_type" "text" DEFAULT 'none'::"text",
    "discount_value" numeric(10,2) DEFAULT 0,
    "final_price" numeric(10,2),
    "academy_id" "uuid",
    CONSTRAINT "student_plans_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['none'::"text", 'percent'::"text", 'amount'::"text"])))
);


ALTER TABLE "public"."student_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "level" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_academies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."user_academies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academies"
    ADD CONSTRAINT "academies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academies"
    ADD CONSTRAINT "academies_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."academy_locations"
    ADD CONSTRAINT "academy_locations_academy_id_location_id_key" UNIQUE ("academy_id", "location_id");



ALTER TABLE ONLY "public"."academy_locations"
    ADD CONSTRAINT "academy_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_notes"
    ADD CONSTRAINT "class_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_academy_fees"
    ADD CONSTRAINT "coach_academy_fees_coach_id_academy_id_key" UNIQUE ("coach_id", "academy_id");



ALTER TABLE ONLY "public"."coach_academy_fees"
    ADD CONSTRAINT "coach_academy_fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."court_rent_fees_per_student"
    ADD CONSTRAINT "court_rent_fees_per_student_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_rent_fees"
    ADD CONSTRAINT "court_rent_fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courts"
    ADD CONSTRAINT "courts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_rent_fees_per_student"
    ADD CONSTRAINT "location_rent_fees_per_student_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_rent_fees"
    ADD CONSTRAINT "location_rent_fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_usages"
    ADD CONSTRAINT "plan_usages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_plans"
    ADD CONSTRAINT "student_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_notes"
    ADD CONSTRAINT "unique_class_student_coach" UNIQUE ("class_id", "student_id", "coach_id");



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "unique_court_datetime" UNIQUE ("court_id", "date");



ALTER TABLE ONLY "public"."user_academies"
    ADD CONSTRAINT "user_academies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_academies"
    ADD CONSTRAINT "user_academies_user_id_academy_id_role_key" UNIQUE ("user_id", "academy_id", "role");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role");



CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_logs_entity_idx" ON "public"."audit_logs" USING "btree" ("entity", "entity_id");



CREATE INDEX "audit_logs_user_idx" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "class_notes_by_class_student" ON "public"."class_notes" USING "btree" ("class_id", "student_id");



CREATE INDEX "idx_coach_academy_fees_academy" ON "public"."coach_academy_fees" USING "btree" ("academy_id");



CREATE INDEX "idx_coach_academy_fees_coach" ON "public"."coach_academy_fees" USING "btree" ("coach_id");



CREATE INDEX "idx_court_rent_fees_academy_court" ON "public"."court_rent_fees" USING "btree" ("academy_id", "court_id");



CREATE INDEX "idx_court_rent_fees_valid_from" ON "public"."court_rent_fees" USING "btree" ("valid_from");



CREATE INDEX "idx_crfps_lookup" ON "public"."court_rent_fees_per_student" USING "btree" ("academy_id", "court_id", "valid_from");



CREATE INDEX "idx_location_rent_fees_academy_location" ON "public"."location_rent_fees" USING "btree" ("academy_id", "location_id");



CREATE INDEX "idx_location_rent_fees_valid_from" ON "public"."location_rent_fees" USING "btree" ("valid_from");



CREATE INDEX "idx_lrfps_lookup" ON "public"."location_rent_fees_per_student" USING "btree" ("academy_id", "location_id", "valid_from");



CREATE UNIQUE INDEX "notification_events_academy_event_date_uidx" ON "public"."notification_events" USING "btree" ("academy_id", "event_type", "event_date");



CREATE UNIQUE INDEX "notification_events_student_class_event_uidx" ON "public"."notification_events" USING "btree" ("student_id", "class_id", "event_type");



CREATE UNIQUE INDEX "notification_events_unique" ON "public"."notification_events" USING "btree" ("student_plan_id", "event_type");



CREATE UNIQUE INDEX "notification_events_user_event_date_uidx" ON "public"."notification_events" USING "btree" ("user_id", "event_type", "event_date");



CREATE INDEX "notifications_user_created_idx" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "notifications_user_unread_idx" ON "public"."notifications" USING "btree" ("user_id") WHERE ("read_at" IS NULL);



CREATE UNIQUE INDEX "plan_usages_unique" ON "public"."plan_usages" USING "btree" ("student_id", "class_id");



CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "public"."push_subscriptions" USING "btree" ("endpoint");



CREATE INDEX "push_subscriptions_user_id_idx" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_court_rent_fees_active" ON "public"."court_rent_fees" USING "btree" ("academy_id", "court_id") WHERE ("valid_to" IS NULL);



CREATE UNIQUE INDEX "uq_crfps_active_timeband" ON "public"."court_rent_fees_per_student" USING "btree" ("academy_id", "court_id", "time_from", "time_to") WHERE ("valid_to" IS NULL);



CREATE UNIQUE INDEX "uq_location_rent_fees_active" ON "public"."location_rent_fees" USING "btree" ("academy_id", "location_id") WHERE ("valid_to" IS NULL);



CREATE UNIQUE INDEX "uq_lrfps_active_timeband" ON "public"."location_rent_fees_per_student" USING "btree" ("academy_id", "location_id", "time_from", "time_to") WHERE ("valid_to" IS NULL);



CREATE OR REPLACE TRIGGER "set_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."academy_locations"
    ADD CONSTRAINT "academy_locations_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academy_locations"
    ADD CONSTRAINT "academy_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."class_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."class_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_notes"
    ADD CONSTRAINT "class_notes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."class_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_notes"
    ADD CONSTRAINT "class_notes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_notes"
    ADD CONSTRAINT "class_notes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id");



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id");



ALTER TABLE ONLY "public"."coach_academy_fees"
    ADD CONSTRAINT "coach_academy_fees_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_academy_fees"
    ADD CONSTRAINT "coach_academy_fees_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."court_rent_fees"
    ADD CONSTRAINT "court_rent_fees_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."court_rent_fees"
    ADD CONSTRAINT "court_rent_fees_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."court_rent_fees_per_student"
    ADD CONSTRAINT "court_rent_fees_per_student_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."court_rent_fees_per_student"
    ADD CONSTRAINT "court_rent_fees_per_student_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courts"
    ADD CONSTRAINT "courts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_rent_fees"
    ADD CONSTRAINT "location_rent_fees_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_rent_fees"
    ADD CONSTRAINT "location_rent_fees_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_rent_fees_per_student"
    ADD CONSTRAINT "location_rent_fees_per_student_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_rent_fees_per_student"
    ADD CONSTRAINT "location_rent_fees_per_student_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_student_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_student_plan_fk" FOREIGN KEY ("student_plan_id") REFERENCES "public"."student_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_usages"
    ADD CONSTRAINT "plan_usages_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."class_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_usages"
    ADD CONSTRAINT "plan_usages_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_usages"
    ADD CONSTRAINT "plan_usages_student_plan_id_fkey" FOREIGN KEY ("student_plan_id") REFERENCES "public"."student_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_default_academy_id_fkey" FOREIGN KEY ("default_academy_id") REFERENCES "public"."academies"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_plans"
    ADD CONSTRAINT "student_plans_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id");



ALTER TABLE ONLY "public"."student_plans"
    ADD CONSTRAINT "student_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."student_plans"
    ADD CONSTRAINT "student_plans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_academies"
    ADD CONSTRAINT "user_academies_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Delete own push subscriptions" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Insert own push subscriptions" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Read own push subscriptions" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."academies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academies delete super_admin" ON "public"."academies" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "academies insert super_admin" ON "public"."academies" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "academies select by role" ON "public"."academies" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_academies" "ua"
  WHERE (("ua"."user_id" = "auth"."uid"()) AND ("ua"."academy_id" = "academies"."id"))))));



CREATE POLICY "academies update super_admin" ON "public"."academies" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



ALTER TABLE "public"."academy_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academy_locations delete super_admin" ON "public"."academy_locations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "academy_locations insert super_admin" ON "public"."academy_locations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "academy_locations select by role" ON "public"."academy_locations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_academies" "ua"
  WHERE (("ua"."user_id" = "auth"."uid"()) AND ("ua"."academy_id" = "academy_locations"."academy_id"))))));



CREATE POLICY "admins can insert payments" ON "public"."payments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "admins can read all class notes" ON "public"."class_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "admins can select payments" ON "public"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "admins can update payments" ON "public"."payments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "admins read user_roles" ON "public"."user_roles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "allow authenticated read basic plan info" ON "public"."plans" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance delete admin/coach" ON "public"."attendance" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "attendance insert admin/coach" ON "public"."attendance" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "attendance select admin/coach" ON "public"."attendance" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "audit insert by authenticated" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "audit select admin/coach" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_notes admin insert" ON "public"."class_notes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ((("p"."role")::"text" = 'admin'::"text") OR (("p"."role")::"text" = 'super_admin'::"text"))))));



CREATE POLICY "class_notes admin select" ON "public"."class_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ((("p"."role")::"text" = 'admin'::"text") OR (("p"."role")::"text" = 'super_admin'::"text"))))));



CREATE POLICY "class_notes admin update" ON "public"."class_notes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ((("p"."role")::"text" = 'admin'::"text") OR (("p"."role")::"text" = 'super_admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ((("p"."role")::"text" = 'admin'::"text") OR (("p"."role")::"text" = 'super_admin'::"text"))))));



CREATE POLICY "class_notes coach insert" ON "public"."class_notes" FOR INSERT WITH CHECK ((("coach_id" IS NOT NULL) AND ("coach_id" = ( SELECT "c"."id"
   FROM "public"."coaches" "c"
  WHERE ("c"."user_id" = "auth"."uid"())
 LIMIT 1))));



CREATE POLICY "class_notes coach select" ON "public"."class_notes" FOR SELECT USING (((("coach_id" IS NOT NULL) AND ("coach_id" = ( SELECT "c"."id"
   FROM "public"."coaches" "c"
  WHERE ("c"."user_id" = "auth"."uid"())
 LIMIT 1))) OR (("coach_id" IS NULL) AND ("visible_to_coach" = true))));



CREATE POLICY "class_notes coach update" ON "public"."class_notes" FOR UPDATE USING ((("coach_id" IS NOT NULL) AND ("coach_id" = ( SELECT "c"."id"
   FROM "public"."coaches" "c"
  WHERE ("c"."user_id" = "auth"."uid"())
 LIMIT 1)))) WITH CHECK ((("coach_id" IS NOT NULL) AND ("coach_id" = ( SELECT "c"."id"
   FROM "public"."coaches" "c"
  WHERE ("c"."user_id" = "auth"."uid"())
 LIMIT 1))));



CREATE POLICY "class_notes student select" ON "public"."class_notes" FOR SELECT USING ((("student_id" = ( SELECT "s"."id"
   FROM "public"."students" "s"
  WHERE ("s"."user_id" = "auth"."uid"())
 LIMIT 1)) AND ("visible_to_student" = true)));



ALTER TABLE "public"."class_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coaches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coaches manage own class notes" ON "public"."class_notes" USING ((EXISTS ( SELECT 1
   FROM ("public"."coaches" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("c"."id" = "class_notes"."coach_id") AND ("c"."user_id" = "p"."id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."coaches" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("c"."id" = "class_notes"."coach_id") AND ("c"."user_id" = "p"."id")))));



ALTER TABLE "public"."courts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "courts delete super_admin" ON "public"."courts" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "courts insert super_admin" ON "public"."courts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "courts update super_admin" ON "public"."courts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "delete class_sessions admin/coach" ON "public"."class_sessions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "insert bookings admin/coach" ON "public"."bookings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "insert class_sessions admin/coach" ON "public"."class_sessions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locations delete super_admin" ON "public"."locations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "locations insert super_admin" ON "public"."locations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "locations select via academies" ON "public"."locations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))) OR (EXISTS ( SELECT 1
   FROM ("public"."academy_locations" "al"
     JOIN "public"."user_academies" "ua" ON (("ua"."academy_id" = "al"."academy_id")))
  WHERE (("al"."location_id" = "locations"."id") AND ("ua"."user_id" = "auth"."uid"()))))));



CREATE POLICY "locations update super_admin" ON "public"."locations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications select own" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications update own" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_usages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_usages admin/coach all" ON "public"."plan_usages" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plans admin/coach all" ON "public"."plans" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read bookings authenticated" ON "public"."bookings" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "read class_sessions" ON "public"."class_sessions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "read coaches" ON "public"."coaches" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "read courts" ON "public"."courts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "read locations" ON "public"."locations" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "read profiles basic" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "read students" ON "public"."students" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."student_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_plans admin/coach all" ON "public"."student_plans" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "students can read own class notes" ON "public"."class_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."students" "s"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("s"."id" = "class_notes"."student_id") AND ("s"."user_id" = "p"."id")))));



CREATE POLICY "students can read their own payments" ON "public"."payments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."students" "s"
  WHERE (("s"."id" = "payments"."student_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "students_can_delete_own_bookings" ON "public"."bookings" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."students" "s"
  WHERE (("s"."id" = "bookings"."student_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "students_can_delete_own_plan_usages" ON "public"."plan_usages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."students" "s"
  WHERE (("s"."id" = "plan_usages"."student_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "students_can_read_own_plan_usages" ON "public"."plan_usages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."students" "s"
  WHERE (("s"."id" = "plan_usages"."student_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "students_can_read_own_plans" ON "public"."student_plans" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."students" "s"
  WHERE (("s"."id" = "student_plans"."student_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "update class_sessions admin/coach" ON "public"."class_sessions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



ALTER TABLE "public"."user_academies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_academies delete super_admin" ON "public"."user_academies" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "user_academies insert super_admin" ON "public"."user_academies" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "user_academies select admin_of_academy" ON "public"."user_academies" FOR SELECT USING ("public"."is_admin_of_academy"("academy_id"));



CREATE POLICY "user_academies select self or super_admin" ON "public"."user_academies" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"public"."app_role")))) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can update own notifications" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_rent_expenses"("academy_id" "uuid", "from_date" "date", "to_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_rent_expenses"("academy_id" "uuid", "from_date" "date", "to_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rent_expenses"("academy_id" "uuid", "from_date" "date", "to_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_of_academy"("aid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_of_academy"("aid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_of_academy"("aid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."academies" TO "anon";
GRANT ALL ON TABLE "public"."academies" TO "authenticated";
GRANT ALL ON TABLE "public"."academies" TO "service_role";



GRANT ALL ON TABLE "public"."academy_locations" TO "anon";
GRANT ALL ON TABLE "public"."academy_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_locations" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."class_notes" TO "anon";
GRANT ALL ON TABLE "public"."class_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."class_notes" TO "service_role";



GRANT ALL ON TABLE "public"."class_sessions" TO "anon";
GRANT ALL ON TABLE "public"."class_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."class_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."coach_academy_fees" TO "anon";
GRANT ALL ON TABLE "public"."coach_academy_fees" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_academy_fees" TO "service_role";



GRANT ALL ON TABLE "public"."coaches" TO "anon";
GRANT ALL ON TABLE "public"."coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."coaches" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."coach_profiles" TO "anon";
GRANT ALL ON TABLE "public"."coach_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."court_rent_fees" TO "anon";
GRANT ALL ON TABLE "public"."court_rent_fees" TO "authenticated";
GRANT ALL ON TABLE "public"."court_rent_fees" TO "service_role";



GRANT ALL ON TABLE "public"."court_rent_fees_per_student" TO "anon";
GRANT ALL ON TABLE "public"."court_rent_fees_per_student" TO "authenticated";
GRANT ALL ON TABLE "public"."court_rent_fees_per_student" TO "service_role";



GRANT ALL ON TABLE "public"."courts" TO "anon";
GRANT ALL ON TABLE "public"."courts" TO "authenticated";
GRANT ALL ON TABLE "public"."courts" TO "service_role";



GRANT ALL ON TABLE "public"."location_rent_fees" TO "anon";
GRANT ALL ON TABLE "public"."location_rent_fees" TO "authenticated";
GRANT ALL ON TABLE "public"."location_rent_fees" TO "service_role";



GRANT ALL ON TABLE "public"."location_rent_fees_per_student" TO "anon";
GRANT ALL ON TABLE "public"."location_rent_fees_per_student" TO "authenticated";
GRANT ALL ON TABLE "public"."location_rent_fees_per_student" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."notification_events" TO "anon";
GRANT ALL ON TABLE "public"."notification_events" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_events" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."plan_usages" TO "anon";
GRANT ALL ON TABLE "public"."plan_usages" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_usages" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."student_plans" TO "anon";
GRANT ALL ON TABLE "public"."student_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."student_plans" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."user_academies" TO "anon";
GRANT ALL ON TABLE "public"."user_academies" TO "authenticated";
GRANT ALL ON TABLE "public"."user_academies" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


