import { useEffect, useState } from "react";
import ManagerLaborDashboard from "./ManagerLaborDashboard";
import OperatorTaskScreen from "./OperatorTaskScreen";

const getInitialView = () => {
  if (typeof window === "undefined") {
    return "manager";
  }

  const storedValue = window.localStorage.getItem("wms.frontend.view");
  if (storedValue === "operator" || storedValue === "manager") {
    return storedValue;
  }
  return "manager";
};

function App() {
  const [view, setView] = useState(getInitialView);

  useEffect(() => {
    window.localStorage.setItem("wms.frontend.view", view);
  }, [view]);

  return (
    <>
      <nav className="fixed right-3 top-3 z-50 flex rounded-xl border border-black/20 bg-white/90 p-1 shadow-lg backdrop-blur">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            view === "manager" ? "bg-ink text-white" : "text-black/70"
          }`}
          onClick={() => setView("manager")}
        >
          Manager
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            view === "operator" ? "bg-ink text-white" : "text-black/70"
          }`}
          onClick={() => setView("operator")}
        >
          Operator
        </button>
      </nav>

      {view === "manager" ? <ManagerLaborDashboard /> : <OperatorTaskScreen />}
    </>
  );
}

export default App;
