export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePercent(percentCorrect) {
  const parsed = Number(percentCorrect);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.min(100, parsed));
}

function buildCanvasComment({ feedback, normalizedPercent, normalizedPoints, postedGrade, autoGrade }) {
  const lines = [];
  const suggestedGrade = Math.round(((normalizedPercent / 100) * normalizedPoints + Number.EPSILON) * 100) / 100;
  lines.push('MasteryLS feedback');
  lines.push(`Suggested grade: ${suggestedGrade}/${normalizedPoints} (${normalizedPercent}%)`);
  lines.push(`Auto grade: ${autoGrade ? 'enabled' : 'disabled'}`);
  lines.push(`Submitted at: ${new Date().toISOString()}`);
  if (typeof postedGrade === 'number') {
    lines.push(`Posted grade: ${postedGrade}`);
  }

  const trimmedFeedback = String(feedback || '').trim();
  if (trimmedFeedback) {
    lines.push('');
    lines.push('Feedback:');
    lines.push(trimmedFeedback);
  }

  return lines.join('\n');
}

export function createCanvasGradebookHandler({ createSupabaseClientFromAuthHeader, getEnv, fetchFn = fetch }) {
  return async function handleCanvasGradebook(req) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = getEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const canvasToken = getEnv('CANVAS_API_KEY');
    if (!supabaseUrl || !supabaseServiceRoleKey || !canvasToken) {
      return new Response(JSON.stringify({ error: 'Missing function configuration' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createSupabaseClientFromAuthHeader(authHeader);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = await req.json();
    const { courseId, topicType, percentCorrect, pointsPossible, canvasAssignmentId, canvasQuizId } = payload;

    if (!courseId || !topicType || percentCorrect === undefined || pointsPossible === undefined) {
      return new Response(JSON.stringify({ error: 'courseId, topicType, percentCorrect, and pointsPossible are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (topicType !== 'exam' && topicType !== 'project') {
      return new Response(JSON.stringify({ error: 'topicType must be exam or project' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = authData.user.id;
    const authEmail = String(authData.user.email || '')
      .trim()
      .toLowerCase();
    const requestedLearnerEmail = String(payload.learnerEmail || authData.user.email || '')
      .trim()
      .toLowerCase();
    if (!requestedLearnerEmail) {
      return new Response(JSON.stringify({ error: 'A learner email is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: rootRole } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'root').limit(1);
    const isRoot = Array.isArray(rootRole) && rootRole.length > 0;

    let isEditor = false;
    if (!isRoot) {
      const { data: editorRole } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'editor').eq('object', courseId).limit(1);
      isEditor = Array.isArray(editorRole) && editorRole.length > 0;
    }

    const isLearnerSelf = authEmail !== '' && authEmail === requestedLearnerEmail;
    if (!isRoot && !isEditor && !isLearnerSelf) {
      return new Response(JSON.stringify({ error: 'User is not authorized to update this grade' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const autoGrade = payload.autoGrade === undefined ? topicType === 'exam' : payload.autoGrade === true;
    const feedback = String(payload.feedback || '');
    const submissionUrl = typeof payload.submissionUrl === 'string' ? payload.submissionUrl.trim() : '';

    const normalizedPercent = normalizePercent(percentCorrect);
    const normalizedPoints = Number(pointsPossible);
    if (normalizedPercent === null || !Number.isFinite(normalizedPoints) || normalizedPoints <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid percentCorrect or pointsPossible' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (submissionUrl && !/^https?:\/\//i.test(submissionUrl)) {
      return new Response(JSON.stringify({ error: 'submissionUrl must be an absolute http(s) URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const canvasApi = async (endpoint, method = 'GET', body) => {
      const response = await fetchFn(`https://byu.instructure.com/api/v1${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${canvasToken}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const text = await response.text();
      let json = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }
      }

      if (!response.ok) {
        throw new Error(`Canvas API error ${response.status}: ${JSON.stringify(json)}`);
      }

      return json;
    };

    try {
      const users = await canvasApi(`/courses/${courseId}/search_users?search_term=${encodeURIComponent(requestedLearnerEmail)}`);
      if (!Array.isArray(users) || users.length === 0) {
        return new Response(JSON.stringify({ error: 'Unable to find Canvas user for learner email' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const learner = users.find((entry) => {
        const email = String(entry?.email || '')
          .trim()
          .toLowerCase();
        const login = String(entry?.login_id || '')
          .trim()
          .toLowerCase();
        return email === requestedLearnerEmail || login === requestedLearnerEmail;
      });

      if (!learner?.id) {
        return new Response(JSON.stringify({ error: 'No exact Canvas user match for learner email' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let assignmentId = canvasAssignmentId || null;
      if (!assignmentId && topicType === 'exam') {
        if (!canvasQuizId) {
          return new Response(JSON.stringify({ error: 'canvasQuizId is required for exam grade updates when canvasAssignmentId is missing' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const quiz = await canvasApi(`/courses/${courseId}/quizzes/${canvasQuizId}`);
        assignmentId = quiz?.assignment_id || null;
      }

      if (!assignmentId) {
        return new Response(JSON.stringify({ error: 'Unable to resolve Canvas assignment id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const postedGrade = autoGrade ? Math.round(((normalizedPercent / 100) * normalizedPoints + Number.EPSILON) * 100) / 100 : null;
      const textComment = buildCanvasComment({ feedback, normalizedPercent, normalizedPoints, postedGrade, autoGrade });
      const submissionPayload = {
        submission: {
          ...(autoGrade ? { posted_grade: postedGrade } : {}),
          ...(submissionUrl ? { submission_type: 'online_url', url: submissionUrl } : {}),
        },
        comment: {
          text_comment: textComment,
        },
      };

      const submission = await canvasApi(`/courses/${courseId}/assignments/${assignmentId}/submissions/${learner.id}`, 'PUT', {
        ...submissionPayload,
      });

      return new Response(JSON.stringify({ ok: true, postedGrade, autoGrade, learnerId: learner.id, assignmentId, submission }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error?.message || String(error) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  };
}
