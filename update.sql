-- MasteryLS — learner note deletion.
-- Run this in the Supabase SQL editor so a learner can delete their own notes.
-- Idempotent (drop-then-create); already committed to install/supabase/schema.sql.

drop policy if exists "Allow users to delete their own notes" on public.progress;

-- A learner may delete only their own NOTE rows (their authored content). Other progress types are an
-- append-only activity/audit trail and stay non-deletable by learners (root still manages all).
create policy "Allow users to delete their own notes"
on public.progress
for delete
to authenticated
using (auth.uid() = "userId" and type = 'note');
