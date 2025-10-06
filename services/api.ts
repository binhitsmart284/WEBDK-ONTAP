import { Role, Student, Subject, User, CustomField } from '../types';

// This will act as a client for our Netlify Function backend.

let isSeeding = false;
let isSeeded = false;

async function callApi(action: string, payload?: any) {
  // One-time seeding mechanism.
  // The first time any API call is made, it will ensure the DB is seeded.
  if (!isSeeded && !isSeeding) {
    isSeeding = true;
    try {
      // The 'seed' action on the backend is idempotent. It will only run if the DB is empty.
      await fetch('/.netlify/functions/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      isSeeded = true;
    } catch (e) {
      console.error("Database seeding failed!", e);
      // Allow the app to continue, the next API call will retry.
    } finally {
      isSeeding = false;
    }
  } else if (isSeeding) {
    // If a seed is in progress, wait for it to finish.
    await new Promise(resolve => setTimeout(resolve, 500));
  }


  const response = await fetch('/.netlify/functions/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Đã có lỗi xảy ra từ máy chủ.');
  }

  return result.data;
}

export const api = {
  login: (ma_hocsinh: string, password: string): Promise<User> => {
    return callApi('login', { ma_hocsinh, password });
  },

  changePassword: (userId: number, newPassword: string): Promise<void> => {
    return callApi('changePassword', { userId, newPassword });
  },

  changeOwnPassword: (userId: number, oldPassword: string, newPassword: string): Promise<void> => {
    return callApi('changeOwnPassword', { userId, oldPassword, newPassword });
  },
  
  verifyStudentForPasswordReset: (ma_hocsinh: string, ngaysinh: string): Promise<number> => {
    return callApi('verifyStudentForPasswordReset', { ma_hocsinh, ngaysinh });
  },

  resetPasswordAfterVerification: (userId: number, newPassword: string): Promise<void> => {
    return callApi('resetPasswordAfterVerification', { userId, newPassword });
  },

  getStudentById: (userId: number): Promise<Student> => {
    return callApi('getStudentById', { userId });
  },

  updateStudentRegistration: (userId: number, data: { reviewSubjects: number[], examSubjects: number[], customData: { [key: string]: any } }): Promise<void> => {
    return callApi('updateStudentRegistration', { userId, data });
  },

  // Admin functions
  getStudents: (): Promise<Student[]> => {
    return callApi('getStudents');
  },

  addStudent: (studentData: Omit<Student, 'id' | 'role'>): Promise<Student> => {
    return callApi('addStudent', { studentData });
  },

  addStudentsBatch: (studentsData: any[]): Promise<void> => {
    return callApi('addStudentsBatch', { studentsData });
  },

  updateStudent: (studentId: number, updates: Partial<Student>): Promise<Student> => {
    return callApi('updateStudent', { studentId, updates });
  },

  deleteStudentsBatch: (studentIds: number[]): Promise<void> => {
    return callApi('deleteStudentsBatch', { studentIds });
  },

  deleteAllStudents: (): Promise<void> => {
    return callApi('deleteAllStudents');
  },
  
  getStudentPassword: (studentId: number): Promise<string> => {
    return callApi('getStudentPassword', { studentId });
  },

  resetStudentPassword: (studentId: number, newPassword?: string): Promise<void> => {
    return callApi('resetStudentPassword', { studentId, newPassword });
  },

  getRegistrationStatus: (): Promise<boolean> => {
    return callApi('getRegistrationStatus');
  },

  setRegistrationStatus: (locked: boolean): Promise<boolean> => {
    return callApi('setRegistrationStatus', { locked });
  },
  
  getRegistrationDeadline: (): Promise<string> => {
    return callApi('getRegistrationDeadline');
  },
  
  setRegistrationDeadline: (deadline: string): Promise<string> => {
    return callApi('setRegistrationDeadline', { deadline });
  },

  getRegistrationSettings: (): Promise<{ showReviewSubjects: boolean, showExamSubjects: boolean, showCustomFields: boolean }> => {
    return callApi('getRegistrationSettings');
  },
  
  updateRegistrationSettings: (settings: { showReviewSubjects: boolean, showExamSubjects: boolean, showCustomFields: boolean }): Promise<void> => {
    return callApi('updateRegistrationSettings', { settings });
  },

  getSubjects: (): Promise<{ review: Subject[], exam: Subject[] }> => {
    return callApi('getSubjects');
  },

  updateSubjects: (subjects: { review: Subject[], exam: Subject[] }): Promise<void> => {
    return callApi('updateSubjects', { subjects });
  },

  getCustomFormFields: (): Promise<CustomField[]> => {
    return callApi('getCustomFormFields');
  },
  
  updateCustomFormFields: (fields: CustomField[]): Promise<void> => {
    return callApi('updateCustomFormFields', { fields });
  },
};