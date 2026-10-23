#!/usr/bin/env node
// One-time backfill: create Term / Schedule / Section rows from each course's legacy
// GitHub `course.json` schedule.files, and assign existing enrollments to a section.
//
// This is NOT run by the app. It reads PUBLIC course.json (no GitHub token) and writes to
// Supabase with the SERVICE-ROLE key (bypasses RLS for the bulk write). It is idempotent:
// schedules/sections are keyed on (catalogId, legacyFileId); enrollment.sectionId is only set
// when currently null. Re-running after a successful run performs zero writes.
//
// -----------------------------------------------------------------------------------------------
// REQUIRED Supabase connection values (pass as flags, or set the matching environment variable):
//
//   --supabase-url <url>        Your project's API URL (a.k.a. "Project URL").
//                               Find it: Supabase dashboard -> Project Settings -> Data API ->
//                               "Project URL". It looks like https://<project-ref>.supabase.co
//                               Env fallback: SUPABASE_URL
//
//   --service-role-key <key>    The `service_role` SECRET API key (NOT the `anon` key). It bypasses
//                               Row Level Security so the backfill can read/write across all courses.
//                               Find it: Supabase dashboard -> Project Settings -> API Keys ->
//                               "service_role" -> Reveal/Copy. Treat it like a password.
//                               Env fallback: SUPABASE_SERVICE_ROLE_KEY
//
// OPTIONS:
//   --dry-run                   Log intended writes; change nothing. Run this first.
//   --catalog <id>              Restrict to a single catalog (course) id.
//   --help, -h                  Print this usage.
//
// SECURITY: the service_role key is a powerful secret. Prefer the environment variable — a value
// passed on the command line can be saved in your shell history and seen in the process list.
//
// EXAMPLES:
//   # env vars (recommended)
//   SUPABASE_URL=https://abc.supabase.co SUPABASE_SERVICE_ROLE_KEY="$KEY" \
//     node install/migrations/backfill-sections.mjs --dry-run
//
//   # flags
//   node install/migrations/backfill-sections.mjs \
//     --supabase-url https://abc.supabase.co --service-role-key "$KEY" --dry-run
//
// Apply the schema delta (new term/schedule/section tables + enrollment.sectionId) BEFORE running.
// -----------------------------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';
import { resolveEnrollmentSection } from '../../src/utils/sectionMigration.js';

const args = process.argv.slice(2);

