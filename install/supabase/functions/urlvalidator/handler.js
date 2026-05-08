export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isSupportedProtocol(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function isBlockedHost(hostname) {
  const normalized = String(hostname || '')
    .trim()
    .toLowerCase();
  if (!normalized) return true;

  if (normalized === 'localhost' || normalized === '0.0.0.0' || normalized === '::1' || normalized.endsWith('.local')) {
    return true;
  }

  if (/^127\./.test(normalized)) return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^169\.254\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(normalized)) return true;

  return false;
}

export function createUrlValidatorHandler({ createSupabaseClientFromAuthHeader, getEnv, fetchFn = fetch }) {
  return async function handleUrlValidator(req) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = getEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createSupabaseClientFromAuthHeader(authHeader);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = await req.json();
    const rawUrl = String(payload?.url || '').trim();
    const timeoutMs = Math.min(Math.max(Number(payload?.timeoutMs) || 8000, 1000), 15000);

    if (!rawUrl) {
      return new Response(JSON.stringify({ ok: false, error: 'Please provide a URL before submitting.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'The provided value is not a valid URL format.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isSupportedProtocol(parsed)) {
      return new Response(JSON.stringify({ ok: false, error: 'Only http and https URLs are supported.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isBlockedHost(parsed.hostname)) {
      return new Response(JSON.stringify({ ok: false, error: 'This URL host is not allowed for validation.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let timerId;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    try {
      if (controller) {
        timerId = setTimeout(() => controller.abort(), timeoutMs);
      }

      const response = await fetchFn(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller?.signal,
        headers: {
          'User-Agent': 'masteryls-url-validator',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (timerId) clearTimeout(timerId);

      return new Response(
        JSON.stringify({
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          finalUrl: response.url,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      if (timerId) clearTimeout(timerId);
      const timedOut = error?.name === 'AbortError';

      return new Response(
        JSON.stringify({
          ok: false,
          error: timedOut ? 'Validation request timed out.' : 'Unable to validate URL from server. The site may be unavailable or blocking requests.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
  };
}
