import React, { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const runtimeApiBaseUrl = typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "";
const apiBaseUrl = String(runtimeApiBaseUrl || "").replace(/\/+$/, "");
const buildApiUrl = (path) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

const operatorStatusClassNameMap = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  busy: "border-amber-200 bg-amber-50 text-amber-700",
  offline: "border-slate-300 bg-slate-100 text-slate-700"
};

const PAGE_SIZE = 10;

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

async function fetchJson(path, jwtToken = "", onAuthError = null) {
  const response = await fetch(buildApiUrl(path), {
    headers: getAuthHeaders(jwtToken)
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

const formatSeconds = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "0s";
  }
  if (numericValue < 60) {
    return `${numericValue.toFixed(0)}s`;
  }
  const minutes = numericValue / 60;
  return `${minutes.toFixed(1)}m`;
};

const toTitleCase = (value) =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const getPendingZoneTasks = (zone) =>
  Number(zone.createdTasks || 0) +
  Number(zone.assignedTasks || 0) +
  Number(zone.inProgressTasks || 0) +
  Number(zone.pausedTasks || 0);

const getHeatCellStyle = (value, maxValue) => {
  const safeMax = Math.max(maxValue, 1);
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const hue = 160 - Math.round(130 * ratio);
  const lightness = 96 - Math.round(38 * ratio);
  return {
    backgroundColor: `hsl(${hue} 78% ${lightness}%)`,
    borderColor: `hsl(${hue} 60% ${Math.max(22, lightness - 32)}%)`
  };
};

function ManagerLaborDashboard({ jwtToken, user, onAuthError }) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [overview, setOverview] = useState(null);
  const [operatorRows, setOperatorRows] = useState([]);
  const [zoneRows, setZoneRows] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [assigningTaskId, setAssigningTaskId] = useState(null);
  const [assignError, setAssignError] = useState("");
  const [operatorPage, setOperatorPage] = useState(1);
  const [taskPage, setTaskPage] = useState(1);

  const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const [overviewResponse, operatorResponse, zoneResponse, pendingResponse] = await Promise.all([
        fetchJson("/api/labor/overview", jwtToken, onAuthError),
        fetchJson(`/api/labor/operator-performance?${toQueryString({ page: 1, limit: 200 })}`, jwtToken, onAuthError),
        fetchJson(`/api/labor/zone-workload?${toQueryString({ page: 1, limit: 200 })}`, jwtToken, onAuthError),
        fetchJson(`/api/tasks?${toQueryString({ status: "created", page: 1, limit: 200 })}`, jwtToken, onAuthError)
      ]);

      setOverview(overviewResponse || null);
      setOperatorRows(Array.isArray(operatorResponse?.items) ? operatorResponse.items : []);
      setZoneRows(Array.isArray(zoneResponse?.items) ? zoneResponse.items : []);
      setPendingTasks(Array.isArray(pendingResponse?.items) ? pendingResponse.items : []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message || "Failed to load labor dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [jwtToken, onAuthError]);

  const zoneNameMap = useMemo(() => {
    const map = {};
    for (const zone of zoneRows) {
      map[zone.zoneId] = zone.zoneName;
    }
    return map;
  }, [zoneRows]);

  const handleAssignTask = useCallback(async (taskId, operatorId) => {
    setAssigningTaskId(taskId);
    setAssignError("");
    try {
      await fetch(buildApiUrl(`/api/tasks/${taskId}/assign`), {
        method: "POST",
        headers: getAuthHeaders(jwtToken),
        body: JSON.stringify({ operatorId })
      }).then(async (res) => {
        if (!res.ok) {
          if (res.status === 401 && onAuthError) {
            onAuthError();
          }
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || `Assignment failed: ${res.status}`);
        }
      });
      await loadDashboardData({ silent: true });
    } catch (error) {
      setAssignError(error.message || "Failed to assign task");
    } finally {
      setAssigningTaskId(null);
    }
  }, [jwtToken, onAuthError, loadDashboardData]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!jwtToken) {
      return () => {};
    }

    const socket = io(getSocketBaseUrl(), {
      auth: { token: jwtToken }
    });

    const refreshFromSocketEvent = () => {
      loadDashboardData({ silent: true });
    };

    socket.on("connect_error", (error) => {
      const msg = error.message || "Realtime connection failed";
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("unauthorized")) {
        if (onAuthError) onAuthError();
      }
    });

    socket.on("TASK_ASSIGNED", refreshFromSocketEvent);
    socket.on("TASK_UPDATED", refreshFromSocketEvent);
    socket.on("OPERATOR_STATUS_UPDATED", refreshFromSocketEvent);

    return () => {
      socket.disconnect();
    };
  }, [loadDashboardData, jwtToken, onAuthError]);

  const kpis = useMemo(() => {
    const activeTasks =
      Number(overview?.assignedTasks || 0) +
      Number(overview?.inProgressTasks || 0) +
      Number(overview?.pausedTasks || 0);

    const ordersPending =
      Number(overview?.createdTasks || 0) +
      Number(overview?.assignedTasks || 0) +
      Number(overview?.inProgressTasks || 0) +
      Number(overview?.pausedTasks || 0);

    return [
      {
        id: "activeTasks",
        title: "Active Tasks",
        value: activeTasks,
        hint: "assigned + in progress + paused"
      },
      {
        id: "tasksCompleted",
        title: "Tasks Completed Today",
        value: Number(overview?.tasksCompleted || 0),
        hint: "from labor daily metrics"
      },
      {
        id: "ordersPending",
        title: "Orders Pending",
        value: ordersPending,
        hint: "derived from pending task states"
      },
      {
        id: "averagePickTime",
        title: "Average Pick Time",
        value: formatSeconds(overview?.avgTaskTime),
        hint: "today average task time"
      }
    ];
  }, [overview]);

  const maxZonePendingTasks = useMemo(() => {
    return zoneRows.reduce((maxValue, zone) => {
      return Math.max(maxValue, getPendingZoneTasks(zone));
    }, 0);
  }, [zoneRows]);

  const operatorTotalPages = Math.max(1, Math.ceil(operatorRows.length / PAGE_SIZE));
  const safeOperatorPage = Math.min(operatorPage, operatorTotalPages);
  const paginatedOperators = operatorRows.slice((safeOperatorPage - 1) * PAGE_SIZE, safeOperatorPage * PAGE_SIZE);

  const taskTotalPages = Math.max(1, Math.ceil(pendingTasks.length / PAGE_SIZE));
  const safeTaskPage = Math.min(taskPage, taskTotalPages);
  const paginatedTasks = pendingTasks.slice((safeTaskPage - 1) * PAGE_SIZE, safeTaskPage * PAGE_SIZE);

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Manager Console</p>
          <div className="mt-2">
            <h1 className="text-2xl font-black sm:text-3xl">Labor Dashboard</h1>
          </div>
        </header>

        {errorMessage && (
          <section className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
            {errorMessage}
          </section>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <article
                  key={`kpi-loading-${index}`}
                  className="h-28 animate-pulse rounded-2xl border border-black/10 bg-white p-4"
                />
              ))
            : kpis.map((kpi) => (
                <article key={kpi.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-black/60">{kpi.title}</p>
                  <p className="mt-2 text-3xl font-black">{kpi.value}</p>
                  <p className="mt-1 text-xs text-black/50">{kpi.hint}</p>
                </article>
              ))}
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Operator Grid</h2>
            <p className="text-xs text-black/60">{operatorRows.length} operators</p>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`operator-loading-${index}`} className="h-16 animate-pulse rounded-xl bg-canvas" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {paginatedOperators.map((operator) => {
                  const statusClassName =
                    operatorStatusClassNameMap[operator.status] ||
                    "border-slate-300 bg-slate-100 text-slate-700";
                  const isInProgress = operator.currentTaskStatus === "in_progress";
                  return (
                    <article key={operator.operatorId} className="rounded-xl border border-black/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{operator.operatorName}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClassName}`}>
                          {toTitleCase(operator.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-black/60">
                        Current task:{" "}
                        {isInProgress
                          ? toTitleCase(operator.currentTaskType)
                          : "\u2014"}
                      </p>
                      <p className="mt-1 text-xs text-black/60">
                        Zone: {isInProgress && operator.currentZoneName ? operator.currentZoneName : "\u2014"}
                      </p>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-auto md:block">
                <table className="min-w-[640px] w-full text-left text-sm">
                  <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-black/60">
                    <tr>
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Zone</th>
                      <th className="px-2 py-2">Current Task</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOperators.map((operator) => {
                      const statusClassName =
                        operatorStatusClassNameMap[operator.status] ||
                        "border-slate-300 bg-slate-100 text-slate-700";
                      const isInProgress = operator.currentTaskStatus === "in_progress";
                      return (
                        <tr key={operator.operatorId} className="border-b border-black/10">
                          <td className="px-2 py-2 font-semibold">{operator.operatorName}</td>
                          <td className="px-2 py-2">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClassName}`}>
                              {toTitleCase(operator.status)}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {isInProgress && operator.currentZoneName ? (
                              <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                                {operator.currentZoneName}
                              </span>
                            ) : (
                              <span className="text-xs text-black/30">{"\u2014"}</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {isInProgress
                              ? toTitleCase(operator.currentTaskType)
                              : "\u2014"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {operatorTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3">
                  <p className="text-xs text-black/50">
                    Showing {(safeOperatorPage - 1) * PAGE_SIZE + 1}–{Math.min(safeOperatorPage * PAGE_SIZE, operatorRows.length)} of {operatorRows.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-black/15 bg-canvas px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                      disabled={safeOperatorPage <= 1}
                      onClick={() => setOperatorPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="flex items-center px-2 text-xs text-black/60">
                      {safeOperatorPage} / {operatorTotalPages}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border border-black/15 bg-canvas px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                      disabled={safeOperatorPage >= operatorTotalPages}
                      onClick={() => setOperatorPage((p) => Math.min(operatorTotalPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Pending Tasks</h2>
            <p className="text-xs text-black/60">{pendingTasks.length} tasks</p>
          </div>

          {assignError && (
            <div className="mb-3 rounded-lg border border-signal/30 bg-signal/10 px-3 py-2 text-xs text-signal">
              {assignError}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`pending-loading-${index}`} className="h-12 animate-pulse rounded-xl bg-canvas" />
              ))}
            </div>
          ) : pendingTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-black/40">No pending tasks</p>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {paginatedTasks.map((task) => (
                  <article key={task.id} className="rounded-xl border border-black/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{toTitleCase(task.type)}</p>
                      <span className="rounded-full border border-black/10 bg-canvas px-2 py-0.5 text-[10px] font-semibold">
                        P{task.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-black/60">
                      Zone: {zoneNameMap[task.zoneId] || (task.zoneId ? "\u2014" : "Multiple")} &middot; {task.sourceDocumentId}
                    </p>
                    <div className="mt-2">
                      <select
                        className="w-full rounded-lg border border-black/15 bg-canvas px-2 py-1.5 text-xs"
                        defaultValue=""
                        disabled={assigningTaskId === task.id}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAssignTask(task.id, e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="" disabled>
                          {assigningTaskId === task.id ? "Assigning..." : "Assign to..."}
                        </option>
                        {operatorRows.map((op) => (
                          <option key={op.operatorId} value={op.operatorId}>
                            {op.operatorName} ({toTitleCase(op.status)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-auto md:block">
                <table className="min-w-[700px] w-full text-left text-sm">
                  <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-black/60">
                    <tr>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Priority</th>
                      <th className="px-2 py-2">Zone</th>
                      <th className="px-2 py-2">Source</th>
                      <th className="px-2 py-2">Est. Time</th>
                      <th className="px-2 py-2">Assign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTasks.map((task) => (
                      <tr key={task.id} className="border-b border-black/10">
                        <td className="px-2 py-2 font-semibold">{toTitleCase(task.type)}</td>
                        <td className="px-2 py-2">
                          <span className="rounded-full border border-black/10 bg-canvas px-2 py-0.5 text-xs font-semibold">
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-2 py-2">{zoneNameMap[task.zoneId] || (task.zoneId ? "\u2014" : "Multiple")}</td>
                        <td className="px-2 py-2 text-xs text-black/60">{task.sourceDocumentId}</td>
                        <td className="px-2 py-2 text-xs">{formatSeconds(task.estimatedTimeSeconds)}</td>
                        <td className="px-2 py-2">
                          <select
                            className="rounded-lg border border-black/15 bg-canvas px-2 py-1 text-xs"
                            defaultValue=""
                            disabled={assigningTaskId === task.id}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignTask(task.id, e.target.value);
                                e.target.value = "";
                              }
                            }}
                          >
                            <option value="" disabled>
                              {assigningTaskId === task.id ? "Assigning..." : "Assign to..."}
                            </option>
                            {operatorRows.map((op) => (
                              <option key={op.operatorId} value={op.operatorId}>
                                {op.operatorName} ({toTitleCase(op.status)})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {taskTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3">
                  <p className="text-xs text-black/50">
                    Showing {(safeTaskPage - 1) * PAGE_SIZE + 1}–{Math.min(safeTaskPage * PAGE_SIZE, pendingTasks.length)} of {pendingTasks.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-black/15 bg-canvas px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                      disabled={safeTaskPage <= 1}
                      onClick={() => setTaskPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="flex items-center px-2 text-xs text-black/60">
                      {safeTaskPage} / {taskTotalPages}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border border-black/15 bg-canvas px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                      disabled={safeTaskPage >= taskTotalPages}
                      onClick={() => setTaskPage((p) => Math.min(taskTotalPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Zones</h2>
            <p className="text-xs text-black/60">{zoneRows.length} zones</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`zone-loading-${index}`} className="h-24 animate-pulse rounded-xl bg-canvas" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {zoneRows.map((zone) => {
                const pendingTasks = getPendingZoneTasks(zone);
                const heatStyle = getHeatCellStyle(pendingTasks, maxZonePendingTasks);
                const typeBadge = {
                  pick: "border-blue-200 bg-blue-50 text-blue-700",
                  bulk: "border-amber-200 bg-amber-50 text-amber-700",
                  dock: "border-purple-200 bg-purple-50 text-purple-700",
                  staging: "border-cyan-200 bg-cyan-50 text-cyan-700"
                }[zone.zoneType] || "border-black/10 bg-canvas text-black/60";

                return (
                  <article
                    key={zone.zoneId}
                    className="flex flex-col justify-between rounded-xl border p-3"
                    style={heatStyle}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <p className="truncate text-sm font-bold leading-tight">{zone.zoneName}</p>
                        <span className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${typeBadge}`}>
                          {zone.zoneType}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-black leading-none">{pendingTasks}</p>
                        <p className="mt-0.5 text-[10px] text-black/60">pending</p>
                      </div>
                      <div className="text-right text-[10px] text-black/50">
                        <p>{zone.completedTasks} done</p>
                        <p>{zone.totalTasks} total</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default ManagerLaborDashboard;
