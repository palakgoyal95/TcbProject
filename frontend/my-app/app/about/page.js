import Link from "next/link";

export const metadata = {
  title: "About | CorporateBlog",
  description: "Learn about CorporateBlog and our editorial approach.",
};

const editorialPrinciples = [
  {
    title: "Clarity Over Noise",
    description:
      "We translate complex product, growth, and operating topics into writing that teams can scan and use quickly.",
  },
  {
    title: "Built for Decisions",
    description:
      "Our coverage focuses on real business tradeoffs, not abstract trends or recycled talking points.",
  },
  {
    title: "Execution Focused",
    description:
      "Every article is shaped to help readers move from insight to action inside planning, delivery, or review cycles.",
  },
];

const publicationWorkflow = [
  {
    title: "Research With Real Context",
    description:
      "We start from practical questions teams face across operations, product delivery, growth, and leadership.",
  },
  {
    title: "Edit for Signal",
    description:
      "Drafts are tightened for readability, structure, and usefulness so busy readers can find the point fast.",
  },
  {
    title: "Publish for Teams",
    description:
      "We format each story to be easy to share with stakeholders, managers, and cross-functional partners.",
  },
];

const quickFacts = [
  {
    label: "Audience",
    value: "Leaders and operators",
    description: "Articles are written for professionals balancing strategy, execution, and growth.",
    tone: "border-cyan-200/80 bg-cyan-50/85",
  },
  {
    label: "Editorial Lens",
    value: "Practical and measurable",
    description: "We favor examples, frameworks, and outcomes readers can bring into the next planning cycle.",
    tone: "border-blue-200/80 bg-blue-50/85",
  },
  {
    label: "Content Mix",
    value: "Strategy to execution",
    description: "Coverage spans planning, team health, communication, process design, and performance.",
    tone: "border-emerald-200/80 bg-emerald-50/85",
  },
];

export default function AboutPage() {
  return (
    <main className="public-shell min-h-screen px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <section className="relative mx-auto max-w-7xl space-y-6">
        <article className="public-panel relative overflow-hidden rounded-[2.5rem] p-6 sm:p-8 lg:min-h-[34rem] lg:p-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.3),transparent_55%)]" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-emerald-200/35 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-start">
            <div>
              <p className="public-pill">
                About
              </p>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.8rem]">
                Business writing designed for teams that need clarity, not noise.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                CorporateBlog publishes practical insights for leaders, operators, and cross-functional teams shipping work in real business environments. Our editorial approach is straightforward: deliver useful thinking, clear structure, and ideas readers can act on without extra translation.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/blog"
                  className="public-button-primary px-5 py-3 text-sm font-semibold"
                >
                  Read the Blog
                </Link>
                <Link
                  href="/categories"
                  className="public-button-secondary px-5 py-3 text-sm font-semibold"
                >
                  Browse Categories
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {quickFacts.map((fact) => (
                <article
                  key={fact.label}
                  className={`public-panel-soft rounded-[1.5rem] p-5 ${fact.tone}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {fact.label}
                  </p>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{fact.value}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{fact.description}</p>
                </article>
              ))}
            </div>
          </div>
        </article>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <article className="public-panel-soft rounded-[2rem] p-6 sm:p-8">
            <p className="public-eyebrow">
              Editorial Principles
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">What shapes every article we publish</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {editorialPrinciples.map((principle, index) => (
                <article
                  key={principle.title}
                  className={`public-panel-soft rounded-[1.5rem] p-5 ${
                    index === 0
                      ? "border-cyan-200/80 bg-cyan-50/85"
                      : index === 1
                        ? "border-blue-200/80 bg-blue-50/85"
                        : "border-emerald-200/80 bg-emerald-50/85"
                  }`}
                >
                  <h3 className="text-lg font-semibold text-slate-900">{principle.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{principle.description}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="public-panel-dark relative overflow-hidden rounded-[2rem] p-6 text-white sm:p-8">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.32),transparent_52%)]" />
            <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/85">
              Publishing Workflow
            </p>
            <h2 className="relative mt-3 text-2xl font-semibold">How we turn ideas into useful reading</h2>
            <div className="relative mt-6 space-y-4">
              {publicationWorkflow.map((step, index) => (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-[1.5rem] border border-white/12 bg-white/8 p-4 backdrop-blur"
                >
                  <span className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-300/18 text-sm font-semibold text-cyan-100">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
