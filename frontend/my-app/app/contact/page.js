import Link from "next/link";

import ContactForm from "../components/ContactForm";

export const metadata = {
  title: "Contact | CorporateBlog",
  description: "Contact CorporateBlog for support, partnerships, or editorial feedback.",
};

const contactCards = [
  {
    title: "General Support",
    value: "support@corporateblog.local",
    note: "Platform usage, account issues, and publishing support.",
    tone: "border-cyan-200/80 bg-cyan-50/85",
  },
  {
    title: "Editorial Team",
    value: "editorial@corporateblog.local",
    note: "Story proposals, corrections, and editorial questions.",
    tone: "border-blue-200/80 bg-blue-50/85",
  },
  {
    title: "Partnerships",
    value: "partnerships@corporateblog.local",
    note: "Sponsorships, collaborations, and distribution partnerships.",
    tone: "border-emerald-200/80 bg-emerald-50/85",
  },
];

const responseStandards = [
  {
    title: "Response Window",
    detail: "Most messages are reviewed within 1 business day and routed to the right team quickly.",
  },
  {
    title: "Best For",
    detail: "Support questions, editorial ideas, corrections, partnership requests, and publishing help.",
  },
  {
    title: "Helpful Details",
    detail: "Include article links, screenshots, deadlines, or account context so we can respond with fewer follow-ups.",
  },
];

export default function ContactPage() {
  return (
    <main className="public-shell min-h-screen px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <section className="relative mx-auto max-w-7xl space-y-6">
        <article className="public-panel relative overflow-hidden rounded-[2.5rem] p-6 sm:p-8 lg:min-h-[34rem] lg:p-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.24),transparent_58%)]" />
          <div className="absolute -bottom-8 left-0 h-40 w-40 rounded-full bg-emerald-200/35 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div>
              <p className="public-pill">
                Contact
              </p>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.8rem]">
                A cleaner way to reach support, editorial, and partnership teams.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                We support readers, writers, and teams looking to collaborate. Use the form below or contact the right desk directly so your request can move quickly.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/blog"
                  className="public-button-primary px-5 py-3 text-sm font-semibold"
                >
                  Explore the Blog
                </Link>
                <Link
                  href="/about"
                  className="public-button-secondary px-5 py-3 text-sm font-semibold"
                >
                  Learn About Us
                </Link>
              </div>
            </div>

            <article className="public-panel-dark relative overflow-hidden rounded-[1.9rem] p-6 text-white">
              <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.24),transparent_58%)]" />
              <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/85">
                Response Standards
              </p>
              <div className="relative mt-5 space-y-4">
                {responseStandards.map((item) => (
                  <div key={item.title} className="rounded-[1.25rem] border border-white/12 bg-white/8 p-4 backdrop-blur">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-100">
                      {item.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="relative mt-8 grid gap-4 md:grid-cols-3">
            {contactCards.map((card) => (
              <article
                key={card.title}
                className={`public-panel-soft rounded-[1.5rem] p-5 ${card.tone}`}
              >
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {card.title}
                </h2>
                <a
                  href={`mailto:${card.value}`}
                  className="mt-3 block text-base font-semibold text-slate-950 transition hover:text-cyan-800"
                >
                  {card.value}
                </a>
                <p className="mt-3 text-sm leading-6 text-slate-600">{card.note}</p>
              </article>
            ))}
          </div>
        </article>

        <div className="grid gap-6 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.15fr)] lg:items-stretch">
          <article className="public-panel-soft rounded-[2rem] p-6 sm:p-8">
            <p className="public-eyebrow">
              Before You Send
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">Help us route your message faster</h2>
            <div className="mt-6 space-y-4">
              <div className="public-note rounded-[1.5rem] p-5">
                <h3 className="text-base font-semibold text-slate-900">What to include</h3>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                  <li>The reason for your message and the outcome you need.</li>
                  <li>Relevant article links, screenshots, or account context if it applies.</li>
                  <li>Any launch date, campaign deadline, or timeline we should be aware of.</li>
                </ul>
              </div>
              <div className="public-note rounded-[1.5rem] p-5">
                <h3 className="text-base font-semibold text-slate-900">Typical response path</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Support requests go to operations, editorial notes are reviewed by the content team, and partnership conversations are routed to the growth desk. Clear context helps us get your message to the right person on the first pass.
                </p>
              </div>
            </div>
          </article>

          <ContactForm className="h-full" />
        </div>
      </section>
    </main>
  );
}
