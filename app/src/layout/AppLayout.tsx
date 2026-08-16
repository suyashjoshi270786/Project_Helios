import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Search, Bell, HelpCircle, ChevronDown, PanelLeftClose, Sun, LogOut, Settings, Menu,
} from "lucide-react";
import { dashboardItem, navSections } from "../nav/navConfig";
import { useAuth } from "../auth/AuthContext";

function SidebarLink({
  icon: Icon,
  label,
  path,
  onNavigate,
}: {
  icon: any;
  label: string;
  path: string;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={path}
      end={path === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        `w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isActive
            ? "bg-blue-600/15 text-blue-400 font-medium"
            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200"
        }`
      }
    >
      <Icon size={15} /> {label}
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans flex"
      style={{ minHeight: "100vh" }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`w-60 shrink-0 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
            <Sun size={18} className="text-slate-950" />
          </div>
          <div>
            <div className="text-[10px] tracking-widest text-slate-400 dark:text-slate-500 leading-none">
              PROJECT
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">HELIOS</div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 leading-none">
              AI Operations for Quality Engineering
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          <SidebarLink
            icon={dashboardItem.icon}
            label={dashboardItem.label}
            path={dashboardItem.path}
            onNavigate={() => setSidebarOpen(false)}
          />
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="text-[10px] tracking-widest text-slate-400 dark:text-slate-600 px-3 mb-1">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <SidebarLink
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    path={item.path}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <button className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-sm hover:text-slate-700 dark:hover:text-slate-300">
          <PanelLeftClose size={15} /> Collapse
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 px-4 lg:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400"
            >
              <Menu size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                Welcome back, {user?.name?.split(" ")[0] || "there"} 👋
              </h1>
              <p className="hidden sm:block text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                AI-Powered Quality Engineering. Smarter Testing. Faster Releases.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-400 dark:text-slate-500 text-xs w-56">
              <Search size={13} /> Search anything...
              <span className="ml-auto text-[10px] border border-slate-300 dark:border-slate-700 rounded px-1">
                ⌘K
              </span>
            </div>
            <button className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <Bell size={14} />
            </button>
            <button className="hidden sm:flex w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center text-slate-500 dark:text-slate-400">
              <HelpCircle size={14} />
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[11px] font-semibold text-white shrink-0 overflow-hidden">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.charAt(0).toUpperCase() || "?"
                  )}
                </div>
                <div className="hidden sm:block text-xs text-left">
                  <div className="text-slate-800 dark:text-slate-200 font-medium leading-none">
                    {user?.name || "Guest"}
                  </div>
                  <div className="text-slate-400 dark:text-slate-500 leading-none mt-1">{user?.role || ""}</div>
                </div>
                <ChevronDown size={13} className="hidden sm:block text-slate-400 dark:text-slate-600" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg overflow-hidden z-10">
                  <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500 truncate border-b border-slate-200 dark:border-slate-800">
                    {user?.email}
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/settings");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Settings size={13} /> Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <LogOut size={13} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