function flagValue(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

const USAGE = [
  'Usage: node install/migrations/backfill-sections.mjs [options]',
  '',
  'Required (flag or environment variable):',
  '  --supabase-url <url>       Project URL   (env SUPABASE_URL)',
  '                            Supabase dashboard -> Project Settings -> Data API -> Project URL',
  '  --service-role-key <key>  service_role secret key   (env SUPABASE_SERVICE_ROLE_KEY)',
  '                            Supabase dashboard -> Project Settings -> API Keys -> service_role',
  '',
  'Options:',
  '  --dry-run                 Log intended writes; change nothing (run this first)',
  '  --catalog <id>            Restrict to a single catalog (course) id',
  '  --help, -h                Print this usage',
].join('\n');

if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const DRY_RUN = args.includes('--dry-run');
const catalogFilter = flagValue('--catalog');

const SUPABASE_URL = flagValue('--supabase-url') || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = flagValue('--service-role-key') || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  const missing = [!SUPABASE_URL && 'Supabase URL', !SERVICE_ROLE_KEY && 'service_role key'].filter(Boolean).join(' and ');
  console.error(`Missing ${missing}.\n`);
  console.error('Pass --supabase-url <url> and --service-role-key <key>, or set the SUPABASE_URL and');
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variables.\n');
  console.error(USAGE);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function rawUrlFor(gitHub) {
  if (!gitHub || !gitHub.account || !gitHub.repository) return null;
  return `https://raw.githubusercontent.com/${gitHub.account}/${gitHub.repository}/main`;
}

function resolveContentPath(rawUrl, file) {
  const path = file.path || file.repoPath || '';
  if (!path) return null;
  return path.startsWith('http') ? path : `${rawUrl}/${path.replace(/^\//, '')}`;
}

// Min/max over ISO (YYYY-MM-DD) date strings; returns null when none present.
function dateBounds(files) {
  const starts = files.map((f) => f.startDate).filter(Boolean).sort();
  const ends = files.map((f) => f.endDate).filter(Boolean).sort();
  return { startDate: starts[0] || null, endDate: ends.length ? ends[ends.length - 1] : null };
}

async function fetchCourseJson(rawUrl) {
  const res = await fetch(`${rawUrl}/course.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`course.json HTTP ${res.status}`);
  return res.json();
}

// Idempotent "find row for this course+legacyFile, else insert". Returns the row id.
async function ensureRow(table, catalogId, legacyFileId, insertValues) {
  const { data: existing, error: selErr } = await supabase
    .from(table)
    .select('id')
    .eq('catalogId', catalogId)
    .eq('legacyFileId', legacyFileId)
    .limit(1);
  if (selErr) throw new Error(`${table} select failed: ${selErr.message}`);
  if (existing && existing.length) return existing[0].id;

  if (DRY_RUN) return `(dry-run:${table})`;
  const { data: inserted, error: insErr } = await supabase.from(table).insert(insertValues).select('id').single();
  if (insErr) throw new Error(`${table} insert failed: ${insErr.message}`);
  return inserted.id;
}

async function ensureTerm(catalogId, bounds) {
  const { data: existing, error: selErr } = await supabase
    .from('term')
    .select('id')
    .eq('catalogId', catalogId)
    .limit(1);
  if (selErr) throw new Error(`term select failed: ${selErr.message}`);
  if (existing && existing.length) return existing[0].id;

  if (DRY_RUN) return '(dry-run:term)';
  const { data: inserted, error: insErr } = await supabase
    .from('term')
    .insert({ catalogId, title: 'Migrated term', startDate: bounds.startDate, endDate: bounds.endDate })
    .select('id')
    .single();
  if (insErr) throw new Error(`term insert failed: ${insErr.message}`);
  return inserted.id;
}

async function backfillCatalog(catalog) {
  const summary = { catalogId: catalog.id, files: 0, sections: 0, assigned: 0, left: 0, skipped: null };

  const rawUrl = rawUrlFor(catalog.gitHub);
  if (!rawUrl) {
    summary.skipped = 'no gitHub account/repository';
    return summary;
  }

  let courseJson;
  try {
    courseJson = await fetchCourseJson(rawUrl);
  } catch (e) {
    summary.skipped = `course.json unavailable (${e.message})`;
    return summary;
  }

  const files = Array.isArray(courseJson?.schedule?.files) ? courseJson.schedule.files.filter((f) => f && f.path) : [];
  if (files.length === 0) {
    summary.skipped = 'no schedule files';
    return summary;
  }
  summary.files = files.length;

  const termId = await ensureTerm(catalog.id, dateBounds(files));

  const sections = [];
  for (const file of files) {
    const legacyFileId = file.id;
    if (!legacyFileId) continue;
    const scheduleId = await ensureRow('schedule', catalog.id, legacyFileId, {
      catalogId: catalog.id,
      termId,
      title: file.title || 'Schedule',
      state: file.state || 'published',
      startDate: file.startDate || null,
      endDate: file.endDate || null,
      contentPath: resolveContentPath(rawUrl, file),
      legacyFileId,
    });
    const sectionId = await ensureRow('section', catalog.id, legacyFileId, {
      catalogId: catalog.id,
      termId,
      scheduleId: DRY_RUN ? null : scheduleId,
      title: file.title || 'Section',
      state: 'active',
      legacyFileId,
    });
    sections.push({ id: sectionId, legacyFileId });
  }
  summary.sections = sections.length;

  const defaultFile = files.find((f) => f.default) || files[0];
  const defaultFileId = defaultFile ? defaultFile.id : null;

  const { data: enrollments, error: enrErr } = await supabase
    .from('enrollment')
    .select('id, settings, sectionId')
    .eq('catalogId', catalog.id);
  if (enrErr) throw new Error(`enrollment select failed: ${enrErr.message}`);

  for (const enr of enrollments || []) {
    if (enr.sectionId) continue; // never overwrite an assignment
    const selectedFileId = enr.settings?.selectedScheduleFile;
    const sectionId = resolveEnrollmentSection(selectedFileId, sections, defaultFileId);
    if (!sectionId) {
      summary.left += 1;
      continue;
    }
    if (!DRY_RUN) {
      const { error: updErr } = await supabase
        .from('enrollment')
        .update({ sectionId })
        .eq('id', enr.id)
        .is('sectionId', null); // guard: only set when still null
      if (updErr) throw new Error(`enrollment ${enr.id} update failed: ${updErr.message}`);
    }
    summary.assigned += 1;
  }

  return summary;
}

async function main() {
  console.log(`Section backfill ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE)'}${catalogFilter ? ` — catalog ${catalogFilter}` : ''}`);

  let query = supabase.from('catalog').select('id, gitHub');
  if (catalogFilter) query = query.eq('id', catalogFilter);
  const { data: catalogs, error } = await query;
  if (error) {
    console.error(`Failed to load catalogs: ${error.message}`);
    process.exit(1);
  }

  const totals = { files: 0, sections: 0, assigned: 0, left: 0, skipped: 0, failed: 0 };
  for (const catalog of catalogs || []) {
    try {
      const s = await backfillCatalog(catalog);
      totals.files += s.files;
      totals.sections += s.sections;
      totals.assigned += s.assigned;
      totals.left += s.left;
      if (s.skipped) totals.skipped += 1;
      const tail = s.skipped ? `skipped: ${s.skipped}` : `files=${s.files} sections=${s.sections} assigned=${s.assigned} left-null=${s.left}`;
      console.log(`  ${catalog.id}: ${tail}`);
    } catch (e) {
      totals.failed += 1;
      console.error(`  ${catalog.id}: FAILED — ${e.message}`);
    }
  }

  console.log(
    `Done. catalogs=${(catalogs || []).length} skipped=${totals.skipped} failed=${totals.failed} | ` +
      `files=${totals.files} sections=${totals.sections} enrollments-assigned=${totals.assigned} left-null=${totals.left}`
  );
  if (totals.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
