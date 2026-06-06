export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function createCanvasFunctionHandler({ createSupabaseClientFromAuthHeader, getEnv, fetchFn = fetch }) {
  return async function handleCanvasRequest(req) {
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

    const { courseId, endpoint, method, body } = await req.json();
    if (!courseId || !endpoint || !method) {
      return new Response(JSON.stringify({ error: 'courseId, endpoint, and method are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const normalizedMethod = String(method).toUpperCase();
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(normalizedMethod)) {
      return new Response(JSON.stringify({ error: `Unsupported method '${method}'` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const endpointCourseMatch = endpoint.match(/^\/courses\/(\d+)(?:\/|\?|$)/);
    if (!endpointCourseMatch || endpointCourseMatch[1] !== String(courseId)) {
      return new Response(JSON.stringify({ error: 'Endpoint course does not match courseId' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allowedPatterns = [
      /^\/courses\/\d+\/modules(?:\?.*)?$/,
      /^\/courses\/\d+\/modules\/\d+(?:\?.*)?$/,
      /^\/courses\/\d+\/modules\/\d+\/items(?:\?.*)?$/,
      /^\/courses\/\d+\/pages(?:\?.*)?$/,
      /^\/courses\/\d+\/pages\/[^/?]+(?:\?.*)?$/,
      /^\/courses\/\d+\/quizzes(?:\?.*)?$/,
      /^\/courses\/\d+\/quizzes\/\d+(?:\?.*)?$/,
      /^\/courses\/\d+\/assignments(?:\?.*)?$/,
      /^\/courses\/\d+\/assignments\/\d+(?:\?.*)?$/,
      /^\/courses\/\d+\/search_users(?:\?.*)?$/,
    ];
    if (!allowedPatterns.some((pattern) => pattern.test(endpoint))) {
      return new Response(JSON.stringify({ error: 'Endpoint is not allowed by canvas function policy' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = authData.user.id;
    const { data: rootRole, error: rootError } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'root').limit(1);
    if (rootError) {
      return new Response(JSON.stringify({ error: 'Unable to validate user roles' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const isRoot = Array.isArray(rootRole) && rootRole.length > 0;

    let isEditor = false;
    if (!isRoot) {
      const { data: editorRole, error: editorError } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'editor').eq('object', courseId).limit(1);
      if (editorError) {
        return new Response(JSON.stringify({ error: 'Unable to validate editor rights' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      isEditor = Array.isArray(editorRole) && editorRole.length > 0;
    }

    if (!isRoot && !isEditor) {
      return new Response(JSON.stringify({ error: 'User is not authorized for this course' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let reqBody = undefined;
    if (body) {
      reqBody = JSON.stringify(body);
    }

    const url = `https://byu.instructure.com/api/v1${endpoint}`;
    const token = getEnv('CANVAS_API_KEY');
    const response = await fetchFn(url, {
      method: normalizedMethod,
      body: reqBody,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    let data = null;
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { raw: responseText };
      }
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', Connection: 'keep-alive' },
    });
  };
}
