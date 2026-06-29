import service from '../service/service';
import { normalizeInteractionIds } from '../utils/interactionMeta';

const mermaidDefaultClassDef = 'classDef default fill:#ffffff,stroke:#000000,color:#000000,stroke-width:1px;';
const mermaidTheme = "%%{init: { 'theme': 'neutral', 'themeVariables': { 'mainBkg': '#ffffff', 'lineColor': '#000000', 'primaryTextColor': '#000000', 'actorBorder': '#000000', 'participantBorder': '#000000', 'noteBorderColor': '#000000' } }}%%";

/**
 * Generates a course structure in JSON format using AI, based on the provided title and description.
 *
 * @async
 * @param {string} title - The exact title of the course to be generated.
 * @param {string} description - The description of the course, relevant to the topics included.
 * @returns {Promise<string>} A promise that resolves to a raw JSON string representing the course structure.
 *
 * @example
 * const courseJson = await aiCourseGenerator("Introduction to AI", "Learn the fundamentals of artificial intelligence.");
 */
export async function aiCourseGenerator(title, description) {
  title = title.trim();
  description = description.trim();

  const prompt = `You are an expert educational content creator.
Generate a JSON object that contains an appropriate number of modules and topics for a course.
Each module should have a title and a list of topics with titles and descriptions. The progression of the modules and topics should be logical and pedagogically sound.

Course title: ${title}
Course description: ${description}

The JSON must be structured according to the following example:

{
  "title": "Example Course Title",
  "description": "Example course description that is relevant to the topics included.",
  "modules": [
    {
      "title": "Example module title",
      "description": "Description for example module.",
      "topics": [
        { "title": "Overview", "description": "Course introduction and objectives.", "path": "README.md", "type": "instruction", "state": "published" },
        { "title": "Topic title", "description": "Description for topic.", "path": "instruction/topic-1/topic-1.md", "type": "instruction", "state": "stub" },
        { "title": "Topic title", "description": "Description for topic.", "path": "instruction/topic-2/topic-2.md", "type": "instruction", "state": "stub" },
        { "title": "Topic title", "description": "Description for topic.", "path": "instruction/topic-3/topic-3.md", "type": "instruction", "state": "stub" }
      ]
    }
  ]
}                 

Requirements:
- The course content should be relevant to the title and description provided
- Focus on clear, educational content that would be useful for learners
- Return a raw JSON object that is not surrounded by a markdown code fence
- The JSON object must include a title and modules array
- Each module must include a title, description, and topics array
- Each topic must include a title, description, a path, a type set to "instruction", and a state set to "stub"
- Do not number the titles of modules or topics
- The first topic of the first module must be "Overview" with path "README.md" and a state set to "published"
- The path for other topics should follow the format "instruction/topic-name/topic-name.md" where topic-name is a lowercase, hyphenated version of the topic title
- The course title should match the provided title exactly
- The course description should be relevant to the topics included
- The course should have 3 modules
- There should be around 30 topics spread evenly across the modules
- Each module should teach a distinct subset of topics for the overall course material, but all modules should work together to achieve the learning outcomes implied by the course title and description
- The course contains a capstone project that integrates the topics covered in each module
- Each topic should have a concise, descriptive title
- Each topic should have a description that contains a prompt for the AI to generate content for that topic, and the description should be relevant to the course title and description
`;
  return makeSimpleAiRequest(prompt);
}

/**
 * Generates comprehensive, well-structured markdown content for an instructional topic using AI.
 *
 * @async
 * @function aiTopicGenerator
 * @param {string} courseDescription - A description of the course.
 * @param {string} title - The title of the instructional topic.
 * @param {string} description - A description of the instructional topic.
 * @returns {Promise<string>} A promise that resolves to the generated markdown content.
 */
export async function aiTopicGenerator(courseDescription, title, description, moduleTitle, otherTopicDescriptions) {
  const prompt = `You are an expert educational content creator.
Generate comprehensive, well-structured markdown content for online courses.
Focus on clear explanations, practical examples, and pedagogically sound structure.

Create comprehensive markdown content for an instructional topic titled "${title}".

Topic Description: ${description}
Module Title: ${moduleTitle}
Other topics in the Module: ${otherTopicDescriptions}
Course Description: ${courseDescription}

Requirements:
- Start with a level 1 heading using only the exact title
- Use proper markdown formatting
- Include overview but do not label it as "Overview"
- Include relevant subsections with appropriate markdown heading levels
- Do not number headings
- Do not over create bulleted lists with multiple levels
- Make content educational and engaging
- Prefer textual prose
- If you include a Mermaid diagram, include this line in the diagram to enforce white background and black lines/text: ${mermaidDefaultClassDef}
- Include practical examples where applicable
- Include references to external resources if relevant
- Encourage thoughtful engagement with the material
- Include common challenges and solutions
- Provide a summary`;

  return makeSimpleAiRequest(prompt);
}

export async function aiExamGenerator(courseDescription, title, description) {
  const prompt = `You are an expert educational content creator. 

Create markdown content for an instructional exam.

Topic Description: ${description}
Course Description: ${courseDescription}

Generate 10 multiple choice or essay questions of the format:

### Example question title
\`\`\`masteryls
{"id":"" "title":"Multiple choice", "type":"multiple-choice"}
Simple **multiple choice** question
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`

### Example question title
\`\`\`masteryls
{"id":"" "title":"Question title", "type":"essay" }
question body
\`\`\`

- Start with a level 1 heading using only the exact title
- Use proper markdown formatting
- Include overview but do not label it as "Overview"
- Test on a first year university level student level
- base questions on the topic ${title}
- base questions on the content ${description}
- prefer coding questions where applicable`;

  const response = await makeSimpleAiRequest(prompt);
  return normalizeInteractionIds(response);
}

