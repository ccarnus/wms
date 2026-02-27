import React, { useState } from "react";

const runtimeApiBaseUrl =
  typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "";
const apiBaseUrl = String(runtimeApiBaseUrl || "").replace(/\/+$/, "");
const buildApiUrl = (path) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

function ChangePasswordScreen({ jwtToken, onPasswordChanged }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!currentPassword) {
      setErrorMessage("Current password is required");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(buildApiUrl("/api/auth/change-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || `Failed: ${response.status}`);
      }

      onPasswordChanged(payload);
    } catch (error) {
      setErrorMessage(error.message || "Password change failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
      >
        <div className="rounded-xl border border-black/10 bg-canvas p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            WMS Console
          </p>
          <h1 className="mt-1 text-xl font-black text-ink">Change Password</h1>
          <p className="mt-1 text-xs text-black/60">
            You must change your password before continuing
          </p>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
            {errorMessage}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-ink">
            Current Password
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Enter current password"
            />
          </label>

          <label className="block text-sm font-semibold text-ink">
            New Password
            <input
              type="password"
              autoComplete="new-password"
              className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              placeholder="At least 6 characters"
            />
          </label>

          <label className="block text-sm font-semibold text-ink">
            Confirm New Password
            <input
              type="password"
              autoComplete="new-password"
              className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Re-enter new password"
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Changing password..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}

export default ChangePasswordScreen;
