import { Navigate } from 'react-router-dom';

// Wrap your /admin and /student routes with this
export default function ProtectedRoute({ children, allowedRole }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // Not logged in → go to login
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // Logged in but wrong role → redirect to their own page
  if (allowedRole && role !== allowedRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/student'} replace />;
  }

  return children;
}

// Wrap your / (login) route with this
export function PublicRoute({ children }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // Already logged in → go to their dashboard, can't see login page
  if (token && role) {
    return <Navigate to={role === 'admin' ? '/admin' : '/student'} replace />;
  }

  return children;
}
