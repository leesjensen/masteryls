#!/usr/bin/env node

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const DEFAULT_API = 'https://api.supabase.com';
const DEFAULT_REGION = 'us-east-1';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SUPABASE_PATH = join(SCRIPT_DIR, '..', 'node_modules', '.bin', 'supabase');
const SUPABASE_FUNCTIONS_PATH = join(SCRIPT_DIR, 'supabase', 'functions');
const CONFIRMATION_EMAIL_TEMPLATE_PATH = join(SCRIPT_DIR, 'supabase', 'confirmationEmail.html');

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
  --secrets "CANVAS_API_KEY=value1,GEMINI_API_KEY=value2"

Expected resource file structure:
  supabase/
    schema.sql
    policies.sql
    confirmationEmail.html
    functions/
      canvas/
        index.ts
      gemini/
        index.ts
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
async function getProject({ baseUrl, accessToken, project }) {
  return apiRequest({
    baseUrl,
    path: `/v1/projects/${encodeURIComponent(project.ref)}`,
    accessToken,
  });
}

// Accepts healthy/active project statuses before applying SQL.
function isProjectReady(project) {
  const status = String(project?.status ?? '').toUpperCase();
  return status === 'ACTIVE_HEALTHY' || status === 'ACTIVE' || status === 'HEALTHY';
}

// Polls project status until ready or timeout.
async function waitForProjectReady({ baseUrl, accessToken, project, timeoutMs, intervalMs }) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const projectInfo = await getProject({ baseUrl, accessToken, project });
    if (isProjectReady(projectInfo)) {
      return projectInfo;
    }
    const status = projectInfo?.status ?? 'UNKNOWN';
    process.stdout.write(`Project ${project.ref} status: ${status}. Waiting ${intervalMs}ms...\n`);
    await new Promise((resolveWait) => setTimeout(resolveWait, intervalMs));
  }
  throw new Error(`Timed out waiting for project ${project.ref} to become ready.`);
}

