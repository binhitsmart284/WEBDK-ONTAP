// Fix: Import necessary types to resolve 'Cannot find name' errors.
import { Role, Student, Subject, User, CustomField } from '../types';

// --- MOCK DATABASE ---
const mockDB = {
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
    [2, '_hashed_HS2025001'], // Default password is student code
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
    { id: 7, name: 'Lịch sử' }, { id: 8, name: 'Địa lý' }, { id: 9, name: 'GDCD' },
  ] as Subject[],
  customFormFields: [
    { id: 'phone', label: 'SĐT Phụ huynh', type: 'text', required: true },
    { id: 'address', label: 'Địa chỉ nhà', type: 'text', required: false },
  ] as CustomField[],
  nextUserId: 11,
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- API MOCK OBJECT ---
export const api = {
  login: async (ma_hocsinh: string, password: string): Promise<User> => {
    await delay(500);
    const user = mockDB.users.find(u => u.ma_hocsinh === ma_hocsinh);
    const expectedPasswordHash = user ? mockDB.userPasswords.get(user.id) : undefined;
    
    if (user && expectedPasswordHash === `_hashed_${password}`) {
      return { ...user };
    }
    throw new Error('Mã học sinh hoặc mật khẩu không đúng.');
  },

  changePassword: async (userId: number, newPassword: string): Promise<void> => {
    await delay(500);
    const userIndex = mockDB.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      mockDB.users[userIndex].mustChangePassword = false;
      mockDB.userPasswords.set(userId, `_hashed_${newPassword}`);
      return;
    }
    throw new Error('Không tìm thấy người dùng.');
  },

  changeOwnPassword: async (userId: number, oldPassword: string, newPassword: string): Promise<void> => {
    await delay(500);
    const userIndex = mockDB.users.findIndex(u => u.id === userId);
    const currentPasswordHash = mockDB.userPasswords.get(userId);

    if (userIndex !== -1 && currentPasswordHash === `_hashed_${oldPassword}`) {
      mockDB.users[userIndex].mustChangePassword = false;
      mockDB.userPasswords.set(userId, `_hashed_${newPassword}`);
      return;
    }
    throw new Error('Mật khẩu hiện tại không đúng.');
  },

  verifyStudentForPasswordReset: async (ma_hocsinh: string, ngaysinh: string): Promise<number> => {
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
    await delay(500);
    const userIndex = mockDB.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      mockDB.users[userIndex].mustChangePassword = false;
      mockDB.userPasswords.set(userId, `_hashed_${newPassword}`);
      return;
    }
    throw new Error('Đã xảy ra lỗi không mong muốn.');
  },
  
  getStudentById: async (userId: number): Promise<Student> => {
    await delay(300);
    const student = mockDB.users.find(u => u.id === userId && u.role === Role.Student);
    if (student) {
        return { ...student };
    }
    throw new Error('Không tìm thấy học sinh.');
  },

  updateStudentRegistration: async (userId: number, data: { reviewSubjects: number[], examSubjects: number[], customData: { [key: string]: any } }): Promise<void> => {
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
      return;
    }
    throw new Error('Không tìm thấy người dùng.');
  },

  // --- Admin specific functions ---
  getStudents: async (): Promise<Student[]> => {
    await delay(300);
    return JSON.parse(JSON.stringify(mockDB.users.filter(u => u.role === Role.Student) as Student[]));
  },

  addStudent: async (studentData: Omit<Student, 'id' | 'role'>): Promise<Student> => {
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
    return newStudent;
  },

  addStudentsBatch: async (studentsData: any[]): Promise<void> => {
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
  },

  updateStudent: async (studentId: number, updates: Partial<Student>): Promise<Student> => {
      await delay(400);
      const studentIndex = mockDB.users.findIndex(s => s.id === studentId);
      if (studentIndex === -1) throw new Error("Student not found");
      
      mockDB.users[studentIndex] = { ...mockDB.users[studentIndex], ...updates };
      return mockDB.users[studentIndex];
  },

  deleteStudentsBatch: async (studentIds: number[]): Promise<void> => {
    await delay(500);
    const idsToDelete = new Set(studentIds);
    
    // Create new, filtered list of users
    const updatedUsers = mockDB.users.filter(user => !idsToDelete.has(user.id));
    
    // Create a new password map, excluding the deleted users
    const updatedPasswords = new Map(mockDB.userPasswords);
    studentIds.forEach(id => {
      updatedPasswords.delete(id);
    });

    // Atomically replace the data
    mockDB.users = updatedUsers;
    mockDB.userPasswords = updatedPasswords;
  },

  deleteAllStudents: async (): Promise<void> => {
    await delay(500);
    // Find all admin users to preserve them
    const adminUsers = mockDB.users.filter(u => u.role === Role.Admin);
    const adminUserIds = new Set(adminUsers.map(u => u.id));
    
    // Create a new password map containing only the passwords for admin users
    const newPasswordMap = new Map<number, string>();
    mockDB.userPasswords.forEach((password, id) => {
        if (adminUserIds.has(id)) {
            newPasswordMap.set(id, password);
        }
    });
    
    // Atomically replace the user list and password map
    mockDB.users = adminUsers;
    mockDB.userPasswords = newPasswordMap;
  },

  getStudentPassword: async (studentId: number): Promise<string> => {
    await delay(200);
    const passwordHash = mockDB.userPasswords.get(studentId);
    if (!passwordHash) throw new Error("Password not found for student.");
    // Reverse the mock hash
    if (passwordHash.startsWith('_hashed_')) {
      return passwordHash.substring(8);
    }
    return "Could not retrieve password.";
  },

  resetStudentPassword: async (studentId: number, newPassword?: string): Promise<void> => {
      await delay(300);
      const studentIndex = mockDB.users.findIndex(s => s.id === studentId);
      if (studentIndex === -1) throw new Error("Student not found");

      const student = mockDB.users[studentIndex];
      student.mustChangePassword = !newPassword; // must change if reset to default, not if admin sets it
      
      const passwordToSet = newPassword || student.ma_hocsinh;
      mockDB.userPasswords.set(student.id, `_hashed_${passwordToSet}`);
  },

  getRegistrationStatus: async (): Promise<boolean> => {
    await delay(100);
    const isPastDeadline = new Date() > new Date(mockDB.registrationDeadline);
    return mockDB.isRegistrationLocked || isPastDeadline;
  },

  setRegistrationStatus: async (locked: boolean): Promise<boolean> => {
    await delay(400);
    mockDB.isRegistrationLocked = locked;
    return mockDB.isRegistrationLocked;
  },
  
  getRegistrationDeadline: async (): Promise<string> => {
    await delay(50);
    return mockDB.registrationDeadline;
  },
  
  setRegistrationDeadline: async (deadline: string): Promise<string> => {
    await delay(400);
    mockDB.registrationDeadline = deadline;
    return mockDB.registrationDeadline;
  },

  getRegistrationSettings: async (): Promise<{ showReviewSubjects: boolean, showExamSubjects: boolean, showCustomFields: boolean }> => {
    await delay(50);
    return JSON.parse(JSON.stringify(mockDB.registrationSettings));
  },
  
  updateRegistrationSettings: async (settings: { showReviewSubjects: boolean, showExamSubjects: boolean, showCustomFields: boolean }): Promise<void> => {
    await delay(400);
    mockDB.registrationSettings = settings;
  },

  getSubjects: async(): Promise<{ review: Subject[], exam: Subject[] }> => {
    await delay(150);
    return JSON.parse(JSON.stringify({
        review: mockDB.reviewSubjects,
        exam: mockDB.examSubjects
    }));
  },

  updateSubjects: async(subjects: { review: Subject[], exam: Subject[] }): Promise<void> => {
    await delay(500);
    mockDB.reviewSubjects = subjects.review;
    mockDB.examSubjects = subjects.exam;
  },

  getCustomFormFields: async (): Promise<CustomField[]> => {
    await delay(100);
    return JSON.parse(JSON.stringify(mockDB.customFormFields));
  },
  
  updateCustomFormFields: async (fields: CustomField[]): Promise<void> => {
    await delay(400);
    mockDB.customFormFields = fields;
  },
};