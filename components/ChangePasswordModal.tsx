
import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onSubmit: (newPassword: string) => Promise<void>;
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


const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onSubmit }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (newPassword.length < 8) {
        setError('Mật khẩu phải có ít nhất 8 ký tự.');
        return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await onSubmit(newPassword);
    } catch (err: any) {
      setError(err.message || 'Đổi mật khẩu thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <Button onClick={handleSubmit} disabled={isLoading} className="w-full flex justify-center">
      {isLoading ? <Spinner size="sm" /> : 'Xác nhận đổi mật khẩu'}
    </Button>
  );

  return (
    <Modal isOpen={isOpen} title="Thay đổi mật khẩu lần đầu" footer={footer}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Để đảm bảo an toàn cho tài khoản, bạn cần thay đổi mật khẩu mặc định trong lần đăng nhập đầu tiên.
        </p>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <Input
          label="Mật khẩu mới"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordStrengthIndicator password={newPassword} />
        <Input
          label="Xác nhận mật khẩu mới"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
    </Modal>
  );
};

export default ChangePasswordModal;