// Executes SQL through Supabase Management API.
async function executeSql({ baseUrl, accessToken, project, sqlPath }) {
  const sql = await loadTextFromFile(sqlPath);

  return apiRequest({
    baseUrl,
    path: `/v1/projects/${encodeURIComponent(project.ref)}/database/query`,
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

async function loadConfirmationEmailTemplate(templatePath) {
  try {
    const template = await loadTextFromFile(templatePath);
    return template.trim();
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function updateConfirmationEmailTemplate({ baseUrl, accessToken, project }) {
  const htmlTemplate = await loadConfirmationEmailTemplate(CONFIRMATION_EMAIL_TEMPLATE_PATH);
  if (htmlTemplate) {
    console.log(`Updating auth confirmation email template from ${CONFIRMATION_EMAIL_TEMPLATE_PATH}...`);

    return apiRequest({
      baseUrl,
      path: `/v1/projects/${encodeURIComponent(project.ref)}/config/auth`,
      accessToken,
      method: 'PATCH',
      body: {
        mailer_autoconfirm: true,
        mailer_subjects_magic_link: 'Sign-in code for MasteryLS',
        mailer_templates_magic_link_content: htmlTemplate,
      },
    });
  }
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
  if (!secretPairsInput) return null;

  const entries = secretPairsInput
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((pair) => {
      const match = pair.match(/^([^=\s]+)=(.*)$/);
      if (!match) {
        throw new Error(`Invalid secret pair "${pair}". Expected format KEY=value.`);
      }
      const [, key, value] = match;
      return [key, value];
    });

  return Object.fromEntries(entries);
}

function runSupabaseCli({ args, accessToken }) {
  const result = spawnSync(SUPABASE_PATH, args, {
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

async function deployEdgeFunction({ project, accessToken, edgeName }) {
  console.log(`Deploying edge function source at ${join(SUPABASE_FUNCTIONS_PATH, edgeName)}`);

  runSupabaseCli({
    accessToken,
    args: ['functions', 'deploy', edgeName, '--project-ref', project.ref],
  });
}

function registerProjectSecrets({ project, accessToken, secrets }) {
  const secretEntries = Object.entries(secrets).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (secretEntries.length > 0) {
    const cliSecretsArgs = secretEntries.map(([key, value]) => `${key}=${value}`);
    runSupabaseCli({
      accessToken,
      args: ['secrets', 'set', ...cliSecretsArgs, '--project-ref', project.ref],
    });

    console.log(`Registered ${secretEntries.length} project secret(s).`);
  }
}

async function getProjectApiKeys({ baseUrl, accessToken, project }) {
  return apiRequest({
    baseUrl,
    path: `/v1/projects/${encodeURIComponent(project.ref)}/api-keys?reveal=true`,
    accessToken,
  });
}

async function getProjectClientConfig({ baseUrl, accessToken, project }) {
  const [projectInfo, apiKeys] = await Promise.all([getProject({ baseUrl, accessToken, project }), getProjectApiKeys({ baseUrl, accessToken, project })]);

  const publishableKeyEntry = (Array.isArray(apiKeys) ? apiKeys : []).find((key) => key?.type === 'publishable' || String(key?.api_key || '').startsWith('sb_publishable_'));

  const url = projectInfo?.url || projectInfo?.api_url || `https://${project.ref}.supabase.co`;
  const key = publishableKeyEntry?.api_key || null;

  if (!key) {
    throw new Error('Could not retrieve publishable API key from Supabase Management API.');
  }

  return { project, url, key };
}

async function writeRootConfigFile(config) {
  const configPath = join(SCRIPT_DIR, '..', 'config.js');
  const configFileContents = `export default {
  supabase: {
    project: '${config.project.name}',
    url: '${config.url}',
    key: '${config.key}',
  },
};
`;

  await writeFile(configPath, configFileContents, 'utf8');
  console.log(`Wrote Supabase config to ${configPath}`);
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
  const secrets = parseSecretPairs(args.secrets);
  const baseUrl = normalizeBaseUrl(args.api || DEFAULT_API);

  const waitTimeoutMs = 15 * 60 * 1000;
  const waitIntervalMs = 10 * 1000;

  console.log(`Looking up project "${projectName}" in organization "${organizationId}"...`);
  let project = await findProjectByName({
    baseUrl,
    accessToken,
    organizationId,
    projectName,
  });

  if (!project) {
    console.log(`Project "${projectName}" not found. Creating it in ${region}...`);
    project = await createProject({
      baseUrl,
      accessToken,
      organizationId,
      projectName,
      region,
      dbPassword,
    });

    console.log(`Waiting for project ${project.ref} to become ready...`);
    await waitForProjectReady({ baseUrl, accessToken, project, timeoutMs: waitTimeoutMs, intervalMs: waitIntervalMs });

    console.log('Applying schema SQL...');
    await executeSql({ baseUrl, accessToken, project, sqlPath: join(SCRIPT_DIR, 'supabase', 'schema.sql') });

    const edgeFunctionNames = await listEdgeFunctionNames();
    if (edgeFunctionNames.length > 0) {
      console.log(`Deploying ${edgeFunctionNames.length} edge function(s): ${edgeFunctionNames.join(', ')}`);
      for (const edgeName of edgeFunctionNames) {
        await deployEdgeFunction({ project, accessToken, edgeName });
      }
    }

    if (secrets) {
      registerProjectSecrets({ project, accessToken, secrets });
    }

    await updateConfirmationEmailTemplate({ baseUrl, accessToken, project });
  } else {
    console.log(`Found existing project "${projectName}".`);
  }

  const clientConfig = await getProjectClientConfig({ baseUrl, accessToken, project });
  await writeRootConfigFile(clientConfig);
  console.log(`Initialization complete for project ${projectName} (${project.ref}).`);
}

// Global CLI error handler with usage help.
main().catch((error) => {
  console.error(error.message);
  console.error(usage());
  process.exit(1);
});
