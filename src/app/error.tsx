"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="max-w-md rounded-xl border border-critical/50 bg-panel p-6 shadow-glow" aria-labelledby="error-title">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-critical">System notice</p>
        <h1 id="error-title" className="mt-2 text-xl font-semibold">The audit workspace could not load.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">No inspection result has been submitted. You can safely try loading the workspace again.</p>
        <button type="button" onClick={reset} className="mt-5 rounded-md bg-signal px-4 py-2 text-sm font-semibold text-canvas">
          Reload workspace
        </button>
      </section>
    </main>
  );
}
