type User = {
  id: string;
  name: string;
  email: string;
  password?: string;
  preferences: any;
};

type CourseInfo = {
  id: string;
  title: string;
  description: string;
  canvas?: string;
  chat?: string;
  gitHub: {
    account: string;
    repository: string;
    token?: string;
  };
};

type Progress = {
  mastery: number;
};

type Enrollment = {
  id: string;
  courseId: string;
  ui: {
    currentTopic: string | null;
    tocIndexes: number[];
    sidebarVisible: boolean;
  };
  progress: Progress;
  courseInfo?: CourseInfo;
};

export { User, CourseInfo, Progress, Enrollment };
