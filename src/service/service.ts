import config from '../../config.js';

type User = {
  id: string;
  name: string;
  email: string;
  password?: string;
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

class Service {
  courseInfo(courseId: string) {
    return config.courses.find((c) => c.id === courseId);
  }

  allEnrolled(enrollments: Map<string, Enrollment>) {
    return config.courses.filter((course) => !enrollments.has(course.id)).length === 0;
  }

  currentUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
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

  _writeEnrollments(enrollments: Map<string, Enrollment>): void {
    let enrollmentArray = Array.from(enrollments.values()).map(({ courseInfo, ...rest }) => rest);
    localStorage.setItem('enrollments', JSON.stringify(enrollmentArray));
  }
}

function generateId() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)).replace(/-/g, '');
}

export default new Service();
