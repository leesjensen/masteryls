import { createClient } from '@supabase/supabase-js';
import config from '../../config';
import { User, CatalogEntry, Enrollment, Role } from '../model';

class Service {
  catalog: CatalogEntry[] = [];
  supabase;

  constructor(catalog: CatalogEntry[], supabase: any) {
    this.catalog = catalog;
    this.supabase = supabase;
  }

  /**
   * Factory method to create a Service instance.
   * Initializes the Supabase client and fetches the initial catalog.
   * @returns A new Service instance.
   */
  static async create() {
    const supabase = createClient(config.supabase.url, config.supabase.key);
    const { data, error } = await supabase.from('catalog').select('id, name, title, description, gitHub, settings');

    if (error) {
      throw new Error(error.message);
    }

    return new Service(data, supabase);
  }

  /**
   * Retrieves the current course catalog.
   * @returns An array of CatalogEntry objects.
   */
  courseCatalog(): CatalogEntry[] {
    return this.catalog;
  }

  /**
   * Retrieves a specific catalog entry by its ID.
   * @param catalogId - The ID of the catalog entry.
   * @returns The CatalogEntry if found and published, otherwise null.
   */
  catalogEntry(catalogId: string) {
    return this.catalog.find((c) => c.id === catalogId);
  }

  /**
   * Fetches available template repositories from a GitHub account.
   * @param gitHubToken - The GitHub personal access token.
   * @param gitHubAccount - The GitHub account name.
   * @returns A promise resolving to an array of repository names.
   */
  async getTemplateRepositories(gitHubToken: string, gitHubAccount: string): Promise<string[]> {
    const url = `https://api.github.com/users/${gitHubAccount}/repos?per_page=100`;
    const resp = await this.makeGitHubApiRequest(gitHubToken, url);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      throw new Error(`Failed to fetch repositories: ${resp.status} ${errText}`);
    }

