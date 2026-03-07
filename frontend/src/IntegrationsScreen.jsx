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

const STATUS_BADGES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700"
};

const ALL_EVENTS = [
  "task.completed", "task.created", "task.assigned", "task.cancelled",
  "inventory.updated", "order.fulfilled", "operator.status_changed",
  "inbound.order.created", "inbound.order.cancelled", "inbound.product.synced"
];

const WAREHOUSE_PROCESSES = [
  { id: "receiving", label: "Receiving", description: "Inbound goods, ASN, purchase orders" },
  { id: "putaway", label: "Putaway", description: "Storage assignment and replenishment" },
  { id: "picking", label: "Picking", description: "Order picking and wave management" },
  { id: "shipping", label: "Shipping", description: "Outbound orders, packing, dispatch" },
  { id: "inventory", label: "Inventory", description: "Stock levels, adjustments, cycle counts" },
  { id: "returns", label: "Returns", description: "Return processing and restocking" }
];

const PROCESS_BADGES = {
  receiving: "border-blue-200 bg-blue-50 text-blue-700",
  putaway: "border-indigo-200 bg-indigo-50 text-indigo-700",
  picking: "border-amber-200 bg-amber-50 text-amber-700",
  shipping: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inventory: "border-purple-200 bg-purple-50 text-purple-700",
  returns: "border-rose-200 bg-rose-50 text-rose-700"
};

const AUTH_TYPES = [
  { id: "none", label: "None", description: "No authentication header sent with outbound requests" },
  { id: "header", label: "Secret Header", description: "A secret value sent as an HTTP header with every outbound request" },
  { id: "jwt", label: "JWT (Bearer Token)", description: "A signed JWT token sent as Authorization: Bearer header with every outbound request" }
];

const INBOUND_AUTH_TYPES = [
  { id: "none", label: "None", description: "No additional authentication — the webhook URL is the only protection" },
  { id: "credentials", label: "Credentials (API Key)", description: "The caller must send an X-API-Key header with a shared secret" },
  { id: "jwt", label: "JWT (Bearer Token)", description: "The caller must send a valid JWT Bearer token signed with a shared secret (HS256)" }
];

/* Connector icon SVGs */

function IconWebhook({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3" />
      <circle cx="19" cy="17" r="3" />
      <circle cx="5" cy="17" r="3" />
      <path d="M12 8v4l3.5 6" />
      <path d="M6.27 15.25L12 12" />
      <path d="M16 17H8" />
    </svg>
  );
}

