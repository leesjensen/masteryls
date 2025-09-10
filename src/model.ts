type Role = {
  owner: string;
  action: string;
  object: string;
  settings: any;
};

type User = {
  id: string;
  name: string;
  email: string;
  password?: string;
  preferences: any;
  roles?: Role[];
};

type CatalogEntry = {
  id?: string;
  name: string;
  title: string;
  description: string;
  ownerId: string;
  links?: object;
  gitHub: {
    account: string;
    repository: string;
  };
};

type Progress = {
  mastery: number;
};

type Enrollment = {
  id: string;
  learnerId: string;
  catalogId: string;
  settings: {
    currentTopic: string | null;
    tocIndexes: number[];
    sidebarVisible: boolean;
    token?: string;
  };
  progress: Progress;
  catalogEntry?: CatalogEntry;
};

type Enrollments = Map<string, Enrollment>;

export { User, CatalogEntry as CourseInfo, Progress, Enrollment, Enrollments };
