import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Shield,
  FileSearch,
  AlertTriangle,
  Users,
  CheckCircle,
  ArrowRight,
  Menu,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b">
        <Link className="flex items-center justify-center" href="#">
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
          <Link
            className="text-sm font-medium hover:text-primary transition-colors"
            href="#features"
          >
            Features
          </Link>
          <Link
            className="text-sm font-medium hover:text-primary transition-colors"
            href="#how-it-works"
          >
            How It Works
          </Link>
          <Link
            className="text-sm font-medium hover:text-primary transition-colors"
            href="#contact"
          >
            Contact
          </Link>
        </nav>
        <Button variant="ghost" size="icon" className="ml-auto md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-gradient-to-b from-background to-muted/20">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    AI-Powered Land Document Analysis
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    SMALDA uses advanced AI to detect, analyze, and flag risks
                    in land ownership documents, preventing costly disputes
                    before they happen.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Link href="/legal-report">
                    <Button size="lg" className="text-lg px-8">
                      Start Free Analysis
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-lg px-8 bg-transparent"
                  >
                    Watch Demo
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Instant results</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <Image
                  alt="SMALDA Dashboard"
                  className="aspect-video overflow-hidden rounded-xl object-cover shadow-2xl"
                  height="400"
                  src="/placeholder.svg?height=400&width=600"
                  width="600"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">
                  Core Features
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  Comprehensive Land Document Protection
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Our AI-powered platform provides end-to-end analysis of land
                  ownership documents, identifying potential risks and ensuring
                  legal compliance.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
              <Card className="relative overflow-hidden">
                <CardHeader>
                  <FileSearch className="h-12 w-12 text-primary" />
                  <CardTitle>Document Analysis</CardTitle>
                  <CardDescription>
                    Advanced AI scans and analyzes land ownership documents for
                    inconsistencies, missing information, and potential legal
                    issues.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>OCR text extraction</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Legal compliance check</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Multi-format support</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden">
                <CardHeader>
                  <AlertTriangle className="h-12 w-12 text-primary" />
                  <CardTitle>Risk Detection</CardTitle>
                  <CardDescription>
                    Proactively identifies potential disputes, boundary
                    conflicts, and ownership discrepancies before they become
                    costly legal battles.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Boundary analysis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Ownership verification</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Historical data cross-check</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden">
                <CardHeader>
                  <Users className="h-12 w-12 text-primary" />
                  <CardTitle>Dispute Prevention</CardTitle>
                  <CardDescription>
                    Comprehensive reporting and recommendations help prevent
                    land disputes and ensure smooth property transactions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Detailed risk reports</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Actionable recommendations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Legal expert consultation</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="w-full py-12 md:py-24 lg:py-32 bg-muted/50"
        >
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">
                  How It Works
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  Simple 3-Step Process
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Get comprehensive land document analysis in minutes, not
                  weeks.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  1
                </div>
                <h3 className="text-xl font-bold">Upload Documents</h3>
                <p className="text-muted-foreground">
                  Securely upload your land ownership documents, deeds, surveys,
                  and related paperwork.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  2
                </div>
                <h3 className="text-xl font-bold">AI Analysis</h3>
                <p className="text-muted-foreground">
                  Our advanced AI analyzes your documents for risks,
                  inconsistencies, and potential issues.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  3
                </div>
                <h3 className="text-xl font-bold">Get Results</h3>
                <p className="text-muted-foreground">
                  Receive detailed reports with risk assessments and actionable
                  recommendations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-3 lg:gap-12">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="text-4xl font-bold text-primary">99.7%</div>
                <div className="text-xl font-semibold">Accuracy Rate</div>
                <p className="text-muted-foreground">
                  Industry-leading accuracy in document analysis and risk
                  detection.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="text-4xl font-bold text-primary">10,000+</div>
                <div className="text-xl font-semibold">Documents Analyzed</div>
                <p className="text-muted-foreground">
                  Trusted by property professionals and legal experts worldwide.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="text-4xl font-bold text-primary">85%</div>
                <div className="text-xl font-semibold">Disputes Prevented</div>
                <p className="text-muted-foreground">
                  Significant reduction in land-related disputes for our
                  clients.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-primary text-primary-foreground">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Ready to Protect Your Land Investments?
                </h2>
                <p className="mx-auto max-w-[600px] text-primary-foreground/80 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Join thousands of property professionals who trust SMALDA to
                  safeguard their land transactions.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <form className="flex gap-2">
                  <Input
                    className="max-w-lg flex-1 bg-primary-foreground text-primary"
                    placeholder="Enter your email"
                    type="email"
                  />
                  <Button type="submit" variant="secondary" size="lg">
                    Get Started
                  </Button>
                </form>
                <p className="text-xs text-primary-foreground/60">
                  Start your free analysis today. No credit card required.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Button size="lg" variant="secondary" className="text-lg px-8">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground hover:text-primary bg-transparent"
                >
                  Schedule Demo
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">
          © 2024 SMALDA. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy Policy
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  );
}
