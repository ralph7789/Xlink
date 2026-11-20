import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Hero Section */}
      <div className="text-center space-y-5 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          Cleanroom Enterprise Protocol Engine
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white">
          Xlink Enterprise <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">Entity Gateway</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
          Unified entity server layer integrating enterprise identity, X-Drive storage, productivity messaging,
          Keyset query pagination, and real-time webhook event synchronization.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
          <Link
            href="/explorer"
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Launch Xlink Explorer
          </Link>
          <Link
            href="/admin"
            className="px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Open Admin Center
          </Link>
        </div>
      </div>

      {/* Protocol Architecture Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-16">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white">Keyset Query Engine</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            O(log N) B-Tree cursor seek navigation with zero SQL OFFSET degradation. Implements deterministic <code className="text-cyan-400">@odata.nextLink</code> and <code className="text-cyan-400">@odata.deltaLink</code> checkpoint tokens.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white">320 KiB X-Drive Bus</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Resumable chunked upload protocol enforcing 327,680 byte boundary alignment up to 250 GB with automatic fragmentation recovery and byte-range tracking.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white">Sentinel Zero-Trust</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Full 21 OAuth2 scope catalog with XID directory mapping, correlated SOC trace tokens, validationToken handshakes, and cryptographic payload signatures.
          </p>
        </div>
      </div>

      {/* Live System Specs Bar */}
      <div className="w-full mt-10 rounded-xl border border-slate-800 bg-[#0c1220] p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h4 className="text-sm font-semibold text-white">Unified Ingress Endpoints</h4>
            <p className="text-xs text-slate-400">Serving active tenants across enterprise availability zones</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Active: /v1.0/*
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Preview: /beta/*
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-center">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Throttling Limit</p>
            <p className="text-lg font-bold text-slate-200 mt-1">1,200 req/min</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Chunk Alignment</p>
            <p className="text-lg font-bold text-slate-200 mt-1">320 KiB Strict</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Max File Size</p>
            <p className="text-lg font-bold text-slate-200 mt-1">250 GB</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Batch DAG Concurrency</p>
            <p className="text-lg font-bold text-slate-200 mt-1">Topological 20 reqs</p>
          </div>
        </div>
      </div>
    </div>
  );
}
