export enum Role {
  Admin = 'admin',
  Student = 'student',
}

export interface User {
  id: number;
  ma_hocsinh: string;
  hoten: string;
  ngaysinh: string;
  lop: string;
  role: Role;
  mustChangePassword?: boolean;
}

export interface Student extends User {
  cccd?: string; // Only for initial creation
  hashed_password?: string;
  reviewSubjects?: number[];
  examSubjects?: number[];
  registrationDate?: string;
  customData?: { [key: string]: any };
}

export interface Subject {
  id: number;
  name: string;
}

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date';
  required: boolean;
}
