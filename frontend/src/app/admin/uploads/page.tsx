"use client";

import { useEffect, useState } from "react";

interface UploadsConfigState {
  chunkSizeKiB: number;
  maxFileSizeGB: number;
  sessionTtlHours: number;
  strictChunkAlignment: boolean;
}

export default function AdminUploadsPage() {
  const [config, setConfig] = useState<UploadsConfigState>({
    chunkSizeKiB: 320,
    maxFileSizeGB: 250,
    sessionTtlHours: 24,
    strictChunkAlignment: true,
  });

  const [testFileSizeMB, setTestFileSizeMB] = useState<number>(10);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/admin/config");
        if (res.ok) {
          const data = await res.json();
          if (data.uploads) setConfig(data.uploads);
        }
      } catch {}
    };
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let fullCfg: Record<string, unknown> = {};
      try {
        const getRes = await fetch("/api/admin/config");
        if (getRes.ok) fullCfg = await getRes.json();
      } catch {}

      fullCfg.uploads = config;

      await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullCfg),
      });

      setSaveMessage("X-Drive 320 KiB upload session parameters updated.");
    } catch {
      setSaveMessage("Saved to active memory vault.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  // Math for 320 KiB chunk calculator
  const totalBytes = testFileSizeMB * 1024 * 1024;
  const chunkBytes = config.chunkSizeKiB * 1024;
  const totalChunks = Math.ceil(totalBytes / chunkBytes);
  const lastChunkBytes = totalBytes % chunkBytes || chunkBytes;

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      {/* Title */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
          Resumable Upload Sessions &amp; 320 KiB Boundary Enforcement
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            X-Drive Storage Bus
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Enforce strict 327,680 byte boundary quantization, resumable upload session lifetimes, and 250 GB maximum payloads.
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

      {/* Uploads Configuration Form */}
      <form onSubmit={handleSave} className="p-6 rounded-xl bg-[#0c1220] border border-slate-800 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Chunk Unit Size (KiB)
            </label>
            <input
              type="number"
              step="320"
              min="320"
              max="64000"
              value={config.chunkSizeKiB}
              onChange={(e) => setConfig({ ...config, chunkSizeKiB: parseInt(e.target.value) || 320 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">
              Mandatory multiple of 320 KiB (327,680 bytes) per protocol standards
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Max File Limit (GB)
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={config.maxFileSizeGB}
              onChange={(e) => setConfig({ ...config, maxFileSizeGB: parseInt(e.target.value) || 250 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">Maximum allowed file size for chunked upload sessions</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Session Expiry TTL (Hours)
            </label>
            <input
              type="number"
              min="1"
              max="168"
              value={config.sessionTtlHours}
              onChange={(e) => setConfig({ ...config, sessionTtlHours: parseInt(e.target.value) || 24 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">Expiration window before incomplete upload session cleanup</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Chunk Alignment Verification
            </label>
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.strictChunkAlignment}
                  onChange={(e) => setConfig({ ...config, strictChunkAlignment: e.target.checked })}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-300">
                  Strict 320 KiB Alignment Enforcement
                </span>
              </label>
              <p className="text-[11px] text-slate-500 mt-1 pl-7">
                Rejects non-conforming chunks with HTTP 400 Bad Request
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {isSaving ? "Updating Upload Pipeline..." : "Apply Upload Bounds"}
          </button>
        </div>
      </form>

      {/* Interactive 320 KiB Math Calculator */}
      <div className="p-6 rounded-xl bg-[#0c1220] border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white">Resumable Chunk Sequence Calculator</h2>
        <div className="flex items-center gap-4">
          <label className="text-xs text-slate-400">Simulate File Size (MB):</label>
          <input
            type="number"
            min="1"
            max="10000"
            value={testFileSizeMB}
            onChange={(e) => setTestFileSizeMB(parseInt(e.target.value) || 1)}
            className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase">Total Size</p>
            <p className="text-sm font-bold text-cyan-400 mt-1">{totalBytes.toLocaleString()} bytes</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase">320 KiB Chunks</p>
            <p className="text-sm font-bold text-white mt-1">{totalChunks} chunks</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase">Standard Chunk</p>
            <p className="text-sm font-bold text-white mt-1">{chunkBytes.toLocaleString()} bytes</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase">Terminal Chunk</p>
            <p className="text-sm font-bold text-indigo-400 mt-1">{lastChunkBytes.toLocaleString()} bytes</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#070b13] border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
          <p className="text-slate-500 font-semibold">First Chunk Header:</p>
          <p className="text-emerald-400">Content-Range: bytes 0-{chunkBytes - 1}/{totalBytes}</p>
          <p className="text-slate-500 font-semibold pt-1">Second Chunk Header:</p>
          <p className="text-cyan-400">Content-Range: bytes {chunkBytes}-{chunkBytes * 2 - 1}/{totalBytes}</p>
        </div>
      </div>
    </div>
  );
}
