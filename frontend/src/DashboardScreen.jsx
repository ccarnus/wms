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
  formatDateTime,
  formatNumber,
  toTitleCase
} from "./components/ui";

const OPEN_TASK_STATUSES = ["created", "assigned", "in_progress", "paused"];
const OPEN_ORDER_STATUSES = ["pending_inventory", "ready", "released"];

const TASK_STATUS_TONES = {
  created: "gray",
  assigned: "blue",
  in_progress: "amber",
  paused: "purple",
  completed: "green",
  cancelled: "gray",
  failed: "red"
};

const ORDER_STATUS_TONES = {
  pending_inventory: "amber",
  ready: "blue",
  released: "teal",
  completed: "green",
  cancelled: "gray"
};

const formatSeconds = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "—";
  if (numericValue < 60) return `${numericValue.toFixed(0)}s`;
  return `${(numericValue / 60).toFixed(1)}m`;
};

const isToday = (value) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
};

function DashboardScreen({ jwtToken, onAuthError }) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [zones, setZones] = useState([]);

  const [taskFilters, setTaskFilters] = useState({ search: "", type: "", status: "" });
  const [orderFilters, setOrderFilters] = useState({ search: "", status: "" });

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    try {
      const [summaryRes, tasksRes, ordersRes, alertsRes, zonesRes] = await Promise.all([
        fetchJson("/api/summary", { jwtToken, onAuthError }),
        fetchJson(`/api/tasks?${toQueryString({ page: 1, limit: 200 })}`, { jwtToken, onAuthError }),
        fetchJson(`/api/sales-orders?${toQueryString({ page: 1, limit: 200 })}`, { jwtToken, onAuthError }),
        fetchJson(`/api/sales-orders/alerts?${toQueryString({ page: 1, limit: 100 })}`, { jwtToken, onAuthError }),
        fetchJson("/api/zones", { jwtToken, onAuthError })
      ]);
      setSummary(summaryRes || null);
      setTasks(Array.isArray(tasksRes?.items) ? tasksRes.items : []);
      setOrders(Array.isArray(ordersRes?.items) ? ordersRes.items : []);
      setAlerts(Array.isArray(alertsRes?.items) ? alertsRes.items : []);
      setZones(Array.isArray(zonesRes) ? zonesRes : []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message || "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [jwtToken, onAuthError]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!jwtToken) return () => {};
    const socket = io(getSocketBaseUrl(), { auth: { token: jwtToken } });
    const refresh = () => loadData({ silent: true });
    socket.on("connect_error", (error) => {
      const msg = (error.message || "").toLowerCase();
      if ((msg.includes("expired") || msg.includes("unauthorized")) && onAuthError) onAuthError();
    });
    socket.on("TASK_ASSIGNED", refresh);
    socket.on("TASK_UPDATED", refresh);
    socket.on("SALES_ORDER_UPDATED", refresh);
    socket.on("INVENTORY_ALERT", refresh);
    socket.on("INVENTORY_UPDATED", refresh);
    return () => socket.disconnect();
  }, [jwtToken, loadData, onAuthError]);

  const zoneNameMap = useMemo(() => {
    const map = {};
    for (const zone of zones) map[zone.id] = zone.name;
    return map;
  }, [zones]);

  /* ── KPIs ──────────────────────────────────────────────────── */

  const openTasks = useMemo(
    () => tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status)),
    [tasks]
  );
  const completedToday = useMemo(
    () => tasks.filter((t) => t.status === "completed" && isToday(t.completedAt)).length,
    [tasks]
  );
  const openOrders = useMemo(
    () => orders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status)),
    [orders]
  );

  /* ── Task table ─────────────────────────────────────────────── */

  const taskTypes = useMemo(() => [...new Set(tasks.map((t) => t.type))].sort(), [tasks]);

  const filteredTasks = useMemo(() => {
    const search = taskFilters.search.trim().toLowerCase();
    return openTasks.filter((t) => {
      if (taskFilters.type && t.type !== taskFilters.type) return false;
      if (taskFilters.status && t.status !== taskFilters.status) return false;
      if (search && !(t.sourceDocumentId || "").toLowerCase().includes(search)) return false;
      return true;
    });
  }, [openTasks, taskFilters]);

  const taskColumns = [
    {
      key: "type",
      label: "Type",
      render: (t) => <span className="font-semibold">{toTitleCase(t.type)}</span>
    },
    {
      key: "status",
      label: "Status",
      render: (t) => <Badge tone={TASK_STATUS_TONES[t.status]}>{toTitleCase(t.status)}</Badge>
    },
    { key: "priority", label: "Priority", align: "center", sortValue: (t) => Number(t.priority) },
    {
      key: "zoneId",
      label: "Zone",
      sortValue: (t) => zoneNameMap[t.zoneId] || "",
      render: (t) => zoneNameMap[t.zoneId] || <span className="text-black/30">Multiple</span>
    },
    {
      key: "sourceDocumentId",
      label: "Source",
      cellClassName: "text-xs text-black/60",
      render: (t) => t.sourceDocumentId
    },
    {
      key: "estimatedTimeSeconds",
      label: "Est. Time",
      align: "center",
      sortValue: (t) => Number(t.estimatedTimeSeconds),
      render: (t) => formatSeconds(t.estimatedTimeSeconds)
    },
    {
      key: "createdAt",
      label: "Created",
      sortValue: (t) => t.createdAt,
      render: (t) => <span className="whitespace-nowrap text-xs text-black/60">{formatDateTime(t.createdAt)}</span>
    }
  ];

  /* ── Order table ────────────────────────────────────────────── */

  const filteredOrders = useMemo(() => {
    const search = orderFilters.search.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderFilters.status && o.status !== orderFilters.status) return false;
      if (search
        && !(o.externalId || "").toLowerCase().includes(search)
        && !(o.sourceDocumentId || "").toLowerCase().includes(search)) return false;
      return true;
    });
  }, [orders, orderFilters]);

  const orderColumns = [
    {
      key: "externalId",
      label: "Order",
      render: (o) => (
        <div>
          <p className="font-semibold">{o.externalId}</p>
          <p className="text-xs text-black/45">{o.sourceDocumentId}</p>
        </div>
      )
    },
    {
      key: "status",
      label: "Status",
      render: (o) => <Badge tone={ORDER_STATUS_TONES[o.status]}>{toTitleCase(o.status)}</Badge>
    },
    { key: "lineCount", label: "Lines", align: "center", sortValue: (o) => Number(o.lineCount) },
    { key: "priority", label: "Priority", align: "center", sortValue: (o) => Number(o.priority) },
    {
      key: "shipDate",
      label: "Ship Date",
      sortValue: (o) => o.shipDate,
      render: (o) => <span className="whitespace-nowrap text-xs text-black/60">{formatDateTime(o.shipDate)}</span>
    },
    {
      key: "createdAt",
      label: "Created",
      sortValue: (o) => o.createdAt,
      render: (o) => <span className="whitespace-nowrap text-xs text-black/60">{formatDateTime(o.createdAt)}</span>
    }
  ];

  const tasksFiltered = taskFilters.search || taskFilters.type || taskFilters.status;
  const ordersFiltered = orderFilters.search || orderFilters.status;

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <PageHeader
          eyebrow="Operations Hub"
          title="Dashboard"
          subtitle="Live overview of inventory, tasks, and order flow"
        />

        <ErrorBanner message={errorMessage} />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard loading={isLoading} label="Units On Hand" value={formatNumber(summary?.totalUnits)} hint="across all warehouses" />
          <StatCard loading={isLoading} label="SKUs" value={formatNumber(summary?.skuCount)} hint="catalog size" />
          <StatCard loading={isLoading} label="Open Tasks" value={formatNumber(openTasks.length)} hint="created, assigned, running, or paused" />
          <StatCard loading={isLoading} label="Completed Today" value={formatNumber(completedToday)} hint="tasks finished since midnight" tone="accent" />
          <StatCard loading={isLoading} label="Open Orders" value={formatNumber(openOrders.length)} hint="pending, ready, or released" />
          <StatCard
            loading={isLoading}
            label="Inventory Alerts"
            value={formatNumber(alerts.length)}
            hint={alerts.length > 0 ? "orders short on stock" : "no shortages"}
            tone={alerts.length > 0 ? "signal" : undefined}
          />
        </section>

        {alerts.length > 0 && (
          <Section
            title={<span className="text-signal">Inventory Alerts</span>}
            meta={<Badge tone="rose">{alerts.length} shortage{alerts.length !== 1 ? "s" : ""}</Badge>}
            className="border-signal/30 bg-signal/5"
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {alerts.slice(0, 6).map((alert) => (
                <article key={alert.id} className="rounded-xl border border-signal/20 bg-white p-3">
                  <p className="text-sm font-bold">{alert.sourceDocumentId}</p>
                  <p className="mt-0.5 truncate text-xs text-black/60">
                    {alert.sku}{alert.skuDescription ? ` — ${alert.skuDescription}` : ""}
                  </p>
                  <p className="mt-1.5 text-xs">
                    <span className="font-bold text-signal">{alert.shortage} short</span>
                    <span className="text-black/45"> · {alert.availableQuantity} of {alert.requiredQuantity} available</span>
                  </p>
                </article>
              ))}
            </div>
            {alerts.length > 6 && (
              <p className="mt-2 text-xs text-black/50">+ {alerts.length - 6} more on the Manager screen</p>
            )}
          </Section>
        )}

        <Section
          title="Open Tasks"
          meta={`${filteredTasks.length} of ${openTasks.length}`}
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
                options={taskTypes.map((t) => ({ value: t, label: toTitleCase(t) }))}
                allLabel="All types"
              />
              <FilterSelect
                value={taskFilters.status}
                onChange={(status) => setTaskFilters((f) => ({ ...f, status }))}
                options={OPEN_TASK_STATUSES.map((s) => ({ value: s, label: toTitleCase(s) }))}
                allLabel="All statuses"
              />
              <ClearFiltersButton
                visible={Boolean(tasksFiltered)}
                onClear={() => setTaskFilters({ search: "", type: "", status: "" })}
              />
            </>
          }
        >
          <DataTable
            columns={taskColumns}
            rows={filteredTasks}
            rowKey={(t) => t.id}
            loading={isLoading}
            emptyTitle={openTasks.length === 0 ? "No open tasks" : "No tasks match the current filters"}
            emptyHint={openTasks.length === 0 ? "Tasks appear here when orders are processed." : undefined}
            initialSort={{ key: "priority", dir: "desc" }}
            pageSize={10}
            paginationLabel="tasks"
            minWidth="min-w-[820px]"
          />
        </Section>

        <Section
          title="Sales Orders"
          meta={`${filteredOrders.length} of ${orders.length}`}
          toolbar={
            <>
              <SearchInput
                value={orderFilters.search}
                onChange={(search) => setOrderFilters((f) => ({ ...f, search }))}
                placeholder="Search order id…"
                className="w-56"
              />
              <FilterSelect
                value={orderFilters.status}
                onChange={(status) => setOrderFilters((f) => ({ ...f, status }))}
                options={["pending_inventory", "ready", "released", "completed", "cancelled"].map((s) => ({ value: s, label: toTitleCase(s) }))}
                allLabel="All statuses"
              />
              <ClearFiltersButton
                visible={Boolean(ordersFiltered)}
                onClear={() => setOrderFilters({ search: "", status: "" })}
              />
            </>
          }
        >
          <DataTable
            columns={orderColumns}
            rows={filteredOrders}
            rowKey={(o) => o.id}
            loading={isLoading}
            emptyTitle={orders.length === 0 ? "No sales orders yet" : "No orders match the current filters"}
            emptyHint={orders.length === 0 ? "Orders arrive via the API or connected integrations." : undefined}
            initialSort={{ key: "createdAt", dir: "desc" }}
            pageSize={10}
            paginationLabel="orders"
            minWidth="min-w-[760px]"
          />
        </Section>
      </div>
    </main>
  );
}

export default DashboardScreen;
