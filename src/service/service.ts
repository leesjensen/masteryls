import { createClient } from '@supabase/supabase-js';
import config from '../../config';
import { User, CourseInfo as CatalogEntry, Enrollment, Enrollments } from '../model';

const supabase = createClient(config.supabase.url, config.supabase.key);

class Service {
  catalog: CatalogEntry[] = [];

  constructor(catalog: CatalogEntry[]) {
    this.catalog = catalog;
  }

  static async create() {
    const { data, error } = await supabase.from('catalog').select('id, name, title, description, links, gitHub, ownerId');

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

  async createCourse(templateOwner: string, templateRepo: string, catalogEntry: CatalogEntry, gitHubToken: string): Promise<CatalogEntry> {
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

  async removeCourse(enrollment: Enrollment): Promise<void> {
    if (enrollment.catalogEntry?.ownerId === enrollment.learnerId && enrollment.settings.token) {
      const catalogEntry = enrollment.catalogEntry;
      const deleteResp = await fetch(`https://api.github.com/repos/${catalogEntry.gitHub.account}/${catalogEntry.gitHub.repository}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${enrollment.settings.token}`,
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

  async register(name: string, email: string, password: string): Promise<User | null> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message || 'Unable to register');
    }

    const user: User = {
      id: data.user.id,
      email,
      name,
      preferences: { language: 'en' },
    };
    const { error: upsertError } = await supabase.from('learner').upsert(user);
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

  async createEnrollment(learnerId: string, catalogEntry: CatalogEntry, token: string | undefined): Promise<Enrollment> {
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
            token,
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

  async removeEnrollment(enrollment: Enrollment): Promise<void> {
    const { error } = await supabase.from('enrollment').delete().eq('id', enrollment.id);
    if (error) {
      throw new Error(error.message);
    }
  }

  async commitTopicMarkdown(gitHubUrl: string, markdown: string, token: string, commitMessage: string): Promise<void> {
    // Get current file SHA - This will overwrite any changes made on GitHub since last fetch
    const getRes = await this.makeGitHubApiRequest(token, gitHubUrl);
    const fileData = await getRes.json();
    const sha = fileData.sha;

    // Commit to GitHub
    const contentBase64 = btoa(new TextEncoder().encode(markdown).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    await this.makeGitHubApiRequest(token, gitHubUrl, 'PUT', {
      message: commitMessage,
      content: contentBase64,
      sha,
    });
  }

  async makeGitHubApiRequest(token: string, url: string, method: string = 'GET', body?: object) {
    const request: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    };
    return fetch(url, request);
  }

  async _loadUser({ id }: { id: string }) {
    const { data, error } = await supabase.from('learner').select('id, name, email, preferences').eq('id', id).single();

    if (error) {
      throw new Error(error.message);
    }

    const user: User = { ...data };

    return user;
  }
}

const service = await Service.create();
export default service;
