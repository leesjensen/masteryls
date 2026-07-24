# SIGCSE Paper Planning

## Working Title

**MasteryLS: A Git-Native, AI-Augmented Learning Management System for Mastery-Based Learning Across Disciplines**

Alternates:
- *From Markdown to Mastery: Accelerating Content Development and Feedback with AI and Git, Across Any Discipline*
- *AI Throughout the Loop: Domain-Agnostic Content Authoring, Feedback, and Simulated-Practice Assessment in a Git-Backed LMS*

Framing note: MasteryLS itself is discipline-agnostic — the content model, authoring pipeline, and assessment framework (see the Disciplinary Reasoning Assessment topic type, Section 5.3) are explicitly designed to generalize across fields. This is a design claim backed by two tiers of evidence (see Section 8, and note the distinction carefully — do not conflate them in the writing):
1. **Real deployment** (live courses, real students): three BYU CS courses — CS 260 Web Programming, CS 240 Advanced Software Construction, CS 329 Quality Assurance and DevOps.
2. **Prototype exploration** (not deployed to a live course, used to validate the tool works well outside CS): HCI, Electrical Engineering, Chemical Engineering, Legal, Religious Education, and Agricultural content/scenarios.

For a SIGCSE audience, CS is the real deployment context/case study; the other disciplines are cross-domain feasibility evidence, not deployment evidence, and must be labeled as such throughout the paper.

## Authors

- **Lee S. Jensen**, lee@cs.byu.edu, Department of Computer Science, Brigham Young University.

ACM policy (which governs SIGCSE proceedings) does not permit listing an AI tool as an author — authors must be identified human beings who take responsibility for the content, per ACM's Policy on Authorship. Use of generative AI in preparing the paper is required to be disclosed instead, typically as a brief acknowledgment/disclosure statement (e.g., in Acknowledgments or a methods note), not a byline. Suggested disclosure line for later drafting: *"The authors used [tool/model] to assist with [drafting/outlining/analysis]; all content was reviewed and is the responsibility of the human author(s)."* Confirm exact wording against the current SIGCSE TS 2027 CFP disclosure requirements before submission.

