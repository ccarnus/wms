import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = window.__API_BASE_URL__ || "";

const ZONE_TYPES = ["pick", "bulk", "dock", "staging", "packing"];
const LOCATION_TYPES = ["rack", "shelf", "bin", "floor", "dock", "staging"];
const LOCATION_STATUSES = ["active", "locked"];
const WRITE_ROLES = ["admin", "warehouse_manager"];

function getHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/* ── CSV helpers ──────────────────────────────────────────────────── */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

function csvEscape(value) {
  const str = value == null ? "" : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const SKU_CSV_COLUMNS = [
  "sku", "description", "category", "unitOfMeasure",
  "weightKg", "dimensionXCm", "dimensionYCm", "dimensionZCm",
  "pictureUrl", "barcodes", "minStockLevel", "maxStockLevel", "isActive",
];

function buildSkuCsv(skus) {
  const lines = [SKU_CSV_COLUMNS.join(",")];
  for (const s of skus) {
    lines.push(SKU_CSV_COLUMNS.map((col) => {
      if (col === "barcodes") return csvEscape(Array.isArray(s.barcodes) ? s.barcodes.join(";") : "");
      return csvEscape(s[col]);
    }).join(","));
  }
  return lines.join("\n");
}

// Maps parsed CSV rows (header row first) to SKU import payload objects.
function csvRowsToSkus(rows) {
  if (rows.length < 2) throw new Error("CSV must have a header row and at least one data row");
  const headers = rows[0].map((h) => h.trim());
  const colIndex = {};
  SKU_CSV_COLUMNS.forEach((col) => {
    const idx = headers.findIndex((h) => h.toLowerCase() === col.toLowerCase());
    if (idx >= 0) colIndex[col] = idx;
  });
  if (colIndex.sku === undefined) throw new Error('CSV must have a "sku" column');

  return rows.slice(1).map((row) => {
    const get = (col) => {
      const idx = colIndex[col];
      if (idx === undefined) return undefined;
      const value = (row[idx] ?? "").trim();
      return value === "" ? undefined : value;
    };
    const record = { sku: get("sku") || "" };
    for (const col of ["description", "category", "unitOfMeasure", "pictureUrl"]) {
      const value = get(col);
      if (value !== undefined) record[col] = value;
    }
    for (const col of ["weightKg", "dimensionXCm", "dimensionYCm", "dimensionZCm", "minStockLevel", "maxStockLevel"]) {
      const value = get(col);
      if (value !== undefined) record[col] = Number(value);
    }
    const barcodes = get("barcodes");
    if (barcodes !== undefined) {
      record.barcodes = barcodes.split(";").map((b) => b.trim()).filter(Boolean);
    }
    const isActive = get("isActive");
    if (isActive !== undefined) record.isActive = isActive.toLowerCase() === "true";
    return record;
  });
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
    teal: "bg-teal-100 text-teal-700",
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

function ActiveBadge({ isActive }) {
  return <Badge color={isActive ? "green" : "gray"}>{isActive ? "active" : "inactive"}</Badge>;
}

function ZoneTypeBadge({ type }) {
  const colorMap = { pick: "blue", bulk: "purple", dock: "amber", staging: "gray", packing: "teal" };
  return <Badge color={colorMap[type] || "gray"}>{type}</Badge>;
}

function LocTypeBadge({ type }) {
  const colorMap = { rack: "blue", shelf: "purple", bin: "green", floor: "amber", dock: "gray", staging: "gray" };
  return <Badge color={colorMap[type] || "gray"}>{type}</Badge>;
}

function UtilizationBar({ used, capacity }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : 0;
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-black/60">{used.toLocaleString()}/{capacity.toLocaleString()}</span>
    </div>
  );
}

const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
const filterInputClass = "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm";

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-lg"} overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormActions({ saving, onClose, submitLabel }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
      <button type="submit" disabled={saving}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50">
        {saving ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

/* ── Warehouse Form ──────────────────────────────────────────────── */

function WarehouseForm({ warehouse, onSave, onClose }) {
  const [code, setCode] = useState(warehouse?.code || "");
  const [name, setName] = useState(warehouse?.name || "");
  const [address, setAddress] = useState(warehouse?.address || "");
  const [city, setCity] = useState(warehouse?.city || "");
  const [country, setCountry] = useState(warehouse?.country || "");
  const [isActive, setIsActive] = useState(warehouse ? warehouse.isActive : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        code: code.trim(),
        name: name.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        isActive,
      });
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
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Code *</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} required
            className={inputClass} placeholder="e.g. WH-PARIS-01" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className={inputClass} placeholder="e.g. Paris Main Warehouse" />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Address</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)}
          className={inputClass} placeholder="e.g. 12 Rue de la Logistique" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">City</span>
          <input value={city} onChange={(e) => setCity(e.target.value)}
            className={inputClass} placeholder="e.g. Paris" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Country</span>
          <input value={country} onChange={(e) => setCountry(e.target.value)}
            className={inputClass} placeholder="e.g. France" />
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300" />
        <span className="text-sm font-semibold text-gray-700">Active</span>
      </label>
      <FormActions saving={saving} onClose={onClose} submitLabel={warehouse ? "Update" : "Create"} />
    </form>
  );
}

