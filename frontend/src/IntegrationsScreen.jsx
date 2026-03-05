import React, { useCallback, useEffect, useState } from "react";

const runtimeApiBaseUrl = typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "";
const apiBaseUrl = String(runtimeApiBaseUrl || "").replace(/\/+$/, "");
const buildApiUrl = (p) => (apiBaseUrl ? apiBaseUrl + p : p);

async function apiRequest(urlPath, jwtToken, options = {}, onAuthError = null) {
  const response = await fetch(buildApiUrl(urlPath), {
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + jwtToken },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && onAuthError) onAuthError();
    throw new Error(payload.error || "Request failed: " + response.status);
  }
  return payload;
}

const formatDate = (iso) => {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (_e) {
    return iso;
  }
};

const DIRECTION_LABELS = { inbound: "Inbound", outbound: "Outbound", bidirectional: "Bidirectional" };
const DIRECTION_BADGES = {
  inbound: "border-blue-200 bg-blue-50 text-blue-700",
  outbound: "border-emerald-200 bg-emerald-50 text-emerald-700",
  bidirectional: "border-purple-200 bg-purple-50 text-purple-700"
};
const STATUS_BADGES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700"
};

const OUTBOUND_EVENTS = [
  "task.completed", "task.created", "task.assigned", "task.cancelled",
  "inventory.updated", "order.fulfilled", "operator.status_changed"
];

