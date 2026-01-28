export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="mb-4">Last updated: January 26, 2026</p>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
        <p>We collect appointment details, contact information, and calendar access...</p>
      </section>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
        <p>Your information is used solely for appointment management...</p>
      </section>
      
      {/* Additional sections as required */}
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
        <p>We retain appointment data for 36 months to facilitate follow-up care. Calendar access tokens are stored encrypted and automatically revoked after 6 months of inactivity.</p>
      </section>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">6. Third-Party Sharing</h2>
        <p>We share appointment details with healthcare providers via secure APIs solely for care coordination. No data is sold to advertisers or third parties.</p>
      </section>
    </div>
  );
}
