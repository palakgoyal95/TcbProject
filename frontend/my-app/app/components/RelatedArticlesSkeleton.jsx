export default function RelatedArticlesSkeleton() {
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5"
      aria-label="Loading related articles"
    >
      <div className="mb-4 h-6 w-44 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <div className="h-32 animate-pulse bg-slate-200" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
