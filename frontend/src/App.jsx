import { useEffect, useMemo, useState } from "react";

const apiBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

async function fetchJson(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [movementForm, setMovementForm] = useState({
    productId: "",
    fromLocationId: "",
    toLocationId: "",
    quantity: 1,
    reference: ""
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [healthData, summaryData, warehouseData, locationData, productData, inventoryData, movementData] = await Promise.all([
        fetchJson("/api/health"),
        fetchJson("/api/summary"),
        fetchJson("/api/warehouses"),
        fetchJson("/api/locations"),
        fetchJson("/api/products"),
        fetchJson("/api/inventory"),
        fetchJson("/api/movements?limit=8")
      ]);
      setHealth(healthData);
      setSummary(summaryData);
      setWarehouses(warehouseData);
      setLocations(locationData);
      setProducts(productData);
      setInventory(inventoryData);
      setMovements(movementData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const locationOptions = useMemo(() => {
    return locations.map((location) => ({
      id: location.id,
      label: `${location.warehouseCode} / ${location.code}`
    }));
  }, [locations]);

  const handleMovement = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await fetchJson("/api/movements", {
        method: "POST",
        body: JSON.stringify({
          productId: Number(movementForm.productId),
          fromLocationId: movementForm.fromLocationId ? Number(movementForm.fromLocationId) : null,
          toLocationId: movementForm.toLocationId ? Number(movementForm.toLocationId) : null,
          quantity: Number(movementForm.quantity),
          reference: movementForm.reference || null
        })
      });
      setMovementForm({
        productId: movementForm.productId,
        fromLocationId: "",
        toLocationId: "",
        quantity: 1,
        reference: ""
      });
      await loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 text-ink sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur-sm">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">Warehouse Management Service</p>
          <h1 className="text-3xl font-black sm:text-4xl">WMS Operations Console</h1>
          <p className="mt-2 text-sm text-black/70">API base URL: {apiBaseUrl}</p>
          {health && <p className="mt-1 text-sm text-black/70">Backend status: {health.status}</p>}
        </header>

        {error && (
          <section className="rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-signal">
            Error: {error}
          </section>
        )}

        {loading ? (
          <section className="rounded-xl border border-black/10 bg-white p-4 text-sm">Loading WMS data...</section>
        ) : (
          <>
            {summary && (
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-xl border border-black/10 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-black/60">Warehouses</p>
                  <p className="text-2xl font-bold">{summary.warehouseCount}</p>
                </article>
                <article className="rounded-xl border border-black/10 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-black/60">Locations</p>
                  <p className="text-2xl font-bold">{summary.locationCount}</p>
                </article>
                <article className="rounded-xl border border-black/10 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-black/60">Products</p>
                  <p className="text-2xl font-bold">{summary.productCount}</p>
                </article>
                <article className="rounded-xl border border-black/10 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-black/60">Total Units</p>
                  <p className="text-2xl font-bold">{summary.totalUnits}</p>
                </article>
              </section>
            )}

            <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <article className="rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="text-lg font-bold">Warehouses</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {warehouses.map((warehouse) => (
                    <li key={warehouse.id} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2">
                      <span>{warehouse.code} - {warehouse.name}</span>
                      <span className="font-semibold">{warehouse.locationCount} loc.</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="text-lg font-bold">Products</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {products.map((product) => (
                    <li key={product.id} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2">
                      <span>{product.sku} - {product.name}</span>
                      <span className="font-semibold">{product.totalQuantity}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-4">
              <h2 className="text-lg font-bold">Register Stock Movement</h2>
              <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleMovement}>
                <label className="text-sm">
                  Product
                  <select
                    className="mt-1 w-full rounded-md border border-black/20 px-2 py-2"
                    value={movementForm.productId}
                    onChange={(event) => setMovementForm((current) => ({ ...current, productId: event.target.value }))}
                    required
                  >
                    <option value="">Select a product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} - {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    className="mt-1 w-full rounded-md border border-black/20 px-2 py-2"
                    value={movementForm.quantity}
                    onChange={(event) => setMovementForm((current) => ({ ...current, quantity: event.target.value }))}
                    required
                  />
                </label>

                <label className="text-sm">
                  From location (optional)
                  <select
                    className="mt-1 w-full rounded-md border border-black/20 px-2 py-2"
                    value={movementForm.fromLocationId}
                    onChange={(event) => setMovementForm((current) => ({ ...current, fromLocationId: event.target.value }))}
                  >
                    <option value="">None (inbound)</option>
                    {locationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  To location (optional)
                  <select
                    className="mt-1 w-full rounded-md border border-black/20 px-2 py-2"
                    value={movementForm.toLocationId}
                    onChange={(event) => setMovementForm((current) => ({ ...current, toLocationId: event.target.value }))}
                  >
                    <option value="">None (outbound)</option>
                    {locationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm md:col-span-2">
                  Reference (optional)
                  <input
                    type="text"
                    maxLength="120"
                    className="mt-1 w-full rounded-md border border-black/20 px-2 py-2"
                    value={movementForm.reference}
                    onChange={(event) => setMovementForm((current) => ({ ...current, reference: event.target.value }))}
                    placeholder="PO-42021 / Manual adjustment..."
                  />
                </label>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    Save Movement
                  </button>
                </div>
              </form>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <article className="rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="text-lg font-bold">Inventory Snapshot</h2>
                <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-black/10">
                  <table className="w-full min-w-[540px] text-left text-sm">
                    <thead className="bg-canvas">
                      <tr>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Warehouse</th>
                        <th className="px-3 py-2">Location</th>
                        <th className="px-3 py-2">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((item) => (
                        <tr key={item.id} className="border-t border-black/10">
                          <td className="px-3 py-2">{item.sku}</td>
                          <td className="px-3 py-2">{item.warehouseCode}</td>
                          <td className="px-3 py-2">{item.locationCode}</td>
                          <td className="px-3 py-2 font-semibold">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="rounded-2xl border border-black/10 bg-white p-4">
                <h2 className="text-lg font-bold">Recent Movements</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {movements.map((movement) => (
                    <li key={movement.id} className="rounded-lg bg-canvas px-3 py-2">
                      <p className="font-semibold">{movement.sku} x {movement.quantity} ({movement.movementType})</p>
                      <p className="text-xs text-black/70">
                        {movement.fromLocationCode || "External"} to {movement.toLocationCode || "External"}
                      </p>
                      <p className="text-xs text-black/60">{new Date(movement.createdAt).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default App;
