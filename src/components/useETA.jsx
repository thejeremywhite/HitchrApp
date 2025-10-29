import { useMemo } from 'react';

// Haversine distance calculation
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export function useETA() {
  const computeETA = useMemo(() => {
    return (item) => {
      // Extract data based on mode
      const isDriver = !!item.availability || !!item.driver;
      const availability = isDriver ? item.availability : null;
      const request = !isDriver ? item : null;

      // Get departure time with back-compat
      let departAt = availability?.depart_at || availability?.window_start || request?.deliver_by || request?.ready_by || request?.ready_at;
      if (!departAt) return null;

      // Get coordinates
      const fromLat = availability?.from_latitude || request?.pickup_latitude;
      const fromLng = availability?.from_longitude || request?.pickup_longitude;
      const toLat = availability?.to_latitude || request?.dropoff_latitude;
      const toLng = availability?.to_longitude || request?.dropoff_longitude;

      if (!fromLat || !fromLng || !toLat || !toLng) return null;

      // Get origin/destination names
      const fromAddress = availability?.from_address || request?.pickup_address || '';
      const toAddress = availability?.to_address || request?.dropoff_address || '';
      const originName = fromAddress.split(',')[0] || 'Origin';
      const destName = toAddress.split(',')[0] || 'Destination';

      // Calculate distance and duration (fallback method)
      const distanceKm = calculateDistance(fromLat, fromLng, toLat, toLng);
      const avgSpeedKmh = 70; // Rural average
      const durationSeconds = (distanceKm / avgSpeedKmh) * 3600;

      // Compute ETA
      const departDate = new Date(departAt);
      const etaDate = new Date(departDate.getTime() + durationSeconds * 1000);

      return {
        originName,
        destName,
        departAt: departDate,
        etaAt: etaDate,
        returnDepartAt: availability?.return_depart_at ? new Date(availability.return_depart_at) : null,
        bufferTag: '(estimate)', // Could be "(± ~10m)" if routing API used
        distanceKm: Math.round(distanceKm)
      };
    };
  }, []);

  return { computeETA };
}