Sources:
- [Policies on Generative AI, LLMs, and Related Tools](https://respect.acm.org/2026/index.php/policies-on-generative-ai-llms-and-related-tools/)

## Target Venue and Format

- **Venue**: SIGCSE Technical Symposium, standard Papers track, full paper.
- **Format**: ACM two-column SIG Proceedings format, US letter. **6 body pages maximum; references may spill onto an optional 7th page (nothing else may go there — no appendices).**
- **Abstract**: plain text, up to 250 words, no subheadings or citations.
- **Implication**: the outline below is intentionally broader than 6 pages will hold. Section 5.3–5.4 (DRA/Interview) is the strongest, most novel material and should get the largest allocation; Sections 6–7 (AI-mediated interactions, analytics) are candidates to compress into shorter subsections or a single combined section during drafting. A suggested page budget is in each section below (target ≈ 6.0 body pages total; treat these as a starting allocation, not a hard rule).

## Outline

### 1. Introduction — *budget ≈ 0.75 page*
- Problem: authoring and maintaining course content is slow; feedback/grading at scale is a bottleneck; existing LMS platforms (Canvas, Moodle) treat AI as a bolt-on, not a core design principle; content lives in proprietary databases, not developer-native tooling. These problems are not unique to any one discipline.
- Insight: a Git/Markdown-based content model generalizes across fields, and pairing it with AI at the authoring, feedback, and assessment layers accelerates content development and enables authentic, scenario-based assessment that would be impractical to build and grade by hand at scale.
- Contribution statement (3–4 bullets, matching project focus):
  1. A GitHub-native, domain-agnostic content model that brings version control, diffing, and multi-author collaboration to LMS authoring.
  2. AI-assisted content generation integrated directly into the authoring workflow (course/topic/quiz generation), usable regardless of subject matter.
  3. A unified interaction model where AI grading and feedback (essay, teaching, repo-based submissions) is a first-class, declarative part of course content rather than a separate grading system.
  4. A generative, cross-disciplinary scenario-based assessment framework (Disciplinary Reasoning Assessment) and its applied specialization for career-readiness practice (Interview), which simulate authentic professional reasoning and evaluate process, competency, and disposition.
  5. Deployment in three real CS courses (BYU CS 260, CS 240, CS 329) plus cross-domain prototype exploration in six additional disciplines (HCI, Electrical Engineering, Chemical Engineering, Legal, Religious Education, Agricultural), offered as feasibility evidence for generality beyond CS.
- Note where CS fits: this paper presents MasteryLS as a general-purpose, AI-native LMS and reports on its real deployment in three CS courses at BYU as the primary case study for a SIGCSE audience, alongside prototype evidence of cross-domain feasibility in other disciplines.
- Scope honesty, stated up front: this is a **systems/tool paper describing design and deployment experience**, not a controlled outcomes study. No learner-outcome data or student-feedback survey has been collected yet (see Sections 8–9). The contribution is the architecture, the novel cross-disciplinary assessment framework, and qualitative deployment breadth — future work is a validation study (Section 10).

### 2. Related Work — *budget ≈ 0.5 page*
- Traditional LMS platforms (Canvas, Moodle, Open edX) and their content/versioning limitations.
- Git-backed/docs-as-code educational tooling (e.g., MkDocs-based courses, GitHub Classroom) — MasteryLS extends this to a full, discipline-agnostic LMS with grading and tracking, not just CS-specific autograding infrastructure.
- AI in education broadly (not CS-specific): automated feedback/grading of open-ended work, conversational tutors, AI-assisted content generation for instructors, across disciplines.
- AI in CS education specifically (autograders, LLM-based code/repo grading) as one instance of the broader pattern MasteryLS generalizes.
- Scenario-based, authentic, and simulation-based assessment (e.g., standardized-patient simulations in medical/nursing education, case-based learning in business and law) as pedagogical precedent for the Disciplinary Reasoning Assessment and Interview topic types.
- Mastery learning and competency-based education systems.
- Positioning: MasteryLS is distinct in combining Git-native content, AI-assisted authoring, and AI-native assessment/tutoring — including a generative cross-disciplinary simulation framework — in one deployed system rather than as separate, subject-specific research prototypes.

### 3. System Overview and Architecture — *budget ≈ 0.5 page*
- High-level architecture: React SPA + Supabase (auth, DB, edge functions) + GitHub (content) + Gemini (AI) + optional Canvas sync.
- Design principle: GitHub = canonical content; Supabase = operational data (users, roles, enrollment, progress); AI mediated through server-side edge functions (no client-side secrets).
- Data/course model: `course.json`, modules, topics, `masteryls` interaction fences embedded directly in Markdown.
- Why this matters pedagogically/technically: portability, auditability, low lock-in, works with existing developer/content workflows regardless of discipline.

### 4. Accelerating Content Development with GitHub and AI — *budget ≈ 0.75 page*
- Markdown-first authoring vs. WYSIWYG/HTML editors; Monaco-based editor with hotkeys, diffing, changed-line markers.
- Git-backed workflow: commit history, diff/revert, multi-instructor collaboration, delete protection.
- AI-assisted authoring pipeline: description → AI-generated course skeleton (modules/topics) → stub-to-draft topic generation → section generation, selective rewrite, review/spellcheck, image generation.
- Recommended human-in-the-loop workflow (draft → review → refine) and why full automation is avoided.
- Cross-disciplinary feasibility: beyond the three deployed BYU CS courses, the authoring pipeline has been exercised as a prototype to generate content for HCI, Electrical Engineering, Chemical Engineering, Legal, Religious Education, and Agricultural topics — none deployed to a live course, but useful as evidence the pipeline is not tied to any one content domain (a religious-education topic and an electrical-engineering topic place very different demands on generated content, which is a strong pair to contrast briefly if space allows). State clearly that these are prototype explorations, not deployed courses.
- No timing/comparison data exists yet for AI-assisted vs. manual authoring — state this as a qualitative claim (breadth of disciplines successfully authored, real and prototype) rather than a quantitative one, and flag the timed-authoring study as future work (Section 10).

### 5. AI-Driven Feedback and Assessment — *budget ≈ 0.75 page (5.1–5.2 combined)*
#### 5.1 Interaction Model Overview
- Declarative interaction model: interaction types embedded as fenced blocks in Markdown (multiple-choice, multiple-select, essay, teaching, prompt, file/URL/GitHub-submission, web-page/ai-web-page).
- Distinguish auto-scored (objective) vs. AI-graded (rubric-based) vs. AI-conversational (teaching) assessment.
- Grading integrity/consistency controls: `gradingCriteria`, `autoGrade` vs `syncGrade`, mentor override of AI scores, Canvas gradebook sync.
- Design tension: automation vs. instructor authority — mentors can always overwrite AI feedback.

#### 5.2 GitHub-Submission Grading
- AI evaluates a live learner repository against an instructor rubric and returns file-grounded feedback (citing real paths) — a distinctive contribution relevant to programming-heavy courses, but generalizable to any discipline that produces artifact-based, file-based deliverables.

#### 5.3–5.4 combined — *budget ≈ 1.25–1.5 pages (the paper's flagship contribution; give it the most space and, if room allows, one figure — e.g. the stage-mapping table or the assessment-flow state diagram)*

#### 5.3 Disciplinary Reasoning Assessment (DRA) — a Cross-Disciplinary Simulation Framework
- **Core idea**: rather than authoring a fixed scenario, the instructor authors only *generation parameters* — target discipline, problem type, difficulty (1–5), enabled modes (practice/final), optional instability events, and intended learning outcomes. The full scenario (stakeholders, resources, constraints, inflection points) is generated by AI at learner runtime from those parameters, making the framework explicitly domain-independent rather than CS-specific.
- **Six universal disciplinary stages** (Frame, Research, Model, Act, Validate, Reflect), each given a discipline-specific interpretation by AI. This is the paper's strongest evidence for cross-disciplinary generality — cite the framework's own worked mapping across Software Engineering, Biology, History, and Accounting (e.g., "Frame" = clarify stakeholders/constraints in SE vs. define the biological question in Biology vs. define the historical problem in History vs. clarify the financial issue in Accounting).
- **Investigation loop**: learner interviews AI-played stakeholders/resources (each with a personality and bounded knowledge), records reasoning (understanding, assumptions, unknowns, hypotheses, decisions, evidence, confidence), and receives continuous AI coaching (practice mode) or withheld feedback until completion (final mode).
- **Difficulty as a six-lever design space**: information disclosure, stage-hint specificity, stakeholder cooperativeness, coaching directiveness, evaluation bar, and constraint conflict — all calibrated together so difficulty shifts the experience coherently from scaffolded tutorial to unguided professional challenge.
- **Evidence-grounded evaluation**: an AI observation agent scores Process (the six stages), Competency (systems thinking, communication, design reasoning, evidence-based reasoning, decision-making), and Disposition (curiosity, ownership, integrity, persistence, empathy, accountability), each backed by polarity/impact-weighted evidence extracted from transcripts — not just a holistic AI judgment. Ratings cannot exceed what evidence supports.
- **Portfolio**: completed assessments accumulate into an exportable, cross-scenario portfolio showing a trajectory of growth rather than isolated grades.
- **Deployment status**: DRA has been deployed within the real BYU CS course case studies (Section 8) and additionally prototyped — as feasibility exploration only, not live-course deployment — in Legal and other non-CS disciplines. Be precise about this distinction in the writing rather than implying all disciplines were deployed equally.
- Positioning for the paper: DRA is the clearest demonstration that MasteryLS's AI-assessment model is not a CS-specific autograder but a general framework for authentic, evidence-based reasoning assessment usable in any field with a "diagnose a situation and justify a course of action" structure. The SE/Biology/History/Accounting stage-mapping table (built into the framework's own design) illustrates the intended generality; the Legal prototype is a first concrete (if informal) step toward validating it beyond CS.
- Honesty check: no learner-outcome or satisfaction data has been collected from any DRA run yet, deployed or prototype (see Section 8/9).
- **Figure placeholder**: `[FIGURE: DRA scenario/investigation screenshot — TBD, to be supplied]`; `[FIGURE: DRA evaluation/portfolio view — TBD, to be supplied]`. No DRA/Interview screenshots exist in the project docs folder yet; the Editor and Learner tutorials only cover the standard interaction types (see Section 5.1 figures below). Placeholder callouts left inline until real screenshots/demonstrations are provided.