/* ── Zone Form ────────────────────────────────────────────────────── */

function ZoneForm({ zone, warehouses, onSave, onClose }) {
  const [name, setName] = useState(zone?.name || "");
  const [type, setType] = useState(zone?.type || "pick");
  const [description, setDescription] = useState(zone?.description || "");
  const [warehouseId, setWarehouseId] = useState(zone?.warehouseId || (warehouses[0]?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name,
        type,
        description: description.trim() || null,
        warehouseId: Number(warehouseId),
      });
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
            className={inputClass}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Name *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className={inputClass} placeholder="e.g. Paris Pick Zone" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          {ZONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Description</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)}
          className={inputClass} placeholder="e.g. Ground-floor fast movers" />
      </label>
      <FormActions saving={saving} onClose={onClose} submitLabel={zone ? "Update" : "Create"} />
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
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={inputClass}>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.warehouseCode} — {z.name} ({z.type})</option>)}
        </select>
      </label>
      {!location && (
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Code *</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} required
            className={inputClass} placeholder="e.g. PAR-RACK-A1" />
        </label>
      )}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Name *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className={inputClass} placeholder="e.g. Paris Rack A1" />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {LOCATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Capacity</span>
          <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required
            className={inputClass} />
        </label>
      </div>
      <FormActions saving={saving} onClose={onClose} submitLabel={location ? "Update" : "Create"} />
    </form>
  );
}

/* ── Bulk Location Form ───────────────────────────────────────────── */

