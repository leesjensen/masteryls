export async function aiCourseGenerator(apiKey, title, description) {
  title = title.trim();
  description = description.trim();
  if (!apiKey || !title || !description) {
    throw new Error('API key, title, and description are required for AI content generation');
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are an expert educational content creator.
Generate a JSON object that contains an appropriate number of modules and topics for a course.
Each module should have a title and a list of topics with titles and descriptions.

Course title: ${title}
Course description: ${description}

The JSON must be structured according to the following example:

{
  "title": "${title}",
  "modules": [
    {
      "title": "Example module title",
      "topics": [
        { "title": "Overview", "path": "README.md" },
        { "title": "Topic 1", "path": "instruction/topic-1/topic-1.md" },
        { "title": "Topic 2", "path": "instruction/topic-2/topic-2.md" },
        { "title": "Topic 3", "path": "instruction/topic-3/topic-3.md" },
      ]
    }
}                 


Requirements:
- Return a JSON object with out any markdown code fences or other text
- The JSON object must include a title and modules array
- Each module must include a title and topics array
- Each topic must include a title, description, and path
- The first topic of the first module must be "Overview" with path "README.md"
- The path for other topics should follow the format "instruction/topic-name/topic-name.md" where topic-name is a lowercase, hyphenated version of the topic title
- The course title should match the provided title exactly
- The course description should be relevant to the topics included
- The course should have between 3 and 7 modules
- Each module should have between 3 and 7 topics
- Each topic should have a concise, descriptive title
- Use proper JSON formatting
- Do not include any additional text outside the JSON object
- Ensure the JSON is valid and can be parsed without errors
- The course content should be relevant to the title and description provided
- Focus on clear, educational content that would be useful for learners

Example output:
{
  "title": "Introduction to Programming",
  "modules": [
    {
      "title": "Getting Started",
      "topics": [
        { "title": "Overview", "path": "README.md" },
        { "title": "What is Programming?", "path": "instruction/what-is-programming.md" },
        { "title": "Setting Up Your Environment", "path": "instruction/setting-up-environment.md" },
        { "title": "Hello World", "path": "instruction/hello-world.md" }
      ]
    },
    {
      "title": "Basic Concepts",
      "topics": [
        { "title": "Variables and Data Types", "path": "instruction/variables-and-data-types.md" },
        { "title": "Control Structures", "path": "instruction/control-structures.md" },
        { "title": "Functions", "path": "instruction/functions.md" }
      ]
    },
    {
      "title": "Advanced Topics",
      "topics": [
        { "title": "Object-Oriented Programming", "path": "instruction/object-oriented-programming.md" },
        { "title": "Error Handling", "path": "instruction/error-handling.md" },
        { "title": "Working with Libraries", "path": "instruction/working-with-libraries.md" }
      ]
    }
  ]
}
`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 10000,
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

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error generating AI content:', error);
    throw new Error(`Failed to generate AI content: ${error.message}`);
  }
}

export async function aiTopicGenerator(apiKey, title, description) {
  if (!apiKey || !title || !description) {
    throw new Error('API key, title, and description are required for AI content generation');
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are an expert educational content creator.
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
- Provide a summary`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 10000,
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

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error generating AI content:', error);
    throw new Error(`Failed to generate AI content: ${error.message}`);
  }
}
