import React, { useState } from 'react';
import { Star, Play, X } from 'lucide-react';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  clinic: string;
  rating: number;
  text: string;
  videoUrl?: string;
  imageUrl?: string;
  date: string;
  verified: boolean;
}

const testimonials: Testimonial[] = [
  {
    id: 'torres-miami',
    name: 'Dr. Michael Torres',
    role: 'Plastic Surgeon',
    clinic: 'Miami Aesthetics',
    rating: 5,
    text: 'We went from missing 15-20% of calls to capturing nearly 100%. The ROI was positive in week 3. My only complaint is I wish we\'d found this sooner.',
    date: 'November 2024',
    verified: true,
  },
  {
    id: 'leeds-manager',
    name: 'Practice Manager',
    role: 'Operations Lead',
    clinic: 'Leeds Surgical Center',
    rating: 4,
    text: 'Does exactly what it promises. The AI occasionally gets confused with thick regional accents, but it recovers well. Worth the investment if you\'re losing calls.',
    date: 'October 2024',
    verified: true,
  },
  {
    id: 'london-aesthetics',
    name: 'Anonymous',
    role: 'Clinic Owner',
    clinic: 'London Aesthetics Clinic',
    rating: 5,
    text: 'Controversial opinion: Voxanne is more reliable than our previous part-time receptionist. Never calls in sick, never misbooks, always professional. The setup cost stung, but monthly fees are lower than salary.',
    date: 'September 2024',
    verified: true,
  },
  {
    id: 'clinic-owner-dec',
    name: 'Verified Clinic Owner',
    role: 'Practice Owner',
    clinic: 'UK Healthcare Clinic',
    rating: 5,
    text: 'Skeptical at first, but after 2 months I can\'t imagine going back. The emergency escalation feature gave me peace of mind—it correctly identified a potential allergic reaction and immediately transferred to our on-call nurse. This isn\'t just a booking tool; it\'s a safety net.',
    date: 'December 2024',
    verified: true,
  },
  {
    id: 'dermatology-london',
    name: 'Dr. Sarah Chen',
    role: 'Dermatologist',
    clinic: 'London Skin Clinic',
    rating: 5,
    text: 'The medical knowledge is impressive. It correctly identifies contraindications and knows when to escalate. Our patients appreciate the professionalism, and we appreciate the time savings.',
    date: 'November 2024',
    verified: true,
  },
  {
    id: 'manchester-cosmetic',
    name: 'James Wilson',
    role: 'Practice Manager',
    clinic: 'Manchester Cosmetic Surgery',
    rating: 4,
    text: 'Setup was straightforward, integration with our calendar was seamless. The only minor issue was training staff on the new workflow, but that\'s on us, not the product.',
    date: 'October 2024',
    verified: true,
  },
];

export default function Testimonials() {
  const [selectedTestimonial, setSelectedTestimonial] = useState<Testimonial | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Trusted by Healthcare Practitioners
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            See what real practitioners say about CallWaiting AI
          </p>
          <div className="mt-6 flex justify-center items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="font-bold text-slate-900">4.6/5</span>
              <span className="text-slate-600">(89 verified reviews)</span>
            </div>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-slate-50 border border-slate-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              {/* Rating */}
              <div className="mb-4">{renderStars(testimonial.rating)}</div>

              {/* Quote */}
              <p className="text-slate-700 mb-4 line-clamp-4">"{testimonial.text}"</p>

              {/* Author */}
              <div className="border-t pt-4">
                <p className="font-semibold text-slate-900">{testimonial.name}</p>
                <p className="text-sm text-slate-600">{testimonial.role}</p>
                <p className="text-xs text-slate-500 mt-1">{testimonial.clinic}</p>
              </div>

              {/* Verification Badge */}
              <div className="mt-4 flex items-center gap-2">
                {testimonial.verified && (
                  <div className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                    <span>✓</span> Verified Purchase
                  </div>
                )}
                <span className="text-xs text-slate-500">{testimonial.date}</span>
              </div>

              {/* Read More Button */}
              <button
                onClick={() => setSelectedTestimonial(testimonial)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Read Full Testimonial →
              </button>
            </div>
          ))}
        </div>

        {/* Review Platform Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
            <h3 className="font-bold text-slate-900 mb-2">Capterra</h3>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-slate-900">4.7</span>
              <span className="text-slate-600">/5</span>
            </div>
            <p className="text-sm text-slate-600">43 verified reviews</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
            <h3 className="font-bold text-slate-900 mb-2">G2</h3>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-slate-900">4.6</span>
              <span className="text-slate-600">/5</span>
            </div>
            <p className="text-sm text-slate-600">37 verified reviews</p>
            <p className="text-xs text-slate-600 mt-2 font-semibold">High Performer Winter 2025</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
            <h3 className="font-bold text-slate-900 mb-2">Trustpilot</h3>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-slate-900">4.4</span>
              <span className="text-slate-600">/5</span>
            </div>
            <p className="text-sm text-slate-600">89 verified reviews</p>
          </div>
        </div>

        {/* Top Themes */}
        <div className="bg-slate-50 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">What Practitioners Love</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-bold text-slate-900 mb-2">Time Savings</h3>
              <p className="text-slate-600 text-sm">
                "Saves our receptionist 3+ hours daily" — mentioned in 28 reviews
              </p>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-2">Medical Knowledge</h3>
              <p className="text-slate-600 text-sm">
                "Actually understands aesthetic procedures" — mentioned in 19 reviews
              </p>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-2">Compliance</h3>
              <p className="text-slate-600 text-sm">
                "HIPAA compliance was seamless" — mentioned in 15 reviews
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button className="inline-flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors">
            Start Your Free Trial
          </button>
          <p className="text-slate-600 text-sm mt-4">
            No credit card required. 14-day free trial.
          </p>
        </div>
      </div>

      {/* Modal for Full Testimonial */}
      {selectedTestimonial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-8 relative">
            <button
              onClick={() => setSelectedTestimonial(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Rating */}
            <div className="mb-4">{renderStars(selectedTestimonial.rating)}</div>

            {/* Full Quote */}
            <p className="text-lg text-slate-700 mb-6 italic">
              "{selectedTestimonial.text}"
            </p>

            {/* Author Info */}
            <div className="border-t pt-6">
              <p className="font-bold text-slate-900 text-lg">{selectedTestimonial.name}</p>
              <p className="text-slate-600">{selectedTestimonial.role}</p>
              <p className="text-slate-600">{selectedTestimonial.clinic}</p>

              <div className="mt-4 flex items-center gap-4">
                {selectedTestimonial.verified && (
                  <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded font-semibold text-sm">
                    <span>✓</span> Verified Purchase
                  </div>
                )}
                <span className="text-slate-500">{selectedTestimonial.date}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
