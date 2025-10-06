import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Spinner } from './ui/Spinner';

interface LoginProps {
  onLogin: (ma_hocsinh: string, password: string) => Promise<void>;
  onForgotPassword: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onForgotPassword }) => {
  const [maHocSinh, setMaHocSinh] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await onLogin(maHocSinh, password);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-blue-800 mb-6">Hệ thống Đăng ký Ôn tập</h1>
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-xl font-semibold text-center text-gray-800">Đăng nhập</h2>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}
            <Input
              id="ma_hocsinh"
              label="Mã học sinh"
              type="text"
              value={maHocSinh}
              onChange={(e) => setMaHocSinh(e.target.value)}
              required
              placeholder="Ví dụ: HS2025001"
            />
            <Input
              id="password"
              label="Mật khẩu"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mật khẩu mặc định là số CCCD"
            />
            <Button type="submit" className="w-full flex justify-center items-center" disabled={isLoading}>
              {isLoading ? <Spinner size="sm"/> : 'Đăng nhập'}
            </Button>
          </form>
           <div className="text-center mt-4">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm font-medium text-blue-700 hover:text-blue-600"
            >
              Quên mật khẩu?
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
