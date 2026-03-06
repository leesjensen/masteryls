#!/usr/bin/env node

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const DEFAULT_API = 'https://api.supabase.com';
const DEFAULT_REGION = 'us-east-1';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA_PATH = join(SCRIPT_DIR, 'schema.sql');
const DEFAULT_POLICIES_PATH = join(SCRIPT_DIR, 'policies.sql');
const SUPABASE_FUNCTIONS_PATH = join(SCRIPT_DIR, 'supabase', 'functions');

// Parses CLI flags in the form: --key value
function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

// Ensures required flags are present before running any API calls.
function requireArgs(parsed, requiredKeys) {
  const missing = requiredKeys.filter((key) => !parsed[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required arguments: ${missing.map((name) => `--${name}`).join(', ')}`);
  }
}

// Normalizes API URL so path joins are consistent.
function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// CLI help text with required and optional flags.
function usage() {
  return `Usage:
  node applicationDocs/initproject.js 
    --token "$SUPABASE_TOKEN" 
    --org "orgslug" 
    --project "mastery-ls-byu" 
    --password "supersecret" 
    --api "https://api.supabase.com"

Optional:
  --region "${DEFAULT_REGION}"
  --schema "${DEFAULT_SCHEMA_PATH}"
  --policies "${DEFAULT_POLICIES_PATH}"
  --secrets "KEY1=value1,KEY2=value2"
`;
}

// Safely parse JSON API responses and preserve raw text if parsing fails.
async function safeJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Shared Supabase Management API request helper.
async function apiRequest({ baseUrl, path, accessToken, method = 'GET', body }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    const message = payload?.message || payload?.error || JSON.stringify(payload) || response.statusText;
    throw new Error(`Supabase API ${method} ${path} failed (${response.status}): ${message}`);
  }
  return payload;
}

// Lists projects for an organization (supports both known query param styles).
async function listProjects({ baseUrl, accessToken, organizationId }) {
  const attempts = [`/v1/projects?org_id=${encodeURIComponent(organizationId)}`, `/v1/projects?organization_id=${encodeURIComponent(organizationId)}`];

  for (const path of attempts) {
    try {
      const result = await apiRequest({ baseUrl, path, accessToken });
      if (Array.isArray(result)) {
        return result;
      }
    } catch {}
  }

  throw new Error('Unable to list projects for the provided organization.');
}

// Finds an existing project by exact name.
async function findProjectByName({ baseUrl, accessToken, organizationId, projectName }) {
  const projects = await listProjects({ baseUrl, accessToken, organizationId });
  return projects.find((project) => project.name === projectName) ?? null;
}

// Creates a new Supabase project when one does not already exist.
async function createProject({ baseUrl, accessToken, organizationId, projectName, region, dbPassword }) {
  const payload = {
    organization_id: organizationId,
    name: projectName,
    region,
    db_pass: dbPassword,
  };

  return apiRequest({
    baseUrl,
    path: '/v1/projects',
    accessToken,
    method: 'POST',
    body: payload,
  });
}

// Fetches latest project status/details by project reference.
async function getProject({ baseUrl, accessToken, projectRef }) {
  return apiRequest({
    baseUrl,
    path: `/v1/projects/${encodeURIComponent(projectRef)}`,
    accessToken,
  });
}

// Handles slight differences in API response naming for project reference.
function extractProjectRef(project) {
  return project?.ref || project?.id || project?.project_ref || null;
}

// Accepts healthy/active project statuses before applying SQL.
function isProjectReady(project) {
  const status = String(project?.status ?? '').toUpperCase();
  return status === 'ACTIVE_HEALTHY' || status === 'ACTIVE' || status === 'HEALTHY';
}

// Polls project status until ready or timeout.
async function waitForProjectReady({ baseUrl, accessToken, projectRef, timeoutMs, intervalMs }) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const project = await getProject({ baseUrl, accessToken, projectRef });
    if (isProjectReady(project)) {
      return project;
    }
    const status = project?.status ?? 'UNKNOWN';
    process.stdout.write(`Project ${projectRef} status: ${status}. Waiting ${intervalMs}ms...\n`);
    await new Promise((resolveWait) => setTimeout(resolveWait, intervalMs));
  }
  throw new Error(`Timed out waiting for project ${projectRef} to become ready.`);
}

// Executes SQL through Supabase Management API.
async function executeSql({ baseUrl, accessToken, projectRef, sql }) {
  return apiRequest({
    baseUrl,
    path: `/v1/projects/${encodeURIComponent(projectRef)}/database/query`,
    accessToken,
    method: 'POST',
    body: { query: sql },
  });
}

// Loads SQL from a path provided on CLI.
async function loadTextFromFile(filePath) {
  const absolutePath = resolve(process.cwd(), filePath);
  return readFile(absolutePath, 'utf8');
}

// Chooses CLI-provided SQL files or built-in defaults.
async function resolveSqlInputs({ schemaPath, policiesPath }) {
  const schemaSql = await loadTextFromFile(schemaPath);
  const policiesSql = await loadTextFromFile(policiesPath);
  return { schemaSql, policiesSql };
}

async function listEdgeFunctionNames() {
  let entries = [];
  try {
    entries = await readdir(SUPABASE_FUNCTIONS_PATH, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const functionNames = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    functionNames.push(entry.name);
  }

  return functionNames;
}

function parseSecretPairs(secretPairsInput) {
  if (!secretPairsInput) {
    return {};
  }

  const entries = secretPairsInput
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) {
        throw new Error(`Invalid secret pair "${pair}". Expected format KEY=value.`);
      }
      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1);
      if (!key) {
        throw new Error(`Invalid secret pair "${pair}". Secret key cannot be empty.`);
      }
      return [key, value];
    });

  return Object.fromEntries(entries);
}

function runSupabaseCli({ args, accessToken }) {
  const result = spawnSync('supabase', args, {
    cwd: SCRIPT_DIR,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
    encoding: 'utf8',
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error('Supabase CLI not found. Install it to deploy edge functions (https://supabase.com/docs/guides/cli).');
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Supabase CLI command failed: supabase ${args.join(' ')}\n${result.stderr || result.stdout || ''}`);
  }

  if (result.stdout) {
    console.log(result.stdout.trim());
  }
}

