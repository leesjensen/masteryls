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

// Canvas collapses plain-text newlines in submission comments, so the header
// lines are joined with <br>. The feedback is already simplified HTML produced
// by the client (markdownToHtml), so it is appended as-is rather than escaped.
export function buildCanvasComment({ feedback, normalizedPercent, normalizedPoints, postedGrade, autoGrade }) {
  const lines = [];
  const suggestedGrade = Math.round(((normalizedPercent / 100) * normalizedPoints + Number.EPSILON) * 100) / 100;
  lines.push('MasteryLS feedback');
  lines.push(`Suggested grade: ${suggestedGrade}/${normalizedPoints} (${normalizedPercent}%)`);
  lines.push(`Auto grade: ${autoGrade ? 'enabled' : 'disabled'}`);
  lines.push(`Submitted at: ${new Date().toISOString()}`);
  if (typeof postedGrade === 'number') {
    lines.push(`Posted grade: ${postedGrade}`);
  }

  let comment = lines.join('<br>\n');

  const trimmedFeedback = String(feedback || '').trim();
  if (trimmedFeedback) {
    comment += `<br>\n<br>\n${trimmedFeedback}`;
  }

  return comment;
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
    const mode = typeof payload?.mode === 'string' ? payload.mode : 'grade';
    const { courseId } = payload;
    if (!courseId) {
      return new Response(JSON.stringify({ error: 'courseId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
    if (!isRoot && payload.catalogId) {
      const { data: editorRole } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'editor').eq('object', payload.catalogId).limit(1);
      isEditor = Array.isArray(editorRole) && editorRole.length > 0;
    }

    const isLearnerSelf = authEmail !== '' && authEmail === requestedLearnerEmail;
    if (!isRoot && !isEditor && !isLearnerSelf) {
      return new Response(JSON.stringify({ error: 'User is not authorized for this Canvas action' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    // Eligibility-check mode: look up the learner in the Canvas course and return whether
    // they exist there. Used by the client to decide whether to show "Submit to Gradebook".
    if (mode === 'check') {
      try {
        const users = await canvasApi(`/courses/${courseId}/search_users?search_term=${encodeURIComponent(requestedLearnerEmail)}&enrollment_type[]=student`);
        const eligible =
          Array.isArray(users) &&
          users.some((entry) => {
            const email = String(entry?.email || '')
              .trim()
              .toLowerCase();
            const login = String(entry?.login_id || '')
              .trim()
              .toLowerCase();
            return email === requestedLearnerEmail || login === requestedLearnerEmail;
          });
        return new Response(JSON.stringify({ ok: true, eligible }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error) {
        // Treat Canvas lookup failures as "not eligible" so the UI hides the button; surface the
        // reason so the client can log it.
        return new Response(JSON.stringify({ ok: true, eligible: false, error: error?.message || String(error) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Grade-submission mode (default): validate the grade fields and post to Canvas.
    const { topicType, percentCorrect, pointsPossible, canvasAssignmentId, canvasQuizId } = payload;
    if (!topicType || percentCorrect === undefined || pointsPossible === undefined) {
      return new Response(JSON.stringify({ error: 'topicType, percentCorrect, and pointsPossible are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const VALID_TOPIC_TYPES = ['exam', 'project', 'dra', 'interview', 'mastery'];
    if (!VALID_TOPIC_TYPES.includes(topicType)) {
      return new Response(JSON.stringify({ error: `topicType must be one of: ${VALID_TOPIC_TYPES.join(', ')}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // The course-level "mastery" assignment is auto-graded and updated frequently, so it posts
    // the grade only - no submission and no comment (a comment on every mastery change would spam
    // the submission thread).
    const isMastery = topicType === 'mastery';
    const autoGrade = isMastery ? true : payload.autoGrade === undefined ? topicType === 'exam' : payload.autoGrade === true;
    const feedback = String(payload.feedback || '');
    const submissionUrl = typeof payload.submissionUrl === 'string' ? payload.submissionUrl.trim() : '';
    const submissionText = typeof payload.submissionText === 'string' ? payload.submissionText.trim() : '';

    const normalizedPercent = normalizePercent(percentCorrect);
    const normalizedPoints = Number(pointsPossible);
    if (normalizedPercent === null || !Number.isFinite(normalizedPoints) || normalizedPoints <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid percentCorrect or pointsPossible' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (submissionUrl && !/^https?:\/\//i.test(submissionUrl)) {
      return new Response(JSON.stringify({ error: 'submissionUrl must be an absolute http(s) URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    try {
      const users = await canvasApi(`/courses/${courseId}/search_users?search_term=${encodeURIComponent(requestedLearnerEmail)}&enrollment_type[]=student`);
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

      if (submissionUrl) {
        await canvasApi(`/courses/${courseId}/assignments/${assignmentId}/submissions`, 'POST', {
          submission: {
            user_id: learner.id,
            submission_type: 'online_url',
            url: submissionUrl,
          },
        });
      } else if (submissionText) {
        // dra/interview have no URL to submit - post a minimal text-entry submission instead,
        // purely so Canvas registers a real submission record and shows its "needs grading"
        // indicator in the gradebook (a comment alone leaves no such signal).
        await canvasApi(`/courses/${courseId}/assignments/${assignmentId}/submissions`, 'POST', {
          submission: {
            user_id: learner.id,
            submission_type: 'online_text_entry',
            body: submissionText,
          },
        });
      }

      const postedGrade = autoGrade ? Math.round(((normalizedPercent / 100) * normalizedPoints + Number.EPSILON) * 100) / 100 : null;
      const updatePayload = {
        ...(autoGrade
          ? {
              submission: {
                posted_grade: postedGrade,
              },
            }
          : {}),
        // Mastery updates are grade-only; everything else attaches the MasteryLS feedback comment.
        ...(isMastery
          ? {}
          : {
              comment: {
                text_comment: buildCanvasComment({ feedback, normalizedPercent, normalizedPoints, postedGrade, autoGrade }),
              },
            }),
      };

      const submission = await canvasApi(`/courses/${courseId}/assignments/${assignmentId}/submissions/${learner.id}`, 'PUT', updatePayload);

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
