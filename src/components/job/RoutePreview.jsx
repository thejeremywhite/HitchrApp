import React from "react";
import { Card } from "@/components/ui/card";
import { MapPin, Navigation, Clock } from "lucide-react";
import { format } from "date-fns";

export default function RoutePreview({ 
  fromAddress, 
  toAddress, 
  fromLat, 
  fromLng, 
  toLat, 
  toLng,
  eta,
  distance,
  currentLat,
  currentLng
}) {
  // Calculate rough straight-line distance if not provided
  const calcDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  const distKm = distance || (fromLat && fromLng && toLat && toLng ? 
    calcDistance(fromLat, fromLng, toLat, toLng) : 0);

  return (
    <Card className="p-4 bg-white border-[#E5E7EB]">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div className="w-0.5 h-8 bg-gray-300 my-1" />
            <div className="w-3 h-3 rounded-full bg-red-500" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-xs text-gray-500">From</p>
              <p className="font-semibold text-sm">{fromAddress?.split(',')[0] || 'Pickup Location'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">To</p>
              <p className="font-semibold text-sm">{toAddress?.split(',')[0] || 'Dropoff Location'}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Navigation className="w-3 h-3" />
            <span>{distKm.toFixed(1)} km</span>
          </div>
          {eta && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Clock className="w-3 h-3" />
              <span>ETA {format(new Date(eta), 'h:mm a')}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}