function IntegrationsScreen({ jwtToken, user, onAuthError }) {
  const [integrations, setIntegrations] = useState([]);
  const [connectorTypes, setConnectorTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: "", connectorType: "", direction: "outbound", config: {}, subscribedEvents: [], authHeaderName: "X-Webhook-Secret", authHeaderValue: "" });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [eventLog, setEventLog] = useState([]);
  const [eventLogLoading, setEventLogLoading] = useState(false);

  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [intList, ctList] = await Promise.all([
        apiRequest("/api/integrations", jwtToken, {}, onAuthError),
        apiRequest("/api/integrations/connector-types", jwtToken, {}, onAuthError)
      ]);
      setIntegrations(Array.isArray(intList) ? intList : []);
      setConnectorTypes(Array.isArray(ctList) ? ctList : []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [jwtToken, onAuthError]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadEventLog = useCallback(async (integrationId) => {
    setEventLogLoading(true);
    try {
      const result = await apiRequest("/api/integrations/" + integrationId + "/events?limit=20", jwtToken, {}, onAuthError);
      setEventLog(result.items || []);
    } catch (_err) {
      setEventLog([]);
    } finally {
      setEventLogLoading(false);
    }
  }, [jwtToken, onAuthError]);

  const openCreate = () => {
    const defaultType = connectorTypes.length > 0 ? connectorTypes[0].type : "";
    setEditingId(null);
    setFormData({ name: "", connectorType: defaultType, direction: "outbound", config: {}, subscribedEvents: [], authHeaderName: "X-Webhook-Secret", authHeaderValue: "" });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (integ) => {
    setEditingId(integ.id);
    setFormData({
      name: integ.name,
      connectorType: integ.connectorType,
      direction: integ.direction,
      config: integ.config || {},
      subscribedEvents: integ.subscribedEvents || [],
      authHeaderName: integ.authHeaderName || "X-Webhook-Secret",
      authHeaderValue: integ.authHeaderValue || ""
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await apiRequest("/api/integrations/" + editingId, jwtToken, { method: "PUT", body: JSON.stringify(formData) }, onAuthError);
      } else {
        await apiRequest("/api/integrations", jwtToken, { method: "POST", body: JSON.stringify(formData) }, onAuthError);
      }
      setShowForm(false);
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (integ) => {
    try {
      await apiRequest("/api/integrations/" + integ.id + "/toggle", jwtToken, { method: "PATCH", body: JSON.stringify({ isEnabled: !integ.isEnabled }) }, onAuthError);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (integ) => {
    if (!confirm("Delete integration '" + integ.name + "'? This cannot be undone.")) return;
    try {
      await apiRequest("/api/integrations/" + integ.id, jwtToken, { method: "DELETE" }, onAuthError);
      if (selectedId === integ.id) setSelectedId(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTest = async (integ) => {
    setTestingId(integ.id);
    setTestResult(null);
    try {
      const result = await apiRequest("/api/integrations/" + integ.id + "/test", jwtToken, { method: "POST" }, onAuthError);
      setTestResult({ ...result, forId: integ.id });
    } catch (err) {
      setTestResult({ success: false, message: err.message, forId: integ.id });
    } finally {
      setTestingId(null);
    }
  };

  const openDetail = (integ) => {
    setSelectedId(integ.id);
    setTestResult(null);
    loadEventLog(integ.id);
  };

  const selectedConnector = connectorTypes.find((ct) => ct.type === formData.connectorType);

  const availableEvents = formData.direction === "inbound" ? [] : OUTBOUND_EVENTS;

  const toggleEvent = (evt) => {
    setFormData((prev) => {
      const current = prev.subscribedEvents || [];
      return {
        ...prev,
        subscribedEvents: current.includes(evt) ? current.filter((e) => e !== evt) : [...current, evt]
      };
    });
  };

  const selectedIntegration = integrations.find((i) => i.id === selectedId);

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">

        <header className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Admin</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">Integrations</h1>
              <p className="mt-1 text-xs text-black/60">Connect the WMS with external OMS, ERP, and third-party systems.</p>
            </div>
            <button type="button" className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white" onClick={openCreate}>
              New Integration
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">{error}</div>
        )}

        {showForm && (
          <section className="rounded-2xl border border-accent/30 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black">{editingId ? "Edit Integration" : "New Integration"}</h2>

            {formError && (
              <div className="mt-3 rounded-lg border border-signal/30 bg-signal/10 px-3 py-2 text-xs text-signal">{formError}</div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-black/70">Name</label>
                <input type="text" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="My ERP Integration" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-black/70">Connector Type</label>
                <select className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.connectorType} disabled={!!editingId} onChange={(e) => setFormData({ ...formData, connectorType: e.target.value, config: {} })}>
                  {connectorTypes.map((ct) => (
                    <option key={ct.type} value={ct.type}>{ct.label}</option>
                  ))}
                </select>
                {selectedConnector && (
                  <p className="mt-1 text-[11px] text-black/50">{selectedConnector.description}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-black/70">Direction</label>
                <select className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.direction} onChange={(e) => setFormData({ ...formData, direction: e.target.value })}>
                  {(selectedConnector?.directions || ["outbound"]).map((d) => (
                    <option key={d} value={d}>{DIRECTION_LABELS[d] || d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black/70">Auth Header Name</label>
                <input type="text" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.authHeaderName} onChange={(e) => setFormData({ ...formData, authHeaderName: e.target.value })} />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-black/70">Auth Header Value (secret)</label>
                <input type="password" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.authHeaderValue} onChange={(e) => setFormData({ ...formData, authHeaderValue: e.target.value })} placeholder="your-webhook-secret" />
              </div>
            </div>

            {selectedConnector?.configSchema?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-black/60">Connector Settings</h3>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectedConnector.configSchema.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-semibold text-black/70">{field.label}{field.required ? " *" : ""}</label>
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm"
                        value={formData.config[field.key] || ""}
                        placeholder={field.placeholder || ""}
                        onChange={(e) => setFormData({ ...formData, config: { ...formData.config, [field.key]: e.target.value } })}
                      />
                      {field.helpText && <p className="mt-0.5 text-[11px] text-black/50">{field.helpText}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableEvents.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-black/60">Subscribed Events</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableEvents.map((evt) => {
                    const isSelected = (formData.subscribedEvents || []).includes(evt);
                    return (
                      <button key={evt} type="button" onClick={() => toggleEvent(evt)}
                        className={"rounded-lg border px-3 py-1.5 text-xs font-semibold transition " + (isSelected ? "border-accent/30 bg-accent/10 text-accent" : "border-black/15 bg-canvas text-black/60 hover:bg-black/5")}>
                        {evt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button type="button" className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={isSaving} onClick={handleSave}>
                {isSaving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button type="button" className="rounded-lg border border-black/15 bg-canvas px-4 py-2 text-xs font-semibold" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Configured Integrations</h2>
            <p className="text-xs text-black/60">{integrations.length} integration{integrations.length !== 1 ? "s" : ""}</p>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={"skel-" + i} className="h-16 animate-pulse rounded-xl bg-canvas" />
              ))}
            </div>
          ) : integrations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/20 bg-canvas p-8 text-center">
              <p className="text-sm font-semibold text-black/40">No integrations configured</p>
              <p className="mt-1 text-xs text-black/30">Create one to start sending or receiving events.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {integrations.map((integ) => (
                <article key={integ.id} className={"rounded-xl border p-3 transition " + (selectedId === integ.id ? "border-accent/30 bg-accent/5" : "border-black/10")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={"h-2.5 w-2.5 rounded-full " + (integ.isEnabled ? "bg-emerald-500" : "bg-slate-300")} />
                      <div>
                        <p className="text-sm font-bold">{integ.name}</p>
                        <p className="text-[11px] text-black/50">{integ.connectorType} &middot; {formatDate(integ.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold " + (DIRECTION_BADGES[integ.direction] || "")}>{DIRECTION_LABELS[integ.direction] || integ.direction}</span>
                      <span className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold " + (integ.isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600")}>{integ.isEnabled ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>

                  {integ.subscribedEvents?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {integ.subscribedEvents.map((evt) => (
                        <span key={evt} className="rounded border border-black/10 bg-canvas px-1.5 py-0.5 text-[10px] text-black/60">{evt}</span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1">
                    <button type="button" className="rounded-lg border border-black/15 bg-canvas px-2.5 py-1 text-[11px] font-semibold hover:bg-black/5" onClick={() => openDetail(integ)}>Event Log</button>
                    <button type="button" className="rounded-lg border border-black/15 bg-canvas px-2.5 py-1 text-[11px] font-semibold hover:bg-black/5" onClick={() => openEdit(integ)}>Edit</button>
                    <button type="button" className="rounded-lg border border-black/15 bg-canvas px-2.5 py-1 text-[11px] font-semibold hover:bg-black/5" onClick={() => handleToggle(integ)}>{integ.isEnabled ? "Disable" : "Enable"}</button>
                    <button type="button" className="rounded-lg border border-black/15 bg-canvas px-2.5 py-1 text-[11px] font-semibold hover:bg-black/5" disabled={testingId === integ.id} onClick={() => handleTest(integ)}>{testingId === integ.id ? "Testing..." : "Test"}</button>
                    <button type="button" className="rounded-lg border border-signal/20 bg-signal/5 px-2.5 py-1 text-[11px] font-semibold text-signal hover:bg-signal/10" onClick={() => handleDelete(integ)}>Delete</button>
                  </div>

                  {testResult && testResult.forId === integ.id && (
                    <div className={"mt-2 rounded-lg border px-3 py-2 text-xs " + (testResult.success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-signal/30 bg-signal/10 text-signal")}>
                      Test: {testResult.success ? "Success" : "Failed"} \u2014 {testResult.message}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {selectedIntegration && (
          <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">Event Log</h2>
                <p className="text-xs text-black/60">{selectedIntegration.name}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="rounded-lg border border-black/15 bg-canvas px-3 py-1.5 text-xs font-semibold" onClick={() => loadEventLog(selectedIntegration.id)}>Refresh</button>
                <button type="button" className="rounded-lg border border-black/15 bg-canvas px-3 py-1.5 text-xs font-semibold" onClick={() => setSelectedId(null)}>Close</button>
              </div>
            </div>

            {["inbound", "bidirectional"].includes(selectedIntegration.direction) && selectedIntegration.inboundApiKey && (
              <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <span className="font-semibold">Inbound URL:</span>{" "}
                <code className="rounded bg-blue-100 px-1 py-0.5 text-[11px]">{window.location.origin + "/api/webhook/inbound/" + selectedIntegration.inboundApiKey}</code>
              </div>
            )}

            {eventLogLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={"elog-skel-" + i} className="h-10 animate-pulse rounded-lg bg-canvas" />
                ))}
              </div>
            ) : eventLog.length === 0 ? (
              <p className="py-4 text-center text-sm text-black/40">No events yet</p>
            ) : (
              <div className="max-h-96 space-y-1 overflow-y-auto">
                {eventLog.map((evt) => (
                  <div key={evt.id} className="flex items-start gap-2 rounded-lg border border-black/10 px-3 py-2 text-xs">
                    <span className={"mt-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold " + (STATUS_BADGES[evt.status] || "")}>{evt.status}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{evt.eventType}</span>
                        <span className="text-black/40">{formatDate(evt.createdAt)}</span>
                      </div>
                      <span className={"rounded-full border px-1.5 py-0.5 text-[10px] " + (DIRECTION_BADGES[evt.direction] || "")}>{evt.direction}</span>
                      {evt.responseStatus ? <span className="ml-1 text-black/40">HTTP {evt.responseStatus}</span> : null}
                      {evt.errorMessage && <p className="mt-1 text-signal">{evt.errorMessage}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Available Connectors</h2>
          <p className="mt-1 text-xs text-black/60">Connector types that can be used when creating integrations.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {connectorTypes.map((ct) => (
              <article key={ct.type} className="rounded-xl border border-black/10 p-3">
                <p className="text-sm font-bold">{ct.label}</p>
                <p className="mt-1 text-[11px] text-black/50">{ct.description}</p>
                <div className="mt-2 flex gap-1">
                  {ct.directions.map((d) => (
                    <span key={d} className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold " + (DIRECTION_BADGES[d] || "")}>{DIRECTION_LABELS[d] || d}</span>
                  ))}
                </div>
              </article>
            ))}
            <article className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/20 p-3 text-center">
              <p className="text-xs font-semibold text-black/30">More connectors coming soon</p>
              <p className="mt-0.5 text-[10px] text-black/20">SAP, Oracle, Shopify, etc.</p>
            </article>
          </div>
        </section>

      </div>
    </main>
  );
}

export default IntegrationsScreen;