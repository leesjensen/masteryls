export async function aiTopicGenerator(apiKey, title, description) {
  if (!apiKey || !title || !description) {
    throw new Error('API key, title, and description are required for AI content generation');
  }

  try {
    const prompt = createPrompt(title.trim(), description.trim());

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

function createPrompt(title, description) {
  return `Create comprehensive markdown content for an instructional topic titled "${title}".
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
}
