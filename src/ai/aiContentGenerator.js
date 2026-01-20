import service from '../service/service';

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
- The course should have 8 modules
- There should be around 100 topics spread evenly across the modules
- The course contains a capstone project that integrates the topics covered in each module
- Each topic should have a concise, descriptive title
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
  response.replace(/"id":"[^"]*"/, `"id":"${crypto.randomUUID()}"`);
  return response;
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
- Include a Markdown formatted image at the top of the document ![BYU Logo](https://raw.githubusercontent.com/csinstructiontemplate/emptycourse/refs/heads/main/byulogo.png)
- Include a level 1 heading using only the exact course title
- After the level 1 heading include a Markdown formatted image ![Course Cover](https://raw.githubusercontent.com/csinstructiontemplate/emptycourse/refs/heads/main/cover.jpg)
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
  const instructions = {
    parts: [
      {
        text: `
You are a knowledgeable teaching assistant helping a student understand course material. 
You have access to the following topic content that the student is currently studying:

TOPIC: ${topicTitle}

CONTENT: ${topicContent}

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

If the student's question is not directly related to the topic content, gently redirect them back to the material while still being helpful.`,
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
  let feedback = await makeSimpleAiRequest(prompt, user);
  const jsonMatch = feedback.match(/^\s*(?:`+json\s*)?(\{[\s\S]*?\})(?:\s*`+)?/);
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
    cleanedText = cleanedText.replace(/\[Student Name\]/i, user.name);
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
