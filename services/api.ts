import { Role, Student, Subject, User, CustomField } from '../types';

// This file now acts as a local, in-memory database and API layer,
// replacing the previous Netlify Function backend.

// --- IN-MEMORY DATABASE ---

const initialDB = {
  settings: {
    isRegistrationLocked: false,
    registrationDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    registrationSettings: {
      showReviewSubjects: true,
      showExamSubjects: true,
      showCustomFields: true,
    },
    reviewSubjects: [
      { id: 1, name: 'Toán' }, { id: 2, name: 'Ngữ văn' }, { id: 3, name: 'Tiếng Anh' }, { id: 4, name: 'Vật lý' },
      { id: 5, name: 'Hóa học' }, { id: 6, name: 'Sinh học' }, { id: 7, name: 'Lịch sử' }, { id: 8, name: 'Địa lý' },
      { id: 9, name: 'GDCD' },
    ],
    examSubjects: [
      { id: 4, name: 'Vật lý' }, { id: 5, name: 'Hóa học' }, { id: 6, name: 'Sinh học' },
      { id: 7, name: 'Lịch sử' }, { id: 8, name: 'Địa lý' }, { id: 9, name: 'GDCD' },
    ],
    customFormFields: [
      { id: 'phone', label: 'SĐT Phụ huynh', type: 'text' as const, required: true },
      { id: 'address', label: 'Địa chỉ nhà', type: 'text' as const, required: false },
    ],
  },
  users: [
    { id: 1, ma_hocsinh: 'admin', hoten: 'Admin', ngaysinh: '1990-01-01', lop: 'N/A', role: Role.Admin, mustChangePassword: false, reviewSubjects: [], examSubjects: [], customData: {} },
    { id: 2, ma_hocsinh: 'HS2025001', hoten: 'Nguyen Van A', ngaysinh: '2006-05-12', lop: '12A1', role: Role.Student, mustChangePassword: true, reviewSubjects: [4, 5], examSubjects: [7, 8], registrationDate: '2024-05-20T10:00:00Z', customData: { phone: '0987654321', address: '123 Đường ABC, Huế' } },
    { id: 3, ma_hocsinh: 'HS2025002', hoten: 'Tran Thi B', ngaysinh: '2006-11-02', lop: '12A3', role: Role.Student, mustChangePassword: false, reviewSubjects: [1,3], examSubjects: [6,8], registrationDate: '2024-05-21T14:30:00Z', customData: {} },
  ] as (Student & { cccd?: string })[],
  userPasswords: new Map<number, string>([
    [1, 'adminpassword'],
    [2, 'HS2025001'], // Default password is CCCD, but here it's ma_hocsinh for this example user
    [3, 'newpassword123'],
  ]),
  nextUserId: 10,
};

// Create a deep copy to simulate a persistent store that resets on page load
let db = {
    settings: JSON.parse(JSON.stringify(initialDB.settings)),
    users: JSON.parse(JSON.stringify(initialDB.users)),
    userPasswords: new Map(initialDB.userPasswords),
    nextUserId: initialDB.nextUserId,
};

// --- API IMPLEMENTATION ---

// Helper to simulate network latency
const delay = () => new Promise(res => setTimeout(res, 100 + Math.random() * 200));