async function deployEdgeFunction({ projectRef, accessToken, edgeName }) {
  console.log(`Deploying edge function source at ${join(SUPABASE_FUNCTIONS_PATH, edgeName)}`);

  runSupabaseCli({
    accessToken,
    args: ['functions', 'deploy', edgeName, '--project-ref', projectRef],
  });
}

function registerProjectSecrets({ projectRef, accessToken, secrets }) {
  const secretEntries = Object.entries(secrets).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (secretEntries.length === 0) {
    console.log('No secrets to register.');
    return;
  }

  const cliSecretsArgs = secretEntries.map(([key, value]) => `${key}=${value}`);
  runSupabaseCli({
    accessToken,
    args: ['secrets', 'set', ...cliSecretsArgs, '--project-ref', projectRef],
  });

  console.log(`Registered ${secretEntries.length} project secret(s).`);
}

// Main command flow:
// 1) parse/validate args
// 2) find or create project
// 3) wait until project is ready
// 4) apply schema + policies SQL
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(usage());
    process.exit(0);
  }

  requireArgs(args, ['token', 'org', 'project', 'password']);

  const accessToken = args.token;
  const organizationId = args.org;
  const projectName = args.project;
  const dbPassword = args.password;
  const region = args.region || DEFAULT_REGION;
  const schemaPath = args.schema || DEFAULT_SCHEMA_PATH;
  const policiesPath = args.policies || DEFAULT_POLICIES_PATH;
  const secrets = parseSecretPairs(args.secrets);
  const managementApiUrl = normalizeBaseUrl(args.api || DEFAULT_API);

  const waitTimeoutMs = 15 * 60 * 1000;
  const waitIntervalMs = 10 * 1000;

  const { schemaSql, policiesSql } = await resolveSqlInputs({ schemaPath, policiesPath });

  console.log(`Looking up project "${projectName}" in organization "${organizationId}"...`);
  let project = await findProjectByName({
    baseUrl: managementApiUrl,
    accessToken,
    organizationId,
    projectName,
  });

  if (!project) {
    console.log(`Project "${projectName}" not found. Creating it in ${region}...`);
    project = await createProject({
      baseUrl: managementApiUrl,
      accessToken,
      organizationId,
      projectName,
      region,
      dbPassword,
    });
  } else {
    console.log(`Found existing project "${projectName}".`);
  }

  const projectRef = extractProjectRef(project);
  if (!projectRef) {
    throw new Error('Could not determine project reference from API response.');
  }

  console.log(`Waiting for project ${projectRef} to become ready...`);
  await waitForProjectReady({
    baseUrl: managementApiUrl,
    accessToken,
    projectRef,
    timeoutMs: waitTimeoutMs,
    intervalMs: waitIntervalMs,
  });

  console.log('Applying schema SQL...');
  await executeSql({
    baseUrl: managementApiUrl,
    accessToken,
    projectRef,
    sql: schemaSql,
  });

  console.log('Applying policies SQL...');
  await executeSql({
    baseUrl: managementApiUrl,
    accessToken,
    projectRef,
    sql: policiesSql,
  });

  const edgeFunctionNames = await listEdgeFunctionNames();
  if (edgeFunctionNames.length > 0) {
    console.log(`Deploying ${edgeFunctionNames.length} edge function(s): ${edgeFunctionNames.join(', ')}`);
    for (const edgeName of edgeFunctionNames) {
      await deployEdgeFunction({
        projectRef,
        accessToken,
        edgeName,
      });
    }
  }

  registerProjectSecrets({
    projectRef,
    accessToken,
    secrets,
  });

  console.log(`Initialization complete for project ${projectName} (${projectRef}).`);
}

// Global CLI error handler with usage help.
main().catch((error) => {
  console.error(error.message);
  console.error(usage());
  process.exit(1);
});
