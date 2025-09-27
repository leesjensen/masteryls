export async function discussTopic(apiKey, topicTitle, topicContent, userPrompt) {
  if (!apiKey || !topicTitle || !topicContent || !userPrompt) {
    throw new Error('API key, topic title, topic content, and user prompt are required for discussion');
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
                text: `You are a knowledgeable teaching assistant helping a student understand course material. 
You have access to the following topic content that the student is currently studying:

TOPIC: ${topicTitle}

CONTENT:
${topicContent}

The student has asked the following question or made this comment about the topic:
"${userPrompt}"

Please provide a helpful, educational response that:
- Prefer short responses of less than 200 words with one or two concise paragraphs, bullet points, lists, and code examples
- Directly addresses the student's question or comment
- References specific parts of the topic content when relevant
- Provides additional context, examples, or explanations that enhance understanding
- Encourages further learning and critical thinking
- Is conversational and supportive in tone
- Stays focused on the educational content and avoids unrelated topics

If the student's question is not directly related to the topic content, gently redirect them back to the material while still being helpful.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2000,
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
    console.error('Error in topic discussion:', error);
    throw new Error(`Failed to generate discussion response: ${error.message}`);
  }
}
