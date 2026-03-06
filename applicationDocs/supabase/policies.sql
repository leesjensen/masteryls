-- Users can manage only their own profile row
drop policy if exists "User manage self" on public."user";
create policy "User manage self"
on public."user"
for all
to public
using (auth.uid() = id)
with check (auth.uid() = id);

-- Editors can read all user profiles
drop policy if exists "Editor reads all users" on public."user";
create policy "Editor reads all users"
on public."user"
for select
to authenticated
using (public.auth_is_editor(auth.uid()));

-- Roots can fully manage user profiles
drop policy if exists "Root manages all" on public."user";
create policy "Root manages all"
on public."user"
for all
to authenticated
using (public.auth_is_root(auth.uid()))
with check (public.auth_is_root(auth.uid()));

-- Users can read their own role rows
drop policy if exists "User read self" on public.role;
create policy "User read self"
on public.role
for select
to public
using ("user" = auth.uid());

-- Roots can fully manage roles
drop policy if exists "Root manages all" on public.role;
create policy "Root manages all"
on public.role
for all
to authenticated
using (public.auth_is_root(auth.uid()))
with check (public.auth_is_root(auth.uid()));

-- Public can read/write catalog rows as documented
drop policy if exists "User read all" on public.catalog;
create policy "User read all"
on public.catalog
for all
to public
using (true)
with check (true);

-- Roots can fully manage catalog
drop policy if exists "Root manages all" on public.catalog;
create policy "Root manages all"
on public.catalog
for all
to public
using (public.auth_is_root(auth.uid()))
with check (public.auth_is_root(auth.uid()));

-- Learners can manage only their own enrollments
drop policy if exists "User manage self" on public.enrollment;
create policy "User manage self"
on public.enrollment
for all
to public
using (auth.uid() = "learnerId")
with check (auth.uid() = "learnerId");

-- Roots can fully manage enrollments
drop policy if exists "Root manages all" on public.enrollment;
create policy "Root manages all"
on public.enrollment
for all
to authenticated
using (public.auth_is_root(auth.uid()))
with check (public.auth_is_root(auth.uid()));

-- Users can insert their own progress records
drop policy if exists "Allow users to insert their own progress" on public.progress;
create policy "Allow users to insert their own progress"
on public.progress
for insert
to authenticated
with check (auth.uid() = "userId");

-- Users can read their own progress records
drop policy if exists "Allow users to read their own progress" on public.progress;
create policy "Allow users to read their own progress"
on public.progress
for select
to authenticated
using (auth.uid() = "userId");

-- Editors can read all progress rows
drop policy if exists "Editor reads all users progress" on public.progress;
create policy "Editor reads all users progress"
on public.progress
for select
to authenticated
using (public.auth_is_editor(auth.uid()));

-- Roots can fully manage progress
drop policy if exists "Root manages all" on public.progress;
create policy "Root manages all"
on public.progress
for all
to authenticated
using (public.auth_is_root(auth.uid()))
with check (public.auth_is_root(auth.uid()));

-- Authenticated users can read topic content
drop policy if exists "User read all" on public.topic;
create policy "User read all"
on public.topic
for select
to authenticated
using (true);

-- Roots can fully manage topics
drop policy if exists "Root manages all" on public.topic;
create policy "Root manages all"
on public.topic
for all
to authenticated
using (public.auth_is_root(auth.uid()))
with check (public.auth_is_root(auth.uid()));
