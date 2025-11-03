/**
 * Generates a course structure in JSON format using AI, based on the provided title and description.
 *
 * @async
 * @param {string} apiKey - The API key required for AI content generation.
 * @param {string} title - The exact title of the course to be generated.
 * @param {string} description - The description of the course, relevant to the topics included.
 * @returns {Promise<string>} A promise that resolves to a raw JSON string representing the course structure.
 *
 * @example
 * const courseJson = await aiCourseGenerator(apiKey, "Introduction to AI", "Learn the fundamentals of artificial intelligence.");
 */
export async function aiCourseGenerator(apiKey, title, description) {
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
        { "title": "Overview", "description": "Course introduction and objectives.", "path": "README.md", "type": "instruction", "state": "stable" },
        { "title": "Topic 1", "description": "Description for topic 1.", "path": "instruction/topic-1/topic-1.md", "type": "instruction", "state": "stub" },
        { "title": "Topic 2", "description": "Description for topic 2.", "path": "instruction/topic-2/topic-2.md", "type": "instruction", "state": "stub" },
        { "title": "Topic 3", "description": "Description for topic 3.", "path": "instruction/topic-3/topic-3.md", "type": "instruction", "state": "stub" }
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
- The first topic of the first module must be "Overview" with path "README.md" and a state set to "stable"
- The path for other topics should follow the format "instruction/topic-name/topic-name.md" where topic-name is a lowercase, hyphenated version of the topic title
- The course title should match the provided title exactly
- The course description should be relevant to the topics included
- The course should have 8 modules
- There should be around 100 topics spread evenly across the modules
- The course contains a capstone project that integrates the topics covered in each module
- Each topic should have a concise, descriptive title
`;
  return makeAiRequest(apiKey, prompt);
}

/**
 * Generates comprehensive, well-structured markdown content for an instructional topic using AI.
 *
 * @async
 * @function aiTopicGenerator
 * @param {string} apiKey - The API key required for AI content generation.
 * @param {string} title - The title of the instructional topic.
 * @param {string} description - A description of the instructional topic.
 * @returns {Promise<string>} A promise that resolves to the generated markdown content.
 */
export async function aiTopicGenerator(apiKey, courseDescription, title, description) {
  const prompt = `You are an expert educational content creator.
Generate comprehensive, well-structured markdown content for online courses.
Focus on clear explanations, practical examples, and pedagogically sound structure.

Create comprehensive markdown content for an instructional topic titled "${title}".

Topic Description: ${description}
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
- Include practical examples where applicable
- Include references to external resources if relevant
- Encourage thoughtful engagement with the material
- Include common challenges and solutions
- Provide a summary`;

  return makeAiRequest(apiKey, prompt);
}

export async function aiExamGenerator(apiKey, courseDescription, title, description) {
  const prompt = `You are an expert educational content creator. 

Create markdown content for an instructional exam.

Topic Description: ${description}
Course Description: ${courseDescription}

Generate 10 multiple choice or essay questions of the format:

### Example question title
\`\`\`masteryls
{"id":"" "title":"Multiple choice", "type":"multiple-choice", "body":"Simple **multiple choice** question" }
- [ ] This is **not** the right answer
- [x] This is _the_ right answer
- [ ] This one has a [link](https://cow.com)
- [ ] This one has an image ![Stock Photo](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80)
\`\`\`

### Example question title
\`\`\`masteryls
{"id":"" "title":"Question title", "type":"essay", "body":"question body" }
\`\`\`

- Start with a level 1 heading using only the exact title
- Use proper markdown formatting
- Include overview but do not label it as "Overview"
- Test on a first year university level student level
- base questions on the topic ${title}
- base questions on the content ${description}
- prefer coding questions where applicable`;

  const response = await makeAiRequest(apiKey, prompt);
  response.replace(/"id":"[^"]*"/, `"id":"${crypto.randomUUID()}"`);
  return response;
}

/**
 * Generates markdown content for a course overview using AI.
 *
 * @async
 * @param {string} apiKey - The API key used for authentication with the AI service.
 * @param {Object} course - The course object containing title, description and modules.
 * @param {string} course.title - The title of the course.
 * @param {string} course.description - The description of the course.
 * @param {Array<Object>} course.modules - Array of module objects for the course.
 * @param {string} course.modules[].title - The title of a module.
 * @param {string} course.modules[].description - The description of a module.
 * @returns {Promise<string>} A promise that resolves to the generated markdown content.
 */
