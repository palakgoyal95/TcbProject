export const metadata = {
  title: "Terms of Service | CorporateBlog",
  description: "Terms of service for using CorporateBlog.",
};

export default function TermsOfServicePage() {
  return (
    <main className="public-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <section className="public-panel mx-auto max-w-4xl rounded-3xl p-6 sm:p-8">
        <p className="public-pill">
          Terms
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Terms of Service
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            By using this platform, you agree to provide lawful, accurate content and avoid abuse,
            unauthorized access, and harmful activities.
          </p>
          <p>
            Published content remains the responsibility of the author account, subject to review
            and moderation policies.
          </p>
          <p>
            We may update platform features and policies as the product evolves. Continued usage
            indicates acceptance of current terms.
          </p>
        </div>
      </section>
    </main>
  );
}
