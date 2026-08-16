import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppLayout from "./layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import RequirementsPage from "./pages/RequirementsPage";
import SettingsPage from "./pages/SettingsPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import { allPlannedRoutes } from "./nav/navConfig";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="requirements" element={<RequirementsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              {allPlannedRoutes
                .filter((item) => item.status === "planned")
                .map((item) => (
                  <Route
                    key={item.path}
                    path={item.path.slice(1)}
                    element={<PlaceholderPage title={item.label} />}
                  />
                ))}
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
