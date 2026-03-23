export default function BlogLoading() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="h-100 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-10 grid grid-cols-4 gap-8">
        <div className="col-span-3 grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-lg bg-white shadow">
              <div className="h-40 animate-pulse bg-slate-200" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="h-40 animate-pulse rounded bg-slate-200" />
          <div className="h-36 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
