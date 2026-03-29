import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const runtimeApiBaseUrl = typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "";
const apiBaseUrl = String(runtimeApiBaseUrl || "").replace(/\/+$/, "");
const apiDisplayUrl = apiBaseUrl || "same-origin (/api)";
const buildApiUrl = (path) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

const ACTIVE_STATUS_ORDER = ["in_progress", "paused", "assigned"];

const statusBadgeClassNameMap = {
  created: "border-slate-300 bg-slate-100 text-slate-700",
  assigned: "border-cyan-200 bg-cyan-50 text-cyan-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  paused: "border-orange-200 bg-orange-50 text-orange-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700"
};

const getSocketBaseUrl = () => {
  if (!apiBaseUrl) {
    return undefined;
  }

  try {
    const parsed = new URL(apiBaseUrl, window.location.origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (_error) {
    return undefined;
  }
};

const getAuthHeaders = (jwtToken) => {
  const headers = { "Content-Type": "application/json" };
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  }
  return headers;
};

async function fetchJson(path, { jwtToken = "", onAuthError = null, ...options } = {}) {
  const response = await fetch(buildApiUrl(path), {
    headers: getAuthHeaders(jwtToken),
    ...options
  });
  if (!response.ok) {
    if (response.status === 401 && onAuthError) {
      onAuthError();
    }
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

const toQueryString = (params) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") {
      query.set(key, String(value));
    }
  }
  return query.toString();
};

const deriveDisplayLocation = (taskLine) => {
  const fromLocation = taskLine.fromLocationCode || "External";
  const toLocation = taskLine.toLocationCode || "External";
  return `${fromLocation} -> ${toLocation}`;
};

/* ── Inline SVG icons ──────────────────────────────────────────────── */

