import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import postgres from "postgres";
import { Role, Student } from "../../types";

// Connect to the database using the DATABASE_URL environment variable
// Netlify will automatically provide this when linked to a Neon database
const sql = postgres(process.env.DATABASE_URL || '', { ssl: "require" });

// The initial data structure, similar to the old mock DB
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
      { id: 7, 'name': 'Lịch sử' }, { id: 8, name: 'Địa lý' }, { id: 9, name: 'GDCD' },
    ],
    customFormFields: [
      { id: 'phone', label: 'SĐT Phụ huynh', type: 'text', required: true },
      { id: 'address', label: 'Địa chỉ nhà', type: 'text', required: false },
    ],
  },
  users: [
    { id: 1, ma_hocsinh: 'admin', hoten: 'Admin', ngaysinh: '1990-01-01', lop: 'N/A', role: Role.Admin, mustChangePassword: false, reviewSubjects: [], examSubjects: [], customData: {} },
    { id: 2, ma_hocsinh: 'HS2025001', hoten: 'Nguyen Van A', ngaysinh: '2006-05-12', lop: '12A1', role: Role.Student, mustChangePassword: true, reviewSubjects: [4, 5], examSubjects: [7, 8], registrationDate: '2024-05-20T10:00:00Z', customData: { phone: '0987654321', address: '123 Đường ABC, Huế' } },
    { id: 3, ma_hocsinh: 'HS2025002', hoten: 'Tran Thi B', ngaysinh: '2006-11-02', lop: '12A3', role: Role.Student, mustChangePassword: false, reviewSubjects: [1,3], examSubjects: [6,8], registrationDate: '2024-05-21T14:30:00Z', customData: {} },
  ] as (Student & { cccd?: string })[],
  userPasswords: new Map<number, string>([
    [1, 'adminpassword'],
    [2, 'HS2025001'],
    [3, 'newpassword123'],
  ]),
  nextUserId: 10,
};

