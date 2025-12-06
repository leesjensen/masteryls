import { useState, useEffect } from 'react';

function useModuleState(courseOps, course, currentTopic) {
  const [openModuleIndexes, setOpenModuleIndexes] = useState([]);

  const toggleModule = (index) => {
    const tocIndexes = openModuleIndexes.includes(index) ? openModuleIndexes.filter((i) => i !== index) : [...openModuleIndexes, index];
    courseOps.saveEnrollmentUiSettings(course.id, { tocIndexes });
    setOpenModuleIndexes(tocIndexes);
  };

  useEffect(() => {
    const settings = courseOps.getEnrollmentUiSettings(course.id);
    if (currentTopic?.path) {
      const moduleIndex = course.moduleIndexOf(currentTopic.path);
      if (moduleIndex !== -1 && !settings.tocIndexes.includes(moduleIndex)) {
        settings.tocIndexes.push(moduleIndex);
        courseOps.saveEnrollmentUiSettings(course.id, { tocIndexes: settings.tocIndexes });
      }
    }
    setOpenModuleIndexes(settings.tocIndexes);
  }, [currentTopic, course]);

  return {
    openModuleIndexes,
    toggleModule,
  };
}

export default useModuleState;