function IconUser({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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

function IconClose({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconBack({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

/* ── User Settings Panel ───────────────────────────────────────────── */

function UserSettingsPanel({ user, operatorId, operatorStatus, socketState, onLogout, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl safe-bottom">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Settings</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-black/5">
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-black/10 bg-canvas p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/50">Account</p>
            <p className="text-sm">
              <span className="text-black/60">Name:</span>{" "}
              <span className="font-semibold">{user?.displayName || user?.username || "Unknown"}</span>
            </p>
            <p className="text-sm">
              <span className="text-black/60">Role:</span>{" "}
              <span className="font-semibold capitalize">{user?.role || "Unknown"}</span>
            </p>
            <p className="text-sm">
              <span className="text-black/60">Operator ID:</span>{" "}
              <span className="font-mono text-xs">{operatorId || "Not linked"}</span>
            </p>
          </div>

          <div className="rounded-xl border border-black/10 bg-canvas p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/50">Connection</p>
            <p className="text-sm">
              <span className="text-black/60">API:</span>{" "}
              <span className="font-mono text-xs">{apiDisplayUrl}</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-2.5 py-1 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${socketState === "connected" ? "bg-emerald-500" : socketState === "connecting" ? "bg-amber-500" : "bg-red-400"}`} />
                Socket: {socketState}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-2.5 py-1 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${operatorStatus === "available" ? "bg-emerald-500" : operatorStatus === "busy" ? "bg-amber-500" : "bg-slate-400"}`} />
                Status: {operatorStatus}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-signal/20 bg-signal/5 px-4 py-3 text-sm font-semibold text-signal transition hover:bg-signal/10"
            onClick={onLogout}
          >
            <IconLogout className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Task Detail View ──────────────────────────────────────────────── */

function TaskDetailView({ task, actionLoading, operatorId, jwtToken, onAuthError, onBack, onTaskUpdate, expectedTaskQuantity }) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isCompletePanelOpen, setIsCompletePanelOpen] = useState(false);
  const [confirmedQuantity, setConfirmedQuantity] = useState("");

  const statusBadgeClassName =
    statusBadgeClassNameMap[task?.status] || "border-slate-300 bg-slate-100 text-slate-700";

  const submitTaskAction = useCallback(
    async ({ actionName, endpoint, optimisticStatus, quantity }) => {
      if (!task?.id) return;

      setErrorMessage("");
      const previousTask = task;
      const optimisticTask = {
        ...previousTask,
        status: optimisticStatus,
        version: Number(previousTask.version || 0) + 1
      };
      onTaskUpdate(optimisticTask, actionName);

      try {
        const payload = {
          version: Number(previousTask.version),
          changedByOperatorId: operatorId || null
        };
        if (quantity !== undefined) {
          payload.quantity = quantity;
        }

        const updatedTask = await fetchJson(`/api/tasks/${previousTask.id}/${endpoint}`, {
          jwtToken,
          onAuthError,
          method: "POST",
          body: JSON.stringify(payload)
        });

        const hydratedUpdatedTask = {
          ...updatedTask,
          zone: updatedTask.zone || previousTask.zone || null,
          lines: Array.isArray(updatedTask.lines) ? updatedTask.lines : previousTask.lines || [],
          totalQuantity:
            updatedTask.totalQuantity !== undefined
              ? updatedTask.totalQuantity
              : previousTask.totalQuantity || expectedTaskQuantity
        };

        onTaskUpdate(hydratedUpdatedTask, "");

        if (endpoint === "complete") {
          setIsCompletePanelOpen(false);
          setConfirmedQuantity("");
          onBack();
        }
      } catch (error) {
        onTaskUpdate(previousTask, "");
        setErrorMessage(error.message);
      }
    },
    [task, operatorId, jwtToken, onAuthError, onTaskUpdate, onBack, expectedTaskQuantity]
  );

  const handleStartTask = () =>
    submitTaskAction({ actionName: "start", endpoint: "start", optimisticStatus: "in_progress" });

  const handlePauseTask = () =>
    submitTaskAction({ actionName: "pause", endpoint: "pause", optimisticStatus: "paused" });

  const handleCompleteTask = async () => {
    const numericConfirmedQuantity = Number(confirmedQuantity);
    if (!Number.isInteger(numericConfirmedQuantity) || numericConfirmedQuantity <= 0) {
      setErrorMessage("Confirmed quantity must be a positive integer");
      return;
    }
    if (expectedTaskQuantity > 0 && numericConfirmedQuantity !== expectedTaskQuantity) {
      const keepGoing = window.confirm(
        `Expected ${expectedTaskQuantity} units but confirmed ${numericConfirmedQuantity}. Complete anyway?`
      );
      if (!keepGoing) return;
    }
    await submitTaskAction({
      actionName: "complete",
      endpoint: "complete",
      optimisticStatus: "completed",
      quantity: numericConfirmedQuantity
    });
  };

  const isStartAllowed = task && ["assigned", "paused"].includes(task.status);
  const isPauseAllowed = task && task.status === "in_progress";
  const isCompleteAllowed = task && task.status === "in_progress";

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-semibold text-accent self-start -ml-1"
        onClick={onBack}
      >
        <IconBack className="h-4 w-4" />
        Back to tasks
      </button>

      {errorMessage && (
        <div className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
          {errorMessage}
        </div>
      )}

      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-black/60">Task type</p>
            <p className="text-xl font-black capitalize">{String(task.type).replace("_", " ")}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusBadgeClassName}`}>
            {String(task.status).replace("_", " ")}
          </span>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-black/60">Lines by Zone</p>
          {Array.isArray(task.lines) && task.lines.length > 0 ? (
            (() => {
              const linesByZone = new Map();
              for (const line of task.lines) {
                const zoneKey = line.zoneName || task.zone?.name || "Unknown zone";
                if (!linesByZone.has(zoneKey)) linesByZone.set(zoneKey, []);
                linesByZone.get(zoneKey).push(line);
              }
              return [...linesByZone.entries()].map(([zoneName, zoneLines]) => (
                <div key={zoneName} className="space-y-2">
                  <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-1.5">
                    <p className="text-xs font-bold text-accent uppercase tracking-wide">{zoneName}</p>
                  </div>
                  <ul className="space-y-2">
                    {zoneLines.map((line) => (
                      <li key={line.id} className="rounded-xl border border-black/10 p-3">
                        <p className="text-sm font-semibold">
                          {line.sku}{line.skuDescription ? ` - ${line.skuDescription}` : ""}
                        </p>
                        <p className="mt-1 text-sm">Quantity: {line.quantity}</p>
                        <p className="mt-1 text-xs text-black/70">Location: {deriveDisplayLocation(line)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ));
            })()
          ) : (
            <p className="text-sm text-black/60">No line details found for this task.</p>
          )}
        </div>

        {isCompletePanelOpen && (
          <div className="rounded-xl border border-black/10 bg-canvas p-3">
            <p className="text-sm font-semibold">Confirm processed quantity</p>
            <p className="mt-1 text-xs text-black/60">Expected total units: {expectedTaskQuantity || "N/A"}</p>
            <input
              type="number"
              min="1"
              className="mt-2 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              value={confirmedQuantity}
              onChange={(event) => setConfirmedQuantity(event.target.value)}
              placeholder="Enter confirmed quantity"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-semibold"
                onClick={() => {
                  setIsCompletePanelOpen(false);
                  setConfirmedQuantity("");
                }}
                disabled={actionLoading === "complete"}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={handleCompleteTask}
                disabled={actionLoading === "complete"}
              >
                {actionLoading === "complete" ? "Completing..." : "Confirm Complete"}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          {isStartAllowed && (
            <button
              type="button"
              className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleStartTask}
              disabled={Boolean(actionLoading)}
            >
              {actionLoading === "start" ? "Starting..." : task.status === "paused" ? "Resume Task" : "Start Task"}
            </button>
          )}

          {isPauseAllowed && (
            <button
              type="button"
              className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handlePauseTask}
              disabled={Boolean(actionLoading)}
            >
              {actionLoading === "pause" ? "Pausing..." : "Pause"}
            </button>
          )}

          {isCompleteAllowed && (
            <button
              type="button"
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setErrorMessage("");
                setConfirmedQuantity(String(expectedTaskQuantity || ""));
                setIsCompletePanelOpen(true);
              }}
              disabled={Boolean(actionLoading)}
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Operator Screen ──────────────────────────────────────────── */

function OperatorTaskScreen({ jwtToken, user, onAuthError, onLogout }) {
  const operatorId = user?.operatorId || "";
  const [operatorStatus, setOperatorStatus] = useState("unknown");

  const [tasks, setTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [socketState, setSocketState] = useState("disconnected");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const socketRef = useRef(null);
  const selectedTaskRef = useRef(null);

  // Keep ref in sync so loadAllTasks doesn't depend on selectedTask state
  useEffect(() => {
    selectedTaskRef.current = selectedTask;
  }, [selectedTask]);

  const loadAllTasks = useCallback(
    async ({ suppressLoading = false } = {}) => {
      if (!operatorId) {
        setTasks([]);
        return;
      }

      if (!suppressLoading) {
        setIsLoadingTasks(true);
      }
      setErrorMessage("");

      try {
        const allTasks = [];

        for (const status of ACTIVE_STATUS_ORDER) {
          const limit = 50;
          const query = toQueryString({
            status,
            operator_id: operatorId,
            page: 1,
            limit
          });
          const listPayload = await fetchJson(`/api/tasks?${query}`, { jwtToken, onAuthError });
          const items = Array.isArray(listPayload) ? listPayload : (listPayload.items || []);
          for (const item of items) {
            if (item?.id) {
              const fullTask = await fetchJson(`/api/tasks/${item.id}`, { jwtToken, onAuthError });
              allTasks.push(fullTask);
            }
          }
        }

        setTasks(allTasks);

        // Update selected task if it's still in the list
        const currentSelected = selectedTaskRef.current;
        if (currentSelected) {
          const updated = allTasks.find((t) => t.id === currentSelected.id);
          if (updated) {
            setSelectedTask(updated);
          } else {
            // Task no longer active (completed/cancelled) - go back to list
            setSelectedTask(null);
          }
        }
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        if (!suppressLoading) {
          setIsLoadingTasks(false);
        }
      }
    },
    [jwtToken, onAuthError, operatorId]
  );

  useEffect(() => {
    loadAllTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorId, jwtToken]);

  useEffect(() => {
    if (!operatorId || !jwtToken) {
      setSocketState("disconnected");
      setOperatorStatus("unknown");
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return () => {};
    }

    setSocketState("connecting");
    const socket = io(getSocketBaseUrl(), {
      auth: { token: jwtToken }
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketState("connected");
    });

    socket.on("disconnect", () => {
      setSocketState("disconnected");
    });

    socket.on("connect_error", (error) => {
      setSocketState("error");
      const msg = error.message || "WebSocket connection failed";
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("unauthorized")) {
        if (onAuthError) onAuthError();
        return;
      }
      setErrorMessage(msg);
    });

    const reloadFromRealtime = () => {
      loadAllTasks({ suppressLoading: true });
    };

    socket.on("TASK_ASSIGNED", (payload) => {
      if (payload?.operatorId && payload.operatorId !== operatorId) return;
      reloadFromRealtime();
    });

    socket.on("TASK_UPDATED", (payload) => {
      if (payload?.operatorId && payload.operatorId !== operatorId) return;
      reloadFromRealtime();
    });

    socket.on("OPERATOR_STATUS_UPDATED", (payload) => {
      if (!payload || payload.operatorId !== operatorId) return;
      setOperatorStatus(payload.status || "unknown");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [jwtToken, operatorId, onAuthError, loadAllTasks]);

  const handleTaskUpdate = useCallback((updatedTask, loadingAction) => {
    setActionLoading(loadingAction);
    setSelectedTask(updatedTask);
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  }, []);

  const handleSelectTask = (task) => {
    setSelectedTask(task);
  };

  const handleBackToList = useCallback(() => {
    setSelectedTask(null);
    selectedTaskRef.current = null;
    loadAllTasks({ suppressLoading: true });
  }, [loadAllTasks]);

  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const pausedTasks = tasks.filter((t) => t.status === "paused");
  const assignedTasks = tasks.filter((t) => t.status === "assigned");

  const selectedExpectedQuantity = useMemo(() => {
    if (!selectedTask || !Array.isArray(selectedTask.lines)) return 0;
    return selectedTask.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  }, [selectedTask]);

  return (
    <main className="min-h-screen bg-canvas px-3 pb-6 pt-3 text-ink safe-top safe-bottom">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
        {/* ── Top bar ──────────────────────────────────────────── */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/Greenlights_icon.png" alt="Greenlights" className="h-6 w-auto" />
          </div>
          <button
            type="button"
            className="relative flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold shadow-sm"
            onClick={() => setShowSettings(true)}
          >
            <IconUser className="h-4 w-4 text-black/50" />
            <span className="max-w-[120px] truncate">{user?.displayName || user?.username || "User"}</span>
            {socketState === "connected" && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            )}
          </button>
        </header>

        {showSettings && (
          <UserSettingsPanel
            user={user}
            operatorId={operatorId}
            operatorStatus={operatorStatus}
            socketState={socketState}
            onLogout={onLogout}
            onClose={() => setShowSettings(false)}
          />
        )}

        {errorMessage && (
          <section className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
            {errorMessage}
          </section>
        )}

        {/* ── Task detail view or task list ────────────────────── */}
        {selectedTask ? (
          <TaskDetailView
            task={selectedTask}
            actionLoading={actionLoading}
            operatorId={operatorId}
            jwtToken={jwtToken}
            onAuthError={onAuthError}
            onBack={handleBackToList}
            onTaskUpdate={handleTaskUpdate}
            expectedTaskQuantity={selectedExpectedQuantity}
          />
        ) : (
          <>
            <h1 className="text-xl font-black">My Tasks</h1>

            {isLoadingTasks ? (
              <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
                <p className="text-sm text-black/60">Loading tasks...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white p-6 text-center space-y-2">
                <p className="text-sm font-semibold">No tasks assigned</p>
                <p className="text-xs text-black/50">New tasks will appear automatically when assigned.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* In Progress */}
                {inProgressTasks.length > 0 && (
                  <TaskGroup label="In Progress" tasks={inProgressTasks} onSelect={handleSelectTask} accentColor="amber" />
                )}

                {/* Paused */}
                {pausedTasks.length > 0 && (
                  <TaskGroup label="Paused" tasks={pausedTasks} onSelect={handleSelectTask} accentColor="orange" />
                )}

                {/* Assigned (pending) */}
                {assignedTasks.length > 0 && (
                  <TaskGroup label="Pending" tasks={assignedTasks} onSelect={handleSelectTask} accentColor="cyan" />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/* ── Task Group (list section) ─────────────────────────────────────── */

function TaskGroup({ label, tasks, onSelect, accentColor }) {
  const borderColor = {
    amber: "border-l-amber-500",
    orange: "border-l-orange-500",
    cyan: "border-l-cyan-500"
  }[accentColor] || "border-l-slate-400";

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50">{label} ({tasks.length})</p>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => {
          const badgeClass = statusBadgeClassNameMap[task.status] || "border-slate-300 bg-slate-100 text-slate-700";
          const totalQty = Array.isArray(task.lines)
            ? task.lines.reduce((s, l) => s + Number(l.quantity || 0), 0)
            : task.totalQuantity || 0;

          return (
            <button
              key={task.id}
              type="button"
              className={`w-full rounded-xl border border-black/10 ${borderColor} border-l-4 bg-white p-3 text-left shadow-sm active:bg-canvas transition`}
              onClick={() => onSelect(task)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold capitalize">{String(task.type).replace("_", " ")}</p>
                  <p className="mt-0.5 text-xs text-black/60">
                    {(() => {
                      if (task.zone?.name) return task.zone.name;
                      if (Array.isArray(task.lines) && task.lines.length > 0) {
                        const zoneNames = [...new Set(task.lines.map((l) => l.zoneName).filter(Boolean))];
                        return zoneNames.length > 0 ? zoneNames.join(", ") : "Unknown zone";
                      }
                      return "Unknown zone";
                    })()}
                    {totalQty > 0 ? ` · ${totalQty} units` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClass}`}>
                  {String(task.status).replace("_", " ")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default OperatorTaskScreen;
