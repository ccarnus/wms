export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/60 to-white" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,rgba(20,184,166,0.08),transparent)]" />

      <div className="mx-auto max-w-7xl px-6 pb-20 pt-24 sm:pt-32 lg:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Cloud-native warehouse management
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Warehouse operations,{" "}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              orchestrated in real time
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            FlowWMS combines intelligent task assignment, live inventory
            tracking, and operator performance analytics into a single
            platform that keeps your warehouse running at peak efficiency.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#demo"
              className="w-full rounded-xl bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 sm:w-auto"
            >
              Request a Demo
            </a>
            <a
              href="#features"
              className="w-full rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 sm:w-auto"
            >
              See Features
            </a>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl sm:mt-20">
          <div className="rounded-2xl border border-gray-200 bg-gray-900 p-2 shadow-2xl shadow-gray-900/20">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="ml-4 text-xs text-gray-500">FlowWMS Dashboard</span>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 p-8">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Active Tasks", value: "247", color: "text-brand-400" },
                  { label: "Operators Online", value: "34", color: "text-blue-400" },
                  { label: "Units Processed", value: "12.8k", color: "text-emerald-400" },
                  { label: "Fulfillment Rate", value: "98.7%", color: "text-amber-400" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                    <p className="text-xs font-medium text-gray-400">{stat.label}</p>
                    <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {["Pick Zone A", "Bulk Storage B", "Dock C"].map((zone) => (
                  <div key={zone} className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-300">{zone}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="mt-3 flex gap-1">
                      {[0.45, 0.7, 0.3, 0.55, 0.65, 0.4, 0.75, 0.5].map((opacity, i) => (
                        <div
                          key={i}
                          className="h-6 flex-1 rounded-sm"
                          style={{
                            backgroundColor: `rgba(20, 184, 166, ${opacity})`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
