export default function JsonLd() {

    const organizationSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Voxanne AI",
        "url": "https://voxanne.ai",
        "logo": "https://voxanne.ai/Brand/3.png",
        "description": "Voxanne is the AI voice receptionist that answers, qualifies, and books appointments 24/7 for clinics and med spas.",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Collage House, 2nd Floor, 17 King Edward Road",
            "addressLocality": "Ruislip",
            "addressRegion": "London",
            "postalCode": "HA4 7AE",
            "addressCountry": "GB"
        },
        "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "+44-7424-038250",
            "contactType": "customer service",
            "email": "support@voxanne.ai",
            "areaServed": ["GB", "US", "CA", "TR", "NG"],
            "availableLanguage": ["en"]
        },
        "founder": [
            {
                "@type": "Person",
                "name": "Peter Ntaji",
                "jobTitle": "CEO & Founder"
            },
            {
                "@type": "Person",
                "name": "Austyn Eguale",
                "jobTitle": "Co-Founder & CTO"
            }
        ],
        "sameAs": [
            "https://www.linkedin.com/company/voxanne"
        ],
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "AI Receptionist — Pay As You Go",
            "itemListElement": [
                {
                    "@type": "Offer",
                    "name": "Pay As You Go",
                    "priceCurrency": "GBP",
                    "priceValidUntil": "2027-12-31",
                    "url": "https://voxanne.ai/start",
                    "itemOffered": {
                        "@type": "SoftwareApplication",
                        "name": "Voxanne AI",
                        "applicationCategory": "BusinessApplication",
                        "operatingSystem": "Web",
                        "description": "AI voice receptionist for clinics — pay-as-you-go billing from $25 at $0.70/min, all features included, no setup fees, no contracts."
                    }
                }
            ]
        }
    };

    const localBusinessSchema = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "Voxanne AI",
        "url": "https://voxanne.ai",
        "logo": "https://voxanne.ai/Brand/3.png",
        "description": "AI-powered voice receptionist for healthcare clinics and med spas. Based in London, serving businesses in the UK, US, Canada, Turkey, and Nigeria.",
        "telephone": "+44-7424-038250",
        "email": "support@voxanne.ai",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Collage House, 2nd Floor, 17 King Edward Road",
            "addressLocality": "Ruislip",
            "addressRegion": "London",
            "postalCode": "HA4 7AE",
            "addressCountry": "GB"
        },
        "areaServed": [
            { "@type": "Country", "name": "United Kingdom" },
            { "@type": "Country", "name": "United States" },
            { "@type": "Country", "name": "Canada" },
            { "@type": "Country", "name": "Turkey" },
            { "@type": "Country", "name": "Nigeria" }
        ],
        "priceRange": "From $25 (pay-as-you-go at $0.70/min)"
    };

    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "What is Voxanne AI?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Voxanne AI is a Voice-as-a-Service (VaaS) platform that provides AI-powered voice receptionists for healthcare clinics and med spas. It answers calls 24/7, qualifies patients, books appointments, sends SMS confirmations, and syncs with Google Calendar — all autonomously."
                }
            },
            {
                "@type": "Question",
                "name": "How much does Voxanne AI cost?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Voxanne AI uses simple pay-as-you-go pricing. Top up your wallet from £25 and calls are billed per minute based on actual usage. All features are included — no setup fees, no monthly subscriptions, no lock-in."
                }
            },
            {
                "@type": "Question",
                "name": "Does Voxanne AI integrate with Google Calendar?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. Voxanne AI integrates directly with Google Calendar for real-time availability checking and appointment booking. When a patient calls and requests an appointment, the AI checks your calendar for open slots, books the appointment, and creates a Google Calendar event — all during the phone call."
                }
            },
            {
                "@type": "Question",
                "name": "Can Voxanne AI handle appointment bookings automatically?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. Voxanne AI handles end-to-end appointment booking autonomously. It checks real-time availability, prevents double-bookings with database-level locking, books the appointment, sends an SMS confirmation to the patient, and syncs the event to your Google Calendar."
                }
            },
            {
                "@type": "Question",
                "name": "Is Voxanne AI HIPAA compliant?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. Voxanne AI implements PHI (Protected Health Information) redaction, GDPR-compliant data retention policies, row-level security for multi-tenant data isolation, and encrypted credential storage. The platform is designed for healthcare organizations with strict compliance requirements."
                }
            }
        ]
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
        </>
    );
}
