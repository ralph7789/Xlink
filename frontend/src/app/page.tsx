import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 text-center space-y-12">
      <div className="space-y-4 max-w-3xl">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl text-foreground">
          Welcome to xLink
        </h1>
        <p className="text-xl text-muted-foreground">
          The central hub for managing APIs, integrating services, and overseeing system operations.
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-4xl">
        <Link 
          href="/developer" 
          className="group relative rounded-xl border border-border bg-card p-8 hover:border-primary/50 hover:shadow-lg transition-all text-left flex flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-2 group-hover:text-primary transition-colors">Developer Portal</h2>
            <p className="text-muted-foreground">
              Build, manage, and monitor your API integrations. Access keys, view usage analytics, and read documentation.
            </p>
          </div>
        </Link>
        
        <Link 
          href="/admin" 
          className="group relative rounded-xl border border-border bg-card p-8 hover:border-primary/50 hover:shadow-lg transition-all text-left flex flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <div className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-2 group-hover:text-primary transition-colors">Admin Portal</h2>
            <p className="text-muted-foreground">
              Oversee the entire platform. Manage users, configure system-wide settings, and monitor global metrics.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
