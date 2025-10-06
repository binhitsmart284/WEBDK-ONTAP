import React from 'react';
import { User, Role } from '../types';
import { LogoutIcon, CogIcon } from './icons';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onOpenChangePassword: () => void;
  originalUser: User | null; // The admin user during impersonation
  onStopImpersonating: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onOpenChangePassword, originalUser, onStopImpersonating }) => {
  return (
    <>
      {originalUser && user && (
        <div className="bg-yellow-400 text-black py-2 text-center text-sm font-semibold shadow-md">
          <span>
            Bạn đang xem với tư cách là <strong>{user.hoten}</strong> ({user.ma_hocsinh}).
          </span>
          <button
            onClick={onStopImpersonating}
            className="ml-4 font-bold text-blue-700 underline hover:text-blue-900"
          >
            Quay lại tài khoản Admin
          </button>
        </div>
      )}
      <header className="bg-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center gap-y-2 py-3 min-h-[4rem]">
            <div className="flex items-center">
              <h1 className="text-lg sm:text-xl font-bold">Hệ thống quản lí đăng kí trường THPT Hai Bà Trưng - Huế</h1>
            </div>
            {user && (
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="text-right">
                  <div className="font-semibold">{user.hoten}</div>
                  <div className="text-sm text-blue-200 capitalize">{user.role === Role.Admin ? 'Quản trị viên' : `Lớp ${user.lop}`}</div>
                </div>
                {!originalUser && ( // Hide these buttons when impersonating
                  <>
                    <button
                      onClick={onOpenChangePassword}
                      className="p-2 rounded-full text-blue-100 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
                      title="Đổi mật khẩu"
                    >
                      <CogIcon className="w-6 h-6" />
                    </button>
                    <button
                      onClick={onLogout}
                      className="p-2 rounded-full text-blue-100 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
                      title="Đăng xuất"
                    >
                      <LogoutIcon className="w-6 h-6" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
