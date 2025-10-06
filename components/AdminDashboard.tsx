



import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Student, Subject, CustomField, Role } from '../types';
import { api } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { Table } from './ui/Table';
import { UsersIcon, PlusIcon, TrashIcon, KeyIcon, EyeIcon } from './icons';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { useAuth } from '../App';

declare var XLSX: any;

type Tab = 'dashboard' | 'students' | 'customData' | 'settings' | 'firebase';

// Helper component for stat cards
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <Card>
        <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">{icon}</div>
            <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
        </div>
    </Card>
);

// Helper for bar charts
const BarChart: React.FC<{ title: string; data: { label: string; value: number }[] }> = ({ title, data }) => {
    const maxValue = Math.max(...data.map(d => d.value), 0);
    return (
        <Card title={title}>
            <div className="space-y-2 h-64 overflow-y-auto pr-2">
                {data.length > 0 ? data.map(item => (
                    <div key={item.label} className="flex items-center">
                        <span className="w-1/3 text-sm text-gray-600 truncate">{item.label}</span>
                        <div className="w-2/3 bg-gray-200 rounded-full h-4">
                            <div
                                className="bg-blue-600 h-4 rounded-full text-xs text-white text-right pr-2 flex items-center justify-end"
                                style={{ width: maxValue > 0 ? `${(item.value / maxValue) * 100}%` : '0%' }}
                            >
                                {item.value}
                            </div>
                        </div>
                    </div>
                )) : <p className="text-sm text-gray-500 italic">Chưa có dữ liệu.</p>}
            </div>
        </Card>
    );
};

// Helper for Column charts
const ColumnChart: React.FC<{ title: string; data: { label: string; value: number }[] }> = ({ title, data }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1); // Avoid division by zero
    return (
        <Card>
            <div className="relative pl-4 pr-2 sm:pl-8 sm:pr-4 py-4">
                <h3 className="text-lg font-semibold text-gray-800 text-center mb-4">{title}</h3>
                <div className="h-64 flex items-end space-x-2 border-l border-b border-gray-300 p-2">
                    {data.length > 0 ? data.map((item, index) => (
                        <div key={index} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                            <div className="absolute bg-gray-700 text-white text-xs rounded py-1 px-2 -top-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                {item.value}
                            </div>
                            <div
                                className="w-3/4 sm:w-4/5 bg-blue-600 hover:bg-blue-700 rounded-t transition-colors"
                                style={{ height: `${(item.value / maxValue) * 100}%` }}
                            ></div>
                        </div>
                    )) : <p className="w-full text-center self-center text-gray-500">Chưa có dữ liệu cho khoảng thời gian này.</p>}
                </div>
                {/* X-axis labels */}
                {data.length > 0 && (
                    <div className="flex space-x-2 border-l border-transparent ml-2">
                         {data.map((item, index) => (
                            <div key={index} className="flex-1 text-center mt-1" style={{ minWidth: 0 }}>
                                <span className="text-xs text-gray-600 truncate">{item.label}</span>
                            </div>
                        ))}
                    </div>
                )}
                 {/* Y-axis label */}
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 transform -rotate-90">
                    <span className="text-sm text-gray-600">Số lượng học sinh</span>
                </div>
            </div>
        </Card>
    );
};


