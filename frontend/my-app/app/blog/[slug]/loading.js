export default function BlogPostLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-12 w-full animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-6 w-3/4 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 h-10 w-full animate-pulse rounded bg-slate-200" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
