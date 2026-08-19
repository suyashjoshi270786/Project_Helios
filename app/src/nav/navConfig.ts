import {
  LayoutDashboard, ClipboardList, ListChecks, FileText, Database, Bot,
  Braces, ShieldCheck, PlayCircle, FileBarChart2, AlertTriangle, Rocket,
  BarChart3, Search, Settings, Link2, FolderKanban,
} from "lucide-react";

// Single source of truth for the sidebar AND the router.
// `status: "live"` = fully built. `status: "planned"` = placeholder page for now.
export const dashboardItem = {
  icon: LayoutDashboard,
  label: "Dashboard",
  path: "/",
  status: "live",
};

export const navSections = [
  {
    label: "PLAN",
    items: [
      { icon: ClipboardList, label: "Requirements", path: "/requirements", status: "live" },
      { icon: ListChecks, label: "Test Planning", path: "/test-planning", status: "live" },
      { icon: FileText, label: "Test Cases", path: "/test-cases", status: "live" },
    ],
  },
  {
    label: "BUILD",
    items: [
      { icon: Database, label: "Test Data", path: "/test-data", status: "planned" },
      { icon: Bot, label: "Automation Studio", path: "/automation-studio", status: "planned" },
      { icon: Braces, label: "API Studio", path: "/api-studio", status: "planned" },
      { icon: ShieldCheck, label: "SQL Validator", path: "/sql-validator", status: "planned" },
    ],
  },
  {
    label: "EXECUTE",
    items: [
      { icon: PlayCircle, label: "Test Execution", path: "/test-execution", status: "planned" },
      { icon: FileBarChart2, label: "Reports", path: "/reports", status: "planned" },
      { icon: AlertTriangle, label: "Failure Intelligence", path: "/failure-intelligence", status: "planned" },
    ],
  },
  {
    label: "ANALYZE",
    items: [
      { icon: Rocket, label: "Release Commander", path: "/release-commander", status: "planned" },
      { icon: BarChart3, label: "Analytics", path: "/analytics", status: "planned" },
      { icon: Search, label: "Defect Prediction", path: "/defect-prediction", status: "planned" },
    ],
  },
  {
    label: "CONFIGURE",
    items: [
      { icon: FolderKanban, label: "Projects", path: "/projects", status: "live" },
      { icon: Link2, label: "Integrations", path: "/integrations", status: "planned" },
      { icon: Settings, label: "Settings", path: "/settings", status: "live" },
    ],
  },
];

// Flat list of every planned (non-dashboard) route — used to generate placeholder routes.
export const allPlannedRoutes = navSections.flatMap((s) => s.items);
