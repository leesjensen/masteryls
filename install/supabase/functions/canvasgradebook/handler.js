export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

function normalizePercent(percentCorrect) {
  const parsed = Number(percentCorrect);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.min(100, parsed));
}

// Match a Canvas search_users result to a learner by email or login id (case-insensitive).
// Canvas may return several near-matches for a search term, so we require an exact match on
// either field. Returns the matching user entry, or null.
export function findCanvasLearner(users, learnerEmail) {
  if (!Array.isArray(users)) {
    return null;
  }
  const target = String(learnerEmail || '')
    .trim()
    .toLowerCase();
  if (!target) {
    return null;
  }
  return (
    users.find((entry) => {
      const email = String(entry?.email || '')
        .trim()
        .toLowerCase();
      const login = String(entry?.login_id || '')
        .trim()
        .toLowerCase();
      return email === target || login === target;
    }) || null
  );
}

// Reduce Canvas's submission + enrollment responses to the trimmed grade summary the client shows:
// an overall current course grade and a per-assignment breakdown. Submissions with no assignment
// name are skipped; an excused submission has no numeric score but is labelled "Excused". Scores
// and points are passed through as numbers or null so the client can render "-" for the unknowns.
export function buildGradeSummary(submissions, enrollments) {
  const assignments = (Array.isArray(submissions) ? submissions : [])
    .filter((sub) => sub?.assignment && sub.assignment.name)
    .map((sub) => ({
      name: String(sub.assignment.name),
      score: sub.excused ? null : typeof sub.score === 'number' ? sub.score : null,
      pointsPossible: typeof sub.assignment.points_possible === 'number' ? sub.assignment.points_possible : null,
      grade: sub.excused ? 'Excused' : sub.grade ?? null,
      dueAt: sub.assignment.due_at ?? null,
      submittedAt: sub.submitted_at ?? null,
      missing: sub.missing === true,
      late: sub.late === true,
      excused: sub.excused === true,
    }));
  // The student enrollment carries the computed course grade; take the first one that has grades.
  const studentEnrollment = (Array.isArray(enrollments) ? enrollments : []).find((entry) => entry?.grades) || null;
  const grades = studentEnrollment?.grades || {};
  const overall = {
    score: typeof grades.current_score === 'number' ? grades.current_score : null,
    grade: grades.current_grade ?? null,
  };
  return { overall, assignments };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function buildRosterGradeSummaries(users, submissions, enrollments, { emails = [], startDate = null, endDate = null, termAssignmentIds = null, termAssignmentDatesById = null } = {}) {
  const requested = new Set((emails || []).map(normalizeEmail).filter(Boolean));
  const emailByUserId = new Map();
  for (const user of Array.isArray(users) ? users : []) {
    const email = normalizeEmail(user?.email || user?.login_id);
    if (user?.id != null && email && (!requested.size || requested.has(email))) emailByUserId.set(String(user.id), email);
  }

  const inTerm = (dueAt) => {
    if (!dueAt) return !startDate && !endDate;
    const time = new Date(dueAt).getTime();
    if (!Number.isFinite(time)) return true;
    return (!startDate || time >= new Date(startDate).getTime()) && (!endDate || time <= new Date(endDate).getTime());
  };
  const submissionsByEmail = new Map();
  const undatedByEmail = new Map();
  const allowedAssignmentIds = Array.isArray(termAssignmentIds) ? new Set(termAssignmentIds.map(String)) : null;
  const baseDueAtById = termAssignmentDatesById instanceof Map
    ? termAssignmentDatesById
    : new Map(Object.entries(termAssignmentDatesById || {}));
  for (const submission of Array.isArray(submissions) ? submissions : []) {
    const email = emailByUserId.get(String(submission?.user_id ?? ''));
    if (!email || !submission?.assignment) continue;
    const assignmentId = String(submission.assignment.id ?? submission.assignment_id ?? '');
    if (allowedAssignmentIds) {
      if (!allowedAssignmentIds.has(assignmentId)) continue;
    } else {
      if (!submission.assignment.due_at && (startDate || endDate)) {
        undatedByEmail.set(email, (undatedByEmail.get(email) || 0) + 1);
        continue;
      }
      if (!inTerm(submission.assignment.due_at)) continue;
    }
    if (!submissionsByEmail.has(email)) submissionsByEmail.set(email, []);
    submissionsByEmail.get(email).push(allowedAssignmentIds
      ? { ...submission, assignment: { ...submission.assignment, due_at: baseDueAtById.get(assignmentId) ?? null } }
      : submission);
  }

  const enrollmentsByEmail = new Map();
  for (const enrollment of Array.isArray(enrollments) ? enrollments : []) {
    const email = emailByUserId.get(String(enrollment?.user_id ?? ''));
    if (!email || !enrollment?.grades) continue;
    if (!enrollmentsByEmail.has(email)) enrollmentsByEmail.set(email, []);
    enrollmentsByEmail.get(email).push(enrollment);
  }

  const result = {};
  const targetEmails = requested.size
    ? new Set([...requested].filter((email) => [...emailByUserId.values()].includes(email)))
    : new Set(emailByUserId.values());
  for (const email of targetEmails) {
    const summary = buildGradeSummary(submissionsByEmail.get(email) || [], enrollmentsByEmail.get(email) || []);
    result[email] = { ...summary, undatedAssignmentsExcluded: undatedByEmail.get(email) || 0 };
  }
  return result;
}

// Canvas collapses plain-text newlines in submission comments, so the header
// lines are joined with <br>. The feedback is already simplified HTML produced
// by the client (markdownToHtml), so it is appended as-is rather than escaped.
export function buildCanvasComment({ feedback, normalizedPercent, normalizedPoints, postedGrade, autoGrade }) {
  const lines = [];
  const suggestedGrade = Math.round(((normalizedPercent / 100) * normalizedPoints + Number.EPSILON) * 100) / 100;
  lines.push('MasteryLS feedback');
  lines.push(`Feedback result: ${suggestedGrade}/${normalizedPoints} (${normalizedPercent}%)`);
  lines.push(`Auto score sync: ${autoGrade ? 'enabled' : 'disabled'}`);
  lines.push(`Submitted at: ${new Date().toISOString()}`);
  if (typeof postedGrade === 'number') {
    lines.push(`Posted score: ${postedGrade}`);
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
    if (mode !== 'rosterGrades' && !requestedLearnerEmail) {
      return new Response(JSON.stringify({ error: 'A learner email is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: rootRole } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'root').limit(1);
    const isRoot = Array.isArray(rootRole) && rootRole.length > 0;

    let isEditor = false;
    if (!isRoot && payload.catalogId) {
      const { data: editorRole } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'editor').eq('object', payload.catalogId).limit(1);
      isEditor = Array.isArray(editorRole) && editorRole.length > 0;
    }

    let isMentor = false;
    if (!isRoot && !isEditor && payload.catalogId) {
      const { data: mentorRole } = await supabase.from('role').select('id').eq('user', userId).eq('right', 'mentor').eq('object', payload.catalogId).limit(1);
      isMentor = Array.isArray(mentorRole) && mentorRole.length > 0;
    }

    const isLearnerSelf = authEmail !== '' && authEmail === requestedLearnerEmail;
    const isOverseer = isRoot || isEditor || isMentor;

    // `userLookup` is a read-only overseer action (resolve a learner's Canvas user id so the
    // client can link to their Canvas grades), so it also admits mentors. Grade submission and
    // eligibility checks stay restricted to root/editor/self - a mentor must not post grades.
    if (mode === 'userLookup') {
      if (!isOverseer) {
        return new Response(JSON.stringify({ error: 'User is not authorized for this Canvas action' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else if (mode === 'grades' || mode === 'rosterGrades') {
      // Reading a learner's Canvas grades is a read-only overseer action (mentors included), or a
      // learner viewing their own grades. It never writes to Canvas.
      if (!isOverseer && !isLearnerSelf) {
        return new Response(JSON.stringify({ error: 'User is not authorized for this Canvas action' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else if (!isRoot && !isEditor && !isLearnerSelf) {
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

    const canvasApiAllPages = async (endpoint) => {
      const rows = [];
      let url = `https://byu.instructure.com/api/v1${endpoint}`;
      let pageCount = 0;
      while (url && pageCount < 100) {
        pageCount += 1;
        const response = await fetchFn(url, { headers: { Authorization: `Bearer ${canvasToken}`, 'Content-Type': 'application/json' } });
        const text = await response.text();
        let json = [];
        if (text) {
          try { json = JSON.parse(text); } catch { json = { raw: text }; }
        }
        if (!response.ok) throw new Error(`Canvas API error ${response.status}: ${JSON.stringify(json)}`);
        rows.push(...(Array.isArray(json) ? json : []));
        const link = response.headers.get('Link') || '';
        const next = link.match(/<([^>]+)>\s*;\s*rel="next"/i)?.[1];
        url = next && next.startsWith('https://byu.instructure.com/api/v1/') ? next : null;
      }
      if (url) throw new Error('Canvas pagination exceeded the safety limit.');
      return rows;
    };

    if (mode === 'rosterGrades') {
      if (!isOverseer) {
        return new Response(JSON.stringify({ error: 'User is not authorized for this Canvas action' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      try {
        const [users, assignments, enrollments] = await Promise.all([
          canvasApiAllPages(`/courses/${courseId}/users?enrollment_type[]=student&include[]=email&per_page=100`),
          canvasApiAllPages(`/courses/${courseId}/assignments?override_assignment_dates=false&include[]=all_dates&per_page=100`),
          canvasApiAllPages(`/courses/${courseId}/enrollments?type[]=StudentEnrollment&per_page=100`),
        ]);
        const startTime = payload.startDate ? new Date(payload.startDate).getTime() : -Infinity;
        const endTime = payload.endDate ? new Date(`${String(payload.endDate).slice(0, 10)}T23:59:59.999Z`).getTime() : Infinity;
        const baseDueAt = (assignment) => {
          if (Array.isArray(assignment?.all_dates)) {
            const baseDate = assignment.all_dates.find((date) => date?.base === true);
            if (baseDate?.due_at) return baseDate.due_at;
          }
          return assignment?.due_at ?? null;
        };
        const termAssignments = (assignments || []).filter((assignment) => {
          const dueAtValue = baseDueAt(assignment);
          if (!dueAtValue) return startTime === -Infinity && endTime === Infinity;
          const dueAt = new Date(dueAtValue).getTime();
          return Number.isFinite(dueAt) && dueAt >= startTime && dueAt <= endTime;
        });
        const termAssignmentDatesById = new Map(termAssignments.map((assignment) => [String(assignment.id), baseDueAt(assignment)]));
        const assignmentIds = termAssignments.map((assignment) => assignment.id).filter((id) => id != null);
        const requestedEmails = new Set((Array.isArray(payload.emails) ? payload.emails : []).map(normalizeEmail).filter(Boolean));
        const rosterUserIds = [...new Set((users || [])
          .filter((canvasUser) => {
            const email = normalizeEmail(canvasUser?.email || canvasUser?.login_id);
            return canvasUser?.id != null && (!requestedEmails.size || requestedEmails.has(email));
          })
          .map((canvasUser) => String(canvasUser.id)))];
        const submissions = [];
        const assignmentChunks = [];
        const studentChunks = [];
        for (let index = 0; index < assignmentIds.length; index += 40) assignmentChunks.push(assignmentIds.slice(index, index + 40));
        for (let index = 0; index < rosterUserIds.length; index += 80) studentChunks.push(rosterUserIds.slice(index, index + 80));
        const submissionTasks = [];
        for (const studentChunk of studentChunks) {
          for (const assignmentChunk of assignmentChunks) {
            const studentParams = studentChunk.map((id) => `student_ids[]=${encodeURIComponent(id)}`).join('&');
            const assignmentParams = assignmentChunk.map((id) => `assignment_ids[]=${encodeURIComponent(id)}`).join('&');
            submissionTasks.push(canvasApiAllPages(`/courses/${courseId}/students/submissions?${studentParams}&${assignmentParams}&include[]=assignment&per_page=100`));
          }
        }
        const submissionPages = await Promise.all(submissionTasks);
        for (const page of submissionPages) submissions.push(...page);
        const gradesByEmail = buildRosterGradeSummaries(users, submissions, enrollments, {
          emails: Array.isArray(payload.emails) ? payload.emails : [],
          startDate: payload.startDate || null,
          endDate: payload.endDate || null,
          termAssignmentIds: assignmentIds,
          termAssignmentDatesById,
        });
        return new Response(JSON.stringify({
          ok: true,
          gradesByEmail,
          studentCount: Object.keys(gradesByEmail).length,
          requestedCount: Array.isArray(payload.emails) ? payload.emails.length : 0,
          termAssignmentCount: termAssignments.length,
          undatedAssignmentsExcluded: (assignments || []).filter((assignment) => !baseDueAt(assignment) && (payload.startDate || payload.endDate)).length,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Eligibility-check mode: look up the learner in the Canvas course and return whether
    // they exist there. Used by the client to decide whether to show "Submit to Gradebook".
    if (mode === 'check') {
      try {
        const users = await canvasApi(`/courses/${courseId}/search_users?search_term=${encodeURIComponent(requestedLearnerEmail)}&enrollment_type[]=student`);
        const eligible = !!findCanvasLearner(users, requestedLearnerEmail);
        return new Response(JSON.stringify({ ok: true, eligible }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error) {
        // Treat Canvas lookup failures as "not eligible" so the UI hides the button; surface the
        // reason so the client can log it.
        return new Response(JSON.stringify({ ok: true, eligible: false, error: error?.message || String(error) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // User-lookup mode: resolve the learner's numeric Canvas user id so the client can build a
    // link to their Canvas grades page. Returns canvasUserId: null when the learner isn't found
    // in the Canvas course (or the lookup fails), so the UI simply hides the link.
    if (mode === 'userLookup') {
      try {
        const users = await canvasApi(`/courses/${courseId}/search_users?search_term=${encodeURIComponent(requestedLearnerEmail)}&enrollment_type[]=student`);
        const learner = findCanvasLearner(users, requestedLearnerEmail);
        return new Response(JSON.stringify({ ok: true, canvasUserId: learner?.id ?? null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({ ok: true, canvasUserId: null, error: error?.message || String(error) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Grades mode: read a learner's current Canvas grades (overall + per-assignment) for display.
    // Returns found: false (not an error) when the learner isn't in the Canvas course so the UI can
    // say so; a Canvas failure returns ok: false with the reason for the client to surface.
    if (mode === 'grades') {
      try {
        const users = await canvasApi(`/courses/${courseId}/search_users?search_term=${encodeURIComponent(requestedLearnerEmail)}&enrollment_type[]=student`);
        const learner = findCanvasLearner(users, requestedLearnerEmail);
        if (!learner) {
          return new Response(JSON.stringify({ ok: true, found: false, overall: null, assignments: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const [submissions, enrollments] = await Promise.all([
          canvasApi(`/courses/${courseId}/students/submissions?student_ids[]=${learner.id}&include[]=assignment&per_page=100`),
          canvasApi(`/courses/${courseId}/enrollments?user_id=${learner.id}&type[]=StudentEnrollment`),
        ]);
        let assignmentDueDates;
        if (payload.includeAssignmentDueDates === true) {
          const courseAssignments = await canvasApiAllPages(`/courses/${courseId}/assignments?override_assignment_dates=false&include[]=all_dates&per_page=100`);
          const courseAssignmentsById = new Map(courseAssignments.map((assignment) => [String(assignment.id), assignment]));
          const submissionAssignments = (Array.isArray(submissions) ? submissions : [])
            .map((submission) => submission?.assignment)
            .filter((assignment) => assignment?.id != null && assignment?.name);
          const assignmentIds = [...new Set(submissionAssignments.map((assignment) => String(assignment.id)))];
          // The assignment embedded in a submission may carry another student's override date.
          // Canvas's effective_due_dates response is keyed by assignment ID and student ID, so
          // select the date for the exact learner being analyzed.
          const effectiveDueDates = assignmentIds.length
            ? await canvasApi(`/courses/${courseId}/effective_due_dates?${assignmentIds.map((id) => `assignment_ids[]=${encodeURIComponent(id)}`).join('&')}`)
            : {};
          const seen = new Set();
          assignmentDueDates = (Array.isArray(submissions) ? submissions : []).flatMap((submission) => {
            const assignment = submission?.assignment;
            if (!assignment?.name) return [];
            const id = String(assignment.id ?? submission.assignment_id ?? '');
            if (seen.has(id)) return [];
            seen.add(id);
            const courseAssignment = courseAssignmentsById.get(id);
            const dates = Array.isArray(courseAssignment?.all_dates) ? courseAssignment.all_dates : [];
            const baseDate = dates.find((date) => date?.base === true);
            const learnerEffectiveDueAt = effectiveDueDates?.[id]?.[String(learner.id)]?.due_at ?? null;
            return [{
              id: assignment.id ?? submission.assignment_id ?? null,
              name: String(assignment.name),
              learnerDueAt: learnerEffectiveDueAt,
              courseDueAt: courseAssignment?.due_at ?? null,
              baseDueAt: baseDate?.due_at ?? courseAssignment?.due_at ?? null,
            }];
          });
        }
        return new Response(JSON.stringify({
          ok: true,
          found: true,
          ...buildGradeSummary(submissions, enrollments),
          ...(assignmentDueDates ? { assignmentDueDates } : {}),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({ ok: false, found: false, overall: null, assignments: [], error: error?.message || String(error) }), {
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

    const VALID_TOPIC_TYPES = ['exam', 'project', 'dra', 'interview', 'mastery', 'attendance'];
    if (!VALID_TOPIC_TYPES.includes(topicType)) {
      return new Response(JSON.stringify({ error: `topicType must be one of: ${VALID_TOPIC_TYPES.join(', ')}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // The course-level "mastery" and "attendance" assignments are auto-graded and updated frequently, so they post
    // the grade only - no submission and no comment (a comment on every mastery change would spam
    // the submission thread).
    const isGradeOnly = topicType === 'mastery' || topicType === 'attendance';
    const autoGrade = isGradeOnly ? true : payload.autoGrade === undefined ? topicType === 'exam' : payload.autoGrade === true;
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

      const learner = findCanvasLearner(users, requestedLearnerEmail);

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
        // Mastery and attendance updates are grade-only; everything else attaches the MasteryLS feedback comment.
        ...(isGradeOnly
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
