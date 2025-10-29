import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function GuestBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await base44.auth.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (!authenticated) {
        const dismissed = localStorage.getItem('hitchr.guestBannerDismissed');
        const dismissedAt = dismissed ? parseInt(dismissed) : 0;
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (now - dismissedAt > twentyFourHours) {
          setIsVisible(true);
        }
      }
    };
    checkAuth();
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('hitchr.guestBannerDismissed', Date.now().toString());
    setIsVisible(false);
  };

  const handleSignIn = () => {
    base44.auth.redirectToLogin(window.location.pathname);
  };

  if (isAuthenticated || !isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-200">
      <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-700">Browsing as guest</span>
          <span className="text-gray-400">•</span>
          <button
            onClick={handleSignIn}
            className="text-indigo-600 font-semibold hover:text-indigo-700"
          >
            Sign in
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-6 w-6 rounded-full hover:bg-white/50"
        >
          <X className="w-4 h-4 text-gray-500" />
        </Button>
      </div>
    </div>
  );
}