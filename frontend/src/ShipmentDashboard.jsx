import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

const runtimeApiBaseUrl = typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "";
const apiBaseUrl = String(runtimeApiBaseUrl || "").replace(/\/+$/, "");
const buildApiUrl = (path) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

const getSocketBaseUrl = () => {
  if (!apiBaseUrl) return undefined;
  try {
    const parsed = new URL(apiBaseUrl, window.location.origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
};

async function fetchJson(path, { jwtToken = "", onAuthError = null, ...options } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (jwtToken) headers.Authorization = `Bearer ${jwtToken}`;
  const response = await fetch(buildApiUrl(path), { headers, ...options });
  if (!response.ok) {
    if (response.status === 401 && onAuthError) onAuthError();
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

const STATUS_LABELS = {
  pending: "Pending label",
  labeled: "Labeled",
  dispatched: "Dispatched",
  delivered: "Delivered"
};

const STATUS_BADGE = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  labeled: "border-blue-200 bg-blue-50 text-blue-700",
  dispatched: "border-emerald-200 bg-emerald-50 text-emerald-700",
  delivered: "border-slate-200 bg-slate-100 text-slate-600"
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── KPI Card ─────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50">{label}</p>
      <p className="mt-1 text-3xl font-black">{value ?? "—"}</p>
      {sub && <p className="mt-0.5 text-xs text-black/50">{sub}</p>}
    </div>
  );
}

/* ── Shipment row ─────────────────────────────────────────────────── */
function ShipmentRow({ shipment, selected, onToggle }) {
  const badge = STATUS_BADGE[shipment.status] || "border-slate-200 bg-slate-100 text-slate-600";
  const isDispatchable = shipment.status === "pending" || shipment.status === "labeled";

  return (
    <tr className="border-b border-black/5 hover:bg-canvas transition">
      {isDispatchable && (
        <td className="py-3 pl-4 pr-2">
          <input
            type="checkbox"
            className="rounded border-black/20 accent-accent"
            checked={selected}
            onChange={() => onToggle(shipment.id)}
          />
        </td>
      )}
      {!isDispatchable && <td className="py-3 pl-4 pr-2" />}

      <td className="py-3 pr-4">
        <p className="text-sm font-semibold">{shipment.order_external_id}</p>
        <p className="text-xs text-black/50">{shipment.source_document_id}</p>
      </td>
      <td className="py-3 pr-4">
        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
          {STATUS_LABELS[shipment.status] || shipment.status}
        </span>
      </td>
      <td className="py-3 pr-4 text-sm text-black/70">
        {shipment.carrier
          ? <span>{shipment.carrier}</span>
          : <span className="text-black/30">—</span>}
      </td>
      <td className="py-3 pr-4 text-sm font-mono text-black/70">
        {shipment.tracking_number
          ? <span className="text-xs">{shipment.tracking_number}</span>
          : <span className="text-black/30">—</span>}
      </td>
      <td className="py-3 pr-4 text-xs text-black/50">
        {shipment.box_type || "—"}
        {shipment.weight_grams ? ` · ${(shipment.weight_grams / 1000).toFixed(2)} kg` : ""}
      </td>
      <td className="py-3 pr-4 text-xs text-black/50">{formatDate(shipment.created_at)}</td>
      <td className="py-3 pr-4 text-xs text-black/50">
        {shipment.label_url
          ? <a href={shipment.label_url} target="_blank" rel="noopener noreferrer" className="text-accent underline">Label</a>
          : "—"}
      </td>
    </tr>
  );
}

/* ── Main component ────────────────────────────────────────────────── */
export default function ShipmentDashboard({ jwtToken, user, onAuthError }) {
  const [shipments, setShipments] = useState([]);
  const [manifest, setManifest] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("shipments"); // "shipments" | "manifest"
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

  const loadShipments = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await fetchJson(`/api/shipments?${params}`, { jwtToken, onAuthError });
      setShipments(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [jwtToken, onAuthError, statusFilter]);

  const loadManifest = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ date: dateFilter });
      const data = await fetchJson(`/api/shipments/manifest?${params}`, { jwtToken, onAuthError });
      setManifest(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [jwtToken, onAuthError, dateFilter]);

  useEffect(() => {
    if (activeTab === "shipments") {
      loadShipments();
    } else {
      loadManifest();
    }
  }, [activeTab, loadShipments, loadManifest]);

  // Realtime subscription
  useEffect(() => {
    if (!jwtToken) return;
    const socket = io(getSocketBaseUrl(), { auth: { token: jwtToken } });
    socket.on("SHIPMENT_UPDATED", () => {
      if (activeTab === "shipments") loadShipments();
      else loadManifest();
    });
    return () => socket.disconnect();
  }, [jwtToken, activeTab, loadShipments, loadManifest]);

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (items) => {
    const dispatchable = items.filter((s) => s.status === "pending" || s.status === "labeled");
    const allSelected = dispatchable.every((s) => selectedIds.has(s.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(dispatchable.map((s) => s.id)));
    }
  };

  const handleDispatch = async (idsToDispatch) => {
    if (!idsToDispatch || idsToDispatch.length === 0) return;
    setIsDispatching(true);
    setDispatchResult(null);
    setError("");
    try {
      const result = await fetchJson("/api/shipments/dispatch", {
        jwtToken,
        onAuthError,
        method: "POST",
        body: JSON.stringify({ shipmentIds: idsToDispatch })
      });
      setDispatchResult(result.dispatched);
      setSelectedIds(new Set());
      if (activeTab === "shipments") loadShipments();
      else loadManifest();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDispatching(false);
    }
  };

  // Computed KPIs from current shipments list
  const kpis = {
    total: shipments.length,
    pending: shipments.filter((s) => s.status === "pending").length,
    labeled: shipments.filter((s) => s.status === "labeled").length,
    dispatched: shipments.filter((s) => s.status === "dispatched").length
  };

  const displayItems = activeTab === "shipments" ? shipments : manifest;
  const dispatchableSelected = [...selectedIds].filter((id) => {
    const s = displayItems.find((x) => x.id === id);
    return s && (s.status === "pending" || s.status === "labeled");
  });

  return (
    <main className="min-h-screen bg-canvas p-6 text-ink">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Shipments</h1>
            <p className="text-sm text-black/50">Pack station output and EOD dispatch management</p>
          </div>
          {dispatchableSelected.length > 0 && (
            <button
              type="button"
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow disabled:opacity-60"
              onClick={() => handleDispatch(dispatchableSelected)}
              disabled={isDispatching}
            >
              {isDispatching ? "Dispatching…" : `Dispatch ${dispatchableSelected.length} shipment${dispatchableSelected.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>

        {/* Success banner */}
        {dispatchResult != null && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {dispatchResult} shipment{dispatchResult !== 1 ? "s" : ""} marked as dispatched.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Total" value={kpis.total} />
          <KpiCard label="Pending label" value={kpis.pending} sub="Awaiting carrier" />
          <KpiCard label="Labeled" value={kpis.labeled} sub="Ready to dispatch" />
          <KpiCard label="Dispatched" value={kpis.dispatched} sub="Today" />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl border border-black/10 bg-white p-1 w-fit">
          {[
            { id: "shipments", label: "All Shipments" },
            { id: "manifest", label: "EOD Manifest" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-accent text-white shadow"
                  : "text-black/60 hover:text-black"
              }`}
              onClick={() => { setActiveTab(tab.id); setSelectedIds(new Set()); setDispatchResult(null); }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {activeTab === "shipments" && (
            <select
              className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending label</option>
              <option value="labeled">Labeled</option>
              <option value="dispatched">Dispatched</option>
              <option value="delivered">Delivered</option>
            </select>
          )}

          {activeTab === "manifest" && (
            <input
              type="date"
              className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          )}

          {activeTab === "manifest" && displayItems.length > 0 && (
            <button
              type="button"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              onClick={() => handleDispatch(displayItems.filter((s) => s.status === "pending" || s.status === "labeled").map((s) => s.id))}
              disabled={isDispatching || displayItems.every((s) => s.status === "dispatched" || s.status === "delivered")}
            >
              {isDispatching ? "Dispatching…" : "Dispatch All"}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-black/50">Loading…</div>
          ) : displayItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-black/60">No shipments found</p>
              <p className="mt-1 text-xs text-black/40">
                {activeTab === "manifest"
                  ? "No pending or labeled shipments for this date."
                  : "Shipments are created automatically when pick tasks complete."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black/10 text-xs font-semibold uppercase tracking-wide text-black/40">
                  <th className="py-3 pl-4 pr-2">
                    <input
                      type="checkbox"
                      className="rounded border-black/20 accent-accent"
                      checked={displayItems.filter((s) => s.status === "pending" || s.status === "labeled").every((s) => selectedIds.has(s.id)) && displayItems.some((s) => s.status === "pending" || s.status === "labeled")}
                      onChange={() => handleSelectAll(displayItems)}
                    />
                  </th>
                  <th className="py-3 pr-4">Order</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Carrier</th>
                  <th className="py-3 pr-4">Tracking</th>
                  <th className="py-3 pr-4">Box / Weight</th>
                  <th className="py-3 pr-4">Created</th>
                  <th className="py-3 pr-4">Label</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((shipment) => (
                  <ShipmentRow
                    key={shipment.id}
                    shipment={shipment}
                    selected={selectedIds.has(shipment.id)}
                    onToggle={handleToggleSelect}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Manifest: per-order line details */}
        {activeTab === "manifest" && displayItems.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-black/50">Order Contents</h2>
            {displayItems.map((shipment) => (
              <div key={shipment.id} className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{shipment.order_external_id}</p>
                    <p className="text-xs text-black/50">{shipment.source_document_id}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[shipment.status] || ""}`}>
                    {STATUS_LABELS[shipment.status] || shipment.status}
                  </span>
                </div>
                {Array.isArray(shipment.lines) && shipment.lines.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-black/5 pt-3">
                    {shipment.lines.map((line, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-xs text-black/70">{line.sku}</span>
                        <span className="text-black/60">{line.description}</span>
                        <span className="font-semibold">{line.quantity} units</span>
                      </li>
                    ))}
                  </ul>
                )}
                {shipment.tracking_number && (
                  <p className="mt-2 text-xs text-black/50">
                    Tracking: <span className="font-mono">{shipment.tracking_number}</span>
                    {shipment.carrier && ` via ${shipment.carrier}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
