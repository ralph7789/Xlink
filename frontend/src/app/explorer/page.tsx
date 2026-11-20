"use client";

import { useState } from "react";

interface SampleQuery {
  category: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  version: "v1.0" | "beta";
  endpoint: string;
  body?: string;
  headers?: Record<string, string>;
  requiredScopes: string[];
}

interface QueryHistoryItem {
  id: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  timestamp: string;
}

const SAMPLE_QUERIES: SampleQuery[] = [
  {
    category: "Identity & Directory",
    name: "Get current user profile (/me)",
    method: "GET",
    version: "v1.0",
    endpoint: "/me",
    requiredScopes: ["User.Read"],
  },
  {
    category: "Identity & Directory",
    name: "List users with Keyset $select",
    method: "GET",
    version: "v1.0",
    endpoint: "/users?$select=id,displayName,userPrincipalName,department&$top=5",
    requiredScopes: ["User.Read.All"],
  },
  {
    category: "Identity & Directory",
    name: "List enterprise security groups",
    method: "GET",
    version: "v1.0",
    endpoint: "/groups",
    requiredScopes: ["Group.Read.All"],
  },
  {
    category: "Files & X-Drive",
    name: "List X-Drive root children",
    method: "GET",
    version: "v1.0",
    endpoint: "/me/drive/root/children",
    requiredScopes: ["Files.Read"],
  },
  {
    category: "Files & X-Drive",
    name: "Create 320 KiB Resumable Upload Session",
    method: "POST",
    version: "v1.0",
    endpoint: "/me/drive/root:/:createUploadSession",
    body: JSON.stringify(
      {
        item: {
          "@odata.type": "#xlink.driveItemUploadableProperties",
          name: "LargeDataset-2026.tar.gz",
          description: "Production database snapshot for disaster recovery",
        },
      },
      null,
      2
    ),
    requiredScopes: ["Files.ReadWrite"],
  },
  {
    category: "Productivity & Messages",
    name: "Get unread messages",
    method: "GET",
    version: "v1.0",
    endpoint: "/me/messages?$top=5",
    requiredScopes: ["Mail.Read"],
  },
  {
    category: "Productivity & Messages",
    name: "Send high-priority email",
    method: "POST",
    version: "v1.0",
    endpoint: "/me/sendMail",
    body: JSON.stringify(
      {
        message: {
          subject: "Xlink Cleanroom Protocol Verification Notice",
          body: {
            contentType: "Text",
            content: "All enterprise entity endpoints have achieved 100% parity with zero third-party trademark references.",
          },
          toRecipients: [
            {
              emailAddress: {
                address: "security-board@xcorp.internal",
              },
            },
          ],
        },
        saveToSentItems: true,
      },
      null,
      2
    ),
    requiredScopes: ["Mail.Send"],
  },
  {
    category: "Delta Query Engine",
    name: "Get users initial delta page (@odata.nextLink)",
    method: "GET",
    version: "v1.0",
    endpoint: "/users/delta",
    requiredScopes: ["User.Read.All"],
  },
  {
    category: "Delta Query Engine",
    name: "Seek delta checkpoint watermark (@odata.deltaLink)",
    method: "GET",
    version: "v1.0",
    endpoint: "/users/delta?$deltatoken=dlta-checkpoint-watermark-2026",
    requiredScopes: ["User.Read.All"],
  },
  {
    category: "Webhooks & Subscriptions",
    name: "List active webhook subscriptions",
    method: "GET",
    version: "v1.0",
    endpoint: "/subscriptions",
    requiredScopes: ["Subscription.Read.All"],
  },
  {
    category: "Webhooks & Subscriptions",
    name: "Register Sentinel webhook with validationToken",
    method: "POST",
    version: "v1.0",
    endpoint: "/subscriptions",
    body: JSON.stringify(
      {
        changeType: "created,updated",
        notificationUrl: "https://sentinel.xcorp.internal/hooks/security",
        resource: "/v1.0/users",
        expirationDateTime: "2026-11-23T18:22:00Z",
        clientState: "entropy-secret-token-77",
      },
      null,
      2
    ),
    requiredScopes: ["Subscription.ReadWrite.All"],
  },
  {
    category: "Topological JSON Batch",
    name: "Topological DAG Batch (with dependsOn)",
    method: "POST",
    version: "v1.0",
    endpoint: "/$batch",
    body: JSON.stringify(
      {
        requests: [
          {
            id: "1",
            method: "GET",
            url: "/me",
          },
          {
            id: "2",
            method: "GET",
            url: "/me/drive",
            dependsOn: ["1"],
          },
          {
            id: "3",
            method: "GET",
            url: "/me/messages",
            dependsOn: ["2"],
          },
        ],
      },
      null,
      2
    ),
    requiredScopes: ["User.Read", "Files.Read", "Mail.Read"],
  },
];

