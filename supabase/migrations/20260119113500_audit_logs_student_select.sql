CREATE POLICY "audit select student own" ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'student'::public.app_role
  )
  AND (
    (
      payload ? 'student_id'
      AND (payload->>'student_id') = (
        SELECT s.id::text
        FROM public.students s
        WHERE s.user_id = auth.uid()
        LIMIT 1
      )
    )
    OR (
      payload ? 'students'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(payload->'students') AS sid(val)
        WHERE sid.val = (
          SELECT s.id::text
          FROM public.students s
          WHERE s.user_id = auth.uid()
          LIMIT 1
        )
      )
    )
    OR (
      payload ? 'add_students'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(payload->'add_students') AS sid(val)
        WHERE sid.val = (
          SELECT s.id::text
          FROM public.students s
          WHERE s.user_id = auth.uid()
          LIMIT 1
        )
      )
    )
    OR (
      payload ? 'remove_students'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(payload->'remove_students') AS sid(val)
        WHERE sid.val = (
          SELECT s.id::text
          FROM public.students s
          WHERE s.user_id = auth.uid()
          LIMIT 1
        )
      )
    )
    OR (
      action = 'attendance_update'
      AND payload ? 'attendance'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(payload->'attendance') AS row
        WHERE (row->>'student_id') = (
          SELECT s.id::text
          FROM public.students s
          WHERE s.user_id = auth.uid()
          LIMIT 1
        )
      )
    )
  )
);
