'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, ShieldCheck, UploadCloud, AlertCircle, 
  CheckCircle2, Clock, FileText, ChevronRight, ChevronLeft 
} from 'lucide-react';

const ONBOARDING_STORAGE_KEY = 'smalda:onboarding:completed';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // 1. Check eligibility criteria: show only for accounts < 24h old with 0 documents
  useEffect(() => {
    const checkOnboardingEligibility = async () => {
      const isCompleted = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (isCompleted === 'true') {
        router.replace('/dashboard');
        return;
      }

      try {
        // Fetch current user details and document counts from your API services
        const [userRes, docsRes] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/documents')
        ]);

        if (userRes.ok && docsRes.ok) {
          const user = await userRes.json();
          const docs = await docsRes.json();

          const accountCreatedTime = new Date(user.createdAt).getTime();
          const oneDayInMs = 24 * 60 * 60 * 1000;
          const isNewAccount = (Date.now() - accountCreatedTime) < oneDayInMs;
          const hasZeroDocs = docs.length === 0;

          // Bypass onboarding if they aren't a new user or already have historical assets
          if (!isNewAccount || !hasZeroDocs) {
            completeOnboarding();
          }
        }
      } catch (err) {
        console.error('Failed to verify onboarding eligibility barriers:', err);
      }
    };

    checkOnboardingEligibility();
  }, [router]);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    router.push('/dashboard');
  }, [router]);

  // 2. Step 2 Drag and Drop Event Interceptors
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadDocument(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadDocument(e.target.files[0]);
    }
  };

  // 3. API Upload Connection
  const uploadDocument = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload transaction declined by endpoint.');

      // Advance to next step once file is processed
      setCurrentStep(3);
    } catch (err: any) {
      setUploadError(err.message || 'Something went wrong during ingestion.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 max-w-2xl mx-auto">
      {/* Upper Progress Banner Header */}
      <header className="flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="text-blue-500 w-5 h-5" />
          <span className="font-bold tracking-wider text-sm">SMALDA Onboarding</span>
        </div>
        <button 
          onClick={completeOnboarding}
          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          Skip Guide
        </button>
      </header>

      {/* Main Multi-step Sliding Track Window */}
      <main className="my-auto py-8">
        
        {/* STEP 1: WELCOME INFO */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-extrabold text-white">Welcome to SMALDA</h1>
            <p className="text-slate-400 leading-relaxed text-sm">
              SMALDA bridges the gap between documents and secure evaluation data metrics. Let's unpack the core underlying engine pipelines in plain language:
            </p>
            <div className="grid gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex gap-4">
                <Sparkles className="text-blue-400 shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-white text-sm">Automated AI Risk Scoring</h4>
                  <p className="text-xs text-slate-400 mt-1">Our engine scans uploaded documents for validation anomalies, assigning contextual threat markers automatically.</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex gap-4">
                <ShieldCheck className="text-emerald-400 shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-white text-sm">Stellar Blockchain Verification</h4>
                  <p className="text-xs text-slate-400 mt-1">A unique cryptographic fingerprint of your file is anchored onto the Stellar ledger to lock proof-of-authenticity permanently.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: DRAG & DROP UPLOAD */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-white">Upload Your First File</h1>
              <p className="text-slate-400 text-sm mt-1">Kickstart system tracking by submitting an analysis target document.</p>
            </div>

            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${
                dragActive ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <input 
                id="file-upload-input"
                type="file" 
                className="hidden" 
                onChange={handleFileInput}
                disabled={isUploading}
              />
              <UploadCloud size={40} className={isUploading ? "text-blue-400 animate-bounce" : "text-slate-600"} />
              <label 
                htmlFor="file-upload-input" 
                className="mt-4 text-sm font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                {isUploading ? 'Ingesting document...' : 'Click to select file'}
              </label>
              <p className="text-xs text-slate-500 mt-1">or drag and drop your file boundary box here</p>

              {uploadError && (
                <div className="mt-4 flex items-center gap-2 text-xs text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-900">
                  <AlertCircle size={14} />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: STATUS MAP DEFINITIONS */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-white">Understanding Tracking Statuses</h1>
              <p className="text-slate-400 text-sm mt-1">Here is how to monitor document evaluation files across their lifecycle pipelines:</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex gap-2">
                <Clock className="text-amber-500 shrink-0" size={16} />
                <div>
                  <span className="font-bold text-white block">PENDING</span>
                  <span className="text-slate-400">File is securely queued.</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex gap-2">
                <FileText className="text-blue-400 shrink-0" size={16} />
                <div>
                  <span className="font-bold text-white block">ANALYZING</span>
                  <span className="text-slate-400">AI engines evaluating file parameters.</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex gap-2">
                <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
                <div>
                  <span className="font-bold text-white block">VERIFIED</span>
                  <span className="text-slate-400">Cryptographic proof verified on Stellar.</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex gap-2">
                <AlertCircle className="text-rose-500 shrink-0" size={16} />
                <div>
                  <span className="font-bold text-white block">FLAGGED</span>
                  <span className="text-slate-400">Risk indicators exceeded threshold lines.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: COMPLETE */}
        {currentStep === 4 && (
          <div className="text-center space-y-4 py-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="text-emerald-400" size={24} />
            </div>
            <h1 className="text-2xl font-extrabold text-white">Setup Complete!</h1>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              Your tracking onboarding is finished. You are ready to open your analytics command matrix dashboard.
            </p>
          </div>
        )}
      </main>

      {/* Footer Controls & Navigation Step Gauges */}
      <footer className="pt-4 border-t border-slate-800 flex items-center justify-between">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((step) => (
            <div 
              key={step} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step === currentStep ? 'w-6 bg-blue-500' : 'w-2 bg-slate-800'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {currentStep > 1 && currentStep < 4 && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-900 transition-colors"
            >
              <ChevronLeft size={14} /> Back
            </button>
          )}

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={currentStep === 2} // Force them to execute or skip to unlock normal tracks
              className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all ${
                currentStep === 2 
                  ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 shadow-md'
              }`}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={completeOnboarding}
              className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white rounded-lg shadow-md transition-all"
            >
              Enter Dashboard
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}