export const api = {
  login: async (ma_hocsinh: string, password: string): Promise<User> => {
    await delay();
    const user = db.users.find(u => u.ma_hocsinh === ma_hocsinh);
    if (!user) {
      throw new Error("Mã học sinh hoặc mật khẩu không đúng.");
    }
    const storedPassword = db.userPasswords.get(user.id);
    if (storedPassword !== password) {
      throw new Error("Mã học sinh hoặc mật khẩu không đúng.");
    }
    return JSON.parse(JSON.stringify(user));
  },

  changePassword: async (userId: number, newPassword: string): Promise<void> => {
    await delay();
    if (!db.userPasswords.has(userId)) throw new Error("User not found.");
    db.userPasswords.set(userId, newPassword);
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.mustChangePassword = false;
    }
    return;
  },
  
  changeOwnPassword: async (userId: number, oldPassword: string, newPassword: string): Promise<void> => {
    await delay();
    const storedPassword = db.userPasswords.get(userId);
    if (storedPassword !== oldPassword) {
        throw new Error('Mật khẩu hiện tại không đúng.');
    }
    db.userPasswords.set(userId, newPassword);
    return;
  },
  
  verifyStudentForPasswordReset: async (ma_hocsinh: string, ngaysinh: string): Promise<number> => {
    await delay();
    const user = db.users.find(u => u.ma_hocsinh === ma_hocsinh && u.ngaysinh === ngaysinh && u.role === Role.Student);
    if (!user) {
        throw new Error('Thông tin không chính xác. Vui lòng kiểm tra lại Mã học sinh và Ngày sinh.');
    }
    return user.id;
  },

  resetPasswordAfterVerification: async (userId: number, newPassword: string): Promise<void> => {
    await delay();
    return api.changePassword(userId, newPassword);
  },

  getStudentById: async (userId: number): Promise<Student> => {
    await delay();
    const student = db.users.find(u => u.id === userId && u.role === Role.Student);
    if (!student) throw new Error("Không tìm thấy học sinh.");
    return JSON.parse(JSON.stringify(student));
  },

  updateStudentRegistration: async (userId: number, data: { reviewSubjects: number[], examSubjects: number[], customData: { [key: string]: any } }): Promise<void> => {
    await delay();
    const isLocked = await api.getRegistrationStatus();
    if (isLocked) {
        throw new Error('Hệ thống đã khoá đăng ký. Không thể lưu thay đổi.');
    }
    const student = db.users.find(u => u.id === userId);
    if (!student) throw new Error("Không tìm thấy học sinh.");

    student.reviewSubjects = data.reviewSubjects;
    student.examSubjects = data.examSubjects;
    student.customData = data.customData;
    student.registrationDate = new Date().toISOString();
    return;
  },

  // Admin functions
  getStudents: async (): Promise<Student[]> => {
    await delay();
    return JSON.parse(JSON.stringify(db.users.filter(u => u.role === Role.Student).sort((a, b) => a.hoten.localeCompare(b.hoten))));
  },

  addStudent: async (studentData: Omit<Student, 'id' | 'role'> & { cccd?: string }): Promise<Student> => {
    await delay();
    const nextId = db.nextUserId++;
    const newStudent: Student = {
        id: nextId,
        role: Role.Student,
        mustChangePassword: true,
        reviewSubjects: [],
        examSubjects: [],
        ...studentData
    };
    db.users.push(newStudent);
    const password = studentData.cccd || studentData.ma_hocsinh;
    db.userPasswords.set(nextId, password);
    return JSON.parse(JSON.stringify(newStudent));
  },

  addStudentsBatch: async (studentsData: any[]): Promise<void> => {
    await delay();
    studentsData.forEach(s => {
        const nextId = db.nextUserId++;
        const newStudent: Student = {
            id: nextId,
            ma_hocsinh: String(s.ma_hocsinh),
            hoten: String(s.hoten),
            ngaysinh: String(s.ngaysinh),
            lop: String(s.lop),
            role: Role.Student,
            mustChangePassword: true,
            reviewSubjects: [],
            examSubjects: [],
            customData: {},
        };
        db.users.push(newStudent);
        const password = String(s.cccd || s.ma_hocsinh);
        db.userPasswords.set(nextId, password);
    });
    return;
  },

  updateStudent: async (studentId: number, updates: Partial<Student>): Promise<Student> => {
    await delay();
    const student = db.users.find(u => u.id === studentId);
    if (!student) throw new Error("Không tìm thấy học sinh.");
    Object.assign(student, updates);
    return JSON.parse(JSON.stringify(student));
  },

  deleteStudentsBatch: async (studentIds: number[]): Promise<void> => {
    await delay();
    db.users = db.users.filter(u => !studentIds.includes(u.id));
    studentIds.forEach(id => db.userPasswords.delete(id));
    return;
  },

  deleteAllStudents: async (): Promise<void> => {
    await delay();
    const studentIds = db.users.filter(u => u.role === Role.Student).map(s => s.id);
    db.users = db.users.filter(u => u.role !== Role.Student);
    studentIds.forEach(id => db.userPasswords.delete(id));
    return;
  },
  
  getStudentPassword: async (studentId: number): Promise<string> => {
    await delay();
    const password = db.userPasswords.get(studentId);
    if (password === undefined) throw new Error("Không tìm thấy mật khẩu.");
    return password;
  },

  resetStudentPassword: async (studentId: number, newPassword?: string): Promise<void> => {
    await delay();
    let passwordToSet = newPassword;
    const user = db.users.find(u => u.id === studentId);
    if (!user) throw new Error("Không tìm thấy học sinh.");

    if (!passwordToSet) {
        passwordToSet = user.ma_hocsinh;
    }
    db.userPasswords.set(studentId, passwordToSet);
    user.mustChangePassword = !newPassword;
    return;
  },

  getRegistrationStatus: async (): Promise<boolean> => {
    await delay();
    const isPastDeadline = new Date() > new Date(db.settings.registrationDeadline);
    return db.settings.isRegistrationLocked || isPastDeadline;
  },

  setRegistrationStatus: async (locked: boolean): Promise<boolean> => {
    await delay();
    db.settings.isRegistrationLocked = locked;
    return db.settings.isRegistrationLocked;
  },
  
  getRegistrationDeadline: async (): Promise<string> => {
    await delay();
    return db.settings.registrationDeadline;
  },
  
  setRegistrationDeadline: async (deadline: string): Promise<string> => {
    await delay();
    db.settings.registrationDeadline = deadline;
    return db.settings.registrationDeadline;
  },

  getRegistrationSettings: async (): Promise<{ showReviewSubjects: boolean, showExamSubjects: boolean, showCustomFields: boolean }> => {
    await delay();
    return JSON.parse(JSON.stringify(db.settings.registrationSettings));
  },
  
  updateRegistrationSettings: async (settings: { showReviewSubjects: boolean, showExamSubjects: boolean, showCustomFields: boolean }): Promise<void> => {
    await delay();
    db.settings.registrationSettings = settings;
    return;
  },

  getSubjects: async (): Promise<{ review: Subject[], exam: Subject[] }> => {
    await delay();
    return JSON.parse(JSON.stringify({ review: db.settings.reviewSubjects, exam: db.settings.examSubjects }));
  },

  updateSubjects: async (subjects: { review: Subject[], exam: Subject[] }): Promise<void> => {
    await delay();
    db.settings.reviewSubjects = subjects.review;
    db.settings.examSubjects = subjects.exam;
    return;
  },

  getCustomFormFields: async (): Promise<CustomField[]> => {
    await delay();
    return JSON.parse(JSON.stringify(db.settings.customFormFields));
  },
  
  updateCustomFormFields: async (fields: CustomField[]): Promise<void> => {
    await delay();
    db.settings.customFormFields = fields;
    return;
  },
};