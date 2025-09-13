export type Role = {
  user: string;
  right: string;
  object: string;
  settings: object;
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

  updateRoleSettings(object: string, settings: object): Role[] {
    const updatedRoles: Role[] = [];
    this.roles?.forEach((r) => {
      if (r.right === 'root' || r.object === object) {
        r.settings = { ...r.settings, ...settings };
        updatedRoles.push(r);
      }
    });
    return updatedRoles;
  }

  isRole(rights: string[], object?: string): boolean {
    return !!this.roles?.some((r) => r.right === 'root' || (rights.includes(r.right) && (!object || r.object === object)));
  }

  isOwner(object: string | undefined): boolean {
    return this.isRole(['owner'], object);
  }

  isEditor(object: string | undefined): boolean {
    return this.isRole(['owner', 'editor'], object);
  }

  gitHubToken(courseId: string): string | undefined {
    const role = this.roles?.find((r) => r.object === courseId && r.settings && r.settings[courseId] && r.settings[courseId].gitHubToken);
    if (role) {
      return role.settings[courseId].gitHubToken;
    }
  }
}

export type CatalogEntry = {
  id: string;
  name: string;
  title: string;
  description: string;
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
