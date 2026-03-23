export const metadata = {
  title: "Privacy Policy | CorporateBlog",
  description: "Privacy policy for CorporateBlog users and subscribers.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="public-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <section className="public-panel mx-auto max-w-4xl rounded-3xl p-6 sm:p-8">
        <p className="public-pill">
          Privacy
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Privacy Policy
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            We collect minimal account and content data needed to operate the platform, support
            sign-in, and deliver publishing features.
          </p>
          <p>
            Contact and subscription form submissions are stored to respond to requests and send
            opted-in updates. You can request removal by contacting support.
          </p>
          <p>
            We do not sell personal data. Access is restricted to authorized administrators and
            operational systems.
          </p>
        </div>
      </section>
    </main>
  );
}
