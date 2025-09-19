export async function aiTopicGenerator(apiKey, title, description, type = 'instruction') {
  if (!apiKey || !title || !description) {
    throw new Error('API key, title, and description are required for AI content generation');
  }

  const sanitizedTitle = title.trim();
  const sanitizedDescription = description.trim();

  try {
    const prompt = createPromptForType(sanitizedTitle, sanitizedDescription, type);

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
                text: `You are an expert educational content creator. Generate comprehensive, well-structured markdown content for online courses. Focus on clear explanations, practical examples, and pedagogically sound structure.\n\n${prompt}`,
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
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      throw new Error('Invalid response format from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error generating AI content:', error);
    throw new Error(`Failed to generate AI content: ${error.message}`);
  }
}

function createPromptForType(title, description, type) {
  const basePrompt = `Create comprehensive markdown content for a course topic titled "${title}".

Description: ${description}

Requirements:
- Start with a level 1 heading using the exact title
- Use proper markdown formatting
- Include relevant subsections with appropriate heading levels
- Make content educational and engaging
- Include practical examples where applicable
- Ensure content is suitable for online learning`;

  switch (type) {
    case 'video':
      return `${basePrompt}
- Content Type: Video lesson companion material
- Include video overview, learning objectives, key topics covered, and discussion questions
- Structure the content to complement a video presentation
- Add sections for video summary and reflection questions`;

    case 'quiz':
      return `${basePrompt}
- Content Type: Quiz/Assessment
- Include multiple choice questions with explanations
- Provide 3-5 questions covering different difficulty levels
- Include detailed answer explanations
- Add conceptual understanding and practical application questions`;

    case 'project':
      return `${basePrompt}
- Content Type: Hands-on project
- Include project overview, learning objectives, and prerequisites
- Provide step-by-step instructions broken into phases
- Add requirements, deliverables, and evaluation criteria
- Include estimated time requirements and necessary resources`;

    default: // instruction
      return `${basePrompt}
- Content Type: Instructional lesson
- Include overview, learning objectives, key concepts, and practical applications
- Add implementation guides and best practices
- Include common challenges and solutions
- Provide summary and next steps for continued learning`;
  }
}