/**
 * Generates a Disciplinary Reasoning Assessment scenario from the author's published
 * parameters. Generation happens at learner runtime, not at authoring time.
 *
 * @async
 * @param {Object} params - The author's published assessment parameters.
 * @param {string} params.discipline - The target discipline.
 * @param {string} params.problemType - The type of problem to present.
 * @param {number} params.difficulty - Difficulty from 1 (easy) to 5 (hard).
 * @param {boolean} params.instability - Whether instability events are enabled.
 * @param {string} params.learningOutcomes - The intended learning outcomes.
 * @returns {Promise<{scenario: {title: string, summary: string, description: string}, stakeholders: Array<{name: string, role: string, personality: string, objectives: string}>, resources: Array<{name: string, type: string, description: string}>, constraints: Array<{name: string, description: string}>, stages: Array<{stage: string, interpretation: string}>}>}
 */
export async function aiDraScenarioGenerator({ discipline, problemType, difficulty, instability, learningOutcomes }) {
  const prompt = `You are designing an authentic, real-world scenario for a disciplinary reasoning assessment.
The learner will demonstrate mastery by investigating the scenario, interviewing stakeholders, and consulting resources.

Generate a scenario for:
- Discipline: ${discipline || 'general'}
- Problem type: ${problemType || 'open-ended problem'}
- Difficulty (1 easy to 5 hard): ${difficulty ?? 3}
- Intended learning outcomes: ${learningOutcomes || 'develop, justify, and refine a response to an authentic problem'}
${instability ? '- The scenario should be amenable to unexpected changes (instability events) introduced later.' : ''}

Return a raw JSON object (no markdown code fence) with exactly this shape:
{
  "scenario": {
    "title": "short scenario name",
    "summary": "1-2 sentence high-level description of the situation and goal, with NO technical details, numbers, stakeholders, or resources named",
    "description": "2-4 paragraph detailed scenario including concrete constraints, technical details, and a clear goal"
  },
  "stakeholders": [ { "name": "person or role name", "role": "their role in the scenario", "personality": "how they communicate", "objectives": "what they want" } ],
  "resources": [ { "name": "artifact, system, or place", "type": "person | artifact | system | data | environment", "description": "what it offers the investigation" } ],
  "constraints": [ { "name": "constraint name, e.g. Budget, Target completion date, Regulatory restrictions", "description": "the specific limit or requirement it imposes" } ],
  "stages": [ { "stage": "Frame", "interpretation": "what this stage means for this specific scenario and discipline" } ]
}

Requirements:
- Provide 3 to 5 stakeholders, 2 to 4 resources, and 2 to 4 constraints
- Constraints are the boundaries the response must respect (budget, deadlines, regulatory or technical restrictions, staffing limits, ...)
- Provide exactly these six stages in this order: Frame, Research, Model, Act, Validate, Reflect — each with a discipline-specific interpretation grounded in this scenario
- The summary must remain high-level so it can be shown even when details are withheld; the description carries the full detail
- Make the scenario specific and grounded in the named discipline
- Calibrate complexity to the difficulty level
- Return only the JSON object`;

  const response = await makeSimpleAiRequest(prompt);
  return parseJsonResponse(response);
}

/**
 * Generates an in-character response from a scenario stakeholder or resource during a
 * Disciplinary Reasoning Assessment investigation. The agent role-plays the target and
 * reveals information only in response to relevant questions.
 *
 * @async
 * @param {{title?: string, summary?: string, description?: string}} scenario - The generated scenario context.
 * @param {{name?: string, role?: string, personality?: string, objectives?: string, type?: string, description?: string}} target - The stakeholder or resource being interviewed/consulted.
 * @param {Array<{role: 'user'|'model', text: string}>} messages - The conversation so far.
 * @returns {Promise<string>} The in-character reply as GitHub-flavored markdown.
 */
export async function aiDraStakeholderResponseGenerator(scenario, target, messages, stakeholders = [], resources = []) {
  const isStakeholder = Boolean(target?.role) || (target?.type || 'stakeholder') === 'stakeholder';
  const persona = isStakeholder
    ? `You are ${target?.name || 'a stakeholder'}, ${target?.role || 'a stakeholder'} in this scenario.
Personality: ${target?.personality || 'professional and direct'}.
Your objectives: ${target?.objectives || 'represent your interests honestly'}.`
    : `You represent "${target?.name || 'a resource'}" (${target?.type || 'resource'}), an information resource in this scenario.
What it offers: ${target?.description || 'relevant information for the investigation'}.`;

  const knownPeople = [
    ...stakeholders.map((s) => `- ${s.name} (${s.role})`),
    ...resources.map((r) => `- ${r.name} (${r.type || 'resource'})`),
  ].join('\n');

  const instructionText = `You are a role-play partner in a disciplinary reasoning assessment.

SCENARIO: ${scenario?.title || ''}
${scenario?.description || scenario?.summary || ''}

${persona}

Known people and resources in this scenario:
${knownPeople || '(none listed)'}

Guidelines:
- Stay fully in character and respond as ${target?.name || 'this target'} would.
- Reveal information only in response to relevant questions; do not volunteer the whole picture at once.
- Be concise (under 150 words) and use plain GitHub-flavored markdown.
- Do not evaluate the learner, give away the "answer", or break character.
- When referring to other people or resources, use only the exact names listed above. Do not invent names.`;

  const instructions = { parts: [{ text: instructionText }] };
  const contents = (messages || [])
    .filter((msg) => msg.role === 'user' || msg.role === 'model')
    .map((msg) => ({ role: msg.role, parts: [{ text: msg.text }] }));

  return makeAiRequest(instructions, contents);
}

