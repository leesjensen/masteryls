export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP = 'masteryls';
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB batch cap
const MAX_ENTRIES = 1000;
const MAX_LINE_CHARS = 16384;

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Group client log entries into Loki push streams by level. Loki requires per-stream values in
// ascending timestamp order. Labels are intentionally low-cardinality (app + level); everything else
// lives in the JSON log line. Pure; exported for unit testing.
export function buildLokiStreams(entries) {
  const byLevel = new Map();
  for (const e of entries) {
    if (!e || typeof e.line !== 'string' || !/^\d+$/.test(String(e.ts))) continue;
    const level = e.level === 'error' ? 'error' : 'info';
    const line = e.line.length > MAX_LINE_CHARS ? e.line.slice(0, MAX_LINE_CHARS) : e.line;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push([String(e.ts), line]);
  }
  const streams = [];
  for (const [level, values] of byLevel) {
    values.sort((a, b) => a[0].length - b[0].length || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    streams.push({ stream: { app: APP, level }, values });
  }
  return { streams };
}

/**
 * Log relay: accepts a batch of client log entries ({ entries: [{ ts, level, line }] }) and pushes
 * them to Grafana Cloud Loki, injecting the write credentials from the environment. Loki's push API
 * has no browser CORS and the token must stay server-side, hence this relay.
 */
export function createLogPushHandler({ getEnv, fetchFn = fetch }) {
  return async function handleLogPush(req) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const lokiUrl = getEnv('LOKI_URL');
    const lokiAuth = getEnv('LOKI_AUTH');
    if (!lokiUrl || !lokiAuth) {
      return json({ error: 'Log relay is not configured' }, 500);
    }

    let payload;
    try {
      payload = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const entries = Array.isArray(payload?.entries) ? payload.entries.slice(0, MAX_ENTRIES) : [];
    if (!entries.length) {
      return json({ error: 'Expected a log batch' }, 400);
    }
    if (JSON.stringify(payload).length > MAX_BODY_BYTES) {
      return json({ error: 'Payload too large' }, 413);
    }

    const streams = buildLokiStreams(entries);
    if (!streams.streams.length) {
      return json({ ok: true, pushed: 0 }, 200);
    }

    try {
      const upstream = await fetchFn(lokiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: lokiAuth },
        body: JSON.stringify(streams),
      });
      if (upstream.ok) {
        return json({ ok: true, pushed: entries.length }, 202);
      }
      let detail = '';
      try {
        detail = (await upstream.text()) || '';
      } catch {
        // ignore
      }
      return json({ ok: false, status: upstream.status, detail: detail.slice(0, 500) }, 502);
    } catch {
      return json({ error: 'Failed to forward logs' }, 502);
    }
  };
}
