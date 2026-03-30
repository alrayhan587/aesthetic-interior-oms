export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 font-sans">
      <h1 className="mb-6 text-3xl font-bold">Privacy Policy for Aesthetic Interior</h1>
      <p className="mb-8 text-sm text-gray-600">Last Updated: March 30, 2026</p>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">1. Information We Collect</h2>
        <p>
          Through the Facebook Messenger API, we may collect information you share with our
          Facebook Page, including your name, profile details, and message content, so we can
          provide customer support and interior design services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">2. How We Use Your Data</h2>
        <p>
          We use collected data only to respond to inquiries, manage project communication, and
          provide our services. We do not sell your personal data to third parties.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">3. Data Deletion</h2>
        <p>
          You can request deletion of your data at any time by messaging our Facebook Page or
          contacting us at <strong>support@aestheticinterior.com</strong>. We process deletion
          requests within 48 hours.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">4. Third-Party Services</h2>
        <p>
          We use trusted service providers, including Vercel (hosting) and Neon (database), to
          operate our platform. These providers apply industry-standard security practices.
        </p>
      </section>
    </main>
  )
}
