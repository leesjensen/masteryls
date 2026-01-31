# MasteryLS Database Technology

## Schema

![Database schema](databaseSchema.png)

## Topic

Full content of every topic. Used for free text search. This is a cache of the content that is stored in GitHub and is updated whenever a topic is committed to GitHub.

### Create table

```postgres
create table topic (
  id uuid primary key,
  content text not null,
  ftsContent tsvector generated always as (to_tsvector('english', ' ' || content)) stored,
  updatedAt timestamp with time zone default now()
);
create index topicFtsIdx on topic using gin (ftsContent);

create or replace function updateModifiedColumn()
returns trigger as $$
begin
    new.updatedAt = now();
    return new;
end;
$$ language 'plpgsql';

create trigger updateTopicModtime
    before update on topic
    for each row
    execute procedure updateModifiedColumn();
```

```postgres
alter table public.topic enable row level security;

create policy "User read all"
on public.topic
for select       -- Restrict to Read-only
to authenticated -- Only logged-in users
using (true);    -- No specific row filters, allow all row

CREATE POLICY "Root manages all"
ON public.topic
FOR ALL
TO authenticated
USING (public.auth_is_root(auth.uid()))
WITH CHECK (public.auth_is_root(auth.uid()));
```

### Insert

```js
const { data, error } = await supabase.from('topic').insert([
  {
    id: 'your-provided-uuid-here',
    body: 'In this lesson, we learn about tables...',
  },
]);
```

### Query

```js
const { data, error } = await supabase.from('topic').select('id, updatedAt').textSearch('ftsContent', 'we learn');
```

### Update

```js
const { data, error } = await supabase.from('topic').update({ content: 'Updated instructional content.' }).eq('id', 'your-provided-uuid-here');
```

## Catalog

Everyone can read the catalog including unauthenticated users so that they can view courses in **read-only** mode.

```postgres
CREATE policy "User read all"
on "public"."catalog"
FOR ALL
TO public
using (
  true
);
```

## User

Let a user manage their own user record so that they can register, login, and update settings

```postgres
CREATE policy "User manage self"
on "public"."user"
FOR ALL
TO public
using (
  (auth.uid() = id)
)
with check (
  (auth.uid() = id)
);
```

## Enrollment

Let a user manage their own enrollment record so that they can join, drop, and update settings

```postgres
CREATE policy "User manage self"
on "public"."enrollment"
FOR ALL
TO public
using (
  (auth.uid() = "learnerId")
)
with check (
  (auth.uid() = "learnerId")
);
```

## Progress

```postgres
CREATE POLICY "Allow users to insert their own progress"
ON "public"."progress"
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = "userId");
```

```postgres
CREATE POLICY "Allow users to read their own progress"
ON "public"."progress"
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = "userId");
```

## Roles

Allow user to read their own roles

```postgres
CREATE POLICY "User read self"
  ON public.role
  FOR SELECT
  TO public
  USING (
  ("user" = auth.uid())
  );
```

### Role based access

Create a function that validates a user is root. You can then call this in RLS policies

```postgres
CREATE OR REPLACE FUNCTION public.auth_is_root(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role
    WHERE "user" = uid
      AND "right" = 'root'
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_root(uuid) TO anon, authenticated;
```

Create a policy on each table that allows root to manage everything

```postgres
CREATE POLICY "Root manages all"
ON public.catalog
FOR ALL
TO public
USING (public.auth_is_root(auth.uid()))
WITH CHECK (public.auth_is_root(auth.uid()));
```

You can allow update for specific columns by restricting the update with a GRANT

```postgres
DROP POLICY IF EXISTS "update-own-rows" ON public.role;
CREATE POLICY "update-own-rows"
  ON public.role
  FOR UPDATE
  USING (user = auth.uid())
  WITH CHECK (user = auth.uid());

REVOKE ALL PRIVILEGES ON public.role FROM authenticated;

GRANT SELECT ON public.role TO authenticated;
GRANT INSERT ON public.role TO authenticated;
GRANT DELETE ON public.role TO authenticated;
GRANT UPDATE (settings) ON public.role TO authenticated;
```
