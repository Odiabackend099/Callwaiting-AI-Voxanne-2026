import { Metadata } from "next";
import { Mail, Phone, MapPin, Clock, Send } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Contact Us - Voxanne AI",
  description: "Get in touch with Voxanne AI. Contact our support team or schedule a demo.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
            Get in Touch
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Have questions about Voxanne AI? We're here to help. Send us a message or reach out directly.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="border border-slate-200 rounded-3xl p-8 md:p-10 bg-white">
            <h2 className="text-2xl font-bold text-navy-900 mb-6">Send us a message</h2>

            <form className="space-y-6">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  placeholder="Dr. Sarah Johnson"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-surgical-600 focus:ring-2 focus:ring-surgical-600/20 focus:outline-none transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  placeholder="sarah@clinic.com"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-surgical-600 focus:ring-2 focus:ring-surgical-600/20 focus:outline-none transition-colors"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-surgical-600 focus:ring-2 focus:ring-surgical-600/20 focus:outline-none transition-colors"
                />
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-slate-700 mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <select
                  id="subject"
                  name="subject"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-surgical-600 focus:ring-2 focus:ring-surgical-600/20 focus:outline-none transition-colors"
                >
                  <option value="">Select a topic...</option>
                  <option value="demo">Schedule a Demo</option>
                  <option value="sales">Sales Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="billing">Billing Question</option>
                  <option value="partnership">Partnership Opportunity</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-slate-700 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  placeholder="Tell us about your practice and how we can help..."
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-surgical-600 focus:ring-2 focus:ring-surgical-600/20 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-surgical-600 text-white font-semibold hover:bg-surgical-700 transition-colors"
              >
                <Send className="w-5 h-5" />
                Send Message
              </button>

              <p className="text-sm text-slate-500 text-center">
                We'll respond within 24 hours during business days.
              </p>
            </form>
          </div>

          {/* Contact Information */}
          <div className="space-y-8">
            {/* Office Info */}
            <div className="border border-slate-200 rounded-3xl p-8 bg-gradient-to-br from-surgical-50 to-white">
              <h2 className="text-2xl font-bold text-navy-900 mb-6">Contact Information</h2>

              <div className="space-y-6">
                {/* Email */}
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-surgical-100 border border-surgical-600/20">
                    <Mail className="w-6 h-6 text-surgical-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy-900 mb-1">Email</h3>
                    <a
                      href="mailto:support@voxanne.ai"
                      className="text-slate-600 hover:text-surgical-600 transition-colors"
                    >
                      support@voxanne.ai
                    </a>
                    <p className="text-sm text-slate-500 mt-1">For general inquiries</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-surgical-100 border border-surgical-600/20">
                    <Phone className="w-6 h-6 text-surgical-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy-900 mb-1">Phone</h3>
                    <a
                      href="tel:+447424038250"
                      className="text-slate-600 hover:text-surgical-600 transition-colors"
                    >
                      +44 7424 038250
                    </a>
                    <p className="text-sm text-slate-500 mt-1">Available 24/7 for critical issues</p>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-surgical-100 border border-surgical-600/20">
                    <MapPin className="w-6 h-6 text-surgical-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy-900 mb-1">Office</h3>
                    <address className="text-slate-600 not-italic">
                      Collage House, 2nd Floor<br />
                      17 King Edward Road<br />
                      Ruislip, London HA4 7AE<br />
                      United Kingdom
                    </address>
                  </div>
                </div>

                {/* Hours */}
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-surgical-100 border border-surgical-600/20">
                    <Clock className="w-6 h-6 text-surgical-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy-900 mb-1">Business Hours</h3>
                    <div className="text-slate-600 space-y-1">
                      <p>Monday - Friday: 9:00 AM - 6:00 PM GMT</p>
                      <p>Saturday - Sunday: Emergency support only</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="border border-slate-200 rounded-3xl p-8 bg-white">
              <h3 className="text-xl font-bold text-navy-900 mb-4">Looking for something specific?</h3>
              <div className="space-y-3">
                <a
                  href="/support"
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <span className="text-slate-700 group-hover:text-surgical-600">Technical Support</span>
                  <span className="text-slate-400 group-hover:text-surgical-600">→</span>
                </a>
                <a
                  href="/contact-sales"
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <span className="text-slate-700 group-hover:text-surgical-600">Sales Inquiry</span>
                  <span className="text-slate-400 group-hover:text-surgical-600">→</span>
                </a>
                <a
                  href="/demo-workflow"
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <span className="text-slate-700 group-hover:text-surgical-600">Schedule a Demo</span>
                  <span className="text-slate-400 group-hover:text-surgical-600">→</span>
                </a>
                <a
                  href="mailto:security@voxanne.ai"
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <span className="text-slate-700 group-hover:text-surgical-600">Report Security Issue</span>
                  <span className="text-slate-400 group-hover:text-surgical-600">→</span>
                </a>
              </div>
            </div>

            {/* Additional Contacts */}
            <div className="bg-navy-900 rounded-3xl p-8 text-white">
              <h3 className="text-xl font-bold mb-4">Other Contacts</h3>
              <div className="space-y-3 text-sm">
                <p>
                  <strong className="text-slate-300">Security:</strong>{" "}
                  <a href="mailto:security@voxanne.ai" className="hover:text-surgical-400 transition-colors">
                    security@voxanne.ai
                  </a>
                </p>
                <p>
                  <strong className="text-slate-300">Careers:</strong>{" "}
                  <a href="mailto:careers@voxanne.ai" className="hover:text-surgical-400 transition-colors">
                    careers@voxanne.ai
                  </a>
                </p>
                <p>
                  <strong className="text-slate-300">Privacy:</strong>{" "}
                  <a href="mailto:privacy@voxanne.ai" className="hover:text-surgical-400 transition-colors">
                    privacy@voxanne.ai
                  </a>
                </p>
                <p>
                  <strong className="text-slate-300">Press:</strong>{" "}
                  <a href="mailto:press@voxanne.ai" className="hover:text-surgical-400 transition-colors">
                    press@voxanne.ai
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Map Section (Optional) */}
        <div className="mt-16 border border-slate-200 rounded-3xl overflow-hidden">
          <div className="bg-slate-100 h-96 flex items-center justify-center">
            <div className="text-center text-slate-500">
              <MapPin className="w-12 h-12 mx-auto mb-3" />
              <p className="text-sm">Map view coming soon</p>
              <p className="text-xs mt-1">17 King Edward Road, Ruislip, London HA4 7AE, UK</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
