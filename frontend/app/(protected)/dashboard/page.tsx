'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/router';
import { 
  FileText, ShieldAlert, Clock, ShieldCheck, 
  ArrowRight, UploadCloud, ArrowUpDown 
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, 
  YAxis, Tooltip, Cell 
} from 'recharts';

interface Document {
  id: string;
  name: string;
  status: 'PENDING' | 'ANALYZING' | 'VERIFIED' | 'FLAGGED' | 'REJECTED';
  riskScore: number;
  createdAt: string;
  reviewed?: boolean;
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);

  // 1. Core Core REST Hydration Matrix
  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Failed to resolve portfolio collection registries:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. Real-Time WebSockets Sync Loop Integration (FE-06 Compliance)
  useEffect(() => {
    fetchDashboardData();

    // Establish WebSocket stream pipeline link handles
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${wsProtocol}//${window.location.host}/api/ws`);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        // Intercept real-time update markers to trigger instant atomic UI synchronization
        if (payload.type === 'documentStatus') {
          fetchDashboardData();
        }
      } catch (err) {
        console.error('Failed to parse websocket synchronization frames:', err);
      }
    };

    return () => socket.close();
  }, [fetchDashboardData]);

  // 3. Client-Side Data Aggregate Computations
  const stats = useMemo(() => {
    const total = documents.length;
    if (total === 0) return { total: 0, avgRisk: 0, pending: 0, verified: 0 };

    const sumRisk = documents.reduce((acc, doc) => acc + doc.riskScore, 0);
    const pending = documents.filter(d => d.status === 'PENDING' || d.status === 'ANALYZING').length;
    const verified = documents.filter(d => d.status === 'VERIFIED').length;

    return {
      total,
      avgRisk: Math.round(sumRisk / total),
      pending,
      verified
    };
  }, [documents]);

  // 4. Transform Metrics for Chart.js / Recharts Engine Mapping
  const chartData = useMemo(() => {
    const counts = { PENDING: 0, VERIFIED: 0, FLAGGED: 0, REJECTED: 0 };
    documents.forEach(doc => {
      const status = doc.status === 'ANALYZING' ? 'PENDING' : doc.status;
      if (status in counts) counts[status as keyof typeof counts]++;
    });

    return [
      { name: 'Pending', count: counts.PENDING, color: '#f59e0b' },
      { name: 'Verified', count: counts.VERIFIED, color: '#10b981' },
      { name: 'Flagged', count: counts.FLAGGED, color: '#ef4444' },
      { name: 'Rejected', count: counts.REJECTED, color: '#64748b' },
    ];
  }, [documents]);

  // 5. Filter Actions & Sorting Realignment Operations
  const flaggedActionItems = useMemo(() => {
    return documents.filter(d => d.status === 'FLAGGED' && !d.reviewed);
  }, [documents]);

  const recentDocuments = useMemo(() => {
    return [...documents]
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortAsc ? timeA - timeB : timeB - timeA;
      })
      .slice(0, 5);
  }, [documents, sortAsc]);

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-emerald-500';
    if (score <= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-medium text-sm">
        Loading system dashboard...
      </div>
    );
  }

  // EMPTY STATE FALLBACK PATH
  if (documents.length === 0) {
    return (
      <div className="min-h-[80vh] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
          <UploadCloud className="text-blue-500" size={28} />
        </div>
        <h2 className="text-xl font-bold text-white">No documents tracking logs found</h2>
        <p className="text-slate-400 text-sm max-w-sm mt-1 mb-6">
          Upload your first verification vector target file to deploy active AI scoring metrics and lock secure ledger assets.
        </p>
        <button className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md">
          Upload File
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-6">
      
      {/* SECTION 1: STATS CARD ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase">Total Document Base</span>
            <span className="text-2xl font-extrabold text-white mt-1 block">{stats.total}</span>
          </div>
          <FileText className="text-blue-500" size={24} />
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase">Avg Portfolio Risk</span>
            <span className={`text-2xl font-extrabold mt-1 block ${getRiskColor(stats.avgRisk)}`}>
              {stats.avgRisk}%
            </span>
          </div>
          <ShieldAlert className="text-slate-500" size={24} />
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase">Pending Anchors</span>
            <span className="text-2xl font-extrabold text-white mt-1 block">{stats.pending}</span>
          </div>
          <Clock className="text-amber-500" size={24} />
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase">Stellar Verified</span>
            <span className="text-2xl font-extrabold text-emerald-400 mt-1 block">{stats.verified}</span>
          </div>
          <ShieldCheck className="text-emerald-500" size={24} />
        </div>
      </div>

      {/* SECTION 2: CHARTS AND ACTIVE INCIDENT THREAT ACTION TRACKS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Horizontal Distribution Engine */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Portfolio Risk Distribution</h3>
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action Items List Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldAlert size={16} /> Attention Required
            </h3>
            {flaggedActionItems.length === 0 ? (
              <p className="text-xs text-slate-500 mt-8 text-center italic">Zero unreviewed compliance threats reported.</p>
            ) : (
              <ul className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {flaggedActionItems.map(item => (
                  <li key={item.id} className="p-2.5 rounded-lg bg-slate-950 border border-rose-950 flex items-center justify-between text-xs transition-colors hover:bg-slate-900">
                    <span className="font-medium text-slate-200 truncate max-w-[140px]">{item.name}</span>
                    <span className="font-mono font-bold text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900">
                      Risk: {item.riskScore}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: RECENT ACTIVITY DOCUMENT LEDGER REPOSITORY */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Documents Repository</h3>
          <button className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
            View All Portfolio <ArrowRight size={14} />
          </button>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="py-3 px-2">Document Name</th>
                <th className="py-3 px-2">Lifecycle Status</th>
                <th className="py-3 px-2">Threat Vector Score</th>
                <th className="py-3 px-2 cursor-pointer select-none hover:text-white" onClick={() => setSortAsc(!sortAsc)}>
                  <div className="flex items-center gap-1">
                    Ingestion Date <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="py-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-medium">
              {recentDocuments.map(doc => (
                <tr key={doc.id} className="hover:bg-slate-800/30 text-slate-300 transition-colors">
                  <td className="py-3 px-2 text-white font-semibold truncate max-w-[180px]">{doc.name}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${
                      doc.status === 'VERIFIED' ? 'bg-emerald-950/40 border-emerald-900 text-emerald-400' :
                      doc.status === 'FLAGGED' ? 'bg-rose-950/40 border-rose-900 text-rose-400' :
                      doc.status === 'REJECTED' ? 'bg-slate-800 border-slate-700 text-slate-400' :
                      'bg-amber-950/40 border-amber-900 text-amber-400 animate-pulse'
                    }`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className={`py-3 px-2 font-mono font-bold ${getRiskColor(doc.riskScore)}`}>
                    {doc.riskScore}%
                  </td>
                  <td className="py-3 px-2 text-slate-400">
                    {new Date(doc.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="text-blue-400 hover:text-blue-300 cursor-pointer text-xs transition-colors">
                      Inspect Detail
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}