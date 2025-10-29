// Turbo Location Utilities - Sub-2s perceived time with 3-stage pipeline
import { base44 } from '@/api/base44Client';

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const FAST_FIX_TIMEOUT = 2000; // 2 seconds
const REFINE_TIMEOUT = 8000; // 8 seconds
const REFINE_ACCURACY_THRESHOLD = 50; // meters
const REFINE_DISTANCE_THRESHOLD = 30; // meters
const SUGGESTION_DEBOUNCE = 150; // ms

let activeWatchId = null;
let lastLocateTime = 0;
let suggestionCache = new Map();
let pendingRequests = new Set();

function roundCoords(lat, lng, decimals = 5) {
  return {
    lat: Number(lat.toFixed(decimals)),
    lng: Number(lng.toFixed(decimals))
  };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function getCachedLocation(user) {
  if (!user || !user.last_lat || !user.last_lng || !user.last_loc_ts) {
    return null;
  }
  
  const cacheAge = Date.now() - new Date(user.last_loc_ts).getTime();
  if (cacheAge > CACHE_EXPIRY_MS) {
    return null;
  }
  
  return {
    lat: user.last_lat,
    lng: user.last_lng,
    timestamp: user.last_loc_ts,
    source: 'cache',
    age_ms: cacheAge
  };
}

async function persistLocation(lat, lng, addresses = []) {
  try {
    await base44.auth.updateMe({
      last_lat: lat,
      last_lng: lng,
      last_loc_ts: new Date().toISOString(),
      last_addresses: addresses.slice(0, 5)
    });
  } catch (error) {
    console.error('Failed to persist location:', error);
  }
}

async function getFastSuggestions(lat, lng, useCache = true) {
  const rounded = roundCoords(lat, lng);
  const cacheKey = `${rounded.lat},${rounded.lng}`;
  
  if (useCache && suggestionCache.has(cacheKey)) {
    const cached = suggestionCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.suggestions;
    }
  }
  
  const requestId = `${cacheKey}-${Date.now()}`;
  pendingRequests.add(requestId);
  
  try {
    const { data } = await base44.functions.invoke('geocode', {
      action: 'reverse',
      lat,
      lng
    });
    
    if (!pendingRequests.has(requestId)) {
      return []; // Request was cancelled
    }
    
    const suggestions = (data.results || [])
      .slice(0, 5)
      .map(result => ({
        ...result,
        distance_m: result.distance_m || 0
      }));
    
    suggestionCache.set(cacheKey, {
      suggestions,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (suggestionCache.size > 50) {
      const oldestKey = suggestionCache.keys().next().value;
      suggestionCache.delete(oldestKey);
    }
    
    return suggestions;
  } catch (error) {
    console.error('Suggestion fetch error:', error);
    return [];
  } finally {
    pendingRequests.delete(requestId);
  }
}

function cancelPendingRequests() {
  pendingRequests.clear();
  if (activeWatchId !== null) {
    navigator.geolocation.clearWatch(activeWatchId);
    activeWatchId = null;
  }
}

export async function turboLocateMe({
  onCacheHit,
  onFastFix,
  onRefine,
  onError,
  onSuggestions,
  currentUser,
  forceHighAccuracy = false
}) {
  const startTime = Date.now();
  const timeSinceLastLocate = startTime - lastLocateTime;
  const skipCache = forceHighAccuracy || timeSinceLastLocate < 5000;
  
  lastLocateTime = startTime;
  cancelPendingRequests();
  
  const telemetry = {
    cache_used: false,
    fast_fix_ms: null,
    refine_fix_ms: null,
    suggestions_ms: null
  };
  
  // STAGE 1: Optimistic UI with cache
  if (!skipCache && currentUser) {
    const cached = await getCachedLocation(currentUser);
    if (cached) {
      telemetry.cache_used = true;
      
      onCacheHit({
        lat: cached.lat,
        lng: cached.lng,
        source: 'cache',
        loading: true
      });
      
      // Get suggestions from cache/fast lookup (NON-BLOCKING)
      getFastSuggestions(cached.lat, cached.lng, true).then(suggestions => {
        if (suggestions.length > 0 && onSuggestions) {
          onSuggestions(suggestions, 'cache');
        }
      });
    }
  }
  
  // STAGE 2: Fast fix (coarse GPS)
  let fastFixResolved = false;
  let currentBestFix = null;
  
  const fastFixPromise = new Promise((resolve) => {
    const fastTimeout = setTimeout(() => {
      if (!fastFixResolved) {
        resolve(null);
      }
    }, FAST_FIX_TIMEOUT);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (fastFixResolved) return;
        fastFixResolved = true;
        clearTimeout(fastTimeout);
        
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          source: 'fast_fix'
        };
        
        currentBestFix = coords;
        telemetry.fast_fix_ms = Date.now() - startTime;
        
        // IMMEDIATELY notify UI - don't wait for suggestions
        onFastFix(coords);
        
        // Get suggestions in background (NON-BLOCKING)
        getFastSuggestions(coords.lat, coords.lng, false).then(suggestions => {
          if (suggestions.length > 0 && onSuggestions) {
            onSuggestions(suggestions, 'fast_fix');
          }
          
          // Persist in background
          const addresses = suggestions.map(s => s.formatted_address);
          persistLocation(coords.lat, coords.lng, addresses);
        });
        
        resolve(coords);
      },
      (error) => {
        if (!fastFixResolved) {
          fastFixResolved = true;
          clearTimeout(fastTimeout);
          resolve(null);
        }
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: FAST_FIX_TIMEOUT
      }
    );
  });
  
  const fastFix = await fastFixPromise;
  
  if (!fastFix && !telemetry.cache_used) {
    onError({
      code: 'NO_FIX',
      message: "Couldn't get GPS. Try again or check GPS settings.",
      telemetry
    });
    return telemetry;
  }
  
  // STAGE 3: High-accuracy refine (silent upgrade)
  if (!skipCache || !fastFix) {
    activeWatchId = navigator.geolocation.watchPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          source: 'refine'
        };
        
        // Check if this is a meaningful improvement
        if (currentBestFix) {
          const distance = calculateDistance(
            currentBestFix.lat,
            currentBestFix.lng,
            coords.lat,
            coords.lng
          );
          
          if (coords.accuracy < REFINE_ACCURACY_THRESHOLD && distance > REFINE_DISTANCE_THRESHOLD) {
            telemetry.refine_fix_ms = Date.now() - startTime;
            currentBestFix = coords;
            
            onRefine(coords);
            
            // Silently update suggestions in background (NON-BLOCKING)
            getFastSuggestions(coords.lat, coords.lng, false).then(suggestions => {
              if (suggestions.length > 0 && onSuggestions) {
                onSuggestions(suggestions, 'refine');
              }
              
              // Persist in background
              const addresses = suggestions.map(s => s.formatted_address);
              persistLocation(coords.lat, coords.lng, addresses);
            });
            
            // Stop watching once we have a good fix
            cancelPendingRequests();
          }
        }
      },
      (error) => {
        // Silent failure for refine stage
        console.warn('Refine stage error:', error);
        cancelPendingRequests();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: REFINE_TIMEOUT
      }
    );
    
    // Auto-stop after timeout
    setTimeout(() => {
      cancelPendingRequests();
    }, REFINE_TIMEOUT);
  }
  
  console.log('[TurboLocate] Telemetry:', telemetry);
  return telemetry;
}

export function cancelTurboLocate() {
  cancelPendingRequests();
}