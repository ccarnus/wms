import React, { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { fetchJson, getSocketBaseUrl, toQueryString } from "./lib/api";
import {
  Badge,
  ClearFiltersButton,
  DataTable,
  ErrorBanner,
  FilterSelect,
  PageHeader,
  SearchInput,
  Section,
  StatCard,
  toTitleCase
} from "./components/ui";

const OPERATOR_STATUS_TONES = {
  available: "green",
  busy: "amber",
  offline: "gray"
};

const ZONE_TYPE_TONES = {
  pick: "blue",
  bulk: "amber",
  dock: "purple",
  staging: "cyan",
  packing: "teal"
};

const formatSeconds = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "0s";
  if (numericValue < 60) return `${numericValue.toFixed(0)}s`;
  return `${(numericValue / 60).toFixed(1)}m`;
};

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
  const [inventoryAlerts, setInventoryAlerts] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [assigningTaskId, setAssigningTaskId] = useState(null);
  const [assignError, setAssignError] = useState("");

  const [operatorFilters, setOperatorFilters] = useState({ search: "", status: "" });
  const [taskFilters, setTaskFilters] = useState({ search: "", type: "" });

  const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    try {
      const [overviewResponse, operatorResponse, zoneResponse, pendingResponse, alertsResponse, pendingOrdersResponse] = await Promise.all([
        fetchJson("/api/labor/overview", { jwtToken, onAuthError }),
        fetchJson(`/api/labor/operator-performance?${toQueryString({ page: 1, limit: 200 })}`, { jwtToken, onAuthError }),
        fetchJson(`/api/labor/zone-workload?${toQueryString({ page: 1, limit: 200 })}`, { jwtToken, onAuthError }),
        fetchJson(`/api/tasks?${toQueryString({ status: "created", page: 1, limit: 200 })}`, { jwtToken, onAuthError }),
        fetchJson(`/api/sales-orders/alerts?${toQueryString({ page: 1, limit: 200 })}`, { jwtToken, onAuthError }),
        fetchJson(`/api/sales-orders?${toQueryString({ status: "pending_inventory", page: 1, limit: 200 })}`, { jwtToken, onAuthError })
      ]);

      setOverview(overviewResponse || null);
      setOperatorRows(Array.isArray(operatorResponse?.items) ? operatorResponse.items : []);
      setZoneRows(Array.isArray(zoneResponse?.items) ? zoneResponse.items : []);
      setPendingTasks(Array.isArray(pendingResponse?.items) ? pendingResponse.items : []);
      setInventoryAlerts(Array.isArray(alertsResponse?.items) ? alertsResponse.items : []);
      setPendingOrders(Array.isArray(pendingOrdersResponse?.items) ? pendingOrdersResponse.items : []);
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
      await fetchJson(`/api/tasks/${taskId}/assign`, {
        jwtToken,
        onAuthError,
        method: "POST",
        body: JSON.stringify({ operatorId })
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
    if (!jwtToken) return () => {};
    const socket = io(getSocketBaseUrl(), { auth: { token: jwtToken } });
    const refreshFromSocketEvent = () => loadDashboardData({ silent: true });
    socket.on("connect_error", (error) => {
      const msg = (error.message || "").toLowerCase();
      if ((msg.includes("expired") || msg.includes("unauthorized")) && onAuthError) onAuthError();
    });
    socket.on("TASK_ASSIGNED", refreshFromSocketEvent);
    socket.on("TASK_UPDATED", refreshFromSocketEvent);
    socket.on("OPERATOR_STATUS_UPDATED", refreshFromSocketEvent);
    socket.on("SALES_ORDER_UPDATED", refreshFromSocketEvent);
    socket.on("INVENTORY_ALERT", refreshFromSocketEvent);
    return () => socket.disconnect();
  }, [loadDashboardData, jwtToken, onAuthError]);

  /* ── KPIs ──────────────────────────────────────────────────── */

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
      { id: "activeTasks", label: "Active Tasks", value: activeTasks, hint: "assigned + in progress + paused" },
      { id: "tasksCompleted", label: "Tasks Completed Today", value: Number(overview?.tasksCompleted || 0), hint: "from labor daily metrics", tone: "accent" },
      { id: "ordersPending", label: "Orders Pending", value: ordersPending, hint: "derived from pending task states" },
      { id: "averagePickTime", label: "Average Pick Time", value: formatSeconds(overview?.avgTaskTime), hint: "today average task time" }
    ];
  }, [overview]);

  const maxZonePendingTasks = useMemo(
    () => zoneRows.reduce((maxValue, zone) => Math.max(maxValue, getPendingZoneTasks(zone)), 0),
    [zoneRows]
  );

  /* ── Filtering ─────────────────────────────────────────────── */

  const filteredOperators = useMemo(() => {
    const search = operatorFilters.search.trim().toLowerCase();
    return operatorRows.filter((op) => {
      if (operatorFilters.status && op.status !== operatorFilters.status) return false;
      if (search && !(op.operatorName || "").toLowerCase().includes(search)) return false;
      return true;
    });
  }, [operatorRows, operatorFilters]);

  const pendingTaskTypes = useMemo(
    () => [...new Set(pendingTasks.map((t) => t.type))].sort(),
    [pendingTasks]
  );

  const filteredPendingTasks = useMemo(() => {
    const search = taskFilters.search.trim().toLowerCase();
    return pendingTasks.filter((t) => {
      if (taskFilters.type && t.type !== taskFilters.type) return false;
      if (search && !(t.sourceDocumentId || "").toLowerCase().includes(search)) return false;
      return true;
    });
  }, [pendingTasks, taskFilters]);

  /* ── Columns ───────────────────────────────────────────────── */

  const operatorColumns = [
    { key: "operatorName", label: "Name", render: (op) => <span className="font-semibold">{op.operatorName}</span> },
    {
      key: "status",
      label: "Status",
      render: (op) => <Badge tone={OPERATOR_STATUS_TONES[op.status]}>{toTitleCase(op.status)}</Badge>
    },
    {
      key: "currentZoneName",
      label: "Zone",
      sortValue: (op) => (op.currentTaskStatus === "in_progress" ? op.currentZoneName || "" : ""),
      render: (op) =>
        op.currentTaskStatus === "in_progress" && op.currentZoneName ? (
          <Badge tone="accent">{op.currentZoneName}</Badge>
        ) : (
          <span className="text-xs text-black/30">—</span>
        )
    },
    {
      key: "currentTaskType",
      label: "Current Task",
      sortValue: (op) => (op.currentTaskStatus === "in_progress" ? op.currentTaskType || "" : ""),
      render: (op) =>
        op.currentTaskStatus === "in_progress" ? toTitleCase(op.currentTaskType) : <span className="text-black/30">—</span>
    }
  ];

  const taskColumns = [
    { key: "type", label: "Type", render: (t) => <span className="font-semibold">{toTitleCase(t.type)}</span> },
    {
      key: "priority",
      label: "Priority",
      align: "center",
      sortValue: (t) => Number(t.priority),
      render: (t) => <Badge tone="gray">{t.priority}</Badge>
    },
    {
      key: "zoneId",
      label: "Zone",
      sortValue: (t) => zoneNameMap[t.zoneId] || "",
      render: (t) => zoneNameMap[t.zoneId] || (t.zoneId ? "—" : "Multiple")
    },
    { key: "sourceDocumentId", label: "Source", cellClassName: "text-xs text-black/60" },
    {
      key: "estimatedTimeSeconds",
      label: "Est. Time",
      align: "center",
      sortValue: (t) => Number(t.estimatedTimeSeconds),
      render: (t) => formatSeconds(t.estimatedTimeSeconds)
    },
    {
      key: "assign",
      label: "Assign",
      sortable: false,
      render: (t) => (
        <select
          className="rounded-lg border border-black/15 bg-canvas px-2 py-1 text-xs"
          defaultValue=""
          disabled={assigningTaskId === t.id}
          onChange={(e) => {
            if (e.target.value) {
              handleAssignTask(t.id, e.target.value);
              e.target.value = "";
            }
          }}
        >
          <option value="" disabled>
            {assigningTaskId === t.id ? "Assigning..." : "Assign to..."}
          </option>
          {operatorRows.map((op) => (
            <option key={op.operatorId} value={op.operatorId}>
              {op.operatorName} ({toTitleCase(op.status)})
            </option>
          ))}
        </select>
      )
    }
  ];

  const operatorsFiltered = operatorFilters.search || operatorFilters.status;
  const tasksFiltered = taskFilters.search || taskFilters.type;

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <PageHeader
          eyebrow="Manager Console"
          title="Labor Dashboard"
          subtitle="Workforce status, task assignment, and zone workload"
        />

        <ErrorBanner message={errorMessage} />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <StatCard key={kpi.id} loading={isLoading} label={kpi.label} value={kpi.value} hint={kpi.hint} tone={kpi.tone} />
          ))}
        </section>

        {inventoryAlerts.length > 0 && (
          <Section
            title={<span className="text-signal">Inventory Alerts</span>}
            meta={<Badge tone="rose">{inventoryAlerts.length} shortage{inventoryAlerts.length !== 1 ? "s" : ""}</Badge>}
            className="border-signal/30 bg-signal/5"
          >
            <p className="mb-3 text-xs text-black/60">
              Orders held — insufficient pick inventory. Stock must be replenished before these orders can be released.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {inventoryAlerts.map((alert) => (
                <article key={alert.id} className="rounded-xl border border-signal/20 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{alert.sourceDocumentId}</p>
                      <p className="mt-0.5 text-xs text-black/60">
                        SKU: <span className="font-semibold">{alert.sku}</span>
                        {alert.skuDescription ? ` — ${alert.skuDescription}` : ""}
                      </p>
                    </div>
                    <Badge tone="rose">SHORT</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-canvas p-1.5">
                      <p className="text-lg font-black">{alert.requiredQuantity}</p>
                      <p className="text-[10px] text-black/50">Required</p>
                    </div>
                    <div className="rounded-lg bg-canvas p-1.5">
                      <p className="text-lg font-black">{alert.availableQuantity}</p>
                      <p className="text-[10px] text-black/50">Available</p>
                    </div>
                    <div className="rounded-lg bg-signal/10 p-1.5">
                      <p className="text-lg font-black text-signal">{alert.shortage}</p>
                      <p className="text-[10px] text-signal/70">Shortage</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Section>
        )}

        {pendingOrders.length > 0 && inventoryAlerts.length === 0 && (
          <Section
            title={<span className="text-amber-700">Pending Orders</span>}
            meta={<Badge tone="amber">{pendingOrders.length}</Badge>}
            className="border-amber-200 bg-amber-50/50"
          >
            <p className="text-xs text-black/60">Orders waiting for inventory to become available.</p>
          </Section>
        )}

        <Section
          title="Operator Grid"
          meta={`${filteredOperators.length} of ${operatorRows.length} operators`}
          toolbar={
            <>
              <SearchInput
                value={operatorFilters.search}
                onChange={(search) => setOperatorFilters((f) => ({ ...f, search }))}
                placeholder="Search operator…"
                className="w-56"
              />
              <FilterSelect
                value={operatorFilters.status}
                onChange={(status) => setOperatorFilters((f) => ({ ...f, status }))}
                options={Object.keys(OPERATOR_STATUS_TONES).map((s) => ({ value: s, label: toTitleCase(s) }))}
                allLabel="All statuses"
              />
              <ClearFiltersButton
                visible={Boolean(operatorsFiltered)}
                onClear={() => setOperatorFilters({ search: "", status: "" })}
              />
            </>
          }
        >
          <DataTable
            columns={operatorColumns}
            rows={filteredOperators}
            rowKey={(op) => op.operatorId}
            loading={isLoading}
            emptyTitle={operatorRows.length === 0 ? "No operators yet" : "No operators match the current filters"}
            initialSort={{ key: "operatorName", dir: "asc" }}
            pageSize={10}
            paginationLabel="operators"
            minWidth="min-w-[640px]"
          />
        </Section>

        <Section
          title="Pending Tasks"
          meta={`${filteredPendingTasks.length} of ${pendingTasks.length} tasks`}
          toolbar={
            <>
              <SearchInput
                value={taskFilters.search}
                onChange={(search) => setTaskFilters((f) => ({ ...f, search }))}
                placeholder="Search source document…"
                className="w-56"
              />
              <FilterSelect
                value={taskFilters.type}
                onChange={(type) => setTaskFilters((f) => ({ ...f, type }))}
                options={pendingTaskTypes.map((t) => ({ value: t, label: toTitleCase(t) }))}
                allLabel="All types"
              />
              <ClearFiltersButton visible={Boolean(tasksFiltered)} onClear={() => setTaskFilters({ search: "", type: "" })} />
            </>
          }
        >
          {assignError && <div className="mb-3"><ErrorBanner message={assignError} /></div>}
          <DataTable
            columns={taskColumns}
            rows={filteredPendingTasks}
            rowKey={(t) => t.id}
            loading={isLoading}
            emptyTitle={pendingTasks.length === 0 ? "No pending tasks" : "No tasks match the current filters"}
            initialSort={{ key: "priority", dir: "desc" }}
            pageSize={10}
            paginationLabel="tasks"
            minWidth="min-w-[760px]"
          />
        </Section>

        <Section title="Zones" meta={`${zoneRows.length} zones`}>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`zone-loading-${index}`} className="h-24 animate-pulse rounded-xl bg-canvas" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {zoneRows.map((zone) => {
                const zonePendingTasks = getPendingZoneTasks(zone);
                const heatStyle = getHeatCellStyle(zonePendingTasks, maxZonePendingTasks);
                return (
                  <article
                    key={zone.zoneId}
                    className="flex flex-col justify-between rounded-xl border p-3"
                    style={heatStyle}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="truncate text-sm font-bold leading-tight">{zone.zoneName}</p>
                      <Badge tone={ZONE_TYPE_TONES[zone.zoneType]} className="!px-1.5 !text-[9px] uppercase">
                        {zone.zoneType}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-black leading-none">{zonePendingTasks}</p>
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
        </Section>
      </div>
    </main>
  );
}

export default ManagerLaborDashboard;
