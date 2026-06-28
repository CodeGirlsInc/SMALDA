'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Search, Filter, SlidersHorizontal, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, Eye, CheckCircle, Archive, Download, Trash2 
} from 'lucide-react';

interface DocumentItem {
  id: string;
  name: string;
  status: 'PENDING' | 'ANALYZING' | 'VERIFIED' | 'FLAGGED' | 'REJECTED';
  riskScore: number;
  createdAt: string;
}

export default function DocumentsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 1. Synchronized URL Search Param States
  const queryParam = searchParams?.get('q') || '';
  const statusParam = searchParams?.get('status') || 'ALL';
  const sortParam = searchParams?.get('sort') || 'newest';
  const pageParam = parseInt(searchParams?.get('page') || '1', 10);
  const riskParam = parseInt(searchParams?.get('maxRisk') || '100', 10);

  // Local state mirrors for smooth input interaction
  const [searchInput, setSearchInput] = useState(queryParam);
  const [riskSlider, setRiskSlider] = useState(riskParam);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const limit = 10;
  const totalPages = Math.ceil(totalDocs / limit) || 1;

  // 2. Centralized State Parameter Ingestion Engine
  const updateQueryParams = useCallback((updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    Object.entries(updates).forEach(([key, value]) => {
      if (value === 'ALL' || value === '' || (key === 'page' && value === 1)) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    router.push(`?${params.toString()}`);
  }, [searchParams, router]);

  // 3. 300ms Search Input Debounce Effect Hook
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== queryParam) {
        updateQueryParams({ q: searchInput, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, queryParam, updateQueryParams]);

  // 4. REST Data Layer Collection Ingestion Matrix
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      // Constructs the standard request query matching active filter params
      const endpoint = queryParam ? `/api/documents/search?q=${encodeURIComponent(queryParam)}&` : '/api/documents?';
      const queryString = new URLSearchParams({
        status: statusParam,
        sort: sortParam,
        page: String(pageParam),
        limit: String(limit),
        maxRisk: String(riskParam)
      }).toString();

      const response = await fetch(`${endpoint}${queryString}`);
      if (response.ok) {
        const data = await response.json();
        // Adjust array properties based on whether your API wraps data inside a meta envelope
        setDocuments(data.items || data);
        setTotalDocs(data.total || data.length);
      }
    } catch (error) {
      console.error('Failed to resolve document collections:', error);
    } finally {
      setIsLoading(false);
    }
  }, [queryParam, statusParam, sortParam, pageParam, riskParam]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // 5. Bulk Operation Command Dispatches
  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === documents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(documents.map(d => d.id));
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    try {
      await fetch('/api/documents/bulk-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      fetchDocuments();
    } catch (err) {
      console.error('Bulk archival operation failed:', err);
    }
  };

  const handleVerifyTrigger = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}/verify`, { method: 'POST' });
      if (response.ok) fetchDocuments();
    } catch (err) {
      console.error('Manual validation initialization dropped:', err);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-6">
      
      {/* Upper Management Summary Metadata Context Banner */}
      <div>
        <h1 className="text-2xl font-extrabold text-white">Document Repository Matrix</h1>
        <p className="text-xs text-slate-400 mt-1">Audit, monitor, filter, and anchor your enterprise security asset indices.</p>
      </div>

      {/* COMPACT CONFIGURATION CONTROL FILTER GRID */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Live Search Input wrapper */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text"
              placeholder="Search by text index name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-200 transition-colors"
            />
          </div>

          {/* Status lifecycle options */}
          <div className="relative">
            <select
              value={statusParam}
              onChange={(e) => updateQueryParams({ status: e.target.value, page: 1 })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-300 appearance-none cursor-pointer"
            >
              <option value="ALL">All Status Tracking States</option>
              <option value="PENDING">PENDING</option>
              <option value="ANALYZING">ANALYZING</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="FLAGGED">FLAGGED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5 pointer-events-none" />
          </div>

          {/* Sorting parameter filters */}
          <div className="relative">
            <select
              value={sortParam}
              onChange={(e) => updateQueryParams({ sort: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-300 appearance-none cursor-pointer"
            >
              <option value="newest">Ingestion: Newest First</option>
              <option value="oldest">Ingestion: Oldest First</option>
              <option value="highest_risk">Threat Level: Highest Risk</option>
              <option value="lowest_risk">Threat Level: Lowest Risk</option>
            </select>
            <SlidersHorizontal className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5 pointer-events-none" />
          </div>

          {/* Threat Range Slider wrapper */}
          <div className="flex flex-col justify-center px-2">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase mb-1">
              <span>Max Allowed Risk</span>
              <span className="font-mono text-blue-400">{riskSlider}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100"
              value={riskSlider}
              onChange={(e) => setRiskSlider(parseInt(e.target.value, 10))}
              onMouseUp={() => updateQueryParams({ maxRisk: riskSlider, page: 1 })}
              onTouchEnd={() => updateQueryParams({ maxRisk: riskSlider, page: 1 })}
              className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        {/* BULK ACTION INTERCEPTOR BAR */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 bg-blue-950/20 border border-blue-900/50 px-4 py-2 rounded-lg text-xs animate-fade-in">
            <span className="font-bold text-blue-300">{selectedIds.length} items flagged for execution</span>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <button onClick={handleBulkArchive} className="flex items-center gap-1.5 text-slate-300 hover:text-white font-semibold transition-colors">
              <Archive size={14} /> Bulk Archive
            </button>
            <button className="flex items-center gap-1.5 text-slate-300 hover:text-white font-semibold transition-colors">
              <Download size={14} /> Download ZIP
            </button>
          </div>
        )}
      </div>

      {/* INTERACTIVE COMPONENT REPOSITORY DATA FRAME TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-xs text-slate-500 font-semibold tracking-wide">Syncing data ledger tracking states...</div>
        ) : documents.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <p className="text-sm font-bold text-slate-400">No matching tracking registries found</p>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">Adjust query parameter scopes or filter parameters to locate the target metrics.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                  <th className="py-3.5 px-4 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === documents.length} 
                      onChange={handleSelectAll}
                      className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                    />
                  </th>
                  <th className="py-3.5 px-2">Asset Name</th>
                  <th className="py-3.5 px-2">Lifecycle Status</th>
                  <th className="py-3.5 px-2">Risk Score</th>
                  <th className="py-3.5 px-2">Ingestion Timestamp</th>
                  <th className="py-3.5 px-4 text-right">Operational Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-medium text-slate-300">
                {documents.map((doc) => (
                  <tr key={doc.id} className={`hover:bg-slate-800/20 transition-colors ${selectedIds.includes(doc.id) ? 'bg-blue-950/5' : ''}`}>
                    <td className="py-3 px-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(doc.id)} 
                        onChange={() => handleSelectRow(doc.id)}
                        className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                      />
                    </td>
                    <td className="py-3 px-2 text-white font-bold truncate max-w-[200px]">{doc.name}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border uppercase ${
                        doc.status === 'VERIFIED' ? 'bg-emerald-950/40 border-emerald-900 text-emerald-400' :
                        doc.status === 'FLAGGED' ? 'bg-rose-950/40 border-rose-900 text-rose-400' :
                        doc.status === 'REJECTED' ? 'bg-slate-800 border-slate-700 text-slate-400' :
                        'bg-amber-950/40 border-amber-900 text-amber-400 animate-pulse'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className={`py-3 px-2 font-mono font-bold ${doc.riskScore <= 30 ? 'text-emerald-500' : doc.riskScore <= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                      {doc.riskScore}%
                    </td>
                    <td className="py-3 px-2 text-slate-400">
                      {new Date(doc.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </td>
                    <td className="py-3 px-4 text-right flex items-center justify-end gap-2.5">
                      <button title="Inspect Details" className="p-1 text-slate-400 hover:text-white transition-colors">
                        <Eye size={15} />
                      </button>
                      {doc.status === 'PENDING' && (
                        <button title="Invoke Verification" onClick={() => handleVerifyTrigger(doc.id)} className="p-1 text-amber-500 hover:text-amber-400 transition-colors">
                          <CheckCircle size={15} />
                        </button>
                      )}
                      <button title="Download Report" className="p-1 text-slate-400 hover:text-white transition-colors">
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* INTEGRATED PAGINATION DRAWER CONTROLS */}
        <div className="bg-slate-950/50 border-t border-slate-800 px-4 py-3.5 flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>Page {pageParam} of {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button 
              disabled={pageParam === 1} 
              onClick={() => updateQueryParams({ page: 1 })}
              className="p-1.5 rounded-md border border-slate-800 bg-slate-900 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronsLeft size={14} />
            </button>
            <button 
              disabled={pageParam === 1} 
              onClick={() => updateQueryParams({ page: pageParam - 1 })}
              className="p-1.5 rounded-md border border-slate-800 bg-slate-900 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button 
              disabled={pageParam === totalPages} 
              onClick={() => updateQueryParams({ page: pageParam + 1 })}
              className="p-1.5 rounded-md border border-slate-800 bg-slate-900 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
            <button 
              disabled={pageParam === totalPages} 
              onClick={() => updateQueryParams({ page: totalPages })}
              className="p-1.5 rounded-md border border-slate-800 bg-slate-900 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}