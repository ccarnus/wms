import React from "react";

function DashboardScreen() {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h2 className="text-lg font-black text-ink">Dashboard</h2>
      <p className="mt-1 text-xs text-black/60">
        Overview and key performance indicators
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-black/20 bg-white p-12 text-center">
        <p className="text-sm font-semibold text-black/40">
          Dashboard coming soon
        </p>
        <p className="mt-1 text-xs text-black/30">
          KPIs, charts, and real-time metrics will appear here.
        </p>
      </div>
    </div>
  );
}

export default DashboardScreen;
