

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Home, PlusCircle, MessageSquare, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "./components/ThemeProvider";
import SplashScreen from "./components/SplashScreen";
import GuestBanner from "./components/GuestBanner";
import WelcomeModal from "./components/WelcomeModal";

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(() => localStorage.getItem('hitchr.mode') || 'sender');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await base44.auth.isAuthenticated();
        setIsAuthenticated(authenticated);
        if (authenticated) {
          try {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            
            if (currentUser.is_driver && !currentUser.is_sender) {
              setMode('driver');
              localStorage.setItem('hitchr.mode', 'driver');
            } else if (currentUser.is_sender && !currentUser.is_driver) {
              setMode('sender');
              localStorage.setItem('hitchr.mode', 'sender');
            } else if (currentUser.current_mode) {
              setMode(currentUser.current_mode);
              localStorage.setItem('hitchr.mode', currentUser.current_mode);
            }
          } catch (error) {
            console.error("Error fetching user:", error);
          }
        } else {
          const hasSeenWelcome = localStorage.getItem('hitchr.hasSeenWelcome');
          if (!hasSeenWelcome) {
            setShowWelcomeModal(true);
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setIsAuthenticated(false);
        
        const hasSeenWelcome = localStorage.getItem('hitchr.hasSeenWelcome');
        if (!hasSeenWelcome) {
          setShowWelcomeModal(true);
        }
      }
      setTimeout(() => setLoading(false), 1000);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const handleModeChange = (event) => setMode(event.detail.mode);
    window.addEventListener('HITCHR_MODE_CHANGED', handleModeChange);
    return () => window.removeEventListener('HITCHR_MODE_CHANGED', handleModeChange);
  }, []);

  const privateRoutes = [
    createPageUrl('Post'),
    createPageUrl('Profile'),
    createPageUrl('Inbox'),
    createPageUrl('Chat'),
    createPageUrl('AddressBook'),
    createPageUrl('NotificationsSettings'),
    createPageUrl('BlockedUsers'),
    createPageUrl('PhoneSettings'),
    createPageUrl('Wallet'),
    createPageUrl('admin')
  ];

  const isPrivateRoute = privateRoutes.some(route => location.pathname.startsWith(route));

  useEffect(() => {
    if (!loading && isPrivateRoute && !isAuthenticated) {
      sessionStorage.setItem('hitchr.returnUrl', location.pathname);
      base44.auth.redirectToLogin(location.pathname);
    }
  }, [loading, isPrivateRoute, isAuthenticated, location.pathname]);

  const pagesWithoutNav = [
    createPageUrl('admin'),
    createPageUrl('PhoneSettings'),
    createPageUrl('AddressBook'),
    createPageUrl('NotificationsSettings'),
    createPageUrl('BlockedUsers'),
    createPageUrl('Chat')
  ];
  
  const showNav = !pagesWithoutNav.some(path => location.pathname.startsWith(path));

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/post", icon: PlusCircle, label: "Post", requiresAuth: true },
    { path: "/inbox", icon: MessageSquare, label: "Inbox", requiresAuth: true },
    { path: "/wallet", icon: Wallet, label: "Wallet", requiresAuth: true },
    { path: "/profile", icon: User, label: "Profile", requiresAuth: true }
  ];

  const modeColor = mode === 'driver' ? '#2FB5C0' : '#FF7A00';
  const modeColorHover = mode === 'driver' ? '#28A3AD' : '#E66D00';
  const modeColorLight = mode === 'driver' ? '#E6F9FB' : '#FFE8D6';

  const handleNavClick = (item, e) => {
    if (item.requiresAuth && !isAuthenticated) {
      e.preventDefault();
      sessionStorage.setItem('hitchr.returnUrl', item.path);
      base44.auth.redirectToLogin(item.path);
    }
  };

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
  };

  const handleCloseWelcome = () => {
    setShowWelcomeModal(false);
  };

  return (
    <ThemeProvider defaultTheme="light" storageKey="hitchr-theme">
      {loading && <SplashScreen />}
      
      {showWelcomeModal && (
        <WelcomeModal 
          onSelectMode={handleModeSelect}
          onClose={handleCloseWelcome}
        />
      )}

      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FFFFFF' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

          :root {
            --accent-color: ${modeColor};
            --primary: ${modeColor};
            --primary-hover: ${modeColorHover};
            --primary-light: ${modeColorLight};
            --surface: #FFFFFF;
            --background: #FFFFFF;
            --foreground: #333F48;
            --card: #FFFFFF;
            --card-foreground: #333F48;
            --popover: #FFFFFF;
            --popover-foreground: #333F48;
            --text-strong: #111827;
            --text-primary: #333F48;
            --text-secondary: #7C8B96;
            --text-muted: #6B7280;
            --muted-foreground: #7C8B96;
            --track-off: #E5E7EB;
            --secondary: #F5F5F5;
            --secondary-foreground: #333F48;
            --muted: #F5F5F5;
            --destructive: #E84C3D;
            --destructive-foreground: #FFFFFF;
            --success: #00C37A;
            --success-foreground: #FFFFFF;
            --info: #1976D2;
            --info-foreground: #FFFFFF;
            --border: #E7E9EB;
            --input: #E7E9EB;
            --ring: ${modeColor};
            --radius: 0.5rem;
            --subtle-bg: #F5F5F5;
            --shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
            --shadow-lg: 0 4px 10px rgba(0, 0, 0, 0.08);
            --overlay-bg: #FFFFFF;
            --menu-bg: #FFFFFF;
            --dialog-bg: #FFFFFF;
            --dropdown-bg: #FFFFFF;
            --backdrop-scrim: #E5E7EB;
          }
          
          * {
            color-scheme: light !important;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
          }
          
          html, body {
            background-color: #FFFFFF !important;
            color: #333F48 !important;
            font-size: 14px;
          }

          @media (min-width: 768px) {
            html, body {
              font-size: 16px;
            }
          }

          [role="dialog"],
          [role="menu"],
          [role="listbox"],
          .dialog-content,
          .popover-content,
          .dropdown-content,
          .sheet-content,
          .select-content {
            background-color: var(--overlay-bg) !important;
            opacity: 1 !important;
            backdrop-filter: none !important;
          }

          [data-radix-overlay],
          .backdrop,
          .modal-backdrop {
            background-color: var(--backdrop-scrim) !important;
            opacity: 1 !important;
            backdrop-filter: none !important;
          }

          .pill-chip {
            border-radius: 50px;
            transition: all 0.2s ease;
            font-weight: 600;
            font-size: 12px;
            padding: 6px 16px;
            border: 2px solid #E7E9EB;
            background: #FFFFFF;
            color: #333F48;
            cursor: pointer;
          }

          .pill-chip:hover {
            border-color: #7C8B96;
          }

          .pill-chip.active {
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            background: ${modeColor} !important;
            border-color: ${modeColor} !important;
            color: #FFFFFF !important;
          }

          button:not([data-variant]):not(.pill-chip):not([variant="ghost"]):not([variant="outline"]) {
            background-color: ${modeColor} !important;
            color: #FFFFFF !important;
            transition: all 0.2s ease !important;
          }

          button:not([data-variant]):not(.pill-chip):not([variant="ghost"]):not([variant="outline"]):hover:not(:disabled) {
            background-color: ${modeColorHover} !important;
          }

          button:not([data-variant]):not(.pill-chip):not([variant="ghost"]):not([variant="outline"]) *,
          button:not([data-variant]):not(.pill-chip):not([variant="ghost"]):not([variant="outline"]) svg {
            color: #FFFFFF !important;
            stroke: #FFFFFF !important;
          }

          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
            overflow-x: auto;
            overflow-y: hidden;
          }
          
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }

          @media (min-width: 1024px) {
            .max-w-lg {
              max-width: 42rem;
            }
          }

          @media (min-width: 1280px) {
            .max-w-lg {
              max-width: 48rem;
            }
          }
        `}</style>
        
        <GuestBanner />

        <main className={cn("flex-1", showNav && "pb-18")}>
          {children}
        </main>

        {showNav && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-50">
            <div className="max-w-lg mx-auto px-2">
              <div className="flex items-center justify-around h-[60px]">
                {navItems.map((item) => {
                  const isActive = location.pathname === createPageUrl(item.label);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={createPageUrl(item.label)}
                      onClick={(e) => handleNavClick(item, e)}
                      className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 h-full"
                    >
                      <div 
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                          isActive && "shadow-md"
                        )}
                        style={{
                          backgroundColor: isActive ? modeColor : 'transparent',
                        }}
                      >
                        <Icon 
                          className="w-5 h-5 transition-colors"
                          style={{ 
                            color: isActive ? '#FFFFFF' : '#7C8B96',
                            stroke: isActive ? '#FFFFFF' : '#7C8B96'
                          }}
                        />
                      </div>
                      <span 
                        className="text-[10px] font-semibold transition-colors"
                        style={{ 
                          color: isActive ? modeColor : '#7C8B96'
                        }}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        )}
      </div>
    </ThemeProvider>
  );
}

