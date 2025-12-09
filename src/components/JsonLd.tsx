export default function JsonLd() {
    const schema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "CallWaiting AI",
        "url": "https://callwaitingai.dev",
        "logo": "https://callwaitingai.dev/callwaiting ai logo.png",
        "description": "AI-powered receptionist for healthcare practices. Never miss a call, never lose a lead.",
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
            "email": "support@callwaitingai.dev",
            "areaServed": "GB",
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
            "https://www.linkedin.com/company/callwaitingai"
        ]
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}
