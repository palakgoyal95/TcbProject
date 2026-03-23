export const metadata = {
  title: "FAQ | CorporateBlog",
  description: "Frequently asked questions about CorporateBlog.",
};

const faqs = [
  {
    question: "Who can publish on CorporateBlog?",
    answer:
      "Writers with approved accounts can draft and publish posts through the Writer Portal.",
  },
  {
    question: "How often are new posts published?",
    answer:
      "Our editorial desk publishes on a rolling schedule, with priority on high-signal business topics.",
  },
  {
    question: "Can I suggest a topic?",
    answer:
      "Yes. Use the contact page and share your topic idea with context and expected audience.",
  },
];

export default function FaqPage() {
  return (
    <main className="public-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <section className="public-panel mx-auto max-w-4xl rounded-3xl p-6 sm:p-8">
        <p className="public-pill">
          FAQ
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <div className="mt-6 space-y-4">
          {faqs.map((item) => (
            <article key={item.question} className="public-note rounded-2xl p-4">
              <h2 className="text-lg font-semibold text-slate-900">{item.question}</h2>
              <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
