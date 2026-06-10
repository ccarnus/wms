import React, { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { fetchJson, getSocketBaseUrl } from "./lib/api";
import {
  Badge,
  ClearFiltersButton,
  DataTable,
  ErrorBanner,
  FilterSelect,
  Modal,
  PageHeader,
  SearchInput,
  Section,
  primaryButtonClass,
  secondaryButtonClass
} from "./components/ui";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "warehouse_manager", label: "Warehouse Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "operator", label: "Operator" },
  { value: "viewer", label: "Viewer" }
];

const ROLE_TONES = {
  admin: "purple",
  warehouse_manager: "blue",
  supervisor: "cyan",
  operator: "green",
  viewer: "gray"
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

const inputClasses =
  "mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

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
      const user = await fetchJson("/api/users", {
        jwtToken,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-black/60">
        The user will be asked to change their password on first login.
      </p>

      {errorMessage && <ErrorBanner message={errorMessage} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-ink">
          Username
          <input type="text" className={inputClasses} value={username}
            onChange={(e) => setUsername(e.target.value)} disabled={isLoading} placeholder="e.g. jdoe" />
        </label>

        <label className="block text-xs font-semibold text-ink">
          Display Name
          <input type="text" className={inputClasses} value={displayName}
            onChange={(e) => setDisplayName(e.target.value)} disabled={isLoading} placeholder="e.g. John Doe" />
        </label>

        <label className="block text-xs font-semibold text-ink">
          Role
          <select className={inputClasses} value={role} onChange={(e) => setRole(e.target.value)} disabled={isLoading}>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-ink">
          Temporary Password
          <input type="password" className={inputClasses} value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={isLoading} placeholder="Min. 6 characters" />
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={secondaryButtonClass} onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className={primaryButtonClass} disabled={isLoading}>
          {isLoading ? "Creating..." : "Create User"}
        </button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ userName, jwtToken, userId, onDone, onCancel }) {
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
      await fetchJson(`/api/users/${userId}/reset-password`, {
        jwtToken,
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-black/60">
        Set a new temporary password for <span className="font-semibold">{userName}</span>.
        They will be asked to change it on next login.
      </p>

      {errorMessage && <ErrorBanner message={errorMessage} />}

      <label className="block text-xs font-semibold text-ink">
        New Temporary Password
        <input
          type="password"
          className={inputClasses}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          placeholder="Min. 6 characters"
          autoFocus
        />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={secondaryButtonClass} onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className={primaryButtonClass} disabled={isLoading}>
          {isLoading ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </form>
  );
}

function UserManagementScreen({ jwtToken, user, onAuthError }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  const [filters, setFilters] = useState({ search: "", role: "", status: "" });

  const callerIsAdmin = user?.role === "admin";

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchJson("/api/users?limit=200", { jwtToken, onAuthError });
      setUsers(data.items || []);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [jwtToken, onAuthError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!jwtToken) return () => {};

    const socket = io(getSocketBaseUrl(), { auth: { token: jwtToken } });

    socket.on("connect_error", (error) => {
      const msg = (error.message || "").toLowerCase();
      if ((msg.includes("expired") || msg.includes("unauthorized")) && onAuthError) onAuthError();
    });

    socket.on("USER_PRESENCE_UPDATED", (payload) => {
      const ids = Array.isArray(payload?.onlineUserIds) ? payload.onlineUserIds : [];
      setOnlineUserIds(new Set(ids));
    });

    socket.on("USER_LIST_UPDATED", () => {
      fetchUsers();
    });

    return () => socket.disconnect();
  }, [jwtToken, fetchUsers, onAuthError]);

  const handleToggleActive = useCallback(async (targetUser) => {
    try {
      await fetchJson(`/api/users/${targetUser.id}`, {
        jwtToken,
        onAuthError,
        method: "PATCH",
        body: JSON.stringify({ isActive: !targetUser.isActive })
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to update user");
    }
  }, [jwtToken, onAuthError]);

  const handleDelete = useCallback(async (targetUser) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete user "${targetUser.displayName || targetUser.username}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await fetchJson(`/api/users/${targetUser.id}`, { jwtToken, onAuthError, method: "DELETE" });
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete user");
    }
  }, [jwtToken, onAuthError]);

  const filteredUsers = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return users.filter((u) => {
      if (filters.role && u.role !== filters.role) return false;
      if (filters.status === "online" && !onlineUserIds.has(u.id)) return false;
      if (filters.status === "offline" && onlineUserIds.has(u.id)) return false;
      if (filters.status === "enabled" && !u.isActive) return false;
      if (filters.status === "disabled" && u.isActive) return false;
      if (search
        && !(u.username || "").toLowerCase().includes(search)
        && !(u.displayName || "").toLowerCase().includes(search)) return false;
      return true;
    });
  }, [users, filters, onlineUserIds]);

  const columns = [
    { key: "username", label: "Username", cellClassName: "font-mono text-xs" },
    { key: "displayName", label: "Display Name", cellClassName: "text-xs font-medium" },
    {
      key: "role",
      label: "Role",
      render: (u) => <Badge tone={ROLE_TONES[u.role]}>{ROLE_DISPLAY[u.role] || u.role}</Badge>
    },
    {
      key: "presence",
      label: "Presence",
      sortValue: (u) => (onlineUserIds.has(u.id) ? 0 : 1),
      render: (u) => (
        <Badge tone={onlineUserIds.has(u.id) ? "green" : "gray"}>
          {onlineUserIds.has(u.id) ? "Online" : "Offline"}
        </Badge>
      )
    },
    {
      key: "isActive",
      label: "Enabled",
      sortValue: (u) => Boolean(u.isActive),
      render: (u) => <Badge tone={u.isActive ? "green" : "gray"}>{u.isActive ? "Enabled" : "Disabled"}</Badge>
    },
    {
      key: "lastLoginAt",
      label: "Last Login",
      sortValue: (u) => u.lastLoginAt || "",
      render: (u) => <span className="whitespace-nowrap text-xs text-black/60">{formatDate(u.lastLoginAt)}</span>
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      align: "right",
      render: (u) => {
        const protectedUser = u.role === "admin";
        if (protectedUser || u.id === user?.id) return null;
        return (
          <div className="flex items-center justify-end gap-1">
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
            {callerIsAdmin && (
              <>
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
        );
      }
    }
  ];

  const isFiltered = filters.search || filters.role || filters.status;

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <PageHeader
          eyebrow="Administration"
          title="User Management"
          subtitle="Create and manage user accounts"
          actions={
            callerIsAdmin && (
              <button type="button" className={primaryButtonClass} onClick={() => setShowCreateForm(true)}>
                + Create User
              </button>
            )
          }
        />

        <ErrorBanner message={errorMessage} />

        <Section
          title="Users"
          meta={`${filteredUsers.length} of ${users.length}`}
          toolbar={
            <>
              <SearchInput
                value={filters.search}
                onChange={(search) => setFilters((f) => ({ ...f, search }))}
                placeholder="Search username or name…"
                className="w-56"
              />
              <FilterSelect
                value={filters.role}
                onChange={(role) => setFilters((f) => ({ ...f, role }))}
                options={ROLE_OPTIONS}
                allLabel="All roles"
              />
              <FilterSelect
                value={filters.status}
                onChange={(status) => setFilters((f) => ({ ...f, status }))}
                options={[
                  { value: "online", label: "Online" },
                  { value: "offline", label: "Offline" },
                  { value: "enabled", label: "Enabled" },
                  { value: "disabled", label: "Disabled" }
                ]}
                allLabel="Any status"
              />
              <ClearFiltersButton
                visible={Boolean(isFiltered)}
                onClear={() => setFilters({ search: "", role: "", status: "" })}
              />
            </>
          }
        >
          <DataTable
            columns={columns}
            rows={filteredUsers}
            rowKey={(u) => u.id}
            loading={isLoading}
            emptyTitle={users.length === 0 ? "No users found" : "No users match the current filters"}
            initialSort={{ key: "username", dir: "asc" }}
            pageSize={15}
            paginationLabel="users"
            minWidth="min-w-[840px]"
          />
        </Section>

        {callerIsAdmin && showCreateForm && (
          <Modal title="Create New User" onClose={() => setShowCreateForm(false)}>
            <CreateUserForm
              jwtToken={jwtToken}
              onUserCreated={() => setShowCreateForm(false)}
              onCancel={() => setShowCreateForm(false)}
            />
          </Modal>
        )}

        {resetTarget && (
          <Modal title="Reset Password" onClose={() => setResetTarget(null)}>
            <ResetPasswordForm
              userName={resetTarget.displayName || resetTarget.username}
              jwtToken={jwtToken}
              userId={resetTarget.id}
              onDone={() => setResetTarget(null)}
              onCancel={() => setResetTarget(null)}
            />
          </Modal>
        )}
      </div>
    </main>
  );
}

export default UserManagementScreen;
