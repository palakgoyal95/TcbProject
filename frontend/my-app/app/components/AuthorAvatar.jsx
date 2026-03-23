export default function AuthorAvatar({ author }) {
  const label = author ? `U${author}` : "AU";

  return (
    <div className="inline-flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
        {label}
      </div>
      <span className="text-sm text-slate-600">Author {author || "Unknown"}</span>
    </div>
  );
}
