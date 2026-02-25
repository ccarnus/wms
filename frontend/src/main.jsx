import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Unknown frontend error"
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Frontend render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen px-4 py-8">
          <section className="mx-auto max-w-2xl rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-700">
            <h1 className="text-lg font-bold">Frontend runtime error</h1>
            <p className="mt-2 text-sm">{this.state.message}</p>
            <p className="mt-2 text-xs">
              Open browser DevTools console for the full stack trace.
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
