'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const steps = [
  {
    title: 'Welcome to SMALDA',
    description: 'Secure document management and verification platform powered by Stellar blockchain.',
  },
  {
    title: 'Upload Your First Document',
    description: 'Drag and drop any document to get started. Supported formats include PDF, DOCX, and images.',
  },
  {
    title: 'Verify & Analyze',
    description: 'Anchor your document hash on Stellar and run risk analysis to check for red flags.',
  },
  {
    title: 'Manage Disputes',
    description: 'File a dispute if you identify issues with a document and track resolution progress.',
  },
  {
    title: 'You\'re All Set!',
    description: 'Start exploring your dashboard. You can always revisit this guide from settings.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const current = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      router.push('/dashboard');
    }
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="flex justify-center gap-1 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-8 h-1.5 rounded-full transition-colors ${
                i <= step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-bold mb-3">{current.title}</h1>
        <p className="text-gray-600 mb-8">{current.description}</p>

        <div className="flex items-center justify-between">
          <button onClick={handleSkip} className="text-sm text-gray-500 hover:underline">
            Skip
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {step < steps.length - 1 ? 'Next' : 'Go to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
