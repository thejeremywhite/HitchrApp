// Location utility functions for Hitchr - using backend geocode function
import { base44 } from '@/api/base44Client';

export async function getCurrentLatLng() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: position.timestamp
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 120000 // 2 minutes
      }
    );
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function reverseGeocode(lat, lng) {
  try {
    const { data } = await base44.functions.invoke('geocode', {
      action: 'reverse',
      lat,
      lng
    });
    
    if (data.results && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.error('Reverse geocode error:', error);
    throw error;
  }
}

export async function getNearbyAddresses(lat, lng) {
  try {
    const { data } = await base44.functions.invoke('geocode', {
      action: 'reverse',
      lat,
      lng
    });
    
    return data.results || [];
  } catch (error) {
    console.error('Get nearby addresses error:', error);
    // Fallback to coordinates
    return [{
      formatted_address: `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      lat,
      lng,
      place_id: 'coords',
      provider: 'nominatim',
      distance_m: 0,
      interpolated: false,
      is_exact: true,
      is_fallback: true
    }];
  }
}

export async function searchAddresses(query, centerLat = null, centerLng = null) {
  try {
    const { data } = await base44.functions.invoke('geocode', {
      action: 'forward',
      query,
      centerLat,
      centerLng
    });
    
    return data.results || [];
  } catch (error) {
    console.error('Search addresses error:', error);
    return [];
  }
}