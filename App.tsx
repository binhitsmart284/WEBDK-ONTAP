import React, { useState, createContext, useContext, useMemo } from 'react';
import { User, Role } from './types';
import { api } from './services/api';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import StudentDashboard from './components/StudentDashboard';
import Header from './components/Header';
import ChangePasswordModal from './components/ChangePasswordModal';
import ChangeOwnPasswordModal from './components/ChangeOwnPasswordModal';
import ForgotPasswordModal from './components/ForgotPasswordModal';

interface AuthContextType {
  user: User | null;
  originalUser: User | null; // For impersonation
  login: (ma_hocsinh: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (newPassword: string) => Promise<void>;
  impersonate: (student: User) => void;
  stopImpersonating: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const Footer: React.FC = () => {
  return (
    <footer className="bg-white py-3 border-t shadow-sm flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
        <p>
          Trang web được thiết kế bởi Nguyễn Tất Thái Bình - FB: {' '}
          <a href="https://www.facebook.com/binh.nguyen.28" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 hover:underline">
            https://www.facebook.com/binh.nguyen.28
          </a> - năm 2025
        </p>
      </div>
    </footer>
  );
};


const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isChangeOwnPasswordModalOpen, setIsChangeOwnPasswordModalOpen] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);

  const authContextValue = useMemo(() => ({
    user,
    originalUser,
    login: async (ma_hocsinh: string, password: string) => {
      const loggedInUser = await api.login(ma_hocsinh, password);
      setUser(loggedInUser);
    },
    logout: () => {
      setUser(null);
      setOriginalUser(null);
      // In a real app, you'd also clear any tokens here.
    },
    changePassword: async (newPassword: string) => {
      if (user) {
        await api.changePassword(user.id, newPassword);
        // Optimistically update user state
        setUser({ ...user, mustChangePassword: false });
      }
    },
    impersonate: (studentToImpersonate: User) => {
        if (user?.role === Role.Admin) {
            setOriginalUser(user);
            setUser(studentToImpersonate);
        }
    },
    stopImpersonating: () => {
        if (originalUser) {
            setUser(originalUser);
            setOriginalUser(null);
        }
    }
  }), [user, originalUser]);

  const renderContent = () => {
    if (!authContextValue.user) {
        return <Login onLogin={authContextValue.login} onForgotPassword={() => setIsForgotPasswordModalOpen(true)} />;
    }
    
    if (authContextValue.user.role === Role.Admin) {
        return <AdminDashboard />;
    }

    return <StudentDashboard user={authContextValue.user} />;
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      <div className="h-screen bg-gray-100 flex flex-col">
        <Header 
            user={authContextValue.user} 
            onLogout={authContextValue.logout} 
            onOpenChangePassword={() => setIsChangeOwnPasswordModalOpen(true)}
            originalUser={authContextValue.originalUser}
            onStopImpersonating={authContextValue.stopImpersonating}
        />
        <main className="flex-grow overflow-y-auto">
          {renderContent()}
        </main>
        <Footer />
        
        {/* Modal for first-time password change */}
        <ChangePasswordModal 
          isOpen={!!authContextValue.user?.mustChangePassword} 
          onSubmit={authContextValue.changePassword} 
        />
        
        {/* Modal for user-initiated password change */}
        {authContextValue.user && !authContextValue.originalUser && ( // Only show if not impersonating
            <ChangeOwnPasswordModal
                isOpen={isChangeOwnPasswordModalOpen}
                onClose={() => setIsChangeOwnPasswordModalOpen(false)}
            />
        )}

        {/* Modal for forgot password flow */}
        <ForgotPasswordModal
            isOpen={isForgotPasswordModalOpen}
            onClose={() => setIsForgotPasswordModalOpen(false)}
        />
      </div>
    </AuthContext.Provider>
  );
};

export default App;
