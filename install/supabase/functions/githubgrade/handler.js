export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_EXTENSIONS = new Set(['md', 'markdown', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'scala', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'swift', 'html', 'htm', 'css', 'scss', 'json', 'yml', 'yaml', 'toml', 'xml', 'txt', 'sh', 'bash', 'zsh', 'sql', 'env', 'dockerfile']);

const EXCLUDED_PATH_FRAGMENTS = ['node_modules/', 'dist/', 'build/', '.git/', '.next/', 'coverage/', '.cache/', 'vendor/'];

const MAX_FILE_BYTES = 500 * 1024;
const MAX_TOTAL_BYTES = 1200 * 1024;
const GEMINI_MODEL = 'gemini-3-flash-preview';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function parseGitHubUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== 'github.com') return null;
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, '');
  if (!owner || !repo) return null;
  return { owner, repo };
}

function getExtension(path) {
  const basename = path.split('/').pop() || '';
  if (basename.toLowerCase() === 'dockerfile') return 'dockerfile';
  const dot = basename.lastIndexOf('.');
  if (dot < 0) return '';
  return basename.slice(dot + 1).toLowerCase();
}

function isAllowedPath(path, size) {
  if (typeof size !== 'number' || size <= 0) return false;
  if (size >= MAX_FILE_BYTES) return false;
  const lower = path.toLowerCase();
  for (const fragment of EXCLUDED_PATH_FRAGMENTS) {
    if (lower.startsWith(fragment) || lower.includes('/' + fragment)) return false;
  }
  return ALLOWED_EXTENSIONS.has(getExtension(path));
}

function buildGeminiPrompt({ title, body, gradingCriteria, owner, repo, branch, files, filesSkipped }) {
  const fileSection = files.map((f) => `## ${f.path}\n${f.content}`).join('\n\n');

  return `You are grading a student's GitHub repository submission. Be a constructive, specific code reviewer.

Title: ${title || '(no title)'}
Instructions to learner:
${body || '(none provided)'}

Grading criteria:
${gradingCriteria}

Repository: ${owner}/${repo} (branch: ${branch})
Files included: ${files.length} (skipped ${filesSkipped} for size or type).

--- BEGIN FILES ---
${fileSection}
--- END FILES ---

Grade the submission against the criteria and write feedback that the student can act on.

Your feedback MUST be markdown-formatted with these sections, in order:

#### Summary
One short paragraph (2-3 sentences) of overall assessment tied to the grading criteria.

### Strengths
Level 4 heading sections (####) for 1-2 specific things from the application code files, not markdown files, that the student did well. For each section:
- Reference a real file path from the included files (e.g. \`src/app.js\`).
- Include a fenced code snippet (≤ 10 lines) quoting the actual code that demonstrates the strength. Use a language hint matching the file extension.
- Briefly explain why it satisfies the criteria.

### Areas to improve
Level 4 heading sections (####) for 4-5 concrete, prioritized recommendations. For each section:
- Reference a real file path from the included files.
- Quote a short snippet (≤ 10 lines) of the code that needs work, OR describe a missing element with the file where it should go.
- Suggest a concrete change. Prefer a one-line recommendation over a full rewrite.

Rules:
- Stay strictly grounded in the provided files. Do NOT invent paths, snippets, or behavior that wasn't shown.
- If a strength or weakness can't be supported by a real snippet, omit that bullet rather than fabricate.
- Total length: 300-700 words.

Respond ONLY with a single JSON object, no markdown fences around the JSON object itself, in this exact shape:
{ "percentCorrect": <integer 0-100>, "feedback": "<the full markdown feedback string>" }

Escape newlines, quotes, and backslashes inside the feedback string so the response is valid JSON.`;
}

function parseGeminiJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, reason: 'empty_response', raw };

  const candidates = [];
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  candidates.push(stripped);
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(stripped.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate);
      const percentNumber = Number(obj?.percentCorrect);
      if (!Number.isFinite(percentNumber)) {
        return { ok: false, reason: 'percent_not_finite', raw, parsed: obj };
      }
      const percent = Math.max(0, Math.min(100, Math.round(percentNumber)));
      const feedback = String(obj?.feedback || '').trim();
      if (!feedback) return { ok: false, reason: 'feedback_empty', raw, parsed: obj };
      return { ok: true, percentCorrect: percent, feedback };
    } catch (error) {
      // try next candidate
      continue;
    }
  }

  return { ok: false, reason: 'json_parse_failed', raw };
}

