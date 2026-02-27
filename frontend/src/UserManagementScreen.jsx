import React, { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

const runtimeApiBaseUrl =
  typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "";
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

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "warehouse_manager", label: "Warehouse Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "operator", label: "Operator" },
  { value: "viewer", label: "Viewer" }
];

const ROLE_BADGE_CLASSES = {
  admin: "border-purple-200 bg-purple-50 text-purple-700",
  warehouse_manager: "border-blue-200 bg-blue-50 text-blue-700",
  supervisor: "border-cyan-200 bg-cyan-50 text-cyan-700",
  operator: "border-emerald-200 bg-emerald-50 text-emerald-700",
  viewer: "border-slate-200 bg-slate-50 text-slate-600"
};

const ROLE_DISPLAY = {
  admin: "Admin",
  warehouse_manager: "WH Manager",
  supervisor: "Supervisor",
  operator: "Operator",
  viewer: "Viewer"
};

const formatDate = (isoString) => {
  if (!isoString) return "Never";
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (_error) {
    return isoString;
  }
};

async function apiRequest(path, jwtToken, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return payload;
}

function CreateUserForm({ jwtToken, onUserCreated, onCancel }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("operator");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!username.trim()) {
      setErrorMessage("Username is required");
      return;
    }
    if (!displayName.trim()) {
      setErrorMessage("Display name is required");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const user = await apiRequest("/api/users", jwtToken, {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim(),
          role,
          password
        })
      });
      onUserCreated(user);
    } catch (error) {
      setErrorMessage(error.message || "Failed to create user");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses =
    "mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-black/10 bg-white p-4"
    >
      <h3 className="text-sm font-bold text-ink">Create New User</h3>
      <p className="mt-1 text-xs text-black/60">
        The user will be asked to change their password on first login.
      </p>

      {errorMessage && (
        <div className="mt-3 rounded-lg border border-signal/30 bg-signal/10 px-3 py-2 text-xs text-signal">
          {errorMessage}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-ink">
          Username
          <input
            type="text"
            className={inputClasses}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. jdoe"
          />
        </label>

        <label className="block text-xs font-semibold text-ink">
          Display Name
          <input
            type="text"
            className={inputClasses}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. John Doe"
          />
        </label>

        <label className="block text-xs font-semibold text-ink">
          Role
          <select
            className={inputClasses}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isLoading}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-ink">
          Temporary Password
          <input
            type="password"
            className={inputClasses}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="Min. 6 characters"
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Creating..." : "Create User"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-black/15 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:bg-canvas"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ResetPasswordModal({ userName, jwtToken, userId, onDone, onCancel }) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest(`/api/users/${userId}/reset-password`, jwtToken, {
        method: "POST",
        body: JSON.stringify({ password })
      });
      onDone();
    } catch (error) {
      setErrorMessage(error.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 shadow-lg"
      >
        <h3 className="text-sm font-bold text-ink">Reset Password</h3>
        <p className="mt-1 text-xs text-black/60">
          Set a new temporary password for <span className="font-semibold">{userName}</span>. They will be asked to change it on next login.
        </p>

        {errorMessage && (
          <div className="mt-3 rounded-lg border border-signal/30 bg-signal/10 px-3 py-2 text-xs text-signal">
            {errorMessage}
          </div>
        )}

        <label className="mt-4 block text-xs font-semibold text-ink">
          New Temporary Password
          <input
            type="password"
            className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="Min. 6 characters"
            autoFocus
          />
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-black/15 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:bg-canvas"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function UserManagementScreen({ jwtToken, user }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await apiRequest("/api/users?limit=200", jwtToken);
      setUsers(data.items || []);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [jwtToken]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Socket.IO for real-time presence and list updates
  useEffect(() => {
    if (!jwtToken) {
      return () => {};
    }

    const socket = io(getSocketBaseUrl(), {
      auth: { token: jwtToken }
    });

    socket.on("USER_PRESENCE_UPDATED", (payload) => {
      const ids = Array.isArray(payload?.onlineUserIds) ? payload.onlineUserIds : [];
      setOnlineUserIds(new Set(ids));
    });

    socket.on("USER_LIST_UPDATED", () => {
      fetchUsers();
    });

    return () => {
      socket.disconnect();
    };
  }, [jwtToken, fetchUsers]);

  const handleToggleActive = useCallback(
    async (targetUser) => {
      try {
        await apiRequest(`/api/users/${targetUser.id}`, jwtToken, {
          method: "PATCH",
          body: JSON.stringify({ isActive: !targetUser.isActive })
        });
      } catch (error) {
        setErrorMessage(error.message || "Failed to update user");
      }
    },
    [jwtToken]
  );

  const handleDelete = useCallback(
    async (targetUser) => {
      const confirmed = window.confirm(
        `Are you sure you want to delete user "${targetUser.displayName || targetUser.username}"? This cannot be undone.`
      );
      if (!confirmed) return;

      try {
        await apiRequest(`/api/users/${targetUser.id}`, jwtToken, {
          method: "DELETE"
        });
      } catch (error) {
        setErrorMessage(error.message || "Failed to delete user");
      }
    },
    [jwtToken]
  );

  const handleUserCreated = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  const handleResetDone = useCallback(() => {
    setResetTarget(null);
  }, []);

  const isAdmin = (u) => u.role === "admin";

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-ink">User Management</h2>
          <p className="text-xs text-black/60">
            Create and manage user accounts
          </p>
        </div>
        {!showCreateForm && (
          <button
            type="button"
            className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
            onClick={() => setShowCreateForm(true)}
          >
            + Create User
          </button>
        )}
      </div>

      {showCreateForm && (
        <CreateUserForm
          jwtToken={jwtToken}
          onUserCreated={handleUserCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {errorMessage && (
        <div className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
          {errorMessage}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-canvas text-xs font-semibold uppercase tracking-wider text-black/50">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Display Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-black/50">
                  Loading users...
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-black/50">
                  No users found
                </td>
              </tr>
            )}
            {!isLoading &&
              users.map((u) => {
                const online = onlineUserIds.has(u.id);
                const protectedUser = isAdmin(u);

                return (
                  <tr
                    key={u.id}
                    className="border-b border-black/5 last:border-0 hover:bg-canvas/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                    <td className="px-4 py-3 text-xs font-medium">{u.displayName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          ROLE_BADGE_CLASSES[u.role] || "border-black/10 bg-canvas text-black/60"
                        }`}
                      >
                        {ROLE_DISPLAY[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          online
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          u.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {u.isActive ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-black/60">
                      {formatDate(u.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!protectedUser && u.id !== user?.id && (
                          <>
                            <button
                              type="button"
                              className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                                u.isActive
                                  ? "border-signal/30 text-signal hover:bg-signal/10"
                                  : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              }`}
                              onClick={() => handleToggleActive(u)}
                            >
                              {u.isActive ? "Disable" : "Enable"}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-black/15 px-2 py-1 text-[10px] font-semibold text-ink transition hover:bg-canvas"
                              onClick={() => setResetTarget(u)}
                            >
                              Reset Pwd
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-signal/30 px-2 py-1 text-[10px] font-semibold text-signal transition hover:bg-signal/10"
                              onClick={() => handleDelete(u)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {resetTarget && (
        <ResetPasswordModal
          userName={resetTarget.displayName || resetTarget.username}
          jwtToken={jwtToken}
          userId={resetTarget.id}
          onDone={handleResetDone}
          onCancel={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}

export default UserManagementScreen;
