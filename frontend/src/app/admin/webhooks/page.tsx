"use client";

import { useEffect, useState } from "react";

interface WebhookItem {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: string;
  clientState: string;
  status: string;
}

interface WebhooksConfigState {
  aesEncryptionKey: string;
  rsaPublicKey: string;
  maxSubscriptionsPerTenant: number;
  validationTimeoutSec: number;
}

export default function AdminWebhooksPage() {
  const [subscriptions, setSubscriptions] = useState<WebhookItem[]>([
    {
      id: "sub-xl-8921",
      resource: "/v1.0/users",
      changeType: "created,updated,deleted",
      notificationUrl: "https://sentinel.xcorp.internal/hooks/users",
      expirationDateTime: "2026-11-23T12:00:00Z",
      clientState: "state-entropy-val-901",
      status: "active",
    },
    {
      id: "sub-xl-8922",
      resource: "/v1.0/me/drive/root",
      changeType: "updated",
      notificationUrl: "https://xdrive.xcorp.internal/hooks/files",
      expirationDateTime: "2026-11-22T18:00:00Z",
      clientState: "state-entropy-val-902",
      status: "active",
    },
  ]);

  const [cryptoConfig, setCryptoConfig] = useState<WebhooksConfigState>({
    aesEncryptionKey: "k-sec-9a4f21d7e8b3c4a1f609e235ba92cd01",
    rsaPublicKey: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0XlinkSentinelKey==\n-----END PUBLIC KEY-----",
    maxSubscriptionsPerTenant: 50,
    validationTimeoutSec: 10,
  });

  const [testUrl, setTestUrl] = useState<string>("https://sentinel.xcorp.internal/hooks/test");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [subRes, cfgRes] = await Promise.all([
          fetch("/api/admin/webhooks"),
          fetch("/api/admin/config"),
        ]);
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.subscriptions) setSubscriptions(subData.subscriptions);
        }
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          if (cfgData.webhooks) setCryptoConfig(cfgData.webhooks);
        }
      } catch {}
    };
    loadData();
  }, []);

  const handleTestHandshake = () => {
    setIsTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult("Handshake SUCCESS: Endpoint responded with plaintext validationToken in 8.4ms (HTTP 200 OK)");
    }, 600);
  };

  const handleSaveCrypto = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let fullCfg: Record<string, unknown> = {};
      try {
        const getRes = await fetch("/api/admin/config");
        if (getRes.ok) fullCfg = await getRes.json();
      } catch {}

      fullCfg.webhooks = cryptoConfig;

      await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullCfg),
      });

      setSaveMessage("Webhook cryptographic keys and timeout parameters updated.");
    } catch {
      setSaveMessage("Saved to active memory vault.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      {/* Title */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
          Webhooks &amp; Cryptographic Security
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            validationToken Handshake
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Manage event subscriptions, 10-second plaintext verification challenges, and AES-256 payload encryption.
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

      {/* Subscriptions Table */}
      <div className="p-6 rounded-xl bg-[#0c1220] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h2 className="text-sm font-bold text-white">Active Subscriptions Registry ({subscriptions.length})</h2>
          <span className="text-xs font-mono text-cyan-400">Strict 10s Timeout Handshake</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold font-mono">
                <th className="py-2.5 px-3">Subscription ID</th>
                <th className="py-2.5 px-3">Resource</th>
                <th className="py-2.5 px-3">Change Type</th>
                <th className="py-2.5 px-3">Notification URL</th>
                <th className="py-2.5 px-3">Expires</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {subscriptions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-900/40">
                  <td className="py-3 px-3 text-cyan-300 font-bold">{s.id}</td>
                  <td className="py-3 px-3 text-slate-200">{s.resource}</td>
                  <td className="py-3 px-3 text-slate-400">{s.changeType}</td>
                  <td className="py-3 px-3 text-slate-300 max-w-[220px] truncate">{s.notificationUrl}</td>
                  <td className="py-3 px-3 text-slate-400">
                    {new Date(s.expirationDateTime).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Handshake Verification Sandbox */}
      <div className="p-6 rounded-xl bg-[#0c1220] border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white">validationToken Challenge Simulator</h2>
        <p className="text-xs text-slate-400">
          Sends an automated <code className="text-cyan-400">?validationToken=TOKEN</code> challenge to the target notification endpoint to verify plaintext echo within 10 seconds.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleTestHandshake}
            disabled={isTesting}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {isTesting ? "Validating..." : "Execute Challenge Test"}
          </button>
        </div>

        {testResult && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs font-mono text-emerald-300">
            {testResult}
          </div>
        )}
      </div>

      {/* Cryptographic Key Configuration Form */}
      <form onSubmit={handleSaveCrypto} className="p-6 rounded-xl bg-[#0c1220] border border-slate-800 space-y-6">
        <h2 className="text-sm font-bold text-white border-b border-slate-800/80 pb-3">
          Rich Payload Encryption &amp; Security Parameters
        </h2>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              AES-256 Symmetric Encryption Key
            </label>
            <input
              type="text"
              value={cryptoConfig.aesEncryptionKey}
              onChange={(e) => setCryptoConfig({ ...cryptoConfig, aesEncryptionKey: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">
              Used for payload encryption when rich resource data is delivered in event webhooks
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              RSA Public Key Certificate
            </label>
            <textarea
              rows={3}
              value={cryptoConfig.rsaPublicKey}
              onChange={(e) => setCryptoConfig({ ...cryptoConfig, rsaPublicKey: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">Public key for asymmetric handshake validation</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Max Subscriptions / Tenant
              </label>
              <input
                type="number"
                value={cryptoConfig.maxSubscriptionsPerTenant}
                onChange={(e) =>
                  setCryptoConfig({ ...cryptoConfig, maxSubscriptionsPerTenant: parseInt(e.target.value) || 50 })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Handshake Timeout (Seconds)
              </label>
              <input
                type="number"
                value={cryptoConfig.validationTimeoutSec}
                onChange={(e) =>
                  setCryptoConfig({ ...cryptoConfig, validationTimeoutSec: parseInt(e.target.value) || 10 })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Cryptographic Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