// --- DATABASE SEEDING ---
async function seedDatabase() {
  try {
    // Check if seeding is necessary
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'app_config'
      );
    `;

    if (tableCheck[0].exists) {
      const dataCheck = await sql`SELECT COUNT(*) FROM app_config`;
      if (dataCheck[0].count > 0) {
        console.log("Database already seeded.");
        return; // Already seeded
      }
    }

    console.log("Database not seeded. Initializing...");

    await sql.begin(async (transaction) => {
      // Create tables
      await transaction`
        CREATE TABLE IF NOT EXISTS students (
          id INT PRIMARY KEY,
          ma_hocsinh TEXT UNIQUE NOT NULL,
          hoten TEXT NOT NULL,
          ngaysinh TEXT NOT NULL,
          lop TEXT NOT NULL,
          role TEXT NOT NULL,
          mustChangePassword BOOLEAN DEFAULT TRUE,
          reviewSubjects INT[],
          examSubjects INT[],
          registrationDate TEXT,
          customData JSONB
        );
      `;
      await transaction`
        CREATE TABLE IF NOT EXISTS passwords (
          student_id INT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
          password_hash TEXT NOT NULL
        );
      `;
      await transaction`
        CREATE TABLE IF NOT EXISTS app_config (
          id INT PRIMARY KEY DEFAULT 1,
          config_data JSONB NOT NULL
        );
      `;

      // Insert data
      await transaction`INSERT INTO app_config (id, config_data) VALUES (1, ${sql.json(initialDB.settings)})`;

      for (const user of initialDB.users) {
        const { cccd, ...studentData } = user;
        await transaction`INSERT INTO students ${sql(studentData)}`;
        const password = initialDB.userPasswords.get(user.id);
        if (password) {
            // NOTE: In a real production app, you MUST hash this password.
            // For simplicity and to match the old logic, we are storing it plain.
            await transaction`INSERT INTO passwords (student_id, password_hash) VALUES (${user.id}, ${password})`;
        }
      }
    });

    console.log("Database seeding complete.");
  } catch (error) {
    console.error("Database seeding failed:", error);
    // If seeding fails, we should throw to prevent inconsistent states
    throw new Error("Failed to initialize the database.");
  }
}

// --- API ACTION HANDLERS ---
const handlers: Record<string, (payload: any) => Promise<any>> = {
  seed: async (_payload: any) => seedDatabase(),
  
  login: async ({ ma_hocsinh, password }) => {
    const users = await sql`SELECT * FROM students WHERE ma_hocsinh = ${ma_hocsinh}`;
    if (users.length === 0) throw new Error("Mã học sinh hoặc mật khẩu không đúng.");
    
    const user = users[0];
    const passResult = await sql`SELECT password_hash FROM passwords WHERE student_id = ${user.id}`;
    
    if (passResult.length === 0 || passResult[0].password_hash !== password) {
      throw new Error("Mã học sinh hoặc mật khẩu không đúng.");
    }
    return user;
  },
  
  changePassword: async({ userId, newPassword }) => {
    await sql`UPDATE passwords SET password_hash = ${newPassword} WHERE student_id = ${userId}`;
    await sql`UPDATE students SET mustChangePassword = false WHERE id = ${userId}`;
    return { success: true };
  },

  changeOwnPassword: async ({ userId, oldPassword, newPassword }) => {
      const passResult = await sql`SELECT password_hash FROM passwords WHERE student_id = ${userId}`;
      if (passResult.length === 0 || passResult[0].password_hash !== oldPassword) {
          throw new Error('Mật khẩu hiện tại không đúng.');
      }
      await sql`UPDATE passwords SET password_hash = ${newPassword} WHERE student_id = ${userId}`;
      return { success: true };
  },

  verifyStudentForPasswordReset: async ({ ma_hocsinh, ngaysinh }) => {
      const users = await sql`SELECT id FROM students WHERE ma_hocsinh = ${ma_hocsinh} AND ngaysinh = ${ngaysinh} AND role = ${Role.Student}`;
      if (users.length === 0) {
          throw new Error('Thông tin không chính xác. Vui lòng kiểm tra lại Mã học sinh và Ngày sinh.');
      }
      return users[0].id;
  },

  resetPasswordAfterVerification: async ({ userId, newPassword }) => {
      await sql`UPDATE passwords SET password_hash = ${newPassword} WHERE student_id = ${userId}`;
      await sql`UPDATE students SET mustChangePassword = false WHERE id = ${userId}`;
      return { success: true };
  },

  getStudentById: async ({ userId }) => {
      const users = await sql`SELECT * FROM students WHERE id = ${userId}`;
      if(users.length === 0) throw new Error("Không tìm thấy học sinh.");
      return users[0];
  },

  updateStudentRegistration: async ({ userId, data }) => {
      const configRow = await sql`SELECT config_data FROM app_config LIMIT 1`;
      const config = configRow[0].config_data;
      const isPastDeadline = new Date() > new Date(config.registrationDeadline);
      if (config.isRegistrationLocked || isPastDeadline) {
          throw new Error('Hệ thống đã khoá đăng ký. Không thể lưu thay đổi.');
      }
      await sql`
          UPDATE students 
          SET 
              reviewSubjects = ${data.reviewSubjects}, 
              examSubjects = ${data.examSubjects}, 
              customData = ${sql.json(data.customData)},
              registrationDate = ${new Date().toISOString()}
          WHERE id = ${userId}
      `;
      return { success: true };
  },

  // Admin functions
  getStudents: async (_payload: any) => {
      return await sql`SELECT * FROM students WHERE role = ${Role.Student} ORDER BY hoten ASC`;
  },
  
  async getNextId(_payload: any) {
      // In a real high-concurrency app, use a sequence. For this use case, this is fine.
      const maxIdResult = await sql`SELECT MAX(id) as max_id FROM students`;
      return (maxIdResult[0].max_id || 0) + 1;
  },

  addStudent: async ({ studentData }) => {
// FIX: Pass null as payload to conform to the handler's signature.
      const nextId = await handlers.getNextId(null);
      const newStudent = { ...studentData, id: nextId, role: Role.Student, mustChangePassword: true, reviewSubjects: [], examSubjects: [] };
      const { cccd, ...dbStudentData } = newStudent;
      const password = cccd || newStudent.ma_hocsinh;

      await sql`INSERT INTO students ${sql(dbStudentData)}`;
      await sql`INSERT INTO passwords (student_id, password_hash) VALUES (${nextId}, ${password})`;
      return newStudent;
  },

  addStudentsBatch: async ({ studentsData }) => {
// FIX: Pass null as payload to conform to the handler's signature.
      let nextId = await handlers.getNextId(null);
      await sql.begin(async transaction => {
          for (const s of studentsData) {
              const newStudent = { id: nextId, ma_hocsinh: s.ma_hocsinh, hoten: s.hoten, ngaysinh: s.ngaysinh, lop: s.lop, role: Role.Student, mustChangePassword: true, reviewSubjects: [], examSubjects: [], customData: {} };
              const password = s.cccd || s.ma_hocsinh;
              
              await transaction`INSERT INTO students ${sql(newStudent)}`;
              await transaction`INSERT INTO passwords (student_id, password_hash) VALUES (${nextId}, ${password})`;
              nextId++;
          }
      });
      return { success: true };
  },

  updateStudent: async ({ studentId, updates }) => {
      const [updatedStudent] = await sql`UPDATE students SET ${sql(updates)} WHERE id = ${studentId} RETURNING *`;
      return updatedStudent;
  },

  deleteStudentsBatch: async ({ studentIds }) => {
      // Password deletion happens via CASCADE
      await sql`DELETE FROM students WHERE id IN ${sql(studentIds)}`;
      return { success: true };
  },

  deleteAllStudents: async (_payload: any) => {
      await sql`DELETE FROM students WHERE role = ${Role.Student}`;
      return { success: true };
  },

  getStudentPassword: async ({ studentId }) => {
      const result = await sql`SELECT password_hash FROM passwords WHERE student_id = ${studentId}`;
      if (result.length === 0) throw new Error("Không tìm thấy mật khẩu.");
      return result[0].password_hash;
  },
  
  resetStudentPassword: async ({ studentId, newPassword }) => {
      let passwordToSet = newPassword;
      if (!passwordToSet) {
          const users = await sql`SELECT ma_hocsinh FROM students WHERE id = ${studentId}`;
          passwordToSet = users[0].ma_hocsinh;
      }
      await sql`UPDATE passwords SET password_hash = ${passwordToSet} WHERE student_id = ${studentId}`;
      await sql`UPDATE students SET mustChangePassword = ${!newPassword} WHERE id = ${studentId}`;
      return { success: true };
  },

  // Settings functions
  async getSettings(_payload: any) {
    const configRow = await sql`SELECT config_data FROM app_config LIMIT 1`;
    if (configRow.length === 0) throw new Error("Settings not found");
    return configRow[0].config_data;
  },
  
  async updateSettings(newConfigData: any) {
    const [updatedConfig] = await sql`UPDATE app_config SET config_data = ${sql.json(newConfigData)} WHERE id = 1 RETURNING config_data`;
    return updatedConfig.config_data;
  },

  getRegistrationStatus: async (_payload: any) => {
// FIX: Pass null as payload to conform to the handler's signature.
    const settings = await handlers.getSettings(null);
    const isPastDeadline = new Date() > new Date(settings.registrationDeadline);
    return settings.isRegistrationLocked || isPastDeadline;
  },

  setRegistrationStatus: async ({ locked }) => {
// FIX: Pass null as payload to conform to the handler's signature.
    const settings = await handlers.getSettings(null);
    settings.isRegistrationLocked = locked;
    await handlers.updateSettings(settings);
    return locked;
  },

  getRegistrationDeadline: async (_payload: any) => (await handlers.getSettings(null)).registrationDeadline,

  setRegistrationDeadline: async ({ deadline }) => {
// FIX: Pass null as payload to conform to the handler's signature.
    const settings = await handlers.getSettings(null);
    settings.registrationDeadline = deadline;
    await handlers.updateSettings(settings);
    return deadline;
  },

  getRegistrationSettings: async (_payload: any) => (await handlers.getSettings(null)).registrationSettings,

  updateRegistrationSettings: async ({ settings }) => {
// FIX: Pass null as payload to conform to the handler's signature.
    const currentSettings = await handlers.getSettings(null);
    currentSettings.registrationSettings = settings;
    await handlers.updateSettings(currentSettings);
    return { success: true };
  },

  getSubjects: async (_payload: any) => {
// FIX: Pass null as payload to conform to the handler's signature.
    const s = await handlers.getSettings(null);
    return { review: s.reviewSubjects, exam: s.examSubjects };
  },

  updateSubjects: async ({ subjects }) => {
// FIX: Pass null as payload to conform to the handler's signature.
    const s = await handlers.getSettings(null);
    s.reviewSubjects = subjects.review;
    s.examSubjects = subjects.exam;
    await handlers.updateSettings(s);
    return { success: true };
  },
  
  getCustomFormFields: async (_payload: any) => (await handlers.getSettings(null)).customFormFields,

  updateCustomFormFields: async ({ fields }) => {
// FIX: Pass null as payload to conform to the handler's signature.
    const s = await handlers.getSettings(null);
    s.customFormFields = fields;
    await handlers.updateSettings(s);
    return { success: true };
  },
};


// Main handler for the Netlify function
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body || '{}');
    const { action, payload } = body;

    if (!action || typeof action !== 'string' || !handlers[action]) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid or missing action' }) };
    }
    
    const data = await handlers[action](payload);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    };
  } catch (error: any) {
    console.error(`Error executing action:`, error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'An internal server error occurred' }),
    };
  }
};

export { handler };