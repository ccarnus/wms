import React, { useCallback, useEffect, useMemo, useState } from "react";

const runtimeApiBaseUrl = typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "";
const apiBaseUrl = String(runtimeApiBaseUrl || "").replace(/\/+$/, "");
const apiDisplayUrl = apiBaseUrl || "same-origin (/api)";
const buildApiUrl = (path) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

const POLLING_INTERVAL_MS = 10000;

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

async function fetchJson(path, jwtToken = "") {
  const headers = { "Content-Type": "application/json" };
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  }
  const response = await fetch(buildApiUrl(path), { headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

function InventoryDashboard({ jwtToken, user }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [summary, setSummary] = useState(null);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [productRows, setProductRows] = useState([]);
  const [movementRows, setMovementRows] = useState([]);

  const [lowStockThreshold, setLowStockThreshold] = useState(20);

  const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [summaryResponse, inventoryResponse, productsResponse, movementsResponse] = await Promise.all([
        fetchJson("/api/summary", jwtToken),
        fetchJson("/api/inventory", jwtToken),
        fetchJson("/api/products", jwtToken),
        fetchJson(`/api/movements?${toQueryString({ limit: 12 })}`, jwtToken)
      ]);

      setSummary(summaryResponse || null);
      setInventoryRows(Array.isArray(inventoryResponse) ? inventoryResponse : []);
      setProductRows(Array.isArray(productsResponse) ? productsResponse : []);
      setMovementRows(Array.isArray(movementsResponse) ? movementsResponse : []);
      setLastUpdatedAt(new Date());
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message || "Failed to load inventory dashboard");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [jwtToken]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadDashboardData({ silent: true });
    }, POLLING_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadDashboardData]);

  const kpis = useMemo(() => {
    const lowThreshold = Math.max(0, Number(lowStockThreshold) || 0);
    const outOfStockSkuCount = productRows.filter((row) => Number(row.totalQuantity || 0) <= 0).length;
    const lowStockSkuCount = productRows.filter((row) => {
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
        value: formatNumber(summary?.productCount || productRows.length),
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
  }, [inventoryRows, lowStockThreshold, productRows, summary]);

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
      aggregationRow.skuSet.add(row.productId);
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

  const topSkuRows = useMemo(() => {
    const aggregationMap = new Map();

    for (const row of inventoryRows) {
      if (!aggregationMap.has(row.productId)) {
        aggregationMap.set(row.productId, {
          productId: row.productId,
          sku: row.sku,
          productName: row.productName,
          totalUnits: 0,
          locationSet: new Set(),
          warehouseSet: new Set()
        });
      }

      const aggregationRow = aggregationMap.get(row.productId);
      aggregationRow.totalUnits += Number(row.quantity || 0);
      aggregationRow.locationSet.add(row.locationId);
      aggregationRow.warehouseSet.add(row.warehouseCode);
    }

    return Array.from(aggregationMap.values())
      .map((row) => ({
        productId: row.productId,
        sku: row.sku,
        productName: row.productName,
        totalUnits: row.totalUnits,
        locationCount: row.locationSet.size,
        warehouseCount: row.warehouseSet.size
      }))
      .sort((left, right) => right.totalUnits - left.totalUnits)
      .slice(0, 8);
  }, [inventoryRows]);

  const lowStockRows = useMemo(() => {
    const threshold = Math.max(0, Number(lowStockThreshold) || 0);
    return productRows
      .map((row) => ({
        ...row,
        totalQuantity: Number(row.totalQuantity || 0)
      }))
      .filter((row) => row.totalQuantity <= threshold)
      .sort((left, right) => left.totalQuantity - right.totalQuantity)
      .slice(0, 10);
  }, [lowStockThreshold, productRows]);

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Inventory Control</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-black sm:text-3xl">Inventory Dashboard</h1>
            <button
              type="button"
              className="rounded-lg border border-black/15 bg-canvas px-3 py-2 text-xs font-semibold"
              onClick={() => loadDashboardData()}
              disabled={isLoading || isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh now"}
            </button>
          </div>
          <p className="mt-2 text-xs text-black/60">API: {apiDisplayUrl}</p>
          <p className="mt-1 text-xs text-black/60">
            {lastUpdatedAt ? `Last updated ${lastUpdatedAt.toLocaleTimeString()}` : "Waiting for first refresh"}
          </p>
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

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
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
                      {row.sku} - {row.name}
                    </p>
                    <p className="mt-1 text-xs text-black/60">Total units: {formatNumber(row.totalQuantity)}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black">Top SKUs by Units</h2>
              <p className="text-xs text-black/60">Top {topSkuRows.length}</p>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`top-sku-loading-${index}`} className="h-14 animate-pulse rounded-xl bg-canvas" />
                ))}
              </div>
            ) : topSkuRows.length === 0 ? (
              <p className="text-sm text-black/60">No inventory rows found.</p>
            ) : (
              <ul className="space-y-2">
                {topSkuRows.map((row) => (
                  <li key={row.productId} className="rounded-xl border border-black/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {row.sku} - {row.productName}
                      </p>
                      <span className="rounded-full border border-black/10 bg-canvas px-2 py-0.5 text-xs font-semibold">
                        {formatNumber(row.totalUnits)} units
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-black/60">
                      {formatNumber(row.locationCount)} location(s), {formatNumber(row.warehouseCount)} warehouse(s)
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Recent Movements</h2>
            <p className="text-xs text-black/60">Last {movementRows.length} records</p>
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
                  {movementRows.map((row) => {
                    const badgeClassName =
                      movementTypeClassNameMap[row.movementType] || "border-slate-300 bg-slate-100 text-slate-700";

                    return (
                      <tr key={row.id} className="border-b border-black/10">
                        <td className="px-2 py-2 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                        <td className="px-2 py-2">
                          {row.sku} - {row.productName}
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
          )}
        </section>
      </div>
    </main>
  );
}

export default InventoryDashboard;
