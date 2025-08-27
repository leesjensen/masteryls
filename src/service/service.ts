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
};

type Enrollment = {
  id: string;
  courseInfo: CourseInfo;
  tocIndexes: number[];
  visibleSidebar: boolean;
  currentTopic: string | null;
};

class Service {
  courseInfo(courseId: string) {
    return config.courses.find((c) => c.id === courseId);
  }

  isEnrolled(courseId: string) {
    const enrollments = this.enrollments();
    return enrollments.has(courseId);
  }

  allEnrolled() {
    return config.courses.filter((course) => !this.isEnrolled(course.id)).length === 0;
  }

  currentUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  currentEnrollment(): Enrollment | null {
    const currentCourse = localStorage.getItem('currentCourse');
    if (currentCourse) {
      const enrollments = localStorage.getItem('enrollments');
      if (enrollments) {
        const enrollment = JSON.parse(enrollments)[currentCourse];
        enrollment.courseInfo = config.courses.find((c) => c.id === currentCourse);
        return enrollment;
      }
    }
    return null;
  }

  enrollments(): Map<string, Enrollment> {
    const enrollments = localStorage.getItem('enrollments');
    if (enrollments) {
      const enrollmentData = JSON.parse(enrollments);
      Object.keys(enrollmentData).forEach((courseId) => {
        enrollmentData[courseId].courseInfo = config.courses.find((c) => c.id === courseId);
      });
      return new Map<string, Enrollment>(Object.entries(enrollmentData));
    }
    return new Map<string, Enrollment>();
  }

  saveCurrentCourse(courseId: string): void {
    localStorage.setItem('currentCourse', courseId);
  }

  saveEnrollment(enrollment: Enrollment): void {
    const enrollments = localStorage.getItem('enrollments');
    const enrollmentData = enrollments ? JSON.parse(enrollments) : {};
    enrollmentData[enrollment.courseInfo.id] = enrollment;
    localStorage.setItem('enrollments', JSON.stringify(enrollmentData));
  }
}

export default new Service();
