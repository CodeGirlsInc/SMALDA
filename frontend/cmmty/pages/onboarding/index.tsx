"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../components/Button";

const steps = [
  {
    title: "Welcome to SMALDA",
    body:
      "This onboarding guide will help you register your first document, understand risk assessment, and learn how Stellar verification works.",
  },
  {
    title: "Upload your first document",
    body:
      "Select a document to begin. We will use this document to demonstrate how parcel verification and risk analysis works in SMALDA.",
  },
  {
    title: "Understand risk assessment",
    body:
      "Our system checks your document for potential issues like boundary disputes, duplicate claims, and permit expirations. This helps protect your land rights.",
  },
  {
    title: "Stellar verification explained",
    body:
      "After upload, your document is anchored on the Stellar network. The transaction hash is a unique proof of timestamp and validity.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem("smalda_onboarding_completed");
    if (completed === "true") {
      router.push("/dashboard");
    } else {
      setIsReady(true);
    }
  }, [router]);

  const handleFilePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
    }
  };

  const advance = () => {
    if (step === steps.length - 1) {
      localStorage.setItem("smalda_onboarding_completed", "true");
      router.push("/dashboard");
      return;
    }
    setStep((current) => current + 1);
  };

  const skip = () => {
    localStorage.setItem("smalda_onboarding_completed", "true");
    router.push("/dashboard");
  };

  const goBack = () => {
    setStep((current) => Math.max(0, current - 1));
  };

  const activeStep = steps[step];

  if (!isReady) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Onboarding</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Get started with your first document</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={skip}>
            Skip onboarding
          </Button>
        </div>

        <div className="mt-8 flex flex-col gap-8 md:flex-row">
          <aside className="space-y-4 md:w-1/3">
            {steps.map((item, index) => (
              <div
                key={item.title}
                className={`rounded-3xl border p-4 text-sm ${
                  index === step
                    ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <p className="font-semibold">Step {index + 1}</p>
                <p className="mt-2">{item.title}</p>
              </div>
            ))}
          </aside>

          <section className="md:w-2/3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-slate-900">{activeStep.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">{activeStep.body}</p>

              {step === 1 && (
                <div className="mt-6 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Upload document</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFilePick}
                    className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  {fileName ? (
                    <p className="text-sm text-slate-600">Selected file: {fileName}</p>
                  ) : (
                    <p className="text-sm text-slate-500">Choose a file to continue.</p>
                  )}
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <Button variant="secondary" size="sm" onClick={goBack} disabled={step === 0}>
                    Back
                  </Button>
                  <Button variant="primary" size="sm" onClick={advance}>
                    {step === steps.length - 1 ? "Finish" : "Next"}
                  </Button>
                </div>
                <p className="text-sm text-slate-500">Step {step + 1} of {steps.length}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
