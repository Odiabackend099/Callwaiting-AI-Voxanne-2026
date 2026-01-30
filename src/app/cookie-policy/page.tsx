import React from 'react';
import { Cookie, Settings, Eye, Globe, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function CookiePolicyPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-20 px-6">
            <div className="max-w-4xl mx-auto">
                {/* Hero Section */}
                <div className="bg-gradient-to-br from-amber-600 to-amber-800 text-white p-12 rounded-2xl shadow-xl mb-12">
                    <div className="flex items-center gap-4 mb-6">
                        <Cookie className="h-16 w-16" />
                        <div>
                            <h1 className="text-5xl font-bold mb-2">Cookie Policy</h1>
                            <p className="text-amber-100 text-xl">
                                How We Use Cookies and Similar Technologies
                            </p>
                        </div>
                    </div>
                    <p className="text-amber-50 text-lg leading-relaxed">
                        This Cookie Policy explains how Voxanne AI uses cookies and similar tracking technologies to improve your
                        experience on our website and services.
                    </p>
                </div>

                {/* Main Content */}
                <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200">
                    <div className="prose prose-slate prose-lg max-w-none">
                        <p className="text-slate-500 text-sm mb-8">Last Updated: January 30, 2026</p>

                        {/* Table of Contents */}
                        <div className="bg-slate-50 p-6 rounded-lg mb-12 border border-slate-200">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 mt-0">Table of Contents</h2>
                            <nav className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[
                                    { href: '#what-are-cookies', title: '1. What Are Cookies?' },
                                    { href: '#types-of-cookies', title: '2. Types of Cookies We Use' },
                                    { href: '#third-party-cookies', title: '3. Third-Party Cookies' },
                                    { href: '#cookie-duration', title: '4. Cookie Duration' },
                                    { href: '#cookie-table', title: '5. Detailed Cookie Table' },
                                    { href: '#control-cookies', title: '6. How to Control Cookies' },
                                    { href: '#do-not-track', title: '7. Do Not Track Signals' },
                                    { href: '#cookie-consent', title: '8. Cookie Consent' },
                                    { href: '#updates', title: '9. Updates to This Policy' },
                                    { href: '#contact', title: '10. Contact Us' },
                                ].map((item) => (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        className="text-amber-600 hover:text-amber-700 hover:underline transition-colors"
                                    >
                                        {item.title}
                                    </a>
                                ))}
                            </nav>
                        </div>

                        {/* Section 1: What Are Cookies */}
                        <section id="what-are-cookies" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Cookie className="h-8 w-8 text-amber-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">1. What Are Cookies?</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-4">
                                Cookies are small text files that are placed on your device (computer, smartphone, or tablet) when you
                                visit a website. Cookies are widely used to make websites work more efficiently and to provide information
                                to website owners.
                            </p>

                            <p className="text-slate-700 leading-relaxed mb-4">
                                Cookies typically contain the following information:
                            </p>

                            <ul className="space-y-2 text-slate-700 mb-6">
                                <li><strong>Cookie Name:</strong> A unique identifier for the cookie</li>
                                <li><strong>Domain:</strong> The website that set the cookie (e.g., voxanne.ai)</li>
                                <li><strong>Expiration Date:</strong> How long the cookie remains on your device</li>
                                <li><strong>Value:</strong> Data associated with the cookie (e.g., user preferences, session ID)</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Why We Use Cookies</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                We use cookies for several important reasons:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Essential Functionality</h4>
                                    <p className="text-sm text-slate-700">
                                        To remember your login status, preferences, and settings as you navigate our website.
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Security</h4>
                                    <p className="text-sm text-slate-700">
                                        To protect your account from fraud and ensure secure authentication.
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Performance</h4>
                                    <p className="text-sm text-slate-700">
                                        To understand how you use our website so we can improve its performance and usability.
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Analytics</h4>
                                    <p className="text-sm text-slate-700">
                                        To measure website traffic, user behavior, and conversion rates.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 2: Types of Cookies */}
                        <section id="types-of-cookies" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Settings className="h-8 w-8 text-amber-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">2. Types of Cookies We Use</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                We use different types of cookies, each serving a specific purpose. Here's a breakdown:
                            </p>

                            <div className="space-y-6">
                                {/* Essential Cookies */}
                                <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-600">
                                    <div className="flex items-start gap-3 mb-3">
                                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                                        <div>
                                            <h3 className="text-xl font-semibold text-slate-900 mb-2">Essential Cookies (Strictly Necessary)</h3>
                                            <p className="text-slate-700 text-sm mb-3">
                                                These cookies are required for the website to function properly. They enable core functionality
                                                such as security, network management, and accessibility. You cannot opt out of these cookies.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ml-9">
                                        <p className="font-semibold text-slate-900 mb-2 text-sm">Examples:</p>
                                        <ul className="text-sm text-slate-700 space-y-1">
                                            <li>• <strong>Authentication Cookies:</strong> Remember your login status and keep you signed in</li>
                                            <li>• <strong>Security Cookies:</strong> Protect against cross-site request forgery (CSRF) attacks</li>
                                            <li>• <strong>Load Balancing Cookies:</strong> Route your requests to the correct server</li>
                                            <li>• <strong>Session Cookies:</strong> Maintain your session as you navigate the website</li>
                                        </ul>
                                        <p className="text-xs text-slate-600 mt-3 italic">
                                            Note: Essential cookies do not require consent under GDPR/ePrivacy regulations as they are
                                            necessary for the provision of the service you requested.
                                        </p>
                                    </div>
                                </div>

                                {/* Analytics Cookies */}
                                <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-600">
                                    <div className="flex items-start gap-3 mb-3">
                                        <Eye className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                                        <div>
                                            <h3 className="text-xl font-semibold text-slate-900 mb-2">Analytics Cookies (Performance)</h3>
                                            <p className="text-slate-700 text-sm mb-3">
                                                These cookies help us understand how visitors interact with our website by collecting and
                                                reporting information anonymously. This helps us improve the website's performance and user experience.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ml-9">
                                        <p className="font-semibold text-slate-900 mb-2 text-sm">Examples:</p>
                                        <ul className="text-sm text-slate-700 space-y-1">
                                            <li>• <strong>Google Analytics:</strong> Tracks page views, session duration, bounce rate, and traffic sources</li>
                                            <li>• <strong>Performance Monitoring:</strong> Measures page load times and identifies technical issues</li>
                                            <li>• <strong>Heatmaps:</strong> Shows where users click and scroll on the page (if enabled)</li>
                                        </ul>
                                        <p className="text-xs text-slate-600 mt-3">
                                            <strong>Your Choice:</strong> You can opt out of analytics cookies using our cookie consent banner
                                            or browser settings. This will not affect website functionality.
                                        </p>
                                    </div>
                                </div>

                                {/* Marketing Cookies */}
                                <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-600">
                                    <div className="flex items-start gap-3 mb-3">
                                        <Globe className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
                                        <div>
                                            <h3 className="text-xl font-semibold text-slate-900 mb-2">Marketing Cookies (Targeting/Advertising)</h3>
                                            <p className="text-slate-700 text-sm mb-3">
                                                These cookies are used to deliver advertisements that are relevant to you and your interests.
                                                They may also be used to limit the number of times you see an advertisement and measure the
                                                effectiveness of advertising campaigns.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ml-9">
                                        <p className="font-semibold text-slate-900 mb-2 text-sm">Examples:</p>
                                        <ul className="text-sm text-slate-700 space-y-1">
                                            <li>• <strong>Google Ads:</strong> Tracks conversions from Google Ads campaigns (if applicable)</li>
                                            <li>• <strong>Facebook Pixel:</strong> Tracks conversions from Facebook/Instagram ads (if applicable)</li>
                                            <li>• <strong>Retargeting Cookies:</strong> Show ads to users who previously visited our website</li>
                                        </ul>
                                        <p className="text-xs text-slate-600 mt-3">
                                            <strong>Your Choice:</strong> You can opt out of marketing cookies using our cookie consent banner.
                                            You can also opt out of personalized ads via the Digital Advertising Alliance's opt-out page.
                                        </p>
                                    </div>
                                </div>

                                {/* Functional Cookies */}
                                <div className="bg-amber-50 p-6 rounded-lg border-l-4 border-amber-600">
                                    <div className="flex items-start gap-3 mb-3">
                                        <Settings className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
                                        <div>
                                            <h3 className="text-xl font-semibold text-slate-900 mb-2">Functional Cookies (Preference)</h3>
                                            <p className="text-slate-700 text-sm mb-3">
                                                These cookies enable the website to provide enhanced functionality and personalization.
                                                They may be set by us or by third-party providers whose services we use on our pages.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ml-9">
                                        <p className="font-semibold text-slate-900 mb-2 text-sm">Examples:</p>
                                        <ul className="text-sm text-slate-700 space-y-1">
                                            <li>• <strong>Language Preference:</strong> Remember your preferred language</li>
                                            <li>• <strong>Theme Selection:</strong> Remember if you prefer dark or light mode</li>
                                            <li>• <strong>Font Size:</strong> Remember accessibility settings</li>
                                            <li>• <strong>Video Player Preferences:</strong> Remember volume and quality settings</li>
                                        </ul>
                                        <p className="text-xs text-slate-600 mt-3">
                                            <strong>Your Choice:</strong> You can opt out of functional cookies, but this may affect some
                                            website features and personalization.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 3: Third-Party Cookies */}
                        <section id="third-party-cookies" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Globe className="h-8 w-8 text-amber-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">3. Third-Party Cookies</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                In addition to our own cookies, we use third-party services that may set their own cookies when you visit
                                our website. We do not control these cookies and recommend reviewing the privacy policies of these third parties.
                            </p>

                            <div className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Google Analytics</h4>
                                    <p className="text-sm text-slate-700 mb-2">
                                        We use Google Analytics to understand how visitors interact with our website. Google Analytics uses
                                        cookies to collect information such as page views, session duration, bounce rate, and demographics.
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        <strong>Privacy Policy:</strong>{' '}
                                        <a
                                            href="https://policies.google.com/privacy"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-amber-600 hover:underline"
                                        >
                                            https://policies.google.com/privacy
                                        </a>
                                        <br />
                                        <strong>Opt-Out:</strong>{' '}
                                        <a
                                            href="https://tools.google.com/dlpage/gaoptout"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-amber-600 hover:underline"
                                        >
                                            Google Analytics Opt-Out Browser Add-On
                                        </a>
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Stripe (Payment Processing)</h4>
                                    <p className="text-sm text-slate-700 mb-2">
                                        We use Stripe to process payments securely. Stripe may set cookies to prevent fraud and ensure
                                        secure transactions. These cookies are essential for payment processing.
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        <strong>Privacy Policy:</strong>{' '}
                                        <a
                                            href="https://stripe.com/privacy"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-amber-600 hover:underline"
                                        >
                                            https://stripe.com/privacy
                                        </a>
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Intercom (Customer Support)</h4>
                                    <p className="text-sm text-slate-700 mb-2">
                                        We use Intercom for live chat and customer support. Intercom uses cookies to remember your chat
                                        history and provide personalized support.
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        <strong>Privacy Policy:</strong>{' '}
                                        <a
                                            href="https://www.intercom.com/legal/privacy"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-amber-600 hover:underline"
                                        >
                                            https://www.intercom.com/legal/privacy
                                        </a>
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Supabase (Authentication)</h4>
                                    <p className="text-sm text-slate-700 mb-2">
                                        We use Supabase for user authentication and account management. Supabase sets cookies to maintain
                                        your login session and remember your authentication status.
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        <strong>Privacy Policy:</strong>{' '}
                                        <a
                                            href="https://supabase.com/privacy"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-amber-600 hover:underline"
                                        >
                                            https://supabase.com/privacy
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 4: Cookie Duration */}
                        <section id="cookie-duration" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Settings className="h-8 w-8 text-amber-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">4. Cookie Duration</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                Cookies can be classified by how long they remain on your device:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-3">Session Cookies (Temporary)</h3>
                                    <p className="text-sm text-slate-700 mb-3">
                                        Session cookies are deleted automatically when you close your web browser. They are used to maintain
                                        your session as you navigate the website.
                                    </p>
                                    <p className="text-xs text-slate-600 font-semibold">Duration: Until browser is closed</p>
                                    <p className="text-xs text-slate-600 mt-2">
                                        <strong>Example:</strong> Authentication session cookie that keeps you logged in while browsing.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-3">Persistent Cookies (Long-Term)</h3>
                                    <p className="text-sm text-slate-700 mb-3">
                                        Persistent cookies remain on your device for a set period (specified in the cookie) or until you
                                        manually delete them. They are used to remember your preferences across visits.
                                    </p>
                                    <p className="text-xs text-slate-600 font-semibold">Duration: Days, weeks, months, or years</p>
                                    <p className="text-xs text-slate-600 mt-2">
                                        <strong>Example:</strong> "Remember Me" cookie that keeps you logged in for 30 days.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-amber-50 border-l-4 border-amber-600 p-6 rounded-r-lg mt-6">
                                <p className="text-slate-700 text-sm">
                                    <strong>Note:</strong> The exact duration of each cookie is listed in the detailed cookie table below (Section 5).
                                </p>
                            </div>
                        </section>

                        {/* Section 5: Detailed Cookie Table */}
                        <section id="cookie-table" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Cookie className="h-8 w-8 text-amber-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">5. Detailed Cookie Table</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                Below is a comprehensive list of all cookies used on our website:
                            </p>

                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-slate-200 rounded-lg text-sm">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-slate-900 border-b">Cookie Name</th>
                                            <th className="px-4 py-3 text-left font-semibold text-slate-900 border-b">Purpose</th>
                                            <th className="px-4 py-3 text-left font-semibold text-slate-900 border-b">Type</th>
                                            <th className="px-4 py-3 text-left font-semibold text-slate-900 border-b">Duration</th>
                                            <th className="px-4 py-3 text-left font-semibold text-slate-900 border-b">Provider</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {/* Essential Cookies */}
                                        <tr className="border-b bg-green-50">
                                            <td className="px-4 py-3 font-mono text-xs">sb-auth-token</td>
                                            <td className="px-4 py-3">Maintains your authentication session</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                                                    Essential
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">7 days</td>
                                            <td className="px-4 py-3">Supabase</td>
                                        </tr>
                                        <tr className="border-b bg-green-50">
                                            <td className="px-4 py-3 font-mono text-xs">_csrf</td>
                                            <td className="px-4 py-3">Protects against cross-site request forgery attacks</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                                                    Essential
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">Session</td>
                                            <td className="px-4 py-3">Voxanne AI</td>
                                        </tr>
                                        <tr className="border-b bg-green-50">
                                            <td className="px-4 py-3 font-mono text-xs">session_id</td>
                                            <td className="px-4 py-3">Maintains your session across page navigation</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                                                    Essential
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">Session</td>
                                            <td className="px-4 py-3">Voxanne AI</td>
                                        </tr>

                                        {/* Analytics Cookies */}
                                        <tr className="border-b bg-blue-50">
                                            <td className="px-4 py-3 font-mono text-xs">_ga</td>
                                            <td className="px-4 py-3">Distinguishes unique users for analytics</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                                    Analytics
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">2 years</td>
                                            <td className="px-4 py-3">Google Analytics</td>
                                        </tr>
                                        <tr className="border-b bg-blue-50">
                                            <td className="px-4 py-3 font-mono text-xs">_ga_XXXXXXXXXX</td>
                                            <td className="px-4 py-3">Persists session state for Google Analytics 4</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                                    Analytics
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">2 years</td>
                                            <td className="px-4 py-3">Google Analytics</td>
                                        </tr>
                                        <tr className="border-b bg-blue-50">
                                            <td className="px-4 py-3 font-mono text-xs">_gid</td>
                                            <td className="px-4 py-3">Distinguishes users for daily analytics</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                                    Analytics
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">24 hours</td>
                                            <td className="px-4 py-3">Google Analytics</td>
                                        </tr>

                                        {/* Functional Cookies */}
                                        <tr className="border-b bg-amber-50">
                                            <td className="px-4 py-3 font-mono text-xs">theme_preference</td>
                                            <td className="px-4 py-3">Remembers your dark/light mode preference</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
                                                    Functional
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">1 year</td>
                                            <td className="px-4 py-3">Voxanne AI</td>
                                        </tr>
                                        <tr className="border-b bg-amber-50">
                                            <td className="px-4 py-3 font-mono text-xs">language</td>
                                            <td className="px-4 py-3">Remembers your preferred language</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
                                                    Functional
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">1 year</td>
                                            <td className="px-4 py-3">Voxanne AI</td>
                                        </tr>

                                        {/* Third-Party Cookies */}
                                        <tr className="border-b bg-slate-50">
                                            <td className="px-4 py-3 font-mono text-xs">intercom-*</td>
                                            <td className="px-4 py-3">Maintains customer support chat history</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                                                    Functional
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">Varies</td>
                                            <td className="px-4 py-3">Intercom</td>
                                        </tr>
                                        <tr className="border-b bg-slate-50">
                                            <td className="px-4 py-3 font-mono text-xs">__stripe_*</td>
                                            <td className="px-4 py-3">Fraud prevention and secure payment processing</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                                                    Essential
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">Session</td>
                                            <td className="px-4 py-3">Stripe</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <p className="text-xs text-slate-600 mt-4 italic">
                                Note: This table is updated regularly as we add or remove cookies. Last updated: January 30, 2026.
                            </p>
                        </section>

                        {/* Section 6: Control Cookies */}
                        <section id="control-cookies" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Settings className="h-8 w-8 text-amber-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">6. How to Control Cookies</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                You have several options to control or limit how cookies are used on your device:
                            </p>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Option 1: Cookie Consent Banner</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                When you first visit our website, you'll see a cookie consent banner that allows you to accept or reject
                                non-essential cookies (analytics, marketing, functional). You can change your preferences at any time by
                                clicking the "Cookie Settings" link in the footer.
                            </p>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Option 2: Browser Settings</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Most web browsers allow you to control cookies through their settings. You can:
                            </p>
                            <ul className="space-y-2 text-slate-700 mb-4">
                                <li>• Block all cookies</li>
                                <li>• Block third-party cookies only</li>
                                <li>• Delete cookies after each browsing session</li>
                                <li>• Receive a notification before a cookie is set</li>
                            </ul>

                            <p className="text-slate-700 leading-relaxed mb-4">
                                Here are links to cookie settings for popular browsers:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                                <a
                                    href="https://support.google.com/chrome/answer/95647"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-slate-50 p-3 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-amber-600 hover:underline text-sm"
                                >
                                    Google Chrome Cookie Settings →
                                </a>
                                <a
                                    href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-slate-50 p-3 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-amber-600 hover:underline text-sm"
                                >
                                    Mozilla Firefox Cookie Settings →
                                </a>
                                <a
                                    href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-slate-50 p-3 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-amber-600 hover:underline text-sm"
                                >
                                    Apple Safari Cookie Settings →
                                </a>
                                <a
                                    href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-slate-50 p-3 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-amber-600 hover:underline text-sm"
                                >
                                    Microsoft Edge Cookie Settings →
                                </a>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Option 3: Opt-Out of Specific Services</h3>
                            <div className="space-y-3">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <p className="font-semibold text-slate-900 mb-2">Google Analytics Opt-Out</p>
                                    <p className="text-sm text-slate-700 mb-2">
                                        Install the Google Analytics Opt-Out Browser Add-On to prevent Google Analytics from collecting
                                        data about your website visits.
                                    </p>
                                    <a
                                        href="https://tools.google.com/dlpage/gaoptout"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-amber-600 hover:underline text-sm"
                                    >
                                        Download Google Analytics Opt-Out Add-On →
                                    </a>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <p className="font-semibold text-slate-900 mb-2">Digital Advertising Alliance Opt-Out</p>
                                    <p className="text-sm text-slate-700 mb-2">
                                        Opt out of personalized advertising from participating companies.
                                    </p>
                                    <a
                                        href="https://optout.aboutads.info/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-amber-600 hover:underline text-sm"
                                    >
                                        Visit DAA Opt-Out Page →
                                    </a>
                                </div>
                            </div>

                            <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-lg mt-6">
                                <div className="flex items-start gap-3">
                                    <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="font-semibold text-slate-900 mb-2">Important Note</p>
                                        <p className="text-slate-700 text-sm">
                                            Blocking or deleting essential cookies may prevent you from using certain features of our website,
                                            including logging in, accessing your dashboard, and processing payments. If you experience issues,
                                            try enabling cookies and clearing your browser cache.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 7: Do Not Track */}
                        <section id="do-not-track" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Eye className="h-8 w-8 text-amber-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">7. Do Not Track (DNT) Signals</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-4">
                                Some web browsers include a "Do Not Track" (DNT) feature that signals to websites that you do not want to
                                have your online activity tracked. Currently, there is no industry-wide standard for responding to DNT signals.
                            </p>

                            <p className="text-slate-700 leading-relaxed mb-4">
                                At this time, our website does not respond to DNT signals from browsers. However, you can use the cookie
                                consent banner or browser settings (described above) to control cookies.
                            </p>

                            <p className="text-slate-700 leading-relaxed">
                                We will monitor developments in DNT standards and may update our practices in the future.
                            </p>
                        </section>

                        {/* Section 8: Cookie Consent */}
                        <section id="cookie-consent" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <CheckCircle className="h-8 w-8 text-amber-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">8. Cookie Consent (EU/UK Users)</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-4">
                                Under the EU ePrivacy Directive (Cookie Law) and UK PECR, we are required to obtain your consent before
                                setting non-essential cookies on your device. Essential cookies (necessary for the website to function)
                                do not require consent.
                            </p>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">How We Obtain Consent</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                When you first visit our website from the EU or UK, you will see a cookie consent banner with the following options:
                            </p>
                            <ul className="space-y-2 text-slate-700 mb-6">
                                <li><strong>Accept All:</strong> Consent to all cookies (essential, analytics, functional, marketing)</li>
                                <li><strong>Reject Non-Essential:</strong> Only essential cookies will be set</li>
                                <li><strong>Customize:</strong> Choose which types of cookies you want to accept (analytics, functional, marketing)</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Changing Your Preferences</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                You can change your cookie preferences at any time by:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li>1. Clicking the "Cookie Settings" link in the footer of any page</li>
                                <li>2. Clearing your browser cookies (this will reset your preferences)</li>
                                <li>3. Using your browser's built-in cookie controls</li>
                            </ul>

                            <p className="text-slate-700 leading-relaxed mt-4">
                                Your consent preferences are stored for 12 months, after which you will be prompted again.
                            </p>
                        </section>

                        {/* Section 9: Updates */}
                        <section id="updates" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Settings className="h-8 w-8 text-amber-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">9. Updates to This Cookie Policy</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-4">
                                We may update this Cookie Policy from time to time to reflect changes in our use of cookies or legal
                                requirements. When we make material changes, we will:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li>• Update the "Last Updated" date at the top of this page</li>
                                <li>• Notify you via email (if you have an account with us)</li>
                                <li>• Display a banner on the website informing you of the changes</li>
                                <li>• Request renewed consent if required by law</li>
                            </ul>

                            <p className="text-slate-700 leading-relaxed mt-4">
                                We encourage you to review this Cookie Policy periodically to stay informed about how we use cookies.
                            </p>
                        </section>

                        {/* Section 10: Contact */}
                        <section id="contact" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Cookie className="h-8 w-8 text-amber-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">10. Contact Us</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                If you have any questions about this Cookie Policy or how we use cookies, please contact us:
                            </p>

                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                <p className="font-semibold text-slate-900 mb-4">Privacy Team</p>
                                <div className="space-y-2 text-slate-700">
                                    <p>
                                        <strong>Email:</strong>{' '}
                                        <a href="mailto:privacy@voxanne.ai" className="text-amber-600 hover:underline">
                                            privacy@voxanne.ai
                                        </a>
                                    </p>
                                    <p>
                                        <strong>Mailing Address:</strong><br />
                                        Voxanne AI<br />
                                        A product of Call Waiting AI Ltd.<br />
                                        Collage House, 2nd Floor<br />
                                        17 King Edward Road<br />
                                        Ruislip, London HA4 7AE<br />
                                        United Kingdom
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-slate-700">
                                    <strong>Related Policies:</strong> For more information about how we collect, use, and protect your
                                    personal data, please review our{' '}
                                    <Link href="/privacy" className="text-amber-600 hover:underline font-semibold">
                                        Privacy Policy
                                    </Link>{' '}
                                    and{' '}
                                    <Link href="/terms" className="text-amber-600 hover:underline font-semibold">
                                        Terms of Service
                                    </Link>
                                    .
                                </p>
                            </div>
                        </section>
                    </div>
                </div>

                {/* Back to Top */}
                <div className="text-center mt-8">
                    <a
                        href="#top"
                        className="text-amber-600 hover:text-amber-700 font-semibold hover:underline"
                    >
                        Back to Top ↑
                    </a>
                </div>
            </div>
        </div>
    );
}
