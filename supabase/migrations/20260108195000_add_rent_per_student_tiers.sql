-- Add tiered per-student rent fees (1 student vs 2+ students)

alter table public.location_rent_fees_per_student
  add column if not exists fee_per_student_one numeric,
  add column if not exists fee_per_student_two_plus numeric;

alter table public.court_rent_fees_per_student
  add column if not exists fee_per_student_one numeric,
  add column if not exists fee_per_student_two_plus numeric;

update public.location_rent_fees_per_student
set fee_per_student_one = coalesce(fee_per_student_one, fee_per_student),
    fee_per_student_two_plus = coalesce(fee_per_student_two_plus, fee_per_student)
where fee_per_student is not null;

update public.court_rent_fees_per_student
set fee_per_student_one = coalesce(fee_per_student_one, fee_per_student),
    fee_per_student_two_plus = coalesce(fee_per_student_two_plus, fee_per_student)
where fee_per_student is not null;

alter table public.location_rent_fees_per_student
  add constraint location_rent_fees_per_student_fee_one_nonneg check (fee_per_student_one is null or fee_per_student_one >= 0),
  add constraint location_rent_fees_per_student_fee_two_nonneg check (fee_per_student_two_plus is null or fee_per_student_two_plus >= 0);

alter table public.court_rent_fees_per_student
  add constraint court_rent_fees_per_student_fee_one_nonneg check (fee_per_student_one is null or fee_per_student_one >= 0),
  add constraint court_rent_fees_per_student_fee_two_nonneg check (fee_per_student_two_plus is null or fee_per_student_two_plus >= 0);
