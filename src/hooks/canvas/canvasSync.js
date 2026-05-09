function topicCanvasTarget(topic) {
  if (topic?.type === 'exam') {
    return 'quiz';
  }
  if (topic?.type === 'project') {
    return 'assignment';
  }
  return 'page';
}

function pointsForTopic(topic) {
  if (topic?.type === 'exam') {
    return Number(topic?.points ?? 200);
  }
  if (topic?.type === 'project') {
    return Number(topic?.points ?? 100);
  }
  return undefined;
}

export function hasCanvasTopicLink(topic) {
  return !!(topic?.externalRefs?.canvasPageId || topic?.externalRefs?.canvasQuizId || topic?.externalRefs?.canvasAssignmentId);
}

export function getCanvasTopicUrl(canvasCourseId, topic) {
  if (!canvasCourseId || !topic?.externalRefs) {
    return null;
  }

  if (topic.externalRefs.canvasPageId) {
    return `https://byu.instructure.com/courses/${canvasCourseId}/pages/${topic.externalRefs.canvasPageId}`;
  }
  if (topic.externalRefs.canvasQuizId) {
    return `https://byu.instructure.com/courses/${canvasCourseId}/quizzes/${topic.externalRefs.canvasQuizId}`;
  }
  if (topic.externalRefs.canvasAssignmentId) {
    return `https://byu.instructure.com/courses/${canvasCourseId}/assignments/${topic.externalRefs.canvasAssignmentId}`;
  }

  return null;
}