#### 5.4 Interview — Applied Specialization for Career-Readiness Practice
- A second topic type built on the same generative-scenario and evidence-scored evaluation engine as DRA, specialized for job-interview practice rather than open-ended disciplinary investigation.
- Author parameters: discipline, job title, job description, difficulty, learning outcomes, and enabled modes (practice/final) — deliberately mirroring DRA's authoring model.
- At runtime, AI generates an interview scenario with multiple structured sessions, each with one or more AI-played interviewer personas; the learner practices across sessions and can request coaching in practice mode.
- Evaluation reuses DRA's scoring machinery: per-session ratings plus Competency and Disposition dimensions combine into an overall score and rating band, with the same evidence-weighted calculation.
- Significance: shows the DRA framework is reusable/extensible beyond its original scenario-investigation shape — the same evidence-based, multi-dimensional assessment engine powers a structurally different but related use case (interview practice), reinforcing the paper's generalizability claim.
- Deployment status: same caveat as DRA above — used within the real CS course deployments plus non-CS prototype exploration; no outcome data yet.
- **Figure placeholder**: `[FIGURE: Interview session/evaluation screenshot — TBD, to be supplied]`.

### 6. AI-Mediated Learning Interactions — *budget ≈ 0.5 page*
- Topic-aware `Discuss` panel: contextual Q&A scoped to current lesson content, section-level discussion entry points.
- `Teaching` interaction: learner explains a concept back to the AI, which scores understanding conversationally — an application of the "protégé effect" / learning-by-teaching pedagogy.
- Notes capture and how AI-assisted study interacts with self-directed learning.
- Framing for SIGCSE: connect to existing pedagogy literature on retrieval practice, formative feedback, and dialogic tutoring.
- Candidate for compression: if space is tight, fold this into Section 5.1 as a short paragraph rather than a standalone section — it is real functionality but not the paper's novel contribution.

