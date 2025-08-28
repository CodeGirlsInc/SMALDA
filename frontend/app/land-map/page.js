"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, MapPin, AlertTriangle, Shield } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues
const LandHotspotsMap = dynamic(
  () => import('@/components/LandHotspotsMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-lg">Loading map...</div>
      </div>
    )
  }
);

export default function LandMapPage() {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    underReview: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/land-hotspots.json');
        const data = await response.json();
        const hotspots = data.landHotspots;
        
        setStats({
          total: hotspots.length,
          active: hotspots.filter(h => h.status === 'active').length,
          resolved: hotspots.filter(h => h.status === 'resolved').length,
          underReview: hotspots.filter(h => h.status === 'under_review').length
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b">
        <Link className="flex items-center justify-center" href="/">
          <Shield className="h-8 w-8 text-primary" />
          <span className="ml-2 text-2xl font-bold text-primary">SMALDA</span>
        </Link>
        <nav className="ml-auto hidden md:flex gap-6">
          <Link
            className="text-sm font-medium hover:text-primary transition-colors"
            href="/case-search"
          >
            Case Search
          </Link>
          <Link
            className="text-sm font-medium hover:text-primary transition-colors"
            href="/legal-chat"
          >
            Legal Chat
          </Link>
          <Link
            className="text-sm font-medium hover:text-primary transition-colors"
            href="/legal-report"
          >
            Legal Report
          </Link>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <MapPin className="h-8 w-8 text-primary" />
            Land Dispute Hotspots Map
          </h1>
          <p className="text-muted-foreground text-lg">
            Interactive visualization of land dispute locations and hotspots across Nigeria
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hotspots</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Recorded locations</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Disputes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Ongoing conflicts</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Under Review</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.underReview}</div>
              <p className="text-xs text-muted-foreground">Being investigated</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <AlertTriangle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">Successfully resolved</p>
            </CardContent>
          </Card>
        </div>

        {/* Map Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Interactive Hotspots Map
            </CardTitle>
            <CardDescription>
              Click on markers to view detailed information about each dispute location.
              Use mouse wheel to zoom and drag to navigate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LandHotspotsMap />
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle>Map Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
                  !
                </div>
                <div>
                  <div className="font-medium">High Severity</div>
                  <div className="text-sm text-muted-foreground">Critical disputes requiring immediate attention</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-yellow-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
                  !
                </div>
                <div>
                  <div className="font-medium">Medium Severity</div>
                  <div className="text-sm text-muted-foreground">Moderate disputes under monitoring</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
                  !
                </div>
                <div>
                  <div className="font-medium">Low Severity</div>
                  <div className="text-sm text-muted-foreground">Minor disputes or resolved cases</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}