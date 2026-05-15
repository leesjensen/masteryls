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

  return Object.keys(progress).filter((key) => key !== 'mastery').length;
}

export function createGradebookOverviewHandler({ createSupabaseClientFromAuthHeader, getEnv }) {
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

    const supabase = createSupabaseClientFromAuthHeader(authHeader);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const courseId = String(payload?.courseId || '').trim();
    const page = Math.max(1, Number(payload?.page || 1));
    const limit = Math.max(1, Math.min(100, Number(payload?.limit || 50)));
    const search = toLower(payload?.search || '');

    if (!courseId) {
      return new Response(JSON.stringify({ error: 'courseId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user.id;

    const { data: rootRole } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'root').limit(1);
    const isRoot = Array.isArray(rootRole) && rootRole.length > 0;

    let isEditor = false;
    if (!isRoot) {
      const { data: editorRole } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'editor').eq('object', courseId).limit(1);
      isEditor = Array.isArray(editorRole) && editorRole.length > 0;
    }

    let isEnrolledLearner = false;
    if (!isRoot && !isEditor) {
      const { data: learnerEnrollment } = await supabase.from('enrollment').select('id').eq('catalogId', courseId).eq('learnerId', userId).limit(1);
      isEnrolledLearner = Array.isArray(learnerEnrollment) && learnerEnrollment.length > 0;
    }

    if (!isRoot && !isEditor && !isEnrolledLearner) {
      return new Response(JSON.stringify({ error: 'User is not authorized to view this course gradebook' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      let enrollmentsQuery = supabase.from('enrollment').select('id, learnerId, progress').eq('catalogId', courseId);
      if (isEnrolledLearner && !isRoot && !isEditor) {
        enrollmentsQuery = enrollmentsQuery.eq('learnerId', userId);
      }

      const { data: enrollments, error: enrollmentsError } = await enrollmentsQuery;
      if (enrollmentsError) {
        throw enrollmentsError;
      }

      const safeEnrollments = Array.isArray(enrollments) ? enrollments : [];
      if (safeEnrollments.length === 0) {
        return new Response(JSON.stringify({ rows: [], totalCount: 0, page, limit, hasMore: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const learnerIds = [...new Set(safeEnrollments.map((entry) => entry.learnerId).filter(Boolean))];
      const enrollmentIds = safeEnrollments.map((entry) => entry.id).filter(Boolean);

      let learners = [];
      if (learnerIds.length > 0) {
        const { data: learnerRows, error: learnersError } = await supabase.from('user').select('id, name, email').in('id', learnerIds);
        if (learnersError) {
          throw learnersError;
        }
        learners = Array.isArray(learnerRows) ? learnerRows : [];
      }

      let progressRows = [];
      if (enrollmentIds.length > 0) {
        const { data: progressData, error: progressError } = await supabase.from('progress').select('enrollmentId, type, details, interactionId, topicId, createdAt').eq('catalogId', courseId).in('enrollmentId', enrollmentIds).order('createdAt', { ascending: false }).limit(10000);

        if (progressError) {
          throw progressError;
        }
        progressRows = Array.isArray(progressData) ? progressData : [];
      }

      const learnersById = new Map(learners.map((entry) => [String(entry.id), entry]));
      const progressByEnrollmentId = new Map();
      progressRows.forEach((row) => {
        const key = String(row.enrollmentId || '');
        if (!key) {
          return;
        }
        if (!progressByEnrollmentId.has(key)) {
          progressByEnrollmentId.set(key, []);
        }
        progressByEnrollmentId.get(key).push(row);
      });

      const rows = safeEnrollments.map((enrollment) => {
        const learner = learnersById.get(String(enrollment.learnerId || '')) || {};
        const enrollmentProgressRows = progressByEnrollmentId.get(String(enrollment.id || '')) || [];

        let examCompletedCount = 0;
        const submittedProjects = new Set();
        let lastActivityAt = null;

        enrollmentProgressRows.forEach((item) => {
          const type = String(item?.type || '');
          const details = item?.details && typeof item.details === 'object' ? item.details : {};

          if (type === 'exam' && details.state === 'completed') {
            examCompletedCount += 1;
          }

          if (type === 'quizSubmit' && details.syncGrade === true) {
            const interactionKey = String(item?.interactionId || '').trim();
            const topicKey = String(item?.topicId || '').trim();
            const projectKey = interactionKey ? `interaction:${interactionKey}` : topicKey ? `topic:${topicKey}` : '';
            if (projectKey) {
              submittedProjects.add(projectKey);
            }
          }

          if (item?.createdAt && (!lastActivityAt || item.createdAt > lastActivityAt)) {
            lastActivityAt = item.createdAt;
          }
        });

        return {
          enrollmentId: enrollment.id,
          learnerId: enrollment.learnerId,
          learnerName: learner.name || null,
          learnerEmail: learner.email || null,
          masteryPercent: Number(enrollment?.progress?.mastery || 0),
          completedTopics: countCompletedTopics(enrollment?.progress),
          examCompletedCount,
          projectSubmittedCount: submittedProjects.size,
          lastActivityAt,
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