### 7. Mastery Tracking and Analytics — *budget ≈ 0.25–0.5 page*
- MasteryView (learner/course-level mastery summary), Progress/Activity log, Metrics (time-on-task, trends).
- Observe mode for instructor support/debugging.
- How analytics close the loop with AI feedback and Canvas gradebook sync.
- Candidate for compression: same as Section 6 — keep to a short paragraph unless it directly supports a claim made elsewhere (e.g., citing MasteryView/Progress as the mechanism that *would* produce outcome data in a future study).

### 8. Deployment Experience Across Disciplines — *budget ≈ 0.75 page*
No hard usage data, learner-outcome data, or student-feedback surveys have been collected. This section is a **qualitative deployment narrative**, not an evaluation — say so explicitly rather than implying rigor that isn't there. Keep the two tiers clearly separated in the writing; do not let "prototype exploration" read as "deployed."

- **Tier 1 — Real deployment (live BYU CS courses)**:
  - CS 260, Web Programming
  - CS 240, Advanced Software Construction
  - CS 329, Quality Assurance and DevOps
  - `[PLACEHOLDER: one sentence per course — what content/interactions/DRA-Interview usage looked like in each, to be supplied]`
- **Tier 2 — Prototype/feasibility exploration (not deployed to a live course)**: content and/or scenario generation exercised for HCI, Electrical Engineering, Chemical Engineering, Legal, Religious Education, and Agricultural topics, specifically to validate that MasteryLS's authoring and DRA frameworks work well outside CS. State explicitly: **no students, no live course, no outcome data** for this tier — its value is existence-proof of cross-domain feasibility, not deployment evidence.
- **What we do not have**: no controlled comparison, no timing data, no learner-outcome measures, no instructor/student satisfaction survey, for either tier. State this plainly as scope, not as an apology.
- **Table candidate**: a compact table with two clearly labeled blocks — "Deployed (BYU CS)" vs. "Prototype exploration (non-CS)" — crossed with MasteryLS capability used (content generation / DRA / Interview / standard interactions) is likely the single highest-value visual for this section given the 6-page budget.
- **Figure/example placeholders**: `[PLACEHOLDER: DRA or Interview demonstration/screenshot from one of the deployed CS courses — to be supplied]`; `[PLACEHOLDER: prototype content-generation example from a non-CS discipline, e.g. Religious Education or Chemical Engineering — to be supplied]`.

