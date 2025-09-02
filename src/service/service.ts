import { createClient } from '@supabase/supabase-js';
import config from '../../config';
import { User, CourseInfo, Enrollment } from '../model';

const supabase = createClient(config.supabase.url, config.supabase.key);

class Service {
  courseInfo(courseId: string) {
    return config.courses.find((c) => c.id === courseId);
  }

  async currentUser(): Promise<User | null> {
    const session = await supabase.auth.getSession();
    if (session.data.session?.user) {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : this._loadUser({ id: session.data.session.user.id });
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

    localStorage.setItem('user', JSON.stringify(user));

    return user;
  }

  async login(email: string, password: string): Promise<User | null> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message || 'Unable to login');
    }
    return this._loadUser({ id: data.user.id });
  }

  async logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('enrollments');
    await supabase.auth.signOut();
  }

  allEnrolled(enrollments: Map<string, Enrollment>) {
    return config.courses.filter((course) => !enrollments.has(course.id)).length === 0;
  }

  currentEnrollment(): Enrollment | null {
    const currentCourse = localStorage.getItem('currentCourse');
    if (currentCourse) {
      const enrollments = this.enrollments();
      if (enrollments) {
        return enrollments.get(currentCourse) || null;
      }
    }
    return null;
  }

  courses(): CourseInfo[] {
    return config.courses;
  }

  enrollments(): Map<string, Enrollment> {
    const enrollments = new Map<string, Enrollment>();
    const enrollmentsJson = localStorage.getItem('enrollments');
    if (enrollmentsJson) {
      const enrollmentsArray = JSON.parse(enrollmentsJson);
      enrollmentsArray.forEach((enrollment) => {
        enrollment.courseInfo = config.courses.find((c) => c.id === enrollment.courseId);
        enrollments.set(enrollment.courseId, enrollment);
      });
    }
    return enrollments;
  }

  setCurrentCourse(courseId: string): void {
    localStorage.setItem('currentCourse', courseId);
  }

  removeCurrentCourse(): void {
    localStorage.removeItem('currentCourse');
  }

  createEnrollment(courseInfo: CourseInfo): [Enrollment, Map<string, Enrollment>] {
    const enrollments = this.enrollments();

    const enrollment: Enrollment = {
      id: generateId(),
      courseId: courseInfo.id,
      courseInfo,
      ui: {
        currentTopic: null,
        tocIndexes: [0],
        sidebarVisible: true,
      },
      progress: { mastery: 0 },
    };

    enrollments.set(enrollment.courseId, enrollment);
    this._writeEnrollments(enrollments);

    return [enrollment, enrollments];
  }

  saveEnrollment(enrollment: Enrollment): Enrollment {
    const enrollments = this.enrollments();
    enrollments.set(enrollment.courseId, enrollment);
    this._writeEnrollments(enrollments);
    return enrollment;
  }

  removeEnrollment(enrollment: Enrollment): Map<string, Enrollment> {
    const enrollments = this.enrollments();
    enrollments.delete(enrollment.courseId);
    this._writeEnrollments(enrollments);
    return enrollments;
  }

  async _loadUser({ id }: { id: string }) {
    const { data, error } = await supabase.from('learner').select('id, name, email, preferences').eq('id', id).single();

    if (error) {
      throw new Error(error.message);
    }

    const user: User = { ...data };
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  }

  _writeEnrollments(enrollments: Map<string, Enrollment>): void {
    let enrollmentArray = Array.from(enrollments.values()).map(({ courseInfo, ...rest }) => rest);
    localStorage.setItem('enrollments', JSON.stringify(enrollmentArray));
  }
}

function generateId() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)).replace(/-/g, '');
}

export default new Service();