const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [students, setStudents] = useState<Student[]>([]);
    const [subjects, setSubjects] = useState<{ review: Subject[], exam: Subject[] }>({ review: [], exam: [] });
    const [isLocked, setIsLocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    // State for modals
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [studentForAction, setStudentForAction] = useState<Student | null>(null);
    const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
    const [isViewPasswordModalOpen, setIsViewPasswordModalOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [studentsData, lockStatus, subjectsData] = await Promise.all([
                api.getStudents(),
                api.getRegistrationStatus(),
                api.getSubjects(),
            ]);
            setStudents(studentsData);
            setIsLocked(lockStatus);
            setSubjects(subjectsData);
        } catch (error) {
            console.error("Failed to fetch admin data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleLock = async () => {
        setActionLoading(true);
        try {
            const newStatus = await api.setRegistrationStatus(!isLocked);
            setIsLocked(newStatus);
        } catch (error) {
            console.error("Failed to toggle lock status", error);
        } finally {
            setActionLoading(false);
        }
    };
    
    const handleExportToExcel = async () => {
        const allSubjectsMap = new Map([...subjects.review, ...subjects.exam].map(s => [s.id, s.name]));
        const customFields = await api.getCustomFormFields();

        const baseHeaders = ['Mã HS', 'Họ và tên', 'Lớp', 'Môn ôn tập', 'Môn thi TN', 'Thời gian ĐK'];
        const customHeaders = customFields.map(f => f.label);
        const allHeaders = [...baseHeaders, ...customHeaders];

        const dataToExport = students.map(s => {
            const baseData: { [key: string]: any } = {
                'Mã HS': s.ma_hocsinh,
                'Họ và tên': s.hoten,
                'Lớp': s.lop,
                'Môn ôn tập': s.reviewSubjects?.map(id => allSubjectsMap.get(id) || 'N/A').join(', ') || 'Chưa ĐK',
                'Môn thi TN': s.examSubjects?.map(id => allSubjectsMap.get(id) || 'N/A').join(', ') || 'Chưa ĐK',
                'Thời gian ĐK': s.registrationDate ? new Date(s.registrationDate).toLocaleString('vi-VN') : 'N/A',
            };
            
            const customData = customFields.reduce((acc, field) => {
                acc[field.label] = s.customData?.[field.id] || '';
                return acc;
            }, {} as Record<string, any>);
    
            return { ...baseData, ...customData };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: allHeaders });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'DanhSachDangKy');
        XLSX.writeFile(workbook, 'DanhSachDangKy_ChiTiet.xlsx');
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                const newStudents = json.map(row => ({
                    ma_hocsinh: String(row['ma_hocsinh'] || ''),
                    hoten: String(row['hoten'] || ''),
                    ngaysinh: String(row['ngaysinh'] || '2006-01-01'),
                    lop: String(row['lop'] || ''),
                    cccd: String(row['cccd'] || row['ma_hocsinh']) // Use student code as default pass if cccd is missing
                }));

                await api.addStudentsBatch(newStudents);
                fetchData(); // Refresh data
                alert(`${newStudents.length} học sinh đã được thêm thành công!`);

            } catch (error) {
                console.error("Error importing file:", error);
                alert("Đã có lỗi xảy ra khi nhập file. Vui lòng kiểm tra định dạng file (ma_hocsinh, hoten, ngaysinh, lop, cccd).");
            }
        };
        reader.readAsArrayBuffer(file);
        if(fileInputRef.current) fileInputRef.current.value = ''; // Reset input
    };
    
    // --- Student Management Functions ---
    const openAddStudentModal = () => {
        setEditingStudent(null);
        setIsStudentModalOpen(true);
    };

    const openEditStudentModal = (student: Student) => {
        setEditingStudent(student);
        setIsStudentModalOpen(true);
    };
    
    const openViewPasswordModal = (student: Student) => {
        setStudentForAction(student);
        setIsViewPasswordModalOpen(true);
    };

    const openResetPasswordModal = (student: Student) => {
        setStudentForAction(student);
        setIsResetPasswordModalOpen(true);
    };
    
    // --- Render logic ---
    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }
    
    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <AnalyticsTab students={students} subjects={subjects} />;
            case 'students': return <StudentManagementTab students={students} subjects={subjects} onAdd={openAddStudentModal} onEdit={openEditStudentModal} onViewPassword={openViewPasswordModal} onResetPassword={openResetPasswordModal} onImportClick={() => fileInputRef.current?.click()} refreshData={fetchData} />;
            case 'customData': return <CustomDataTab students={students} />;
            case 'settings': return <SettingsTab isLocked={isLocked} onToggleLock={handleToggleLock} actionLoading={actionLoading} subjects={subjects} onExport={handleExportToExcel} refreshData={fetchData}/>;
            case 'firebase': return <FirebaseConfigTab />;
            default: return null;
        }
    };

    const getTabName = (tab: Tab) => {
        switch (tab) {
            case 'dashboard': return 'Thống kê';
            case 'students': return 'Quản lý Học sinh';
            case 'customData': return 'Dữ liệu Bổ sung';
            case 'settings': return 'Cài đặt';
            case 'firebase': return 'Cấu hình Firebase';
            default: return '';
        }
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Trang quản trị</h1>
            
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {(['dashboard', 'students', 'customData', 'settings', 'firebase'] as Tab[]).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`${activeTab === tab ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                            {getTabName(tab)}
                        </button>
                    ))}
                </nav>
            </div>
            
            <div>{renderContent()}</div>

            {isStudentModalOpen && <StudentModal isOpen={isStudentModalOpen} onClose={() => setIsStudentModalOpen(false)} student={editingStudent} onSave={fetchData} />}
            {isViewPasswordModalOpen && studentForAction && <ViewPasswordModal isOpen={isViewPasswordModalOpen} onClose={() => setIsViewPasswordModalOpen(false)} student={studentForAction} />}
            {isResetPasswordModalOpen && studentForAction && <ResetPasswordModal isOpen={isResetPasswordModalOpen} onClose={() => setIsResetPasswordModalOpen(false)} student={studentForAction} onSuccess={fetchData} />}
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileImport} />
        </div>
    );
};

// Sub-components for tabs
const AnalyticsTab: React.FC<{ students: Student[], subjects: { review: Subject[], exam: Subject[] } }> = ({ students, subjects }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const completedRegistrations = students.filter(s => s.reviewSubjects?.length === 2 && s.examSubjects?.length === 2).length;
    
    // --- Subject Stats ---
    const reviewSubjectsMap = useMemo(() => new Map(subjects.review.map(s => [s.id, s.name])), [subjects.review]);
    const examSubjectsMap = useMemo(() => new Map(subjects.exam.map(s => [s.id, s.name])), [subjects.exam]);
    
    // Fix: Correctly type the `reduce` accumulator to resolve type errors.
    const registrationsByReviewSubject = useMemo(() => {
        const stats = students.reduce((acc, student) => {
            (student.reviewSubjects || []).forEach(subId => {
                const subName = reviewSubjectsMap.get(subId);
                if (subName) acc[subName] = (acc[subName] || 0) + 1;
            });
            return acc;
        }, {} as Record<string, number>);
        // FIX: Reordered map and sort and used tuple destructuring to resolve type errors in the sort comparison.
        return Object.entries(stats)
            // Fix: Explicitly cast values to numbers before subtraction to avoid type errors.
            .sort(([, aValue], [, bValue]) => Number(bValue) - Number(aValue))
            .map(([label, value]) => ({ label, value }));
    }, [students, reviewSubjectsMap]);

    // Fix: Correctly type the `reduce` accumulator to resolve type errors.
     const registrationsByExamSubject = useMemo(() => {
        const stats = students.reduce((acc, student) => {
            (student.examSubjects || []).forEach(subId => {
                const subName = examSubjectsMap.get(subId);
                if (subName) acc[subName] = (acc[subName] || 0) + 1;
            });
            return acc;
        }, {} as Record<string, number>);
        // FIX: Reordered map and sort and used tuple destructuring to resolve type errors in the sort comparison.
        return Object.entries(stats)
            // Fix: Explicitly cast values to numbers before subtraction to avoid type errors.
            .sort(([, aValue], [, bValue]) => Number(bValue) - Number(aValue))
            .map(([label, value]) => ({ label, value }));
    }, [students, examSubjectsMap]);

    // --- Time-based Stats ---
    const registrationsByDate = useMemo(() => {
         const filteredStudents = students.filter(s => {
            if (!s.registrationDate) return false;
            if (s.reviewSubjects?.length !== 2 || s.examSubjects?.length !== 2) return false; // Only count completed
            
            const regDate = new Date(s.registrationDate);
            if (startDate && regDate < new Date(new Date(startDate).setHours(0,0,0,0))) return false;
            if (endDate && regDate > new Date(new Date(endDate).setHours(23,59,59,999))) return false;
            
            return true;
         });

        const stats = filteredStudents.reduce((acc, student) => {
            if (student.registrationDate) {
                const date = new Date(student.registrationDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                acc[date] = (acc[date] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        // Sort by date
        return Object.entries(stats).sort(([dateA], [dateB]) => {
            const [dayA, monthA] = dateA.split('/');
            const [dayB, monthB] = dateB.split('/');
            // Assuming current year for sorting, this might need adjustment for multi-year data
            // FIX: Explicitly create Date objects with numeric parts to satisfy TypeScript's type checker for arithmetic operations.
            const dateObjA = new Date(2024, Number(monthA) - 1, Number(dayA));
            const dateObjB = new Date(2024, Number(monthB) - 1, Number(dayB));
            return dateObjA.getTime() - dateObjB.getTime();
        }).map(([label, value]) => ({ label, value }));
    }, [students, startDate, endDate]);

    const setDateRange = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days + 1);
        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Tổng số học sinh" value={students.length} icon={<UsersIcon className="h-6 w-6 text-blue-600"/>} />
                <StatCard title="HS đã hoàn thành ĐK" value={completedRegistrations} icon={<UsersIcon className="h-6 w-6 text-green-600"/>} />
                <StatCard title="HS chưa hoàn thành ĐK" value={students.length - completedRegistrations} icon={<UsersIcon className="h-6 w-6 text-red-600"/>} />
            </div>

            <div>
                 <div className="flex flex-wrap items-center gap-4 mb-4 p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                        <label htmlFor="startDate" className="text-sm">Từ:</label>
                        <Input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                     <div className="flex items-center gap-2">
                        <label htmlFor="endDate" className="text-sm">Đến:</label>
                        <Input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                       <Button variant="secondary" onClick={() => setDateRange(7)}>7 ngày qua</Button>
                       <Button variant="secondary" onClick={() => setDateRange(30)}>30 ngày qua</Button>
                        <Button variant="secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>Reset</Button>
                    </div>
                </div>
                <ColumnChart title="Số lượng học sinh hoàn thành đăng ký theo ngày" data={registrationsByDate} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BarChart title="Thống kê đăng ký theo Môn Ôn tập" data={registrationsByReviewSubject} />
                <BarChart title="Thống kê đăng ký theo Môn Thi TN" data={registrationsByExamSubject} />
            </div>
        </div>
    );
};

const Pagination: React.FC<{ currentPage: number; totalPages: number; onPageChange: (page: number) => void; }> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    return (
        <div className="flex justify-between items-center mt-4">
            <Button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                variant="secondary"
            >
                Trang trước
            </Button>
            <span className="text-sm text-gray-700">
                Trang {currentPage} trên {totalPages}
            </span>
            <Button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                variant="secondary"
            >
                Trang sau
            </Button>
        </div>
    );
};

const StudentManagementTab: React.FC<{ students: Student[], subjects: { review: Subject[], exam: Subject[] }, onAdd: () => void, onEdit: (s: Student) => void, onViewPassword: (s: Student) => void, onResetPassword: (s: Student) => void, onImportClick: () => void, refreshData: () => void }> = 
({ students, subjects, onAdd, onEdit, onViewPassword, onResetPassword, onImportClick, refreshData }) => {
    const { impersonate } = useAuth();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'completed', 'incomplete'
    const STUDENTS_PER_PAGE = 50;

    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
    
    const allSubjectsMap = useMemo(() => new Map([...subjects.review, ...subjects.exam].map(s => [s.id, s.name])), [subjects]);
    const uniqueClasses = useMemo(() => [...new Set(students.map(s => s.lop))].sort(), [students]);

    const filteredStudents = useMemo(() => {
        return students.filter(student => {
            const searchMatch = student.hoten.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                student.ma_hocsinh.toLowerCase().includes(searchTerm.toLowerCase());
            const classMatch = !filterClass || student.lop === filterClass;
            const statusMatch = filterStatus === 'all' || 
                                (filterStatus === 'completed' && student.reviewSubjects?.length === 2 && student.examSubjects?.length === 2) ||
                                (filterStatus === 'incomplete' && (student.reviewSubjects?.length !== 2 || student.examSubjects?.length !== 2));
            return searchMatch && classMatch && statusMatch;
        });
    }, [students, searchTerm, filterClass, filterStatus]);
    
    const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
    const currentStudents = filteredStudents.slice((currentPage - 1) * STUDENTS_PER_PAGE, currentPage * STUDENTS_PER_PAGE);

    // Reset selection and page when filters change
    useEffect(() => {
      setCurrentPage(1);
      setSelectedStudentIds(new Set());
    }, [searchTerm, filterClass, filterStatus, students]);


    const handleSelectOne = (studentId: number) => {
        setSelectedStudentIds(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(studentId)) {
                newSelection.delete(studentId);
            } else {
                newSelection.add(studentId);
            }
            return newSelection;
        });
    };

    const handleSelectAllOnPage = () => {
        const allOnPageIds = currentStudents.map(s => s.id);
        const allOnPageSelected = allOnPageIds.every(id => selectedStudentIds.has(id));

        if (allOnPageSelected) {
            setSelectedStudentIds(prev => {
                const newSelection = new Set(prev);
                allOnPageIds.forEach(id => newSelection.delete(id));
                return newSelection;
            });
        } else {
            setSelectedStudentIds(prev => new Set([...prev, ...allOnPageIds]));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedStudentIds.size === 0) {
            alert("Vui lòng chọn ít nhất một học sinh để xóa.");
            return;
        }
        if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedStudentIds.size} học sinh đã chọn? Hành động này không thể hoàn tác.`)) {
            try {
                await api.deleteStudentsBatch(Array.from(selectedStudentIds));
                alert(`${selectedStudentIds.size} học sinh đã được xóa thành công.`);
                setSelectedStudentIds(new Set());
                refreshData();
            } catch (error) {
                console.error("Lỗi khi xóa học sinh đã chọn:", error);
                alert("Đã xảy ra lỗi khi xóa học sinh. Vui lòng thử lại.");
            }
        }
    };

    const handleDeleteAll = async () => {
        if (students.length === 0) {
            alert("Không có học sinh nào để xóa.");
            return;
        }
        const confirmationText = 'XÓA TẤT CẢ';
        const userInput = window.prompt(`Đây là hành động không thể hoàn tác. Để xác nhận xóa TOÀN BỘ ${students.length} học sinh, vui lòng nhập chính xác cụm từ sau: "${confirmationText}"`);
        
        if (userInput === confirmationText) {
            try {
                await api.deleteAllStudents();
                alert(`Đã xóa toàn bộ ${students.length} học sinh.`);
                refreshData();
            } catch (error) {
                console.error("Lỗi khi xóa tất cả học sinh:", error);
                alert("Đã xảy ra lỗi khi xóa tất cả học sinh. Vui lòng thử lại.");
            }
        } else if (userInput !== null) { // User typed something, but it was wrong
            alert('Chuỗi xác nhận không chính xác. Hành động đã được hủy.');
        }
        // If userInput is null (Cancel button), do nothing.
    };

    const handleDownloadTemplate = () => {
        const headers = [['ma_hocsinh', 'hoten', 'ngaysinh', 'lop', 'cccd']];
        const exampleData = [['HS2025999', 'Nguyen Van Z', '2006-12-25', '12A9', '012345678912']];
        const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...exampleData]);
        worksheet['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 20 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'MauNhapLieu');
        XLSX.writeFile(workbook, 'MauNhapHocSinh.xlsx');
    };

    return (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                 <h2 className="text-xl font-bold whitespace-nowrap">Danh sách học sinh ({filteredStudents.length})</h2>
                <div className="flex flex-col sm:flex-row flex-wrap justify-end gap-2 w-full sm:w-auto">
                    <Button onClick={handleDownloadTemplate} variant="secondary">Tải mẫu Excel</Button>
                    <Button onClick={onImportClick} variant="secondary">Nhập từ Excel</Button>
                    <Button onClick={onAdd}>Thêm học sinh</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                <Input placeholder="Tìm kiếm theo tên hoặc mã HS..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-700 focus:border-blue-700 sm:text-sm">
                    <option value="">Tất cả các lớp</option>
                    {uniqueClasses.map(lop => <option key={lop} value={lop}>{lop}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-700 focus:border-blue-700 sm:text-sm">
                    <option value="all">Tất cả trạng thái</option>
                    <option value="completed">Đã hoàn thành</option>
                    <option value="incomplete">Chưa hoàn thành</option>
                </select>
            </div>
            
            <div className="flex justify-between items-center mb-4 px-1">
                <p className="text-sm text-gray-600">{selectedStudentIds.size} học sinh đã được chọn.</p>
                 <div className="flex gap-2">
                    <Button variant="danger" onClick={handleDeleteSelected} disabled={selectedStudentIds.size === 0}>Xóa học sinh đã chọn</Button>
                    <Button variant="danger" onClick={handleDeleteAll}>Xóa tất cả học sinh</Button>
                </div>
            </div>

            <Table headers={['', 'Mã HS', 'Họ tên', 'Lớp', 'Môn ôn tập', 'Môn thi TN', 'Trạng thái ĐK', 'Hành động']}>
                <thead>
                     <tr className="bg-gray-50">
                        <th className="px-6 py-3">
                            <input type="checkbox" className="rounded" onChange={handleSelectAllOnPage} checked={currentStudents.length > 0 && currentStudents.every(s => selectedStudentIds.has(s.id))} />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã HS</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ tên</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lớp</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Môn ôn tập</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Môn thi TN</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái ĐK</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    {currentStudents.map(student => (
                        <tr key={student.id} className={selectedStudentIds.has(student.id) ? 'bg-blue-50' : ''}>
                             <td className="px-6 py-4">
                                <input type="checkbox" className="rounded" checked={selectedStudentIds.has(student.id)} onChange={() => handleSelectOne(student.id)} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.ma_hocsinh}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{student.hoten}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.lop}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{student.reviewSubjects?.map(id => allSubjectsMap.get(id) || '?').join(', ') || <i className="text-gray-400">Chưa ĐK</i>}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{student.examSubjects?.map(id => allSubjectsMap.get(id) || '?').join(', ') || <i className="text-gray-400">Chưa ĐK</i>}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {(student.reviewSubjects?.length === 2 && student.examSubjects?.length === 2)
                                    ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Hoàn thành</span>
                                    : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Chưa xong</span>
                                }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                <button onClick={() => onEdit(student)} className="text-blue-700 hover:text-blue-900" title="Sửa thông tin">Sửa</button>
                                <button onClick={() => onViewPassword(student)} className="text-green-600 hover:text-green-900" title="Xem mật khẩu">Xem Pass</button>
                                <button onClick={() => onResetPassword(student)} className="text-yellow-600 hover:text-yellow-900" title="Reset mật khẩu">Reset Pass</button>
                                <button onClick={() => impersonate(student)} className="text-purple-600 hover:text-purple-900" title="Đăng nhập với tư cách học sinh này">Đăng nhập</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>
            {filteredStudents.length === 0 && <p className="text-center p-4 text-gray-500">Không tìm thấy học sinh nào khớp với bộ lọc.</p>}
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => setCurrentPage(p)} />
        </Card>
    );
};

const CustomDataTab: React.FC<{ students: Student[] }> = ({ students }) => {
    const [fields, setFields] = useState<CustomField[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getCustomFormFields().then(setFields).finally(() => setLoading(false));
    }, []);

    const handleExportCustomData = () => {
        const headers = ['Mã HS', 'Họ và tên', 'Lớp', ...fields.map(f => f.label)];
        
        const dataToExport = students.map(s => {
            const studentRow: Record<string, any> = {
                'Mã HS': s.ma_hocsinh,
                'Họ và tên': s.hoten,
                'Lớp': s.lop,
            };
            fields.forEach(field => {
                studentRow[field.label] = s.customData?.[field.id] ?? '';
            });
            return studentRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'DuLieuBoSung');
        XLSX.writeFile(workbook, 'DuLieuBoSung.xlsx');
    };

    if (loading) return <Card><div className="flex justify-center p-8"><Spinner /></div></Card>;

    if (fields.length === 0) {
        return (
            <Card title="Dữ liệu Bổ sung">
                <p className="text-center text-gray-500">
                    Chưa có trường thông tin bổ sung nào được cấu hình trong tab Cài đặt.
                </p>
            </Card>
        )
    }
    
    const tableHeaders = ['Mã HS', 'Họ tên', 'Lớp', ...fields.map(f => f.label)];

    return (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h2 className="text-xl font-bold">Dữ liệu Bổ sung</h2>
                <Button onClick={handleExportCustomData} variant="secondary">Xuất ra Excel</Button>
            </div>
            <Table headers={tableHeaders}>
                {students.map(student => (
                    <tr key={student.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.ma_hocsinh}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{student.hoten}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.lop}</td>
                        {fields.map(field => (
                            <td key={field.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {student.customData?.[field.id] ?? <i className="text-gray-400">Trống</i>}
                            </td>
                        ))}
                    </tr>
                ))}
            </Table>
            {students.length === 0 && <p className="text-center p-4 text-gray-500">Chưa có học sinh nào.</p>}
        </Card>
    );
};

const RegistrationDisplayManager: React.FC = () => {
    const [settings, setSettings] = useState({
        showReviewSubjects: true,
        showExamSubjects: true,
        showCustomFields: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.getRegistrationSettings()
            .then(setSettings)
            .finally(() => setLoading(false));
    }, []);

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateRegistrationSettings(settings);
            alert('Đã lưu cài đặt hiển thị!');
        } catch (error) {
            alert('Lỗi! Không thể lưu cài đặt.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Card title="Cài đặt Hiển thị Form"><div className="flex justify-center p-4"><Spinner /></div></Card>;
    }

    return (
        <Card title="Cài đặt Hiển thị Form">
            <div className="space-y-4">
                <p className="text-sm text-gray-500">Chọn các phần học sinh sẽ thấy trên phiếu đăng ký.</p>
                
                <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                        <span className="font-medium text-gray-700">Hiển thị mục "Môn ôn tập"</span>
                        <input 
                            type="checkbox" 
                            className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={settings.showReviewSubjects}
                            onChange={() => handleToggle('showReviewSubjects')} 
                        />
                    </label>
                     <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                        <span className="font-medium text-gray-700">Hiển thị mục "Môn thi Tốt nghiệp"</span>
                        <input 
                            type="checkbox" 
                            className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={settings.showExamSubjects}
                            onChange={() => handleToggle('showExamSubjects')} 
                        />
                    </label>
                     <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                        <span className="font-medium text-gray-700">Hiển thị mục "Thông tin bổ sung"</span>
                        <input 
                            type="checkbox" 
                            className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={settings.showCustomFields}
                            onChange={() => handleToggle('showCustomFields')} 
                        />
                    </label>
                </div>
                
                <Button onClick={handleSave} disabled={saving} className="w-full flex justify-center mt-2">
                    {saving ? <Spinner size="sm" /> : 'Lưu Cài đặt Hiển thị'}
                </Button>
            </div>
        </Card>
    );
};

const SettingsTab: React.FC<{ isLocked: boolean, onToggleLock: () => void, actionLoading: boolean, subjects: {review: Subject[], exam: Subject[]}, onExport: () => void, refreshData: () => void }> = 
({ isLocked, onToggleLock, actionLoading, subjects, onExport, refreshData }) => {
    const [deadline, setDeadline] = useState('');
    const [deadlineLoading, setDeadlineLoading] = useState(true);

    useEffect(() => {
        api.getRegistrationDeadline().then(data => {
            if (data) setDeadline(data.slice(0, 16));
            setDeadlineLoading(false);
        });
    }, []);

    const handleSaveDeadline = async () => {
        if (!deadline) return;
        setDeadlineLoading(true);
        try {
            await api.setRegistrationDeadline(new Date(deadline).toISOString());
            alert('Đã lưu hạn chót đăng ký!');
            refreshData();
        } catch (error) {
            alert('Lỗi khi lưu hạn chót.');
        } finally {
            setDeadlineLoading(false);
        }
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
                <Card title="Quản lý Đăng ký">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h4 className="font-semibold">Trạng thái đăng ký</h4>
                            <p>Trạng thái hiện tại: <span className={`font-semibold ${isLocked ? 'text-red-600' : 'text-green-600'}`}>{isLocked ? 'Đã Khoá' : 'Đang Mở'}</span></p>
                            <p className="text-sm text-gray-500">Hệ thống sẽ tự động khoá khi hết hạn chót hoặc khi bạn khoá thủ công.</p>
                            <Button variant={isLocked ? 'primary' : 'danger'} onClick={onToggleLock} disabled={actionLoading} className="w-full flex justify-center items-center">
                                {actionLoading ? <Spinner size="sm"/> : (isLocked ? 'Mở lại Đăng ký (Thủ công)' : 'Khoá Đăng ký (Thủ công)')}
                            </Button>
                        </div>
                        <div className="border-t pt-4 space-y-2">
                            <h4 className="font-semibold">Thiết lập Hạn chót Đăng ký</h4>
                            <Input label="Hạn chót" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={deadlineLoading} />
                            <Button onClick={handleSaveDeadline} disabled={deadlineLoading} className="w-full flex justify-center items-center">
                                {deadlineLoading ? <Spinner size="sm"/> : 'Lưu Hạn chót'}
                            </Button>
                        </div>
                        <div className="border-t pt-4">
                            <Button variant="secondary" onClick={onExport} className="w-full">Xuất danh sách đầy đủ ra Excel</Button>
                        </div>
                    </div>
                </Card>
                <RegistrationDisplayManager />
                <SubjectManager initialSubjects={subjects} onSave={refreshData} />
            </div>
             <CustomFormManager />
        </div>
    );
};

const FirebaseConfigTab: React.FC = () => {
    const [config, setConfig] = useState({
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
    });
    const [status, setStatus] = useState<'unconfigured' | 'configured' | 'error'>('unconfigured');
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationMessage, setMigrationMessage] = useState('');

    useEffect(() => {
        const savedConfig = localStorage.getItem('firebaseConfig');
        if (savedConfig) {
            try {
                const parsedConfig = JSON.parse(savedConfig);
                setConfig(parsedConfig);
                setStatus('configured');
            } catch {
                setStatus('error');
            }
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleSaveConfig = () => {
        if (Object.values(config).some(v => !v)) {
            alert('Vui lòng điền đầy đủ tất cả các trường cấu hình.');
            return;
        }
        localStorage.setItem('firebaseConfig', JSON.stringify(config));
        setStatus('configured');
        alert('Đã lưu cấu hình Firebase! Vui lòng tải lại trang để áp dụng.');
    };

    const handleClearConfig = () => {
        if (window.confirm('Bạn có chắc muốn xóa cấu hình Firebase? Hệ thống sẽ quay lại dùng dữ liệu cục bộ.')) {
            localStorage.removeItem('firebaseConfig');
            setConfig({ apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' });
            setStatus('unconfigured');
            alert('Đã xóa cấu hình. Vui lòng tải lại trang.');
        }
    };
    
    const handleMigrateData = async () => {
        if (!window.confirm('Hành động này sẽ di chuyển toàn bộ dữ liệu hiện tại (học sinh, môn học, cài đặt...) từ hệ thống tạm sang Firebase. Dữ liệu trên Firebase (nếu có) có thể bị ghi đè. Bạn có chắc chắn muốn tiếp tục?')) {
            return;
        }
        setIsMigrating(true);
        setMigrationMessage('Bắt đầu quá trình di chuyển...');
        try {
            await api.migrateToFirebase((message) => setMigrationMessage(message));
            setMigrationMessage('Di chuyển dữ liệu thành công! Tất cả học sinh và cài đặt đã có trên Firebase.');
        } catch (error: any) {
            setMigrationMessage(`Lỗi: ${error.message}. Vui lòng kiểm tra lại cấu hình và console log.`);
            console.error(error);
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card title="Cấu hình Kết nối Firebase">
                <div className="space-y-4">
                    {status === 'configured' && (
                        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
                            <p className="font-bold">Đã cấu hình</p>
                            <p>Ứng dụng hiện đang kết nối với Firebase. Mọi thay đổi sẽ được lưu trên cloud.</p>
                        </div>
                    )}
                     {status === 'unconfigured' && (
                        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
                            <p className="font-bold">Chưa cấu hình</p>
                            <p>Ứng dụng đang dùng dữ liệu tạm (localStorage). Dữ liệu sẽ mất nếu bạn xóa cache trình duyệt.</p>
                        </div>
                    )}
                    <p className="text-sm text-gray-600">
                        Nhập thông tin cấu hình từ dự án Firebase của bạn để kết nối với cơ sở dữ liệu thật.
                    </p>
                    <Input label="API Key" name="apiKey" value={config.apiKey} onChange={handleInputChange} />
                    <Input label="Auth Domain" name="authDomain" value={config.authDomain} onChange={handleInputChange} />
                    <Input label="Project ID" name="projectId" value={config.projectId} onChange={handleInputChange} />
                    <Input label="Storage Bucket" name="storageBucket" value={config.storageBucket} onChange={handleInputChange} />
                    <Input label="Messaging Sender ID" name="messagingSenderId" value={config.messagingSenderId} onChange={handleInputChange} />
                    <Input label="App ID" name="appId" value={config.appId} onChange={handleInputChange} />
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button onClick={handleSaveConfig} className="flex-1">Lưu Cấu hình</Button>
                        <Button onClick={handleClearConfig} variant="danger" className="flex-1">Xóa Cấu hình</Button>
                    </div>
                </div>
            </Card>

             <Card title="Di chuyển Dữ liệu (Migration)">
                <div className="space-y-4">
                     <p className="text-sm text-gray-600">
                        Sử dụng chức năng này để chuyển dữ liệu từ hệ thống tạm (localStorage) sang Firebase.
                        <br />
                        <strong>Lưu ý:</strong> Chỉ thực hiện khi bạn đã cấu hình Firebase và muốn bắt đầu sử dụng chính thức.
                    </p>
                    <Button onClick={handleMigrateData} disabled={status !== 'configured' || isMigrating} className="w-full flex justify-center">
                        {isMigrating ? <Spinner size="sm" /> : 'Di chuyển dữ liệu sang Firebase'}
                    </Button>
                    {migrationMessage && (
                        <div className={`p-3 rounded-md text-sm ${migrationMessage.startsWith('Lỗi') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                            {migrationMessage}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

// Modal for adding/editing a student
const StudentModal: React.FC<{ isOpen: boolean; onClose: () => void; student: Student | null; onSave: () => void; }> = ({ isOpen, onClose, student, onSave }) => {
    const [formData, setFormData] = useState({
        ma_hocsinh: student?.ma_hocsinh || '',
        hoten: student?.hoten || '',
        lop: student?.lop || '',
        ngaysinh: student?.ngaysinh || '',
        cccd: student?.cccd || '', // Used for initial password
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (student) {
                await api.updateStudent(student.id, formData);
            } else {
                await api.addStudent(formData);
            }
            onSave();
            onClose();
        } catch (error) {
            console.error("Failed to save student", error);
            alert("Lưu thất bại!");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={student ? 'Chỉnh sửa thông tin học sinh' : 'Thêm học sinh mới'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Mã học sinh" name="ma_hocsinh" value={formData.ma_hocsinh} onChange={handleChange} required />
                <Input label="Họ và tên" name="hoten" value={formData.hoten} onChange={handleChange} required />
                <Input label="Lớp" name="lop" value={formData.lop} onChange={handleChange} required />
                <Input label="Ngày sinh" name="ngaysinh" type="date" value={formData.ngaysinh} onChange={handleChange} required />
                {!student && <Input label="CCCD (Mật khẩu mặc định)" name="cccd" value={formData.cccd} onChange={handleChange} required />}
                <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
                    <Button type="submit" disabled={isLoading}>{isLoading ? <Spinner size="sm"/> : 'Lưu'}</Button>
                </div>
            </form>
        </Modal>
    );
};

const SubjectManager: React.FC<{ initialSubjects: { review: Subject[], exam: Subject[] }, onSave: () => void }> = ({ initialSubjects, onSave }) => {
    const [reviewSubjects, setReviewSubjects] = useState<Subject[]>(initialSubjects.review);
    const [examSubjects, setExamSubjects] = useState<Subject[]>(initialSubjects.exam);
    const [newReviewSub, setNewReviewSub] = useState('');
    const [newExamSub, setNewExamSub] = useState('');

    const handleAddSubject = (type: 'review' | 'exam') => {
        const name = type === 'review' ? newReviewSub.trim() : newExamSub.trim();
        if (!name) return;
        const newSubject = { id: Date.now(), name };
        if (type === 'review') setReviewSubjects([...reviewSubjects, newSubject]); else setExamSubjects([...examSubjects, newSubject]);
        if (type === 'review') setNewReviewSub(''); else setNewExamSub('');
    };

    const handleDeleteSubject = (type: 'review' | 'exam', id: number) => {
        if (type === 'review') setReviewSubjects(reviewSubjects.filter(s => s.id !== id)); else setExamSubjects(examSubjects.filter(s => s.id !== id));
    };

    const handleSaveSubjects = async () => {
        await api.updateSubjects({ review: reviewSubjects, exam: examSubjects });
        onSave();
        alert('Đã lưu thay đổi môn học!');
    };
    
    return (
        <Card title="Quản lý Môn học">
            <div className="space-y-4">
                <div>
                    <h4 className="font-semibold">Môn Ôn tập</h4>
                    <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                        {reviewSubjects.map(s => (
                            <div key={s.id} className="flex justify-between items-center bg-gray-50 p-2 rounded"><span>{s.name}</span><button onClick={() => handleDeleteSubject('review', s.id)} className="text-red-500 hover:text-red-700"><TrashIcon /></button></div>
                        ))}
                    </div>
                    <div className="flex mt-2 space-x-2"><Input value={newReviewSub} onChange={e => setNewReviewSub(e.target.value)} placeholder="Tên môn học mới" /><Button onClick={() => handleAddSubject('review')}><PlusIcon /></Button></div>
                </div>
                <div>
                    <h4 className="font-semibold">Môn Thi Tốt nghiệp (Tự chọn)</h4>
                     <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                        {examSubjects.map(s => (
                            <div key={s.id} className="flex justify-between items-center bg-gray-50 p-2 rounded"><span>{s.name}</span><button onClick={() => handleDeleteSubject('exam', s.id)} className="text-red-500 hover:text-red-700"><TrashIcon /></button></div>
                        ))}
                    </div>
                    <div className="flex mt-2 space-x-2"><Input value={newExamSub} onChange={e => setNewExamSub(e.target.value)} placeholder="Tên môn học mới" /><Button onClick={() => handleAddSubject('exam')}><PlusIcon /></Button></div>
                </div>
                <Button onClick={handleSaveSubjects} className="w-full">Lưu thay đổi Môn học</Button>
            </div>
        </Card>
    );
};

const ViewPasswordModal: React.FC<{ isOpen: boolean, onClose: () => void, student: Student }> = ({ isOpen, onClose, student }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            api.getStudentPassword(student.id)
                .then(setPassword)
                .catch(() => setPassword('Không thể lấy mật khẩu.'))
                .finally(() => setLoading(false));
        }
    }, [isOpen, student.id]);
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Mật khẩu của ${student.hoten}`}>
            <div className="text-center p-4">
                {loading ? <Spinner /> : <p className="text-2xl font-mono bg-gray-100 p-3 rounded">{password}</p>}
            </div>
        </Modal>
    );
};

const ResetPasswordModal: React.FC<{ isOpen: boolean, onClose: () => void, student: Student, onSuccess: () => void }> = ({ isOpen, onClose, student, onSuccess }) => {
    const [customPassword, setCustomPassword] = useState('');
    const [loading, setLoading] = useState<'default' | 'custom' | null>(null);

    const handleReset = async (isCustom = false) => {
        if (isCustom && customPassword.length < 6) {
            alert('Mật khẩu tùy chỉnh phải có ít nhất 6 ký tự.');
            return;
        }
        setLoading(isCustom ? 'custom' : 'default');
        try {
            await api.resetStudentPassword(student.id, isCustom ? customPassword : undefined);
            alert('Đặt lại mật khẩu thành công!');
            onSuccess();
            onClose();
        } catch (e) {
            alert('Lỗi! Không thể đặt lại mật khẩu.');
        } finally {
            setLoading(null);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Reset mật khẩu cho ${student.hoten}`}>
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold">Reset về mặc định</h3>
                    <p className="text-sm text-gray-600">Mật khẩu sẽ được đặt lại thành mã học sinh: <strong>{student.ma_hocsinh}</strong>.</p>
                    <Button variant="secondary" onClick={() => handleReset(false)} disabled={!!loading} className="w-full mt-2 flex justify-center">{loading === 'default' ? <Spinner size="sm"/> : 'Reset về mặc định'}</Button>
                </div>
                <div className="border-t pt-4">
                    <h3 className="font-semibold">Đặt mật khẩu tùy chỉnh</h3>
                    <Input type="text" placeholder="Nhập mật khẩu mới..." value={customPassword} onChange={e => setCustomPassword(e.target.value)} />
                    <Button onClick={() => handleReset(true)} disabled={!!loading || !customPassword} className="w-full mt-2 flex justify-center">{loading === 'custom' ? <Spinner size="sm"/> : 'Đặt mật khẩu mới'}</Button>
                </div>
            </div>
        </Modal>
    );
};

const CustomFormManager: React.FC = () => {
    const [fields, setFields] = useState<CustomField[]>([]);
    const [newField, setNewField] = useState({ label: '', type: 'text' as CustomField['type'], required: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getCustomFormFields().then(setFields).finally(() => setLoading(false));
    }, []);

    const handleAddField = () => {
        if (!newField.label.trim()) return;
        const field: CustomField = { ...newField, id: Date.now().toString(), label: newField.label.trim() };
        setFields([...fields, field]);
        setNewField({ label: '', type: 'text', required: false });
    };

    const handleDeleteField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
    };
    
    const handleSave = async () => {
        await api.updateCustomFormFields(fields);
        alert('Đã lưu cấu hình form!');
    };

    if (loading) return <Card title="Quản lý Thông tin Tùy chỉnh"><Spinner /></Card>;

    return (
        <Card title="Quản lý Thông tin Tùy chỉnh">
            <div className="space-y-4">
                <p className="text-sm text-gray-500">Tạo các trường thông tin để thu thập thêm dữ liệu từ học sinh khi họ đăng ký.</p>
                <div className="space-y-2 max-h-60 overflow-y-auto border p-2 rounded">
                    {fields.length > 0 ? fields.map(f => (
                        <div key={f.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <div>
                                <span className="font-semibold">{f.label}</span>
                                <span className="text-xs text-gray-500 ml-2 capitalize bg-gray-200 px-2 py-0.5 rounded-full">{f.type}</span>
                                {f.required && <span className="text-xs text-red-500 ml-2">Bắt buộc</span>}
                            </div>
                            <button onClick={() => handleDeleteField(f.id)} className="text-red-500 hover:text-red-700"><TrashIcon /></button>
                        </div>
                    )) : <p className="text-sm text-center text-gray-400">Chưa có trường tùy chỉnh nào.</p>}
                </div>
                <div className="border-t pt-4 space-y-2">
                    <h4 className="font-semibold">Thêm trường mới</h4>
                    <Input placeholder="Tên trường (ví dụ: SĐT Phụ huynh)" value={newField.label} onChange={e => setNewField({...newField, label: e.target.value})} />
                    <div className="flex items-center gap-4">
                        <select value={newField.type} onChange={e => setNewField({...newField, type: e.target.value as CustomField['type']})} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                            <option value="text">Chữ (Text)</option>
                            <option value="number">Số (Number)</option>
                            <option value="date">Ngày (Date)</option>
                        </select>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={newField.required} onChange={e => setNewField({...newField, required: e.target.checked})} /> Bắt buộc</label>
                    </div>
                    <Button onClick={handleAddField} variant="secondary" className="w-full">Thêm vào danh sách</Button>
                </div>
                <Button onClick={handleSave} className="w-full">Lưu Cấu hình Form</Button>
            </div>
        </Card>
    );
}

export default AdminDashboard;