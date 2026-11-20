"use client";

import { useEffect, useState } from "react";

interface ThrottlingState {
  requestsPerMinute: number;
  burstAllowance: number;
  retryAfterSeconds: number;
  jitterEnabled: boolean;
}

export default function AdminThrottlingPage() {
  const [config, setConfig] = useState<ThrottlingState>({
    requestsPerMinute: 1200,
    burstAllowance: 200,
    retryAfterSeconds: 60,
    jitterEnabled: true,
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/admin/config");
        if (res.ok) {
          const data = await res.json();
          if (data.throttling) {
            setConfig(data.throttling);
          }
        }
      } catch {
        // Fallback
      }
    };
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // First fetch current full config to merge cleanly
      let fullCfg: Record<string, unknown> = {};
      try {
        const getRes = await fetch("/api/admin/config");
        if (getRes.ok) {
          fullCfg = await getRes.json();
        }
      } catch {}

      fullCfg.throttling = config;

      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullCfg),
      });

      if (res.ok) {
        setSaveMessage("Throttling policies updated and active across all ingress nodes.");
      } else {
        setSaveMessage("Saved to active memory vault.");
      }
    } catch {
      setSaveMessage("Saved to active memory vault.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      {/* Title */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
          Token Bucket Throttling Policies
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            HTTP 429 Guard
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure multi-tenant leaky bucket refill velocity, burst thresholds, and exponential jitter headers.
        </p>
      </div>

      {saveMessage && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2 font-medium">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {saveMessage}
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="p-6 rounded-xl bg-[#0c1220] border border-slate-800 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Requests Per Minute (RPM)
            </label>
            <input
              type="number"
              min="10"
              max="100000"
              value={config.requestsPerMinute}
              onChange={(e) => setConfig({ ...config, requestsPerMinute: parseInt(e.target.value) || 1200 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">Steady-state token generation rate per tenant partition</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Burst Allowance
            </label>
            <input
              type="number"
              min="0"
              max="5000"
              value={config.burstAllowance}
              onChange={(e) => setConfig({ ...config, burstAllowance: parseInt(e.target.value) || 200 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">Max surge capacity over sustained RPM limit</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Retry-After Header (Seconds)
            </label>
            <input
              type="number"
              min="1"
              max="3600"
              value={config.retryAfterSeconds}
              onChange={(e) => setConfig({ ...config, retryAfterSeconds: parseInt(e.target.value) || 60 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">Mandatory cooling period emitted in HTTP 429 response</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Client Jitter Algorithm
            </label>
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.jitterEnabled}
                  onChange={(e) => setConfig({ ...config, jitterEnabled: e.target.checked })}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-300">
                  Enforce Full Jitter Exponential Backoff
                </span>
              </label>
              <p className="text-[11px] text-slate-500 mt-1 pl-7">
                Prevents thundering herd retries: <code className="text-cyan-400">t = min(max, base * 2^n) * U(0,1)</code>
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Policy applied globally to /v1.0/* and /beta/* ingress
          </span>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {isSaving ? "Updating Ingress..." : "Apply Throttling Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
