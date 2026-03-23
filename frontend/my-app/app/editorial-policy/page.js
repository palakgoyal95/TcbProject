export const metadata = {
  title: "Editorial Policy | CorporateBlog",
  description: "Editorial standards and publishing principles for CorporateBlog.",
};

const policyPoints = [
  "Every article must provide clear business context and practical recommendations.",
  "Claims should be backed by examples, references, or measurable outcomes.",
  "We prioritize concise, professional language over trend-driven jargon.",
  "Corrections are reviewed promptly and updated transparently when needed.",
];

export default function EditorialPolicyPage() {
  return (
    <main className="public-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <section className="public-panel mx-auto max-w-4xl rounded-3xl p-6 sm:p-8">
        <p className="public-pill">
          Editorial Policy
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Publishing Standards
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Our editorial process is designed for clarity, trust, and business usefulness.
        </p>
        <ul className="mt-6 space-y-3">
          {policyPoints.map((point) => (
            <li key={point} className="public-note rounded-2xl px-4 py-3 text-sm text-slate-700">
              {point}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
