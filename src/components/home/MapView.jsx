
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Crosshair, Loader2, Package, MessageSquare, Tag, MoreHorizontal, Utensils, Wrench, ShoppingBag, Flame, FileText, ShoppingCart, Hammer, MapPin, Clock, DollarSign, Beer, Users, Repeat, Zap, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { toast } from "sonner";
import { format } from "date-fns";
import { useETA } from "@/components/useETA";
import { jitterCoordinates } from "../DataRedaction";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const categoryIcons = {
  food: Utensils,
  auto_parts: Wrench,
  retail: ShoppingBag,
  firewood: Flame,
  misc: Package,
  ride_share: Users,
  documents: FileText,
  groceries: ShoppingCart,
  hardware_tools: Hammer,
  parcels: Package,
  beer_run: Beer,
  rideshare: Users
};

function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], 12);
    }
  }, [center, map]);
  return null;
}

function RecenterButton() { 
    const map = useMap();
    const [isLocating, setIsLocating] = useState(false);

    const handleClick = () => {
        setIsLocating(true);
        map.locate().on("locationfound", function (e) {
            map.flyTo(e.latlng, 14);
            setIsLocating(false);
            // Removed toast.success("Location updated"); as per outline to prevent potential duplication if added elsewhere
        }).on("locationerror", function(e) {
            toast.error("Location unavailable"); // Modified toast message as per outline
            setIsLocating(false);
        });
    }

    return (
        <div className="leaflet-bottom leaflet-right mb-4 mr-2 z-[1000]">
             <Button 
                size="icon" 
                onClick={handleClick} 
                className="h-12 w-12 rounded-full bg-white text-[var(--primary)] border-2 border-[var(--primary)] shadow-lg hover:bg-gray-100"
                aria-label="Recenter map"
                disabled={isLocating}
             >
                {isLocating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Crosshair className="w-6 h-6" />}
            </Button>
        </div>
    )
}

function ResizeOnMount() {
  const map = useMap();
  useEffect(() => {
    requestAnimationFrame(() => map.invalidateSize());
  }, [map]);
  return null;
}

