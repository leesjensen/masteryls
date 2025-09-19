import { useState } from 'react';

function useCourseOperations(course, setCourse, user, service, currentTopic, changeTopic) {
  function generateId() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)).replace(/-/g, '');
  }

  function generateTopicPath(course, topicTitle, topicType) {
    if (topicType === 'video') {
      return 'https://youtu.be/PKiRH2ZKZeM';
    }

    const slugTitle = topicTitle
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim('-');
    return `${course.links.gitHub.rawUrl}/instruction/${slugTitle}/${slugTitle}.md`;
  }

  async function aiGeneratedContent(apiKey, title, description, type = 'instruction') {
    if (!apiKey || !title || !description) {
      throw new Error('API key, title, and description are required for AI content generation');
    }

    const sanitizedTitle = title.trim();
    const sanitizedDescription = description.trim();

    try {
      const prompt = createPromptForType(sanitizedTitle, sanitizedDescription, type);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educational content creator. Generate comprehensive, well-structured markdown content for online courses. Focus on clear explanations, practical examples, and pedagogically sound structure.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 4000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from OpenAI API');
      }

      return data.choices[0].message.content;
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

  function generateBasicContent(topic) {
    let basicContent = `# ${topic.title}\n\n`;

    switch (topic.type) {
      case 'video':
        return null;
      case 'quiz':
        basicContent += `## Quiz\n\n### Question 1\n\nYour question here?\n\n- [ ] Option A\n- [ ] Option B\n- [ ] Option C\n- [ ] Option D\n\n### Answer\n\nCorrect answer and explanation.\n`;
        break;
      case 'project':
        basicContent += `## Project: ${topic.title}\n\n### Objectives\n\n- Objective 1\n- Objective 2\n\n### Instructions\n\n1. Step 1\n2. Step 2\n3. Step 3\n\n### Deliverables\n\n- Deliverable 1\n- Deliverable 2\n`;
        break;
      default:
        basicContent += `## Overview\n\nContent for ${topic.title} goes here.\n\n## Key Concepts\n\n- Concept 1\n- Concept 2\n- Concept 3\n`;
    }

    return basicContent;
  }

  async function addTopic(moduleIndex, topicTitle, topicType) {
    topicTitle = topicTitle.trim();
    topicType = topicType || 'instruction';
    if (!topicTitle) return;

    const token = user.gitHubToken(course.id);
    if (token) {
      try {
        const newTopic = {
          id: generateId(),
          title: topicTitle,
          type: topicType,
          path: generateTopicPath(course, topicTitle, topicType),
        };

        const updatedCourse = course.constructor._copy(course);
        const module = updatedCourse.modules[moduleIndex];
        module.topics.push(newTopic);

        updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
        setCourse(updatedCourse);

        const basicContent = generateBasicContent(newTopic);
        if (basicContent) {
          const gitHubUrl = newTopic.path.replace(course.links.gitHub.rawUrl, course.links.gitHub.apiUrl);
          await service.commitTopicMarkdown(gitHubUrl, basicContent, token, `add(topic) ${newTopic.title}`);
        }

        await updatedCourse.commitCourseStructure(user, service, `add(topic) ${newTopic.title}`);

        changeTopic(newTopic);
      } catch (error) {
        alert(`Failed to add topic: ${error.message}`);
      }
    }
  }

  async function renameTopic(moduleIdx, topicIdx, newTitle, newType) {
    if (!newTitle.trim()) return;
    const updatedCourse = course.constructor._copy(course);
    const topic = updatedCourse.modules[moduleIdx].topics[topicIdx];
    if (!topic) return;
    topic.title = newTitle.trim();
    topic.type = newType || topic.type;
    updatedCourse.modules[moduleIdx].topics[topicIdx] = topic;
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
    setCourse(updatedCourse);
    try {
      const token = user.gitHubToken(course.id);
      if (token) {
        await updatedCourse.commitCourseStructure(user, service, `rename(topic) ${topic.title} with type ${topic.type}`);
      }
    } catch (err) {
      alert(`Failed to persist topic rename: ${err.message}`);
    }
  }

  async function removeTopic(moduleIndex, topicIndex) {
    const topic = course.modules[moduleIndex].topics[topicIndex];
    if (!confirm(`Are you sure you want to remove "${topic.title}"?`)) return;

    try {
      const updatedCourse = course.constructor._copy(course);
      updatedCourse.modules[moduleIndex].topics.splice(topicIndex, 1);
      updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);

      setCourse(updatedCourse);

      // Commit the course structure changes
      const token = user.gitHubToken(course.id);
      if (token) {
        await updatedCourse.commitCourseStructure(user, service, `remove(topic) ${topic.title}`);
      }

      // If the removed topic was the current topic, navigate to the first topic
      if (currentTopic && currentTopic.path === topic.path) {
        const firstTopic = updatedCourse.allTopics[0];
        if (firstTopic) {
          changeTopic(firstTopic);
        }
      }
    } catch (error) {
      alert(`Failed to remove topic: ${error.message}`);
    }
  }

  async function addModule(title) {
    if (!title.trim()) return;
    const updatedCourse = course.constructor._copy(course);
    updatedCourse.modules.push({
      id: generateId(),
      title: title.trim(),
      topics: [],
    });
    updatedCourse.allTopics = updatedCourse.modules.flatMap((m) => m.topics);
    setCourse(updatedCourse);
    try {
      const token = user.gitHubToken(course.id);
      if (token) {
        await updatedCourse.commitCourseStructure(user, service, `add(module) ${title.trim()}`);
      }
    } catch (err) {
      alert(`Failed to add module: ${err.message}`);
    }
  }

  return {
    addTopic,
    removeTopic,
    renameTopic,
    addModule,
    aiGeneratedContent,
  };
}

export default useCourseOperations;
