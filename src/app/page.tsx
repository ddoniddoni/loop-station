import { ko } from "@/lib/i18n/ko";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col px-6 sm:px-12">
      <a className="skip-link" href="#main">{ko.skipToContent}</a>
      <header className="flex flex-wrap items-center justify-between gap-4 py-8">
        <span className="brand text-xl font-semibold tracking-tight">{ko.appName}</span>
        <span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">{ko.status}</span>
      </header>

      <main id="main" className="flex flex-1 flex-col justify-center py-10 sm:py-20">
        <section aria-labelledby="welcome-title" className="rounded-3xl border border-line bg-panel p-7 sm:p-14">
          <div className="loop-mark mb-10" aria-hidden="true"><span /><span /></div>
          <p className="mb-4 text-sm text-accent">{ko.introduction}</p>
          <h1 id="welcome-title" className="text-3xl leading-snug break-keep text-balance font-semibold tracking-tight sm:text-5xl">{ko.title}</h1>
          <p id="availability" className="mt-6 max-w-lg text-base leading-7 text-muted">{ko.availability}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <button type="button" disabled aria-describedby="availability" className="min-h-12 rounded-xl border border-line bg-surface px-5 text-sm text-muted disabled:cursor-not-allowed">{ko.newProject}</button>
            <button type="button" disabled aria-describedby="availability" className="min-h-12 rounded-xl border border-line px-5 text-sm text-muted disabled:cursor-not-allowed">{ko.demo}</button>
          </div>
        </section>

        <section aria-labelledby="next-step-title" className="mt-8 grid gap-3 px-2 sm:grid-cols-[1fr_2fr] sm:gap-10">
          <h2 id="next-step-title" className="text-sm text-muted">{ko.nextStepTitle}</h2>
          <div>
            <h3 className="text-base font-medium">{ko.nextStep}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{ko.nextStepDescription}</p>
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap justify-between gap-3 border-t border-line py-6 text-xs leading-5 text-muted">
        <span>{ko.localFirst}</span>
        <span>{ko.privacy}</span>
      </footer>
    </div>
  );
}
