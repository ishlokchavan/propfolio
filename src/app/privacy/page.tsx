export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12" style={{ color: '#F1F0FF' }}>
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm mb-8" style={{ color: '#6B6A7F' }}>Propfolio · Last updated June 2026</p>

      <div className="space-y-6 text-[15px] leading-relaxed" style={{ color: '#B0AFC4' }}>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#F1F0FF' }}>What Propfolio does</h2>
          <p>Propfolio helps UAE property buyers track their real estate investments. With your permission, we read emails from property developers in your connected inbox to automatically build your portfolio: properties, payment plans, and milestones.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#F1F0FF' }}>Google user data</h2>
          <p>When you connect a Google account, we request read-only access to Gmail (gmail.readonly). We use this access solely to identify emails from property developers and extract property ownership information (project names, payment schedules, amounts, due dates). We do not read unrelated personal email content beyond automated relevance filtering, do not send email on your behalf, do not share Gmail data with third parties for advertising, and do not sell your data. Email content is processed transiently to extract property data and is not stored; only the extracted property records are saved to your account.</p>
          <p className="mt-2">Propfolio&apos;s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="underline" style={{ color: '#A78BFA' }}>Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#F1F0FF' }}>What we store</h2>
          <p>Your profile (name, email), connected account tokens (encrypted at rest), and extracted property data (projects, units, payment milestones). All data is stored with row-level security: only you can access your records.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#F1F0FF' }}>AI processing</h2>
          <p>Relevant email content and attachments are processed by Anthropic&apos;s Claude API to extract structured property data. Content sent to the API is not used to train AI models.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#F1F0FF' }}>Deleting your data</h2>
          <p>Remove a connected email account anytime in the app to revoke access. To delete your account and all data, contact us at the email below. You can also revoke Propfolio&apos;s access from your Google Account security settings.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#F1F0FF' }}>Contact</h2>
          <p>ishlokchavan@gmail.com</p>
        </section>
      </div>
    </div>
  )
}
