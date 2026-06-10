import React, { useState } from "react";
import { fetchJson } from "./lib/api";
import { ErrorBanner } from "./components/ui";

function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const payload = await fetchJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: trimmedUsername, password })
      });

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

  const inputClass =
    "mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-canvas via-white to-accent-50 px-4">
      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-black/10 bg-white p-6 shadow-lg"
        >
          <div className="rounded-xl border border-accent/20 bg-accent-50 p-5 text-center">
            <img src="/Greenlights_full_logo.png" alt="Greenlights" className="mx-auto h-20 w-auto" />
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-700">
              Operations Hub
            </p>
          </div>

          {errorMessage && (
            <div className="mt-4">
              <ErrorBanner message={errorMessage} />
            </div>
          )}

          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-ink">
              Username
              <input
                type="text"
                autoComplete="username"
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                placeholder="Enter your username"
                autoFocus
              />
            </label>

            <label className="block text-sm font-semibold text-ink">
              Password
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={`${inputClass} pr-14`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-black/40 hover:text-black/70"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
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

        <p className="mt-4 text-center text-xs text-black/40">
          Warehouse Management System
        </p>
      </div>
    </div>
  );
}

export default LoginScreen;
