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

async function fetchJson(path, { jwtToken = "", ...options } = {}) {
  const response = await fetch(buildApiUrl(path), {
    headers: getAuthHeaders(jwtToken),
    ...options
  });
  if (!response.ok) {
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

const findTaskFromTaskListResponse = (payload) => {
  if (!payload) {
    return null;
  }
  if (Array.isArray(payload)) {
    return payload[0] || null;
  }
  if (Array.isArray(payload.items)) {
    return payload.items[0] || null;
  }
  return null;
};

const deriveDisplayLocation = (taskLine) => {
  const fromLocation = taskLine.fromLocationCode || "External";
  const toLocation = taskLine.toLocationCode || "External";
  return `${fromLocation} -> ${toLocation}`;
};

const getInitialStoredValue = (key, fallbackValue = "") => {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  const storedValue = window.localStorage.getItem(key);
  if (!storedValue) {
    return fallbackValue;
  }
  return storedValue;
};

function OperatorTaskScreen() {
  const [operatorId, setOperatorId] = useState(() => getInitialStoredValue("wms.operator.id"));
  const [jwtToken, setJwtToken] = useState(() => getInitialStoredValue("wms.operator.jwt"));
  const [operatorStatus, setOperatorStatus] = useState("unknown");

  const [task, setTask] = useState(null);
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [socketState, setSocketState] = useState("disconnected");

  const [isCompletePanelOpen, setIsCompletePanelOpen] = useState(false);
  const [confirmedQuantity, setConfirmedQuantity] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem("wms.operator.id", operatorId);
  }, [operatorId]);

  useEffect(() => {
    window.localStorage.setItem("wms.operator.jwt", jwtToken);
  }, [jwtToken]);

  const expectedTaskQuantity = useMemo(() => {
    if (!task || !Array.isArray(task.lines)) {
      return 0;
    }
    return task.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  }, [task]);

  const loadTaskById = useCallback(
    async (taskId) => {
      if (!taskId) {
        return null;
      }
      return fetchJson(`/api/tasks/${taskId}`, { jwtToken });
    },
    [jwtToken]
  );

  const loadCurrentTask = useCallback(
    async ({ suppressLoading = false } = {}) => {
      if (!operatorId) {
        setTask(null);
        return null;
      }

      if (!suppressLoading) {
        setIsLoadingTask(true);
      }
      setErrorMessage("");

      try {
        for (const status of ACTIVE_STATUS_ORDER) {
          const query = toQueryString({
            status,
            operator_id: operatorId,
            page: 1,
            limit: 1
          });
          const listPayload = await fetchJson(`/api/tasks?${query}`, { jwtToken });
          const candidateTask = findTaskFromTaskListResponse(listPayload);
          if (candidateTask?.id) {
            const fullTask = await loadTaskById(candidateTask.id);
            setTask(fullTask);
            return fullTask;
          }
        }

        setTask(null);
        return null;
      } catch (error) {
        setErrorMessage(error.message);
        return null;
      } finally {
        if (!suppressLoading) {
          setIsLoadingTask(false);
        }
      }
    },
    [jwtToken, loadTaskById, operatorId]
  );

  useEffect(() => {
    loadCurrentTask();
  }, [loadCurrentTask]);

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
      setInfoMessage("Connected to realtime assignments");
    });

    socket.on("disconnect", () => {
      setSocketState("disconnected");
    });

    socket.on("connect_error", (error) => {
      setSocketState("error");
      setErrorMessage(error.message || "WebSocket connection failed");
    });

    const reloadTaskFromRealtime = () => {
      loadCurrentTask({ suppressLoading: true });
    };

    socket.on("TASK_ASSIGNED", (payload) => {
      if (payload?.operatorId && payload.operatorId !== operatorId) {
        return;
      }
      setInfoMessage("New task assignment received");
      reloadTaskFromRealtime();
    });

    socket.on("TASK_UPDATED", (payload) => {
      if (payload?.operatorId && payload.operatorId !== operatorId) {
        return;
      }
      if (payload?.taskId && task?.id && payload.taskId !== task.id) {
        return;
      }
      setInfoMessage("Task update received");
      reloadTaskFromRealtime();
    });

    socket.on("OPERATOR_STATUS_UPDATED", (payload) => {
      if (!payload || payload.operatorId !== operatorId) {
        return;
      }
      setOperatorStatus(payload.status || "unknown");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [jwtToken, loadCurrentTask, operatorId, task?.id]);

  const submitTaskAction = useCallback(
    async ({ actionName, endpoint, optimisticStatus, quantity }) => {
      if (!task?.id) {
        return;
      }

      setErrorMessage("");
      setInfoMessage("");

      const previousTask = task;
      const optimisticTask = {
        ...previousTask,
        status: optimisticStatus,
        version: Number(previousTask.version || 0) + 1
      };

      setTask(optimisticTask);
      setActionLoading(actionName);

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

        setTask(hydratedUpdatedTask);
        setInfoMessage(`Task ${endpoint} succeeded`);

        if (endpoint === "complete") {
          setIsCompletePanelOpen(false);
          setConfirmedQuantity("");
          await loadCurrentTask({ suppressLoading: true });
        }
      } catch (error) {
        setTask(previousTask);
        setErrorMessage(error.message);
      } finally {
        setActionLoading("");
      }
    },
    [expectedTaskQuantity, jwtToken, loadCurrentTask, operatorId, task]
  );

  const handleStartTask = () =>
    submitTaskAction({
      actionName: "start",
      endpoint: "start",
      optimisticStatus: "in_progress"
    });

  const handlePauseTask = () =>
    submitTaskAction({
      actionName: "pause",
      endpoint: "pause",
      optimisticStatus: "paused"
    });

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
      if (!keepGoing) {
        return;
      }
    }

    await submitTaskAction({
      actionName: "complete",
      endpoint: "complete",
      optimisticStatus: "completed",
      quantity: numericConfirmedQuantity
    });
  };

  const statusBadgeClassName =
    statusBadgeClassNameMap[task?.status] || "border-slate-300 bg-slate-100 text-slate-700";

  const isStartAllowed = task && ["assigned", "paused"].includes(task.status);
  const isPauseAllowed = task && task.status === "in_progress";
  const isCompleteAllowed = task && task.status === "in_progress";

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <header className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Operator Interface</p>
          <h1 className="mt-1 text-2xl font-black">My Current Task</h1>
          <p className="mt-2 text-xs text-black/60">API: {apiDisplayUrl}</p>
        </header>

        <section className="rounded-2xl border border-black/10 bg-white p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-black/70">Session</h2>
          <div className="mt-3 grid gap-3">
            <label className="text-sm">
              Operator ID
              <input
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                value={operatorId}
                onChange={(event) => setOperatorId(event.target.value.trim())}
                placeholder="UUID"
              />
            </label>

            <label className="text-sm">
              JWT Token (for WebSocket auth)
              <textarea
                className="mt-1 min-h-[72px] w-full rounded-lg border border-black/15 px-3 py-2 text-xs"
                value={jwtToken}
                onChange={(event) => setJwtToken(event.target.value.trim())}
                placeholder="Paste bearer JWT"
              />
            </label>

            <button
              type="button"
              className="rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm font-semibold"
              onClick={() => loadCurrentTask()}
            >
              Refresh Task
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-black/15 bg-black/5 px-2 py-1">
              Socket: {socketState}
            </span>
            <span className="rounded-full border border-black/15 bg-black/5 px-2 py-1">
              Operator status: {operatorStatus}
            </span>
          </div>
        </section>

        {errorMessage && (
          <section className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
            {errorMessage}
          </section>
        )}

        {infoMessage && (
          <section className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent">
            {infoMessage}
          </section>
        )}

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          {isLoadingTask ? (
            <p className="text-sm text-black/70">Loading your current task...</p>
          ) : !task ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">No active task assigned.</p>
              <p className="text-xs text-black/60">Waiting for `TASK_ASSIGNED` realtime events.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-black/60">Task type</p>
                  <p className="text-xl font-black capitalize">{String(task.type).replace("_", " ")}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusBadgeClassName}`}>
                  {String(task.status).replace("_", " ")}
                </span>
              </div>

              <div className="rounded-xl border border-black/10 bg-canvas p-3">
                <p className="text-xs uppercase tracking-wide text-black/60">Zone</p>
                <p className="text-sm font-semibold">
                  {task.zone?.name || "Unknown zone"}
                  {task.zone?.type ? ` (${task.zone.type})` : ""}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-black/60">Lines</p>
                {Array.isArray(task.lines) && task.lines.length > 0 ? (
                  <ul className="space-y-2">
                    {task.lines.map((line) => (
                      <li key={line.id} className="rounded-xl border border-black/10 p-3">
                        <p className="text-sm font-semibold">
                          {line.sku} - {line.skuName}
                        </p>
                        <p className="mt-1 text-sm">Quantity: {line.quantity}</p>
                        <p className="mt-1 text-xs text-black/70">Location: {deriveDisplayLocation(line)}</p>
                      </li>
                    ))}
                  </ul>
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
                <button
                  type="button"
                  className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleStartTask}
                  disabled={Boolean(actionLoading) || !isStartAllowed}
                >
                  {actionLoading === "start" ? "Starting..." : "Start Task"}
                </button>

                <button
                  type="button"
                  className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handlePauseTask}
                  disabled={Boolean(actionLoading) || !isPauseAllowed}
                >
                  {actionLoading === "pause" ? "Pausing..." : "Pause"}
                </button>

                <button
                  type="button"
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    setErrorMessage("");
                    setConfirmedQuantity(String(expectedTaskQuantity || ""));
                    setIsCompletePanelOpen(true);
                  }}
                  disabled={Boolean(actionLoading) || !isCompleteAllowed}
                >
                  Complete
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default OperatorTaskScreen;
