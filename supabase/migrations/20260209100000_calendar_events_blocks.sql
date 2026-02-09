CREATE TABLE IF NOT EXISTS "public"."calendar_manual_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "court_id" "uuid",
    "coach_id" "uuid",
    "title" "text" NOT NULL,
    "notes" "text",
    "starts_at" "timestamptz" NOT NULL,
    "ends_at" "timestamptz" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" "timestamptz" DEFAULT "now"() NOT NULL,
    "updated_at" "timestamptz" DEFAULT "now"() NOT NULL,
    CONSTRAINT "calendar_manual_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "calendar_manual_events_ends_after_starts" CHECK (("ends_at" > "starts_at"))
);

ALTER TABLE "public"."calendar_manual_events" OWNER TO "postgres";

ALTER TABLE ONLY "public"."calendar_manual_events"
    ADD CONSTRAINT "calendar_manual_events_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."calendar_manual_events"
    ADD CONSTRAINT "calendar_manual_events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."calendar_manual_events"
    ADD CONSTRAINT "calendar_manual_events_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."calendar_manual_events"
    ADD CONSTRAINT "calendar_manual_events_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "calendar_manual_events_academy_starts_at_idx" ON "public"."calendar_manual_events" USING btree ("academy_id", "starts_at");
CREATE INDEX IF NOT EXISTS "calendar_manual_events_academy_ends_at_idx" ON "public"."calendar_manual_events" USING btree ("academy_id", "ends_at");


CREATE TABLE IF NOT EXISTS "public"."calendar_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "court_id" "uuid",
    "coach_id" "uuid",
    "reason" "text",
    "kind" "text" DEFAULT 'block'::"text" NOT NULL,
    "starts_at" "timestamptz" NOT NULL,
    "ends_at" "timestamptz" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" "timestamptz" DEFAULT "now"() NOT NULL,
    "updated_at" "timestamptz" DEFAULT "now"() NOT NULL,
    CONSTRAINT "calendar_blocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "calendar_blocks_ends_after_starts" CHECK (("ends_at" > "starts_at"))
);

ALTER TABLE "public"."calendar_blocks" OWNER TO "postgres";

ALTER TABLE ONLY "public"."calendar_blocks"
    ADD CONSTRAINT "calendar_blocks_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."calendar_blocks"
    ADD CONSTRAINT "calendar_blocks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."calendar_blocks"
    ADD CONSTRAINT "calendar_blocks_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."calendar_blocks"
    ADD CONSTRAINT "calendar_blocks_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "calendar_blocks_academy_starts_at_idx" ON "public"."calendar_blocks" USING btree ("academy_id", "starts_at");
CREATE INDEX IF NOT EXISTS "calendar_blocks_academy_ends_at_idx" ON "public"."calendar_blocks" USING btree ("academy_id", "ends_at");
CREATE INDEX IF NOT EXISTS "calendar_blocks_kind_idx" ON "public"."calendar_blocks" USING btree ("kind");


ALTER TABLE "public"."calendar_manual_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."calendar_blocks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_manual_events select by role" ON "public"."calendar_manual_events" FOR SELECT USING (
  (EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'::"public"."app_role"
  ))
  OR
  (EXISTS (
    SELECT 1 FROM "public"."user_academies" ua
    WHERE ua.user_id = auth.uid() AND ua.academy_id = calendar_manual_events.academy_id
  ))
);

CREATE POLICY "calendar_blocks select by role" ON "public"."calendar_blocks" FOR SELECT USING (
  (EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.id = auth.uid() AND p.role = 'super_admin'::"public"."app_role"
  ))
  OR
  (EXISTS (
    SELECT 1 FROM "public"."user_academies" ua
    WHERE ua.user_id = auth.uid() AND ua.academy_id = calendar_blocks.academy_id
  ))
);

CREATE POLICY "calendar_manual_events insert admin/coach" ON "public"."calendar_manual_events" FOR INSERT WITH CHECK (
  (EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])
  ))
  AND
  (
    (EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'::"public"."app_role"
    ))
    OR
    (EXISTS (
      SELECT 1 FROM "public"."user_academies" ua
      WHERE ua.user_id = auth.uid() AND ua.academy_id = calendar_manual_events.academy_id
    ))
  )
);

CREATE POLICY "calendar_blocks insert admin/coach" ON "public"."calendar_blocks" FOR INSERT WITH CHECK (
  (EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])
  ))
  AND
  (
    (EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'::"public"."app_role"
    ))
    OR
    (EXISTS (
      SELECT 1 FROM "public"."user_academies" ua
      WHERE ua.user_id = auth.uid() AND ua.academy_id = calendar_blocks.academy_id
    ))
  )
);

CREATE POLICY "calendar_manual_events update admin/coach" ON "public"."calendar_manual_events" FOR UPDATE TO "authenticated" USING (
  (EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])
  ))
  AND
  (
    (EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'::"public"."app_role"
    ))
    OR
    (EXISTS (
      SELECT 1 FROM "public"."user_academies" ua
      WHERE ua.user_id = auth.uid() AND ua.academy_id = calendar_manual_events.academy_id
    ))
  )
) WITH CHECK (
  (EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])
  ))
  AND
  (
    (EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'::"public"."app_role"
    ))
    OR
    (EXISTS (
      SELECT 1 FROM "public"."user_academies" ua
      WHERE ua.user_id = auth.uid() AND ua.academy_id = calendar_manual_events.academy_id
    ))
  )
);

CREATE POLICY "calendar_blocks update admin/coach" ON "public"."calendar_blocks" FOR UPDATE TO "authenticated" USING (
  (EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])
  ))
  AND
  (
    (EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'::"public"."app_role"
    ))
    OR
    (EXISTS (
      SELECT 1 FROM "public"."user_academies" ua
      WHERE ua.user_id = auth.uid() AND ua.academy_id = calendar_blocks.academy_id
    ))
  )
) WITH CHECK (
  (EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])
  ))
  AND
  (
    (EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'::"public"."app_role"
    ))
    OR
    (EXISTS (
      SELECT 1 FROM "public"."user_academies" ua
      WHERE ua.user_id = auth.uid() AND ua.academy_id = calendar_blocks.academy_id
    ))
  )
);

CREATE POLICY "calendar_manual_events delete admin/coach" ON "public"."calendar_manual_events" FOR DELETE USING (
  (EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])
  ))
  AND
  (
    (EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'::"public"."app_role"
    ))
    OR
    (EXISTS (
      SELECT 1 FROM "public"."user_academies" ua
      WHERE ua.user_id = auth.uid() AND ua.academy_id = calendar_manual_events.academy_id
    ))
  )
);

CREATE POLICY "calendar_blocks delete admin/coach" ON "public"."calendar_blocks" FOR DELETE USING (
  (EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::"public"."app_role", 'coach'::"public"."app_role", 'super_admin'::"public"."app_role"])
  ))
  AND
  (
    (EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'::"public"."app_role"
    ))
    OR
    (EXISTS (
      SELECT 1 FROM "public"."user_academies" ua
      WHERE ua.user_id = auth.uid() AND ua.academy_id = calendar_blocks.academy_id
    ))
  )
);

GRANT ALL ON TABLE "public"."calendar_manual_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_manual_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_manual_events" TO "service_role";

GRANT ALL ON TABLE "public"."calendar_blocks" TO "anon";
GRANT ALL ON TABLE "public"."calendar_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_blocks" TO "service_role";
