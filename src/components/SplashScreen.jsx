import React from 'react';
import HitchrLogo from './HitchrLogo';

export default function SplashScreen() {
  const mode = localStorage.getItem('hitchr.mode') || 'sender';

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-[100] animate-fadeOut">
      <div className="flex flex-col items-center gap-4 animate-fadeInScale">
        <HitchrLogo mode={mode} size={96} />
      </div>
      <style>{`
        @keyframes fadeOut {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
        @keyframes fadeInScale {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-fadeOut {
          animation: fadeOut 2s forwards;
        }
        .animate-fadeInScale {
          animation: fadeInScale 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
      `}</style>
    </div>
  );
}