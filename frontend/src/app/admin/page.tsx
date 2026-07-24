export default function AdminPortal() {
  return (
    <div className="flex-1 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Portal</h1>
            <p className="text-muted-foreground mt-2">Manage the system, users, and platform settings.</p>
          </div>
          <div className="flex gap-4">
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              Generate Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-border bg-card rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg">Total Users</h3>
            <p className="text-4xl font-bold mt-2">1,248</p>
            <p className="text-sm text-green-500 mt-1">+12% from last month</p>
          </div>
          <div className="border border-border bg-card rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg">System Health</h3>
            <p className="text-4xl font-bold mt-2 text-primary">99.9%</p>
            <p className="text-sm text-muted-foreground mt-1">Uptime over 30 days</p>
          </div>
          <div className="border border-border bg-card rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg">Active Sessions</h3>
            <p className="text-4xl font-bold mt-2">342</p>
            <p className="text-sm text-muted-foreground mt-1">Currently online</p>
          </div>
        </div>

        <div className="border border-border bg-card rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-border/50 last:border-b-0">
                <div>
                  <p className="font-medium">System Update Completed</p>
                  <p className="text-sm text-muted-foreground">Version 2.4.1 deployed successfully.</p>
                </div>
                <span className="text-xs text-muted-foreground">{i}h ago</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
