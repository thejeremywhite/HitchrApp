import React from 'react';

const LOGO_URLS = {
  teal: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e9f706337358e3942ab2c1/144c294c5_Screenshot_20251010_234752_Gallery.png',
  orange: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e9f706337358e3942ab2c1/20ff82fd9_Screenshot_20251012_192416_Gallery.jpg'
};

export default function HitchrLogo({ mode = 'sender', size = 32 }) {
  // DRIVER MODE = TEAL LOGO (#2FB5C0)
  // SENDER MODE = ORANGE LOGO (#FF7A00)
  const logoUrl = mode === 'driver' ? LOGO_URLS.teal : LOGO_URLS.orange;

  return (
    <img 
      src={logoUrl} 
      alt="Hitchr Logo" 
      className="hitchr-logo"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain'
      }}
    />
  );
}