### 9. Discussion — *budget ≈ 0.5 page*
- Benefits: content portability, transparency of AI grading (criteria are explicit and inspectable), reduced instructor overhead, tight authoring-to-deployment loop, and a single assessment framework (DRA) that generalizes across disciplines instead of requiring bespoke tooling per field.
- Cross-disciplinary generality: point back to the three real BYU CS course deployments plus the six-discipline prototype exploration (Section 8) — careful to present the former as deployment evidence and the latter as feasibility evidence, not to blur the two into one undifferentiated "used in N disciplines" claim.
- Limitations/risks: AI grading reliability and bias, academic integrity considerations for AI-generated content and AI-assisted submissions, security/privacy considerations (token handling, content sanitization — informed by internal `codexAnalysis.md` review), the explicit absence of outcome/satisfaction data (Section 8), and the fact that cross-disciplinary generality beyond CS currently rests on prototype exploration rather than live-course deployment.
- Instructor control mechanisms as a mitigation (override, rubric transparency, autoGrade toggle).

### 10. Conclusion and Future Work — *budget ≈ 0.25 page*
- Recap contributions, emphasizing the architecture + DRA/Interview framework + multi-discipline deployment breadth as the paper's contribution triad (since there is no outcomes study to lead with).
- Future work, in priority order:
  1. Deploy MasteryLS content authoring and DRA/Interview beyond CS into a real course in at least one prototype discipline (e.g., Legal, Chemical Engineering) to convert feasibility evidence into deployment evidence.
  2. A validation study collecting learner-outcome and satisfaction data from the CS 260/240/329 deployments (and, once available, a non-CS deployment).
  3. A timed or comparative study of AI-assisted vs. manual content authoring.
  4. Adaptive sequencing, expanded interaction types, richer analytics.

## Figures Inventory
- **Already available** (from `docs/` and `docs/features/`, standard interaction/UI screenshots — reusable for Sections 3–7): dashboard, content, editor toolbar/editMode, commit history, mcInteraction, multiselectInteraction, essayInteraction, surveyInteraction, likertInteraction, fileInteraction, urlInteraction, githubInteraction, teachingInteraction, promptInteraction, simpleWebPageInteraction, aiWebPageInteraction, hicksLawInteraction, masteryView, activity/progress, metrics, discuss, observeMode, github(repo)/commits, canvas export, architecture diagram, project structure diagram, database schema diagram.
- **Not yet available — placeholders left inline in Sections 5.3/5.4/8**: any DRA screenshot (scenario, investigation/interview, reasoning record, evaluation/portfolio view), any Interview screenshot (session, evaluation), and any deployed-course or prototype-discipline demonstration image (CS 260/240/329 specific views; non-CS prototype content examples). Fill these in once available — do not draft final figure captions until real images are supplied.

## Remaining Open Questions
1. For each of CS 260, CS 240, and CS 329: what MasteryLS capabilities were actually used (standard interactions, AI content generation, DRA, Interview)? This determines what can be said about each course individually in Section 8 versus what must stay at the "MasteryLS was deployed" level.
2. For the six prototype-exploration disciplines (HCI, Electrical Engineering, Chemical Engineering, Legal, Religious Education, Agricultural): which specifically used content generation vs. DRA/Interview vs. both? Right now the outline treats "course content" as covering both, but that should be confirmed.
3. For each DRA/Interview discipline explored, is there a short, illustrative scenario or stage example you can share (like the Frame/Research/... table already sketched for SE/Biology/History/Accounting) to use as a real figure/table in Section 5.3/8, once ready?
4. Institutional affiliation for the SIGCSE submission — confirmed as BYU (via lee@cs.byu.edu); confirm department/school name as it should appear on the title page (e.g., "Department of Computer Science, Brigham Young University").
