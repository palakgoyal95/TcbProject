import Link from "next/link";
import { getCategories } from "../lib/api";

export const metadata = {
  title: "Categories | CorporateBlog",
  description: "Explore post categories in CorporateBlog.",
};

const categoryThemes = [
  {
    card: "border-cyan-200/85 bg-[linear-gradient(180deg,rgba(236,254,255,0.98),rgba(255,255,255,0.94))]",
    badge: "bg-cyan-100 text-cyan-800",
    button: "group-hover:border-cyan-300 group-hover:bg-cyan-50 group-hover:text-cyan-900",
  },
  {
    card: "border-blue-200/85 bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(255,255,255,0.94))]",
    badge: "bg-blue-100 text-blue-800",
    button: "group-hover:border-blue-300 group-hover:bg-blue-50 group-hover:text-blue-900",
  },
  {
    card: "border-emerald-200/85 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(255,255,255,0.94))]",
    badge: "bg-emerald-100 text-emerald-800",
    button: "group-hover:border-emerald-300 group-hover:bg-emerald-50 group-hover:text-emerald-900",
  },
];

function categoryDescription(category) {
  if (typeof category?.description === "string" && category.description.trim()) {
    return category.description.trim();
  }
  return "Explore curated posts in this business area.";
}

export default async function CategoriesPage() {
  const categories = await getCategories();
  const safeCategories = Array.isArray(categories) ? categories : [];
  const customDescriptions = safeCategories.filter(
    (category) => typeof category?.description === "string" && category.description.trim(),
  ).length;

  return (
    <main className="public-shell min-h-screen px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <section className="relative mx-auto max-w-7xl space-y-6">
        <article className="public-panel relative overflow-hidden rounded-[2.5rem] p-6 sm:p-8 lg:min-h-[34rem] lg:p-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.3),transparent_55%)]" />
          <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div>
              <p className="public-pill">
                Categories
              </p>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.8rem]">
                Explore the topics that matter most to your team.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                Browse every category in one place, move directly into focused reading, and find the themes most relevant to strategy, operations, delivery, and growth.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/blog"
                  className="public-button-primary px-5 py-3 text-sm font-semibold"
                >
                  Explore All Posts
                </Link>
                <Link
                  href="/search"
                  className="public-button-secondary px-5 py-3 text-sm font-semibold"
                >
                  Search Articles
                </Link>
              </div>
            </div>

            <article className="public-panel-dark relative overflow-hidden rounded-[1.9rem] p-6 text-white">
              <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.3),transparent_55%)]" />
              <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/85">
                Library Snapshot
              </p>
              <div className="relative mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[1.25rem] border border-white/12 bg-white/8 p-4 backdrop-blur">
                  <p className="text-3xl font-semibold">{safeCategories.length}</p>
                  <p className="mt-2 text-sm text-slate-300">Topic groups ready to explore.</p>
                </div>
                <div className="rounded-[1.25rem] border border-white/12 bg-white/8 p-4 backdrop-blur">
                  <p className="text-3xl font-semibold">{customDescriptions}</p>
                  <p className="mt-2 text-sm text-slate-300">Categories with tailored summaries.</p>
                </div>
              </div>
            </article>
          </div>
        </article>

        {safeCategories.length === 0 ? (
          <article className="public-empty rounded-[2rem] p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-900">No categories available yet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Categories will appear here as soon as the content library is populated.
            </p>
            <div className="mt-5">
              <Link
                href="/blog"
                className="public-button-primary px-4 py-2.5 text-sm font-semibold"
              >
                Go to Blog
              </Link>
            </div>
          </article>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {safeCategories.map((category, index) => {
              const id = category?.id != null ? String(category.id) : "";
              const name = category?.name || "Untitled Category";
              const href = id ? `/blog?category=${encodeURIComponent(id)}` : "/blog";
              const hasCustomDescription =
                typeof category?.description === "string" && category.description.trim();
              const theme = categoryThemes[index % categoryThemes.length];

              return (
                <article
                  key={`${id}-${name}`}
                  className={`public-panel-soft group flex h-full flex-col rounded-[1.75rem] p-5 transition duration-200 hover:-translate-y-1 sm:p-6 ${theme.card}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Topic {String(index + 1).padStart(2, "0")}
                      </p>
                      <h2 className="mt-3 text-xl font-semibold text-slate-950">{name}</h2>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${theme.badge}`}>
                      {id ? `#${id}` : "General"}
                    </span>
                  </div>

                  <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">
                    {categoryDescription(category)}
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      {hasCustomDescription ? "Tailored summary" : "Standard summary"}
                    </span>
                    <Link
                      href={href}
                      className={`public-button-secondary px-4 py-2.5 text-sm font-semibold ${theme.button}`}
                    >
                      View Posts
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
