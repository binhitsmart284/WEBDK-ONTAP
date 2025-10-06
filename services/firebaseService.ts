import { Role, Student, Subject, User, CustomField } from '../types';

// Declare Firebase services. These are initialized in initializeFirebase().
// Using 'any' type to avoid needing full Firebase types at compile time,
// as the SDK is loaded globally from index.html.
let firebase: any;
let db: any;
let auth: any;

const SCHOOL_DOMAIN = 'school.local'; // A dummy domain for creating email addresses

// --- INITIALIZATION ---
export const initializeFirebase = (config: any) => {
    if (!firebase?.apps?.length) {
        firebase = (window as any).firebase;
        firebase.initializeApp(config);
        db = firebase.firestore();
        auth = firebase.auth();
    }
};

// --- HELPER FUNCTIONS ---
const getEmailFromUser = (ma_hocsinh: string, role: Role): string => {
    return role === Role.Admin ? `admin@${SCHOOL_DOMAIN}` : `${ma_hocsinh}@${SCHOOL_DOMAIN}`;
};

const getPasswordFromUser = (userData: any): string => {
    return userData.cccd || userData.ma_hocsinh;
}


// --- API SERVICE OBJECT ---
export const firebaseService = {
    // --- AUTHENTICATION ---
    login: async (ma_hocsinh: string, password: string): Promise<User> => {
        // Find user role first to construct the correct email
        const userQuery = await db.collection('students')
                                .where('ma_hocsinh', '==', ma_hocsinh)
                                .limit(1).get();

        if (userQuery.empty) {
            throw new Error('Mã học sinh hoặc mật khẩu không đúng.');
        }

        const userData = userQuery.docs[0].data();
        const email = getEmailFromUser(ma_hocsinh, userData.role);

        try {
            await auth.signInWithEmailAndPassword(email, password);
            return userData as User;
        } catch (error: any) {
            // Map Firebase auth errors to user-friendly messages
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                throw new Error('Mã học sinh hoặc mật khẩu không đúng.');
            }
            throw new Error('Đăng nhập thất bại.');
        }
    },
    
    changePassword: async (userId: number, newPassword: string): Promise<void> => {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated.");

        await user.updatePassword(newPassword);
        // Also update the mustChangePassword flag in Firestore
        await db.collection('students').doc(String(userId)).update({ mustChangePassword: false });
    },
    
    changeOwnPassword: async (userId: number, oldPassword: string, newPassword: string): Promise<void> => {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated.");
        
        // Re-authenticate user to verify their old password
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPassword);
        await user.reauthenticateWithCredential(credential);

        // If re-authentication is successful, update the password
        await user.updatePassword(newPassword);
        await db.collection('students').doc(String(userId)).update({ mustChangePassword: false });
    },

    verifyStudentForPasswordReset: async (ma_hocsinh: string, ngaysinh: string): Promise<number> => {
        const q = await db.collection('students')
            .where('ma_hocsinh', '==', ma_hocsinh)
            .where('ngaysinh', '==', ngaysinh)
            .where('role', '==', Role.Student)
            .limit(1).get();

        if (q.empty) {
            throw new Error('Thông tin không chính xác. Vui lòng kiểm tra lại Mã học sinh và Ngày sinh.');
        }
        return q.docs[0].data().id;
    },

    resetPasswordAfterVerification: async (userId: number, newPassword: string): Promise<void> => {
        // This is tricky client-side. A secure implementation would use a server-side function
        // to change the password. For this client-only app, we'll store the new password temporarily
        // and let the user log in to change it. A better but more complex approach would be
        // to have a "reset token" system. We will just update the firestore record password for now.
        // NOTE: This is NOT standard Firebase Auth flow. It's a workaround for client-only.
        // The proper way is sending a password reset email.
        await db.collection('students').doc(String(userId)).update({
            hashed_password: `_plaintext_${newPassword}`, // A flag for the app to handle
            mustChangePassword: false
        });
        // In a real scenario, you'd trigger a cloud function to update the Auth user's password.
        throw new Error("Chức năng này yêu cầu môi trường server. Mật khẩu không được reset trong Auth.");
    },

    // --- DATA FETCHING ---
    getStudentById: async (userId: number): Promise<Student> => {
        const doc = await db.collection('students').doc(String(userId)).get();
        if (!doc.exists) throw new Error("Không tìm thấy học sinh.");
        return doc.data() as Student;
    },

    getStudents: async (): Promise<Student[]> => {
        const snapshot = await db.collection('students').where('role', '==', Role.Student).get();
        return snapshot.docs.map((doc: any) => doc.data());
    },

    getSettings: async (): Promise<any> => {
        const doc = await db.collection('settings').doc('config').get();
        if (!doc.exists) return {};
        return doc.data();
    },
    
    // --- These functions get specific parts of the settings doc ---
    getRegistrationStatus: async (): Promise<boolean> => {
        const settings = await firebaseService.getSettings();
        const isPastDeadline = new Date() > new Date(settings.registrationDeadline);
        return settings.isRegistrationLocked || isPastDeadline;
    },
    getRegistrationDeadline: async (): Promise<string> => (await firebaseService.getSettings()).registrationDeadline,
    getRegistrationSettings: async () => (await firebaseService.getSettings()).registrationSettings,
    getSubjects: async () => {
        const settings = await firebaseService.getSettings();
        return { review: settings.reviewSubjects || [], exam: settings.examSubjects || [] };
    },
    getCustomFormFields: async () => (await firebaseService.getSettings()).customFormFields || [],

    // --- DATA MODIFICATION ---
    updateStudentRegistration: async (userId: number, data: { reviewSubjects: number[], examSubjects: number[], customData: { [key: string]: any } }): Promise<void> => {
        const isLocked = await firebaseService.getRegistrationStatus();
        if (isLocked) {
             throw new Error('Hệ thống đã khoá đăng ký. Không thể lưu thay đổi.');
        }
        await db.collection('students').doc(String(userId)).update({
            ...data,
            registrationDate: new Date().toISOString(),
        });
    },

    // --- ADMIN FUNCTIONS ---
    addStudent: async (studentData: Omit<Student, 'id' | 'role'>): Promise<Student> => {
        // This is complex because it involves both Auth and Firestore.
        // It should ideally be a Cloud Function for atomicity.
        const nextIdDoc = await db.collection('settings').doc('counters').get();
        const nextUserId = (nextIdDoc.data()?.studentId || 1000) + 1;

        const newStudent: Student = {
            ...studentData,
            id: nextUserId,
            role: Role.Student,
            mustChangePassword: true,
            reviewSubjects: [],
            examSubjects: [],
        };
        
        const email = getEmailFromUser(newStudent.ma_hocsinh, newStudent.role);
        const password = getPasswordFromUser(studentData);
        
        // Cannot create auth user client-side without logging them in.
        // This highlights a limitation of client-only apps.
        // We'll add to Firestore and assume admin handles auth separately, or we need a server.
        await db.collection('students').doc(String(nextUserId)).set(newStudent);
        await db.collection('settings').doc('counters').set({ studentId: nextUserId }, { merge: true });
        
        // Let's also store the plain-text pass in a separate, highly-restricted collection
        // This is NOT secure but a workaround for this project's constraints.
        await db.collection('temp_passwords').doc(String(nextUserId)).set({ password });

        return newStudent;
    },
    
    getStudentPassword: async (studentId: number): Promise<string> => {
        const doc = await db.collection('temp_passwords').doc(String(studentId)).get();
        if (doc.exists) return doc.data().password;
        throw new Error("Password not found (it may have been changed).");
    },
    
    // updateStudent, addStudentsBatch, etc. follow a similar pattern of calling Firestore APIs.
    updateStudent: async (studentId: number, updates: Partial<Student>): Promise<Student> => {
        const docRef = db.collection('students').doc(String(studentId));
        await docRef.update(updates);
        return (await docRef.get()).data() as Student;
    },
    
    addStudentsBatch: async (studentsData: any[]): Promise<void> => {
        // In a real app, this MUST be a Cloud Function. Doing it client-side is slow,
        // insecure, and error-prone. We provide a simplified version.
        const batch = db.batch();
        let nextId = (await db.collection('settings').doc('counters').get()).data()?.studentId || 1000;

        for (const s of studentsData) {
            nextId++;
            const newStudent: Student = {
                id: nextId,
                ma_hocsinh: s.ma_hocsinh,
                hoten: s.hoten,
                ngaysinh: s.ngaysinh,
                lop: s.lop,
                role: Role.Student,
                mustChangePassword: true,
                reviewSubjects: [],
                examSubjects: [],
            };
            const docRef = db.collection('students').doc(String(nextId));
            batch.set(docRef, newStudent);
        }
        
        batch.set(db.collection('settings').doc('counters'), { studentId: nextId }, { merge: true });
        await batch.commit();
    },

    deleteStudentsBatch: async (studentIds: number[]): Promise<void> => {
        const batch = db.batch();
        studentIds.forEach(id => {
            const docRef = db.collection('students').doc(String(id));
            batch.delete(docRef);
        });
        await batch.commit();
    },

    deleteAllStudents: async (): Promise<void> => {
        // EXTREMELY DANGEROUS on client-side. A real app would use a Cloud Function.
        const snapshot = await db.collection('students').where('role', '==', Role.Student).get();
        const batch = db.batch();
        snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
    },
    
    resetStudentPassword: async (studentId: number, newPassword?: string): Promise<void> => {
        const student = await firebaseService.getStudentById(studentId);
        const passwordToSet = newPassword || student.ma_hocsinh;
        
        await db.collection('temp_passwords').doc(String(studentId)).set({ password: passwordToSet });
        await db.collection('students').doc(String(studentId)).update({
            mustChangePassword: !newPassword
        });
    },

    // --- Settings Modification ---
    setRegistrationStatus: async (locked: boolean): Promise<boolean> => {
        await db.collection('settings').doc('config').update({ isRegistrationLocked: locked });
        return locked;
    },
    setRegistrationDeadline: async (deadline: string): Promise<string> => {
        await db.collection('settings').doc('config').update({ registrationDeadline: deadline });
        return deadline;
    },
    updateRegistrationSettings: async (settings: any): Promise<void> => {
        await db.collection('settings').doc('config').update({ registrationSettings: settings });
    },
    updateSubjects: async (subjects: any): Promise<void> => {
        await db.collection('settings').doc('config').update({
            reviewSubjects: subjects.review,
            examSubjects: subjects.exam,
        });
    },
    updateCustomFormFields: async (fields: CustomField[]): Promise<void> => {
        await db.collection('settings').doc('config').update({ customFormFields: fields });
    },

    // --- MIGRATION ---
    migrateData: async (localDB: any, progressCallback: (message: string) => void) => {
        progressCallback('Bắt đầu di chuyển... (Bước 1/3: Cài đặt hệ thống)');
        
        // 1. Migrate settings
        const settingsData = {
            isRegistrationLocked: localDB.isRegistrationLocked,
            registrationDeadline: localDB.registrationDeadline,
            registrationSettings: localDB.registrationSettings,
            reviewSubjects: localDB.reviewSubjects,
            examSubjects: localDB.examSubjects,
            customFormFields: localDB.customFormFields,
        };
        await db.collection('settings').doc('config').set(settingsData, { merge: true });
        await db.collection('settings').doc('counters').set({ studentId: localDB.nextUserId }, { merge: true });

        // 2. Migrate users
        const totalUsers = localDB.users.length;
        progressCallback(`(Bước 2/3: Di chuyển ${totalUsers} người dùng)`);
        
        // Use batch writes for performance
        const studentBatch = db.batch();
        const passwordBatch = db.batch();

        for (const user of localDB.users) {
            const { hashed_password, ...studentDocData } = user; // Exclude password from main doc
            studentBatch.set(db.collection('students').doc(String(user.id)), studentDocData);
            
            // This is the insecure part necessitated by client-only architecture.
            // A real app would create Auth users via a server.
            const password = localDB.userPasswords.get(user.id)?.replace('_hashed_', '');
            if (password) {
                passwordBatch.set(db.collection('temp_passwords').doc(String(user.id)), { password });
            }
        }
        await studentBatch.commit();
        progressCallback(`(Bước 3/3: Lưu mật khẩu tạm)`);
        await passwordBatch.commit();
        
        progressCallback('Di chuyển thành công!');
    },
};
