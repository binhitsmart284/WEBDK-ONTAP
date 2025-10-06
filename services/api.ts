import { Role, Student, Subject, User, CustomField } from '../types';

// This file is the client-side API layer. It makes fetch requests
// to a Netlify Function backend which connects to a PostgreSQL database.

// Helper to call the Netlify Function
const callApi = async (action: string, payload?: any) => {
  try {
    const response = await fetch('/.netlify/functions/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, payload }),
    });

    const result = await response.json();

    if (!response.ok) {
      // The backend returns errors in a { error: "message" } structure
      throw new Error(result.error || 'Đã xảy ra lỗi khi giao tiếp với máy chủ.');
    }

    // The backend returns successful data in a { data: ... } structure
    return result.data;
  } catch (error) {
    console.error(`API call failed for action "${action}":`, error);
    // Re-throw the error so UI components can handle it
    throw error;
  }
};


export const api = {
  login: (ma_hocsinh: string, password: string): Promise<User> => 
    callApi('login', { ma_hocsinh, password }),

  changePassword: (userId: number, newPassword: string): Promise<void> =>
    callApi('changePassword', { userId, newPassword }),
  
  changeOwnPassword: (userId: number, oldPassword: string, newPassword: string): Promise<void> =>
    callApi('changeOwnPassword', { userId, oldPassword, newPassword }),
  
  verifyStudentForPasswordReset: (ma_hocsinh: string, ngaysinh: string): Promise<number> =>
    callApi('verifyStudentForPasswordReset', { ma_hocsinh, ngaysinh }),

  resetPasswordAfterVerification: (userId: number, newPassword: string): Promise<void> =>
    callApi('resetPasswordAfterVerification', { userId, newPassword }),

  getStudentById: (userId: number): Promise<Student> =>
    callApi('getStudentById', { userId }),

  updateStudentRegistration: async (userId: number, data: { reviewSubjects: number[], examSubjects: number[], customData: { [key: string]: any } }): Promise<void> => {
      return callApi('updateStudentRegistration', { userId, data });
  },

  // Admin functions
  getStudents: (): Promise<Student[]> =>
    callApi('getStudents'),

  addStudent: (studentData: Omit<Student, 'id' | 'role'> & { cccd?: string }): Promise<Student> =>
    callApi('addStudent', { studentData }),

  addStudentsBatch: (studentsData: any[]): Promise<void> =>
    callApi('addStudentsBatch', { studentsData }),

  updateStudent: (studentId: number, updates: Partial<Student>): Promise<Student> =>
    callApi('updateStudent', { studentId, updates }),

  deleteStudentsBatch: (studentIds: number[]): Promise<void> =>
    callApi('deleteStudentsBatch', { studentIds }),

  deleteAllStudents: (): Promise<void> =>
    callApi('deleteAllStudents'),
  
  getStudentPassword: (studentId: number): Promise<string> =>
    callApi('getStudentPassword', { studentId }),

  resetStudentPassword: (studentId: number, newPassword?: string): Promise<void> =>
    callApi('resetStudentPassword', { studentId, newPassword }),

  getRegistrationStatus: (): Promise<boolean> =>
    callApi('getRegistrationStatus'),

  setRegistrationStatus: (locked: boolean): Promise<boolean> =>
    callApi('setRegistrationStatus', { locked }),
  
  getRegistrationDeadline: (): Promise<string> =>
    callApi('getRegistrationDeadline'),
  
  setRegistrationDeadline: (deadline: string): Promise<string> =>
    callApi('setRegistrationDeadline', { deadline }),

  getRegistrationSettings: (): Promise<{ showReviewSubjects: boolean, showExamSubjects: boolean, showCustomFields: boolean }> =>
    callApi('getRegistrationSettings'),
  
  updateRegistrationSettings: (settings: { showReviewSubjects: boolean, showExamSubjects: boolean, showCustomFields: boolean }): Promise<void> =>
    callApi('updateRegistrationSettings', { settings }),

  getSubjects: (): Promise<{ review: Subject[], exam: Subject[] }> =>
    callApi('getSubjects'),

  updateSubjects: (subjects: { review: Subject[], exam: Subject[] }): Promise<void> =>
    callApi('updateSubjects', { subjects }),

  getCustomFormFields: (): Promise<CustomField[]> =>
    callApi('getCustomFormFields'),
  
  updateCustomFormFields: (fields: CustomField[]): Promise<void> =>
    callApi('updateCustomFormFields', { fields }),
};