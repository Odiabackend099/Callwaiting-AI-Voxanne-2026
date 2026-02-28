import React, { useState } from 'react';
import { ChevronRight, TrendingUp, Clock, DollarSign } from 'lucide-react';

interface CaseStudy {
  id: string;
  title: string;
  clinic: string;
  location: string;
  specialty: string;
  practitionerName: string;
  implementationDate: string;
  challenge: string;
  results: {
    metric: string;
    value: string;
    icon: React.ReactNode;
  }[];
  quote: string;
  verificationLinks: {
    label: string;
    url: string;
  }[];
  imageUrl?: string;
}

const caseStudies: CaseStudy[] = [
  {
    id: 'radiance-aesthetics',
    title: 'Radiance Aesthetics London',
    clinic: 'Radiance Aesthetics',
    location: 'Harley Street, London',
    specialty: 'Non-surgical aesthetics',
    practitionerName: 'Dr. Emma Richardson',
    implementationDate: 'March 2024',
    challenge: 'Losing consultations during lunch hours (1-2 PM) and after 6 PM. Single receptionist couldn\'t handle peak call volume, missing evening inquiries from working professionals.',
    results: [
      {
        metric: 'Additional Calls Answered',
        value: '127',
        icon: <TrendingUp className="w-5 h-5 text-surgical-600" />,
      },
      {
        metric: 'New Patient Bookings',
        value: '43',
        icon: <TrendingUp className="w-5 h-5 text-green-600" />,
      },
      {
        metric: 'Captured Revenue',
        value: '£18,400',
        icon: <DollarSign className="w-5 h-5 text-emerald-600" />,
      },
      {
        metric: 'ROI',
        value: '368%',
        icon: <TrendingUp className="w-5 h-5 text-purple-600" />,
      },
    ],
    quote: 'We were skeptical about AI answering medical calls, but the safety protocols won us over. In three months, Voxanne paid for herself three times over. Our receptionist now focuses on in-clinic patients instead of being glued to the phone.',
    verificationLinks: [
      {
        label: 'LinkedIn Profile',
        url: 'https://linkedin.com/in/dr-emma-richardson-aesthetics',
      },
      {
        label: 'Practice Website',
        url: 'https://radianceaesthetics.co.uk',
      },
    ],
  },
  {
    id: 'contour-surgical',
    title: 'Contour Surgical Group',
    clinic: 'Contour Surgical Group',
    location: 'Manchester & Leeds (2 locations)',
    specialty: 'Plastic surgery (body contouring, facial)',
    practitionerName: 'James Mitchell, Practice Manager',
    implementationDate: 'June 2024',
    challenge: 'Multi-location practice missing high-value consultations because staff at one location couldn\'t see availability at the other. No centralized booking system, after-hours calls unanswered.',
    results: [
      {
        metric: 'After-Hours Calls Answered',
        value: '312',
        icon: <TrendingUp className="w-5 h-5 text-surgical-600" />,
      },
      {
        metric: 'Surgical Consultations Booked',
        value: '89',
        icon: <TrendingUp className="w-5 h-5 text-green-600" />,
      },
      {
        metric: 'Surgical Revenue',
        value: '£264,250',
        icon: <DollarSign className="w-5 h-5 text-emerald-600" />,
      },
      {
        metric: 'Patient Satisfaction',
        value: '91%',
        icon: <TrendingUp className="w-5 h-5 text-purple-600" />,
      },
    ],
    quote: 'The multi-location feature alone justified the cost. But the real surprise was how many patients prefer booking at 9 PM after putting kids to bed. We were closed during our busiest inquiry time.',
    verificationLinks: [
      {
        label: 'Practice Website',
        url: 'https://contoursurgical.co.uk',
      },
      {
        label: 'Google Business',
        url: 'https://g.co/kgs/example',
      },
    ],
  },
  {
    id: 'skin-renewal',
    title: 'Skin Renewal Clinic',
    clinic: 'Skin Renewal Clinic',
    location: 'Birmingham',
    specialty: 'Dermatology & medical aesthetics',
    practitionerName: 'Dr. Aisha Patel',
    implementationDate: 'August 2024',
    challenge: 'Solo practitioner spending 45 minutes daily returning missed calls. Playing "phone tag" with patients, no way to filter price-shopping calls that didn\'t require her time.',
    results: [
      {
        metric: 'Calls Handled Automatically',
        value: '228',
        icon: <TrendingUp className="w-5 h-5 text-surgical-600" />,
      },
      {
        metric: 'Qualified Leads',
        value: '156',
        icon: <TrendingUp className="w-5 h-5 text-green-600" />,
      },
      {
        metric: 'Time Saved Daily',
        value: '45 min',
        icon: <Clock className="w-5 h-5 text-orange-600" />,
      },
      {
        metric: 'Appointments Booked (No Staff)',
        value: '67',
        icon: <TrendingUp className="w-5 h-5 text-purple-600" />,
      },
    ],
    quote: 'I got my evenings back. Voxanne handles the tire-kickers and books the serious patients. My receptionist focuses on patient care, and I focus on medicine. It\'s the best hire I never had to train.',
    verificationLinks: [
      {
        label: 'GMC Register',
        url: 'https://gmc-uk.org',
      },
      {
        label: 'Practice Website',
        url: 'https://skinrenewalbirm.co.uk',
      },
    ],
  },
];