function IconConnectorPlaceholder({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function IconArrowLeft({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

const CONNECTOR_ICONS = {
  "generic-webhook": IconWebhook
};

const VIEW_LIST = "list";
const VIEW_CREATE = "create";
const VIEW_EDIT = "edit";
const VIEW_DETAIL = "detail";

const EMPTY_FORM = {
  name: "", connectorType: "", processes: [], config: {}, subscribedEvents: [],
  authType: "none", authHeaderName: "X-Webhook-Secret", authHeaderValue: "",
  jwtSecret: "", jwtIssuer: "", jwtAudience: "",
  inboundAuthType: "none", inboundJwtSecret: "", inboundJwtIssuer: "", inboundCredentialSecret: ""
};

function IntegrationsScreen({ jwtToken, user, onAuthError }) {
  const [integrations, setIntegrations] = useState([]);
  const [connectorTypes, setConnectorTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentView, setCurrentView] = useState(VIEW_LIST);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
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

  const openCreate = (connectorType) => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, connectorType });
    setFormError("");
    setCurrentView(VIEW_CREATE);
  };

  const openEdit = (integ) => {
    const authType = integ.config?.authType || (integ.authHeaderValue ? "header" : "none");
    setEditingId(integ.id);
    setFormData({
      name: integ.name,
      connectorType: integ.connectorType,
      processes: integ.config?.processes || [],
      config: integ.config || {},
      subscribedEvents: integ.subscribedEvents || [],
      authType,
      authHeaderName: integ.authHeaderName || "X-Webhook-Secret",
      authHeaderValue: authType === "header" ? (integ.authHeaderValue || "") : "",
      jwtSecret: authType === "jwt" ? (integ.authHeaderValue || "") : "",
      jwtIssuer: integ.config?.jwtIssuer || "",
      jwtAudience: integ.config?.jwtAudience || "",
      inboundAuthType: ({ apikey: "none", apikey_jwt: "jwt" })[integ.config?.inboundAuthType] || integ.config?.inboundAuthType || "none",
      inboundJwtSecret: integ.config?.inboundJwtSecret || "",
      inboundJwtIssuer: integ.config?.inboundJwtIssuer || "",
      inboundCredentialSecret: integ.config?.inboundCredentialSecret || ""
    });
    setFormError("");
    setCurrentView(VIEW_EDIT);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFormError("");
    const configWithMeta = { ...formData.config, processes: formData.processes, authType: formData.authType };
    if (formData.authType === "jwt") {
      configWithMeta.jwtIssuer = formData.jwtIssuer;
      configWithMeta.jwtAudience = formData.jwtAudience;
    }
    configWithMeta.inboundAuthType = formData.inboundAuthType;
    if (formData.inboundAuthType === "jwt") {
      configWithMeta.inboundJwtSecret = formData.inboundJwtSecret;
      configWithMeta.inboundJwtIssuer = formData.inboundJwtIssuer;
    }
    let authHeaderName = "X-Webhook-Secret";
    let authHeaderValue = "";
    if (formData.authType === "header") {
      authHeaderName = formData.authHeaderName;
      authHeaderValue = formData.authHeaderValue;
    } else if (formData.authType === "jwt") {
      authHeaderName = "Authorization";
      authHeaderValue = formData.jwtSecret;
    }
    const payload = {
      name: formData.name,
      connectorType: formData.connectorType,
      direction: "bidirectional",
      config: configWithMeta,
      subscribedEvents: formData.subscribedEvents,
      authHeaderName,
      authHeaderValue
    };
    try {
      if (editingId) {
        await apiRequest("/api/integrations/" + editingId, jwtToken, { method: "PUT", body: JSON.stringify(payload) }, onAuthError);
      } else {
        await apiRequest("/api/integrations", jwtToken, { method: "POST", body: JSON.stringify(payload) }, onAuthError);
      }
      setCurrentView(VIEW_LIST);
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
      if (currentView === VIEW_DETAIL && selectedId === integ.id) setCurrentView(VIEW_LIST);
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
    setCurrentView(VIEW_DETAIL);
  };

  const goBack = () => {
    setCurrentView(VIEW_LIST);
    setSelectedId(null);
    setEditingId(null);
  };

  const selectedConnector = connectorTypes.find((ct) => ct.type === formData.connectorType);
  const selectedIntegration = integrations.find((i) => i.id === selectedId);

  const toggleProcess = (processId) => {
    setFormData((prev) => {
      const current = prev.processes || [];
      return {
        ...prev,
        processes: current.includes(processId) ? current.filter((p) => p !== processId) : [...current, processId]
      };
    });
  };

  const toggleEvent = (evt) => {
    setFormData((prev) => {
      const current = prev.subscribedEvents || [];
      return {
        ...prev,
        subscribedEvents: current.includes(evt) ? current.filter((e) => e !== evt) : [...current, evt]
      };
    });
  };

  const integrationsForConnector = (connectorType) => integrations.filter((i) => i.connectorType === connectorType);

  const editingIntegration = editingId ? integrations.find((i) => i.id === editingId) : null;

  /* Create / Edit full-page form */

  if (currentView === VIEW_CREATE || currentView === VIEW_EDIT) {
    const ConnIcon = CONNECTOR_ICONS[formData.connectorType] || IconConnectorPlaceholder;
    const connectorLabel = connectorTypes.find((ct) => ct.type === formData.connectorType)?.label || formData.connectorType;

    return (
      <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">

          <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-xs font-semibold text-black/50 hover:text-accent transition">
            <IconArrowLeft className="h-4 w-4" /> Back to Integrations
          </button>

          <header className="rounded-2xl border border-accent/20 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <ConnIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h1 className="text-xl font-black">{editingId ? "Edit Integration" : "New Integration"}</h1>
                <p className="text-xs text-black/50">{connectorLabel} connector</p>
              </div>
            </div>
          </header>

          {formError && (
            <div className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">{formError}</div>
          )}

          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold">Integration Name</h2>
            <input type="text" className="mt-2 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="My ERP Integration" />
          </section>

          {/* Warehouse processes */}
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold">Warehouse Processes</h2>
            <p className="mt-1 text-xs text-black/50">Select which warehouse processes this integration covers.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {WAREHOUSE_PROCESSES.map((proc) => {
                const isSelected = (formData.processes || []).includes(proc.id);
                return (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => toggleProcess(proc.id)}
                    className={"rounded-xl border-2 p-3 text-left transition cursor-pointer " +
                      (isSelected ? "border-accent bg-accent/5" : "border-black/10 hover:border-black/20")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div className={"flex h-5 w-5 items-center justify-center rounded-md border-2 text-xs font-bold " +
                        (isSelected ? "border-accent bg-accent text-white" : "border-black/20")
                      }>
                        {isSelected && "\u2713"}
                      </div>
                      <span className="text-sm font-semibold">{proc.label}</span>
                    </div>
                    <p className="mt-1 pl-7 text-[11px] text-black/50">{proc.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedConnector?.configSchema?.length > 0 && (
            <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold">Connector Settings</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </section>
          )}

          {/* Authentication - always show both directions */}
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold">Authentication</h2>

            {/* Outbound: WMS -> External */}
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">WMS &rarr; External</span>
                <h3 className="text-xs font-semibold text-black/70">How the WMS authenticates to the external system</h3>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {AUTH_TYPES.map((at) => (
                  <button
                    key={at.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, authType: at.id })}
                    className={"rounded-xl border-2 p-3 text-left transition cursor-pointer " +
                      (formData.authType === at.id ? "border-accent bg-accent/5" : "border-black/10 hover:border-black/20")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div className={"flex h-4 w-4 items-center justify-center rounded-full border-2 " +
                        (formData.authType === at.id ? "border-accent" : "border-black/20")
                      }>
                        {formData.authType === at.id && <div className="h-2 w-2 rounded-full bg-accent" />}
                      </div>
                      <span className="text-sm font-semibold">{at.label}</span>
                    </div>
                    <p className="mt-1 pl-6 text-[11px] text-black/50">{at.description}</p>
                  </button>
                ))}
              </div>

              {formData.authType === "header" && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-black/70">Header Name</label>
                    <input type="text" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.authHeaderName} onChange={(e) => setFormData({ ...formData, authHeaderName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-black/70">Header Value (secret)</label>
                    <input type="password" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.authHeaderValue} onChange={(e) => setFormData({ ...formData, authHeaderValue: e.target.value })} placeholder="your-webhook-secret" />
                  </div>
                </div>
              )}

              {formData.authType === "jwt" && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-black/70">JWT Signing Secret *</label>
                    <input type="password" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.jwtSecret} onChange={(e) => setFormData({ ...formData, jwtSecret: e.target.value })} placeholder="your-jwt-signing-secret" />
                    <p className="mt-0.5 text-[11px] text-black/40">HMAC-SHA256 secret used to sign the JWT. Must match the secret configured on the receiving system.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-black/70">Issuer (iss claim)</label>
                      <input type="text" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.jwtIssuer} onChange={(e) => setFormData({ ...formData, jwtIssuer: e.target.value })} placeholder="wms" />
                      <p className="mt-0.5 text-[11px] text-black/40">Optional. Identifies who issued the token.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-black/70">Audience (aud claim)</label>
                      <input type="text" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.jwtAudience} onChange={(e) => setFormData({ ...formData, jwtAudience: e.target.value })} placeholder="https://erp.example.com" />
                      <p className="mt-0.5 text-[11px] text-black/40">Optional. Intended recipient of the token.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Inbound: External -> WMS */}
            <div className="mt-5 border-t border-black/10 pt-5">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">External &rarr; WMS</span>
                <h3 className="text-xs font-semibold text-black/70">How the external system authenticates to the WMS</h3>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {INBOUND_AUTH_TYPES.map((at) => (
                  <button
                    key={at.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, inboundAuthType: at.id })}
                    className={"rounded-xl border-2 p-3 text-left transition cursor-pointer " +
                      (formData.inboundAuthType === at.id ? "border-blue-400 bg-blue-50/50" : "border-black/10 hover:border-black/20")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div className={"flex h-4 w-4 items-center justify-center rounded-full border-2 " +
                        (formData.inboundAuthType === at.id ? "border-blue-500" : "border-black/20")
                      }>
                        {formData.inboundAuthType === at.id && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                      </div>
                      <span className="text-sm font-semibold">{at.label}</span>
                    </div>
                    <p className="mt-1 pl-6 text-[11px] text-black/50">{at.description}</p>
                  </button>
                ))}
              </div>

              {formData.inboundAuthType === "credentials" && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-black/70">API Key Secret *</label>
                    <input type="password" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.inboundCredentialSecret} onChange={(e) => setFormData({ ...formData, inboundCredentialSecret: e.target.value })} placeholder="your-api-key-secret" />
                    <p className="mt-0.5 text-[11px] text-black/40">The external system must send this value in an <code className="rounded bg-canvas px-1 py-0.5 text-[10px]">X-API-Key</code> header with every inbound request.</p>
                  </div>
                </div>
              )}

              {formData.inboundAuthType === "jwt" && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-black/70">JWT Verification Secret *</label>
                    <input type="password" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.inboundJwtSecret} onChange={(e) => setFormData({ ...formData, inboundJwtSecret: e.target.value })} placeholder="shared-jwt-secret" />
                    <p className="mt-0.5 text-[11px] text-black/40">HMAC-SHA256 secret the external system uses to sign its JWT. The WMS will verify the token on each inbound request.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-black/70">Expected Issuer (iss claim)</label>
                    <input type="text" className="mt-1 w-full rounded-lg border border-black/15 bg-canvas px-3 py-2 text-sm" value={formData.inboundJwtIssuer} onChange={(e) => setFormData({ ...formData, inboundJwtIssuer: e.target.value })} placeholder="erp-system" />
                    <p className="mt-0.5 text-[11px] text-black/40">Optional. If set, the WMS will reject tokens with a different issuer.</p>
                  </div>
                </div>
              )}

              {formData.connectorType ? (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                  <label className="block text-xs font-semibold text-blue-800">Inbound Webhook URL</label>
                  <code className="mt-1 block rounded bg-blue-100 px-2 py-1.5 text-[11px] text-blue-900 break-all select-all">{window.location.origin + "/api/webhook/" + formData.connectorType}</code>
                  {formData.inboundAuthType === "jwt" ? (
                    <p className="mt-1.5 text-[11px] text-blue-600">The external system must call this URL with an <code className="rounded bg-blue-100 px-1 py-0.5">Authorization: Bearer &lt;jwt&gt;</code> header.</p>
                  ) : formData.inboundAuthType === "credentials" ? (
                    <p className="mt-1.5 text-[11px] text-blue-600">The external system must call this URL with an <code className="rounded bg-blue-100 px-1 py-0.5">X-API-Key: &lt;secret&gt;</code> header.</p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-blue-600">Share this URL with the external system. No additional headers needed.</p>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          {/* Subscribed Events */}
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold">Subscribed Events</h2>
            <p className="mt-1 text-xs text-black/50">Select which events this integration should listen to.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_EVENTS.map((evt) => {
                const isSelected = (formData.subscribedEvents || []).includes(evt);
                return (
                  <button key={evt} type="button" onClick={() => toggleEvent(evt)}
                    className={"rounded-lg border px-3 py-1.5 text-xs font-semibold transition " + (isSelected ? "border-accent/30 bg-accent/10 text-accent" : "border-black/15 bg-canvas text-black/60 hover:bg-black/5")}>
                    {evt}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex gap-2">
            <button type="button" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={isSaving} onClick={handleSave}>
              {isSaving ? "Saving..." : editingId ? "Update Integration" : "Create Integration"}
            </button>
            <button type="button" className="rounded-lg border border-black/15 bg-canvas px-5 py-2.5 text-sm font-semibold" onClick={goBack}>
              Cancel
            </button>
          </div>

        </div>
      </main>
    );
  }

  /* Detail / Event Log full-page view */

  if (currentView === VIEW_DETAIL && selectedIntegration) {
    const detailProcesses = selectedIntegration.config?.processes || [];
    const detailAuthType = selectedIntegration.config?.authType || (selectedIntegration.authHeaderValue ? "header" : "none");
    const detailInboundAuthType = ({ apikey: "none", apikey_jwt: "jwt" })[selectedIntegration.config?.inboundAuthType] || selectedIntegration.config?.inboundAuthType || "none";

    return (
      <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">

          <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-xs font-semibold text-black/50 hover:text-accent transition">
            <IconArrowLeft className="h-4 w-4" /> Back to Integrations
          </button>

          <header className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={"h-3 w-3 rounded-full " + (selectedIntegration.isEnabled ? "bg-emerald-500" : "bg-slate-300")} />
                <div>
                  <h1 className="text-xl font-black">{selectedIntegration.name}</h1>
                  <p className="text-xs text-black/50">{selectedIntegration.connectorType} &middot; {formatDate(selectedIntegration.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {detailProcesses.map((p) => (
                  <span key={p} className={"rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize " + (PROCESS_BADGES[p] || "border-black/10 bg-canvas text-black/60")}>{p}</span>
                ))}
                <span className={"rounded-full border px-2.5 py-1 text-[11px] font-semibold " + (selectedIntegration.isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600")}>{selectedIntegration.isEnabled ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" className="rounded-lg border border-black/15 bg-canvas px-3 py-1.5 text-xs font-semibold hover:bg-black/5" onClick={() => openEdit(selectedIntegration)}>Edit</button>
              <button type="button" className="rounded-lg border border-black/15 bg-canvas px-3 py-1.5 text-xs font-semibold hover:bg-black/5" onClick={() => handleToggle(selectedIntegration)}>{selectedIntegration.isEnabled ? "Disable" : "Enable"}</button>
              <button type="button" className="rounded-lg border border-black/15 bg-canvas px-3 py-1.5 text-xs font-semibold hover:bg-black/5" disabled={testingId === selectedIntegration.id} onClick={() => handleTest(selectedIntegration)}>{testingId === selectedIntegration.id ? "Testing..." : "Test Connection"}</button>
              <button type="button" className="rounded-lg border border-signal/20 bg-signal/5 px-3 py-1.5 text-xs font-semibold text-signal hover:bg-signal/10" onClick={() => handleDelete(selectedIntegration)}>Delete</button>
            </div>
            {testResult && testResult.forId === selectedIntegration.id && (
              <div className={"mt-3 rounded-lg border px-3 py-2 text-xs " + (testResult.success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-signal/30 bg-signal/10 text-signal")}>
                Test: {testResult.success ? "Success" : "Failed"} &mdash; {testResult.message}
              </div>
            )}
          </header>

          {/* Authentication credentials */}
          <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold">Authentication Credentials</h2>

            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">WMS &rarr; External</span>
              </div>
              {detailAuthType === "none" ? (
                <p className="mt-1 text-[11px] text-black/40">No authentication &mdash; outbound requests are sent without credentials.</p>
              ) : detailAuthType === "jwt" ? (
                <div className="mt-1">
                  <p className="text-[11px] text-black/40">The WMS signs a short-lived JWT (HS256) and sends it as <code className="rounded bg-canvas px-1 py-0.5 text-[10px]">Authorization: Bearer &lt;token&gt;</code> with each outbound request.</p>
                  {selectedIntegration.config?.jwtIssuer && (
                    <p className="mt-1 text-[11px] text-black/40">Issuer: <code className="rounded bg-canvas px-1 py-0.5 text-[10px]">{selectedIntegration.config.jwtIssuer}</code></p>
                  )}
                  {selectedIntegration.config?.jwtAudience && (
                    <p className="mt-0.5 text-[11px] text-black/40">Audience: <code className="rounded bg-canvas px-1 py-0.5 text-[10px]">{selectedIntegration.config.jwtAudience}</code></p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-black/40">The WMS sends <code className="rounded bg-canvas px-1 py-0.5 text-[10px]">{selectedIntegration.authHeaderName || "X-Webhook-Secret"}</code> header with each outbound request.</p>
              )}
            </div>

            <div className="mt-4 border-t border-black/10 pt-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">External &rarr; WMS</span>
              </div>
              {selectedIntegration.connectorType ? (
                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                  <label className="block text-xs font-semibold text-blue-800">Inbound Webhook URL</label>
                  <code className="mt-1 block rounded bg-blue-100 px-2 py-1.5 text-[11px] text-blue-900 break-all select-all">{window.location.origin + "/api/webhook/" + selectedIntegration.connectorType}</code>
                  {detailInboundAuthType === "jwt" ? (
                    <div className="mt-2">
                      <p className="text-[11px] text-blue-600">The external system must include an <code className="rounded bg-blue-100 px-1 py-0.5">Authorization: Bearer &lt;jwt&gt;</code> header signed with the shared secret (HS256).</p>
                      {selectedIntegration.config?.inboundJwtIssuer && (
                        <p className="mt-1 text-[11px] text-blue-600">Expected issuer: <code className="rounded bg-blue-100 px-1 py-0.5">{selectedIntegration.config.inboundJwtIssuer}</code></p>
                      )}
                    </div>
                  ) : detailInboundAuthType === "credentials" ? (
                    <p className="mt-1.5 text-[11px] text-blue-600">The external system must include an <code className="rounded bg-blue-100 px-1 py-0.5">X-API-Key</code> header with each request.</p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-blue-600">Share this URL with the external system. No additional authentication needed.</p>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          {selectedIntegration.subscribedEvents?.length > 0 && (
            <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold mb-2">Subscribed Events</h2>
              <div className="flex flex-wrap gap-1.5">
                {selectedIntegration.subscribedEvents.map((evt) => (
                  <span key={evt} className="rounded border border-black/10 bg-canvas px-2 py-0.5 text-[11px] text-black/60">{evt}</span>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">Event Log</h2>
              <button type="button" className="rounded-lg border border-black/15 bg-canvas px-3 py-1.5 text-xs font-semibold hover:bg-black/5" onClick={() => loadEventLog(selectedIntegration.id)}>Refresh</button>
            </div>

            {eventLogLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={"elog-skel-" + i} className="h-10 animate-pulse rounded-lg bg-canvas" />
                ))}
              </div>
            ) : eventLog.length === 0 ? (
              <p className="py-6 text-center text-sm text-black/40">No events yet</p>
            ) : (
              <div className="max-h-[500px] space-y-1.5 overflow-y-auto">
                {eventLog.map((evt) => (
                  <div key={evt.id} className="flex items-start gap-2 rounded-lg border border-black/10 px-3 py-2 text-xs">
                    <span className={"mt-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold " + (STATUS_BADGES[evt.status] || "")}>{evt.status}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{evt.eventType}</span>
                        <span className="text-black/40">{formatDate(evt.createdAt)}</span>
                      </div>
                      {evt.responseStatus ? <span className="text-black/40">HTTP {evt.responseStatus}</span> : null}
                      {evt.errorMessage && <p className="mt-1 text-signal">{evt.errorMessage}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </main>
    );
  }

  /* Main list view (connector cards + existing integrations) */

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">

        <header className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Admin</p>
          <div className="mt-2">
            <h1 className="text-2xl font-black sm:text-3xl">Integrations</h1>
            <p className="mt-1 text-xs text-black/60">Connect the WMS with external OMS, ERP, and third-party systems.</p>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">{error}</div>
        )}

        <section>
          <h2 className="mb-3 text-lg font-black">Available Connectors</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connectorTypes.map((ct) => {
              const ConnIcon = CONNECTOR_ICONS[ct.type] || IconConnectorPlaceholder;
              const existing = integrationsForConnector(ct.type);
              const count = existing.length;
              return (
                <article key={ct.type} className="flex flex-col rounded-2xl border border-black/10 bg-white p-4 shadow-sm transition hover:border-accent/30">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-accent/10">
                      <ConnIcon className="h-6 w-6 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{ct.label}</p>
                      <p className="mt-0.5 text-[11px] text-black/50 leading-snug">{ct.description}</p>
                    </div>
                  </div>
                  {count > 0 && (
                    <p className="mt-3 text-[11px] text-black/50">
                      {count} integration{count !== 1 ? "s" : ""} configured
                    </p>
                  )}
                  <div className="mt-auto pt-3">
                    {count > 0 ? (
                      <button
                        type="button"
                        onClick={() => openDetail(existing[0])}
                        className="w-full rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/20 transition"
                      >
                        View Integration
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openCreate(ct.type)}
                        className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent/90 transition"
                      >
                        + Add Integration
                      </button>
                    )}
                  </div>
                </article>
              );
            })}

            <article className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/20 bg-white/50 p-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/5">
                <IconConnectorPlaceholder className="h-6 w-6 text-black/20" />
              </div>
              <p className="mt-2 text-xs font-semibold text-black/30">More connectors coming soon</p>
              <p className="mt-0.5 text-[10px] text-black/20">SAP, Oracle, Shopify, etc.</p>
            </article>
          </div>
        </section>

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
              <p className="mt-1 text-xs text-black/30">Use a connector above to create your first integration.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {integrations.map((integ) => {
                const ConnIcon = CONNECTOR_ICONS[integ.connectorType] || IconConnectorPlaceholder;
                const processes = integ.config?.processes || [];
                return (
                  <article key={integ.id} className="rounded-xl border border-black/10 p-3 transition hover:border-accent/20 cursor-pointer" onClick={() => openDetail(integ)}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                          <ConnIcon className="h-4 w-4 text-accent" />
                        </div>
                        <div className={"h-2.5 w-2.5 rounded-full " + (integ.isEnabled ? "bg-emerald-500" : "bg-slate-300")} />
                        <div>
                          <p className="text-sm font-bold">{integ.name}</p>
                          <p className="text-[11px] text-black/50">{integ.connectorType} &middot; {formatDate(integ.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {processes.map((p) => (
                          <span key={p} className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize " + (PROCESS_BADGES[p] || "border-black/10 bg-canvas text-black/60")}>{p}</span>
                        ))}
                        <span className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold " + (integ.isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600")}>{integ.isEnabled ? "Enabled" : "Disabled"}</span>
                      </div>
                    </div>
                    {integ.subscribedEvents?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 pl-11">
                        {integ.subscribedEvents.map((evt) => (
                          <span key={evt} className="rounded border border-black/10 bg-canvas px-1.5 py-0.5 text-[10px] text-black/60">{evt}</span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

export default IntegrationsScreen;
