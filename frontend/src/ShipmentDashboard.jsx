import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { fetchJson, getSocketBaseUrl } from "./lib/api";
import {
  Badge,
  ClearFiltersButton,
  DataTable,
  ErrorBanner,
  FilterSelect,
  PageHeader,
  SearchInput,
  StatCard,
  SuccessBanner,
  primaryButtonClass
} from "./components/ui";

const STATUS_LABELS = {
  pending: "Pending label",
  labeled: "Labeled",
  dispatched: "Dispatched",
  delivered: "Delivered"
};

const STATUS_TONES = {
  pending: "amber",
  labeled: "blue",
  dispatched: "green",
  delivered: "gray"
};

const isDispatchable = (shipment) => shipment.status === "pending" || shipment.status === "labeled";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ShipmentDashboard({ jwtToken, user, onAuthError }) {
  const [shipments, setShipments] = useState([]);
  const [manifest, setManifest] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("shipments"); // "shipments" | "manifest"
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
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
    if (activeTab === "shipments") loadShipments();
    else loadManifest();
  }, [activeTab, loadShipments, loadManifest]);

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

  const kpis = {
    total: shipments.length,
    pending: shipments.filter((s) => s.status === "pending").length,
    labeled: shipments.filter((s) => s.status === "labeled").length,
    dispatched: shipments.filter((s) => s.status === "dispatched").length
  };

  const sourceItems = activeTab === "shipments" ? shipments : manifest;

  const displayItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sourceItems;
    return sourceItems.filter((s) =>
      (s.order_external_id || "").toLowerCase().includes(q)
      || (s.source_document_id || "").toLowerCase().includes(q)
      || (s.tracking_number || "").toLowerCase().includes(q)
      || (s.carrier || "").toLowerCase().includes(q)
    );
  }, [sourceItems, search]);

  const dispatchableSelected = [...selectedIds].filter((id) => {
    const s = sourceItems.find((x) => x.id === id);
    return s && isDispatchable(s);
  });

  const handleSelectAll = () => {
    const dispatchable = displayItems.filter(isDispatchable);
    const allSelected = dispatchable.length > 0 && dispatchable.every((s) => selectedIds.has(s.id));
    setSelectedIds(allSelected ? new Set() : new Set(dispatchable.map((s) => s.id)));
  };

  const dispatchableVisible = displayItems.filter(isDispatchable);
  const allVisibleSelected = dispatchableVisible.length > 0 && dispatchableVisible.every((s) => selectedIds.has(s.id));

  const columns = [
    {
      key: "select",
      sortable: false,
      label: (
        <input
          type="checkbox"
          className="rounded border-black/20 accent-accent"
          checked={allVisibleSelected}
          onChange={handleSelectAll}
          aria-label="Select all dispatchable"
        />
      ),
      render: (s) =>
        isDispatchable(s) ? (
          <input
            type="checkbox"
            className="rounded border-black/20 accent-accent"
            checked={selectedIds.has(s.id)}
            onChange={() => handleToggleSelect(s.id)}
          />
        ) : null
    },
    {
      key: "order_external_id",
      label: "Order",
      render: (s) => (
        <div>
          <p className="text-sm font-semibold">{s.order_external_id}</p>
          <p className="text-xs text-black/50">{s.source_document_id}</p>
        </div>
      )
    },
    {
      key: "status",
      label: "Status",
      render: (s) => <Badge tone={STATUS_TONES[s.status]}>{STATUS_LABELS[s.status] || s.status}</Badge>
    },
    {
      key: "carrier",
      label: "Carrier",
      render: (s) => s.carrier || <span className="text-black/30">—</span>
    },
    {
      key: "tracking_number",
      label: "Tracking",
      render: (s) =>
        s.tracking_number
          ? <span className="font-mono text-xs text-black/70">{s.tracking_number}</span>
          : <span className="text-black/30">—</span>
    },
    {
      key: "weight_grams",
      label: "Box / Weight",
      sortValue: (s) => Number(s.weight_grams || 0),
      render: (s) => (
        <span className="text-xs text-black/50">
          {s.box_type || "—"}
          {s.weight_grams ? ` · ${(s.weight_grams / 1000).toFixed(2)} kg` : ""}
        </span>
      )
    },
    {
      key: "created_at",
      label: "Created",
      sortValue: (s) => s.created_at,
      render: (s) => <span className="whitespace-nowrap text-xs text-black/50">{formatDate(s.created_at)}</span>
    },
    {
      key: "label_url",
      label: "Label",
      sortable: false,
      render: (s) =>
        s.label_url
          ? <a href={s.label_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">Label</a>
          : <span className="text-xs text-black/30">—</span>
    }
  ];

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <PageHeader
          eyebrow="Outbound"
          title="Shipments"
          subtitle="Pack station output and EOD dispatch management"
          actions={
            dispatchableSelected.length > 0 && (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => handleDispatch(dispatchableSelected)}
                disabled={isDispatching}
              >
                {isDispatching ? "Dispatching…" : `Dispatch ${dispatchableSelected.length} shipment${dispatchableSelected.length !== 1 ? "s" : ""}`}
              </button>
            )
          }
        />

        {dispatchResult != null && (
          <SuccessBanner message={`${dispatchResult} shipment${dispatchResult !== 1 ? "s" : ""} marked as dispatched.`} />
        )}
        <ErrorBanner message={error} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={kpis.total} loading={isLoading && shipments.length === 0} />
          <StatCard label="Pending label" value={kpis.pending} hint="Awaiting carrier" loading={isLoading && shipments.length === 0} />
          <StatCard label="Labeled" value={kpis.labeled} hint="Ready to dispatch" loading={isLoading && shipments.length === 0} />
          <StatCard label="Dispatched" value={kpis.dispatched} hint="Today" loading={isLoading && shipments.length === 0} />
        </div>

        {/* Tab bar */}
        <div className="flex w-fit gap-1 rounded-xl border border-black/10 bg-white p-1">
          {[
            { id: "shipments", label: "All Shipments" },
            { id: "manifest", label: "EOD Manifest" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                activeTab === tab.id ? "bg-accent text-white shadow" : "text-black/60 hover:text-black"
              }`}
              onClick={() => { setActiveTab(tab.id); setSelectedIds(new Set()); setDispatchResult(null); }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search order, tracking, carrier…"
            className="w-64"
          />

          {activeTab === "shipments" && (
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              allLabel="All statuses"
            />
          )}

          {activeTab === "manifest" && (
            <input
              type="date"
              className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          )}

          <ClearFiltersButton
            visible={Boolean(search || statusFilter)}
            onClear={() => { setSearch(""); setStatusFilter(""); }}
          />

          {activeTab === "manifest" && displayItems.length > 0 && (
            <button
              type="button"
              className={`${primaryButtonClass} ml-auto`}
              onClick={() => handleDispatch(displayItems.filter(isDispatchable).map((s) => s.id))}
              disabled={isDispatching || displayItems.every((s) => !isDispatchable(s))}
            >
              {isDispatching ? "Dispatching…" : "Dispatch All"}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <DataTable
            columns={columns}
            rows={displayItems}
            rowKey={(s) => s.id}
            loading={isLoading}
            emptyTitle="No shipments found"
            emptyHint={
              activeTab === "manifest"
                ? "No pending or labeled shipments for this date."
                : "Shipments are created automatically when pick tasks complete."
            }
            initialSort={{ key: "created_at", dir: "desc" }}
            pageSize={15}
            paginationLabel="shipments"
            minWidth="min-w-[900px]"
          />
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
                  <Badge tone={STATUS_TONES[shipment.status]}>{STATUS_LABELS[shipment.status] || shipment.status}</Badge>
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
