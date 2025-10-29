
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Phone, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PhoneSettings() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1); // 1 for phone entry, 2 for code verification
  const [statusMessage, setStatusMessage] = useState(null);
  
  const handleSendCode = () => {
    if (phone.length < 10) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid phone number' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    // Mocking API call for MVP
    setTimeout(() => {
      console.log('[PHONE] Code sent to:', phone);
      setStep(2);
      setStatusMessage({ type: 'success', text: 'Code sent!' });
      setTimeout(() => setStatusMessage(null), 3000);
    }, 1500);
  };

  const handleVerifyCode = () => {
    if (code.length < 4) {
      setStatusMessage({ type: 'error', text: 'Please enter the 4-digit code' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    // Mocking API call
    setTimeout(async () => {
      try {
        await base44.auth.updateMe({ phone, phone_verified: true });
        console.log('[PHONE] Phone verified successfully');
        setStatusMessage({ type: 'success', text: 'Phone verified!' });
        setTimeout(() => navigate(-1), 1500);
      } catch (error) {
        console.error('[PHONE] Verification failed:', error);
        setStatusMessage({ type: 'error', text: 'Verification failed' });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    }, 1500);
  };
  
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => step === 1 ? navigate(-1) : setStep(1)} className="rounded-xl h-11 w-11">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Phone Verification</h1>
        </div>
        
        {statusMessage && (
          <div className={`mx-4 mb-4 flex items-start gap-2 p-3 rounded-lg ${
            statusMessage.type === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <p className={`text-sm font-medium ${
              statusMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>{statusMessage.text}</p>
          </div>
        )}
      </div>
      <div className="max-w-lg mx-auto p-6 space-y-6">
        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-center text-[var(--text-secondary)]">Enter your phone number to receive a verification code. This is used for account security and e-Transfers only.</p>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
              <Input 
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-14 rounded-lg pl-12 text-lg"
              />
            </div>
            <Button onClick={handleSendCode} className="w-full h-12 bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg text-base">
              Send Code
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-[var(--text-secondary)]">Enter the 4-digit code we sent to your number.</p>
            <div className="relative">
              <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
              <Input 
                type="text"
                placeholder="1234"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={4}
                className="h-14 rounded-lg pl-12 text-center text-2xl tracking-[1rem]"
              />
            </div>
            <Button onClick={handleVerifyCode} className="w-full h-12 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg text-base">
              Verify
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
