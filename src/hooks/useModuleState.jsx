import { useState, useEffect } from 'react';

function useModuleState(course, enrollment, service, currentTopic) {
  const [openModuleIndexes, setOpenModuleIndexes] = useState([]);

  const toggleModule = (index) => {
    setOpenModuleIndexes((prev) => {
      const newIndexes = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];

      enrollment.settings.tocIndexes = newIndexes;
      service.saveEnrollment(enrollment);

      return newIndexes;
    });
  };

  useEffect(() => {
    if (currentTopic?.path) {
      const moduleIndex = course.moduleIndexOf(currentTopic.path);
      if (moduleIndex !== -1 && !enrollment.settings.tocIndexes.includes(moduleIndex)) {
        enrollment.settings.tocIndexes.push(moduleIndex);
        service.saveEnrollment(enrollment);
      }
    }
    setOpenModuleIndexes(enrollment.settings.tocIndexes);
  }, [currentTopic, course, enrollment, service]);

  return {
    openModuleIndexes,
    toggleModule,
  };
}

export default useModuleState;
