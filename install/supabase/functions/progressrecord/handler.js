export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export function createProgressRecordHandler({ createSupabaseClientFromAuthHeader, getEnv }) {
  return async function handleProgressRecord(req) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUrl = getEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Missing function configuration' }, 500);
    }

    const supabase = createSupabaseClientFromAuthHeader(authHeader);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Invalid user token' }, 401);
    }

    const payload = await req.json();
    const catalogId = String(payload?.catalogId || '').trim();
    const enrollmentId = String(payload?.enrollmentId || '').trim();
    const topicId = String(payload?.topicId || payload?.topic?.id || '').trim();
    const interactionId = payload?.interactionId ? String(payload.interactionId) : null;
    const type = String(payload?.type || 'instructionView');
    const duration = Math.max(0, Math.round(Number(payload?.duration || 0)));
    const details = payload?.details && typeof payload.details === 'object' && !Array.isArray(payload.details) ? payload.details : {};
    const cacheUpdate = payload?.cacheUpdate && typeof payload.cacheUpdate === 'object' && !Array.isArray(payload.cacheUpdate) ? payload.cacheUpdate : {};
    const insertProgress = payload?.insertProgress !== false;

    if (!catalogId || !enrollmentId || !topicId) {
      return jsonResponse({ error: 'catalogId, enrollmentId, and topicId are required' }, 400);
    }

    const userId = authData.user.id;
    const { data, error } = await supabase.rpc('record_progress_event', {
      p_user_id: userId,
      p_catalog_id: catalogId,
      p_enrollment_id: enrollmentId,
      p_topic_id: topicId,
      p_interaction_id: interactionId,
      p_type: type,
      p_duration: duration,
      p_details: details,
      p_cache_update: cacheUpdate,
      p_insert_progress: insertProgress,
    });

    if (error) {
      const message = error?.message || String(error);
      const status = /not authorized/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 500;
      return jsonResponse({ error: message }, status);
    }

    const result = Array.isArray(data) ? data[0] : data;

    return jsonResponse({
      progress: result?.progress || null,
      enrollment: result?.enrollment || null,
    });
  };
}
