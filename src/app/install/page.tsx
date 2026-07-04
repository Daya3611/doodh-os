'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Smartphone,
  Laptop,
  Share2,
  Download,
  Check,
  Copy,
  ArrowLeft,
  Info,
  ExternalLink,
  Globe,
  RefreshCw,
  Sparkles,
  Compass,
  Monitor
} from 'lucide-react';

export default function InstallGuide() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [activeTab, setActiveTab] = useState('android');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone (PWA) mode
    if (typeof window !== 'undefined') {
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    (window.navigator as any).standalone === true;
      setIsStandalone(isPWA);

      // Detect OS to auto-select relevant tab
      const ua = window.navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) {
        setActiveTab('ios');
      } else if (/android/.test(ua)) {
        setActiveTab('android');
      } else {
        setActiveTab('desktop');
      }
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      toast.success('DoodhOS has been successfully installed on your device! 🎉');
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) {
      toast.error('Direct installation is not supported by your browser. Please follow the manual instructions below.');
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success('Starting installation...');
      } else {
        toast.info('Installation cancelled.');
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Install prompt failed:', err);
      toast.error('An error occurred. Please follow manual install instructions.');
    }
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;

    const shareData = {
      title: 'DoodhOS - PWA App Installation',
      text: 'Install DoodhOS Milk Collection App directly onto your mobile or tablet to work offline, print receipts, and manage records!',
      url: window.location.origin,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.origin);
        setCopied(true);
        toast.success('App link copied to clipboard! Share it with operators and farmers via WhatsApp.');
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        toast.error('Could not copy link. Please select the URL from the browser bar and copy.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col antialiased">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
          <ArrowLeft className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-500">Back</span>
        </Link>
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="DoodhOS" className="h-8 w-auto" />
          <span className="font-semibold text-lg bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">DoodhOS</span>
        </div>
        <Button size="sm" variant="outline" onClick={handleShare}>
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share Guide</span>
        </Button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-center">
        {/* Glow Logo Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative group mb-4">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-amber-500 rounded-2xl blur-lg opacity-35 group-hover:opacity-60 transition duration-500"></div>
            <div className="relative bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-xl flex items-center justify-center w-24 h-24">
              <img src="/logo.png" alt="DoodhOS App Logo" className="w-16 h-16 object-contain" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Install DoodhOS App</h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-lg text-sm md:text-base">
            Get instant offline access, high performance, and convenient printing at your milk collection center.
          </p>
        </div>

        {/* Dynamic App Shell Install Prompt */}
        {isStandalone ? (
          <Card className="border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 mb-8 overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-emerald-800 dark:text-emerald-300">App Already Installed!</CardTitle>
                <CardDescription className="text-emerald-700/80 dark:text-emerald-400/80">
                  You are viewing DoodhOS inside the installed application dashboard.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  'w-full bg-emerald-600 hover:bg-emerald-700 text-white'
                )}
              >
                Open Dashboard Login
              </Link>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Card className="border-orange-500/20 bg-orange-50/50 dark:bg-orange-950/10 mb-8 overflow-hidden shadow-md">
            <CardHeader className="flex flex-row items-start gap-4">
              <div className="p-3 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 mt-1">
                <Download className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-orange-900 dark:text-orange-200">Instant One-Click Install Available!</CardTitle>
                <CardDescription className="text-orange-800/80 dark:text-orange-400/80 text-xs md:text-sm mt-0.5">
                  Your browser supports direct installation. Tap the button below to add DoodhOS directly to your home screen or desktop.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button size="lg" onClick={triggerInstall} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium text-base shadow-sm">
                <Download className="h-5 w-5 mr-1" />
                Install DoodhOS Directly
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Tabbed Installation Guides */}
        <Card className="shadow-sm border border-zinc-200 dark:border-zinc-800">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              Manual Install Guides
            </CardTitle>
            <CardDescription>
              Select your device platform below to view step-by-step instructions.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-8 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
                <TabsTrigger value="android" className="rounded-lg py-2 flex items-center justify-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800">
                  <Smartphone className="h-4 w-4" />
                  <span>Android</span>
                </TabsTrigger>
                <TabsTrigger value="ios" className="rounded-lg py-2 flex items-center justify-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800">
                  <Compass className="h-4 w-4" />
                  <span>iOS (Apple)</span>
                </TabsTrigger>
                <TabsTrigger value="desktop" className="rounded-lg py-2 flex items-center justify-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800">
                  <Laptop className="h-4 w-4" />
                  <span>Desktop</span>
                </TabsTrigger>
              </TabsList>

              {/* Android Instructions */}
              <TabsContent value="android" className="space-y-6">
                <div className="flex items-center gap-2 text-zinc-500 text-sm bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg">
                  <Globe className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  <span>We highly recommend using <strong>Google Chrome</strong> on Android for the best performance.</span>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Open in Chrome</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Open this page (<code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-orange-600">{window?.location?.hostname || 'doodhos'}</code>) using the <strong>Google Chrome</strong> app on your Android phone/tablet.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Tap Browser Menu</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Tap the three dots menu icon <strong className="text-zinc-700 dark:text-zinc-300">( ⋮ )</strong> in the top-right corner of Google Chrome.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Select Add to Home screen</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong> from the menu options.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Confirm Installation</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        A prompt will pop up asking for confirmation. Tap <strong>"Install"</strong> or <strong>"Add"</strong>. The app icon will appear on your phone home screen within a few seconds!
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* iOS Instructions */}
              <TabsContent value="ios" className="space-y-6">
                <div className="flex items-center gap-2 text-zinc-500 text-sm bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg">
                  <Compass className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  <span>On iPhone or iPad, Apple only supports PWA installations via the <strong>Safari browser</strong>.</span>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Open in Safari</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Launch the native Apple <strong>Safari browser</strong> and navigate to this website.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Tap Share Button</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Find and tap the <strong>Share</strong> icon (a blue square with an arrow pointing up) in the bottom navigation bar on iPhone, or top bar on iPad.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Add to Home Screen</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Scroll down the share list sheet and tap on <strong>"Add to Home Screen"</strong> (has a plus sign inside a box icon).
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Confirm</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Tap <strong>"Add"</strong> in the top-right corner of the configuration view. The DoodhOS app is now ready on your home screen!
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Desktop Instructions */}
              <TabsContent value="desktop" className="space-y-6">
                <div className="flex items-center gap-2 text-zinc-500 text-sm bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg">
                  <Monitor className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  <span>Installing on computers works in <strong>Google Chrome, Microsoft Edge, and Brave</strong>.</span>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Look at the Address Bar</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        At the top-right edge of your web browser's URL address bar, look for the **Install App icon** (usually resembles an overlapping desktop monitor/arrow or a tiny monitor icon with a down arrow).
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Click Install Icon</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Click the Install Icon. A confirmation dialog will overlay the browser page.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-bold text-sm flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Confirm</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Click <strong>"Install"</strong> in the prompt. The app will open inside its own clean window and save a launcher shortcut on your desktop.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Benefits Grid */}
        <section className="mt-12 space-y-6">
          <h3 className="text-xl font-bold tracking-tight text-center">Why Install DoodhOS?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/50 dark:bg-zinc-900/50 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
              <CardHeader className="pb-2">
                <Globe className="h-5 w-5 text-orange-500 mb-1" />
                <CardTitle className="text-sm font-semibold">Works Offline</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Rural areas face frequent network blackouts. The installed app caches database writes locally so collections continue offline and sync when connected.
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-zinc-900/50 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
              <CardHeader className="pb-2">
                <Sparkles className="h-5 w-5 text-orange-500 mb-1" />
                <CardTitle className="text-sm font-semibold">Instant Loading</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Next-gen app caching ensures page loading is instant. Save precious minutes at the center gate during peak morning and evening collections.
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-zinc-900/50 shadow-sm border border-zinc-200/60 dark:border-zinc-800/60">
              <CardHeader className="pb-2">
                <Download className="h-5 w-5 text-orange-500 mb-1" />
                <CardTitle className="text-sm font-semibold">Native Screen Layout</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Removes distracting browser URL bars and navigation pads. Maximizes grid layouts and buttons for quick keypads and touch options on tablets.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Share Section Bottom */}
        <div className="mt-12 bg-white dark:bg-zinc-900 rounded-2xl border p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Share This Guide With Operators</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Copy and share this guide's link on WhatsApp to help other center staff install it.</p>
          </div>
          <Button size="default" onClick={handleShare} className="w-full md:w-auto shrink-0 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 font-medium">
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1 text-emerald-500" />
                Copied Link!
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-1" />
                Share Install Guide
              </>
            )}
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t mt-12 bg-white/40 dark:bg-zinc-950/40 text-center text-xs text-zinc-400">
        <p>© 2026 DoodhOS Milk SaaS. Version 2.0. Clean architecture for dairy operators.</p>
      </footer>
    </div>
  );
}
