import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  // const { isAuthenticated, loading } = useAuth();

  // if (loading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
  //       <div className="text-center">
  //         <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4"></div>
  //         <p className="text-slate-600 dark:text-slate-400">Loading...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // if (!isAuthenticated) {
  //   return <Navigate to="/login" replace />;
  // }
  return children;
};

export default ProtectedRoute;