import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ChangePasswordWizard from "../pages/ChangePasswordWizard";

export default function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Blocks the rest of the app until an admin-provisioned temporary
  // password is replaced with one the user actually chose.
  if (user?.mustChangePassword) {
    return <ChangePasswordWizard />;
  }

  return <Outlet />;
}
