-- Run in the Supabase SQL Editor to support learner feedback pulses.

alter table public.pulse
  add column if not exists "pulseType" text not null default 'pulse'
  check ("pulseType" in ('pulse', 'feedback'));

create or replace function public.next_pulse_number(
  p_catalog_id uuid,
  p_term_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_enrollment_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  if not exists (select 1 from public.term where id = p_term_id and "catalogId" = p_catalog_id) then
    raise exception 'Term does not belong to this course';
  end if;
  if p_target_type = 'course' then
    if p_target_id <> p_catalog_id or not public.auth_manages_course(auth.uid(), p_catalog_id) then raise exception 'Not authorized'; end if;
  elsif p_target_type = 'section' then
    if not exists (select 1 from public.section where id = p_target_id and "catalogId" = p_catalog_id and "termId" = p_term_id)
       or not public.auth_manages_course(auth.uid(), p_catalog_id) then raise exception 'Not authorized'; end if;
  elsif p_target_type = 'learner' then
    if p_enrollment_id is null or not exists (select 1 from public.enrollment where id = p_enrollment_id and "catalogId" = p_catalog_id and "learnerId" = p_target_id) then
      raise exception 'Learner enrollment does not match this course';
    end if;
    if p_target_id <> auth.uid() and not public.auth_oversees_course(auth.uid(), p_catalog_id) then raise exception 'Not authorized'; end if;
  else
    raise exception 'Invalid pulse target type';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_catalog_id::text || p_term_id::text || p_target_type || p_target_id::text, 0));
  select coalesce(max("pulseNumber"), 0) + 1 into next_number
  from public.pulse
  where "catalogId" = p_catalog_id and "termId" = p_term_id and "targetType" = p_target_type and "targetId" = p_target_id;
  return next_number;
end;
$$;

grant execute on function public.next_pulse_number(uuid, uuid, text, uuid, uuid) to authenticated;

drop policy if exists "Pulse readers" on public.pulse;
create policy "Pulse readers" on public.pulse for select to authenticated using (
  public.auth_manages_course(auth.uid(), "catalogId")
  or ("targetType" = 'learner' and public.auth_oversees_course(auth.uid(), "catalogId"))
  or ("targetType" = 'learner' and exists (
    select 1 from public.enrollment e
    where e.id = "enrollmentId" and e."learnerId" = auth.uid()
  ))
);

drop policy if exists "Pulse creators" on public.pulse;
create policy "Pulse creators" on public.pulse for insert to authenticated with check (
  "createdBy" = auth.uid() and (
    public.auth_manages_course(auth.uid(), "catalogId")
    or ("targetType" = 'learner' and public.auth_oversees_course(auth.uid(), "catalogId"))
    or ("targetType" = 'learner' and exists (
      select 1 from public.enrollment e
      where e.id = "enrollmentId"
        and e."catalogId" = "catalogId"
        and e."learnerId" = auth.uid()
        and e."learnerId" = "targetId"
    ))
  )
);

notify pgrst, 'reload schema';
