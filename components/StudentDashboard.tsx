import React, { useState, useEffect, useCallback } from 'react';
import { User, Student, Subject, CustomField } from '../types';
import { api } from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { Input } from './ui/Input';

interface StudentDashboardProps {
  user: User;
}

const CountdownTimer: React.FC<{ deadline: string | null }> = ({ deadline }) => {
    const calculateTimeLeft = () => {
        if (!deadline) return null;
        const difference = +new Date(deadline) - +new Date();
        let timeLeft: { [key: string]: number } = {};

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        }
        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        if (!deadline) return;

        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearTimeout(timer);
    });

    if (!timeLeft || Object.keys(timeLeft).length === 0) {
        return (
             <Card className="mb-6 bg-red-100 border-red-200">
                <div className="text-center">
                    <h3 className="text-xl font-bold text-red-700">Đã hết thời gian đăng ký!</h3>
                </div>
            </Card>
        );
    }

    return (
        <Card className="mb-6 bg-blue-50 border-blue-200">
            <div className="text-center">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">Thời gian đăng ký còn lại</h3>
                <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
                    {Object.entries(timeLeft).map(([unit, value]) => (
                        <div key={unit} className="flex flex-col items-center p-2 rounded-lg min-w-[60px]">
                            <span className="text-3xl font-bold text-blue-700">{String(value).padStart(2, '0')}</span>
                            <span className="text-xs uppercase text-gray-500">{unit}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
};


const SubjectSelector: React.FC<{
    title: string;
    subjects: Subject[];
    selected: number[];
    onChange: (subjectId: number) => void;
    limit: number;
    disabled: boolean;
    customMessage?: string;
    action?: React.ReactNode;
}> = ({ title, subjects, selected, onChange, limit, disabled, customMessage, action }) => {
    const isSelectionDisabled = selected.length >= limit || disabled;

    return (
        <Card title={title}>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <p className="text-sm text-gray-600">{customMessage || `Vui lòng chọn ${limit} môn. Bạn đã chọn ${selected.length}/${limit}.`}</p>
                {action}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {subjects.map(subject => {
                    const isSelected = selected.includes(subject.id);
                    return (
                        <div key={subject.id}>
                            <label 
                                className={`block p-4 border rounded-lg transition-all duration-200 ${
                                    disabled 
                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-75'
                                    : isSelected 
                                        ? 'bg-blue-100 border-blue-600 ring-2 ring-blue-600 cursor-pointer' 
                                        : isSelectionDisabled 
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                                        : 'bg-white hover:border-blue-500 border-gray-300 cursor-pointer'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={isSelected}
                                    disabled={(!isSelected && isSelectionDisabled) || disabled}
                                    onChange={() => onChange(subject.id)}
                                />
                                <span className="font-semibold text-center block">{subject.name}</span>
                            </label>
                        </div>
                    );
                })}
            </div>
             {subjects.length === 0 && <p className="text-sm text-center text-gray-500 mt-4">Chưa có môn học nào được cấu hình.</p>}
        </Card>
    );
};


const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [reviewSubjects, setReviewSubjects] = useState<Subject[]>([]);
  const [examSubjects, setExamSubjects] = useState<Subject[]>([]);
  const [selectedReview, setSelectedReview] = useState<number[]>([]);
  const [selectedExam, setSelectedExam] = useState<number[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customData, setCustomData] = useState<{ [key: string]: any }>({});
  
  const [settings, setSettings] = useState({
    showReviewSubjects: true,
    showExamSubjects: true,
    showCustomFields: true,
  });

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [student, lockedStatus, subjectsData, deadlineData, customFieldsData, registrationSettings] = await Promise.all([
        api.getStudentById(user.id),
        api.getRegistrationStatus(),
        api.getSubjects(),
        api.getRegistrationDeadline(),
        api.getCustomFormFields(),
        api.getRegistrationSettings(),
      ]);
      setStudentData(student);
      setSelectedReview(student.reviewSubjects || []);
      setSelectedExam(student.examSubjects || []);
      setCustomData(student.customData || {});
      setIsLocked(lockedStatus);
      setReviewSubjects(subjectsData.review);
      setExamSubjects(subjectsData.exam);
      setDeadline(deadlineData);
      setCustomFields(customFieldsData);
      setSettings(registrationSettings);
    } catch (error) {
      console.error("Failed to fetch initial data", error);
      setError("Không thể tải dữ liệu của bạn từ máy chủ. Lỗi này thường xảy ra do Security Rules của Firestore chặn truy cập. Vui lòng liên hệ quản trị viên hoặc kiểm tra lại cấu hình Firebase.");
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleSelectionChange = (setter: React.Dispatch<React.SetStateAction<number[]>>, limit: number) => (subjectId: number) => {
    if (isLocked) return;
    setter(prev => {
      if (prev.includes(subjectId)) {
        return prev.filter(id => id !== subjectId);
      }
      if (prev.length < limit) {
        return [...prev, subjectId];
      }
      return prev;
    });
  };

  const handleCustomDataChange = (fieldId: string, value: any) => {
    setCustomData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSave = async () => {
    if (isLocked) {
        setSaveMessage('Hệ thống đã khoá, không thể lưu.');
        return;
    }

    if (settings.showExamSubjects && selectedExam.length !== 2) {
        setSaveMessage('Vui lòng chọn đủ 2 môn thi tự chọn.');
        setTimeout(() => setSaveMessage(''), 3000);
        return;
    }
    
    if (settings.showCustomFields) {
        for (const field of customFields) {
            if (field.required && (!customData[field.id] || String(customData[field.id]).trim() === '')) {
                setSaveMessage(`Vui lòng điền thông tin bắt buộc: ${field.label}.`);
                setTimeout(() => setSaveMessage(''), 3000);
                return;
            }
        }
    }

    setIsSaving(true);
    setSaveMessage('');
    try {
        await api.updateStudentRegistration(user.id, {
            reviewSubjects: selectedReview,
            examSubjects: selectedExam,
            customData: customData,
        });
        setSaveMessage('Lưu thông tin đăng ký thành công!');
        fetchInitialData(); // Refresh data to show new registration time
    } catch (error: any) {
        setSaveMessage(error.message || 'Lỗi! Không thể lưu đăng ký.');
    } finally {
        setIsSaving(false);
        setTimeout(() => setSaveMessage(''), 5000);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spinner /></div>;
  }
  
  if (error) {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
            <Card title="Lỗi" className="border-red-500 border-2">
                <p className="text-red-700 font-semibold">Không thể tải phiếu đăng ký:</p>
                <p className="mt-2 text-gray-800">{error}</p>
            </Card>
        </div>
    );
  }

  if (!studentData) {
    return <p className="text-center text-red-500 p-8">Không thể tải dữ liệu học sinh.</p>;
  }
  
  const allSubjectsMap = new Map([...reviewSubjects, ...examSubjects].map(s => [s.id, s.name]));
  const registeredReview = studentData.reviewSubjects?.map(id => allSubjectsMap.get(id)).filter(Boolean) || [];
  const registeredExam = studentData.examSubjects?.map(id => allSubjectsMap.get(id)).filter(Boolean) || [];
  const hasRegistered = registeredReview.length > 0 || registeredExam.length > 0;
  
  const isSaveDisabled = isSaving || 
    (settings.showExamSubjects && selectedExam.length !== 2);
  
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Phiếu đăng kí môn học ôn tập và thi TN THPT</h1>
            <p className="text-gray-600 mt-1">Xin chào {studentData.hoten}, vui lòng hoàn thành phiếu đăng ký dưới đây.</p>
        </div>
        
        {!isLocked && <CountdownTimer deadline={deadline} />}

        {hasRegistered && (
             <Card 
                title="Thông tin bạn đã đăng ký" 
                className={`mb-6 transition-all duration-300 ${isLocked ? 'bg-green-100 border-green-500 border-2 shadow-lg' : 'bg-green-50 border-green-200'}`}
             >
                <div className="space-y-3 text-gray-800">
                    {settings.showReviewSubjects && (
                        <div>
                            <p className="font-semibold text-lg">Môn ôn tập đã chọn:</p>
                            <p className="pl-4 text-gray-700">{registeredReview.join(', ') || <i className="text-gray-500">Không đăng ký</i>}</p>
                        </div>
                    )}
                    {settings.showExamSubjects && (
                         <div>
                            <p className="font-semibold text-lg">Môn thi TN tự chọn:</p>
                            <p className="pl-4 text-gray-700">{registeredExam.join(', ') || <i className="text-gray-500">Chưa chọn</i>}</p>
                        </div>
                    )}
                    {studentData.registrationDate && (
                        <p className="text-sm text-gray-600 pt-2 border-t mt-3">
                           Lần cuối cập nhật lúc: {new Date(studentData.registrationDate).toLocaleString('vi-VN')}
                        </p>
                    )}
                </div>
            </Card>
        )}

        {!isLocked ? (
            <div className="space-y-8">
                {settings.showReviewSubjects && (
                    <SubjectSelector
                        title="Đăng ký môn ôn tập"
                        subjects={reviewSubjects}
                        selected={selectedReview}
                        onChange={handleSelectionChange(setSelectedReview, 4)}
                        limit={4}
                        disabled={isLocked}
                        customMessage={`Vui lòng chọn tối đa 4 môn. Bạn đã chọn ${selectedReview.length}/4.`}
                        action={
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setSelectedReview([])}
                                disabled={isLocked || selectedReview.length === 0}
                                className="px-3 py-1 text-sm"
                            >
                                Bỏ chọn tất cả
                            </Button>
                        }
                    />
                )}

                {settings.showExamSubjects && (
                    <Card title="Đăng ký môn thi Tốt nghiệp THPT">
                        <SubjectSelector 
                            title="Chọn 2 môn tự chọn"
                            subjects={examSubjects}
                            selected={selectedExam}
                            onChange={handleSelectionChange(setSelectedExam, 2)}
                            limit={2}
                            disabled={isLocked}
                            customMessage={`Vui lòng chọn 2 môn tự chọn. Bạn đã chọn ${selectedExam.length}/2.`}
                        />
                    </Card>
                )}

                {settings.showCustomFields && customFields.length > 0 && (
                    <Card title="Thông tin bổ sung">
                        <div className="space-y-4">
                            {customFields.map(field => (
                                <Input
                                    key={field.id}
                                    label={`${field.label}${field.required ? ' *' : ''}`}
                                    type={field.type}
                                    value={customData[field.id] || ''}
                                    onChange={e => handleCustomDataChange(field.id, e.target.value)}
                                    required={field.required}
                                />
                            ))}
                        </div>
                    </Card>
                )}
                
                <div className="text-center pt-4">
                    <Button onClick={handleSave} disabled={isSaveDisabled} className="w-full sm:w-auto min-w-[200px] flex justify-center items-center">
                        {isSaving ? <Spinner size="sm"/> : 'Lưu đăng ký'}
                    </Button>
                    {saveMessage && (
                        <p className={`mt-4 text-sm ${saveMessage.includes('Lỗi') || saveMessage.includes('Vui lòng') || saveMessage.includes('khoá') ? 'text-red-600' : 'text-green-600'}`}>
                            {saveMessage}
                        </p>
                    )}
                </div>
            </div>
        ) : (
            <>
              {!hasRegistered && (
                  <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md mb-6" role="alert">
                      <p className="font-bold">Hết hạn đăng ký!</p>
                      <p>Bạn đã không hoàn thành đăng ký kịp thời. Vui lòng liên hệ với văn phòng nhà trường.</p>
                  </div>
              )}
            </>
        )}
    </div>
  );
};

export default StudentDashboard;