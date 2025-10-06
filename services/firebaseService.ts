import { Role, Student, Subject, User, CustomField } from '../types';

// Declare Firebase services. These are initialized in initializeFirebase().
// Using 'any' type to avoid needing full Firebase types at compile time,
// as the SDK is loaded globally from index.html.
let firebase: any;
let db: any;
// Firebase Auth is no longer used for password management to ensure consistency with the app's workaround architecture.

// --- INITIALIZATION ---
export const initializeFirebase = (config: any): boolean => {
    const firebaseSDK = (window as any).firebase;
    if (!firebaseSDK) {
        // Firebase SDK script has not loaded
        return false;
    }

    if (!firebaseSDK.apps.length) {
        firebase = firebaseSDK;
        firebase.initializeApp(config);
        db = firebase.firestore();
    } else {
        // Already initialized, just re-assign variables
        firebase = firebaseSDK;
        db = firebase.firestore();
    }
    return true;
};

// --- HELPER FUNCTIONS ---
const getPasswordFromUser = (userData: any): string => {
    return userData.cccd || userData.ma_hocsinh;
}


// --- API SERVICE OBJECT ---
export const firebaseService = {
    // --- AUTHENTICATION ---
    login: async (ma_hocsinh: string, password: string): Promise<User> => {
        const userQuery = await db.collection('students')
                                .where('ma_hocsinh', '==', ma_hocsinh)
                                .limit(1).get();

        if (userQuery.empty) {
            throw new Error('Mã học sinh hoặc mật khẩu không đúng.');
        }

        const userData = userQuery.docs[0].data();
        const userId = userData.id;

        const passwordDoc = await db.collection('temp_passwords').doc(String(userId)).get();
        
        if (!passwordDoc.exists) {
            throw new Error('Tài khoản chưa được kích hoạt hoặc bị lỗi. Vui lòng liên hệ quản trị viên.');
        }

        const expectedPassword = passwordDoc.data().password;

        if (password === expectedPassword) {
            return userData as User;
        } else {
            throw new Error('Mã học sinh hoặc mật khẩu không đúng.');
        }
    },
    
    changePassword: async (userId: number, newPassword: string): Promise<void> => {
        // This function is for the first-time password change.
        // It now directly updates the password in the temporary collection.
        await db.collection('temp_passwords').doc(String(userId)).set({ password: newPassword });
        await db.collection('students').doc(String(userId)).update({ mustChangePassword: false });
    },
    
    changeOwnPassword: async (userId: number, oldPassword: string, newPassword: string): Promise<void> => {
        // Re-implement to check against the temporary password collection.
        const passwordDoc = await db.collection('temp_passwords').doc(String(userId)).get();
        
        if (!passwordDoc.exists || passwordDoc.data().password !== oldPassword) {
            throw new Error('Mật khẩu hiện tại không đúng.');
        }

        // If old password is correct, update to the new one.
        await db.collection('temp_passwords').doc(String(userId)).set({ password: newPassword });
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
        // This function is now consistent with the rest of the auth flow.
        await db.collection('temp_passwords').doc(String(userId)).set({ password: newPassword });
        await db.collection('students').doc(String(userId)).update({
            mustChangePassword: false, // The user has actively set a new password.
        });
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
        if (!settings.registrationDeadline) return settings.isRegistrationLocked;
        const isPastDeadline = new Date() > new Date(settings.registrationDeadline);
        return settings.isRegistrationLocked || isPastDeadline;
    },
    getRegistrationDeadline: async (): Promise<string> => (await firebaseService.getSettings()).registrationDeadline,
    getRegistrationSettings: async () => (await firebaseService.getSettings()).registrationSettings || { showReviewSubjects: true, showExamSubjects: true, showCustomFields: true },
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
        
        const password = getPasswordFromUser(studentData);
        
        await db.collection('students').doc(String(nextUserId)).set(newStudent);
        await db.collection('settings').doc('counters').set({ studentId: nextUserId }, { merge: true });
        
        // Store the plain-text pass in the temporary collection, consistent with the app's logic.
        await db.collection('temp_passwords').doc(String(nextUserId)).set({ password });

        return newStudent;
    },
    
    getStudentPassword: async (studentId: number): Promise<string> => {
        const doc = await db.collection('temp_passwords').doc(String(studentId)).get();
        if (doc.exists) return doc.data().password;
        throw new Error("Không tìm thấy mật khẩu (có thể đã được thay đổi hoặc tài khoản bị lỗi).");
    },
    
    updateStudent: async (studentId: number, updates: Partial<Student>): Promise<Student> => {
        const docRef = db.collection('students').doc(String(studentId));
        await docRef.update(updates);
        const updatedDoc = await docRef.get();
        return updatedDoc.data() as Student;
    },
    
    addStudentsBatch: async (studentsData: any[]): Promise<void> => {
        const batch = db.batch();
        const countersDoc = await db.collection('settings').doc('counters').get();
        let nextId = (countersDoc.data()?.studentId || 1000);

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
            const studentDocRef = db.collection('students').doc(String(nextId));
            batch.set(studentDocRef, newStudent);

            const password = getPasswordFromUser(s);
            const passwordDocRef = db.collection('temp_passwords').doc(String(nextId));
            batch.set(passwordDocRef, { password });
        }
        
        batch.set(db.collection('settings').doc('counters'), { studentId: nextId }, { merge: true });
        await batch.commit();
    },

    deleteStudentsBatch: async (studentIds: number[]): Promise<void> => {
        const batch = db.batch();
        studentIds.forEach(id => {
            batch.delete(db.collection('students').doc(String(id)));
            batch.delete(db.collection('temp_passwords').doc(String(id)));
        });
        await batch.commit();
    },

    deleteAllStudents: async (): Promise<void> => {
        const studentSnapshot = await db.collection('students').where('role', '==', Role.Student).get();
        const studentBatch = db.batch();
        studentSnapshot.docs.forEach((doc: any) => studentBatch.delete(doc.ref));
        await studentBatch.commit();
        
        // This is less efficient but necessary without a backend.
        // It assumes temp_passwords are only for students.
        const passwordSnapshot = await db.collection('temp_passwords').get();
        const passwordBatch = db.batch();
        passwordSnapshot.docs.forEach((doc: any) => {
            // A more robust check might be needed if admins also had temp passwords
            passwordBatch.delete(doc.ref);
        });
        await passwordBatch.commit();
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
        await db.collection('settings').doc('config').set({ isRegistrationLocked: locked }, { merge: true });
        return locked;
    },
    setRegistrationDeadline: async (deadline: string): Promise<string> => {
        await db.collection('settings').doc('config').set({ registrationDeadline: deadline }, { merge: true });
        return deadline;
    },
    updateRegistrationSettings: async (settings: any): Promise<void> => {
        await db.collection('settings').doc('config').set({ registrationSettings: settings }, { merge: true });
    },
    updateSubjects: async (subjects: any): Promise<void> => {
        await db.collection('settings').doc('config').set({
            reviewSubjects: subjects.review,
            examSubjects: subjects.exam,
        }, { merge: true });
    },
    updateCustomFormFields: async (fields: CustomField[]): Promise<void> => {
        await db.collection('settings').doc('config').set({ customFormFields: fields }, { merge: true });
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
        
        const studentBatch = db.batch();
        const passwordBatch = db.batch();

        for (const user of localDB.users) {
            const { hashed_password, ...studentDocData } = user;
            studentBatch.set(db.collection('students').doc(String(user.id)), studentDocData);
            
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