function BulkLocationForm({ zones, onSave, onClose }) {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [prefix, setPrefix] = useState("");
  const [start, setStart] = useState(1);
  const [count, setCount] = useState(10);
  const [padding, setPadding] = useState(2);
  const [type, setType] = useState("rack");
  const [capacity, setCapacity] = useState(1000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const preview = useMemo(() => {
    const startNum = Number(start);
    const countNum = Number(count);
    const padNum = Number(padding);
    if (!prefix || !Number.isInteger(countNum) || countNum < 1) return null;
    const first = `${prefix}${String(startNum).padStart(padNum, "0")}`;
    const last = `${prefix}${String(startNum + countNum - 1).padStart(padNum, "0")}`;
    return countNum === 1 ? first : `${first} … ${last}`;
  }, [prefix, start, count, padding]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await onSave({
        zoneId,
        prefix,
        start: Number(start),
        count: Number(count),
        padding: Number(padding),
        type,
        capacity: Number(capacity),
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Created {result.created} location{result.created === 1 ? "" : "s"}
          {result.skipped > 0 ? ` — ${result.skipped} skipped (code already exists)` : ""}.
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={onClose}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">Zone</span>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={inputClass}>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.warehouseCode} — {z.name} ({z.type})</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Code prefix *</span>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} required
            className={inputClass} placeholder="e.g. PAR-A1-" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Number padding</span>
          <input type="number" min="0" max="6" value={padding} onChange={(e) => setPadding(e.target.value)}
            className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Start number</span>
          <input type="number" min="0" value={start} onChange={(e) => setStart(e.target.value)} required
            className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Count (max 500)</span>
          <input type="number" min="1" max="500" value={count} onChange={(e) => setCount(e.target.value)} required
            className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Capacity each</span>
          <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required
            className={inputClass} />
        </label>
      </div>
      {preview && (
        <p className="rounded-lg bg-canvas p-3 font-mono text-xs text-black/60">{preview}</p>
      )}
      <FormActions saving={saving} onClose={onClose} submitLabel="Generate" />
    </form>
  );
}

/* ── SKU Form ─────────────────────────────────────────────────────── */

function SkuForm({ skuData, onSave, onClose }) {
  const [sku, setSku] = useState(skuData?.sku || "");
  const [description, setDescription] = useState(skuData?.description || "");
  const [category, setCategory] = useState(skuData?.category || "");
  const [unitOfMeasure, setUnitOfMeasure] = useState(skuData?.unitOfMeasure || "each");
  const [weightKg, setWeightKg] = useState(skuData?.weightKg ?? "");
  const [dimensionXCm, setDimensionXCm] = useState(skuData?.dimensionXCm ?? "");
  const [dimensionYCm, setDimensionYCm] = useState(skuData?.dimensionYCm ?? "");
  const [dimensionZCm, setDimensionZCm] = useState(skuData?.dimensionZCm ?? "");
  const [minStockLevel, setMinStockLevel] = useState(skuData?.minStockLevel ?? "");
  const [maxStockLevel, setMaxStockLevel] = useState(skuData?.maxStockLevel ?? "");
  const [pictureUrl, setPictureUrl] = useState(skuData?.pictureUrl || "");
  const [barcodesText, setBarcodesText] = useState(
    Array.isArray(skuData?.barcodes) ? skuData.barcodes.join(", ") : ""
  );
  const [isActive, setIsActive] = useState(skuData ? skuData.isActive : true);
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
        category: category || null,
        unitOfMeasure: unitOfMeasure || null,
        weightKg: weightKg !== "" ? Number(weightKg) : null,
        dimensionXCm: dimensionXCm !== "" ? Number(dimensionXCm) : null,
        dimensionYCm: dimensionYCm !== "" ? Number(dimensionYCm) : null,
        dimensionZCm: dimensionZCm !== "" ? Number(dimensionZCm) : null,
        minStockLevel: minStockLevel !== "" ? Number(minStockLevel) : null,
        maxStockLevel: maxStockLevel !== "" ? Number(maxStockLevel) : null,
        pictureUrl: pictureUrl || null,
        barcodes,
        isActive,
      };

      await onSave(payload);
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

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Category</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)}
            className={inputClass} placeholder="e.g. Spare Parts" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Unit of measure</span>
          <input value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)}
            className={inputClass} placeholder="e.g. each, box, pallet" />
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

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Min stock level</span>
          <input type="number" min="0" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)}
            className={inputClass} placeholder="Reorder threshold" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Max stock level</span>
          <input type="number" min="0" value={maxStockLevel} onChange={(e) => setMaxStockLevel(e.target.value)}
            className={inputClass} placeholder="Target ceiling" />
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

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300" />
        <span className="text-sm font-semibold text-gray-700">Active</span>
      </label>

      <FormActions saving={saving} onClose={onClose} submitLabel={skuData ? "Update" : "Create"} />
    </form>
  );
}

/* ── SKU CSV Import Modal ─────────────────────────────────────────── */

