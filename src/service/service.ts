import { createClient } from '@supabase/supabase-js';
import config from '../../config';
import { User, CatalogEntry, Enrollment, Role } from '../model';

const supabase = createClient(config.supabase.url, config.supabase.key);

class Service {
  catalog: CatalogEntry[] = [];

  constructor(catalog: CatalogEntry[]) {
    this.catalog = catalog;
  }

  static async create() {
    const { data, error } = await supabase.from('catalog').select('id, name, title, description, links, gitHub');

    if (error) {
      throw new Error(error.message);
    }

    return new Service(data);
  }

  courseCatalog(): CatalogEntry[] {
    return this.catalog;
  }

  catalogEntry(catalogId: string) {
    return this.catalog.find((c) => c.id === catalogId);
  }

  async getTemplateRepositories(gitHubAccount: string): Promise<string[]> {
    const url = `https://api.github.com/users/${gitHubAccount}/repos?per_page=100`;
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      throw new Error(`Failed to fetch repositories: ${resp.status} ${errText}`);
    }

    const repos = await resp.json();
    return repos.filter((repo: any) => repo.is_template).map((repo: any) => repo.name);
  }

  async verifyGitHubAccount(gitHubToken: string): Promise<boolean> {
    const resp = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${gitHubToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    return resp.ok;
  }

  async createCourse(user: User, templateOwner: string, templateRepo: string, catalogEntry: CatalogEntry, gitHubToken: string): Promise<CatalogEntry> {
    try {
      if (gitHubToken && catalogEntry.gitHub && catalogEntry.gitHub.account && catalogEntry.gitHub.repository) {
        const targetOwner = catalogEntry.gitHub.account;
        const targetRepo = catalogEntry.gitHub.repository;

        const url = `https://api.github.com/repos/${templateOwner}/${templateRepo}/generate`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${gitHubToken}`,
            Accept: 'application/vnd.github.baptiste-preview+json, application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ owner: targetOwner, name: targetRepo, description: 'my repo', private: false }),
        });

        if (resp.status !== 201) {
          const errText = await resp.text().catch(() => resp.statusText);
          throw new Error(`${resp.status} ${errText}`);
        }
      }
    } catch (err: any) {
      throw new Error(`Failed to create course from template: ${err?.message || err}`);
    }

    const { data, error } = await supabase.from('catalog').insert([catalogEntry]).select().single();
    if (error) {
      throw new Error(error.message);
    }

    this.catalog.push(data);

    return data;
  }

  async saveCourseSettings(catalogEntry: CatalogEntry): Promise<void> {
    const { error } = await supabase.from('catalog').upsert(catalogEntry);
    if (error) {
      throw new Error(error.message);
    }

    const index = this.catalog.findIndex((c) => c.id === catalogEntry.id);
    if (index !== -1) {
      this.catalog[index] = catalogEntry;
    } else {
      this.catalog.push(catalogEntry);
    }
  }

  async deleteCourse(user: User, catalogEntry: CatalogEntry): Promise<void> {
    const token = user.getSetting('gitHubToken', catalogEntry.id);
    if (token) {
      const deleteResp = await fetch(`https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (!deleteResp.ok) {
        const errText = await deleteResp.text().catch(() => deleteResp.statusText);
        throw new Error(`Failed to delete course: ${deleteResp.status} ${errText}`);
      }

      const { error } = await supabase.from('catalog').delete().eq('id', catalogEntry.id);
      if (error) {
        throw new Error(error.message);
      }

      this.catalog = this.catalog.filter((c) => c.id !== catalogEntry.id);
    }
  }

  async currentUser(): Promise<User | null> {
    const session = await supabase.auth.getSession();
    if (session.data.session?.user) {
      return await this._loadUser({ id: session.data.session.user.id });
    }
    return null;
  }

  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('user').select('id, name, email, settings');
    if (error) {
      throw new Error(error.message);
    }

    const users: User[] = [];
    for (const item of data) {
      const user = new User({ ...item, roles: await this._loadUserRoles({ id: item.id }) });
      users.push(user);
    }
    return users;
  }

  async addUserRole(user: User, right: string, objectId: string | null, settings: any = {}): Promise<void> {
    const newRole: Role = {
      user: user.id,
      right,
      object: objectId,
      settings,
    };
    const { error } = await supabase.from('role').insert(newRole);
    if (error) {
      throw new Error(error.message);
    }
  }

  async removeUserRole(user: User, right: string, objectId: string | null): Promise<void> {
    const { error } = await supabase.from('role').delete().eq('user', user.id).eq('right', right).eq('object', objectId);

    let query = supabase.from('role').delete().eq('user', user.id);
    query = objectId === null ? query.is('object', null) : query.eq('object', objectId);
    query = query.eq('right', right);

    if (error) {
      throw new Error(error.message);
    }
  }

  async updateUserRoleSettings(user: User, right: string, objectId: string, settings: object): Promise<void> {
    const role = user.getRole(right, objectId);
    if (role) {
      role.settings = { ...role.settings, ...settings };
      let query = supabase.from('role').update({ settings: role.settings }).eq('user', role.user);

      query = role.object === null ? query.is('object', null) : query.eq('object', role.object);
      query = query.eq('right', role.right);
      const { error } = await query;
      if (error) {
        throw new Error(error.message);
      }
    }
  }

  async register(name: string, email: string, password: string): Promise<User | null> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message || 'Unable to register');
    }

    const userData = {
      id: data.user.id,
      email,
      name,
      settings: { language: 'en' },
    };
    const { error: upsertError } = await supabase.from('user').upsert(userData);
    if (upsertError) {
      throw new Error(upsertError.message);
    }

    return this._loadUser({ id: data.user.id });
  }

  async login(email: string, password: string): Promise<User | null> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message || 'Unable to login');
    }
    return this.currentUser();
  }

  async logout() {
    await supabase.auth.signOut();
  }

  allEnrolled(enrollments: Map<string, Enrollment>) {
    return (
      this.catalog.filter((course) => {
        if (course.id) {
          return !enrollments.has(course.id);
        }
        return false;
      }).length === 0
    );
  }

  async currentEnrollment(learnerId: string): Promise<Enrollment | null> {
    const currentCourse = localStorage.getItem('currentCourse');
    if (currentCourse) {
      const enrollments = await this.enrollments(learnerId);
      if (enrollments) {
        return enrollments.get(currentCourse) || null;
      }
    }
    return null;
  }

  async enrollments(id: string): Promise<Map<string, Enrollment>> {
    const { data, error } = await supabase.from('enrollment').select('id, catalogId, learnerId, settings, progress').eq('learnerId', id);

    if (error) {
      throw new Error(error.message);
    }

    const enrollments = new Map<string, Enrollment>();
    data.forEach((item) => {
      enrollments.set(item.catalogId, { ...item, catalogEntry: this.catalogEntry(item.catalogId) });
    });

    return enrollments;
  }

  setCurrentCourse(catalogId: string): void {
    localStorage.setItem('currentCourse', catalogId);
  }

  removeCurrentCourse(): void {
    localStorage.removeItem('currentCourse');
  }

  async createEnrollment(learnerId: string, catalogEntry: CatalogEntry): Promise<Enrollment> {
    const { data, error } = await supabase
      .from('enrollment')
      .insert([
        {
          catalogId: catalogEntry.id,
          learnerId,
          settings: {
            currentTopic: null,
            tocIndexes: [0],
            sidebarVisible: true,
          },
          progress: { mastery: 0 },
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { ...data, catalogEntry };
  }

  async saveEnrollment(enrollment: Enrollment) {
    const { catalogEntry: catalogEntry, ...enrollmentData } = enrollment;
    const { error } = await supabase.from('enrollment').upsert(enrollmentData);
    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteEnrollment(enrollment: Enrollment): Promise<void> {
    const { error } = await supabase.from('enrollment').delete().eq('id', enrollment.id);
    if (error) {
      throw new Error(error.message);
    }
  }

  async commitGitHubFile(gitHubUrl: string, content: string, token: string, commitMessage: string, sha?: string): Promise<void> {
    const contentBase64 = btoa(new TextEncoder().encode(content).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    const body: any = {
      message: commitMessage,
      content: contentBase64,
    };

    // Only include SHA if file exists (for updates)
    if (sha) {
      body.sha = sha;
    }

    await this.makeGitHubApiRequest(token, gitHubUrl, 'PUT', body);
  }

  async updateGitHubFile(gitHubUrl: string, content: string, token: string, commitMessage: string): Promise<void> {
    const getRes = await this.makeGitHubApiRequest(token, gitHubUrl);
    const fileData = await getRes.json();
    if (!getRes.ok) {
      throw new Error(`Failed to update file: ${getRes.status} ${fileData.message || getRes.statusText}`);
    }

    return this.commitGitHubFile(gitHubUrl, content, token, commitMessage, fileData.sha);
  }

  async makeGitHubApiRequest(token: string, url: string, method: string = 'GET', body?: object) {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const request: RequestInit = {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    };
    return fetch(url, request);
  }

  async _loadUser({ id }: { id: string }) {
    const { data, error } = await supabase.from('user').select('id, name, email, settings').eq('id', id).single();

    if (error) {
      throw new Error(error.message);
    }

    const user = new User({ ...data, roles: await this._loadUserRoles({ id: data.id }) });

    return user;
  }

  async _loadUserRoles({ id }: { id: string }) {
    const { data, error } = await supabase.from('role').select('user, right, object, settings').eq('user', id);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
}

const service = await Service.create();
export default service;
