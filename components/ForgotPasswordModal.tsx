import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { api } from '../services/api';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [maHocSinh, setMaHocSinh] = useState('');
  const [ngaySinh, setNgaySinh] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userIdToReset, setUserIdToReset] = useState<number | null>(null);

  const resetAllState = () => {
    setStep(1);
    setMaHocSinh('');
    setNgaySinh('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMessage('');
    setIsLoading(false);
    setUserIdToReset(null);
  };

  const handleClose = () => {
    resetAllState();
    onClose();
  };

  const handleVerify = async () => {
    setError('');
    setIsLoading(true);
    try {
      const userId = await api.verifyStudentForPasswordReset(maHocSinh, ngaySinh);
      setUserIdToReset(userId);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Xác minh thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
        setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
        return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setError('');
    setIsLoading(true);
    if (!userIdToReset) return;

    try {
      await api.resetPasswordAfterVerification(userIdToReset, newPassword);
      setSuccessMessage('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bây giờ.');
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Đặt lại mật khẩu thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Quên mật khẩu">
      <div className="space-y-4">
        {error && <div className="text-red-600 text-sm bg-red-100 p-2 rounded">{error}</div>}
        {successMessage && <div className="text-green-600 text-sm bg-green-100 p-2 rounded">{successMessage}</div>}

        {step === 1 && (
          <>
            <p className="text-sm text-gray-600">Vui lòng nhập thông tin để xác minh tài khoản của bạn.</p>
            <Input label="Mã học sinh" value={maHocSinh} onChange={e => setMaHocSinh(e.target.value)} disabled={isLoading} />
            <Input label="Ngày sinh" type="date" value={ngaySinh} onChange={e => setNgaySinh(e.target.value)} disabled={isLoading} />
            <Button onClick={handleVerify} disabled={isLoading} className="w-full flex justify-center mt-4">
              {isLoading ? <Spinner size="sm" /> : 'Xác minh'}
            </Button>
          </>
        )}

        {step === 2 && (
          <>
             <p className="text-sm text-gray-600">Xác minh thành công! Vui lòng đặt mật khẩu mới.</p>
             <Input label="Mật khẩu mới" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={isLoading} />
             <Input label="Xác nhận mật khẩu mới" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isLoading} />
             <Button onClick={handleResetPassword} disabled={isLoading} className="w-full flex justify-center mt-4">
                {isLoading ? <Spinner size="sm" /> : 'Đặt lại mật khẩu'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ForgotPasswordModal;
