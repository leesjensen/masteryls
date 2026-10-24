-- Migration: section-based attendance (Phase 2). Additive + idempotent.
-- Apply to the hosted Supabase project (SQL editor or psql). Deploy WITH the client release that
-- uses it (the client now opens attendance per section and reads attendance_sessions with a section).
-- Mirrors the statements in install/supabase/schema.sql.
--
-- NOTE: after this is live, attendance is gated by section.attendanceEnabled (the course-level
-- course.settings.attendance flag is gone). Re-enable attendance per section in the attendance admin
-- view for any course that previously used it.

-- ---------- Column ----------

alter table public.attendance
  add column if not exists "sectionId" uuid references public.section(id) on delete set null;

-- ---------- Indexes ----------

-- One open session per SECTION (was: one per course). Legacy null-section sessions are unconstrained.
drop index if exists public."attendanceOneOpenIdx";
create unique index if not exists "attendanceOneOpenSectionIdx" on public.attendance ("sectionId") where "closedAt" is null and "sectionId" is not null;
create index if not exists "attendanceSectionOpenedIdx" on public.attendance ("sectionId", "openedAt");

-- ---------- RPCs ----------

-- Open an attendance session for a specific section (closes any session still open for THAT section).
create or replace function public.open_attendance(p_catalog_id uuid, p_section_id uuid, p_questions jsonb default '[]'::jsonb)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.attendance%rowtype;
begin
  if not public.auth_oversees_course(auth.uid(), p_catalog_id) then
    raise exception 'User is not authorized to take attendance for this course';
  end if;

  update public.attendance
  set "closedAt" = now()
  where "sectionId" = p_section_id
    and "closedAt" is null;

  insert into public.attendance ("catalogId", "sectionId", "createdBy", code, questions)
  values (
    p_catalog_id,
    p_section_id,
    auth.uid(),
    lpad(floor(random() * 10000)::int::text, 4, '0'),
    case when jsonb_typeof(p_questions) = 'array' then p_questions else '[]'::jsonb end
  )
  returning * into v_session;

  return v_session;
end;
$$;
grant execute on function public.open_attendance(uuid, uuid, jsonb) to authenticated;

-- Section-scoped attendance history. p_section_id null returns the whole course (legacy 1-arg
-- behavior); a section id scopes the sessions and the enrolledCount denominator.
drop function if exists public.attendance_sessions(uuid);
create or replace function public.attendance_sessions(p_catalog_id uuid, p_section_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not (
    public.auth_oversees_course(v_user_id, p_catalog_id)
    or exists (select 1 from public.enrollment where "catalogId" = p_catalog_id and "learnerId" = v_user_id)
  ) then
    raise exception 'User is not authorized to view attendance for this course';
  end if;

  return jsonb_build_object(
    'enrolledCount', (select count(*) from public.enrollment where "catalogId" = p_catalog_id and (p_section_id is null or "sectionId" = p_section_id)),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'openedAt', a."openedAt",
        'closedAt', a."closedAt",
        'questions', a.questions,
        'attendeeCount', (
          select count(distinct p."userId")
          from public.progress p
          where p."catalogId" = a."catalogId"
            and p.type = 'attendance'
            and p."interactionId" = a.id
        ),
        'answerTally', (
          select coalesce(jsonb_object_agg(per_q.qid, per_q.counts), '{}'::jsonb)
          from (
            select ans.qid, jsonb_object_agg(ans.answer, ans.c) as counts
            from (
              select kv.key as qid, kv.value as answer, count(*)::int as c
              from public.progress p
              cross join lateral jsonb_each_text(coalesce(p.details -> 'answers', '{}'::jsonb)) as kv(key, value)
              where p."catalogId" = a."catalogId"
                and p.type = 'attendance'
                and p."interactionId" = a.id
              group by kv.key, kv.value
            ) ans
            group by ans.qid
          ) per_q
        )
      ) order by a."openedAt")
      from public.attendance a
      where a."catalogId" = p_catalog_id
        and (p_section_id is null or a."sectionId" = p_section_id)
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.attendance_sessions(uuid, uuid) to authenticated;
