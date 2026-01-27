import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { AppBarButton } from '../../appBar.jsx';
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
        courseOps.login(await courseOps.service.currentUser()); // Refresh user roles
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

  const appBarTools = <AppBarButton icon={X} onClick={close} title="Close" />;

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
