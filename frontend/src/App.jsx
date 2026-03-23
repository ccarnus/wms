import React, { useCallback, useEffect, useMemo, useState } from "react";
import LoginScreen from "./LoginScreen";
import ChangePasswordScreen from "./ChangePasswordScreen";
import DashboardScreen from "./DashboardScreen";
import InventoryDashboard from "./InventoryDashboard";
import ManagerLaborDashboard from "./ManagerLaborDashboard";
import OperatorTaskScreen from "./OperatorTaskScreen";
import UserManagementScreen from "./UserManagementScreen";
import IntegrationsScreen from "./IntegrationsScreen";
import ConfigurationScreen from "./ConfigurationScreen";

/* ── Inline SVG icons (24x24, stroke-based) ─────────────────────────── */

function IconDashboard({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1" />
    </svg>
  );
}

function IconManager({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconOperator({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function IconInventory({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
}

function IconUsers({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconIntegrations({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  );
}

function IconConfiguration({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconMenu({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconLogout({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ── Views configuration ─────────────────────────────────────────────── */

const VIEWS = [
  {
    id: "dashboard",
    label: "Dashboard",
    subtitle: "Overview and KPIs",
    icon: IconDashboard
  },
  {
    id: "manager",
    label: "Manager",
    subtitle: "Labor and workload",
    icon: IconManager
  },
  {
    id: "operator",
    label: "Operator",
    subtitle: "Current task execution",
    icon: IconOperator
  },
  {
    id: "inventory",
    label: "Inventory",
    subtitle: "Stock and movement health",
    icon: IconInventory
  },
  {
    id: "users",
    label: "Users",
    subtitle: "Manage user accounts",
    icon: IconUsers
  },
  {
    id: "integrations",
    label: "Integrations",
    subtitle: "External system connections",
    icon: IconIntegrations
  },
  {
    id: "configuration",
    label: "Configuration",
    subtitle: "Zones, locations, and SKUs",
    icon: IconConfiguration
  }
];

const VIEWS_BY_ROLE = {
  admin: ["dashboard", "manager", "inventory", "users", "integrations", "configuration"],
  warehouse_manager: ["dashboard", "manager", "inventory", "users", "configuration"],
  supervisor: ["dashboard", "manager", "inventory", "users"],
  operator: ["operator"],
  viewer: ["dashboard", "manager", "inventory"]
};

const AUTH_TOKEN_KEY = "wms.auth.token";
const AUTH_USER_KEY = "wms.auth.user";

const safeStorageGet = (key) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
};

const safeStorageSet = (key, value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch (_error) {
    // Ignore storage failures to avoid crashing the UI.
  }
};

const safeStorageRemove = (key) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch (_error) {
    // Ignore storage failures.
  }
};

const getStoredAuth = () => {
  const token = safeStorageGet(AUTH_TOKEN_KEY);
  if (!token) {
    return null;
  }
  const userJson = safeStorageGet(AUTH_USER_KEY);
  let user = null;
  try {
    user = userJson ? JSON.parse(userJson) : null;
  } catch (_error) {
    // Ignore parse errors.
  }
  return { token, user };
};

const getInitialView = (allowedIds) => {
  if (typeof window === "undefined") {
    return allowedIds[0] || "dashboard";
  }

  const storedValue = safeStorageGet("wms.frontend.view");
  if (storedValue && allowedIds.includes(storedValue)) {
    return storedValue;
  }
  return allowedIds[0] || "dashboard";
};

function App() {
  const [auth, setAuth] = useState(() => getStoredAuth());

  const visibleViews = useMemo(() => {
    const allowedIds = VIEWS_BY_ROLE[auth?.user?.role] || VIEWS.map((v) => v.id);
    return VIEWS.filter((v) => allowedIds.includes(v.id));
  }, [auth?.user?.role]);

  const visibleViewIds = useMemo(() => visibleViews.map((v) => v.id), [visibleViews]);

  const [view, setView] = useState(() => getInitialView(visibleViewIds));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!visibleViewIds.includes(view)) {
      setView(visibleViewIds[0] || "dashboard");
    }
  }, [visibleViewIds, view]);

  useEffect(() => {
    safeStorageSet("wms.frontend.view", view);
  }, [view]);

  const handleLoginSuccess = useCallback(({ token, user }) => {
    safeStorageSet(AUTH_TOKEN_KEY, token);
    safeStorageSet(AUTH_USER_KEY, JSON.stringify(user));
    safeStorageRemove("wms.operator.jwt");
    safeStorageRemove("wms.operator.id");
    safeStorageRemove("wms.manager.jwt");
    setAuth({ token, user });
  }, []);

  const handleLogout = useCallback(() => {
    safeStorageRemove(AUTH_TOKEN_KEY);
    safeStorageRemove(AUTH_USER_KEY);
    setAuth(null);
  }, []);

  const handleAuthError = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

  const handlePasswordChanged = useCallback(
    (updatedUser) => {
      const newAuth = { ...auth, user: { ...auth.user, ...updatedUser, mustChangePassword: false } };
      safeStorageSet(AUTH_USER_KEY, JSON.stringify(newAuth.user));
      setAuth(newAuth);
    },
    [auth]
  );

  if (!auth?.token) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (auth.user?.mustChangePassword) {
    return (
      <ChangePasswordScreen
        jwtToken={auth.token}
        onPasswordChanged={handlePasswordChanged}
      />
    );
  }

  const isOperatorRole = auth.user?.role === "operator";

  const activeViewComponent = (() => {
    if (view === "dashboard") {
      return <DashboardScreen jwtToken={auth.token} user={auth.user} onAuthError={handleAuthError} />;
    }
    if (view === "operator") {
      return <OperatorTaskScreen jwtToken={auth.token} user={auth.user} onAuthError={handleAuthError} onLogout={handleLogout} />;
    }
    if (view === "inventory") {
      return <InventoryDashboard jwtToken={auth.token} user={auth.user} onAuthError={handleAuthError} />;
    }
    if (view === "users") {
      return <UserManagementScreen jwtToken={auth.token} user={auth.user} onAuthError={handleAuthError} />;
    }
    if (view === "integrations") {
      return <IntegrationsScreen jwtToken={auth.token} user={auth.user} onAuthError={handleAuthError} />;
    }
    if (view === "configuration") {
      return <ConfigurationScreen jwtToken={auth.token} user={auth.user} onAuthError={handleAuthError} />;
    }
    return <ManagerLaborDashboard jwtToken={auth.token} user={auth.user} onAuthError={handleAuthError} />;
  })();

  if (isOperatorRole) {
    return (
      <div className="min-h-screen bg-canvas text-ink">
        {activeViewComponent}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <button
        type="button"
        className="fixed left-3 top-3 z-40 rounded-lg border border-black/20 bg-white p-2 shadow md:hidden"
        aria-label="Open menu"
        onClick={() => setIsSidebarOpen((current) => !current)}
      >
        <IconMenu className="h-5 w-5" />
      </button>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/25 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-black/10 bg-white/95 p-4 shadow-xl transition-transform md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="rounded-xl border border-accent/20 bg-accent-50 p-3">
          <div className="flex items-center gap-2">
            <img src="/Logo.png" alt="Greenlights" className="h-7 w-auto" />
            <span className="text-base font-bold tracking-tight text-ink">
              Green<span className="text-accent-600">lights</span>
            </span>
          </div>
          <h1 className="mt-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent-700">Operations Hub</h1>
          <p className="mt-1 text-xs text-black/60">
            Signed in as{" "}
            <span className="font-semibold">
              {auth.user?.displayName || auth.user?.username || "User"}
            </span>
          </p>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto">
          {visibleViews.map((menuItem) => {
            const Icon = menuItem.icon;
            const isActive = view === menuItem.id;
            return (
              <button
                key={menuItem.id}
                type="button"
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  isActive
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-transparent bg-transparent text-black/70 hover:border-black/10 hover:bg-canvas"
                }`}
                onClick={() => {
                  setView(menuItem.id);
                  setIsSidebarOpen(false);
                }}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-accent" : "text-black/40"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">{menuItem.label}</p>
                  <p className="mt-0.5 truncate text-[11px] leading-tight opacity-70">{menuItem.subtitle}</p>
                </div>
              </button>
            );
          })}
        </nav>

        <footer className="space-y-2 pt-2">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-semibold text-signal transition hover:bg-signal/10"
            onClick={handleLogout}
          >
            <IconLogout className="h-4 w-4 flex-shrink-0" />
            Sign Out
          </button>
        </footer>
      </aside>

      <div className="md:pl-72">{activeViewComponent}</div>
    </div>
  );
}

export default App;
