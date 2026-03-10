import React, { useState } from "react";

const runtimeApiBaseUrl =
  typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "";
const apiBaseUrl = String(runtimeApiBaseUrl || "").replace(/\/+$/, "");
const buildApiUrl = (path) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setErrorMessage("Username is required");
      return;
    }
    if (!password) {
      setErrorMessage("Password is required");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(buildApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          password
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || `Login failed: ${response.status}`);
      }

      onLoginSuccess({
        token: payload.token,
        user: payload.user
      });
    } catch (error) {
      setErrorMessage(error.message || "Login failed");
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
        <div className="rounded-xl border border-accent/20 bg-accent-50 p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <img src="/Logo.png" alt="Greenlights" className="h-8 w-auto" />
            <span className="text-lg font-bold tracking-tight text-ink">
              Green<span className="text-accent-600">lights</span>
            </span>
          </div>
          <h1 className="mt-2 text-xl font-black text-ink">Sign In</h1>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
            {errorMessage}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-ink">
            Username
            <input
              type="text"
              autoComplete="username"
              className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              placeholder="Enter your username"
            />
          </label>

          <label className="block text-sm font-semibold text-ink">
            Password
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Enter your password"
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default LoginScreen;
