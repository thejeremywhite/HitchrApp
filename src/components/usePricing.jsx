import { useMemo } from 'react';

const BASE_RATE = 0.35; // per km
const CATEGORY_ADDONS = {
  groceries: 0,
  parcels: 0,
  food: 0,
  auto_parts: 5,
  heavy_haul: 15,
  special_transport: 25,
  liquids: 5,
  passengers: 0,
  retail: 0,
  firewood: 10,
  misc: 0,
  beer_run: 10, // Base addon for Beer Run
  rideshare: 0
};

const FLOOR_PRICE = 10;
const BEER_RUN_BASE = 25; // Base fee for beer run
const RIDESHARE_PER_SEAT = 5; // Additional per seat

export function usePricing() {
  const calculatePrice = useMemo(() => {
    return (distanceKm, category = 'misc', extraData = {}) => {
      // Special pricing for Beer Run
      if (category === 'beer_run') {
        const basePrice = distanceKm * BASE_RATE;
        const total = BEER_RUN_BASE + basePrice + (CATEGORY_ADDONS[category] || 0);
        return Math.round(total * 1.2); // +20% for after-hours
      }
      
      // Special pricing for Rideshare
      if (category === 'rideshare') {
        const basePrice = distanceKm * BASE_RATE;
        const seats = extraData.seats || 1;
        const seatFee = (seats - 1) * RIDESHARE_PER_SEAT;
        const total = basePrice + seatFee;
        return Math.max(Math.round(total), FLOOR_PRICE);
      }
      
      // Standard pricing
      const basePrice = distanceKm * BASE_RATE;
      const addon = CATEGORY_ADDONS[category] || 0;
      const total = basePrice + addon;
      const rounded = Math.round(total);
      return Math.max(rounded, FLOOR_PRICE);
    };
  }, []);

  return { calculatePrice };
}