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
  formatNumber
} from "./components/ui";

const MOVEMENT_TONES = {
  INBOUND: "green",
  OUTBOUND: "rose",
  TRANSFER: "cyan",
  ADJUSTMENT: "amber"
};

const LOCATION_TYPE_TONES = {
  rack: "blue",
  shelf: "purple",
  bin: "green",
  floor: "amber",
  dock: "gray",
  staging: "gray"
};

function InventoryDashboard({ jwtToken, user, onAuthError }) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [summary, setSummary] = useState(null);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [skuRows, setSkuRows] = useState([]);
  const [movementRows, setMovementRows] = useState([]);
  const [locationRows, setLocationRows] = useState([]);
  const [togglingId, setTogglingId] = useState(null);

  const [lowStockThreshold, setLowStockThreshold] = useState(20);

  const [locFilters, setLocFilters] = useState({ search: "", warehouse: "", zone: "", status: "", type: "" });
  const [skuFilters, setSkuFilters] = useState({ search: "", warehouse: "" });
  const [movFilters, setMovFilters] = useState({ search: "", type: "" });

  const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    try {
      const [summaryResponse, inventoryResponse, skusResponse, movementsResponse, locationsResponse] = await Promise.all([
        fetchJson("/api/summary", { jwtToken, onAuthError }),
        fetchJson("/api/inventory", { jwtToken, onAuthError }),
        fetchJson("/api/skus", { jwtToken, onAuthError }),
        fetchJson(`/api/movements?${toQueryString({ limit: 100 })}`, { jwtToken, onAuthError }),
        fetchJson("/api/locations", { jwtToken, onAuthError })
      ]);

      setSummary(summaryResponse || null);
      setInventoryRows(Array.isArray(inventoryResponse) ? inventoryResponse : []);
      setSkuRows(Array.isArray(skusResponse) ? skusResponse : []);
      setMovementRows(Array.isArray(movementsResponse) ? movementsResponse : []);
      setLocationRows(Array.isArray(locationsResponse) ? locationsResponse : []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message || "Failed to load inventory dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [jwtToken, onAuthError]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!jwtToken) return () => {};
    const socket = io(getSocketBaseUrl(), { auth: { token: jwtToken } });
    socket.on("connect_error", (error) => {
      const msg = (error.message || "").toLowerCase();
      if ((msg.includes("expired") || msg.includes("unauthorized")) && onAuthError) onAuthError();
    });
    socket.on("INVENTORY_UPDATED", () => loadDashboardData({ silent: true }));
    return () => socket.disconnect();
  }, [loadDashboardData, jwtToken, onAuthError]);

  /* ── KPIs ──────────────────────────────────────────────────── */

  const kpis = useMemo(() => {
    const lowThreshold = Math.max(0, Number(lowStockThreshold) || 0);
    const outOfStockSkuCount = skuRows.filter((row) => Number(row.totalQuantity || 0) <= 0).length;
    const lowStockSkuCount = skuRows.filter((row) => {
      const totalQuantity = Number(row.totalQuantity || 0);
      return totalQuantity > 0 && totalQuantity <= lowThreshold;
    }).length;
    const activeLocationCount = new Set(inventoryRows.map((row) => row.locationId)).size;
    const activeWarehouseCount = new Set(inventoryRows.map((row) => row.warehouseId)).size;

    return [
      { id: "totalUnits", label: "Total Units", value: formatNumber(summary?.totalUnits || 0), hint: "sum of all on-hand inventory" },
      { id: "skuCount", label: "Total SKUs", value: formatNumber(summary?.skuCount || skuRows.length), hint: "catalog product count" },
      { id: "outOfStock", label: "Out of Stock SKUs", value: formatNumber(outOfStockSkuCount), hint: "products with 0 units", tone: outOfStockSkuCount > 0 ? "signal" : undefined },
      { id: "lowStock", label: `Low Stock (≤ ${lowThreshold})`, value: formatNumber(lowStockSkuCount), hint: "products below threshold" },
      { id: "locationsWithStock", label: "Locations with Stock", value: formatNumber(activeLocationCount || summary?.locationCount), hint: "locations currently holding units" },
      { id: "warehousesWithStock", label: "Warehouses", value: formatNumber(activeWarehouseCount || summary?.warehouseCount), hint: "warehouses with active inventory" }
    ];
  }, [inventoryRows, lowStockThreshold, skuRows, summary]);

  /* ── Aggregations ───────────────────────────────────────────── */

  const warehouseRows = useMemo(() => {
    const aggregationMap = new Map();
    for (const row of inventoryRows) {
      if (!aggregationMap.has(row.warehouseId)) {
        aggregationMap.set(row.warehouseId, {
          warehouseId: row.warehouseId,
          warehouseCode: row.warehouseCode,
          warehouseName: row.warehouseName,
          totalUnits: 0,
          skuSet: new Set(),
          locationSet: new Set()
        });
      }
      const aggregationRow = aggregationMap.get(row.warehouseId);
      aggregationRow.totalUnits += Number(row.quantity || 0);
      aggregationRow.skuSet.add(row.skuId);
      aggregationRow.locationSet.add(row.locationId);
    }
    return Array.from(aggregationMap.values()).map((row) => ({
      warehouseId: row.warehouseId,
      warehouseCode: row.warehouseCode,
      warehouseName: row.warehouseName,
      totalUnits: row.totalUnits,
      skuCount: row.skuSet.size,
      locationCount: row.locationSet.size
    }));
  }, [inventoryRows]);

  const allSkuRows = useMemo(() => {
    const aggregationMap = new Map();
    for (const row of inventoryRows) {
      if (!aggregationMap.has(row.skuId)) {
        aggregationMap.set(row.skuId, {
          skuId: row.skuId,
          sku: row.sku,
          skuDescription: row.skuDescription,
          totalUnits: 0,
          locationSet: new Set(),
          warehouseSet: new Set()
        });
      }
      const aggregationRow = aggregationMap.get(row.skuId);
      aggregationRow.totalUnits += Number(row.quantity || 0);
      aggregationRow.locationSet.add(row.locationId);
      aggregationRow.warehouseSet.add(row.warehouseCode);
    }
    return Array.from(aggregationMap.values()).map((row) => ({
      skuId: row.skuId,
      sku: row.sku,
      skuDescription: row.skuDescription,
      totalUnits: row.totalUnits,
      locationCount: row.locationSet.size,
      warehouseCount: row.warehouseSet.size,
      warehouses: row.warehouseSet
    }));
  }, [inventoryRows]);

  const lowStockRows = useMemo(() => {
    const threshold = Math.max(0, Number(lowStockThreshold) || 0);
    return skuRows
      .map((row) => ({ ...row, totalQuantity: Number(row.totalQuantity || 0) }))
      .filter((row) => row.totalQuantity <= threshold)
      .sort((left, right) => left.totalQuantity - right.totalQuantity)
      .slice(0, 10);
  }, [lowStockThreshold, skuRows]);

  /* ── Filters ───────────────────────────────────────────────── */

  const skuWarehouseOptions = useMemo(
    () => [...new Set(inventoryRows.map((r) => r.warehouseCode))].sort(),
    [inventoryRows]
  );

  const filteredSkuRows = useMemo(() => {
    const search = skuFilters.search.trim().toLowerCase();
    return allSkuRows.filter((row) => {
      if (skuFilters.warehouse && !row.warehouses.has(skuFilters.warehouse)) return false;
      if (search && !row.sku.toLowerCase().includes(search) && !(row.skuDescription || "").toLowerCase().includes(search)) return false;
      return true;
    });
  }, [allSkuRows, skuFilters]);

  const locFilterOptions = useMemo(() => ({
    warehouses: [...new Set(locationRows.map((r) => r.warehouseCode))].sort(),
    zones: [...new Set(locationRows.map((r) => r.zoneName))].sort(),
    types: [...new Set(locationRows.map((r) => r.type))].sort()
  }), [locationRows]);

  const filteredLocations = useMemo(() => {
    const search = locFilters.search.trim().toLowerCase();
    return locationRows.filter((loc) => {
      if (locFilters.warehouse && loc.warehouseCode !== locFilters.warehouse) return false;
      if (locFilters.zone && loc.zoneName !== locFilters.zone) return false;
      if (locFilters.status && loc.status !== locFilters.status) return false;
      if (locFilters.type && loc.type !== locFilters.type) return false;
      if (search && !loc.code.toLowerCase().includes(search) && !loc.name.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [locationRows, locFilters]);

  const filteredMovements = useMemo(() => {
    const search = movFilters.search.trim().toLowerCase();
    return movementRows.filter((row) => {
      if (movFilters.type && row.movementType !== movFilters.type) return false;
      if (search
        && !(row.sku || "").toLowerCase().includes(search)
        && !(row.skuDescription || "").toLowerCase().includes(search)
        && !(row.fromLocationCode || "").toLowerCase().includes(search)
        && !(row.toLocationCode || "").toLowerCase().includes(search)) return false;
      return true;
    });
  }, [movementRows, movFilters]);

  /* ── Actions ───────────────────────────────────────────────── */

  const handleToggleStatus = useCallback(async (loc) => {
    const newStatus = loc.status === "active" ? "locked" : "active";
    setTogglingId(loc.id);
    try {
      await fetchJson(`/api/locations/${loc.id}/status`, {
        jwtToken,
        onAuthError,
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      setLocationRows((prev) => prev.map((r) => (r.id === loc.id ? { ...r, status: newStatus } : r)));
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setTogglingId(null);
    }
  }, [jwtToken, onAuthError]);

  /* ── Columns ───────────────────────────────────────────────── */

  const warehouseColumns = [
    {
      key: "warehouseCode",
      label: "Warehouse",
      render: (r) => <span className="font-semibold">{r.warehouseCode} — {r.warehouseName}</span>
    },
    { key: "locationCount", label: "Locations", align: "center", sortValue: (r) => r.locationCount, render: (r) => formatNumber(r.locationCount) },
    { key: "skuCount", label: "SKUs", align: "center", sortValue: (r) => r.skuCount, render: (r) => formatNumber(r.skuCount) },
    { key: "totalUnits", label: "Total Units", align: "right", sortValue: (r) => r.totalUnits, render: (r) => <span className="font-semibold">{formatNumber(r.totalUnits)}</span> }
  ];

  const skuColumns = [
    { key: "sku", label: "SKU", cellClassName: "font-mono text-xs font-semibold" },
    { key: "skuDescription", label: "Description", cellClassName: "text-black/60", render: (r) => r.skuDescription || <span className="text-black/30">—</span> },
    { key: "locationCount", label: "Locations", align: "center", sortValue: (r) => r.locationCount, render: (r) => formatNumber(r.locationCount) },
    { key: "warehouseCount", label: "Warehouses", align: "center", sortValue: (r) => r.warehouseCount, render: (r) => formatNumber(r.warehouseCount) },
    { key: "totalUnits", label: "Total Units", align: "right", sortValue: (r) => r.totalUnits, render: (r) => <span className="font-semibold">{formatNumber(r.totalUnits)}</span> }
  ];

  const locationColumns = [
    {
      key: "code",
      label: "Code",
      render: (loc) => (
        <div>
          <p className="font-mono text-xs font-semibold">{loc.code}</p>
          <p className="text-xs text-black/40">{loc.name}</p>
        </div>
      )
    },
    { key: "zoneName", label: "Zone", cellClassName: "text-black/60" },
    { key: "warehouseCode", label: "Warehouse", cellClassName: "text-black/60" },
    { key: "type", label: "Type", render: (loc) => <Badge tone={LOCATION_TYPE_TONES[loc.type]}>{loc.type}</Badge> },
    { key: "capacity", label: "Capacity", align: "center", sortValue: (loc) => Number(loc.capacity), render: (loc) => formatNumber(loc.capacity) },
    {
      key: "usedCapacity",
      label: "Used",
      align: "center",
      sortValue: (loc) => Number(loc.usedCapacity || 0),
      render: (loc) => formatNumber(loc.usedCapacity || 0)
    },
    {
      key: "status",
      label: "Status",
      render: (loc) => <Badge tone={loc.status === "active" ? "green" : "red"}>{loc.status}</Badge>
    },
    {
      key: "actions",
      label: "Action",
      sortable: false,
      align: "right",
      render: (loc) => (
        <button
          type="button"
          disabled={togglingId === loc.id}
          onClick={() => handleToggleStatus(loc)}
          className={`rounded-lg border px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
            loc.status === "active"
              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {togglingId === loc.id ? "…" : loc.status === "active" ? "Lock" : "Activate"}
        </button>
      )
    }
  ];

  const movementColumns = [
    {
      key: "createdAt",
      label: "When",
      sortValue: (r) => r.createdAt,
      render: (r) => <span className="whitespace-nowrap text-xs text-black/60">{formatDateTime(r.createdAt)}</span>
    },
    {
      key: "sku",
      label: "SKU",
      render: (r) => (
        <span>
          <span className="font-mono text-xs font-semibold">{r.sku}</span>
          {r.skuDescription && <span className="text-black/50"> — {r.skuDescription}</span>}
        </span>
      )
    },
    {
      key: "movementType",
      label: "Type",
      render: (r) => <Badge tone={MOVEMENT_TONES[r.movementType]}>{r.movementType}</Badge>
    },
    { key: "fromLocationCode", label: "From", render: (r) => r.fromLocationCode || <span className="text-black/30">—</span> },
    { key: "toLocationCode", label: "To", render: (r) => r.toLocationCode || <span className="text-black/30">—</span> },
    { key: "quantity", label: "Qty", align: "right", sortValue: (r) => Number(r.quantity), render: (r) => <span className="font-semibold">{formatNumber(r.quantity)}</span> }
  ];

  const locsFiltered = locFilters.search || locFilters.warehouse || locFilters.zone || locFilters.status || locFilters.type;
  const skusFiltered = skuFilters.search || skuFilters.warehouse;
  const movsFiltered = movFilters.search || movFilters.type;

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <PageHeader
          eyebrow="Inventory Control"
          title="Inventory Dashboard"
          subtitle="Stock levels, locations, and movement history"
        />

        <ErrorBanner message={errorMessage} />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {kpis.map((kpi) => (
            <StatCard key={kpi.id} loading={isLoading} label={kpi.label} value={kpi.value} hint={kpi.hint} tone={kpi.tone} />
          ))}
        </section>

        <Section title="Stock by Warehouse" meta={`${warehouseRows.length} active warehouse(s)`}>
          <DataTable
            columns={warehouseColumns}
            rows={warehouseRows}
            rowKey={(r) => r.warehouseId}
            loading={isLoading}
            emptyTitle="No stock recorded yet"
            initialSort={{ key: "totalUnits", dir: "desc" }}
            minWidth="min-w-[640px]"
          />
        </Section>

        <Section
          title="Low Stock SKUs"
          meta={
            <label className="text-xs text-black/60">
              Threshold
              <input
                type="number"
                min="0"
                className="ml-2 w-20 rounded-md border border-black/15 px-2 py-1 text-sm"
                value={lowStockThreshold}
                onChange={(event) => setLowStockThreshold(Number(event.target.value))}
              />
            </label>
          }
        >
          {isLoading ? (
            <div className="h-14 animate-pulse rounded-xl bg-canvas" />
          ) : lowStockRows.length === 0 ? (
            <p className="text-sm text-black/60">No low-stock SKU under current threshold.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {lowStockRows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 rounded-xl border border-black/10 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {row.sku}{row.description ? ` — ${row.description}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-black/55">{formatNumber(row.totalQuantity)} units on hand</p>
                  </div>
                  <Badge tone={row.totalQuantity === 0 ? "red" : "amber"}>
                    {row.totalQuantity === 0 ? "out" : "low"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="SKU by Units"
          meta={`${filteredSkuRows.length} of ${allSkuRows.length} SKU(s)`}
          toolbar={
            <>
              <SearchInput
                value={skuFilters.search}
                onChange={(search) => setSkuFilters((f) => ({ ...f, search }))}
                placeholder="Search SKU or description…"
                className="w-56"
              />
              <FilterSelect
                value={skuFilters.warehouse}
                onChange={(warehouse) => setSkuFilters((f) => ({ ...f, warehouse }))}
                options={skuWarehouseOptions}
                allLabel="All warehouses"
              />
              <ClearFiltersButton visible={Boolean(skusFiltered)} onClear={() => setSkuFilters({ search: "", warehouse: "" })} />
            </>
          }
        >
          <DataTable
            columns={skuColumns}
            rows={filteredSkuRows}
            rowKey={(r) => r.skuId}
            loading={isLoading}
            emptyTitle={allSkuRows.length === 0 ? "No stock on hand" : "No SKU matches the current filters"}
            initialSort={{ key: "totalUnits", dir: "desc" }}
            pageSize={10}
            paginationLabel="SKU(s)"
            minWidth="min-w-[700px]"
          />
        </Section>

        <Section
          title="Locations"
          meta={`${filteredLocations.length} of ${locationRows.length} location(s)`}
          toolbar={
            <>
              <SearchInput
                value={locFilters.search}
                onChange={(search) => setLocFilters((f) => ({ ...f, search }))}
                placeholder="Search code or name…"
                className="w-56"
              />
              <FilterSelect
                value={locFilters.warehouse}
                onChange={(warehouse) => setLocFilters((f) => ({ ...f, warehouse }))}
                options={locFilterOptions.warehouses}
                allLabel="All warehouses"
              />
              <FilterSelect
                value={locFilters.zone}
                onChange={(zone) => setLocFilters((f) => ({ ...f, zone }))}
                options={locFilterOptions.zones}
                allLabel="All zones"
              />
              <FilterSelect
                value={locFilters.status}
                onChange={(status) => setLocFilters((f) => ({ ...f, status }))}
                options={[{ value: "active", label: "Active" }, { value: "locked", label: "Locked" }]}
                allLabel="All statuses"
              />
              <FilterSelect
                value={locFilters.type}
                onChange={(type) => setLocFilters((f) => ({ ...f, type }))}
                options={locFilterOptions.types}
                allLabel="All types"
              />
              <ClearFiltersButton
                visible={Boolean(locsFiltered)}
                onClear={() => setLocFilters({ search: "", warehouse: "", zone: "", status: "", type: "" })}
              />
            </>
          }
        >
          <DataTable
            columns={locationColumns}
            rows={filteredLocations}
            rowKey={(loc) => loc.id}
            loading={isLoading}
            emptyTitle={locationRows.length === 0 ? "No locations yet" : "No locations match the current filters"}
            initialSort={{ key: "code", dir: "asc" }}
            pageSize={10}
            paginationLabel="location(s)"
            minWidth="min-w-[940px]"
          />
        </Section>

        <Section
          title="Recent Movements"
          meta={`${filteredMovements.length} of ${movementRows.length} record(s)`}
          toolbar={
            <>
              <SearchInput
                value={movFilters.search}
                onChange={(search) => setMovFilters((f) => ({ ...f, search }))}
                placeholder="Search SKU or location…"
                className="w-56"
              />
              <FilterSelect
                value={movFilters.type}
                onChange={(type) => setMovFilters((f) => ({ ...f, type }))}
                options={Object.keys(MOVEMENT_TONES)}
                allLabel="All types"
              />
              <ClearFiltersButton visible={Boolean(movsFiltered)} onClear={() => setMovFilters({ search: "", type: "" })} />
            </>
          }
        >
          <DataTable
            columns={movementColumns}
            rows={filteredMovements}
            rowKey={(r) => r.id}
            loading={isLoading}
            emptyTitle={movementRows.length === 0 ? "No recent movement found" : "No movements match the current filters"}
            initialSort={{ key: "createdAt", dir: "desc" }}
            pageSize={10}
            paginationLabel="movement(s)"
            minWidth="min-w-[840px]"
          />
        </Section>
      </div>
    </main>
  );
}

export default InventoryDashboard;
