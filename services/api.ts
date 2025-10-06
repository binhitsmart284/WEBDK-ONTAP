// Fix: Import necessary types to resolve 'Cannot find name' errors.
import { Role, Student, Subject, User, CustomField } from '../types';
import { firebaseService, initializeFirebase } from './firebaseService';

// Hardcoded Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyC7ZAoXmXEZm6jWrtaD5Ved_g_kngRkhjU",
  authDomain: "hethonghbt.firebaseapp.com",
  projectId: "hethonghbt",
  storageBucket: "hethonghbt.appspot.com",
  messagingSenderId: "470166020801",
  appId: "1:470166020801:web:30b5f5ce7d36a2adcaea40",
  measurementId: "G-PYM3DTJ1KS"
};

const DB_KEY = 'registration_system_db';

// --- DATABASE INITIALIZATION ---
// This structure holds the initial state of the database if nothing is found in localStorage.
const initialDB = {
  isRegistrationLocked: false,
  registrationDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // Default: 10 days from now
  registrationSettings: {
    showReviewSubjects: true,
    showExamSubjects: true,
    showCustomFields: true,
  },
  users: [
    { id: 1, ma_hocsinh: 'admin', hoten: 'Admin', ngaysinh: '1990-01-01', lop: 'N/A', role: Role.Admin, mustChangePassword: false, reviewSubjects: [], examSubjects: [] },
    { id: 2, ma_hocsinh: 'HS2025001', hoten: 'Nguyen Van A', ngaysinh: '2006-05-12', lop: '12A1', role: Role.Student, mustChangePassword: true, reviewSubjects: [4, 5], examSubjects: [7, 8], registrationDate: '2024-05-20T10:00:00Z', customData: { phone: '0987654321', address: '123 Đường ABC, Huế' } },
    { id: 3, ma_hocsinh: 'HS2025002', hoten: 'Tran Thi B', ngaysinh: '2006-11-02', lop: '12A3', role: Role.Student, mustChangePassword: false, reviewSubjects: [1,3], examSubjects: [6,8], registrationDate: '2024-05-21T14:30:00Z' },
    { id: 4, ma_hocsinh: 'HS2025003', hoten: 'Le Van C', ngaysinh: '2006-01-20', lop: '12A1', role: Role.Student, mustChangePassword: false, reviewSubjects: [2,4], examSubjects: [5,9], registrationDate: '2024-05-21T15:00:00Z' },
    { id: 5, ma_hocsinh: 'HS2025004', hoten: 'Pham Thi D', ngaysinh: '2006-03-15', lop: '12A2', role: Role.Student, mustChangePassword: true, reviewSubjects: [], examSubjects: [] },
    { id: 6, ma_hocsinh: 'HS2025005', hoten: 'Hoang Van E', ngaysinh: '2006-07-30', lop: '12A2', role: Role.Student, mustChangePassword: false, reviewSubjects: [1,5], examSubjects: [7,9], registrationDate: '2024-05-22T09:00:00Z' },
    { id: 7, ma_hocsinh: 'HS2025006', hoten: 'Do Thi F', ngaysinh: '2006-09-05', lop: '12A3', role: Role.Student, mustChangePassword: false, reviewSubjects: [4,6], examSubjects: [8,9], registrationDate: new Date().toISOString() },
    { id: 8, ma_hocsinh: 'HS2025007', hoten: 'Vu Van G', ngaysinh: '2006-02-18', lop: '12A1', role: Role.Student, mustChangePassword: false, reviewSubjects: [2,3], examSubjects: [4,7], registrationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 9, ma_hocsinh: 'HS2025008', hoten: 'Bui Thi H', ngaysinh: '2006-04-22', lop: '12A4', role: Role.Student, mustChangePassword: true, reviewSubjects: [], examSubjects: [] },
     { id: 10, ma_hocsinh: 'HS2025009', hoten: 'Dang Van I', ngaysinh: '2006-08-11', lop: '12A4', role: Role.Student, mustChangePassword: false, reviewSubjects: [1,6], examSubjects: [5,8], registrationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
  ] as Student[],
  userPasswords: new Map<number, string>([
    [1, '_hashed_adminpassword'],
    [2, '_hashed_HS2025001'],
    [3, '_hashed_newpassword123'],
    [4, '_hashed_12345678'],
    [5, '_hashed_HS2025004'],
    [6, '_hashed_anotherpass'],
    [7, '_hashed_dothifpass'],
    [8, '_hashed_vuvangpass'],
    [9, '_hashed_HS2025008'],
    [10, '_hashed_dangvanipass'],
  ]),
  reviewSubjects: [
    { id: 1, name: 'Toán' }, { id: 2, name: 'Ngữ văn' }, { id: 3, name: 'Tiếng Anh' }, { id: 4, name: 'Vật lý' },
    { id: 5, name: 'Hóa học' }, { id: 6, name: 'Sinh học' }, { id: 7, name: 'Lịch sử' }, { id: 8, name: 'Địa lý' },
    { id: 9, name: 'GDCD' },
  ] as Subject[],
  examSubjects: [
    { id: 4, name: 'Vật lý' }, { id: 5, name: 'Hóa học' }, { id: 6, name: 'Sinh học' },
    { id: 7, 'name': 'Lịch sử' }, { id: 8, name: 'Địa lý' }, { id: 9, name: 'GDCD' },
  ] as Subject[],
  customFormFields: [
    { id: 'phone', label: 'SĐT Phụ huynh', type: 'text', required: true },
    { id: 'address', label: 'Địa chỉ nhà', type: 'text', required: false },
  ] as CustomField[],
  nextUserId: 11,
};

// --- DUAL-MODE API SETUP ---
let isFirebaseEnabled = false;

try {
  const success = initializeFirebase(firebaseConfig);
  if (success) {
    isFirebaseEnabled = true;
    console.log("%cFirebase Mode: ENABLED", "color: green; font-weight: bold;");
  } else {
    console.error("Firebase SDK not found on window. Firebase mode disabled. Falling back to localStorage.");
    isFirebaseEnabled = false;
  }
} catch (e) {
  console.error("Could not initialize Firebase from config", e);
  isFirebaseEnabled = false;
}

if (!isFirebaseEnabled) {
  console.log("%cFirebase Mode: DISABLED (fallback to localStorage)", "color: orange; font-weight: bold;");
}

// --- LOCAL DB (MOCK) HELPER FUNCTIONS ---
let mockDB: typeof initialDB;

const _saveDB = () => {
  // JSON cannot serialize Maps directly, so we convert it to an array of [key, value] pairs.
  const dbToSave = {
    ...mockDB,
    userPasswords: Array.from(mockDB.userPasswords.entries()),
  };
  localStorage.setItem(DB_KEY, JSON.stringify(dbToSave));
};

const _loadDB = () => {
  const savedDB = localStorage.getItem(DB_KEY);
  if (savedDB) {
    const parsedDB = JSON.parse(savedDB);
    // Restore the Map from the array.
    mockDB = {
      ...parsedDB,
      userPasswords: new Map(parsedDB.userPasswords),
    };
  } else {
    // If no saved DB, use the initial one and save it.
    mockDB = JSON.parse(JSON.stringify(initialDB)); // Deep copy to avoid mutation issues
    mockDB.userPasswords = new Map(initialDB.userPasswords);
    _saveDB();
  }
};

// Load the local database when the module is first imported.
_loadDB();

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- UNIFIED API OBJECT ---
export const api = {
  migrateToFirebase: async (progressCallback: (message: string) => void) => {
    if (!isFirebaseEnabled) throw new Error("Firebase chưa được cấu hình.");
    await firebaseService.migrateData(mockDB, progressCallback);
  },

  login: async (ma_hocsinh: string, password: string): Promise<User> => {
    if (isFirebaseEnabled) {
        return firebaseService.login(ma_hocsinh, password);
    }
    // Fallback to local
    await delay(500);
    const user = mockDB.users.find(u => u.ma_hocsinh === ma_hocsinh);
    const expectedPasswordHash = user ? mockDB.userPasswords.get(user.id) : undefined;
    
    if (user && expectedPasswordHash === `_hashed_${password}`) {
      return { ...user };
    }
    throw new Error('Mã học sinh hoặc mật khẩu không đúng.');
  },

  changePassword: async (userId: number, newPassword: string): Promise<void> => {
    if (isFirebaseEnabled) {
        return firebaseService.changePassword(userId, newPassword);
    }
     // Fallback to local
    await delay(500);
    const userIndex = mockDB.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      mockDB.users[userIndex].mustChangePassword = false;
      mockDB.userPasswords.set(userId, `_hashed_${newPassword}`);
      _saveDB();
      return;
    }
    throw new Error('Không tìm thấy người dùng.');
  },

  changeOwnPassword: async (userId: number, oldPassword: string, newPassword: string): Promise<void> => {
    if (isFirebaseEnabled) {
        return firebaseService.changeOwnPassword(userId, oldPassword, newPassword);
    }
     // Fallback to local
    await delay(500);
    const userIndex = mockDB.users.findIndex(u => u.id === userId);
    const currentPasswordHash = mockDB.userPasswords.get(userId);

    if (userIndex !== -1 && currentPasswordHash === `_hashed_${oldPassword}`) {
      mockDB.users[userIndex].mustChangePassword = false;
      mockDB.userPasswords.set(userId, `_hashed_${newPassword}`);
      _saveDB();
      return;
    }
    throw new Error('Mật khẩu hiện tại không đúng.');
  },

  verifyStudentForPasswordReset: async (ma_hocsinh: string, ngaysinh: string): Promise<number> => {
     if (isFirebaseEnabled) {
        return firebaseService.verifyStudentForPasswordReset(ma_hocsinh, ngaysinh);
    }
    // Fallback to local
    await delay(500);
    const student = mockDB.users.find(u =>
      u.role === Role.Student &&
      u.ma_hocsinh === ma_hocsinh &&
      u.ngaysinh === ngaysinh
    );
    if (student) {
      return student.id;
    }
    throw new Error('Thông tin không chính xác. Vui lòng kiểm tra lại Mã học sinh và Ngày sinh.');
  },

  resetPasswordAfterVerification: async (userId: number, newPassword: string): Promise<void> => {
     if (isFirebaseEnabled) {
        return firebaseService.resetPasswordAfterVerification(userId, newPassword);
    }
    // Fallback to local
    await delay(500);
    const userIndex = mockDB.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      mockDB.users[userIndex].mustChangePassword = false;
      mockDB.userPasswords.set(userId, `_hashed_${newPassword}`);
      _saveDB();
      return;
    }
    throw new Error('Đã xảy ra lỗi không mong muốn.');
  },
  
  getStudentById: async (userId: number): Promise<Student> => {
     if (isFirebaseEnabled) {
        return firebaseService.getStudentById(userId);
    }
    // Fallback to local
    await delay(300);
    const student = mockDB.users.find(u => u.id === userId && u.role === Role.Student);
    if (student) {
        return { ...student };
    }
    throw new Error('Không tìm thấy học sinh.');
  },

  updateStudentRegistration: async (userId: number, data: { reviewSubjects: number[], examSubjects: number[], customData: { [key: string]: any } }): Promise<void> => {
    if (isFirebaseEnabled) {
        return firebaseService.updateStudentRegistration(userId, data);
    }
    // Fallback to local
    await delay(600);
    const isPastDeadline = new Date() > new Date(mockDB.registrationDeadline);
    if (mockDB.isRegistrationLocked || isPastDeadline) {
        throw new Error('Hệ thống đã khoá đăng ký. Không thể lưu thay đổi.');
    }
    const userIndex = mockDB.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      mockDB.users[userIndex].reviewSubjects = data.reviewSubjects;
      mockDB.users[userIndex].examSubjects = data.examSubjects;
      mockDB.users[userIndex].customData = data.customData;
      mockDB.users[userIndex].registrationDate = new Date().toISOString();
      _saveDB();
      return;
    }
    throw new Error('Không tìm thấy người dùng.');
  },

  // --- Admin specific functions ---
  getStudents: async (): Promise<Student[]> => {
    if (isFirebaseEnabled) {
        return firebaseService.getStudents();
    }
    // Fallback to local
    await delay(300);
    return JSON.parse(JSON.stringify(mockDB.users.filter(u => u.role === Role.Student) as Student[]));
  },

  addStudent: async (studentData: Omit<Student, 'id' | 'role'>): Promise<Student> => {
    if (isFirebaseEnabled) {
        return firebaseService.addStudent(studentData);
    }
    // Fallback to local
    await delay(400);
    const newStudent: Student = {
        ...studentData,
        id: mockDB.nextUserId++,
        role: Role.Student,
        mustChangePassword: true,
        reviewSubjects: [],
        examSubjects: [],
        registrationDate: undefined,
    };
    mockDB.users.push(newStudent);
    mockDB.userPasswords.set(newStudent.id, `_hashed_${studentData.cccd || studentData.ma_hocsinh}`);
    _saveDB();
    return newStudent;
  },

  addStudentsBatch: async (studentsData: any[]): Promise<void> => {
     if (isFirebaseEnabled) {
        return firebaseService.addStudentsBatch(studentsData);
    }
    // Fallback to local
    await delay(1000);
    studentsData.forEach(s => {
        const newStudent: Student = {
            id: mockDB.nextUserId++,
            ma_hocsinh: s.ma_hocsinh,
            hoten: s.hoten,
            ngaysinh: s.ngaysinh,
            lop: s.lop,
            role: Role.Student,
            mustChangePassword: true,
            reviewSubjects: [],
            examSubjects: [],
            registrationDate: undefined,
        };
        mockDB.users.push(newStudent);
        mockDB.userPasswords.set(newStudent.id, `_hashed_${s.cccd || s.ma_hocsinh}`);
    });
    _saveDB();
  },

  updateStudent: async (studentId: number, updates: Partial<Student>): Promise<Student> => {
    if (isFirebaseEnabled) {
        return firebaseService.updateStudent(studentId, updates);
    }
    // Fallback to local
      await delay(400);
      const studentIndex = mockDB.users.findIndex(s => s.id === studentId);
      if (studentIndex === -1) throw new Error("Student not found");
      
      mockDB.users[studentIndex] = { ...mockDB.users[studentIndex], ...updates };
      _saveDB();
      return mockDB.users[studentIndex];
  },

  deleteStudentsBatch: async (studentIds: number[]): Promise<void> => {
    if (isFirebaseEnabled) {
        return firebaseService.deleteStudentsBatch(studentIds);
    }
    // Fallback to local
    await delay(500);
    const idsToDelete = new Set(studentIds);
    mockDB.users = mockDB.users.filter(user => !idsToDelete.has(user.id));
    studentIds.forEach(id => {
      mockDB.userPasswords.delete(id);
    });
    _saveDB();
  },

  deleteAllStudents: async (): Promise<void> => {
    if (isFirebaseEnabled) {
        return firebaseService.deleteAllStudents();
    }
    // Fallback to local
    await delay(500);
    const adminUsers = mockDB.users.filter(u => u.role === Role.Admin);
    const newPasswordMap = new Map<number, string>();
    adminUsers.forEach(admin => {
        const pass = mockDB.userPasswords.get(admin.id);
        if(pass) newPasswordMap.set(admin.id, pass);
    });
    
    mockDB.users = adminUsers;
    mockDB.userPasswords = newPasswordMap;
    _saveDB();
  },

  getStudentPassword: async (studentId: number): Promise<string> => {
    if (isFirebaseEnabled) {
        return firebaseService.getStudentPassword(studentId);
    }
    // Fallback to local
    await delay(200);
    const passwordHash = mockDB.userPasswords.get(studentId);
    if (!passwordHash) throw new Error("Password not found for student.");
    if (passwordHash.startsWith('_hashed_')) {
      return passwordHash.substring(8);
    }
    return "Could not retrieve password.";
  },

  resetStudentPassword: async (studentId: number, newPassword?: string): Promise<void> => {
    if (isFirebaseEnabled) {
        return firebaseService.resetStudentPassword(studentId, newPassword);
    }
    // Fallback to local
      await delay(300);
      const studentIndex = mockDB.users.findIndex(s => s.id === studentId);
      if (studentIndex === -1) throw new Error("Student not found");

      const student = mockDB.users[studentIndex];
      student.mustChangePassword = !newPassword; 
      
      const passwordToSet = newPassword || student.ma_hocsinh;
      mockDB.userPasswords.set(student.id, `_hashed_${passwordToSet}`);
      _saveDB();
  },

  getRegistrationStatus: async (): Promise<boolean> => {
    if (isFirebaseEnabled) {
        return firebaseService.getRegistrationStatus();
    }
    // Fallback to local
    await delay(100);
    const isPastDeadline = new Date() > new Date(mockDB.registrationDeadline);
    return mockDB.isRegistrationLocked || isPastDeadline;
  },

  setRegistrationStatus: async (locked: boolean): Promise<boolean> => {
    if (isFirebaseEnabled) {
        return firebaseService.setRegistrationStatus(locked);
    }
    // Fallback to local
    await delay(400);
    mockDB.isRegistrationLocked = locked;
    _saveDB();
    return mockDB.isRegistrationLocked;
  },
  
  getRegistrationDeadline: async (): Promise<string> => {
    if (isFirebaseEnabled) {
        return firebaseService.getRegistrationDeadline();
    }
    // Fallback to local
    await delay(50);
    return mockDB.registrationDeadline;
  },
  
  setRegistrationDeadline: async (deadline: string): Promise<string> => {
    if (isFirebaseEnabled) {
        return firebaseService.setRegistrationDeadline(deadline);
    }
    // Fallback to local
    await delay(400);
    mockDB.registrationDeadline = deadline;
    _saveDB();
    return mockDB.registrationDeadline;
  },

  getRegistrationSettings: async (): Promise<{ showReviewSubjects: boolean, showExamSubjects: boolean, showCustomFields: boolean }> => {
    if (isFirebaseEnabled) {
        return firebaseService.getRegistrationSettings();
    }
    // Fallback to local
    await delay(50);
    return JSON.parse(JSON.stringify(mockDB.registrationSettings));
  },
  
  updateRegistrationSettings: async (settings: { showReviewSubjects: boolean, showExamSubjects: boolean, showCustomFields: boolean }): Promise<void> => {
    if (isFirebaseEnabled) {
        return firebaseService.updateRegistrationSettings(settings);
    }
    // Fallback to local
    await delay(400);
    mockDB.registrationSettings = settings;
    _saveDB();
  },

  getSubjects: async(): Promise<{ review: Subject[], exam: Subject[] }> => {
    if (isFirebaseEnabled) {
        return firebaseService.getSubjects();
    }
    // Fallback to local
    await delay(150);
    return JSON.parse(JSON.stringify({
        review: mockDB.reviewSubjects,
        exam: mockDB.examSubjects
    }));
  },

  updateSubjects: async(subjects: { review: Subject[], exam: Subject[] }): Promise<void> => {
    if (isFirebaseEnabled) {
        return firebaseService.updateSubjects(subjects);
    }
    // Fallback to local
    await delay(500);
    mockDB.reviewSubjects = subjects.review;
    mockDB.examSubjects = subjects.exam;
    _saveDB();
  },

  getCustomFormFields: async (): Promise<CustomField[]> => {
    if (isFirebaseEnabled) {
        return firebaseService.getCustomFormFields();
    }
    // Fallback to local
    await delay(100);
    return JSON.parse(JSON.stringify(mockDB.customFormFields));
  },
  
  updateCustomFormFields: async (fields: CustomField[]): Promise<void> => {
     if (isFirebaseEnabled) {
        return firebaseService.updateCustomFormFields(fields);
    }
    // Fallback to local
    await delay(400);
    mockDB.customFormFields = fields;
    _saveDB();
  },
};