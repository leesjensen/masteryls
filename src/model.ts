export type Role = {
  user: string;
  right: string;
  object: string | null;
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

  getRole(right: string, object: string): Role | undefined {
    return this.roles?.find((r) => r.right === right && r.object === object);
  }

  isRole(rights: string[], object?: string): boolean {
    return !!this.roles?.some((r) => rights.includes(r.right) && (!object || r.object === object));
  }

  isRoot(object: string | undefined): boolean {
    return this.isRole(['root']);
  }

  isEditor(object: string | undefined): boolean {
    return this.isRole(['editor'], object);
  }

  getSetting(settingKey: string, courseId: string | undefined): string | undefined {
    const role = this.roles?.find((r) => (r.object === courseId || !courseId) && r.settings && r.settings[settingKey]);
    if (role) {
      return role.settings[settingKey];
    }
  }
}

export type CatalogEntry = {
  id: string;
  name: string;
  title: string;
  description: string;
  links?: any;
  gitHub: {
    account: string;
    repository: string;
  };
};

export type Topic = {
  id: string;
  title: string;
  path: string;
  type: 'instruction' | 'exam' | 'project' | 'video';
};

export type Progress = {
  mastery: number;
};

export type Enrollment = {
  id: string;
  learnerId: string;
  catalogId: string;
  settings: {};
  progress: Progress;
  catalogEntry?: CatalogEntry;
};

export type Enrollments = Map<string, Enrollment>;
