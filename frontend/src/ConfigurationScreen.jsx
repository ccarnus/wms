import React, { useCallback, useEffect, useState } from "react";

const API_BASE = window.__API_BASE_URL__ || "";

const ZONE_TYPES = ["pick", "bulk", "dock", "staging"];
const LOCATION_TYPES = ["rack", "shelf", "bin", "floor", "dock", "staging"];
const LOCATION_STATUSES = ["active", "locked"];

function getHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/* ── Small UI helpers ─────────────────────────────────────────────── */

function Badge({ children, color }) {
  const colors = {
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-gray-100 text-gray-600",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  return <Badge color={status === "active" ? "green" : "red"}>{status}</Badge>;
}

function ZoneTypeBadge({ type }) {
  const colorMap = { pick: "blue", bulk: "purple", dock: "amber", staging: "gray" };
  return <Badge color={colorMap[type] || "gray"}>{type}</Badge>;
}

function LocTypeBadge({ type }) {
  const colorMap = { rack: "blue", shelf: "purple", bin: "green", floor: "amber", dock: "gray", staging: "gray" };
  return <Badge color={colorMap[type] || "gray"}>{type}</Badge>;
}

/* ── Modal ────────────────────────────────────────────────────────── */

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Warehouse Form ──────────────────────────────────────────────── */

function WarehouseForm({ warehouse, onSave, onClose }) {
  const [code, setCode] = useState(warehouse?.code || "");
  const [name, setName] = useState(warehouse?.name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ code: code.trim(), name: name.trim() });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Code</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} required
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. WH-PARIS-01" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. Paris Main Warehouse" />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50">
          {saving ? "Saving…" : warehouse ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

/* ── Zone Form ────────────────────────────────────────────────────── */

function ZoneForm({ zone, warehouses, onSave, onClose }) {
  const [name, setName] = useState(zone?.name || "");
  const [type, setType] = useState(zone?.type || "pick");
  const [warehouseId, setWarehouseId] = useState(zone?.warehouseId || (warehouses[0]?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, type, warehouseId: Number(warehouseId) });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {!zone && (
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Warehouse</span>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. Paris Pick Zone" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          {ZONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50">
          {saving ? "Saving…" : zone ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

/* ── Location Form ────────────────────────────────────────────────── */

function LocationForm({ location, zones, onSave, onClose }) {
  const [code, setCode] = useState(location?.code || "");
  const [name, setName] = useState(location?.name || "");
  const [zoneId, setZoneId] = useState(location?.zoneId || (zones[0]?.id ?? ""));
  const [status, setStatus] = useState(location?.status || "active");
  const [type, setType] = useState(location?.type || "rack");
  const [capacity, setCapacity] = useState(location?.capacity || 1000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ code, name, zoneId, status, type, capacity: Number(capacity) });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Zone</span>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          {zones.map((z) => <option key={z.id} value={z.id}>{z.warehouseCode} — {z.name} ({z.type})</option>)}
        </select>
      </label>
      {!location && (
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Code</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. PAR-RACK-A1" />
        </label>
      )}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. Paris Rack A1" />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {LOCATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Capacity</span>
          <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50">
          {saving ? "Saving…" : location ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

/* ── SKU Form ─────────────────────────────────────────────────────── */

function SkuForm({ skuData, onSave, onClose }) {
  const [sku, setSku] = useState(skuData?.sku || "");
  const [description, setDescription] = useState(skuData?.description || "");
  const [weightKg, setWeightKg] = useState(skuData?.weightKg ?? "");
  const [dimensionXCm, setDimensionXCm] = useState(skuData?.dimensionXCm ?? "");
  const [dimensionYCm, setDimensionYCm] = useState(skuData?.dimensionYCm ?? "");
  const [dimensionZCm, setDimensionZCm] = useState(skuData?.dimensionZCm ?? "");
  const [pictureUrl, setPictureUrl] = useState(skuData?.pictureUrl || "");
  const [barcodesText, setBarcodesText] = useState(
    Array.isArray(skuData?.barcodes) ? skuData.barcodes.join(", ") : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const barcodes = barcodesText.trim()
        ? barcodesText.split(",").map((b) => b.trim()).filter(Boolean)
        : null;

      const payload = {
        sku,
        description: description || null,
        weightKg: weightKg !== "" ? Number(weightKg) : null,
        dimensionXCm: dimensionXCm !== "" ? Number(dimensionXCm) : null,
        dimensionYCm: dimensionYCm !== "" ? Number(dimensionYCm) : null,
        dimensionZCm: dimensionZCm !== "" ? Number(dimensionZCm) : null,
        pictureUrl: pictureUrl || null,
        barcodes,
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">SKU Code *</span>
          <input value={sku} onChange={(e) => setSku(e.target.value)} required disabled={!!skuData}
            className={`${inputClass} ${skuData ? "bg-gray-100 text-gray-500" : ""}`}
            placeholder="e.g. SKU-1001" />
          {skuData && <p className="mt-0.5 text-[11px] text-black/40">SKU code cannot be changed</p>}
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            className={inputClass} placeholder="e.g. Storage Bin Small" />
        </label>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Weight (kg)</span>
          <input type="number" min="0" step="any" value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
            className={inputClass} placeholder="0.0" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">X (cm)</span>
          <input type="number" min="0" step="any" value={dimensionXCm} onChange={(e) => setDimensionXCm(e.target.value)}
            className={inputClass} placeholder="0.0" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Y (cm)</span>
          <input type="number" min="0" step="any" value={dimensionYCm} onChange={(e) => setDimensionYCm(e.target.value)}
            className={inputClass} placeholder="0.0" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Z (cm)</span>
          <input type="number" min="0" step="any" value={dimensionZCm} onChange={(e) => setDimensionZCm(e.target.value)}
            className={inputClass} placeholder="0.0" />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Picture URL</span>
        <input value={pictureUrl} onChange={(e) => setPictureUrl(e.target.value)}
          className={inputClass} placeholder="https://..." />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Barcodes</span>
        <input value={barcodesText} onChange={(e) => setBarcodesText(e.target.value)}
          className={inputClass} placeholder="Comma-separated, e.g. 012345678901, 012345678902" />
        <p className="mt-0.5 text-[11px] text-black/40">Separate multiple barcodes with commas</p>
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50">
          {saving ? "Saving…" : skuData ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

/* ── Main Screen ──────────────────────────────────────────────────── */

export default function ConfigurationScreen({ jwtToken, onAuthError }) {
  const [tab, setTab] = useState("warehouses");
  const [warehouses, setWarehouses] = useState([]);
  const [zones, setZones] = useState([]);
  const [locations, setLocations] = useState([]);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [modal, setModal] = useState(null); // { type: 'warehouse'|'zone'|'location'|'sku', mode: 'create'|'edit', data?: object }

  const apiFetch = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: getHeaders(jwtToken),
    });
    if (res.status === 401) { onAuthError(); return null; }
    if (res.status === 204) return null;
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }, [jwtToken, onAuthError]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [wh, zn, loc, sk] = await Promise.all([
        apiFetch("/api/warehouses"),
        apiFetch("/api/zones"),
        apiFetch("/api/locations"),
        apiFetch("/api/skus"),
      ]);
      if (wh) setWarehouses(wh);
      if (zn) setZones(zn);
      if (loc) setLocations(loc);
      if (sk) setSkus(sk);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Zone CRUD handlers ───────────────────────────────────── */
  const handleCreateZone = async (data) => {
    await apiFetch("/api/zones", { method: "POST", body: JSON.stringify(data) });
    await loadData();
  };

  const handleUpdateZone = async (id, data) => {
    await apiFetch(`/api/zones/${id}`, { method: "PUT", body: JSON.stringify(data) });
    await loadData();
  };

  const handleDeleteZone = async (id) => {
    if (!window.confirm("Delete this zone? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/zones/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── Location CRUD handlers ───────────────────────────────── */
  const handleCreateLocation = async (data) => {
    await apiFetch("/api/locations", { method: "POST", body: JSON.stringify(data) });
    await loadData();
  };

  const handleUpdateLocation = async (id, data) => {
    await apiFetch(`/api/locations/${id}`, { method: "PUT", body: JSON.stringify(data) });
    await loadData();
  };

  const handleDeleteLocation = async (id) => {
    if (!window.confirm("Delete this location? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/locations/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── SKU CRUD handlers ────────────────────────────────────── */
  const handleCreateSku = async (data) => {
    await apiFetch("/api/skus", { method: "POST", body: JSON.stringify(data) });
    await loadData();
  };

  const handleUpdateSku = async (id, data) => {
    await apiFetch(`/api/skus/${id}`, { method: "PUT", body: JSON.stringify(data) });
    await loadData();
  };

  const handleDeleteSku = async (id) => {
    if (!window.confirm("Delete this SKU? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/skus/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── Warehouse CRUD handlers ────────────────────────────────── */
  const handleCreateWarehouse = async (data) => {
    await apiFetch("/api/warehouses", { method: "POST", body: JSON.stringify(data) });
    await loadData();
  };

  const handleUpdateWarehouse = async (id, data) => {
    await apiFetch(`/api/warehouses/${id}`, { method: "PUT", body: JSON.stringify(data) });
    await loadData();
  };

  const handleDeleteWarehouse = async (id) => {
    if (!window.confirm("Delete this warehouse? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/warehouses/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── Render tab content ─────────────────────────────────────── */

  const renderWarehousesTab = () => (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Warehouses</h2>
        <button
          type="button"
          onClick={() => setModal({ type: "warehouse", mode: "create" })}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
        >
          + New Warehouse
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-canvas">
              <th className="px-4 py-3 font-semibold text-black/60">Code</th>
              <th className="px-4 py-3 font-semibold text-black/60">Name</th>
              <th className="px-4 py-3 text-center font-semibold text-black/60">Locations</th>
              <th className="px-4 py-3 text-right font-semibold text-black/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-black/40">No warehouses yet. Create one to get started.</td></tr>
            ) : warehouses.map((w) => (
              <tr key={w.id} className="border-b border-black/5 last:border-0 hover:bg-canvas/50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{w.code}</td>
                <td className="px-4 py-3 text-ink">{w.name}</td>
                <td className="px-4 py-3 text-center">{w.locationCount}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setModal({ type: "warehouse", mode: "edit", data: w })}
                    className="mr-2 text-xs font-semibold text-accent hover:underline">Edit</button>
                  <button type="button" onClick={() => handleDeleteWarehouse(w.id)}
                    className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderZonesTab = () => (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Zones</h2>
        <button
          type="button"
          onClick={() => setModal({ type: "zone", mode: "create" })}
          disabled={warehouses.length === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
        >
          + New Zone
        </button>
      </div>
      {warehouses.length === 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          You must create at least one warehouse before adding zones.
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-canvas">
              <th className="px-4 py-3 font-semibold text-black/60">Name</th>
              <th className="px-4 py-3 font-semibold text-black/60">Type</th>
              <th className="px-4 py-3 font-semibold text-black/60">Warehouse</th>
              <th className="px-4 py-3 text-center font-semibold text-black/60">Locations</th>
              <th className="px-4 py-3 text-right font-semibold text-black/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {zones.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-black/40">No zones yet. Create one to get started.</td></tr>
            ) : zones.map((z) => (
              <tr key={z.id} className="border-b border-black/5 last:border-0 hover:bg-canvas/50">
                <td className="px-4 py-3 font-semibold text-ink">{z.name}</td>
                <td className="px-4 py-3"><ZoneTypeBadge type={z.type} /></td>
                <td className="px-4 py-3 text-black/60">{z.warehouseCode}</td>
                <td className="px-4 py-3 text-center">{z.locationCount}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setModal({ type: "zone", mode: "edit", data: z })}
                    className="mr-2 text-xs font-semibold text-accent hover:underline">Edit</button>
                  <button type="button" onClick={() => handleDeleteZone(z.id)}
                    className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderLocationsTab = () => (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Locations</h2>
        <button
          type="button"
          onClick={() => setModal({ type: "location", mode: "create" })}
          disabled={zones.length === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
        >
          + New Location
        </button>
      </div>
      {zones.length === 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          You must create at least one zone before adding locations.
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-canvas">
              <th className="px-4 py-3 font-semibold text-black/60">Code</th>
              <th className="px-4 py-3 font-semibold text-black/60">Name</th>
              <th className="px-4 py-3 font-semibold text-black/60">Zone</th>
              <th className="px-4 py-3 font-semibold text-black/60">Warehouse</th>
              <th className="px-4 py-3 font-semibold text-black/60">Type</th>
              <th className="px-4 py-3 font-semibold text-black/60">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-black/60">Capacity</th>
              <th className="px-4 py-3 text-right font-semibold text-black/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-black/40">No locations yet.</td></tr>
            ) : locations.map((loc) => (
              <tr key={loc.id} className="border-b border-black/5 last:border-0 hover:bg-canvas/50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{loc.code}</td>
                <td className="px-4 py-3 text-ink">{loc.name}</td>
                <td className="px-4 py-3 text-black/60">{loc.zoneName}</td>
                <td className="px-4 py-3 text-black/60">{loc.warehouseCode}</td>
                <td className="px-4 py-3"><LocTypeBadge type={loc.type} /></td>
                <td className="px-4 py-3"><StatusBadge status={loc.status} /></td>
                <td className="px-4 py-3 text-center">{loc.capacity}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setModal({ type: "location", mode: "edit", data: loc })}
                    className="mr-2 text-xs font-semibold text-accent hover:underline">Edit</button>
                  <button type="button" onClick={() => handleDeleteLocation(loc.id)}
                    className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const formatDimensions = (s) => {
    const parts = [s.dimensionXCm, s.dimensionYCm, s.dimensionZCm].filter((v) => v != null);
    return parts.length > 0 ? parts.join(" x ") : null;
  };

  const renderSkusTab = () => (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">SKUs</h2>
        <button
          type="button"
          onClick={() => setModal({ type: "sku", mode: "create" })}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
        >
          + New SKU
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-canvas">
                <th className="px-4 py-3 font-semibold text-black/60">SKU</th>
                <th className="px-4 py-3 font-semibold text-black/60">Description</th>
                <th className="px-4 py-3 font-semibold text-black/60">Weight</th>
                <th className="px-4 py-3 font-semibold text-black/60">Dimensions (cm)</th>
                <th className="px-4 py-3 font-semibold text-black/60">Barcodes</th>
                <th className="px-4 py-3 text-center font-semibold text-black/60">Stock</th>
                <th className="px-4 py-3 text-right font-semibold text-black/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {skus.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-black/40">No SKUs yet. Create one to get started.</td></tr>
              ) : skus.map((s) => {
                const dims = formatDimensions(s);
                const barcodeCount = Array.isArray(s.barcodes) ? s.barcodes.length : 0;
                return (
                  <tr key={s.id} className="border-b border-black/5 last:border-0 hover:bg-canvas/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{s.sku}</td>
                    <td className="px-4 py-3 text-black/70">{s.description || <span className="text-black/30">—</span>}</td>
                    <td className="px-4 py-3 text-black/70">{s.weightKg != null ? `${s.weightKg} kg` : <span className="text-black/30">—</span>}</td>
                    <td className="px-4 py-3 text-black/70">{dims || <span className="text-black/30">—</span>}</td>
                    <td className="px-4 py-3">
                      {barcodeCount > 0 ? (
                        <Badge color="blue">{barcodeCount}</Badge>
                      ) : (
                        <span className="text-black/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {s.totalQuantity > 0 ? (
                        s.totalQuantity.toLocaleString()
                      ) : (
                        <span className="text-black/30">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => setModal({ type: "sku", mode: "edit", data: s })}
                        className="mr-2 text-xs font-semibold text-accent hover:underline">Edit</button>
                      <button type="button" onClick={() => handleDeleteSku(s.id)}
                        className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Configuration</h1>
        <p className="mt-1 text-sm text-black/60">Manage warehouse zones, locations, and SKUs</p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-black/10 bg-white p-1">
        {[
          { id: "warehouses", label: "Warehouses", count: warehouses.length },
          { id: "zones", label: "Zones", count: zones.length },
          { id: "locations", label: "Locations", count: locations.length },
          { id: "skus", label: "SKUs", count: skus.length },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
              tab === t.id
                ? "bg-accent text-white shadow-sm"
                : "text-black/60 hover:bg-canvas hover:text-ink"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs ${tab === t.id ? "text-white/80" : "text-black/40"}`}>
              ({t.count})
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : tab === "warehouses" ? renderWarehousesTab()
        : tab === "zones" ? renderZonesTab()
        : tab === "locations" ? renderLocationsTab()
        : renderSkusTab()}

      {/* ── Modals ────────────────────────────────────────────── */}
      {modal?.type === "warehouse" && (
        <Modal title={modal.mode === "create" ? "Create Warehouse" : "Edit Warehouse"} onClose={() => setModal(null)}>
          <WarehouseForm
            warehouse={modal.data}
            onSave={(data) => modal.mode === "create" ? handleCreateWarehouse(data) : handleUpdateWarehouse(modal.data.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "zone" && (
        <Modal title={modal.mode === "create" ? "Create Zone" : "Edit Zone"} onClose={() => setModal(null)}>
          <ZoneForm
            zone={modal.data}
            warehouses={warehouses}
            onSave={(data) => modal.mode === "create" ? handleCreateZone(data) : handleUpdateZone(modal.data.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "location" && (
        <Modal title={modal.mode === "create" ? "Create Location" : "Edit Location"} onClose={() => setModal(null)}>
          <LocationForm
            location={modal.data}
            zones={zones}
            onSave={(data) => modal.mode === "create" ? handleCreateLocation(data) : handleUpdateLocation(modal.data.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "sku" && (
        <Modal title={modal.mode === "create" ? "Create SKU" : "Edit SKU"} onClose={() => setModal(null)} wide>
          <SkuForm
            skuData={modal.data}
            onSave={(data) => modal.mode === "create" ? handleCreateSku(data) : handleUpdateSku(modal.data.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
