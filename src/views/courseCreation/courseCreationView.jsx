import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateAppBar } from '../../hooks/useAppBarState.jsx';
import CourseCreationForm from './courseCreationForm.jsx';
import { useAlert } from '../../contexts/AlertContext.jsx';

export default function CourseCreationView({ courseOps }) {
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  const create = async (generateWithAi, sourceAccount, sourceRepo, catalogEntry, gitHubToken, setUpdateMessage) => {
    try {
      if (await courseOps.service.verifyGitHubAccount(gitHubToken)) {
        await courseOps.createCourse(generateWithAi, sourceAccount, sourceRepo, catalogEntry, gitHubToken, setUpdateMessage);
        navigate('/dashboard');
      } else {
        showAlert({ message: 'The provided GitHub token does not have the necessary permissions to create a course.', type: 'error' });
      }
    } catch (error) {
      showAlert({ message: `Error creating course: ${error.message}`, type: 'error' });
    }
  };

  const close = () => {
    navigate('/dashboard');
  };

  const appBarTools = (
    <button title="Close course creation" onClick={close} className="w-6 m-0.5 p-0.5 text-xs font-medium rounded-xs bg-white border border-gray-300 filter grayscale hover:grayscale-0 hover:border-gray-200 hover:shadow-sm transition-all duration-200 ease-in-out">
      ❌
    </button>
  );

  useEffect(() => {
    updateAppBar({ title: 'Create course', tools: appBarTools });
  }, []);

  return (
    <>
      <div className="flex-1 m-6 flex flex-col bg-white">
        <CourseCreationForm courseOps={courseOps} onClose={close} onCreate={create} />
      </div>
    </>
  );
}
