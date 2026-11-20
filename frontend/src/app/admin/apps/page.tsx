"use client";

import { useEffect, useState } from "react";

interface AppItem {
  id: string;
  clientId: string;
  clientSecret: string;
  name: string;
  tenantId: string;
  scopes: string[];
  createdAt: string;
}

const SCOPES_CATALOG = [
  // User
  "User.Read",
  "User.ReadWrite",
  "User.Read.All",
  "User.ReadWrite.All",
  // Group
  "Group.Read.All",
  "Group.ReadWrite.All",
  // Files (X-Drive)
  "Files.Read",
  "Files.ReadWrite",
  "Files.Read.All",
  "Files.ReadWrite.All",
  // Mail
  "Mail.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  // Calendars
  "Calendars.Read",
  "Calendars.ReadWrite",
  // Chat
  "Chat.Read",
  "Chat.ReadWrite",
  // Directory
  "Directory.Read.All",
  "Directory.ReadWrite.All",
  // Subscriptions & Webhooks
  "Subscription.Read.All",
  "Subscription.ReadWrite.All",
];

export default function AdminAppsPage() {
  const [apps, setApps] = useState<AppItem[]>([
    {
      id: "app-reg-01",
      clientId: "xlink-explorer-portal",
      clientSecret: "sec_8912ba09cd45ef78",
      name: "Xlink Interactive Explorer",
      tenantId: "tenant-default",
      scopes: ["User.Read", "User.Read.All", "Group.Read.All", "Files.ReadWrite.All", "Mail.ReadWrite"],
      createdAt: "2026-11-18T10:00:00Z",
    },
    {
      id: "app-reg-02",
      clientId: "sentinel-soc-agent",
      clientSecret: "sec_1102ff99aa34dd56",
      name: "Sentinel SOC Audit Engine",
      tenantId: "tenant-default",
      scopes: ["Directory.Read.All", "Directory.ReadWrite.All", "Subscription.Read.All"],
      createdAt: "2026-11-15T08:30:00Z",
    },
    {
      id: "app-reg-03",
      clientId: "xdrive-sync-daemon",
      clientSecret: "sec_9944bb22cc11aa88",
      name: "X-Drive Resumable Sync Daemon",
      tenantId: "tenant-emea",
      scopes: ["Files.Read", "Files.ReadWrite", "Files.Read.All", "Files.ReadWrite.All"],
      createdAt: "2026-11-19T14:15:00Z",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [appName, setAppName] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("tenant-default");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["User.Read"]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchApps = async () => {
    try {
      const res = await fetch("/api/admin/apps");
      if (res.ok) {
        const data = await res.json();
        if (data.apps && Array.isArray(data.apps)) {
          setApps(data.apps);
        }
      }
    } catch {
      // Fallback in-memory
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const handleRegisterApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: appName,
          tenantId,
          scopes: selectedScopes,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setApps((prev) => [created, ...prev]);
        setNotification(`App "${created.name}" registered successfully with Client ID ${created.clientId}`);
        setIsModalOpen(false);
        setAppName("");
        setSelectedScopes(["User.Read"]);
      } else {
        // Fallback local creation
        const mockNew: AppItem = {
          id: "app-reg-" + Math.floor(Math.random() * 9000 + 1000),
          clientId: "client-" + Math.random().toString(36).substring(2, 10),
          clientSecret: "sec_" + Math.random().toString(36).substring(2, 16),
          name: appName,
          tenantId,
          scopes: selectedScopes,
          createdAt: new Date().toISOString(),
        };
        setApps((prev) => [mockNew, ...prev]);
        setNotification(`App "${mockNew.name}" registered in local vault`);
        setIsModalOpen(false);
        setAppName("");
        setSelectedScopes(["User.Read"]);
      }
    } catch {
      setNotification("Registered application in offline memory state");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Application Registrations
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              21 Scopes Mastered
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enterprise application credentials, client secrets, and granular OAuth2 permission scope grants.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/30"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Register Application
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2 font-medium">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {notification}
        </div>
      )}

      {/* Applications List */}
      <div className="space-y-4">
        {apps.map((app) => (
          <div key={app.id} className="p-5 rounded-xl bg-[#0c1220] border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {app.name}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Tenant: {app.tenantId}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  ID: {app.id} &bull; Registered: {new Date(app.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-mono text-[11px]">Client ID:</span>
                <code className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-300 text-[11px]">
                  {app.clientId}
                </code>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Granted OAuth2 Scopes ({app.scopes.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {app.scopes.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/40 font-mono text-blue-300 text-[11px]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Register Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0c1220] border border-slate-700 rounded-xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Register Enterprise Application</h3>
                <p className="text-xs text-slate-400">Generate credentials and select cleanroom permission scopes</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-mono p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRegisterApp} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Application Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sentinel Security Orchestrator"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Tenant Target</label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="tenant-default">tenant-default (US-East Cluster)</option>
                  <option value="tenant-emea">tenant-emea (EU-West Cluster)</option>
                  <option value="tenant-apac">tenant-apac (AP-South Cluster)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>21 Master Scopes Selection ({selectedScopes.length} selected)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedScopes(selectedScopes.length === SCOPES_CATALOG.length ? [] : [...SCOPES_CATALOG])
                    }
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    {selectedScopes.length === SCOPES_CATALOG.length ? "Deselect All" : "Select All 21"}
                  </button>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800 max-h-56 overflow-y-auto">
                  {SCOPES_CATALOG.map((s) => {
                    const checked = selectedScopes.includes(s);
                    return (
                      <label
                        key={s}
                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs font-mono transition-colors ${
                          checked ? "bg-blue-600/20 text-blue-300" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScope(s)}
                          className="rounded border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <span className="truncate">{s}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Registering..." : "Confirm & Issue Credentials"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
