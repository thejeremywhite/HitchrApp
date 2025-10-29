/**
 * Redact name to first name + initial for guests
 */
export function redactName(fullName, isGuest) {
  if (!isGuest || !fullName) return fullName;
  
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

/**
 * Redact address to city/area only for guests
 */
export function redactAddress(address, isGuest) {
  if (!isGuest || !address) return address;
  
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts.slice(-2).join(',').trim();
  }
  
  return address;
}

/**
 * Add random jitter to coordinates for guest privacy
 */
export function jitterCoordinates(lat, lng, isGuest) {
  if (!isGuest || !lat || !lng) return { lat, lng };
  
  const jitterAmount = 0.0015 + (Math.random() * 0.0005);
  const jitterLat = lat + (Math.random() - 0.5) * jitterAmount * 2;
  const jitterLng = lng + (Math.random() - 0.5) * jitterAmount * 2;
  
  return { lat: jitterLat, lng: jitterLng };
}

/**
 * Wrapper for actions that require auth - NO TOAST, just redirect
 */
export function requireAuth(action, isAuthenticated) {
  return (...args) => {
    if (!isAuthenticated) {
      sessionStorage.setItem('hitchr.pendingAction', JSON.stringify({
        type: action.name || 'action',
        args: args,
        timestamp: Date.now()
      }));
      
      import('@/api/base44Client').then(({ base44 }) => {
        base44.auth.redirectToLogin(window.location.pathname);
      });
      
      return;
    }
    
    return action(...args);
  };
}