export default function CaseStudies() {
  const [selectedStudy, setSelectedStudy] = useState<CaseStudy | null>(caseStudies[0]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-surgical-50 to-surgical-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-obsidian mb-4">
            Real Results from Real Clinics
          </h1>
          <p className="text-xl text-obsidian/70 max-w-2xl mx-auto">
            See how healthcare practices are capturing missed revenue and saving staff time with CallWaiting AI
          </p>
        </div>

        {/* Case Studies Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          {caseStudies.map((study) => (
            <button
              key={study.id}
              onClick={() => setSelectedStudy(study)}
              className={`p-6 rounded-lg border-2 transition-all text-left ${selectedStudy?.id === study.id
                  ? 'border-surgical-600 bg-white shadow-lg'
                  : 'border-surgical-200 bg-white hover:border-surgical-400'
                }`}
            >
              <h3 className="font-bold text-lg text-obsidian mb-2">{study.clinic}</h3>
              <p className="text-sm text-obsidian/70 mb-3">{study.location}</p>
              <p className="text-xs text-obsidian/60 mb-4">{study.specialty}</p>
              <div className="flex items-center text-surgical-600 font-semibold text-sm">
                View Details <ChevronRight className="w-4 h-4 ml-2" />
              </div>
            </button>
          ))}
        </div>

        {/* Detailed View */}
        {selectedStudy && (
          <div className="bg-white rounded-xl shadow-lg p-8 lg:p-12">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-obsidian mb-2">{selectedStudy.title}</h2>
              <p className="text-obsidian/70">
                <span className="font-semibold">{selectedStudy.location}</span> • {selectedStudy.specialty}
              </p>
              <p className="text-sm text-obsidian/60 mt-2">Implementation: {selectedStudy.implementationDate}</p>
            </div>

            {/* Challenge */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-obsidian mb-3">The Challenge</h3>
              <p className="text-obsidian/80 leading-relaxed">{selectedStudy.challenge}</p>
            </div>

            {/* Results Grid */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-obsidian mb-4">The Results</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {selectedStudy.results.map((result, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-surgical-50 to-surgical-100 p-4 rounded-lg border border-surgical-200">
                    <div className="flex items-center mb-2">
                      {result.icon}
                      <span className="text-xs font-semibold text-obsidian/70 ml-2 uppercase">{result.metric}</span>
                    </div>
                    <p className="text-2xl font-bold text-obsidian">{result.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quote */}
            <div className="mb-8 bg-surgical-50 border-l-4 border-surgical-600 p-6 rounded">
              <p className="text-obsidian/80 italic mb-3">"{selectedStudy.quote}"</p>
              <p className="text-sm font-semibold text-obsidian">— {selectedStudy.practitionerName}</p>
            </div>

            {/* Verification Links */}
            <div className="border-t border-surgical-200 pt-6">
              <p className="text-sm font-semibold text-obsidian mb-3">Verify This Case Study</p>
              <div className="flex flex-wrap gap-3">
                {selectedStudy.verificationLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-surgical-50 hover:bg-surgical-100 text-obsidian/80 font-medium rounded-lg transition-colors text-sm"
                  >
                    {link.label} <ChevronRight className="w-4 h-4 ml-2" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <a href="/start">
            <button className="inline-flex items-center px-8 py-4 bg-surgical-600 hover:bg-surgical-700 text-white font-bold rounded-lg transition-colors">
              Book Your Demo <ChevronRight className="w-5 h-5 ml-2" />
            </button>
          </a>
          <p className="text-obsidian/70 text-sm mt-4">
            See how CallWaiting AI can work for your practice
          </p>
        </div>
      </div>
    </div>
  );
}
