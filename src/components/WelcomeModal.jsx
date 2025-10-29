
import React from "react";
import { Button } from "@/components/ui/button";
import { Truck, Package } from "lucide-react";
import HitchrLogo from "./HitchrLogo";

export default function WelcomeModal({ onSelectMode, onClose }) {
  const handleSelectMode = (mode) => {
    localStorage.setItem('hitchr.mode', mode);
    localStorage.setItem('hitchr.hasSeenWelcome', 'true');
    window.dispatchEvent(new CustomEvent('HITCHR_MODE_CHANGED', { detail: { mode } }));
    onSelectMode(mode);
    onClose();
  };

  const handleBoth = () => {
    localStorage.setItem('hitchr.mode', 'sender');
    localStorage.setItem('hitchr.userMode', 'both');
    localStorage.setItem('hitchr.hasSeenWelcome', 'true');
    window.dispatchEvent(new CustomEvent('HITCHR_MODE_CHANGED', { detail: { mode: 'sender' } }));
    onSelectMode('sender');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn"
      style={{
        backgroundColor: '#E5E7EB'
      }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#FFFFFF'
        }}
      >
        <div className="p-6 sm:p-8 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <HitchrLogo mode="sender" size={64} />
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: '#333F48' }}>
            Welcome to Hitchr
          </h1>

          {/* Explainer */}
          <p className="text-base sm:text-lg mb-4 leading-relaxed" style={{ color: '#7C8B96' }}>
            Hitchr connects people already driving rural routes with those who need deliveries or pickups — it's like carpooling for packages, designed for towns Uber forgot.
          </p>
          
          <p className="text-base sm:text-lg mb-4 leading-relaxed" style={{ color: '#7C8B96' }}>
            <strong style={{ color: '#333F48' }}>Earn while you drive, or save while you send</strong> — Hitchr is community-driven and built for locals helping locals.
          </p>

          {/* Tagline */}
          <p className="text-sm font-semibold mb-6 tracking-wide" style={{ color: '#16A6A3' }}>
            Drive. Deliver. Connect.
          </p>

          {/* Buttons */}
          <div className="space-y-3 mb-4">
            <Button
              onClick={() => handleSelectMode('driver')}
              className="w-full h-14 text-lg font-bold rounded-xl transition-all flex items-center justify-center gap-3"
              style={{
                backgroundColor: '#2FB5C0',
                color: '#FFFFFF'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#28A3AD';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2FB5C0';
              }}
            >
              <Truck className="w-6 h-6" />
              I'm a Driver
            </Button>

            <Button
              onClick={() => handleSelectMode('sender')}
              className="w-full h-14 text-lg font-bold rounded-xl transition-all flex items-center justify-center gap-3"
              style={{
                backgroundColor: '#FF7A00',
                color: '#FFFFFF'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E66D00';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FF7A00';
              }}
            >
              <Package className="w-6 h-6" />
              I'm a Sender
            </Button>
          </div>

          {/* I use both link */}
          <button
            onClick={handleBoth}
            className="text-sm font-semibold transition-colors"
            style={{ color: '#7C8B96' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#333F48';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#7C8B96';
            }}
          >
            I use both
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  );
}
