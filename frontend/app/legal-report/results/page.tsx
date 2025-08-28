import React from "react";
import { mockDocAnalysisResult } from "@/lib/mockDocAnalysisResult";

export default function ResultsPage() {
  const { parties, landLocation, legalTerms, extractedText, summary } = mockDocAnalysisResult;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Document Analysis Results</h1>
      <section className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Summary</h2>
        <p className="text-gray-700">{summary}</p>
      </section>
      <section className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Parties Involved</h2>
        <ul className="list-disc list-inside text-gray-700">
          {parties.map((party, idx) => (
            <li key={idx}>{party}</li>
          ))}
        </ul>
      </section>
      <section className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Land Location</h2>
        <p className="text-gray-700">{landLocation}</p>
      </section>
      <section className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Legal Terms Detected</h2>
        <ul className="flex flex-wrap gap-2">
          {legalTerms.map((term, idx) => (
            <li key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{term}</li>
          ))}
        </ul>
      </section>
      <section className="bg-white rounded shadow p-4 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-2">Extracted Text</h2>
        <pre className="whitespace-pre-wrap text-gray-700 bg-gray-50 p-2 rounded text-sm">{extractedText}</pre>
      </section>
    </div>
  );
}
