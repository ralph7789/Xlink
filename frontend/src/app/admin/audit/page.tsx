"use client";

import { useEffect, useState } from "react";

interface AuditItem {
  id: string;
  traceId: string;
  timestamp: string;
  actor: string;
  event: string;
  resource: string;
  ipAddress: string;
  result: string;
  threatScore: number;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditItem[]>([
    {
      id: "aud-9a01",
      traceId: "trc-soc-901a8b2c",
      timestamp: "2026-11-20T06:50:00Z",
      actor: "alex.vance@xcorp.internal",
      event: "TokenBucketPolicyUpdate",
      resource: "/api/admin/config/throttling",
      ipAddress: "10.240.0.12",
      result: "Success",
      threatScore: 0,
    },
    {
      id: "aud-9a02",
      traceId: "trc-soc-889b71df",
      timestamp: "2026-11-20T06:38:00Z",
      actor: "sentinel-soc-agent",
      event: "DeltaSyncCheckpointSeek",
      resource: "/v1.0/users/delta",
      ipAddress: "10.240.4.88",
      result: "Success",
      threatScore: 1,
    },
    {
      id: "aud-9a03",
      traceId: "trc-soc-772c91a0",
      timestamp: "2026-11-20T06:05:00Z",
      actor: "xdrive-sync-daemon",
      event: "ResumableUploadSessionInit",
      resource: "/v1.0/me/drive/root/createUploadSession",
      ipAddress: "10.240.2.19",
      result: "Success",
      threatScore: 0,
    },
    {
      id: "aud-9a04",
      traceId: "trc-soc-661a5e3b",
      timestamp: "2026-11-20T04:45:00Z",
      actor: "unknown-service-principal",
      event: "ThrottlingLimitExceeded",
      resource: "/v1.0/users?$filter=department eq 'Infra'",
      ipAddress: "192.168.100.45",
      result: "Blocked",
      threatScore: 12,
    },
  ]);

  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const res = await fetch("/api/admin/audit");
        if (res.ok) {
          const data = await res.json();
          if (data.auditLogs && Array.isArray(data.auditLogs)) {
            setLogs(data.auditLogs);
          }
        }
      } catch {}
    };
    fetchAudit();
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.event.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.traceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.resource.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadAuditJSON = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinel-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* Title & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Sentinel SOC Security Audit Trail
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Zero-Trust Audit Trail
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Cryptographic access log stream with trace IDs, actor identities, and threat risk scoring.
          </p>
        </div>

        <button
          onClick={downloadAuditJSON}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Audit Ledger (JSON)
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-[#0c1220] border border-slate-800 flex items-center gap-3">
        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Filter by Actor, Event, Trace ID, or Resource URI..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
        />
        <span className="text-xs text-slate-500 font-mono">
          Showing {filteredLogs.length} of {logs.length}
        </span>
      </div>

      {/* Audit Table */}
      <div className="rounded-xl bg-[#0c1220] border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold font-mono bg-slate-900/60">
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Sentinel Trace ID</th>
                <th className="py-3 px-4">Actor Principal</th>
                <th className="py-3 px-4">Event Operation</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                    {new Date(l.timestamp).toISOString().replace("T", " ").replace("Z", "")}
                  </td>
                  <td className="py-3 px-4 text-cyan-400 font-bold whitespace-nowrap">{l.traceId}</td>
                  <td className="py-3 px-4 text-slate-200">{l.actor}</td>
                  <td className="py-3 px-4 text-indigo-300">{l.event}</td>
                  <td className="py-3 px-4 text-slate-400 max-w-[200px] truncate">{l.resource}</td>
                  <td className="py-3 px-4 text-slate-500">{l.ipAddress}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        l.result === "Success"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {l.result}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.threatScore === 0
                          ? "text-slate-400 bg-slate-800"
                          : l.threatScore < 10
                          ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                          : "text-rose-400 bg-rose-500/10 border border-rose-500/20"
                      }`}
                    >
                      {l.threatScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
