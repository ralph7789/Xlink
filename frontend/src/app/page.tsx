'use client';

import { useState, useEffect, useCallback } from 'react';

interface Endpoint {
  path: string;
  method: string;
  code: string;
}

export default function Home() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [path, setPath] = useState('/hello');
  const [method, setMethod] = useState('GET');
  const [code, setCode] = useState('return { message: "Hello World" };');
  const [execResult, setExecResult] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/endpoints`);
      const data = await res.json();
      setEndpoints(data || []);
    } catch (e) {
      console.error('Failed to fetch endpoints', e);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  const createEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/api/endpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, method, code }),
      });
      if (res.ok) {
        alert('Endpoint created!');
        fetchEndpoints();
      } else {
        alert('Failed to create endpoint');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating endpoint');
    }
  };

  const testEndpoint = async (endpoint: Endpoint) => {
    try {
      const res = await fetch(`${apiUrl}/run${endpoint.path}`, {
        method: endpoint.method,
      });
      const data = await res.json();
      setExecResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      if (e instanceof Error) {
        setExecResult(`Error: ${e.message}`);
      } else {
        setExecResult(`Error: Unknown error`);
      }
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-gray-700 pb-4">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">API Builder SaaS</h1>
          <p className="text-gray-400 mt-2">Manage and execute your serverless endpoints.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          <section className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h2 className="text-2xl font-semibold mb-4 text-blue-300">Create Endpoint</h2>
            <form onSubmit={createEndpoint} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Path</label>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                  placeholder="/my-api"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">JavaScript Code (Sandbox)</label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-40 bg-gray-900 border border-gray-600 rounded p-2 text-green-400 font-mono text-sm"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition">
                Deploy Endpoint
              </button>
            </form>
          </section>

          <section className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 flex flex-col">
            <h2 className="text-2xl font-semibold mb-4 text-purple-300">Live Endpoints</h2>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {endpoints.length === 0 ? (
                <p className="text-gray-500 italic">No endpoints deployed yet.</p>
              ) : (
                endpoints.map((ep, idx) => (
                  <div key={idx} className="bg-gray-900 p-4 rounded border border-gray-700 flex justify-between items-center">
                    <div>
                      <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded mr-2 font-bold">{ep.method}</span>
                      <span className="font-mono">{ep.path}</span>
                    </div>
                    <button
                      onClick={() => testEndpoint(ep)}
                      className="bg-purple-600 hover:bg-purple-500 text-xs px-3 py-1 rounded text-white transition"
                    >
                      Run
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-auto">
              <h3 className="text-sm text-gray-400 mb-2">Execution Result</h3>
              <div className="bg-black p-4 rounded min-h-[100px] border border-gray-700 overflow-x-auto">
                <pre className="text-green-400 text-xs">{execResult || '// Select an endpoint to run'}</pre>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
