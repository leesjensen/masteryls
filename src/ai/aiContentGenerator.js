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
        { "title": "Overview", "description": "Course introduction and objectives.", "path": "README.md", "type": "instruction", "state": "stub" },
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
- The first topic of the first module must be "Overview" with path "README.md"
- The path for other topics should follow the format "instruction/topic-name/topic-name.md" where topic-name is a lowercase, hyphenated version of the topic title
- The course title should match the provided title exactly
- The course description should be relevant to the topics included
- The course should have 8 modules
- There should be around 100 topics spread evenly across the modules
- The course contains a capstone project that integrates the topics covered in each module
- Each topic should have a concise, descriptive title
`;
  const courseJson = await makeAiRequest(apiKey, prompt);

  const cleanedJson = courseJson.replace(/^```.+\s*([\s\S]*?)\s*```$/i, '$1').trim();
  return cleanedJson;
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
export async function aiTopicGenerator(apiKey, title, description) {
  const prompt = `You are an expert educational content creator.
Generate comprehensive, well-structured markdown content for online courses.
Focus on clear explanations, practical examples, and pedagogically sound structure.

Create comprehensive markdown content for an instructional topic titled "${title}".

Description: ${description}

Requirements:
- Start with a level 1 heading using only the exact title
- Use proper markdown formatting
- Include overview but do not label it as "Overview"
- Include relevant subsections with appropriate heading levels
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
 * Generates constructive feedback for a student's answer to a quiz question using AI.
 *
 * The feedback is designed to be part of an ongoing conversation, acknowledging correct aspects,
 * explaining incorrect answers, providing the correct answer with a brief explanation, and offering
 * suggestions for improvement if needed. The tone is supportive and encouraging, and the feedback
 * is limited to around 150 words.
 *
 * @async
 * @function aiQuizFeedbackGenerator
 * @param {string} apiKey - The API key used to authenticate the AI request.
 * @param {Object} data - An object containing details about the quiz question and the student's answer.
 * @returns {Promise<string>} A promise that resolves to the generated feedback string.
 */
export async function aiQuizFeedbackGenerator(apiKey, data) {
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
- Limit feedback to around 150 words
`;

  return await makeAiRequest(apiKey, prompt);
}

/**
 * Sends a prompt to the Gemini 2.0 Flash generative language model and returns the generated content.
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
    return responseText;
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
