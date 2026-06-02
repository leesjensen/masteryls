export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toLower(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function countCompletedTopics(progress) {
  if (!progress || typeof progress !== 'object') {
    return 0;
  }

  return Object.keys(progress).filter((key) => key !== 'mastery' && key !== 'lastActivityAt' && key !== 'totalTimeSpent').length;
}

// Decode the JWT payload without signature verification to extract the userId (sub claim).
// Used only to fire auth queries in parallel with getUser(). The verified userId from
// getUser() must match before any data is returned.
function extractUserIdFromToken(authHeader) {
  try {
    const token = authHeader.replace(/^bearer\s+/i, '');
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return null;
    const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
    const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.sub !== 'string' || (payload.exp && payload.exp < now)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function createMasteryOverviewHandler({ createSupabaseClientFromAuthHeader, getEnv }) {
  return async function handleGradebookOverview(req) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = getEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing function configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse body first so courseId is available for parallel pre-fetch queries
    const payload = await req.json();
    const courseId = String(payload?.courseId || '').trim();
    const learnerId = String(payload?.learnerId || '').trim() || null;
    const page = Math.max(1, Number(payload?.page || 1));
    const limit = Math.max(1, Math.min(100, Number(payload?.limit || 50)));
    const search = toLower(payload?.search || '');

    if (!courseId) {
      return new Response(JSON.stringify({ error: 'courseId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createSupabaseClientFromAuthHeader(authHeader);

    // Decode userId from JWT locally so auth and enrollment queries can fire
    // in parallel with getUser(). Falls back to re-running auth after getUser()
    // if the token can't be decoded or the userId doesn't match.
    const candidateUserId = extractUserIdFromToken(authHeader);

    // 3 parallel operations: getUser + combined role check + enrollment fetch
    const [
      { data: authData, error: authError },
      { data: prefetchedRoles },
      { data: allEnrollments, error: enrollmentsError },
    ] = await Promise.all([
      supabase.auth.getUser(),
      candidateUserId
        ? supabase.from('role').select('right, object').eq('user', candidateUserId).in('right', ['root', 'editor'])
        : Promise.resolve({ data: null }),
      learnerId
        ? supabase.from('enrollment').select('id, learnerId, progress').eq('catalogId', courseId).eq('learnerId', learnerId)
        : supabase.from('enrollment').select('id, learnerId, progress').eq('catalogId', courseId),
    ]);

    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user.id;

    let userRoles = prefetchedRoles;

    // If the JWT decode failed or userId didn't match the verified identity, re-run the
    // role query with the correct userId. This is a fallback that doesn't occur normally.
    if (candidateUserId !== userId) {
      const { data: recheckRoles } = await supabase.from('role').select('right, object').eq('user', userId).in('right', ['root', 'editor']);
      userRoles = recheckRoles;
    }

    const safeRoles = Array.isArray(userRoles) ? userRoles : [];
    const safeAllEnrollments = Array.isArray(allEnrollments) ? allEnrollments : [];

    const isRoot = safeRoles.some((r) => r.right === 'root');
    const isEditor = safeRoles.some((r) => r.right === 'editor' && String(r.object) === courseId);
    const isEnrolledLearner = safeAllEnrollments.some((e) => String(e.learnerId) === String(userId));

    if (!isRoot && !isEditor && !isEnrolledLearner) {
      return new Response(JSON.stringify({ error: 'User is not authorized to view this course gradebook' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      if (enrollmentsError) {
        throw enrollmentsError;
      }

      let safeEnrollments = safeAllEnrollments;

      // Enrolled learners who are not editors/roots can only see their own row
      if (isEnrolledLearner && !isRoot && !isEditor) {
        safeEnrollments = safeEnrollments.filter((e) => String(e.learnerId) === String(userId));
      }

      if (safeEnrollments.length === 0) {
        return new Response(JSON.stringify({ rows: [], totalCount: 0, page, limit, hasMore: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const learnerIds = [...new Set(safeEnrollments.map((entry) => entry.learnerId).filter(Boolean))];

      let learners = [];
      if (learnerIds.length > 0) {
        const { data: learnerRows, error: learnersError } = await supabase.from('user').select('id, name, email').in('id', learnerIds);
        if (learnersError) {
          throw learnersError;
        }
        learners = Array.isArray(learnerRows) ? learnerRows : [];
      }

      const learnersById = new Map(learners.map((entry) => [String(entry.id), entry]));

      const rows = safeEnrollments.map((enrollment) => {
        const learner = learnersById.get(String(enrollment.learnerId || '')) || {};
        const progress = enrollment.progress || {};
        const topicValues = Object.values(progress).filter((v) => v && typeof v === 'object');

        return {
          enrollmentId: enrollment.id,
          learnerId: enrollment.learnerId,
          learnerName: learner.name || null,
          learnerEmail: learner.email || null,
          masteryPercent: Number(progress.mastery || 0),
          completedTopics: countCompletedTopics(progress),
          examCompletedCount: topicValues.filter((v) => v.examCompleted === true).length,
          projectSubmittedCount: topicValues.filter((v) => v.projectSubmission === true).length,
          lastActivityAt: progress.lastActivityAt || null,
          totalTimeSpent: typeof progress.totalTimeSpent === 'number' ? progress.totalTimeSpent : 0,
          progress,
        };
      });

      const filteredRows = search
        ? rows.filter((row) => {
            const name = toLower(row.learnerName);
            const email = toLower(row.learnerEmail);
            return name.includes(search) || email.includes(search);
          })
        : rows;

      const offset = (page - 1) * limit;
      const pagedRows = filteredRows.slice(offset, offset + limit);
      const totalCount = filteredRows.length;
      const hasMore = totalCount > offset + limit;

      return new Response(
        JSON.stringify({
          rows: pagedRows,
          totalCount,
          page,
          limit,
          hasMore,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: error?.message || String(error) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  };
}
