'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { UploadCloud, FileText, AlertCircle, CheckCircle2, Building2, ArrowLeft } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
}

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'tiff'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function DocumentUploadPage() {
  const router = useRouter();
  
  // Form & Interaction States
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  
  // Pipeline Operational States
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Hydrate available organizational context profiles
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch('/api/organizations');
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data);
        }
      } catch (err) {
        console.error('Failed to resolve organizational directory contexts:', err);
      }
    };
    fetchOrganizations();
  }, []);

  // 2. Client-Side Pre-flight Validation Gates
  const validateAndSetFile = (selectedFile: File) => {
    setErrorMessage(null);
    setUploadProgress(0);

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase() || '';
    
    // Validate Extension type boundaries
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      setErrorMessage(`Unsupported format. Permitted file types: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`);
      return;
    }

    // Validate Cryptographic payload capacity cap size (10MB)
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`Payload ceiling exceeded. Maximum file capacity limit is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setFile(selectedFile);
    // Auto-populate title if the field is empty
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  // 3. Drag and Drop Interaction Event Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  // 4. Axios Multi-Part Streaming Upload Dispatches
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || isUploading) return;

    setIsUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    if (selectedOrgId) {
      formData.append('organizationId', selectedOrgId);
    }

    try {
      const response = await axios.post('/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentage);
          }
        }
      });

      if (response.status === 200 || response.status === 201) {
        const targetDoc = response.data;
        // Redirect seamlessly to deep-linked analytical inspector logs
        router.push(`/documents/${targetDoc.id || targetDoc.documentId}`);
      }
    } catch (err: any) {
      const serverError = err.response?.data?.message || 'File ingestion transaction failed.';
      setErrorMessage(serverError);
      setUploadProgress(0); // Reset progress gauge so they can re-try cleanly
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
      
      {/* Upper Navigation Track Title Block */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.back()}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:text-white text-slate-400 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-white">Ingest New Land Document</h1>
          <p className="text-xs text-slate-400 mt-0.5">Submit files securely to launch real-time AI cross-validation and Stellar ledger pinning.</p>
        </div>
      </div>

      <form onSubmit={handleUploadSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CORE DRAG-AND-DROP FILE CAPTURE FIELD (Left 2-columns) */}
        <div className="md:col-span-2 space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[280px] ${
              dragActive ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".pdf,.png,.jpg,.jpeg,.tiff"
              className="hidden"
              disabled={isUploading}
            />

            <UploadCloud size={44} className={`mb-4 transition-transform ${isUploading ? 'text-blue-500 animate-pulse scale-90' : 'text-slate-600 group-hover:text-slate-400'}`} />
            
            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-white max-w-xs truncate">{file.name}</p>
                <p className="text-[11px] text-slate-500 font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-300">Drag & drop your land document file here</p>
                <p className="text-xs text-slate-500">or click to browse local directories</p>
              </div>
            )}

            {/* Validation Constraints Tracker Badge Row */}
            <div className="mt-8 flex flex-wrap gap-4 items-center justify-center text-[10px] font-semibold text-slate-500 border-t border-slate-900 pt-4 w-full">
              <span>Formats: PDF, PNG, JPEG, TIFF</span>
              <div className="w-1 h-1 rounded-full bg-slate-800" />
              <span>Max Capacity Size: 10MB</span>
            </div>
          </div>

          {/* AXIOS PROGRESS MONITOR BAR CONTAINER */}
          {isUploading && (
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 animate-fade-in">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-blue-400 flex items-center gap-1.5">
                  <FileText size={14} className="animate-spin" /> Streaming file bits to ingest gateway...
                </span>
                <span className="font-mono text-white">{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-150 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* SYSTEM FAILURE INTERCEPT ANOMALIES */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-950/20 border border-rose-900/50 rounded-xl text-xs text-rose-400 animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Validation Gate Catch Block:</span>
                <span className="text-slate-400 mt-0.5 block">{errorMessage}</span>
              </div>
            </div>
          )}
        </div>

        {/* METADATA TARGET CONFIGURATIONS (Right Column) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 h-fit">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Metadata Overrides</h3>
          
          {/* Title Override Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Custom Document Name</label>
            <input
              type="text"
              placeholder="Defaults to filename if blank..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              disabled={isUploading}
            />
          </div>

          {/* Context Organization Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Assign Context Organization</label>
            <div className="relative">
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
                disabled={isUploading || organizations.length === 0}
              >
                <option value="">Personal Storage Account</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 w-3.5 h-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Form Action Submissions */}
          <button
            type="submit"
            disabled={!file || isUploading}
            className={`w-full py-2.5 rounded-lg text-xs font-bold text-white transition-all shadow-md mt-2 flex items-center justify-center gap-1.5 ${
              (!file || isUploading)
                ? 'bg-slate-800 text-slate-500 border border-slate-800/40 cursor-not-allowed shadow-none'
                : 'bg-blue-600 hover:bg-blue-500 active:scale-98'
            }`}
          >
            {isUploading ? 'Processing Pipeline...' : 'Initialize Analysis Sequence'}
          </button>
        </div>
      </form>
    </div>
  );
}