export async function aiCourseOverviewGenerator(apiKey, course) {
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
- Include a Markdown formatted image at the top of the document ![BYU Logo](https://raw.githubusercontent.com/csinstructiontemplate/emptycourse/refs/heads/main/byulogo.png)
- Include a level 1 heading using only the exact course title
- After the level 1 heading include a Markdown formatted image ![Course Cover](https://raw.githubusercontent.com/csinstructiontemplate/emptycourse/refs/heads/main/cover.jpg)
- Prefer paragraph text where appropriate
- Include introductory paragraphs that provide an overview of the entire course but do not label it as "Overview"
- Include a level 2 section containing a bulleted list of course outcomes
- Include a level 2 section containing a bulleted list of modules that contain the title and description of each module
- Conclude with a motivational call to action encouraging learners to begin the course
`;

  return makeAiRequest(apiKey, prompt);
}

/**
 * Generates a topic section.
 *
 * @async
 * @param {string} apiKey - The API key to use for the AI service.
 * @param {string} topic - The instructional topic for the section.
 * @param {string} subject - The specific subject for the section.
 * @returns {Promise<string>} A promise that resolves to the generated section in markdown format.
 */
export async function aiSectionGenerator(apiKey, topic, subject) {
  const prompt = `You are an expert educational content creator.
Generate a section for a course topic that uses the following format:

## section title

Multiple paragraphs of section content. Examples, lists, mermaid diagrams, and code examples are preferred.

\`\`\`masteryls
{"id":"", "title":"question title", "type":"multiple-choice", "body":"question text" }
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
`;

  return makeAiRequest(apiKey, prompt);
}

/**
 * Generates a multiple-choice quiz question using AI based on the provided topic and subject.
 *
 * @async
 * @param {string} apiKey - The API key to use for the AI service.
 * @param {string} topic - The instructional topic for the quiz question.
 * @param {string} subject - The specific subject for the quiz question.
 * @returns {Promise<string>} A promise that resolves to the generated quiz question in markdown format.
 */
export async function aiQuizGenerator(apiKey, topic, subject) {
  const prompt = `You are an expert educational content creator.
Generate a multiple choice quiz that uses the following format:

\`\`\`masteryls
{"id":"", "title":"question title", "type":"multiple-choice", "body":"question text" }
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
`;

  return makeAiRequest(apiKey, prompt);
}

/**
 * Generates a response to a general prompt.
 *
 * @async
 * @param {string} apiKey - The API key to use for the AI service.
 * @param {string} topic - The instructional topic for the prompt.
 * @param {string} prompt - The general prompt.
 * @returns {Promise<string>} A promise that resolves to the prompt response.
 */
export async function aiGeneralPromptResponse(apiKey, topic, prompt) {
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

  return makeAiRequest(apiKey, fullPrompt);
}

/**
 * Generates a discussion response for a student based on the provided topic content and user prompt.
 *
 * @async
 * @function aiDiscussionResponseGenerator
 * @param {string} apiKey - The API key for authenticating with the AI service.
 * @param {string} topicTitle - The title of the topic being discussed.
 * @param {string} topicContent - The content of the topic being discussed.
 * @param {string} userPrompt - The student's question or comment about the topic.
 * @returns {Promise<string>} A promise that resolves to the generated discussion response.
 */
export async function aiDiscussionResponseGenerator(apiKey, topicTitle, topicContent, userPrompt) {
  const prompt = `
You are a knowledgeable teaching assistant helping a student understand course material. 
You have access to the following topic content that the student is currently studying:

TOPIC: ${topicTitle}

CONTENT:
${topicContent}

The student has asked the following question or made this comment about the topic:
"${userPrompt}"

Please provide a helpful, educational response that:
- The response must be valid GitHub-flavored markdown
- Prefer short responses of less than 200 words with one or two concise paragraphs
- Prefer to use bullet points, lists, mermaid diagrams, and code examples instead of text
- Include a mermaid diagram if it helps explain the concept
- Directly addresses the student's question or comment
- References specific parts of the topic content when relevant
- Provides additional context, examples, or explanations that enhance understanding
- Encourages further learning and critical thinking
- Is conversational and supportive in tone
- Stays focused on the educational content and avoids unrelated topics

If the student's question is not directly related to the topic content, gently redirect them back to the material while still being helpful.`;

  return makeAiRequest(apiKey, prompt);
}

/**
 * Generates constructive feedback for a student's answer to a quiz question.
 *
 * @async
 * @function aiQuizFeedbackGenerator
 * @param {string} apiKey - The API key used to authenticate the AI request.
 * @param {Object} data - An object containing details about the quiz question and the student's answer.
 * @returns {Promise<string>} A promise that resolves to the generated feedback string.
 */
export async function aiChoiceQuizFeedbackGenerator(apiKey, data) {
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

  return await makeAiRequest(apiKey, prompt);
}

export async function aiEssayQuizFeedbackGenerator(apiKey, data) {
  const prompt = `You are an expert educational content creator.
Generate constructive feedback for a student's essay response.
Focus on clear explanations, encouragement, and guidance for improvement.

${Object.entries(data)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Requirements:
- Start the response with json that indicates the percentage correct in the format: {"percentCorrect": XX}
- Address the student directly
- The feedback to be part of a larger conversation that is already occurring
- Acknowledge any correct aspects of the student's answer
- Clearly explain why the student's answer is incorrect, if applicable
- Provide the correct answer with a brief explanation
- Keep the tone supportive and encouraging
- Limit feedback to 150 words or less
`;

  let feedbackData = { percentCorrect: undefined };
  let feedback = await makeAiRequest(apiKey, prompt);
  const jsonMatch = feedback.match(/^\s*(?:```json\s*)?(\{[\s\S]*?\})(?:\s*```)?/);
  if (jsonMatch) {
    try {
      feedbackData = JSON.parse(jsonMatch[1]);
      feedback = feedback.slice(jsonMatch.index + jsonMatch[0].length).trim();
    } catch {}
  }
  return { feedback, percentCorrect: feedbackData.percentCorrect };
}

/**
 * Sends a prompt to the Gemini generative language model and returns the generated content.
 *
 * @async
 * @function makeAiRequest
 * @param {string} apiKey - The API key for authenticating with the Google Generative Language API.
 * @param {string} prompt - The prompt text to send to the AI model.
 * @returns {Promise<string>} The generated content from the AI model.
 */
async function makeAiRequest(apiKey, prompt) {
  const model = 'gemini-2.0-flash';
  //const model = 'gemini-2.5-pro';
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        ...standardRequestBody,
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`AI error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      throw new Error('Invalid response format from AI');
    }

    const responseText = data.candidates[0].content.parts[0].text;
    const cleanedText = responseText.replace(/^```.+\s*([\s\S]*?)\s*```$/i, '$1').trim();

    return cleanedText;
  } catch (error) {
    console.error('Error generating AI content:', error);
    throw new Error(`Failed to generate AI content: ${error.message}`);
  }
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