export function createCanvasSync({ service, renderTopicHtml }) {
  function buildMasteryLsLinkHtml(course, topic) {
    return `<div style="font-family: helvetica, arial, sans-serif; font-size: 1.5em; padding: 1em; border: 3px solid #e58e00; border-radius: 4px; background-color: #fffaf0; color: #262626;">
        View this content in <a style="color: #262626;" href="https://masteryls.com/course/${course.id}/topic/${topic.id}">MasteryLS</a>.
      </div>`;
  }

  function shouldLinkTopic(topic, onlyLinkAssignments) {
    if (!onlyLinkAssignments) {
      return true;
    }
    return topic?.type === 'exam' || topic?.type === 'project';
  }

  function clearCanvasTopicRefs(topic) {
    if (!topic?.externalRefs) {
      return;
    }
    const { canvasPageId, canvasQuizId, canvasAssignmentId, ...remainingTopicRefs } = topic.externalRefs;
    topic.externalRefs = Object.keys(remainingTopicRefs).length > 0 ? remainingTopicRefs : undefined;
  }

  async function listAllCanvasItems(endpointBase) {
    let pagePos = 1;
    const desiredCount = 20;
    let count = desiredCount;
    const items = [];

    while (count == desiredCount) {
      const pageItems = await service.makeCanvasApiRequest(`${endpointBase}?page=${pagePos}&per_page=${desiredCount}`, 'GET');
      items.push(...pageItems);
      count = pageItems.length;
      pagePos++;
    }

    return items;
  }

  async function createCanvasModule(module, canvasCourseId) {
    const body = {
      module: {
        name: module.title,
        published: true,
      },
    };

    return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules`, 'POST', body);
  }

  async function publishCanvasModule(module, canvasCourseId) {
    const body = {
      module: {
        published: true,
      },
    };

    return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules/${module.externalRefs.canvasModuleId}`, 'PUT', body);
  }

  async function addPageToModule(canvasModule, canvasPage, canvasCourseId) {
    const body = {
      module_item: {
        type: 'Page',
        page_url: canvasPage.url,
        title: canvasPage.title,
        published: true,
      },
    };

    return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules/${canvasModule.id}/items`, 'POST', body);
  }

  async function addQuizToModule(canvasModule, canvasQuiz, canvasCourseId) {
    const body = {
      module_item: {
        type: 'Quiz',
        content_id: canvasQuiz.id,
        title: canvasQuiz.title,
        published: true,
      },
    };

    return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules/${canvasModule.id}/items`, 'POST', body);
  }

  async function addAssignmentToModule(canvasModule, canvasAssignment, canvasCourseId) {
    const body = {
      module_item: {
        type: 'Assignment',
        content_id: canvasAssignment.id,
        title: canvasAssignment.name,
        published: true,
      },
    };

    return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules/${canvasModule.id}/items`, 'POST', body);
  }

  async function createCanvasPage(topic, canvasCourseId, canvasModule = null) {
    const body = {
      wiki_page: {
        title: topic.title,
        body: `<h1>${topic.title}</h1>`,
        published: true,
        front_page: false,
      },
    };

    const canvasPage = await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/pages`, 'POST', body);

    if (canvasModule) {
      await addPageToModule(canvasModule, canvasPage, canvasCourseId);
    }
    return canvasPage;
  }

  async function createCanvasQuiz(topic, canvasCourseId, canvasModule = null, dueAt = null) {
    const body = {
      quiz: {
        title: topic.title,
        description: `<h1>${topic.title}</h1>`,
        points_possible: pointsForTopic(topic),
        ...(dueAt ? { due_at: dueAt } : {}),
        published: true,
      },
    };

    const canvasQuiz = await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/quizzes`, 'POST', body);

    if (canvasModule) {
      await addQuizToModule(canvasModule, canvasQuiz, canvasCourseId);
    }
    return canvasQuiz;
  }

  async function createCanvasAssignment(topic, canvasCourseId, canvasModule = null, dueAt = null) {
    const body = {
      assignment: {
        name: topic.title,
        description: `<h1>${topic.title}</h1>`,
        points_possible: pointsForTopic(topic),
        grading_type: 'points',
        submission_types: ['online_url'],
        ...(dueAt ? { due_at: dueAt } : {}),
        published: true,
      },
    };

    const canvasAssignment = await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/assignments`, 'POST', body);

    if (canvasModule) {
      await addAssignmentToModule(canvasModule, canvasAssignment, canvasCourseId);
    }
    return canvasAssignment;
  }

  async function updateCanvasTopic({ course, topic, canvasCourseId, dueDatesByTopicId = {}, useStaticHtml = false }) {
    const html = useStaticHtml ? buildMasteryLsLinkHtml(course, topic) : await renderTopicHtml(course, topic);
    const dueAt = dueDatesByTopicId?.[topic.id] || null;

    if (topic.type === 'exam' && topic.externalRefs?.canvasQuizId) {
      const quizBody = {
        quiz: {
          title: topic.title,
          description: html,
          points_possible: pointsForTopic(topic),
          ...(dueAt ? { due_at: dueAt } : {}),
          published: true,
        },
      };

      return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/quizzes/${topic.externalRefs.canvasQuizId}`, 'PUT', quizBody);
    }

    if (topic.type === 'project' && topic.externalRefs?.canvasAssignmentId) {
      const assignmentBody = {
        assignment: {
          name: topic.title,
          description: html,
          points_possible: pointsForTopic(topic),
          grading_type: 'points',
          submission_types: ['online_url'],
          ...(dueAt ? { due_at: dueAt } : {}),
          published: true,
        },
      };

      return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/assignments/${topic.externalRefs.canvasAssignmentId}`, 'PUT', assignmentBody);
    }

    const body = {
      wiki_page: {
        title: topic.title,
        body: html,
        published: true,
      },
    };

    return service.makeCanvasApiRequest(`/courses/${canvasCourseId}/pages/${topic.externalRefs.canvasPageId}`, 'PUT', body);
  }

  async function cleanCanvasCourse({ canvasCourseId, setUpdateMessage }) {
    const pages = await listAllCanvasItems(`/courses/${canvasCourseId}/pages`);
    for (const page of pages) {
      setUpdateMessage(`Deleting Canvas page '${page.title}'`);
      await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/pages/${page.page_id}`, 'DELETE');
    }

    const quizzes = await listAllCanvasItems(`/courses/${canvasCourseId}/quizzes`);
    for (const quiz of quizzes) {
      setUpdateMessage(`Deleting Canvas quiz '${quiz.title || quiz.name || quiz.id}'`);
      await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/quizzes/${quiz.id}`, 'DELETE');
    }

    const assignments = await listAllCanvasItems(`/courses/${canvasCourseId}/assignments`);
    for (const assignment of assignments) {
      setUpdateMessage(`Deleting Canvas assignment '${assignment.name || assignment.id}'`);
      await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/assignments/${assignment.id}`, 'DELETE');
    }

    const modules = await listAllCanvasItems(`/courses/${canvasCourseId}/modules`);
    for (const module of modules) {
      setUpdateMessage(`Deleting Canvas module '${module.name}'`);
      await service.makeCanvasApiRequest(`/courses/${canvasCourseId}/modules/${module.id}`, 'DELETE');
    }
  }

  async function repairCanvasReferences({ updatedCourse, canvasCourseId, setUpdateMessage }) {
    updatedCourse.externalRefs = { ...updatedCourse.externalRefs, canvasCourseId };

    const pages = await listAllCanvasItems(`/courses/${canvasCourseId}/pages`);
    for (const page of pages) {
      setUpdateMessage(`Updating Canvas page reference for '${page.title}'`);
      const topic = updatedCourse.allTopics.find((item) => item.title === page.title);
      if (topic) {
        topic.externalRefs = { ...topic.externalRefs, canvasPageId: page.page_id };
      }
    }

    const quizzes = await listAllCanvasItems(`/courses/${canvasCourseId}/quizzes`);
    for (const quiz of quizzes) {
      setUpdateMessage(`Updating Canvas quiz reference for '${quiz.title}'`);
      const topic = updatedCourse.allTopics.find((item) => item.title === quiz.title);
      if (topic) {
        topic.externalRefs = { ...topic.externalRefs, canvasQuizId: quiz.id };
      }
    }

    const assignments = await listAllCanvasItems(`/courses/${canvasCourseId}/assignments`);
    for (const assignment of assignments) {
      setUpdateMessage(`Updating Canvas assignment reference for '${assignment.name}'`);
      const topic = updatedCourse.allTopics.find((item) => item.title === assignment.name);
      if (topic) {
        topic.externalRefs = { ...topic.externalRefs, canvasAssignmentId: assignment.id };
      }
    }
  }

  function removeCanvasReferences(updatedCourse) {
    if (updatedCourse.externalRefs) {
      const { canvasCourseId, canvasScheduleFileId, ...remainingCourseRefs } = updatedCourse.externalRefs;
      updatedCourse.externalRefs = Object.keys(remainingCourseRefs).length > 0 ? remainingCourseRefs : undefined;
    }

    for (const module of updatedCourse.modules) {
      if (module.externalRefs) {
        const { canvasModuleId, ...remainingModuleRefs } = module.externalRefs;
        module.externalRefs = Object.keys(remainingModuleRefs).length > 0 ? remainingModuleRefs : undefined;
      }

      for (const topic of module.topics) {
        if (topic.externalRefs) {
          const { canvasPageId, canvasQuizId, canvasAssignmentId, ...remainingTopicRefs } = topic.externalRefs;
          topic.externalRefs = Object.keys(remainingTopicRefs).length > 0 ? remainingTopicRefs : undefined;
        }
      }
    }
  }

  async function linkCourseResources({ updatedCourse, canvasCourseId, setUpdateMessage, dueDatesByTopicId = {}, onlyLinkAssignments = true, onTopicUpdateError }) {
    // create the modules and resources first
    for (const module of updatedCourse.modules) {
      const topicsToLink = module.topics.filter((topic) => shouldLinkTopic(topic, onlyLinkAssignments));
      const skippedTopics = module.topics.filter((topic) => !shouldLinkTopic(topic, onlyLinkAssignments));
      skippedTopics.forEach(clearCanvasTopicRefs);

      if (topicsToLink.length === 0) {
        if (module.externalRefs?.canvasModuleId) {
          const { canvasModuleId, ...remainingModuleRefs } = module.externalRefs;
          module.externalRefs = Object.keys(remainingModuleRefs).length > 0 ? remainingModuleRefs : undefined;
        }
        continue;
      }

      setUpdateMessage(`Creating module '${module.title}' in Canvas`);
      const canvasModule = await createCanvasModule(module, canvasCourseId);
      module.externalRefs = { ...module.externalRefs, canvasModuleId: canvasModule.id };
      for (const topic of topicsToLink) {
        const target = topicCanvasTarget(topic);

        if (target === 'quiz') {
          setUpdateMessage(`Creating quiz '${topic.title}' in Canvas`);
          const canvasQuiz = await createCanvasQuiz(topic, canvasCourseId, canvasModule, dueDatesByTopicId?.[topic.id] || null);
          topic.externalRefs = { ...topic.externalRefs, canvasQuizId: canvasQuiz.id };
        } else if (target === 'assignment') {
          setUpdateMessage(`Creating assignment '${topic.title}' in Canvas`);
          const canvasAssignment = await createCanvasAssignment(topic, canvasCourseId, canvasModule, dueDatesByTopicId?.[topic.id] || null);
          topic.externalRefs = { ...topic.externalRefs, canvasAssignmentId: canvasAssignment.id };
        } else {
          setUpdateMessage(`Creating topic '${topic.title}' in Canvas`);
          const canvasPage = await createCanvasPage(topic, canvasCourseId, canvasModule);
          topic.externalRefs = { ...topic.externalRefs, canvasPageId: canvasPage.page_id };
        }
      }
    }

    // now update each resource with content
    for (const module of updatedCourse.modules) {
      const topicsToLink = module.topics.filter((topic) => shouldLinkTopic(topic, onlyLinkAssignments));
      if (topicsToLink.length === 0 || !module.externalRefs?.canvasModuleId) {
        continue;
      }

      await publishCanvasModule(module, canvasCourseId);
      for (const topic of topicsToLink) {
        try {
          setUpdateMessage(`Linking topic '${topic.title}' to Canvas`);
          await updateCanvasTopic({ course: updatedCourse, topic, canvasCourseId, dueDatesByTopicId, useStaticHtml: true });
        } catch (error) {
          if (onTopicUpdateError) {
            onTopicUpdateError(topic, error);
          }
        }
      }
    }
  }

  return {
    cleanCanvasCourse,
    repairCanvasReferences,
    removeCanvasReferences,
    linkCourseResources,
    updateCanvasTopic,
  };
}