/**
 * Observation/assessment agent for a Disciplinary Reasoning Assessment. Evaluates the
 * learner's reasoning and competency (not their artifact) from the investigation so far,
 * across Process, Competency, and Disposition dimensions.
 *
 * @async
 * @param {{title?: string, description?: string, summary?: string}} scenario - The scenario context.
 * @param {Array<{name?: string, role?: string, messages: Array<{role: 'user'|'model', text: string, stage?: string}>}>} transcripts - Interview/consultation transcripts.
 * @param {object} reasoningRecord - The learner's recorded reasoning fields.
 * @returns {Promise<object>} The evaluation: { process, competency, disposition } each with rating/summary/attributes[].
 */
export async function aiDraEvaluationGenerator(scenario, transcripts, reasoningRecord) {
  const transcriptText = (transcripts || [])
    .filter((t) => (t.messages || []).length > 0)
    .map((t) => {
      const lines = t.messages.map((m) => `${m.role === 'user' ? 'Learner' : t.name || 'Target'}: ${m.text}`).join('\n');
      return `### ${t.name || 'Target'}${t.role ? ` (${t.role})` : ''}\n${lines}`;
    })
    .join('\n\n');

  const reasoningText = Object.entries(reasoningRecord || {})
    .filter(([, v]) => String(v || '').trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const prompt = `You are the observation and assessment agent for a disciplinary reasoning assessment.
Evaluate the learner's reasoning and competency (NOT any final artifact) based only on the evidence below.

SCENARIO: ${scenario?.title || ''}
${scenario?.description || scenario?.summary || ''}

INVESTIGATION TRANSCRIPTS:
${transcriptText || '(no interviews conducted yet)'}

REASONING RECORD:
${reasoningText || '(empty)'}

Assess three dimensions. For each overall dimension and each of its attributes, give a rating (exactly one of: Beginning, Emerging, Developing, Proficient, Exemplary), a one-sentence summary, and supporting evidence drawn from the learner's actual behavior.

- Process attributes: Framing, Research, Modeling, Action, Validation, Reflection
- Competency attributes: Systems thinking, Communication, Design reasoning, Evidence-based reasoning, Decision-making
- Disposition attributes: Curiosity, Ownership, Integrity, Persistence, Empathy, Accountability

Also identify any concerns — things the learner did that were inappropriate, harmful, unethical, or showed seriously poor judgment (e.g. violating confidentiality, acting outside their authority, ignoring critical evidence, making harmful recommendations, or deceiving stakeholders). Only flag genuine problems, not merely suboptimal choices. For each concern assign a severity: Minor (poor judgment, minor lapse), Moderate (clear breach of process or ethics), or Major (harmful, deceptive, or seriously unethical action).

For each attribute's evidence, return 2 to 4 pieces when available. Each evidence item must include:
- "detail": a concise observation drawn from the learner's actual behavior
- "strength": an integer from 1 to 5 indicating how strongly that evidence supports the rating

Use higher strength values only when the evidence is specific, relevant, and meaningfully demonstrates the attribute. If evidence is sparse, return fewer items and lower ratings.

Return a raw JSON object (no markdown code fence) with exactly this shape:
{
  "process": { "rating": "<level>", "summary": "<one sentence>", "attributes": [ { "name": "Framing", "rating": "<level>", "summary": "<one sentence>", "evidence": [ { "detail": "...", "strength": 1 } ] } ] },
  "competency": { "rating": "<level>", "summary": "<one sentence>", "attributes": [ ... ] },
  "disposition": { "rating": "<level>", "summary": "<one sentence>", "attributes": [ ... ] },
  "concerns": [ { "name": "<short label>", "severity": "Minor|Moderate|Major", "description": "<one sentence>" } ]
}

Rules:
- Base every judgment only on observed evidence; when evidence is sparse, use lower ratings (Beginning/Emerging)
- Include every attribute listed for each dimension
- Do not invent evidence; every evidence detail must be grounded in the transcript or reasoning record
- Keep evidence details short and concrete
- Return an empty array for "concerns" if there are none
- Return only the JSON object`;

  const response = await makeSimpleAiRequest(prompt);
  return parseJsonResponse(response);
}

/**
 * Coaching agent for a Disciplinary Reasoning Assessment. Provides encouraging,
 * formative guidance (feedback, hints, suggested next investigations) without giving
 * away the solution. Intended for practice runs only.
 *
 * @async
 * @param {{title?: string, description?: string, summary?: string}} scenario - The scenario context.
 * @param {Array<{name?: string, role?: string, messages: Array<{role: 'user'|'model', text: string}>}>} transcripts - Interview/consultation transcripts.
 * @param {object} reasoningRecord - The learner's recorded reasoning fields.
 * @param {string} [activeStage] - The disciplinary stage the learner is currently working in.
 * @returns {Promise<{feedback: string, hints: string[], suggestions: string[]}>}
 */
export async function aiDraCoachGenerator(scenario, transcripts, reasoningRecord, activeStage) {
  const transcriptText = (transcripts || [])
    .filter((t) => (t.messages || []).length > 0)
    .map((t) => {
      const lines = t.messages.map((m) => `${m.role === 'user' ? 'Learner' : t.name || 'Target'}: ${m.text}`).join('\n');
      return `### ${t.name || 'Target'}\n${lines}`;
    })
    .join('\n\n');

  const reasoningText = Object.entries(reasoningRecord || {})
    .filter(([, v]) => String(v || '').trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const prompt = `You are an encouraging coach for a disciplinary reasoning assessment.
Help the learner improve their reasoning process WITHOUT giving away the solution or doing the thinking for them.

SCENARIO: ${scenario?.title || ''}
${scenario?.description || scenario?.summary || ''}

CURRENT STAGE: ${activeStage || 'unspecified'}

INVESTIGATION TRANSCRIPTS:
${transcriptText || '(no interviews conducted yet)'}

REASONING RECORD:
${reasoningText || '(empty)'}

Provide brief coaching as a raw JSON object (no markdown code fence) with exactly this shape:
{
  "feedback": "1-2 sentences on how the investigation is going",
  "hints": ["1-3 short, actionable hints that nudge the learner's thinking"],
  "suggestions": ["1-3 specific next investigations (stakeholders to interview, resources to consult, or reasoning to record)"]
}

Rules:
- Encourage good reasoning habits and point to gaps without revealing the answer
- Keep each item concise
- Return only the JSON object`;

  const response = await makeSimpleAiRequest(prompt);
  const parsed = parseJsonResponse(response);
  return {
    feedback: parsed?.feedback || '',
    hints: Array.isArray(parsed?.hints) ? parsed.hints : [],
    suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions : [],
  };
}

function parseJsonResponse(response) {
  const text = String(response || '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('AI response was not valid JSON.');
  }
}

/**
 * Generates markdown content for a course overview using AI.
 *
 * @async
 * @param {Object} course - The course object containing title, description and modules.
 * @param {string} course.title - The title of the course.
 * @param {string} course.description - The description of the course.
 * @param {Array<Object>} course.modules - Array of module objects for the course.
 * @param {string} course.modules[].title - The title of a module.
 * @param {string} course.modules[].description - The description of a module.
 * @returns {Promise<string>} A promise that resolves to the generated markdown content.
 */
export async function aiCourseOverviewGenerator(course) {
  const modules = course.modules.map((module) => ({
    title: module.title,
    description: module.description,
  }));

  const prompt = `You are an expert educational content creator.
Create markdown content that provides an overview for a course titled "${course.title}".

Description: ${course.description}

Course Modules:
${modules.map((module) => `- ${module.title}: ${module.description}`).join('\n')}

Requirements:
- The response must be valid GitHub-flavored markdown
- Make the content upbeat and engaging
- Include a level 1 heading using only the exact course title
- After the level 1 heading include a Markdown formatted image ![Course Cover](https://raw.githubusercontent.com/csinstructiontemplate/emptycourse/refs/heads/main/coursecover.jpg)
- Prefer paragraph text where appropriate
- Include introductory paragraphs that provide an overview of the entire course but do not label it as "Overview"
- Include a level 2 section containing a bulleted list of course outcomes
- Include a level 2 section containing a bulleted list of modules that contain the title and description of each module
- Conclude with a motivational call to action encouraging learners to begin the course
`;

  return makeSimpleAiRequest(prompt);
}

/**
 * Generates a topic section.
 *
 * @async
 * @param {string} topic - The instructional topic for the section.
 * @param {string} subject - The specific subject for the section.
 * @returns {Promise<string>} A promise that resolves to the generated section in markdown format.
 */
export async function aiSectionGenerator(topic, subject) {
  const prompt = `You are an expert educational content creator.
Generate a section for a course topic that uses the following format:

## section title

Multiple paragraphs of section content. Examples, lists, mermaid diagrams, and code examples are preferred.

\`\`\`masteryls
{"id":"", "title":"question title", "type":"multiple-choice"}
question text

- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This is also wrong
- [ ] This one is close but wrong
\`\`\`


Instructional topic: ${topic}
Section subject: ${subject}

Requirements:
- Create a course topic section based on the provided topic and section subject
- The response must be valid GitHub-flavored markdown
- The section title should be concise and descriptive
- The section body should be clear and unambiguous
- Ensure that the section is educational and reinforces key concepts from the topic
- If you include a Mermaid diagram, include this line in the diagram to enforce white background and black lines/text: ${mermaidDefaultClassDef}
`;

  return makeSimpleAiRequest(prompt);
}

/**
 * Generates a multiple-choice quiz question using AI based on the provided topic and subject.
 *
 * @async
 * @param {string} topic - The instructional topic for the quiz question.
 * @param {string} subject - The specific subject for the quiz question.
 * @returns {Promise<string>} A promise that resolves to the generated quiz question in markdown format.
 */
export async function aiQuizGenerator(topic, subject) {
  const prompt = `You are an expert educational content creator.
Generate a multiple choice quiz that uses the following format:

\`\`\`masteryls
{"id":"", "title":"question title", "type":"multiple-choice"}
question text

- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This is also wrong
- [ ] This one is close but wrong
\`\`\`

Instructional topic: ${topic}
Question subject: ${subject}

Requirements:
- Create a question based on the instructional topic and question subject
- The response must be valid GitHub-flavored markdown
- The question title should be concise and descriptive
- The question body should be clear and unambiguous
- Provide four answer choices, with one correct answer marked with [x] and three incorrect answers marked with [ ]
- The correct answer should be plausible and relevant to the question
- The incorrect answers should be plausible but clearly wrong to someone who understands the material
- Avoid using "All of the above" or "None of the above" as answer choices
- Ensure that the quiz is educational and reinforces key concepts from the topic
- The quiz should be challenging but fair, suitable for learners who have studied the topic
- The answer choices must be in a random order
`;

  return makeSimpleAiRequest(prompt);
}

/**
 * Generates a response to a general prompt.
 *
 * @async
 * @param {string} topic - The instructional topic for the prompt.
 * @param {string} prompt - The general prompt.
 * @returns {Promise<string>} A promise that resolves to the prompt response.
 */
export async function aiGeneralPromptResponse(topic, prompt) {
  const fullPrompt = `You are an expert educational content creator.
Generate a response to the following prompt:

Instructional topic: ${topic}
Prompt: ${prompt}

Requirements:
- The response must be valid GitHub-flavored markdown
- The response should be clear and unambiguous
- Only include information relevant to the prompt
- Do not include commentary about the prompt itself
- Do not include introductions to the response
- Ensure that the response is educational and reinforces key concepts from the topic
`;

  return makeSimpleAiRequest(fullPrompt);
}

/**
 * Rewrites selected markdown according to an editor prompt.
 *
 * @async
 * @param {string} topic - The instructional topic for context.
 * @param {string} fullMarkdown - The full markdown document for context only.
 * @param {string} selectedMarkdown - The selected markdown to rewrite.
 * @param {string} prompt - The editor's requested change.
 * @returns {Promise<string>} The replacement markdown for the selected range.
 */
export async function aiSelectedMarkdownModifier(topic, fullMarkdown, selectedMarkdown, prompt) {
  const fullPrompt = `You are an expert educational content editor.
Revise only the selected markdown according to the editor's request.

Instructional topic: ${topic}

Full topic markdown is provided only for context. Do not rewrite it unless it is part of the selected markdown.

Full topic markdown:
<topic-markdown>
${fullMarkdown}
</topic-markdown>

Selected markdown to revise:
<selected-markdown>
${selectedMarkdown}
</selected-markdown>

Editor request:
${prompt}

Requirements:
- Return only the revised selected markdown that should replace the selected markdown
- Preserve valid GitHub-flavored markdown
- Preserve important formatting, markdown structure, code fences, MasteryLS interaction fences, IDs, links, and image references unless the request explicitly changes them
- Do not include explanations, apologies, notes, surrounding quotes, or markdown code fence wrappers around the whole response
- Do not modify or include unselected sections
`;

  const body = {
    ...standardRequestBody,
    contents: [
      {
        parts: [
          {
            text: fullPrompt,
          },
        ],
      },
    ],
  };

  const responseText = await service.makeGeminiApiRequest(body);
  return cleanSelectedMarkdownResponse(responseText);
}

/**
 * Reviews and improves an entire topic markdown document.
 *
 * @async
 * @param {string} topic - The instructional topic title/description for context.
 * @param {string} markdown - The full markdown document to review.
 * @returns {Promise<string>} The revised markdown document.
 */
export async function aiTopicReviewGenerator(topic, markdown) {
  const fullPrompt = `You are an expert educational content editor.
Review and improve this full topic markdown document.

Instructional topic: ${topic}

Topic markdown:
<topic-markdown>
${markdown}
</topic-markdown>

Requirements:
- Correct spelling, grammar, punctuation, and wording issues
- Improve clarity and instructional quality while preserving original meaning and scope
- Preserve valid GitHub-flavored markdown
- Preserve style, headings, section structure, links, image references, and code fences unless a correction is required
- Preserve all MasteryLS interaction fences (\`\`\`masteryls), interaction JSON fields (including IDs), and their behavior
- Do not add explanations, notes, summaries, or markdown fence wrappers around the full response
- Return only the fully revised markdown document
`;

  const response = await makeSimpleAiRequest(fullPrompt);
  return cleanSelectedMarkdownResponse(response);
}

/**
 * Generates an image from a text prompt.
 *
 * @async
 * @param {string} prompt - The image prompt.
 * @returns {Promise<{data: string, mimeType: string}>} The base64 image data and mime type.
 */
export async function aiImageGenerator(prompt) {
  const body = {
    contents: [
      {
        parts: [
          {
            text: `
Create a high-quality instructional image for course content based on this prompt:

${prompt}

Requirements:
- No main title.
- White background.
- Image width should be greater than height, ideally around a 16:9 aspect ratio, and at most 800 pixels wide.
- The image should be a friendly and clean modern educational infographic in a vector illustration style.
- The image is professional looking and appropriate for a university audience.
- All graphical elements, including icons, flowcharts, thought bubbles, and UI screens, have clear black borders.
- Prefer a vibrant clean modern monochromatic palette that uses vibrant harmonious colors for highlights and callouts.
- Integrate clear, legible modern sans-serif typography for all text, including modular section callouts if used.
- Strong contrast between text and the background to increase legibility.
- Text must be large enough to be easily readable when the image is viewed on a mobile device.
- The structured, modular layout uses simple illustrative icons and flowcharts to explain complex concepts.`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  };

  return service.makeGeminiImageApiRequest(body);
}

/**
 * Generates a discussion response for a teaching quiz where the user is taking on the role of a teacher to an AI student.
 *
 * @async
 * @function aiTeachingResponseGenerator
 * @param {string} topicTitle - The title of the topic being discussed.
 * @param {string} topicContent - The content of the topic being discussed.
 * @param {object[]} messages - The conversation between the user and the AI student.
 * @returns {Promise<string>} A promise that resolves to the generated discussion response.
 */
export async function aiTeachingResponseGenerator(topicTitle, topicContent, messages) {
  const instructions = {
    parts: [
      {
        text: `
You are a student trying understand course material. The user is responding to your questions as a teacher.
You have access to the following topic content that you are currently studying:

TOPIC: ${topicTitle}

CONTENT: ${topicContent}

Respond to what the user is attempting to explain in a positive and constructive manner. 
- The response must be valid GitHub-flavored markdown
- Prefer short responses of less than 50 words with one or two concise paragraphs
- Respond positively when the teacher is correct
- Ask for clarification when the teacher is incorrect
- Directly address the teacher's explanation
- Never answer the question yourself unless the teacher has already answered it
- Only reference content that is found in this conversation
- If the teacher is incorrect then ask for clarification on specific points
- Stay focused on the educational content and avoid unrelated topics
- At the end of your response, return a percentage score of how well the teacher has answered the question in the format: "Understanding Score: XX%"

If the student's question is not directly related to the topic content, gently redirect them back to the material while still being helpful.`,
      },
    ],
  };
  const contents = createDiscussionContents(messages);

  return makeAiRequest(instructions, contents);
}

/**
 * Generates a discussion response for a student based on the provided topic content and user prompt.
 *
 * @async
 * @function aiDiscussionResponseGenerator
 * @param {string} topicTitle - The title of the topic being discussed.
 * @param {string} topicContent - The content of the topic being discussed.
 * @param {object[]} messages - The conversation between the user and the AI teacher.
 * @returns {Promise<string>} A promise that resolves to the generated discussion response.
 */
export async function aiDiscussionResponseGenerator(topicTitle, topicContent, messages) {
  // If the user's message was about a specific section of the topic, include that information
  const section = messages.length > 0 ? messages[messages.length - 1].section : null;
  const headingInfo = section
    ? `

The student is currently studying the section titled "${section}."
    `
    : '';

  // If the user has any saved notes for the topic + section, include that information
  const noteMessages = messages.filter((msg) => msg.type === 'note');
  const noteText = noteMessages.map((msg, i) => `[Note ${i + 1} / ${noteMessages.length}]: ${msg.content}`);
  const notesInfo =
    noteText.length > 0
      ? `

The student has saved the following notes related to the topic, which may contain parts of previous discussions with you:

${noteText.join('\n\n')}

[END OF NOTES]
    `
      : '';

  const fullInstructionText = `
You are a knowledgeable teaching assistant helping a student understand course material. 
You have access to the following topic content that the student is currently studying:

TOPIC: ${topicTitle}

CONTENT: ${topicContent}

[END OF CONTENT]${headingInfo}${notesInfo}

Please provide a helpful, educational response that:
- The response must be valid GitHub-flavored markdown
- Prefer short responses of less than 200 words with one or two concise paragraphs
- Prefer to use bullet points, lists, mermaid diagrams, and code examples instead of text
- If you include a Mermaid diagram, include this line in the diagram to enforce white background and black lines/text: ${mermaidDefaultClassDef}
- Directly addresses the student's question or comment
- References specific parts of the topic content when relevant
- Provides additional context, examples, or explanations that enhance understanding
- Encourages further learning and critical thinking
- Is conversational and supportive in tone
- Stays focused on the educational content and avoids unrelated topics

If the student's question is not directly related to the topic content, gently redirect them back to the material while still being helpful.`;

  const instructions = {
    parts: [
      {
        text: fullInstructionText,
      },
    ],
  };
  const contents = createDiscussionContents(messages);

  return makeAiRequest(instructions, contents);
}

function createDiscussionContents(messages) {
  return messages
    .filter((msg) => msg.type === 'model' || msg.type === 'user')
    .map((msg) => {
      return { role: msg.type, parts: [{ text: msg.content }] };
    });
}

function cleanSelectedMarkdownResponse(responseText) {
  const text = String(responseText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/^\n+|\n+$/g, '');
  const markdownFence = text.match(/^\s*```(?:markdown|md|gfm)\s*\n([\s\S]*?)\n?```\s*$/i);
  if (markdownFence) {
    return markdownFence[1].replace(/^\n+|\n+$/g, '');
  }
  return text;
}

/**
 * Generates constructive feedback for a student's answer to a quiz question.
 *
 * @async
 * @function aiInteractionFeedbackGenerator
 * @param {Object} data - An object containing details about the quiz question and the student's answer.
 * @returns {Promise<string>} A promise that resolves to the generated feedback string.
 */
export async function aiChoiceInteractionFeedbackGenerator(data, user) {
  const prompt = `You are an expert educational content creator.
Generate constructive feedback for a student's answer to a quiz question.
Focus on clear explanations, encouragement, and guidance for improvement.

${Object.entries(data)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Requirements:
- Address the student directly
- The feedback to be part of a larger conversation that is already occurring
- Acknowledge any correct aspects of the student's answer
- Clearly explain why the student's answer is incorrect, if applicable
- Provide the correct answer with a brief explanation
- Only if the answer is incorrect, offer suggestions for improvement or further study
- Only if the answer is incorrect, then start with a positive comment about the student's effort
- Keep the tone supportive and encouraging
- Limit feedback to 150 words or less
`;

  return await makeSimpleAiRequest(prompt, user);
}

export async function aiEssayInteractionFeedbackGenerator(data, user) {
  const hasGradingCriteria = Boolean(String(data?.gradingCriteria || '').trim());
  const prompt = `You are an expert educational content creator.
Generate constructive feedback for a student's essay response.
Focus on clear explanations, encouragement, and guidance for improvement.

${Object.entries(data)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Requirements:
- Start the response with json that indicates the percentage correct in the format: {"percentCorrect": XX}
- Score the response using the essay prompt and question context${hasGradingCriteria ? ', and apply the provided gradingCriteria as required scoring criteria' : ''}
- Address the student directly
- The feedback to be part of a larger conversation that is already occurring
- Acknowledge any correct aspects of the student's answer
- Clearly explain why the student's answer is incorrect, if applicable
- Provide the correct answer with a brief explanation
- Keep the tone supportive and encouraging
- Limit feedback to 150 words or less
`;

  let feedbackData = { percentCorrect: undefined };
  let feedback = await makeSimpleAiRequest(prompt, user);
  const jsonMatch = feedback.match(/^\s*(?:`+json\s*)?(\{[\s\S]*?\})(?:\s*`+)?/);
  if (jsonMatch) {
    try {
      feedbackData = JSON.parse(jsonMatch[1]);
      feedback = feedback.slice(jsonMatch.index + jsonMatch[0].length).trim();
    } catch (error) {
      console.error('Failed to parse AI feedback JSON:', error);
    }
  }
  return { feedback, percentCorrect: feedbackData.percentCorrect };
}

export async function aiWebPageFeedbackGenerator(data, user) {
  const prompt = `You are an expert educational code reviewer.
Evaluate a learner's submitted HTML web page.

${Object.entries(data)
  .filter(([, v]) => v)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Requirements:
- Start the response with json that indicates the score in the format: {"percentCorrect": XX}
- Score 0–100 based on: code quality, whether the page fulfills the learner's prompt, and adherence to interaction instructions
- Address the student directly
- Acknowledge what the submission does well
- Note any gaps or issues clearly but constructively
- Keep the tone encouraging
- Limit feedback to 150 words or less
`;

  let feedbackData = { percentCorrect: undefined };
  let feedback = await makeSimpleAiRequest(prompt, user);
  const jsonMatch = feedback.match(/^\s*(?:`+json\s*)?(\{[\s\S]*?\})(?:\s*`+)?/);
  if (jsonMatch) {
    try {
      feedbackData = JSON.parse(jsonMatch[1]);
      feedback = feedback.slice(jsonMatch.index + jsonMatch[0].length).trim();
    } catch (error) {
      console.error('Failed to parse AI feedback JSON:', error);
    }
  }
  return { feedback, percentCorrect: feedbackData.percentCorrect ?? 100 };
}

const GEMINI_INLINE_SUPPORTED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']);

export async function aiFileInteractionFeedbackGenerator(data, user) {
  const files = Array.isArray(data?.files) ? data.files : [];
  const inlineParts = [];
  const inlineFileNames = [];
  const skipped = [];

  for (const file of files) {
    if (file && typeof file.base64 === 'string' && GEMINI_INLINE_SUPPORTED_MIME.has(file.type)) {
      inlineParts.push({ inlineData: { mimeType: file.type, data: file.base64 } });
      inlineFileNames.push(file.name);
    } else if (file?.name) {
      skipped.push(`${file.name} (${file.type || 'unknown type'})`);
    }
  }

  const promptText = `You are an expert educational reviewer.
Evaluate a learner's file submission against the provided grading criteria. Ground every observation in what you can see in the attached files.

- title: ${data?.title || '(no title)'}
- instructions to learner: ${data?.body || '(none)'}
- gradingCriteria: ${data?.gradingCriteria || ''}
- filesProvided: ${files.length}
${inlineFileNames.length > 0 ? `- filesAnalyzed: ${inlineFileNames.join(', ')}` : ''}
${skipped.length > 0 ? `- filesNotIntrospectable: ${skipped.join(', ')}` : ''}

Requirements:
- Start the response with json that indicates the score in the format: {"percentCorrect": XX}
- Score 0–100 based on how well the submission satisfies the grading criteria
- Address the student directly
- Acknowledge what the submission does well
- Note any gaps or issues clearly but constructively
- Reference the specific file(s) you are commenting on by name when relevant
- Keep the tone encouraging
- Limit feedback to 200 words
`;

  const parts = [{ text: promptText }, ...inlineParts];
  const responseText = await makeAiRequest(null, [{ role: 'user', parts }], user);

  let feedbackData = { percentCorrect: undefined };
  let feedback = responseText;
  const jsonMatch = feedback.match(/^\s*(?:`+json\s*)?(\{[\s\S]*?\})(?:\s*`+)?/);
  if (jsonMatch) {
    try {
      feedbackData = JSON.parse(jsonMatch[1]);
      feedback = feedback.slice(jsonMatch.index + jsonMatch[0].length).trim();
    } catch (error) {
      console.error('Failed to parse AI feedback JSON:', error);
    }
  }
  return { feedback, percentCorrect: feedbackData.percentCorrect };
}

function extractFirstHttpUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s)\]"'<>]+/i);
  return match ? match[0] : '';
}

/**
 * Generates feedback using explicit grading criteria against fetched target content.
 *
 * @async
 * @param {Object} data - Learner submission context and metadata.
 * @param {string} gradingCriteria - Criteria used to score the submission.
 * @param {string} urlPrompt - Prompt used by AI to generate the target URL.
 * @param {Object} user - Current learner/user context.
 * @returns {Promise<{ feedback: string, percentCorrect: number, targetUrl: string, fetchStatus?: number }>} Grading feedback and score.
 */
export async function aiUrlFeedbackGenerator(data, gradingCriteria, urlPrompt, user) {
  const sourceUrl = String(data?.learnerUrl || '').trim();
  if (!sourceUrl) {
    throw new Error('A learner URL is required for criteria-target grading.');
  }

  let targetUrl = sourceUrl;
  const normalizedUrlPrompt = String(urlPrompt || '').trim();
  if (normalizedUrlPrompt) {
    const urlGenerationPrompt = `You are a URL targeting assistant.
Transform the user-provided URL into exactly one target URL to fetch.

User provided URL:
${sourceUrl}

Transformation instruction:
${normalizedUrlPrompt}

Example:
- User provided URL: https://raw.githubusercontent.com/byucsstudent/startup
- Instruction: Convert the user provided URL to create a URL that is the path to the raw GitHub content for the README.md file.
- Output URL: https://raw.githubusercontent.com/byucsstudent/startup/main/README.md

Requirements:
- Return exactly one absolute http or https URL
- The output must be based on the user provided URL and instruction
- Prefer deterministic URL transformation (do not invent unrelated URLs)
- For GitHub repository links, convert to the correct raw content URL when requested
- Do not return markdown, quotes, labels, or commentary
- Output must be only the URL`;

    const generatedUrlText = await makeSimpleAiRequest(urlGenerationPrompt, user);
    targetUrl = extractFirstHttpUrl(generatedUrlText);
    if (!targetUrl) {
      throw new Error('Unable to generate a valid target URL from prompt.');
    }
  }

  const fetched = await service.makeUrlValidationRequest({
    url: targetUrl,
    includeContent: true,
    maxChars: 12000,
    timeoutMs: 10000,
  });

  if (!fetched?.ok) {
    const fetchReason = fetched?.error || 'Unable to fetch target URL.';
    return {
      feedback: `Unable to evaluate against the target URL: ${fetchReason}`,
      percentCorrect: 0,
      targetUrl,
      fetchStatus: fetched?.status,
    };
  }

  const prompt = `You are an expert educational reviewer.
Evaluate the learner submission using the grading criteria and the fetched target reference.

${Object.entries(data || {})
  .filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Grading Criteria:
${gradingCriteria}

Target URL:
${targetUrl}

Fetched Target Title:
${fetched?.title || 'N/A'}

Fetched Target Content Excerpt:
${fetched?.contentExcerpt || ''}

Requirements:
- Start the response with json in the format: {"percentCorrect": XX}
- Score 0-100 based on alignment with grading criteria and target reference
- If grading criteria references checklist completion, count checked items, evaluate quality of described work for each checked item, and weight score by both completion and quality
- If expected sections are missing, explain what is missing and reduce score accordingly
- Address the student directly
- Acknowledge strengths
- Identify improvement areas clearly and constructively
- Keep feedback supportive
- Limit feedback to 180 words or less`;

  let feedbackData = { percentCorrect: undefined };
  let feedback = await makeSimpleAiRequest(prompt, user);
  const jsonMatch = feedback.match(/^\s*(?:`+json\s*)?(\{[\s\S]*?\})(?:\s*`+)?/);
  if (jsonMatch) {
    try {
      feedbackData = JSON.parse(jsonMatch[1]);
      feedback = feedback.slice(jsonMatch.index + jsonMatch[0].length).trim();
    } catch (error) {
      console.error('Failed to parse AI feedback JSON:', error);
    }
  }

  return {
    feedback,
    percentCorrect: feedbackData.percentCorrect ?? 100,
    targetUrl,
    fetchStatus: fetched?.status,
  };
}

/**
 * Sends a prompt to the Gemini generative language model and returns the generated content.
 *
 * @async
 * @function makeSimpleAiRequest
 * @param {string} prompt - The prompt text to send to the AI model.
 * @returns {Promise<string>} The generated content from the AI model.
 */
export async function makeSimpleAiRequest(prompt, user) {
  const contents = [
    {
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];
  return makeAiRequest(null, contents, user);
}

/**
 * Sends a prompt to the Gemini generative language model and returns the generated content.
 *
 * @async
 * @function makeAiRequest
 * @param {string|null} instructions - The system instructions to send to the AI model.
 * @param {Array} contents - The contents to send to the AI model.
 * @returns {Promise<string>} The generated content from the AI model.
 */
async function makeAiRequest(instructions, contents, user) {
  const body = {
    ...standardRequestBody,
    ...(instructions && { system_instruction: instructions }),
    contents,
  };

  const responseText = await service.makeGeminiApiRequest(body);
  let cleanedText = responseText.replace(/^```.+\s*([\s\S]*?)\s*```$/i, '$1').trim();
  if (user && user.name) {
    cleanedText = cleanedText.replace(/\[Student('s)? Name\]/i, user.name);
  }

  return cleanedText;
}

const standardRequestBody = {
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    //    maxOutputTokens: 5000,
  },
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_MEDIUM_AND_ABOVE',
    },
  ],
};