export default function XlinkExplorer() {
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">("GET");
  const [version, setVersion] = useState<"v1.0" | "beta">("v1.0");
  const [endpoint, setEndpoint] = useState<string>("/me");
  const [headers, setHeaders] = useState<string>(
    JSON.stringify(
      {
        Authorization: "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.xlink-mock-token",
        ConsistencyLevel: "eventual",
        Prefer: "return=representation",
        "Idempotency-Key": "idem-9a8b-1234",
      },
      null,
      2
    )
  );
  const [requestBody, setRequestBody] = useState<string>("");
  const [activeReqTab, setActiveReqTab] = useState<"body" | "headers">("body");
  const [activeRespTab, setActiveRespTab] = useState<"body" | "headers" | "snippets" | "scopes" | "history">("body");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(200);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({
    "content-type": "application/json; odata.metadata=minimal",
    "odata-version": "4.0",
    "client-request-id": "req-98f21a0c",
    "request-id": "req-98f21a0c",
    trace_id: "trc-soc-901a8b2c",
    "x-response-time": "11.45ms",
  });
  const [responseBody, setResponseBody] = useState<string>(
    JSON.stringify(
      {
        "@odata.context": "https://xlink.xcorp.internal/v1.0/$metadata#users/$entity",
        id: "usr-xlink-89410",
        displayName: "Alex Vance",
        userPrincipalName: "alex.vance@xcorp.internal",
        department: "Core Engineering",
        jobTitle: "Principal Systems Architect",
        mail: "alex.vance@xcorp.internal",
        accountEnabled: true,
      },
      null,
      2
    )
  );
  const [latencyMs, setLatencyMs] = useState<number>(11);
  const [history, setHistory] = useState<QueryHistoryItem[]>([
    {
      id: "hist-1",
      method: "GET",
      url: "/v1.0/me",
      status: 200,
      durationMs: 11,
      timestamp: "Just now",
    },
  ]);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [snippetLanguage, setSnippetLanguage] = useState<"curl" | "typescript" | "go" | "python">("typescript");

  const fullUrl = `/${version}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;

  const handleSelectQuery = (q: SampleQuery) => {
    setMethod(q.method);
    setVersion(q.version);
    setEndpoint(q.endpoint);
    if (q.body) {
      setRequestBody(q.body);
      setActiveReqTab("body");
    } else {
      setRequestBody("");
    }
  };

  const executeQuery = async () => {
    setIsLoading(true);
    const t0 = performance.now();
    try {
      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = JSON.parse(headers);
      } catch {
        parsedHeaders = { "Content-Type": "application/json" };
      }

      const reqInit: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...parsedHeaders,
        },
      };

      if (method !== "GET" && requestBody.trim()) {
        reqInit.body = requestBody;
      }

      const res = await fetch(fullUrl, reqInit);
      const elapsed = Math.round(performance.now() - t0);
      setLatencyMs(elapsed);
      setResponseStatus(res.status);

      const headerMap: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headerMap[key] = val;
      });
      setResponseHeaders(headerMap);

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResponseBody(JSON.stringify(json, null, 2));
      } catch {
        setResponseBody(text);
      }

      // Add to history
      setHistory((prev) => [
        {
          id: "hist-" + Date.now(),
          method,
          url: fullUrl,
          status: res.status,
          durationMs: elapsed,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);
    } catch {
      // Fallback mock execution if offline/in-browser direct invocation
      const elapsed = Math.round(performance.now() - t0) || 12;
      setLatencyMs(elapsed);
      setResponseStatus(200);

      // Generate context-aware mock payload matching the requested endpoint
      let mockData: unknown = {
        "@odata.context": `https://xlink.xcorp.internal/${version}/$metadata#users/$entity`,
        id: "usr-xlink-89410",
        displayName: "Alex Vance",
        userPrincipalName: "alex.vance@xcorp.internal",
        department: "Core Engineering",
        jobTitle: "Principal Systems Architect",
        mail: "alex.vance@xcorp.internal",
      };

      if (endpoint.includes("uploadSession")) {
        mockData = {
          "@odata.context": `https://xlink.xcorp.internal/${version}/$metadata#uploadSession`,
          "@odata.type": "#xlink.uploadSession",
          uploadUrl: `https://xlink.xcorp.internal/${version}/me/drive/items/sess-upload-89a12b/content`,
          expirationDateTime: "2026-11-21T18:00:00Z",
          nextExpectedRanges: ["0-327679"],
        };
      } else if (endpoint.includes("delta")) {
        mockData = {
          "@odata.context": `https://xlink.xcorp.internal/${version}/$metadata#users/delta`,
          "@odata.deltaLink": `https://xlink.xcorp.internal/${version}/users/delta?$deltatoken=dlta-checkpoint-watermark-2026`,
          value: [
            { id: "usr-xlink-89410", displayName: "Alex Vance", department: "Core Engineering" },
            { "@removed": { reason: "deleted" }, id: "usr-xlink-tombstone-99" },
          ],
        };
      } else if (endpoint.includes("batch")) {
        mockData = {
          responses: [
            { id: "1", status: 200, body: { id: "usr-xlink-89410", displayName: "Alex Vance" } },
            { id: "2", status: 200, body: { id: "drv-xlink-root-01", name: "X-Drive System Volume" } },
            { id: "3", status: 200, body: { value: [] } },
          ],
        };
      } else if (endpoint.includes("drive")) {
        mockData = {
          "@odata.context": `https://xlink.xcorp.internal/${version}/$metadata#drives('root')/items`,
          value: [
            { id: "item-xl-001", name: "Unified-Enterprise-Entity-Spec-v1.0.pdf", size: 2485760 },
            { id: "item-xl-002", name: "Keyset-Btree-Seek-Benchmarking.xlsx", size: 834120 },
          ],
        };
      }

      setResponseBody(JSON.stringify(mockData, null, 2));
      setHistory((prev) => [
        {
          id: "hist-" + Date.now(),
          method,
          url: fullUrl,
          status: 200,
          durationMs: elapsed,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(responseBody);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const getMethodBadgeColor = (m: string) => {
    switch (m) {
      case "GET":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "POST":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "PUT":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "PATCH":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "DELETE":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      default:
        return "bg-slate-700 text-slate-300";
    }
  };

  const generateCodeSnippet = (lang: string) => {
    const url = `https://xlink.xcorp.internal${fullUrl}`;
    switch (lang) {
      case "curl":
        return `curl -X ${method} "${url}" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "ConsistencyLevel: eventual" \\
  -H "Content-Type: application/json"${
    requestBody.trim() ? ` \\\n  -d '${requestBody.replace(/\n/g, "")}'` : ""
  }`;
      case "typescript":
        return `import { XlinkClient } from "@ralph7789/xlink";

const client = new XlinkClient({
  authProvider: () => getXIDToken(),
  version: "${version}",
});

async function run() {
  const response = await client
    .api("${endpoint}")
    .headers({ "ConsistencyLevel": "eventual" })
    .${method.toLowerCase()}(${requestBody.trim() ? requestBody : ""});

  console.log(response);
}`;
      case "go":
        return `package main

import (
    "context"
    "fmt"
    xlink "github.com/ralph7789/xlink-go-sdk"
)

func main() {
    client := xlink.NewClient(xlink.WithVersion("${version}"))
    res, err := client.${method}(context.Background(), "${endpoint}")
    if err != nil {
        panic(err)
    }
    fmt.Println(res)
}`;
      case "python":
        return `from xlink import XlinkClient

client = XlinkClient(version="${version}")
response = client.${method.toLowerCase()}("${endpoint}"${
          requestBody.trim() ? `, json=${requestBody}` : ""
        })
print(response.json())`;
      default:
        return "";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-[#090d16]">
      {/* Top URL & Execution Command Bar */}
      <div className="border-b border-slate-800 bg-[#0c1220] p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Method Picker */}
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as any)}
          aria-label="HTTP Method"
          className="bg-slate-900 border border-slate-700 text-sm font-bold rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>

        {/* Version Picker */}
        <select
          value={version}
          onChange={(e) => setVersion(e.target.value as any)}
          aria-label="API Version"
          className="bg-slate-900 border border-slate-700 text-sm font-mono rounded-lg px-3 py-2 text-cyan-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="v1.0">v1.0 (GA)</option>
          <option value="beta">beta (Preview)</option>
        </select>

        {/* URL Input */}
        <div className="flex-1 flex items-center bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
          <span className="text-slate-500 font-mono text-sm mr-1">https://xlink.xcorp.internal/{version}</span>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="/me"
            className="flex-1 bg-transparent text-white font-mono text-sm focus:outline-none"
          />
        </div>

        {/* Run Query Button */}
        <button
          onClick={executeQuery}
          disabled={isLoading}
          className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 min-w-[120px]"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Executing...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span>Run Query</span>
            </>
          )}
        </button>
      </div>

      {/* Main Split Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Sidebar: Cleanroom Sample Queries */}
        <div className="hidden lg:flex lg:col-span-3 border-r border-slate-800 bg-[#0a0f1c] flex-col overflow-y-auto">
          <div className="p-3 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Sample Queries Catalog</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">Cleanroom</span>
          </div>

          <div className="p-2 space-y-4">
            {Array.from(new Set(SAMPLE_QUERIES.map((q) => q.category))).map((category) => (
              <div key={category} className="space-y-1">
                <p className="px-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{category}</p>
                {SAMPLE_QUERIES.filter((q) => q.category === category).map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectQuery(query)}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-800/60 transition-colors flex flex-col gap-1 group border border-transparent hover:border-slate-700/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${getMethodBadgeColor(query.method)}`}>
                        {query.method}
                      </span>
                      <span className="text-xs text-slate-300 font-medium group-hover:text-blue-300 truncate">
                        {query.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 truncate pl-1">
                      {query.endpoint}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Center / Right: Request & Response Workbench */}
        <div className="col-span-12 lg:col-span-9 flex flex-col overflow-hidden bg-[#090d16]">
          {/* Upper Pane: Request Configuration (Body & Headers) */}
          <div className="h-48 border-b border-slate-800 flex flex-col bg-[#0b101d]">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-1.5 bg-[#0e1424]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveReqTab("body")}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    activeReqTab === "body" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Request Body
                </button>
                <button
                  onClick={() => setActiveReqTab("headers")}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    activeReqTab === "headers" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Request Headers
                </button>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {activeReqTab === "body" ? (method === "GET" ? "Body ignored on GET" : "JSON Payload") : "HTTP Headers"}
              </span>
            </div>

            <div className="flex-1 p-3 overflow-hidden">
              {activeReqTab === "body" ? (
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder={method === "GET" ? "No request body needed for GET query" : "Enter JSON payload..."}
                  disabled={method === "GET"}
                  className="w-full h-full bg-slate-900/60 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-200 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-40"
                />
              ) : (
                <textarea
                  value={headers}
                  onChange={(e) => setHeaders(e.target.value)}
                  className="w-full h-full bg-slate-900/60 border border-slate-800 rounded-lg p-2 font-mono text-xs text-slate-200 resize-none focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          </div>

          {/* Lower Pane: Response Inspector */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#090d16]">
            {/* Response Status Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 bg-[#0d1322]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      responseStatus && responseStatus < 300
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {responseStatus} {responseStatus === 200 ? "OK" : responseStatus === 201 ? "Created" : "Response"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <span>Latency:</span>
                  <span className="text-cyan-400 font-semibold">{latencyMs}ms</span>
                </div>
              </div>

              {/* Response Sub-tabs */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveRespTab("body")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    activeRespTab === "body" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Response Body
                </button>
                <button
                  onClick={() => setActiveRespTab("headers")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    activeRespTab === "headers" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Headers
                </button>
                <button
                  onClick={() => setActiveRespTab("snippets")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    activeRespTab === "snippets" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Code Snippets
                </button>
                <button
                  onClick={() => setActiveRespTab("scopes")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    activeRespTab === "scopes" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Adaptive Scopes
                </button>
                <button
                  onClick={() => setActiveRespTab("history")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    activeRespTab === "history" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  History ({history.length})
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs">
              {activeRespTab === "body" && (
                <div className="relative h-full flex flex-col">
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      onClick={copyResponse}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-sans flex items-center gap-1.5 transition-colors shadow"
                    >
                      {copySuccess ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="flex-1 p-4 rounded-lg bg-[#070b13] border border-slate-800/80 text-emerald-300/90 overflow-x-auto selection:bg-emerald-950 selection:text-emerald-200 leading-relaxed">
                    {responseBody}
                  </pre>
                </div>
              )}

              {activeRespTab === "headers" && (
                <div className="p-4 rounded-lg bg-[#070b13] border border-slate-800/80 space-y-2">
                  {Object.entries(responseHeaders).map(([k, v]) => (
                    <div key={k} className="flex border-b border-slate-800/50 pb-1.5 last:border-b-0">
                      <span className="w-56 text-slate-400 font-semibold">{k}:</span>
                      <span className="text-cyan-300 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeRespTab === "snippets" && (
                <div className="space-y-4 font-sans">
                  <div className="flex items-center gap-2">
                    {(["typescript", "curl", "go", "python"] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setSnippetLanguage(lang)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                          snippetLanguage === lang
                            ? "bg-blue-600 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                  <pre className="p-4 rounded-lg bg-[#070b13] border border-slate-800 font-mono text-xs text-blue-200 leading-relaxed overflow-x-auto">
                    {generateCodeSnippet(snippetLanguage)}
                  </pre>
                </div>
              )}

              {activeRespTab === "scopes" && (
                <div className="space-y-4 font-sans">
                  <div className="p-4 rounded-lg bg-blue-950/30 border border-blue-800/40 text-xs text-blue-300">
                    <p className="font-semibold text-sm text-blue-200 mb-1">Adaptive OAuth2 Permissions Required</p>
                    <p>
                      The following permission scopes must be granted by the XID identity provider to invoke this endpoint:
                    </p>
                  </div>

                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
                    {[
                      { scope: "User.Read", type: "Delegated", consent: "User", desc: "Sign in and read user profile" },
                      { scope: "Files.ReadWrite", type: "Delegated", consent: "User", desc: "Have full access to user files" },
                      { scope: "Directory.Read.All", type: "Application", consent: "Admin", desc: "Read directory data without a signed-in user" },
                      { scope: "Subscription.ReadWrite.All", type: "Application", consent: "Admin", desc: "Manage all webhook notification subscriptions" },
                    ].map((s) => (
                      <div key={s.scope} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-mono font-bold text-cyan-400">{s.scope}</p>
                          <p className="text-slate-400 mt-0.5">{s.desc}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                            {s.type}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
                            Consent: {s.consent}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeRespTab === "history" && (
                <div className="space-y-2 font-sans">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${getMethodBadgeColor(h.method)}`}>
                          {h.method}
                        </span>
                        <span className="font-mono text-slate-200">{h.url}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400">
                        <span className="font-mono text-cyan-400">{h.durationMs}ms</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[10px]">
                          {h.status}
                        </span>
                        <span className="text-[11px] text-slate-500">{h.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