function SkuImportForm({ onImport, onClose }) {
  const [parsedSkus, setParsedSkus] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsedSkus(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setParsedSkus(csvRowsToSkus(parseCsv(String(reader.result))));
      } catch (err) {
        setError(err.message);
      }
    };
    reader.onerror = () => setError("Could not read file");
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setSaving(true);
    setError(null);
    try {
      setResult(await onImport(parsedSkus));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Import finished: {result.created} created, {result.updated} updated
          {result.errors.length > 0 ? `, ${result.errors.length} failed` : ""}.
        </p>
        {result.errors.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-600">
            {result.errors.map((err, i) => (
              <p key={i}>Row {err.index + 2}{err.sku ? ` (${err.sku})` : ""}: {err.message}</p>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={onClose}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <p className="text-sm text-black/60">
        Upload a CSV with a header row. Required column: <span className="font-mono text-xs">sku</span>.
        Optional: <span className="font-mono text-xs">{SKU_CSV_COLUMNS.filter((c) => c !== "sku").join(", ")}</span>.
        Existing SKUs (matched by code) are fully overwritten. Use “Export CSV” to get a template.
      </p>
      <input type="file" accept=".csv,text/csv" onChange={handleFile}
        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent" />
      {parsedSkus && (
        <p className="rounded-lg bg-canvas p-3 text-sm text-black/70">
          {fileName}: {parsedSkus.length} row{parsedSkus.length === 1 ? "" : "s"} ready to import.
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="button" disabled={!parsedSkus || parsedSkus.length === 0 || saving} onClick={handleImport}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50">
          {saving ? "Importing…" : "Import"}
        </button>
      </div>
    </div>
  );
}

/* ── Main Screen ──────────────────────────────────────────────────── */

export default function ConfigurationScreen({ jwtToken, user, onAuthError }) {
  const [tab, setTab] = useState("warehouses");
  const [warehouses, setWarehouses] = useState([]);
  const [zones, setZones] = useState([]);
  const [locations, setLocations] = useState([]);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canWrite = WRITE_ROLES.includes(user?.role);

  // Filters
  const [locationFilters, setLocationFilters] = useState({ search: "", warehouseId: "", zoneId: "", status: "" });
  const [skuFilters, setSkuFilters] = useState({ search: "", category: "", active: "", lowOnly: false });

  // Modal state
  const [modal, setModal] = useState(null); // { type, mode: 'create'|'edit', data? }

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

  /* ── CRUD handlers ─────────────────────────────────────────── */

  const makeCrudHandlers = (resource, label) => ({
    create: async (data) => {
      await apiFetch(`/api/${resource}`, { method: "POST", body: JSON.stringify(data) });
      await loadData();
    },
    update: async (id, data) => {
      await apiFetch(`/api/${resource}/${id}`, { method: "PUT", body: JSON.stringify(data) });
      await loadData();
    },
    remove: async (id) => {
      if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;
      try {
        await apiFetch(`/api/${resource}/${id}`, { method: "DELETE" });
        await loadData();
      } catch (err) {
        alert(err.message);
      }
    },
  });

  const warehouseCrud = makeCrudHandlers("warehouses", "warehouse");
  const zoneCrud = makeCrudHandlers("zones", "zone");
  const locationCrud = makeCrudHandlers("locations", "location");
  const skuCrud = makeCrudHandlers("skus", "SKU");

  const handleBulkLocations = async (data) => {
    const result = await apiFetch("/api/locations/bulk", { method: "POST", body: JSON.stringify(data) });
    await loadData();
    return result;
  };

  const handleToggleLocationStatus = async (loc) => {
    try {
      await apiFetch(`/api/locations/${loc.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: loc.status === "active" ? "locked" : "active" }),
      });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleImportSkus = async (rows) => {
    const result = await apiFetch("/api/skus/import", { method: "POST", body: JSON.stringify({ skus: rows }) });
    await loadData();
    return result;
  };

  const handleExportSkus = () => {
    const csv = buildSkuCsv(skus);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `skus-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ── Filtered views ─────────────────────────────────────────── */

  const filteredLocations = useMemo(() => {
    const search = locationFilters.search.trim().toLowerCase();
    return locations.filter((loc) => {
      if (locationFilters.warehouseId && String(loc.warehouseId) !== locationFilters.warehouseId) return false;
      if (locationFilters.zoneId && String(loc.zoneId) !== locationFilters.zoneId) return false;
      if (locationFilters.status && loc.status !== locationFilters.status) return false;
      if (search && !loc.code.toLowerCase().includes(search) && !loc.name.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [locations, locationFilters]);

  const skuCategories = useMemo(
    () => [...new Set(skus.map((s) => s.category).filter(Boolean))].sort(),
    [skus]
  );

  const filteredSkus = useMemo(() => {
    const search = skuFilters.search.trim().toLowerCase();
    return skus.filter((s) => {
      if (skuFilters.category && s.category !== skuFilters.category) return false;
      if (skuFilters.active === "true" && !s.isActive) return false;
      if (skuFilters.active === "false" && s.isActive) return false;
      if (skuFilters.lowOnly && !s.lowStock) return false;
      if (search && !s.sku.toLowerCase().includes(search) && !(s.description || "").toLowerCase().includes(search)) return false;
      return true;
    });
  }, [skus, skuFilters]);

  /* ── Render tab content ─────────────────────────────────────── */

  const primaryButton = "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50";
  const secondaryButton = "rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas";

  const renderWarehousesTab = () => (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Warehouses</h2>
        {canWrite && (
          <button type="button" onClick={() => setModal({ type: "warehouse", mode: "create" })} className={primaryButton}>
            + New Warehouse
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-canvas">
              <th className="px-4 py-3 font-semibold text-black/60">Code</th>
              <th className="px-4 py-3 font-semibold text-black/60">Name</th>
              <th className="px-4 py-3 font-semibold text-black/60">Location</th>
              <th className="px-4 py-3 font-semibold text-black/60">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-black/60">Zones</th>
              <th className="px-4 py-3 text-center font-semibold text-black/60">Locations</th>
              {canWrite && <th className="px-4 py-3 text-right font-semibold text-black/60">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-black/40">No warehouses yet. Create one to get started.</td></tr>
            ) : warehouses.map((w) => (
              <tr key={w.id} className="border-b border-black/5 last:border-0 hover:bg-canvas/50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{w.code}</td>
                <td className="px-4 py-3 text-ink">{w.name}</td>
                <td className="px-4 py-3 text-black/60">
                  {[w.city, w.country].filter(Boolean).join(", ") || <span className="text-black/30">—</span>}
                </td>
                <td className="px-4 py-3"><ActiveBadge isActive={w.isActive} /></td>
                <td className="px-4 py-3 text-center">{w.zoneCount}</td>
                <td className="px-4 py-3 text-center">{w.locationCount}</td>
                {canWrite && (
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setModal({ type: "warehouse", mode: "edit", data: w })}
                      className="mr-2 text-xs font-semibold text-accent hover:underline">Edit</button>
                    <button type="button" onClick={() => warehouseCrud.remove(w.id)}
                      className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                  </td>
                )}
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
        {canWrite && (
          <button type="button" onClick={() => setModal({ type: "zone", mode: "create" })}
            disabled={warehouses.length === 0} className={primaryButton}>
            + New Zone
          </button>
        )}
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
              <th className="px-4 py-3 font-semibold text-black/60">Description</th>
              <th className="px-4 py-3 text-center font-semibold text-black/60">Locations</th>
              {canWrite && <th className="px-4 py-3 text-right font-semibold text-black/60">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {zones.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-black/40">No zones yet. Create one to get started.</td></tr>
            ) : zones.map((z) => (
              <tr key={z.id} className="border-b border-black/5 last:border-0 hover:bg-canvas/50">
                <td className="px-4 py-3 font-semibold text-ink">{z.name}</td>
                <td className="px-4 py-3"><ZoneTypeBadge type={z.type} /></td>
                <td className="px-4 py-3 text-black/60">{z.warehouseCode}</td>
                <td className="px-4 py-3 text-black/60">{z.description || <span className="text-black/30">—</span>}</td>
                <td className="px-4 py-3 text-center">{z.locationCount}</td>
                {canWrite && (
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setModal({ type: "zone", mode: "edit", data: z })}
                      className="mr-2 text-xs font-semibold text-accent hover:underline">Edit</button>
                    <button type="button" onClick={() => zoneCrud.remove(z.id)}
                      className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderLocationsTab = () => (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Locations</h2>
        {canWrite && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setModal({ type: "bulkLocations" })}
              disabled={zones.length === 0} className={secondaryButton}>
              Bulk Generate
            </button>
            <button type="button" onClick={() => setModal({ type: "location", mode: "create" })}
              disabled={zones.length === 0} className={primaryButton}>
              + New Location
            </button>
          </div>
        )}
      </div>
      {zones.length === 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          You must create at least one zone before adding locations.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={locationFilters.search}
          onChange={(e) => setLocationFilters((f) => ({ ...f, search: e.target.value }))}
          className={`${filterInputClass} w-48`} placeholder="Search code or name…" />
        <select value={locationFilters.warehouseId}
          onChange={(e) => setLocationFilters((f) => ({ ...f, warehouseId: e.target.value, zoneId: "" }))}
          className={filterInputClass}>
          <option value="">All warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}
        </select>
        <select value={locationFilters.zoneId}
          onChange={(e) => setLocationFilters((f) => ({ ...f, zoneId: e.target.value }))}
          className={filterInputClass}>
          <option value="">All zones</option>
          {zones
            .filter((z) => !locationFilters.warehouseId || String(z.warehouseId) === locationFilters.warehouseId)
            .map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <select value={locationFilters.status}
          onChange={(e) => setLocationFilters((f) => ({ ...f, status: e.target.value }))}
          className={filterInputClass}>
          <option value="">All statuses</option>
          {LOCATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="self-center text-xs text-black/40">{filteredLocations.length} of {locations.length}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-canvas">
                <th className="px-4 py-3 font-semibold text-black/60">Code</th>
                <th className="px-4 py-3 font-semibold text-black/60">Zone</th>
                <th className="px-4 py-3 font-semibold text-black/60">Warehouse</th>
                <th className="px-4 py-3 font-semibold text-black/60">Type</th>
                <th className="px-4 py-3 font-semibold text-black/60">Status</th>
                <th className="px-4 py-3 font-semibold text-black/60">Utilization</th>
                {canWrite && <th className="px-4 py-3 text-right font-semibold text-black/60">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredLocations.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-black/40">
                  {locations.length === 0 ? "No locations yet." : "No locations match the current filters."}
                </td></tr>
              ) : filteredLocations.map((loc) => (
                <tr key={loc.id} className="border-b border-black/5 last:border-0 hover:bg-canvas/50">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-ink">{loc.code}</p>
                    <p className="text-xs text-black/40">{loc.name}</p>
                  </td>
                  <td className="px-4 py-3 text-black/60">{loc.zoneName}</td>
                  <td className="px-4 py-3 text-black/60">{loc.warehouseCode}</td>
                  <td className="px-4 py-3"><LocTypeBadge type={loc.type} /></td>
                  <td className="px-4 py-3"><StatusBadge status={loc.status} /></td>
                  <td className="px-4 py-3"><UtilizationBar used={loc.usedCapacity || 0} capacity={loc.capacity} /></td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => handleToggleLocationStatus(loc)}
                        className="mr-2 text-xs font-semibold text-amber-600 hover:underline">
                        {loc.status === "active" ? "Lock" : "Unlock"}
                      </button>
                      <button type="button" onClick={() => setModal({ type: "location", mode: "edit", data: loc })}
                        className="mr-2 text-xs font-semibold text-accent hover:underline">Edit</button>
                      <button type="button" onClick={() => locationCrud.remove(loc.id)}
                        className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSkusTab = () => (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">SKUs</h2>
        <div className="flex gap-2">
          <button type="button" onClick={handleExportSkus} disabled={skus.length === 0} className={secondaryButton}>
            Export CSV
          </button>
          {canWrite && (
            <>
              <button type="button" onClick={() => setModal({ type: "skuImport" })} className={secondaryButton}>
                Import CSV
              </button>
              <button type="button" onClick={() => setModal({ type: "sku", mode: "create" })} className={primaryButton}>
                + New SKU
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={skuFilters.search}
          onChange={(e) => setSkuFilters((f) => ({ ...f, search: e.target.value }))}
          className={`${filterInputClass} w-48`} placeholder="Search SKU or description…" />
        <select value={skuFilters.category}
          onChange={(e) => setSkuFilters((f) => ({ ...f, category: e.target.value }))}
          className={filterInputClass}>
          <option value="">All categories</option>
          {skuCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={skuFilters.active}
          onChange={(e) => setSkuFilters((f) => ({ ...f, active: e.target.value }))}
          className={filterInputClass}>
          <option value="">All</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        <label className="flex items-center gap-1.5 self-center text-sm text-black/70">
          <input type="checkbox" checked={skuFilters.lowOnly}
            onChange={(e) => setSkuFilters((f) => ({ ...f, lowOnly: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300" />
          Low stock only
        </label>
        <span className="self-center text-xs text-black/40">{filteredSkus.length} of {skus.length}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-canvas">
                <th className="px-4 py-3 font-semibold text-black/60">SKU</th>
                <th className="px-4 py-3 font-semibold text-black/60">Description</th>
                <th className="px-4 py-3 font-semibold text-black/60">Category</th>
                <th className="px-4 py-3 font-semibold text-black/60">UOM</th>
                <th className="px-4 py-3 text-center font-semibold text-black/60">Stock</th>
                <th className="px-4 py-3 text-center font-semibold text-black/60">Min / Max</th>
                <th className="px-4 py-3 font-semibold text-black/60">Barcodes</th>
                <th className="px-4 py-3 font-semibold text-black/60">Status</th>
                {canWrite && <th className="px-4 py-3 text-right font-semibold text-black/60">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSkus.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-black/40">
                  {skus.length === 0 ? "No SKUs yet. Create one to get started." : "No SKUs match the current filters."}
                </td></tr>
              ) : filteredSkus.map((s) => {
                const barcodeCount = Array.isArray(s.barcodes) ? s.barcodes.length : 0;
                return (
                  <tr key={s.id} className="border-b border-black/5 last:border-0 hover:bg-canvas/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{s.sku}</td>
                    <td className="px-4 py-3 text-black/70">{s.description || <span className="text-black/30">—</span>}</td>
                    <td className="px-4 py-3 text-black/70">{s.category || <span className="text-black/30">—</span>}</td>
                    <td className="px-4 py-3 text-black/70">{s.unitOfMeasure}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold">{s.totalQuantity.toLocaleString()}</span>
                      {s.lowStock && <span className="ml-1.5"><Badge color="red">low</Badge></span>}
                    </td>
                    <td className="px-4 py-3 text-center text-black/70">
                      {s.minStockLevel != null || s.maxStockLevel != null
                        ? `${s.minStockLevel ?? "—"} / ${s.maxStockLevel ?? "—"}`
                        : <span className="text-black/30">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {barcodeCount > 0 ? <Badge color="blue">{barcodeCount}</Badge> : <span className="text-black/30">—</span>}
                    </td>
                    <td className="px-4 py-3"><ActiveBadge isActive={s.isActive} /></td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => setModal({ type: "sku", mode: "edit", data: s })}
                          className="mr-2 text-xs font-semibold text-accent hover:underline">Edit</button>
                        <button type="button" onClick={() => skuCrud.remove(s.id)}
                          className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                      </td>
                    )}
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
        <p className="mt-1 text-sm text-black/60">Manage warehouses, zones, locations, and the SKU catalog</p>
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
            onSave={(data) => modal.mode === "create" ? warehouseCrud.create(data) : warehouseCrud.update(modal.data.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "zone" && (
        <Modal title={modal.mode === "create" ? "Create Zone" : "Edit Zone"} onClose={() => setModal(null)}>
          <ZoneForm
            zone={modal.data}
            warehouses={warehouses}
            onSave={(data) => modal.mode === "create" ? zoneCrud.create(data) : zoneCrud.update(modal.data.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "location" && (
        <Modal title={modal.mode === "create" ? "Create Location" : "Edit Location"} onClose={() => setModal(null)}>
          <LocationForm
            location={modal.data}
            zones={zones}
            onSave={(data) => modal.mode === "create" ? locationCrud.create(data) : locationCrud.update(modal.data.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "bulkLocations" && (
        <Modal title="Bulk Generate Locations" onClose={() => setModal(null)}>
          <BulkLocationForm zones={zones} onSave={handleBulkLocations} onClose={() => setModal(null)} />
        </Modal>
      )}

      {modal?.type === "sku" && (
        <Modal title={modal.mode === "create" ? "Create SKU" : "Edit SKU"} onClose={() => setModal(null)} wide>
          <SkuForm
            skuData={modal.data}
            onSave={(data) => modal.mode === "create" ? skuCrud.create(data) : skuCrud.update(modal.data.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.type === "skuImport" && (
        <Modal title="Import SKUs from CSV" onClose={() => setModal(null)} wide>
          <SkuImportForm onImport={handleImportSkus} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
