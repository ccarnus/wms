import React, { useCallback, useEffect, useMemo, useState } from "react";
import LoginScreen from "./LoginScreen";
import ChangePasswordScreen from "./ChangePasswordScreen";
import InventoryDashboard from "./InventoryDashboard";
import ManagerLaborDashboard from "./ManagerLaborDashboard";
import OperatorTaskScreen from "./OperatorTaskScreen";
import UserManagementScreen from "./UserManagementScreen";

const VIEWS = [
  {
    id: "manager",
    label: "Manager",
    subtitle: "Labor and workload"
  },
  {
    id: "operator",
    label: "Operator",
    subtitle: "Current task execution"
  },
  {
    id: "inventory",
    label: "Inventory",
    subtitle: "Stock and movement health"
  },
  {
    id: "users",
    label: "Users",
    subtitle: "Manage user accounts"
  }
];

const VIEWS_BY_ROLE = {
  admin: ["manager", "operator", "inventory", "users"],
  warehouse_manager: ["manager", "operator", "inventory", "users"],
  supervisor: ["manager", "operator", "inventory"],
  operator: ["operator"],
  viewer: ["manager", "inventory"]
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
    return allowedIds[0] || "manager";
  }

  const storedValue = safeStorageGet("wms.frontend.view");
  if (storedValue && allowedIds.includes(storedValue)) {
    return storedValue;
  }
  return allowedIds[0] || "manager";
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
      setView(visibleViewIds[0] || "manager");
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

  const activeView =
    visibleViews.find((candidate) => candidate.id === view) || visibleViews[0];

  const activeViewComponent = (() => {
    if (view === "operator") {
      return <OperatorTaskScreen jwtToken={auth.token} user={auth.user} />;
    }
    if (view === "inventory") {
      return <InventoryDashboard jwtToken={auth.token} user={auth.user} />;
    }
    if (view === "users") {
      return <UserManagementScreen jwtToken={auth.token} user={auth.user} />;
    }
    return <ManagerLaborDashboard jwtToken={auth.token} user={auth.user} />;
  })();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <button
        type="button"
        className="fixed left-3 top-3 z-40 rounded-lg border border-black/20 bg-white px-3 py-2 text-xs font-semibold shadow md:hidden"
        onClick={() => setIsSidebarOpen((current) => !current)}
      >
        Menu
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
        <div className="rounded-xl border border-black/10 bg-canvas p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            WMS Console
          </p>
          <h1 className="mt-1 text-lg font-black">Operations Hub</h1>
          <p className="mt-1 text-xs text-black/60">
            Signed in as{" "}
            <span className="font-semibold">
              {auth.user?.displayName || auth.user?.username || "User"}
            </span>
          </p>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-2">
          {visibleViews.map((menuItem) => (
            <button
              key={menuItem.id}
              type="button"
              className={`rounded-xl border px-3 py-3 text-left transition ${
                view === menuItem.id
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-black/10 bg-white text-black/80 hover:bg-canvas"
              }`}
              onClick={() => {
                setView(menuItem.id);
                setIsSidebarOpen(false);
              }}
            >
              <p className="text-sm font-bold">{menuItem.label}</p>
              <p className="mt-1 text-xs opacity-80">{menuItem.subtitle}</p>
            </button>
          ))}
        </nav>

        <footer className="space-y-2">
          <div className="rounded-xl border border-black/10 bg-canvas p-3 text-xs text-black/65">
            Active:{" "}
            <span className="font-semibold text-black/85">
              {activeView?.label}
            </span>
          </div>
          <button
            type="button"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-signal transition hover:bg-signal/10"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </footer>
      </aside>

      <div className="md:pl-72">{activeViewComponent}</div>
    </div>
  );
}

export default App;
