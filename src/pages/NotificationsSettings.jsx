
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeSwitch from '../components/ThemeSwitch';

export default function NotificationsSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    push_new_requests: true,
    push_message_received: true,
    email_summary: false
  });
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
        try {
            const user = await base44.auth.me();
            setSettings({
                push_new_requests: user.notifications_enabled !== false,
                push_message_received: user.notifications_enabled !== false,
                email_summary: user.email_summary_enabled === true
            });
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
    };
    loadSettings();
  }, []);

  const handleToggle = async (key, value) => {
    setSettings(prev => ({...prev, [key]: value}));
    try {
        const updatePayload = {};
        if (key === 'push_new_requests' || key === 'push_message_received') {
            updatePayload.notifications_enabled = value;
        } else {
            updatePayload.email_summary_enabled = value;
        }
      await base44.auth.updateMe(updatePayload);
      console.log('[NOTIFICATIONS] Settings updated:', key, value);
      setStatusMessage({ type: 'success', text: 'Settings updated' });
      setTimeout(() => setStatusMessage(null), 2000);
    } catch {
      console.error('[NOTIFICATIONS] Failed to update settings');
      setStatusMessage({ type: 'error', text: 'Failed to update settings' });
      setTimeout(() => setStatusMessage(null), 3000);
      setSettings(prev => ({...prev, [key]: !value}));
    }
  };

  const settingsOptions = [
    { key: 'push_new_requests', label: 'New Requests', description: 'Get notified about new delivery requests near you.'},
    { key: 'push_message_received', label: 'New Messages', description: 'Receive an alert when you get a new message.'},
    { key: 'email_summary', label: 'Email Summary', description: 'Get a daily or weekly summary of your activity.'},
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface)' }}>
      <div className="sticky top-0 z-10 border-b" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--track-off)' }}>
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-11 w-11">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-strong)' }}>Notifications</h1>
        </div>
        
        {statusMessage && (
          <div className={`max-w-lg mx-auto px-4 mb-4 flex items-start gap-2 p-3 rounded-lg ${
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
      
      <div className="max-w-lg mx-auto p-4 space-y-3">
        {settingsOptions.map(option => (
          <div key={option.key} className="flex justify-between items-center p-4 rounded-xl min-h-[72px]" style={{ backgroundColor: 'var(--track-off)' }}>
            <div className="flex-1 pr-4">
              <p className="font-semibold text-base" style={{ color: 'var(--text-strong)' }}>{option.label}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{option.description}</p>
            </div>
            <ThemeSwitch
              checked={settings[option.key]}
              onCheckedChange={(value) => handleToggle(option.key, value)}
              label={option.label}
              ariaLabel={`${option.label} ${settings[option.key] ? 'On' : 'Off'}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
