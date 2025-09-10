export type Role = {
  user: string;
  right: string;
  object: string;
  settings: any;
};

export class User {
  id: string;
  name: string;
  email: string;
  settings: object;
  roles?: Role[];
  password?: string;
  constructor(data: { id: string; name: string; email: string; settings: object; roles?: Role[]; password?: string }) {
    Object.assign(this, data);
  }

  isRole(right: string, object?: string): boolean {
    return !!this.roles?.some((r) => r.right === right && (!object || r.object === object));
  }

  isOwner(object: string): boolean {
    return this.isRole('owner', object);
  }

  isEditor(object: string): boolean {
    return !!this.roles?.some((r) => (r.right === 'editor' || r.right === 'owner') && r.object === object);
  }

  gitHubToken(courseId: string): string | undefined {
    return this.roles?.find((r) => (r.right === 'editor' || r.right === 'owner') && r.object === courseId)?.settings?.token;
  }
}

export type CatalogEntry = {
  id: string;
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

export type Progress = {
  mastery: number;
};

export type Enrollment = {
  id: string;
  learnerId: string;
  catalogId: string;
  settings: {
    currentTopic: string | null;
    tocIndexes: number[];
    sidebarVisible: boolean;
  };
  progress: Progress;
  catalogEntry?: CatalogEntry;
};

export type Enrollments = Map<string, Enrollment>;
