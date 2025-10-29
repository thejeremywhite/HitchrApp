/**
 * Maps Deep-Linking Helper
 * Opens device's default maps app for navigation
 */

export const openInMaps = (latitude, longitude, label = 'Destination') => {
  const coords = `${latitude},${longitude}`;
  const encodedLabel = encodeURIComponent(label);
  
  // Detect platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);
  
  let mapsUrl;
  
  if (isIOS) {
    // iOS: Try Apple Maps first, fallback to Google Maps
    mapsUrl = `maps://maps.apple.com/?q=${encodedLabel}&ll=${coords}&dirflg=d`;
    
    // Check if Apple Maps is available
    const timeout = setTimeout(() => {
      // Fallback to Google Maps web if Apple Maps didn't open
      window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${coords}&destination_place_id=${encodedLabel}`;
    }, 1500);
    
    window.location.href = mapsUrl;
    
    // Clear timeout if maps opened successfully
    window.addEventListener('blur', () => clearTimeout(timeout), { once: true });
    
  } else if (isAndroid) {
    // Android: Google Maps intent
    mapsUrl = `google.navigation:q=${coords}&mode=d`;
    
    const timeout = setTimeout(() => {
      // Fallback to web maps
      window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${coords}`;
    }, 1500);
    
    window.location.href = mapsUrl;
    window.addEventListener('blur', () => clearTimeout(timeout), { once: true });
    
  } else {
    // Desktop or unsupported: Open Google Maps web
    mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords}&destination_place_id=${encodedLabel}`;
    window.open(mapsUrl, '_blank');
  }
};

export const openRouteInMaps = (fromLat, fromLng, toLat, toLng, toLabel = 'Destination') => {
  const origin = `${fromLat},${fromLng}`;
  const destination = `${toLat},${toLng}`;
  const encodedLabel = encodeURIComponent(toLabel);
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);
  
  let mapsUrl;
  
  if (isIOS) {
    mapsUrl = `maps://maps.apple.com/?saddr=${origin}&daddr=${destination}&dirflg=d`;
    
    const timeout = setTimeout(() => {
      window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    }, 1500);
    
    window.location.href = mapsUrl;
    window.addEventListener('blur', () => clearTimeout(timeout), { once: true });
    
  } else if (isAndroid) {
    mapsUrl = `google.navigation:q=${destination}&mode=d`;
    
    const timeout = setTimeout(() => {
      window.location.href = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    }, 1500);
    
    window.location.href = mapsUrl;
    window.addEventListener('blur', () => clearTimeout(timeout), { once: true });
    
  } else {
    mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    window.open(mapsUrl, '_blank');
  }
};