export default function MapView({ data, userLocation, radiusKm = 150, mode, isGuest, className }) {
  const navigate = useNavigate();
  const { computeETA } = useETA();
  const defaultCenter = userLocation || { lat: 43.65, lng: -79.38 };

  // Pin color based on what you're viewing
  const pinColor = mode === 'sender' ? '#00B8B8' : '#FF7A00';

  const createCustomIcon = (color) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        width: 32px;
        height: 32px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const pinIcon = createCustomIcon(pinColor);

  // Create icon for search center
  const centerIcon = L.divIcon({
    className: 'center-marker',
    html: `<div style="
      width: 16px;
      height: 16px;
      background-color: #1976D2;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  return (
    <div className={`h-[calc(100vh-250px)] ${className || ''}`}>
      <style>{`
        /* Custom popup styling for maximum readability */
        .compact-popup .leaflet-popup-content-wrapper {
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(4px);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 16px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
          padding: 0 !important;
        }
        
        .compact-popup .leaflet-popup-content {
          margin: 16px !important;
          font-size: 15px;
        }
        
        .compact-popup .leaflet-popup-close-button {
          top: 10px !important;
          right: 10px !important;
          color: '#1A1A1A' !important;
          font-size: 22px !important;
          font-weight: bold !important;
        }
        
        .compact-popup .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(4px);
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
      `}</style>
      
      <MapContainer
        center={[defaultCenter.lat, defaultCenter.lng]}
        zoom={12}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ResizeOnMount />
        <MapController center={defaultCenter} />
        <RecenterButton />
        
        {/* Search center marker */}
        <Marker
          position={[defaultCenter.lat, defaultCenter.lng]}
          icon={centerIcon}
        >
          <Popup>
            <div className="text-sm font-semibold">Search Center</div>
            <div className="text-xs text-gray-600">Radius: {radiusKm}km</div>
          </Popup>
        </Marker>
        
        {/* Radius circle */}
        <Circle
          center={[defaultCenter.lat, defaultCenter.lng]}
          radius={radiusKm * 1000} // Convert km to meters
          pathOptions={{
            fillColor: pinColor,
            fillOpacity: 0.05,
            color: pinColor,
            weight: 2,
            opacity: 0.3,
            dashArray: '5, 10'
          }}
        />
        
        {/* Data markers */}
        {data.map((item) => {
            let position, displayName, ItemIcon;
            let lat, lng;

            if (mode === 'driver') {
              // Driver mode - showing requests
              lat = item.pickup_latitude;
              lng = item.pickup_longitude;
              displayName = item.poster_name ? item.poster_name.split(' ')[0] : 'Sender';
              ItemIcon = categoryIcons[item.item_type] || Package;
            } else {
              // Sender mode - showing drivers
              lat = item.availability?.from_latitude || item.driver?.from_latitude || item.driver?.current_latitude;
              lng = item.availability?.from_longitude || item.driver?.from_longitude || item.driver?.current_longitude;
              displayName = item.driver?.full_name ? item.driver.full_name.split(' ')[0] : 
                           item.driver?.name ? item.driver.name.split(' ')[0] : 'Driver';
            }
            
            if (lat == null || lng == null) {
              console.warn('Missing coordinates for item:', item);
              return null;
            }

            let finalLat = lat;
            let finalLng = lng;

            if (isGuest) {
                const jittered = jitterCoordinates(finalLat, finalLng, true);
                finalLat = jittered.lat;
                finalLng = jittered.lng;
            }
            
            position = [finalLat, finalLng];

            const etaInfo = mode === 'driver' ? computeETA(item) : computeETA({ availability: item.availability, driver: item.driver });

            return (
              <Marker
                key={mode === 'driver' ? item.id : item.driver.id}
                position={position}
                icon={pinIcon}
              >
                <Popup className="compact-popup" minWidth={240} maxWidth={300}>
                  {mode === 'driver' ? (
                    <div className="p-0" style={{ maxWidth: '280px' }}>
                      <div className="flex items-center gap-3 mb-3">
                        <div 
                          className="w-14 h-14 rounded-full flex items-center justify-center text-white flex-shrink-0"
                          style={{ backgroundColor: pinColor }}
                        >
                          <ItemIcon className="w-7 h-7"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[18px] truncate leading-tight" style={{ color: '#1A1A1A' }}>
                            {displayName}
                          </p>
                          <p className="text-[16px] capitalize truncate mt-1" style={{ color: '#555555' }}>
                            {item.item_type?.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      
                      {etaInfo && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1.5 text-[15px] font-semibold mb-2" style={{ color: '#1A1A1A' }}>
                            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: pinColor }} />
                            <span className="truncate">
                              {etaInfo.originName} → {etaInfo.destName}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {etaInfo ? (
                        <div className="text-[16px] space-y-2 mb-4" style={{ color: '#555555' }}>
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 flex-shrink-0" />
                            <span className="truncate">Deliver by {format(etaInfo.departAt, 'h:mm a')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[16px] mb-4" style={{ color: '#555555' }}>Delivery time TBD</div>
                      )}
                      
                      {/* Hot Shot indicator for request */}
                      {(item.urgency === 'ASAP' || item.urgency === 'Hot Shot' || item.is_hot_shot) && (
                        <div className="mb-4">
                          <div
                            className="flex items-center gap-1 rounded-full inline-flex"
                            style={{ 
                              backgroundColor: '#F9F9F9',
                              border: '1px solid #E0E0E0',
                              height: '20px',
                              fontSize: '11px',
                              fontWeight: '500',
                              color: '#222222',
                              paddingLeft: '6px',
                              paddingRight: '8px',
                              paddingTop: '2px',
                              paddingBottom: '2px'
                            }}
                          >
                            <Zap className="w-3 h-3" style={{ color: '#222222', stroke: '#222222' }} />
                            <span style={{ color: '#222222' }}>Hot Shot</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          size="sm" 
                          className="h-11 text-[16px] px-4 font-bold rounded-lg transition-all" 
                          style={{ 
                            backgroundColor: pinColor, 
                            color: '#FFFFFF',
                            border: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#E66D00';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = pinColor;
                          }}
                          onClick={() => navigate(createPageUrl("Chat") + `?request_id=${item.id}`)}
                        >
                          <MessageSquare className="w-5 h-5 mr-2" />Chat
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-11 text-[16px] px-4 font-bold rounded-lg transition-all" 
                          style={{ 
                            borderColor: pinColor, 
                            color: pinColor,
                            backgroundColor: '#FFFFFF',
                            borderWidth: '2px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 122, 0, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                          }}
                          onClick={() => navigate(createPageUrl("RequestDetails") + `?request_id=${item.id}`)}
                        >
                          <MoreHorizontal className="w-5 h-5 mr-2" />More
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-0" style={{ maxWidth: '280px' }}>
                      <div className="flex items-center gap-3 mb-3">
                        {item.driver?.avatar_url ? (
                          <img src={item.driver.avatar_url} alt={displayName} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div 
                            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-[18px] flex-shrink-0"
                            style={{ backgroundColor: pinColor }}
                          >
                            {displayName.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[18px] truncate leading-tight" style={{ color: '#1A1A1A' }}>
                            {displayName}
                          </p>
                          {item.driver?.vehicle_type && (
                            <p className="text-[16px] capitalize truncate mt-1" style={{ color: '#555555' }}>
                              {item.driver.vehicle_type}
                            </p>
                          )}
                          {item.driver?.rating && item.driver.num_ratings != null && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-4 h-4" style={{ color: '#FFD700', fill: '#FFD700' }} />
                              <span className="text-[14px] font-medium" style={{ color: '#555555' }}>
                                {item.driver.rating.toFixed(1)} ({item.driver.num_ratings})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {etaInfo && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1.5 text-[15px] font-semibold mb-2" style={{ color: '#1A1A1A' }}>
                            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: pinColor }} />
                            <span className="truncate">
                              {etaInfo.originName} → {etaInfo.destName}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {etaInfo ? (
                        <div className="text-[16px] space-y-2 mb-4" style={{ color: '#555555' }}>
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 flex-shrink-0" />
                            <span className="truncate">Leaving {format(etaInfo.departAt, 'h:mm a')}</span>
                          </div>
                          {etaInfo.etaAt && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-5 h-5 flex-shrink-0" />
                              <span className="truncate">ETA {format(etaInfo.etaAt, 'h:mm a')}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[16px] mb-4" style={{ color: '#555555' }}>Time TBD</div>
                      )}
                      
                      {item.driver && (
                        <div className="flex gap-1.5 mb-4 flex-wrap">
                          {/* Recurring indicator */}
                          {item.availability?.recurring_pattern && item.availability.recurring_pattern !== 'None' && (
                            <div
                              className="flex items-center gap-0.5 rounded-full"
                              style={{ 
                                backgroundColor: '#F9F9F9',
                                border: '1px solid #E0E0E0',
                                height: '20px',
                                fontSize: '11px',
                                fontWeight: '500',
                                color: '#222222',
                                paddingLeft: '6px',
                                paddingRight: '8px',
                                paddingTop: '2px',
                                paddingBottom: '2px'
                              }}
                            >
                              <Repeat className="w-3 h-3" style={{ color: '#222222', stroke: '#222222' }} />
                              <span style={{ color: '#222222' }}>Recurring</span>
                            </div>
                          )}
                          
                          {/* Hot Shot indicator */}
                          {(item.availability?.hot_shot || item.driver?.hot_shot_capable) && (
                            <div
                              className="flex items-center gap-0.5 rounded-full"
                              style={{ 
                                backgroundColor: '#F9F9F9',
                                border: '1px solid #E0E0E0',
                                height: '20px',
                                fontSize: '11px',
                                fontWeight: '500',
                                color: '#222222',
                                paddingLeft: '6px',
                                paddingRight: '8px',
                                paddingTop: '2px',
                                paddingBottom: '2px'
                              }}
                            >
                              <Zap className="w-3 h-3" style={{ color: '#222222', stroke: '#222222' }} />
                              <span style={{ color: '#222222' }}>Hot Shot</span>
                            </div>
                          )}
                          
                          {/* Category pills */}
                          {(item.availability?.capacities || item.driver.categories_served || [])
                            .slice(0, 3)
                            .map((cat, idx) => {
                            const Icon = categoryIcons[cat] || Package;
                            const label = (cat || 'misc').replace('_', ' ');
                            const displayLabel = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
                            return (
                              <div
                                key={idx}
                                className="flex items-center gap-0.5 rounded-full"
                                style={{ 
                                  backgroundColor: '#F9F9F9',
                                  border: '1px solid #E0E0E0',
                                  height: '20px',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  color: '#222222',
                                  paddingLeft: '6px',
                                  paddingRight: '8px',
                                  paddingTop: '2px',
                                  paddingBottom: '2px'
                                }}
                              >
                                <Icon className="w-3 h-3" style={{ color: '#222222', stroke: '#222222' }} />
                                <span style={{ color: '#222222' }}>{displayLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          size="sm" 
                          className="h-11 text-[16px] px-4 font-bold rounded-lg transition-all"
                          style={{ 
                            backgroundColor: pinColor, 
                            color: '#FFFFFF',
                            border: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#009999';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = pinColor;
                          }}
                          onClick={() => navigate(createPageUrl("Post") + `?driver_id=${item.driver.id}&is_test=${item.driver._isTestData || false}`)}
                        >
                          <Tag className="w-5 h-5 mr-2" />Offer
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-11 text-[16px] px-4 font-bold rounded-lg transition-all"
                          style={{ 
                            borderColor: pinColor, 
                            color: pinColor,
                            backgroundColor: '#FFFFFF',
                            borderWidth: '2px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 184, 184, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                          }}
                          onClick={() => navigate(createPageUrl("DriverDetails") + `?driver_id=${item.driver.id}&is_test=${item.driver._isTestData || false}`)}
                        >
                          <MoreHorizontal className="w-5 h-5 mr-2" />More
                        </Button>
                      </div>
                    </div>
                  )}
                  {isGuest && (
                    <p className="text-[14px] text-center mt-3 font-semibold" style={{ color: '#1976D2' }}>
                      Sign in for exact location
                    </p>
                  )}
                </Popup>
              </Marker>
            )
        })}
      </MapContainer>
    </div>
  );
}