export function createGithubGradeHandler({ createSupabaseClientFromAuthHeader, getEnv, fetchFn = fetch }) {
  return async function handleGithubGrade(req) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401);

    const supabaseUrl = getEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceRoleKey) return jsonResponse({ error: 'Missing Supabase configuration' }, 500);

    const supabase = createSupabaseClientFromAuthHeader(authHeader);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return jsonResponse({ error: 'Invalid user token' }, 401);

    const geminiKey = getEnv('GEMINI_API_KEY');
    if (!geminiKey) return jsonResponse({ error: 'Missing Gemini configuration' }, 500);

    const payload = await req.json();
    const rawUrl = String(payload?.url || '').trim();
    const title = String(payload?.title || '').trim();
    const body = String(payload?.body || '').trim();
    const gradingCriteria = String(payload?.gradingCriteria || '').trim();

    if (!rawUrl) return jsonResponse({ ok: false, error: 'Please provide a GitHub repository URL.' }, 400);
    if (!gradingCriteria) return jsonResponse({ ok: false, error: 'Grading criteria are required.' }, 400);

    const parsed = parseGitHubUrl(rawUrl);
    if (!parsed) return jsonResponse({ ok: false, error: 'URL must be a GitHub repository like https://github.com/owner/repo.' }, 400);
    const { owner, repo } = parsed;

    const githubHeaders = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'masteryls-githubgrade' };
    const githubToken = getEnv('GITHUB_TOKEN');
    if (githubToken) githubHeaders.Authorization = `Bearer ${githubToken}`;

    let repoResp;
    try {
      repoResp = await fetchFn(`https://api.github.com/repos/${owner}/${repo}`, { headers: githubHeaders });
    } catch {
      return jsonResponse({ ok: false, error: 'Unable to reach GitHub.' }, 200);
    }
    if (repoResp.status === 404 || repoResp.status === 403 || repoResp.status === 401) {
      return jsonResponse({ ok: false, error: 'GitHub repository is not accessible. Confirm it exists and is public.' }, 200);
    }
    if (!repoResp.ok) {
      return jsonResponse({ ok: false, error: `GitHub repository lookup failed (${repoResp.status}).` }, 200);
    }
    const repoData = await repoResp.json();
    const branch = String(repoData?.default_branch || 'main');

    const treeResp = await fetchFn(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: githubHeaders });
    if (!treeResp.ok) {
      return jsonResponse({ ok: false, error: `Unable to read repository tree (${treeResp.status}).` }, 200);
    }
    const treeData = await treeResp.json();
    const entries = Array.isArray(treeData?.tree) ? treeData.tree : [];

    const candidates = entries.filter((e) => e?.type === 'blob' && typeof e?.path === 'string' && isAllowedPath(e.path, e.size)).sort((a, b) => a.size - b.size);

    const totalCandidates = entries.filter((e) => e?.type === 'blob').length;
    const selected = [];
    let runningBytes = 0;
    for (const entry of candidates) {
      if (runningBytes + entry.size > MAX_TOTAL_BYTES) break;
      selected.push(entry);
      runningBytes += entry.size;
    }
    const filesSkipped = totalCandidates - selected.length;

    if (selected.length === 0) {
      return jsonResponse({ ok: false, error: 'No gradeable files found in the repository (after applying type/size filters).' }, 200);
    }

    const fetchedFiles = [];
    for (const entry of selected) {
      const rawUrlPath = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
      try {
        const fileResp = await fetchFn(rawUrlPath, { headers: { 'User-Agent': 'masteryls-githubgrade' } });
        if (!fileResp.ok) continue;
        const text = await fileResp.text();
        fetchedFiles.push({ path: entry.path, content: text });
      } catch {
        // skip unreadable files
      }
    }

    if (fetchedFiles.length === 0) {
      return jsonResponse({ ok: false, error: 'Unable to fetch any repository files.' }, 200);
    }

    const prompt = buildGeminiPrompt({ title, body, gradingCriteria, owner, repo, branch, files: fetchedFiles, filesSkipped });

    const geminiBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        //        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    };

    let geminiResp;
    try {
      geminiResp = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'X-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      });
    } catch (error) {
      return jsonResponse({ ok: false, error: `AI grading request failed: ${error?.message || String(error)}` }, 200);
    }

    if (!geminiResp.ok) {
      return jsonResponse({ ok: false, error: `AI grading request failed (${geminiResp.status}).` }, 200);
    }

    const geminiData = await geminiResp.json();
    const candidate = geminiData?.candidates?.[0];
    const candidateText = candidate?.content?.parts?.map((p) => p?.text || '').join('') || '';
    const finishReason = candidate?.finishReason || 'unknown';
    const promptFeedback = geminiData?.promptFeedback;

    const grade = parseGeminiJson(candidateText);

    if (!grade.ok) {
      console.error('githubgrade: AI response parse failure', {
        reason: grade.reason,
        finishReason,
        promptFeedback,
        rawTextSnippet: String(candidateText).slice(0, 500),
        textLength: candidateText.length,
      });

      const debug = {
        parseFailureReason: grade.reason,
        finishReason,
        rawTextSnippet: String(candidateText).slice(0, 800),
        textLength: candidateText.length,
        ...(promptFeedback ? { promptFeedback } : {}),
      };

      const friendly = finishReason === 'MAX_TOKENS' ? 'AI grading was truncated before completing. Please retry; the prompt may be too long.' : finishReason === 'SAFETY' ? 'AI grading was blocked by safety filters. Please review the submission contents.' : 'Could not parse AI grading response. Please retry or contact your instructor.';

      return jsonResponse({
        ok: true,
        percentCorrect: 0,
        feedback: friendly,
        filesIncluded: fetchedFiles.length,
        filesSkipped,
        branch,
        debug,
      });
    }

    return jsonResponse({
      ok: true,
      percentCorrect: grade.percentCorrect,
      feedback: grade.feedback,
      filesIncluded: fetchedFiles.length,
      filesSkipped,
      branch,
    });
  };
}
