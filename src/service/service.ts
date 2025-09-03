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
    const { data, error } = await supabase.from('catalog').select('id, name, title, description, links, gitHub');

    if (error) {
      throw new Error(error.message);
    }

    return new Service(data);
  }

  courseCatalog(): CatalogEntry[] {
    return this.catalog;
  }

  catalogEntry(courseId: string) {
    return this.catalog.find((c) => c.id === courseId);
  }

  async createCourse(catalogEntry: CatalogEntry, gitHubToken: string): Promise<void> {
    // const { error } = await supabase.from('catalog').insert([catalogEntry]);
    // if (error) {
    //   throw new Error(error.message);
    // }
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
    return this.catalog.filter((course) => !enrollments.has(course.id)).length === 0;
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
    const { data, error } = await supabase.from('enrollment').select('id, courseId, learnerId, ui, progress').eq('learnerId', id);

    if (error) {
      throw new Error(error.message);
    }

    const enrollments = new Map<string, Enrollment>();
    data.forEach((item) => {
      enrollments.set(item.courseId, { ...item, catalogEntry: this.catalogEntry(item.courseId) });
    });

    return enrollments;
  }

  setCurrentCourse(courseId: string): void {
    localStorage.setItem('currentCourse', courseId);
  }

  removeCurrentCourse(): void {
    localStorage.removeItem('currentCourse');
  }

  async createEnrollment(learnerId: string, catalogEntry: CatalogEntry): Promise<void> {
    const { error } = await supabase.from('enrollment').insert([
      {
        courseId: catalogEntry.id,
        ui: {
          currentTopic: null,
          tocIndexes: [0],
          sidebarVisible: true,
        },
        progress: { mastery: 0 },
      },
    ]);
    if (error) {
      throw new Error(error.message);
    }
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
