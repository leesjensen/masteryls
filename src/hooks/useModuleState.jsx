import { useState, useEffect } from 'react';

function useModuleState(courseOps, course, service, currentTopic) {
  const [openModuleIndexes, setOpenModuleIndexes] = useState([]);

  const toggleModule = (index) => {
    setOpenModuleIndexes((prev) => {
      const tocIndexes = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];
      courseOps.saveEnrollmentUiSettings(course.id, { tocIndexes });

      return tocIndexes;
    });
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
  }, [currentTopic, course, service]);

  return {
    openModuleIndexes,
    toggleModule,
  };
}

export default useModuleState;
