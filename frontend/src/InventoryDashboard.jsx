import React, { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const runtimeApiBaseUrl = typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "";
const apiBaseUrl = String(runtimeApiBaseUrl || "").replace(/\/+$/, "");
const buildApiUrl = (path) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

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

const movementTypeClassNameMap = {
  INBOUND: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OUTBOUND: "border-rose-200 bg-rose-50 text-rose-700",
  TRANSFER: "border-cyan-200 bg-cyan-50 text-cyan-700",
  ADJUSTMENT: "border-amber-200 bg-amber-50 text-amber-700"
};

const toQueryString = (params) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") {
      query.set(key, String(value));
    }
  }
  return query.toString();
};

async function patchJson(path, body, jwtToken = "", onAuthError = null) {
  const headers = { "Content-Type": "application/json" };
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  }
  const response = await fetch(buildApiUrl(path), {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
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

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toLocaleString();
};

async function fetchJson(path, jwtToken = "", onAuthError = null) {
  const headers = { "Content-Type": "application/json" };
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  }
  const response = await fetch(buildApiUrl(path), { headers });
  if (!response.ok) {
    if (response.status === 401 && onAuthError) {
      onAuthError();
    }
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

function InventoryDashboard({ jwtToken, user, onAuthError }) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [summary, setSummary] = useState(null);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [skuRows, setSkuRows] = useState([]);
  const [movementRows, setMovementRows] = useState([]);

  const [locationRows, setLocationRows] = useState([]);
  const [locFilterWarehouse, setLocFilterWarehouse] = useState("");
  const [locFilterZone, setLocFilterZone] = useState("");
  const [locFilterStatus, setLocFilterStatus] = useState("");
  const [locFilterType, setLocFilterType] = useState("");
  const [locFilterSearch, setLocFilterSearch] = useState("");
  const [togglingId, setTogglingId] = useState(null);

  const [lowStockThreshold, setLowStockThreshold] = useState(20);

  // Pagination state
  const [locPage, setLocPage] = useState(1);
  const [movPage, setMovPage] = useState(1);
  const [skuPage, setSkuPage] = useState(1);

  // SKU by Units filters
  const [skuFilterSearch, setSkuFilterSearch] = useState("");
  const [skuFilterWarehouse, setSkuFilterWarehouse] = useState("");

  const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const [summaryResponse, inventoryResponse, skusResponse, movementsResponse, locationsResponse] = await Promise.all([
        fetchJson("/api/summary", jwtToken, onAuthError),
        fetchJson("/api/inventory", jwtToken, onAuthError),
        fetchJson("/api/skus", jwtToken, onAuthError),
        fetchJson(`/api/movements?${toQueryString({ limit: 100 })}`, jwtToken, onAuthError),
        fetchJson("/api/locations", jwtToken, onAuthError)
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
    if (!jwtToken) {
      return () => {};
    }

    const socket = io(getSocketBaseUrl(), {
      auth: { token: jwtToken }
    });

    socket.on("connect_error", (error) => {
      const msg = error.message || "Realtime connection failed";
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("unauthorized")) {
        if (onAuthError) onAuthError();
      }
    });

    socket.on("INVENTORY_UPDATED", () => {
      loadDashboardData({ silent: true });
    });

    return () => {
      socket.disconnect();
    };
  }, [loadDashboardData, jwtToken, onAuthError]);

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
      {
        id: "totalUnits",
        title: "Total Units",
        value: formatNumber(summary?.totalUnits || 0),
        hint: "sum of all on-hand inventory"
      },
      {
        id: "skuCount",
        title: "Total SKUs",
        value: formatNumber(summary?.skuCount || skuRows.length),
        hint: "catalog product count"
      },
      {
        id: "outOfStock",
        title: "Out of Stock SKUs",
        value: formatNumber(outOfStockSkuCount),
        hint: "products with 0 units"
      },
      {
        id: "lowStock",
        title: `Low Stock (<= ${lowThreshold})`,
        value: formatNumber(lowStockSkuCount),
        hint: "products below threshold"
      },
      {
        id: "locationsWithStock",
        title: "Locations with Stock",
        value: formatNumber(activeLocationCount || summary?.locationCount),
        hint: "locations currently holding units"
      },
      {
        id: "warehousesWithStock",
        title: "Warehouses",
        value: formatNumber(activeWarehouseCount || summary?.warehouseCount),
        hint: "warehouses with active inventory"
      }
    ];
  }, [inventoryRows, lowStockThreshold, skuRows, summary]);

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

    return Array.from(aggregationMap.values())
      .map((row) => ({
        warehouseId: row.warehouseId,
        warehouseCode: row.warehouseCode,
        warehouseName: row.warehouseName,
        totalUnits: row.totalUnits,
        skuCount: row.skuSet.size,
        locationCount: row.locationSet.size
      }))
      .sort((left, right) => right.totalUnits - left.totalUnits);
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

    return Array.from(aggregationMap.values())
      .map((row) => ({
        skuId: row.skuId,
        sku: row.sku,
        skuDescription: row.skuDescription,
        totalUnits: row.totalUnits,
        locationCount: row.locationSet.size,
        warehouseCount: row.warehouseSet.size,
        warehouses: row.warehouseSet
      }))
      .sort((left, right) => right.totalUnits - left.totalUnits);
  }, [inventoryRows]);

  const skuFilterOptions = useMemo(() => {
    const warehouses = [...new Set(inventoryRows.map((r) => r.warehouseCode))].sort();
    return { warehouses };
  }, [inventoryRows]);

  const filteredSkuRows = useMemo(() => {
    return allSkuRows.filter((row) => {
      if (skuFilterWarehouse && !row.warehouses.has(skuFilterWarehouse)) return false;
      if (skuFilterSearch) {
        const q = skuFilterSearch.toLowerCase();
        if (!row.sku.toLowerCase().includes(q) && !(row.skuDescription || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allSkuRows, skuFilterWarehouse, skuFilterSearch]);

  const lowStockRows = useMemo(() => {
    const threshold = Math.max(0, Number(lowStockThreshold) || 0);
    return skuRows
      .map((row) => ({
        ...row,
        totalQuantity: Number(row.totalQuantity || 0)
      }))
      .filter((row) => row.totalQuantity <= threshold)
      .sort((left, right) => left.totalQuantity - right.totalQuantity)
      .slice(0, 10);
  }, [lowStockThreshold, skuRows]);

  const handleToggleStatus = useCallback(async (loc) => {
    const newStatus = loc.status === "active" ? "locked" : "active";
    setTogglingId(loc.id);
    try {
      await patchJson(`/api/locations/${loc.id}/status`, { status: newStatus }, jwtToken, onAuthError);
      setLocationRows((prev) => prev.map((r) => r.id === loc.id ? { ...r, status: newStatus } : r));
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setTogglingId(null);
    }
  }, [jwtToken, onAuthError]);

  const locFilterOptions = useMemo(() => {
    const warehouses = [...new Set(locationRows.map((r) => r.warehouseCode))].sort();
    const zones = [...new Set(locationRows.map((r) => r.zoneName))].sort();
    const types = [...new Set(locationRows.map((r) => r.type))].sort();
    return { warehouses, zones, types };
  }, [locationRows]);

  const filteredLocations = useMemo(() => {
    return locationRows.filter((loc) => {
      if (locFilterWarehouse && loc.warehouseCode !== locFilterWarehouse) return false;
      if (locFilterZone && loc.zoneName !== locFilterZone) return false;
      if (locFilterStatus && loc.status !== locFilterStatus) return false;
      if (locFilterType && loc.type !== locFilterType) return false;
      if (locFilterSearch) {
        const q = locFilterSearch.toLowerCase();
        if (!loc.code.toLowerCase().includes(q) && !loc.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [locationRows, locFilterWarehouse, locFilterZone, locFilterStatus, locFilterType, locFilterSearch]);

  // Reset pagination when filters change
  useEffect(() => { setLocPage(1); }, [locFilterWarehouse, locFilterZone, locFilterStatus, locFilterType, locFilterSearch]);
  useEffect(() => { setSkuPage(1); }, [skuFilterSearch, skuFilterWarehouse]);

  // Pagination helpers
  const LOC_PER_PAGE = 10;
  const MOV_PER_PAGE = 10;
  const SKU_PER_PAGE = 10;

  const locTotalPages = Math.max(1, Math.ceil(filteredLocations.length / LOC_PER_PAGE));
  const pagedLocations = filteredLocations.slice((locPage - 1) * LOC_PER_PAGE, locPage * LOC_PER_PAGE);

  const movTotalPages = Math.max(1, Math.ceil(movementRows.length / MOV_PER_PAGE));
  const pagedMovements = movementRows.slice((movPage - 1) * MOV_PER_PAGE, movPage * MOV_PER_PAGE);

  const skuTotalPages = Math.max(1, Math.ceil(filteredSkuRows.length / SKU_PER_PAGE));
  const pagedSkuRows = filteredSkuRows.slice((skuPage - 1) * SKU_PER_PAGE, skuPage * SKU_PER_PAGE);

  const PaginationControls = ({ page, totalPages, setPage, totalItems, label }) => (
    <div className="mt-3 flex items-center justify-between text-xs text-black/60">
      <p>{totalItems} {label}</p>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}
          className="rounded-lg border border-black/15 px-2 py-1 hover:bg-canvas disabled:opacity-40">Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}
          className="rounded-lg border border-black/15 px-2 py-1 hover:bg-canvas disabled:opacity-40">Next</button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Inventory Control</p>
          <div className="mt-2">
            <h1 className="text-2xl font-black sm:text-3xl">Inventory Dashboard</h1>
          </div>
        </header>

        {errorMessage && (
          <section className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
            {errorMessage}
          </section>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <article
                  key={`inventory-kpi-loading-${index}`}
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
            <h2 className="text-lg font-black">Stock by Warehouse</h2>
            <p className="text-xs text-black/60">{warehouseRows.length} active warehouse(s)</p>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`warehouse-loading-${index}`} className="h-16 animate-pulse rounded-xl bg-canvas" />
              ))}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[640px] w-full text-left text-sm">
                <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-black/60">
                  <tr>
                    <th className="px-2 py-2">Warehouse</th>
                    <th className="px-2 py-2">Locations</th>
                    <th className="px-2 py-2">SKUs</th>
                    <th className="px-2 py-2">Total Units</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseRows.map((row) => (
                    <tr key={row.warehouseId} className="border-b border-black/10">
                      <td className="px-2 py-2 font-semibold">
                        {row.warehouseCode} - {row.warehouseName}
                      </td>
                      <td className="px-2 py-2">{formatNumber(row.locationCount)}</td>
                      <td className="px-2 py-2">{formatNumber(row.skuCount)}</td>
                      <td className="px-2 py-2 font-semibold">{formatNumber(row.totalUnits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Low Stock SKUs</h2>
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
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`low-stock-loading-${index}`} className="h-14 animate-pulse rounded-xl bg-canvas" />
                ))}
              </div>
            ) : lowStockRows.length === 0 ? (
              <p className="text-sm text-black/60">No low-stock SKU under current threshold.</p>
            ) : (
              <ul className="space-y-2">
                {lowStockRows.map((row) => (
                  <li key={row.id} className="rounded-xl border border-black/10 p-3">
                    <p className="text-sm font-semibold">
                      {row.sku}{row.description ? ` - ${row.description}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-black/60">Total units: {formatNumber(row.totalQuantity)}</p>
                  </li>
                ))}
              </ul>
            )}
        </section>

        {/* SKU by Units — filtered & paginated table */}
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">SKU by Units</h2>
            <p className="text-xs text-black/60">
              {filteredSkuRows.length} of {allSkuRows.length} SKU(s)
            </p>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search SKU or description…"
              value={skuFilterSearch}
              onChange={(e) => setSkuFilterSearch(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm"
            />
            <select value={skuFilterWarehouse} onChange={(e) => setSkuFilterWarehouse(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm">
              <option value="">All warehouses</option>
              {skuFilterOptions.warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            {(skuFilterSearch || skuFilterWarehouse) && (
              <button type="button" onClick={() => { setSkuFilterSearch(""); setSkuFilterWarehouse(""); }}
                className="text-xs font-semibold text-accent hover:underline">Clear filters</button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`sku-units-loading-${index}`} className="h-14 animate-pulse rounded-xl bg-canvas" />
              ))}
            </div>
          ) : filteredSkuRows.length === 0 ? (
            <p className="text-sm text-black/60">No SKU matches the current filters.</p>
          ) : (
            <>
              <div className="overflow-auto">
                <table className="min-w-[700px] w-full text-left text-sm">
                  <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-black/60">
                    <tr>
                      <th className="px-2 py-2">SKU</th>
                      <th className="px-2 py-2">Description</th>
                      <th className="px-2 py-2">Locations</th>
                      <th className="px-2 py-2">Warehouses</th>
                      <th className="px-2 py-2 text-right">Total Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSkuRows.map((row) => (
                      <tr key={row.skuId} className="border-b border-black/10">
                        <td className="px-2 py-2 font-mono text-xs font-semibold">{row.sku}</td>
                        <td className="px-2 py-2 text-black/60">{row.skuDescription || "-"}</td>
                        <td className="px-2 py-2">{formatNumber(row.locationCount)}</td>
                        <td className="px-2 py-2">{formatNumber(row.warehouseCount)}</td>
                        <td className="px-2 py-2 text-right font-semibold">{formatNumber(row.totalUnits)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls page={skuPage} totalPages={skuTotalPages} setPage={setSkuPage}
                totalItems={filteredSkuRows.length} label="SKU(s)" />
            </>
          )}
        </section>

        {/* Locations — filtered & paginated */}
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Locations</h2>
            <p className="text-xs text-black/60">
              {filteredLocations.length} of {locationRows.length} location(s)
            </p>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search code or name…"
              value={locFilterSearch}
              onChange={(e) => setLocFilterSearch(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm"
            />
            <select value={locFilterWarehouse} onChange={(e) => setLocFilterWarehouse(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm">
              <option value="">All warehouses</option>
              {locFilterOptions.warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <select value={locFilterZone} onChange={(e) => setLocFilterZone(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm">
              <option value="">All zones</option>
              {locFilterOptions.zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <select value={locFilterStatus} onChange={(e) => setLocFilterStatus(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
            </select>
            <select value={locFilterType} onChange={(e) => setLocFilterType(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm">
              <option value="">All types</option>
              {locFilterOptions.types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {(locFilterSearch || locFilterWarehouse || locFilterZone || locFilterStatus || locFilterType) && (
              <button type="button" onClick={() => { setLocFilterSearch(""); setLocFilterWarehouse(""); setLocFilterZone(""); setLocFilterStatus(""); setLocFilterType(""); }}
                className="text-xs font-semibold text-accent hover:underline">Clear filters</button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`loc-loading-${index}`} className="h-14 animate-pulse rounded-xl bg-canvas" />
              ))}
            </div>
          ) : filteredLocations.length === 0 ? (
            <p className="text-sm text-black/60">No locations match the current filters.</p>
          ) : (
            <>
              <div className="overflow-auto">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-black/60">
                    <tr>
                      <th className="px-2 py-2">Code</th>
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Zone</th>
                      <th className="px-2 py-2">Warehouse</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2 text-center">Capacity</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLocations.map((loc) => (
                      <tr key={loc.id} className="border-b border-black/10">
                        <td className="px-2 py-2 font-mono text-xs font-semibold">{loc.code}</td>
                        <td className="px-2 py-2">{loc.name}</td>
                        <td className="px-2 py-2 text-black/60">{loc.zoneName}</td>
                        <td className="px-2 py-2 text-black/60">{loc.warehouseCode}</td>
                        <td className="px-2 py-2">
                          <span className="rounded-full border border-black/10 bg-canvas px-2 py-0.5 text-xs font-semibold">
                            {loc.type}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">{formatNumber(loc.capacity)}</td>
                        <td className="px-2 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            loc.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {loc.status}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            disabled={togglingId === loc.id}
                            onClick={() => handleToggleStatus(loc)}
                            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                              loc.status === "active"
                                ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            } disabled:opacity-50`}
                          >
                            {togglingId === loc.id ? "…" : loc.status === "active" ? "Lock" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls page={locPage} totalPages={locTotalPages} setPage={setLocPage}
                totalItems={filteredLocations.length} label="location(s)" />
            </>
          )}
        </section>

        {/* Recent Movements — paginated, 10 per page */}
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Recent Movements</h2>
            <p className="text-xs text-black/60">{movementRows.length} record(s)</p>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`movement-loading-${index}`} className="h-14 animate-pulse rounded-xl bg-canvas" />
              ))}
            </div>
          ) : movementRows.length === 0 ? (
            <p className="text-sm text-black/60">No recent movement found.</p>
          ) : (
            <>
              <div className="overflow-auto">
                <table className="min-w-[840px] w-full text-left text-sm">
                  <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-black/60">
                    <tr>
                      <th className="px-2 py-2">When</th>
                      <th className="px-2 py-2">SKU</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">From</th>
                      <th className="px-2 py-2">To</th>
                      <th className="px-2 py-2">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMovements.map((row) => {
                      const badgeClassName =
                        movementTypeClassNameMap[row.movementType] || "border-slate-300 bg-slate-100 text-slate-700";

                      return (
                        <tr key={row.id} className="border-b border-black/10">
                          <td className="px-2 py-2 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                          <td className="px-2 py-2">
                            {row.sku}{row.skuDescription ? ` - ${row.skuDescription}` : ""}
                          </td>
                          <td className="px-2 py-2">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClassName}`}>
                              {row.movementType}
                            </span>
                          </td>
                          <td className="px-2 py-2">{row.fromLocationCode || "-"}</td>
                          <td className="px-2 py-2">{row.toLocationCode || "-"}</td>
                          <td className="px-2 py-2 font-semibold">{formatNumber(row.quantity)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControls page={movPage} totalPages={movTotalPages} setPage={setMovPage}
                totalItems={movementRows.length} label="movement(s)" />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default InventoryDashboard;
