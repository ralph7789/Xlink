export default function DeveloperPortal() {
  return (
    <div className="flex-1 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Developer Portal</h1>
            <p className="text-muted-foreground mt-2">Manage your API keys, integrations, and webhooks.</p>
          </div>
          <div className="flex gap-4">
            <button className="bg-background text-foreground border border-border px-4 py-2 rounded-md font-medium text-sm hover:bg-muted transition-colors">
              Documentation
            </button>
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 transition-opacity">
              Create API Key
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-border bg-card rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-4">API Usage Overview</h3>
              <div className="h-64 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/50">
                <span className="text-muted-foreground">Chart Component Placeholder</span>
              </div>
            </div>
            
            <div className="border border-border bg-card rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border bg-muted/30">
                <h3 className="font-semibold text-lg">Active API Keys</h3>
              </div>
              <div className="divide-y divide-border">
                {['Production', 'Staging', 'Development'].map((env) => (
                  <div key={env} className="p-6 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{env} Key</p>
                      <p className="text-sm text-muted-foreground font-mono mt-1">pk_live_********...</p>
                    </div>
                    <button className="text-sm text-primary font-medium hover:underline">Revoke</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="border border-border bg-card rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-primary hover:underline">API Reference</a></li>
                <li><a href="#" className="text-sm text-primary hover:underline">Integration Guides</a></li>
                <li><a href="#" className="text-sm text-primary hover:underline">Webhook Testing</a></li>
                <li><a href="#" className="text-sm text-primary hover:underline">Support Forums</a></li>
              </ul>
            </div>
            
            <div className="border border-border bg-primary/5 rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold mb-2">Need help?</h3>
              <p className="text-sm text-muted-foreground mb-4">Our developer success team is available 24/7 to assist with your integration.</p>
              <button className="w-full bg-background border border-border px-4 py-2 rounded-md font-medium text-sm hover:bg-muted transition-colors">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
