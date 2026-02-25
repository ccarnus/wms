import React, { useEffect, useMemo, useState } from "react";
import InventoryDashboard from "./InventoryDashboard";
import ManagerLaborDashboard from "./ManagerLaborDashboard";
import OperatorTaskScreen from "./OperatorTaskScreen";

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
  }
];

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

const getInitialView = () => {
  if (typeof window === "undefined") {
    return "manager";
  }

  const storedValue = safeStorageGet("wms.frontend.view");
  if (VIEWS.some((view) => view.id === storedValue)) {
    return storedValue;
  }
  return "manager";
};

function App() {
  const [view, setView] = useState(getInitialView);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    safeStorageSet("wms.frontend.view", view);
  }, [view]);

  const activeView = useMemo(() => VIEWS.find((candidate) => candidate.id === view) || VIEWS[0], [view]);

  const activeViewComponent = useMemo(() => {
    if (view === "operator") {
      return <OperatorTaskScreen />;
    }
    if (view === "inventory") {
      return <InventoryDashboard />;
    }
    return <ManagerLaborDashboard />;
  }, [view]);

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
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">WMS Console</p>
          <h1 className="mt-1 text-lg font-black">Operations Hub</h1>
          <p className="mt-1 text-xs text-black/60">Select a workspace</p>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-2">
          {VIEWS.map((menuItem) => (
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

        <footer className="rounded-xl border border-black/10 bg-canvas p-3 text-xs text-black/65">
          Active: <span className="font-semibold text-black/85">{activeView.label}</span>
        </footer>
      </aside>

      <div className="md:pl-72">{activeViewComponent}</div>
    </div>
  );
}

export default App;
