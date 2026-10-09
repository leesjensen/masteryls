export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOP_LEVEL_SUMMARY_KEYS = new Set(['mastery', 'lastActivityAt', 'totalTimeSpent']);

// Count completed interactions for a topic entry as the union of the `scores` map keys and the
// legacy `interactions` array. Mirrors completedInteractionIds() in src/utils/topicProgress.js so
// the trimmed payload's completedCount matches what the client would derive from a full blob.
function completedCountFor(entry) {
  const scoresKeys = entry?.scores ? Object.keys(entry.scores) : [];
  const legacy = Array.isArray(entry?.interactions) ? entry.interactions : [];
  if (scoresKeys.length === 0) return legacy.length;
  if (legacy.length === 0) return scoresKeys.length;
  return new Set([...scoresKeys, ...legacy]).size;
}

// Reduce a topic progress entry to only the fields the overview list derives from: the completed
// interaction count (replacing the raw scores/interactions), mastery score, time, last activity,
// and the exam/project flags. Everything else (scores values, DRA/interview detail, notes, mode)
// is dropped - the drill-down fetches the full blob separately.
function trimTopicEntry(entry) {
  const trimmed = { completedCount: completedCountFor(entry) };
  if (Number.isFinite(Number(entry.masteryScore))) trimmed.masteryScore = Number(entry.masteryScore);
  if (Number.isFinite(Number(entry.timeSpent)) && Number(entry.timeSpent) > 0) trimmed.timeSpent = Number(entry.timeSpent);
  if (entry.lastInteractionAt) trimmed.lastInteractionAt = entry.lastInteractionAt;
  if (entry.examCompleted === true) trimmed.examCompleted = true;
  if (entry.projectSubmission === true) trimmed.projectSubmission = true;
  return trimmed;
}

// Trim a full enrollment.progress blob for the list payload: keep the small top-level fallbacks
// and a trimmed entry per topic.
function trimProgress(progress) {
  if (!progress || typeof progress !== 'object') return {};
  const trimmed = {};
  if (progress.lastActivityAt) trimmed.lastActivityAt = progress.lastActivityAt;
  if (Number.isFinite(Number(progress.mastery))) trimmed.mastery = Number(progress.mastery);
  if (Number.isFinite(Number(progress.totalTimeSpent))) trimmed.totalTimeSpent = Number(progress.totalTimeSpent);
  for (const [key, value] of Object.entries(progress)) {
    if (TOP_LEVEL_SUMMARY_KEYS.has(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      trimmed[key] = trimTopicEntry(value);
    }
  }
  return trimmed;
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
        ? supabase.from('role').select('right, object').eq('user', candidateUserId).in('right', ['root', 'editor', 'mentor'])
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
      const { data: recheckRoles } = await supabase.from('role').select('right, object').eq('user', userId).in('right', ['root', 'editor', 'mentor']);
      userRoles = recheckRoles;
    }

    const safeRoles = Array.isArray(userRoles) ? userRoles : [];
    const safeAllEnrollments = Array.isArray(allEnrollments) ? allEnrollments : [];

    const isRoot = safeRoles.some((r) => r.right === 'root');
    const isEditor = safeRoles.some((r) => r.right === 'editor' && String(r.object) === courseId);
    const isMentor = safeRoles.some((r) => r.right === 'mentor' && String(r.object) === courseId);
    const canOverseeCourse = isRoot || isEditor || isMentor;
    const isEnrolledLearner = safeAllEnrollments.some((e) => String(e.learnerId) === String(userId));

    if (!canOverseeCourse && !isEnrolledLearner) {
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

      // Enrolled learners who are not course overseers can only see their own row
      if (isEnrolledLearner && !canOverseeCourse) {
        safeEnrollments = safeEnrollments.filter((e) => String(e.learnerId) === String(userId));
      }

      if (safeEnrollments.length === 0) {
        return new Response(JSON.stringify({ rows: [], totalCount: 0 }), {
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

      // A single-learner request (the drill-down) returns the FULL progress blob because the
      // learner detail view needs per-interaction scores and DRA/interview fields. The list
      // returns a TRIMMED blob; the client derives mastery/time and sorts/paginates/searches
      // locally so display and ordering always share one computation path.
      const isSingleLearner = Boolean(learnerId);

      const rows = safeEnrollments.map((enrollment) => {
        const learner = learnersById.get(String(enrollment.learnerId || '')) || {};
        const progress = enrollment.progress || {};

        return {
          enrollmentId: enrollment.id,
          learnerId: enrollment.learnerId,
          learnerName: learner.name || null,
          learnerEmail: learner.email || null,
          progress: isSingleLearner ? progress : trimProgress(progress),
        };
      });

      return new Response(JSON.stringify({ rows, totalCount: rows.length }), {
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