    const repos = await resp.json();
    return repos.filter((repo: any) => repo.is_template).map((repo: any) => repo.name);
  }

  /**
   * Verifies if a GitHub token is valid.
   * @param gitHubToken - The GitHub personal access token.
   * @returns A promise resolving to true if valid, false otherwise.
   */
  async verifyGitHubAccount(gitHubToken: string): Promise<boolean> {
    const resp = await this.makeGitHubApiRequest(gitHubToken, 'https://api.github.com/user');
    return resp.ok;
  }

  /**
   * Creates a course repository using the default template.
   * @param catalogEntry - The catalog entry containing course details.
   * @param gitHubToken - The GitHub personal access token.
   */
  async createCourseRepoFromDefaultTemplate(catalogEntry: CatalogEntry, gitHubToken: string): Promise<void> {
    await this.createCourseRepoFromTemplate('csinstructiontemplate', 'emptycourse', catalogEntry, gitHubToken);
  }

  /**
   * Creates a course repository from a specified template.
   * @param templateOwner - The owner of the template repository.
   * @param templateRepo - The name of the template repository.
   * @param catalogEntry - The catalog entry containing course details.
   * @param gitHubToken - The GitHub personal access token.
   */
  async createCourseRepoFromTemplate(templateOwner: string, templateRepo: string, catalogEntry: CatalogEntry, gitHubToken: string): Promise<void> {
    try {
      if (gitHubToken && catalogEntry.gitHub && catalogEntry.gitHub.account && catalogEntry.gitHub.repository) {
        const targetOwner = catalogEntry.gitHub.account;
        const targetRepo = catalogEntry.gitHub.repository;

        let description = catalogEntry.description || 'Course repository generated from template';
        if (description.length > 300) {
          description = description.substring(0, 297) + '...';
        }

        const url = `https://api.github.com/repos/${templateOwner}/${templateRepo}/generate`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${gitHubToken}`,
            Accept: 'application/vnd.github.baptiste-preview+json, application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ owner: targetOwner, name: targetRepo, description, private: false }),
        });

        if (resp.status !== 201) {
          const errText = await resp.text().catch(() => resp.statusText);
          throw new Error(`${resp.status} ${errText}`);
        }
      }
    } catch (err: any) {
      throw new Error(`Failed to create course from template: ${err?.message || err}`);
    }
  }

  /**
   * Creates a new catalog entry and assigns the editor role to the creator.
   * @param editor - The user creating the entry.
   * @param catalogEntry - The catalog entry to create.
   * @param gitHubToken - The GitHub personal access token.
   * @returns The created CatalogEntry.
   */
  async createCatalogEntry(editor: User, catalogEntry: CatalogEntry, gitHubToken: string): Promise<CatalogEntry> {
    catalogEntry.settings = catalogEntry.settings || { state: 'unpublished', deleteProtected: false };
    await this.saveCatalogEntry(catalogEntry);
    await this.addUserRole(editor, 'editor', catalogEntry.id, { gitHubToken });

    return catalogEntry;
  }

  /**
   * Saves or updates a catalog entry in the database.
   * @param catalogEntry - The catalog entry to save.
   */
  async saveCatalogEntry(catalogEntry: CatalogEntry): Promise<void> {
    delete catalogEntry.links;
    const { data, error } = await this.supabase.from('catalog').upsert(catalogEntry).select('id').single();
    if (error) {
      throw new Error(error.message);
    }
    catalogEntry.id = data.id;

    const index = this.catalog.findIndex((c) => c.id === catalogEntry.id);
    if (index !== -1) {
      this.catalog[index] = { ...this.catalog[index], ...catalogEntry };
    } else {
      this.catalog.push(catalogEntry);
    }
  }

  /**
   * Deletes a course from the catalog and its associated GitHub repository.
   * @param user - The user requesting the deletion.
   * @param catalogEntry - The catalog entry to delete.
   */
  async deleteCourse(user: User, catalogEntry: CatalogEntry): Promise<void> {
    const token = user.getSetting('gitHubToken', catalogEntry.id);
    if (token) {
      const deleteResp = await this.makeGitHubApiRequest(token, `https://api.github.com/repos/${catalogEntry.gitHub?.account}/${catalogEntry.gitHub?.repository}`, 'DELETE');
      if (!deleteResp.ok) {
        const errText = await deleteResp.text().catch(() => deleteResp.statusText);
        throw new Error(`Failed to delete course: ${deleteResp.status} ${errText}`);
      }

      const { error } = await this.supabase.from('catalog').delete().eq('id', catalogEntry.id);
      if (error) {
        throw new Error(error.message);
      }

      this.catalog = this.catalog.filter((c) => c.id !== catalogEntry.id);
    }
  }

  /**
   * Retrieves the currently logged-in user.
   * @returns The current User object or null if not logged in.
   */
  async currentUser(): Promise<User | null> {
    const session = await this.supabase.auth.getSession();
    if (session.data.session?.user) {
      try {
        return await this._loadUser({ id: session.data.session.user.id });
      } catch {
        this.supabase.auth.signOut();
      }
    }
    return null;
  }

  /**
   * Retrieves all users from the database.
   * @returns An array of User objects.
   */
  async getAllUsers(): Promise<User[]> {
    const { data, error } = await this.supabase.from('user').select('id, name, email, settings');
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

  /**
   * Adds a role to a user.
   * @param user - The user to assign the role to.
   * @param right - The right/permission to grant.
   * @param objectId - The object ID the right applies to (nullable).
   * @param settings - Additional settings for the role.
   * @returns The updated User object.
   */
  async addUserRole(user: User, right: string, objectId: string | null, settings: any = {}): Promise<User> {
    const newRole: Role = {
      user: user.id,
      right,
      object: objectId,
      settings,
    };
    const { error } = await this.supabase.from('role').insert(newRole);
    if (error) {
      throw new Error(error.message);
    }
    return new User({ ...user, roles: [newRole, ...(user.roles || [])] });
  }

  /**
   * Removes a role from a user.
   * @param user - The user to remove the role from.
   * @param right - The right/permission to remove.
   * @param objectId - The object ID the right applies to (nullable).
   */
  async removeUserRole(user: User, right: string, objectId: string | null): Promise<void> {
    const { error } = await this.supabase.from('role').delete().eq('user', user.id).eq('right', right).eq('object', objectId);

    let query = this.supabase.from('role').delete().eq('user', user.id);
    query = objectId === null ? query.is('object', null) : query.eq('object', objectId);
    query = query.eq('right', right);

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Updates settings for a specific user role.
   * @param user - The user whose role settings are being updated.
   * @param right - The right/permission of the role.
   * @param objectId - The object ID the right applies to.
   * @param settings - The new settings to apply.
   */
  async updateUserRoleSettings(user: User, right: string, objectId: string, settings: object): Promise<void> {
    const role = user.getRole(right, objectId);
    if (role) {
      role.settings = { ...role.settings, ...settings };
      let query = this.supabase.from('role').update({ settings: role.settings }).eq('user', role.user);

      query = role.object === null ? query.is('object', null) : query.eq('object', role.object);
      query = query.eq('right', role.right);
      const { error } = await query;
      if (error) {
        throw new Error(error.message);
      }
    }
  }

  /**
   * Registers a new user.
   * @param name - The user's name.
   * @param email - The user's email.
   * @param password - The user's password.
   * @returns The newly created User object or null if registration failed.
   */
  async register(name: string, email: string, password: string): Promise<User | null> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message || 'Unable to register');
    }

    const userData = {
      id: data.user.id,
      email,
      name,
      settings: { language: 'en' },
    };
    const { error: upsertError } = await this.supabase.from('user').upsert(userData);
    if (upsertError) {
      throw new Error(upsertError.message);
    }

    return this._loadUser({ id: data.user.id });
  }

  /**
   * Logs in a user.
   * @param email - The user's email.
   * @param password - The user's password.
   * @returns The logged-in User object or null if login failed.
   */
  async login(email: string, password: string): Promise<User | null> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message || 'Unable to login');
    }
    return this.currentUser();
  }

  /**
   * Logs out the current user.
   */
  async logout() {
    localStorage.clear();
    await this.supabase.auth.signOut();
  }

  /**
   * Deletes a user account.
   * @param user - The user to delete.
   */
  async deleteUser(user: User): Promise<void> {
    const { error } = await this.supabase.from('user').delete().eq('id', user.id);
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Retrieves enrollment UI settings for a course.
   * @param courseId - The ID of the course.
   * @returns The UI settings object.
   */
  getEnrollmentUiSettings(courseId: string | undefined) {
    const defaultEnrollmentSettings = { editing: true, tocIndexes: [0], sidebarVisible: 'split', sidebarWidth: 300, currentTopic: null };

    if (courseId) {
      const settings = localStorage.getItem(`uiSettings-${courseId}`);
      if (settings) {
        return JSON.parse(settings);
      } else {
        localStorage.setItem(`uiSettings-${courseId}`, JSON.stringify(defaultEnrollmentSettings));
      }
    }
    return defaultEnrollmentSettings;
  }

  /**
   * Saves UI settings for a course enrollment.
   * @param courseId - The ID of the course.
   * @param updatedSettings - The new settings to merge.
   * @returns The updated settings object.
   */
  saveEnrollmentUiSettings(courseId: string, updatedSettings: object) {
    const settings = { ...this.getEnrollmentUiSettings(courseId), ...updatedSettings };
    localStorage.setItem(`uiSettings-${courseId}`, JSON.stringify(settings));
    return settings;
  }

  /**
   * Retrieves the current enrollment for a learner based on the last accessed course.
   * @param learnerId - The learner's user ID.
   * @returns The Enrollment object or null if not found.
   */
  async currentEnrollment(learnerId: string): Promise<Enrollment | null> {
    const currentCourse = localStorage.getItem('currentCourse');
    if (currentCourse) {
      return this.enrollment(learnerId, currentCourse);
    }
    return null;
  }

  /**
   * Retrieves all enrollments for a learner.
   * @param learnerId - The learner's user ID.
   * @returns A Map where keys are catalog IDs and values are Enrollment objects.
   */
  async enrollments(learnerId: string): Promise<Map<string, Enrollment>> {
    const { data, error } = await this.supabase.from('enrollment').select('id, catalogId, learnerId, settings, progress').eq('learnerId', learnerId);

    if (error) {
      throw new Error(error.message);
    }

    const result = new Map<string, Enrollment>();
    data.forEach((item: any) => {
      const entry = this.catalogEntry(item.catalogId);
      if (entry) {
        result.set(item.catalogId, { ...item, catalogEntry: entry });
      }
    });

    return result;
  }

  /**
   * Retrieves all enrollments for a specific course catalog.
   * @param catalogId - The ID of the catalog entry.
   * @returns An array of enrollment records.
   */
  async allEnrollments(catalogId: string): Promise<any> {
    const { data, error } = await this.supabase.from('enrollment').select('id, catalogId, learnerId, settings, progress').eq('catalogId', catalogId);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Retrieves a specific enrollment for a learner in a course.
   * @param learnerId - The learner's user ID.
   * @param catalogId - The course catalog ID.
   * @returns The Enrollment object or null if not found.
   */
  async enrollment(learnerId: string, catalogId: string): Promise<Enrollment | null> {
    const { data, error } = await this.supabase.from('enrollment').select('id, catalogId, learnerId, settings, progress').eq('learnerId', learnerId).eq('catalogId', catalogId);

    if (error) {
      return null;
    }

    return { ...data[0], catalogEntry: this.catalogEntry(catalogId) };
  }

  /**
   * Sets the current course in local storage.
   * @param catalogId - The course catalog ID.
   */
  setCourseUiSettings(catalogId: string): void {
    localStorage.setItem('currentCourse', catalogId);
  }

  /**
   * Removes the current course from local storage.
   */
  removeCourseUiSettings(): void {
    localStorage.removeItem('currentCourse');
  }

  /**
   * Creates a new enrollment for a learner.
   * @param learnerId - The learner's user ID.
   * @param catalogEntry - The course catalog entry.
   * @returns The created Enrollment object.
   */
  async createEnrollment(learnerId: string, catalogEntry: CatalogEntry): Promise<Enrollment> {
    const { data, error } = await this.supabase
      .from('enrollment')
      .insert([
        {
          catalogId: catalogEntry.id,
          learnerId,
          settings: {},
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

  /**
   * Saves or updates an enrollment.
   * @param enrollment - The enrollment object to save.
   */
  async saveEnrollment(enrollment: Enrollment) {
    const { catalogEntry: catalogEntry, ...enrollmentData } = enrollment;
    const { error } = await this.supabase.from('enrollment').upsert(enrollmentData);
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Deletes an enrollment.
   * @param enrollment - The enrollment to delete.
   */
  async deleteEnrollment(enrollment: Enrollment): Promise<void> {
    const { error } = await this.supabase.from('enrollment').delete().eq('id', enrollment.id);
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Adds a progress record for a user.
   * @param userId - The user ID.
   * @param catalogId - The course catalog ID.
   * @param enrollmentId - The enrollment ID.
   * @param topicId - The topic ID.
   * @param interactionId - The activity ID.
   * @param type - The type of progress (default: 'instructionView').
   * @param duration - Duration spent in seconds (default: 0).
   * @param details - Additional details object.
   * @param createdAt - Timestamp of the progress.
   */
  async addProgress(userId: string, catalogId: string, enrollmentId: string, topicId: string, interactionId: string, type: string = 'instructionView', duration: number = 0, details: object = {}, createdAt: string): Promise<void> {
    const progressData: any = {
      userId,
      catalogId,
      enrollmentId,
      topicId,
      interactionId,
      type,
      duration,
      details,
    };
    if (createdAt !== undefined) {
      progressData.createdAt = createdAt;
    }

    const { error } = await this.supabase.from('progress').insert([progressData]).select().single();

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Retrieves progress records based on filters.
   * @param params - Object containing filter parameters (type, courseId, etc.) and pagination options.
   * @returns An object containing data, total count, and hasMore flag.
   */
  async getProgress({ type, courseId, enrollmentId, userId, topicId, interactionId, startDate, endDate, page = 1, limit = 100 }: { type?: string; courseId?: string; enrollmentId?: string; userId?: string; topicId?: string; interactionId?: string; startDate?: string; endDate?: string; page?: number; limit?: number }): Promise<{ data: any[]; totalCount: number; hasMore: boolean }> {
    let query = this.supabase.from('progress').select('*', { count: 'exact' });

    if (courseId) {
      query = query.eq('catalogId', courseId);
    }
    if (enrollmentId) {
      query = query.eq('enrollmentId', enrollmentId);
    }
    if (userId) {
      query = query.eq('userId', userId);
    }
    if (topicId) {
      query = query.eq('topicId', topicId);
    }
    if (interactionId) {
      query = query.eq('interactionId', interactionId);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (startDate) {
      query = query.gte('createdAt', startDate);
    }
    if (endDate) {
      query = query.lte('createdAt', endDate);
    }

    const offset = (page - 1) * limit;
    const { data, error, count } = await query.order('createdAt', { ascending: false }).range(offset, offset + limit - 1);

    return {
      data: data || [],
      totalCount: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  }

  /**
   * Fetches commit history for a specific file in a repo.
   * @param gitHubToken - GitHub token.
   * @param fileUrl - The API URL for the file commits.
   * @returns Array of commit objects.
   */
  async getTopicCommits(gitHubToken: string, fileUrl: string): Promise<any[]> {
    const res = await this.makeGitHubApiRequest(gitHubToken, fileUrl);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Updates a file in a GitHub repository.
   * @param gitHubUrl - The API URL of the file.
   * @param content - New content for the file.
   * @param token - GitHub token.
   * @param commitMessage - Message for the commit.
   * @returns The SHA of the new commit.
   */
  async updateGitHubFile(gitHubUrl: string, content: string, token: string, commitMessage: string): Promise<string> {
    const commitSha = await this._getGitHubFileSha(gitHubUrl, token);
    return await this.commitGitHubFile(gitHubUrl, content, token, commitMessage, commitSha);
  }

  /**
   * Commits a file to GitHub (create or update).
   * @param gitHubUrl - The API URL.
   * @param content - Content string or Uint8Array.
   * @param token - GitHub token.
   * @param commitMessage - Message for the commit.
   * @param commitSha - Optional SHA of the previous commit (for updates).
   * @returns The SHA of the new commit.
   */
  async commitGitHubFile(gitHubUrl: string, content: string | Uint8Array, token: string, commitMessage: string, commitSha?: string): Promise<string> {
    let contentBase64: string;
    if (content instanceof Uint8Array) {
      contentBase64 = btoa(
        Array.from(content)
          .map((byte) => String.fromCharCode(byte))
          .join(''),
      );
    } else if (typeof content == 'string') {
      contentBase64 = btoa(new TextEncoder().encode(content).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    } else {
      throw new Error('Invalid content type');
    }

    const body: any = {
      message: commitMessage,
      content: contentBase64,
    };

    if (commitSha) {
      body.sha = commitSha;
    }

    const commitRes = await this.makeGitHubApiRequest(token, gitHubUrl, 'PUT', body);
    if (!commitRes.ok) throw new Error(`Failed to commit file: ${commitRes.status} ${commitRes.statusText}`);

    const commitData = await commitRes.json();
    return commitData.commit.sha;
  }

  /**
   * Deletes a file from GitHub.
   * @param gitHubUrl - The API URL of the file.
   * @param token - GitHub token.
   * @param commitMessage - Message for the commit.
   */
  async deleteGitHubFile(gitHubUrl: string, token: string, commitMessage: string): Promise<void> {
    const commitSha = await this._getGitHubFileSha(gitHubUrl, token);
    const body = {
      message: commitMessage,
      sha: commitSha,
    };

    const deleteRes = await this.makeGitHubApiRequest(token, gitHubUrl, 'DELETE', body);
    if (!deleteRes.ok) {
      throw new Error(`Failed to delete file: ${deleteRes.status} ${deleteRes.statusText}`);
    }
  }

  /**
   * Recursively deletes a folder and its contents from GitHub.
   * @param gitHubUrl - The API URL of the folder.
   * @param token - GitHub token.
   * @param commitMessage - Message for the commits.
   */
  async deleteGitHubFolder(gitHubUrl: string, token: string, commitMessage: string): Promise<void> {
    const getFilesRes = await this.makeGitHubApiRequest(token, gitHubUrl);
    if (!getFilesRes.ok) {
      if (getFilesRes.status === 404) {
        return;
      }
      throw new Error(`Failed to fetch folder contents: ${getFilesRes.status} ${getFilesRes.statusText}`);
    }
    const getData = await getFilesRes.json();
    if (Array.isArray(getData)) {
      for (const item of getData) {
        if (item.type === 'file') {
          const deleteBody = {
            message: commitMessage,
            sha: item.sha,
          };
          const deleteRes = await this.makeGitHubApiRequest(token, item.url, 'DELETE', deleteBody);
          if (!deleteRes.ok) {
            throw new Error(`Failed to delete file: ${deleteRes.status} ${deleteRes.statusText}`);
          }
        } else if (item.type === 'dir') {
          await this.deleteGitHubFolder(item.url, token, commitMessage);
        }
      }
    }
  }

  /**
   * Helper method to make requests to the GitHub API.
   * @param token - GitHub token.
   * @param url - Request URL.
   * @param method - HTTP method (default: GET).
   * @param body - Request body.
   * @returns The fetch response.
   */
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

  /**
   * Invokes the Canvas API via a Supabase Edge Function.
   * @param endpoint - The Canvas API endpoint.
   * @param method - HTTP method.
   * @param body - Request body.
   * @returns The response data.
   */
  async makeCanvasApiRequest(endpoint: string, method: string = 'GET', body?: object) {
    const { data, error } = await this.supabase.functions.invoke('canvas', {
      body: { endpoint, method, body },
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Invokes the Gemini AI API via a Supabase Edge Function.
   * @param body - The prompt and other parameters.
   * @returns The text content of the AI response.
   */
  async makeGeminiApiRequest(body: object) {
    const { data, error } = await this.supabase.functions.invoke('gemini', {
      body: { method: 'POST', body },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.error) {
      throw new Error((data.error.message || 'Error from AI service').split('.')[0]);
    }

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      throw new Error('Invalid response format from AI');
    }

    return data.candidates[0].content.parts[0].text;
  }

  async _getGitHubFileSha(gitHubUrl: string, token: string): Promise<string | undefined> {
    const getRes = await this.makeGitHubApiRequest(token, gitHubUrl);
    const getData = await getRes.json();
    if (getRes.ok) {
      return getData.sha;
    }
  }

  async _loadUser({ id }: { id: string }) {
    const { data, error } = await this.supabase.from('user').select('id, name, email, settings').eq('id', id).single();

    if (error) {
      throw new Error(error.message);
    }

    const user = new User({ ...data, roles: await this._loadUserRoles({ id: data.id }) });

    return user;
  }

  async _loadUserRoles({ id }: { id: string }) {
    const { data, error } = await this.supabase.from('role').select('user, right, object, settings').eq('user', id);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
}

const service = await Service.create();
export default service;
