import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { useAuth } from '../App';
import { api } from '../services/api';

interface ChangeOwnPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PasswordStrengthIndicator: React.FC<{ password: string }> = ({ password }) => {
    const getStrength = () => {
        let score = 0;
        if (password.length > 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return score;
    };

    const strength = getStrength();
    const colors = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-500'];
    const labels = ['Rất yếu', 'Yếu', 'Trung bình', 'Tốt', 'Mạnh', 'Rất mạnh'];

    return (
        <div>
            <div className="flex h-2 rounded-full overflow-hidden">
                <div className={`transition-all duration-300 ${strength > 0 ? colors[strength] : 'bg-gray-200'}`} style={{ width: `${(strength / 5) * 100}%` }}></div>
            </div>
            <p className="text-xs text-right mt-1">{labels[strength]}</p>
        </div>
    );
};

const ChangeOwnPasswordModal: React.FC<ChangeOwnPasswordModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetState = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMessage('');
    setIsLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    if (newPassword.length < 8) {
        setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
        return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    if (!user) {
        setError("Lỗi xác thực người dùng.");
        setIsLoading(false);
        return;
    }

    try {
      await api.changeOwnPassword(user.id, currentPassword, newPassword);
      setSuccessMessage('Đổi mật khẩu thành công!');
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Đổi mật khẩu thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose}>Đóng</Button>
      <Button onClick={handleSubmit} disabled={isLoading} className="min-w-[100px] flex justify-center">
        {isLoading ? <Spinner size="sm" /> : 'Lưu thay đổi'}
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Thay đổi mật khẩu" footer={footer}>
      <div className="space-y-4">
        {error && <div className="text-red-600 text-sm bg-red-100 p-2 rounded">{error}</div>}
        {successMessage && <div className="text-green-600 text-sm bg-green-100 p-2 rounded">{successMessage}</div>}
        <Input
          label="Mật khẩu hiện tại"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={isLoading}
        />
        <Input
          label="Mật khẩu mới"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isLoading}
        />
        <PasswordStrengthIndicator password={newPassword} />
        <Input
          label="Xác nhận mật khẩu mới"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>
    </Modal>
  );
};

export default ChangeOwnPasswordModal;