import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProjectProvider } from "./projects/ProjectContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppLayout from "./layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import RequirementsPage from "./pages/RequirementsPage";
import ProjectsPage from "./pages/ProjectsPage";
import SettingsPage from "./pages/SettingsPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import TestPlanListPage from "./pages/test-planning/TestPlanListPage";
import TestPlanEditorPage from "./pages/test-planning/TestPlanEditorPage";
import TestCasesPage from "./pages/test-cases/TestCasesPage";
import TestCaseEditorPage from "./pages/test-cases/TestCaseEditorPage";
import { allPlannedRoutes } from "./nav/navConfig";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="requirements" element={<RequirementsPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="test-planning" element={<TestPlanListPage />} />
                <Route path="test-planning/:id" element={<TestPlanEditorPage />} />
                <Route path="test-cases" element={<TestCasesPage />} />
                <Route path="test-cases/suite/:suiteId" element={<TestCasesPage />} />
                <Route path="test-cases/suite/:suiteId/new" element={<TestCaseEditorPage />} />
                <Route path="test-cases/case/:caseId" element={<TestCaseEditorPage />} />
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
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
