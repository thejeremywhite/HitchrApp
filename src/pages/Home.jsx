
import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card"; // New import
import { Search, List, Map as MapIcon, Truck, X, Zap, MessageSquare } from "lucide-react"; // MessageSquare new import
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import DriverCard from "../components/home/DriverCard";
import RequestCard from "../components/home/RequestCard";
import MapView from "../components/home/MapView";
import DriverCardSkeleton from "../components/skeletons/DriverCardSkeleton";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import AddressInput from "../components/AddressInput";
import DetailsSheet from "../components/home/DetailsSheet";
import { usePricing } from "@/components/usePricing";
import HitchrLogo from "../components/HitchrLogo";
import { redactName, redactAddress, jitterCoordinates, requireAuth } from "../components/DataRedaction";
import { openChat } from "../components/ChatHelpers";
import { formatAvailabilityStatus } from "../components/HotShotAvailabilityUtils"; // New import

const DEFAULT_CENTER = { lat: 51.6426, lng: -121.2960 };
const RADIUS_STEPS = [10, 25, 100, 200, 300];

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function Home() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('hitchr-viewMode') || 'list');
  const [searchText, setSearchText] = useState("");
  const [searchCenter, setSearchCenter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState(() => localStorage.getItem('hitchr.mode') || 'sender');
  const [sandboxMode, setSandboxMode] = useState(() => localStorage.getItem('hitchr.sandboxMode') === 'true');
  const [radiusKm, setRadiusKm] = useState(10);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const { calculatePrice } = usePricing();
  const [hotShotFilter, setHotShotFilter] = useState(false);

  useEffect(() => {
    const initUser = async () => {
      try {
        const authenticated = await base44.auth.isAuthenticated();
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          try {
            const user = await base44.auth.me();
            setCurrentUser(user);
          } catch (error) {
            // Silent fail - user not logged in is fine
          }
        }
      } catch (error) {
        // Silent fail - guests are allowed
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    };
    initUser();
  }, []);

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ['home-data', mode, sandboxMode],
    queryFn: async () => {
      try {
        if (mode === 'driver') {
          const allRequests = await base44.entities.Request.list();
          let filtered = allRequests.filter(r => r.status === 'open');
          if (!sandboxMode) {
            filtered = filtered.filter(r => !r.is_test_data);
          }
          return filtered.map(r => ({
            ...r,
            poster_name: r.sender_snapshot?.name || r.sender_profile_id || 'Sender',
            _isTestData: r.is_test_data || false,
            _type: 'request'
          }));
        } else {
          const [allAvails, testProfiles] = await Promise.all([
            base44.entities.DriverAvailability.list(),
            base44.entities.TestProfile.list()
          ]);
          
          let activeAvails = allAvails.filter(a => a.status === 'active');
          if (!sandboxMode) {
            activeAvails = activeAvails.filter(a => !a.is_test_data);
          }
          
          const drivers = [];
          for (const avail of activeAvails) {
            const profile = testProfiles.find(p => p.id === avail.driver_profile_id);
            if (!profile || !profile.location || !profile.location.lat || !profile.location.lng) continue;
            
            drivers.push({
              availability: avail,
              driver: {
                id: profile.id,
                full_name: profile.name,
                name: profile.name,
                email: profile.email,
                vehicle_type: profile.vehicle_type || 'car',
                categories_served: profile.categories_served || [],
                base_fee: profile.base_fee || 15,
                avatar_url: profile.avatar_url,
                current_latitude: profile.location.lat,
                current_longitude: profile.location.lng,
                from_latitude: avail.from_latitude,
                from_longitude: avail.from_longitude,
                to_latitude: avail.to_latitude,
                to_longitude: avail.to_longitude,
                _isTestData: avail.is_test_data || false,
                _type: 'driver'
              }
            });
          }
          return drivers;
        }
      } catch (error) {
        console.error('Error loading data:', error);
        return [];
      }
    },
    retry: 3,
    retryDelay: 1000,
    refetchInterval: 10000
  });

  const filteredData = useMemo(() => {
    if (rawData.length === 0) return { data: [], counts: { raw: 0, afterRadius: 0, afterCategory: 0, afterHotShot: 0, final: 0 } };
    
    const counts = { raw: rawData.length, afterRadius: 0, afterCategory: 0, afterHotShot: 0, final: 0 };
    
    const center = searchCenter || DEFAULT_CENTER;

    let afterRadius = rawData.filter(item => {
      // Hot Shot posts are ALWAYS visible regardless of radius
      if (mode === 'sender' && item._type === 'driver') {
        const availability = item.availability || {};
        if (availability.hot_shot) {
          item._distance = 0; // Hot Shot always shows at top
          return true;
        }
      }
      
      let originLat, originLng, destLat, destLng;
      
      if (mode === 'driver') {
        originLat = item.pickup_latitude;
        originLng = item.pickup_longitude;
        destLat = item.dropoff_latitude;
        destLng = item.dropoff_longitude;
      } else {
        originLat = item.availability?.from_latitude || item.driver?.from_latitude || item.driver?.current_latitude;
        originLng = item.availability?.from_longitude || item.driver?.from_longitude || item.driver?.current_longitude;
        destLat = item.availability?.to_latitude || item.driver?.to_latitude;
        destLng = item.availability?.to_longitude || item.driver?.to_longitude;
      }
      
      let originDistance = null;
      let destDistance = null;
      
      if (originLat != null && originLng != null) {
        originDistance = calculateDistance(center.lat, center.lng, originLat, originLng);
      }
      
      if (destLat != null && destLng != null) {
        destDistance = calculateDistance(center.lat, center.lng, destLat, destLng);
      }
      
      item._originDistance = originDistance;
      item._destDistance = destDistance;
      item._distance = Math.min(
        originDistance !== null ? originDistance : Infinity,
        destDistance !== null ? destDistance : Infinity
      );
      
      const inRadius = (originDistance !== null && originDistance <= radiusKm) || 
                       (destDistance !== null && destDistance <= radiusKm);
      
      return inRadius;
    });
    counts.afterRadius = afterRadius.length;

    let afterCategory = afterRadius;
    if (categoryFilter !== "all") {
      afterCategory = afterRadius.filter(item => {
        if (mode === 'driver') {
          return item.item_type === categoryFilter;
        } else {
          const categories = item.availability?.capacities || item.driver?.categories_served || [];
          return categories.includes(categoryFilter);
        }
      });
    }
    counts.afterCategory = afterCategory.length;

    let afterHotShot = afterCategory;
    if (hotShotFilter) {
      afterHotShot = afterCategory.filter(item => {
        if (mode === 'driver') {
          return item.urgency === 'ASAP' || item.urgency === 'Hot Shot' || item.is_hot_shot;
        } else {
          return item.availability?.hot_shot || item.driver?.hot_shot_capable;
        }
      });
    }
    counts.afterHotShot = afterHotShot.length;
    counts.final = afterHotShot.length;

    const sortedData = afterHotShot.sort((a, b) => {
      // Hot Shot posts always at top for sender mode
      const aIsHotShot = (mode === 'sender' && a._type === 'driver' && a.availability?.hot_shot);
      const bIsHotShot = (mode === 'sender' && b._type === 'driver' && b.availability?.hot_shot);
      if (aIsHotShot && !bIsHotShot) return -1;
      if (!aIsHotShot && bIsHotShot) return 1;
      
      return (a._distance || Infinity) - (b._distance || Infinity);
    });

    const redactedData = sortedData.map(item => {
      if (!isAuthenticated) {
        if (mode === 'driver') {
          const jitteredPickup = jitterCoordinates(item.pickup_latitude, item.pickup_longitude, true);
          const jitteredDropoff = item.dropoff_latitude && item.dropoff_longitude ? jitterCoordinates(item.dropoff_latitude, item.dropoff_longitude, true) : { lat: null, lng: null };

          return {
            ...item,
            poster_name: redactName(item.poster_name, true),
            pickup_address: redactAddress(item.pickup_address, true),
            dropoff_address: redactAddress(item.dropoff_address, true),
            pickup_latitude: jitteredPickup.lat,
            pickup_longitude: jitteredPickup.lng,
            dropoff_latitude: jitteredDropoff.lat,
            dropoff_longitude: jitteredDropoff.lng,
          };
        } else {
          const startLat = item.driver?.current_latitude || item.availability?.from_latitude;
          const startLng = item.driver?.current_longitude || item.availability?.from_longitude;
          const jitteredStartPoint = jitterCoordinates(startLat, startLng, true);
          
          const jitteredEndPoint = jitterCoordinates(
            item.availability?.to_latitude,
            item.availability?.to_longitude,
            true
          );
          
          return {
            ...item,
            driver: item.driver ? {
              ...item.driver,
              name: redactName(item.driver.name || item.driver.full_name, true),
              full_name: redactName(item.driver.full_name || item.driver.name, true),
              current_latitude: jitteredStartPoint.lat,
              current_longitude: jitteredStartPoint.lng,
            } : null,
            availability: item.availability ? {
              ...item.availability,
              from_address: redactAddress(item.availability.from_address, true),
              to_address: redactAddress(item.availability.to_address, true),
              from_latitude: jitteredStartPoint.lat,
              from_longitude: jitteredStartPoint.lng,
              to_latitude: jitteredEndPoint.lat,
              to_longitude: jitteredEndPoint.lng,
            } : null
          };
        }
      }
      return item;
    });
    
    return { data: redactedData, counts };
  }, [rawData, searchCenter, radiusKm, categoryFilter, hotShotFilter, mode, isAuthenticated]);

  useEffect(() => {
    const handleModeChange = (event) => {
        setMode(event.detail.mode);
        setRadiusKm(10);
        setSearchCenter(null);
        setSearchText("");
        queryClient.invalidateQueries({queryKey: ['home-data']});
    };
    
    const handleSandboxChange = (event) => {
        setSandboxMode(event.detail.enabled);
        setRadiusKm(10);
        setSearchCenter(null);
        setSearchText("");
        queryClient.invalidateQueries({queryKey: ['home-data']});
    };
    
    window.addEventListener('HITCHR_MODE_CHANGED', handleModeChange);
    window.addEventListener('HITCHR_SANDBOX_CHANGED', handleSandboxChange);

    return () => {
        window.removeEventListener('HITCHR_MODE_CHANGED', handleModeChange);
        window.removeEventListener('HITCHR_SANDBOX_CHANGED', handleSandboxChange);
    };
  }, [queryClient]);

  const handleViewChange = (newMode) => {
    setViewMode(newMode);
    localStorage.setItem('hitchr-viewMode', newMode);
  };

  const handleDriverToggle = () => {
    const newMode = mode === 'driver' ? 'sender' : 'driver';
    setMode(newMode);
    localStorage.setItem('hitchr.mode', newMode);
    window.dispatchEvent(new CustomEvent('HITCHR_MODE_CHANGED', { detail: { mode: newMode } }));
    queryClient.invalidateQueries({ queryKey: ['home-data'] });
  };
  
  const handleLocationUpdate = (locationData) => {
    if (locationData && locationData.lat && locationData.lng) {
      setSearchCenter({ 
        lat: locationData.lat, 
        lng: locationData.lng,
        name: locationData.address || "Search location"
      });
      setSearchText(locationData.address || "");
      setRadiusKm(10);
    }
  };

  const handleClearFilters = () => {
    setSearchText("");
    setSearchCenter(null);
    setCategoryFilter("all");
    setRadiusKm(10);
    setHotShotFilter(false);
  };

  const handleCycleRadius = () => {
    const currentIndex = RADIUS_STEPS.indexOf(radiusKm);
    const nextIndex = (currentIndex + 1) % RADIUS_STEPS.length;
    const nextRadius = RADIUS_STEPS[nextIndex];
    setRadiusKm(nextRadius);
  };

  const handleOpenOffer = async (item) => {
    // Hot Shot posts - only Message Driver action
    if (mode === 'sender' && item._type === 'driver' && item.availability?.hot_shot) {
      try {
        await openChat(
          item.driver?.id,
          {
            id: item.availability?.id || item.driver?.id,
            title: `Hot Shot: ${item.availability?.from_address?.split(',')[0]}`,
            roleOfOwner: 'driver'
          },
          navigate
        );
      } catch (error) {
        console.error("[HOME] Error opening Hot Shot chat:", error);
      }
      return;
    }
    
    // Regular offers
    try {
      if (mode === 'driver') {
        await openChat(
          item.poster_id || item.sender_profile_id,
          {
            id: item.id,
            title: `${item.pickup_address?.split(',')[0]} → ${item.dropoff_address?.split(',')[0]}`,
            roleOfOwner: 'sender'
          },
          navigate
        );
      } else {
        await openChat(
          item.driver?.id,
          {
            id: item.availability?.id || item.driver?.id,
            title: `${item.availability?.from_address?.split(',')[0]} → ${item.availability?.to_address?.split(',')[0]}`,
            roleOfOwner: 'driver'
          },
          navigate
        );
      }
    } catch (error) {
      console.error("[HOME] Error opening offer:", error);
    }
  };

  const handleChat = async (item) => {
    try {
      if (mode === 'driver') {
        await openChat(
          item.poster_id || item.sender_profile_id,
          {
            id: item.id,
            title: `${item.pickup_address?.split(',')[0]} → ${item.dropoff_address?.split(',')[0]}`,
            roleOfOwner: 'sender'
          },
          navigate
        );
      } else {
        await openChat(
          item.driver?.id,
          {
            id: item.availability?.id || item.driver?.id,
            title: `${item.availability?.from_address?.split(',')[0]} → ${item.availability?.to_address?.split(',')[0]}`,
            roleOfOwner: 'driver'
          },
          navigate
        );
      }
    } catch (error) {
      console.error("Error opening chat:", error);
    }
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailsSheet(true);
  };

  const modeColor = mode === 'driver' ? '#2FB5C0' : '#FF7A00';
  const modeColorLight = mode === 'driver' ? '#E6F9FB' : '#FFE8D6';

  const categories = [
    { value: "all", label: "All" },
    { value: "food", label: "Food" },
    { value: "auto_parts", label: "Auto Parts" },
    { value: "retail", label: "Retail" },
    { value: "firewood", label: "Firewood" },
    { value: "beer_run", label: "Beer Run" },
    { value: "rideshare", label: "Rideshare" },
    { value: "misc", label: "Misc" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white overflow-x-hidden">
      <div className="sticky top-0 z-40 bg-white border-b border-[var(--border)]" style={{ boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)', backgroundColor: '#FFFFFF' }}>
        <div className="max-w-lg mx-auto px-3 pt-3 pb-1.5 space-y-3">
          <div className="flex items-center justify-between gap-3">
             <div className="flex items-center gap-2">
                <HitchrLogo mode={mode} size={28} />
                <span className="font-bold text-lg" style={{ color: modeColor }}>Hitchr</span>
             </div>
          </div>
          <div className="relative">
            <AddressInput
              value={searchCenter ? searchCenter.name : searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                if (searchCenter) {
                  setSearchCenter(null);
                }
              }}
              placeholder={mode === 'driver' ? "Search requests..." : "Search drivers..."}
              className="h-9 rounded-xl border-[var(--border)] bg-white text-sm"
              name="main-search"
              onLocationUpdate={handleLocationUpdate}
            />
          </div>
          
          <div className="flex w-full items-center gap-1.5 pt-1.5">
            <Tabs value={viewMode} onValueChange={handleViewChange} className="flex-grow">
              <TabsList className="grid w-full grid-cols-2 h-9 rounded-xl bg-[var(--subtle-bg)] p-1">
                <TabsTrigger 
                  value="list" 
                  className="gap-1.5 rounded-lg text-sm h-full font-semibold" 
                  style={{ backgroundColor: viewMode === 'list' ? modeColor : 'transparent', color: viewMode === 'list' ? '#FFFFFF' : '#7C8B96' }}
                >
                  <List className="w-4 h-4" style={{ color: viewMode === 'list' ? '#FFFFFF' : '#7C8B96' }} />
                  List
                </TabsTrigger>
                <TabsTrigger 
                  value="map" 
                  className="gap-1.5 rounded-lg text-sm h-full font-semibold" 
                  style={{ backgroundColor: viewMode === 'map' ? modeColor : 'transparent', color: viewMode === 'map' ? '#FFFFFF' : '#7C8B96' }}
                >
                  <MapIcon className="w-4 h-4" style={{ color: viewMode === 'map' ? '#FFFFFF' : '#7C8B96' }} />
                  Map
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <button
              onClick={handleDriverToggle}
              className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all"
              style={{ 
                backgroundColor: mode === 'driver' ? modeColor : '#FFFFFF', 
                borderWidth: '2px', 
                borderColor: modeColor,
                boxShadow: mode === 'driver' ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}
              title={mode === 'driver' ? 'Switch to Sender Mode' : 'Switch to Driver Mode'}
            >
              <Truck 
                className="w-5 h-5" 
                style={{ 
                  color: mode === 'driver' ? '#FFFFFF' : modeColor,
                  stroke: mode === 'driver' ? '#FFFFFF' : modeColor,
                  strokeWidth: 2
                }} 
              />
            </button>
          </div>
          {mode === 'driver' && (
            <div className="text-center text-xs font-semibold py-1.5 rounded-lg" style={{ backgroundColor: modeColorLight, color: modeColor }}>
              Driver Mode Active
            </div>
          )}
        </div>
      </div>
      
      <div className="max-w-lg mx-auto w-full">
        <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className="pill-chip whitespace-nowrap h-8 px-4 rounded-full text-sm font-semibold transition-all flex-shrink-0"
                style={categoryFilter === cat.value ? {
                  backgroundColor: modeColor,
                  borderColor: modeColor,
                  color: '#FFFFFF'
                } : {
                  backgroundColor: 'transparent',
                  borderColor: '#E7E9EB',
                  color: '#333F48'
                }}
              >
                {cat.label}
              </button>
            ))}
            
            <button
              onClick={() => setHotShotFilter(!hotShotFilter)}
              className="pill-chip whitespace-nowrap h-8 px-4 rounded-full text-sm font-semibold flex-shrink-0 flex items-center gap-1"
              style={hotShotFilter ? {
                backgroundColor: modeColor,
                borderColor: modeColor,
                color: '#FFFFFF'
              } : {
                backgroundColor: 'transparent',
                borderColor: '#E7E9EB',
                color: '#333F48'
              }}
            >
              <Zap className="w-3.5 h-3.5" style={{ color: hotShotFilter ? '#FFFFFF' : '#333F48' }} />
              Hot Shot
            </button>
            
            {(searchCenter || categoryFilter !== "all" || radiusKm !== 10 || hotShotFilter || searchText.trim()) && (
              <button
                onClick={handleClearFilters}
                className="pill-chip whitespace-nowrap h-8 px-4 rounded-full text-sm font-semibold flex-shrink-0"
                style={{ borderColor: '#E84C3D', color: '#E84C3D', backgroundColor: 'transparent' }}
              >
                <X className="w-3 h-3 mr-1 inline" />
                Clear
              </button>
            )}
        </div>
      </div>

      {searchCenter && (
        <div className="max-w-lg mx-auto w-full px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[#6B7280]">
              <strong>{filteredData.counts.final}</strong> {mode === 'driver' ? 'requests' : 'drivers'} within{' '}
              <strong>{radiusKm}km</strong> of {searchCenter.name?.split(',')[0]}
            </div>
            <button
              onClick={handleCycleRadius}
              className="text-xs font-semibold px-3 py-1 rounded-full transition-all"
              style={{ 
                backgroundColor: modeColorLight, 
                color: modeColor,
                border: `1px solid ${modeColor}`
              }}
            >
              {radiusKm}km → {RADIUS_STEPS[(RADIUS_STEPS.indexOf(radiusKm) + 1) % RADIUS_STEPS.length]}km
            </button>
          </div>
        </div>
      )}

      {viewMode === "list" ? (
        <div className="max-w-lg mx-auto w-full px-2 py-2 space-y-2 flex-1 pb-24 overflow-x-hidden">
          {isLoading ? (
             <div className="space-y-2">
                {[...Array(3)].map((_, i) => <DriverCardSkeleton key={i} />)}
             </div>
          ) : filteredData.data.length === 0 ? (
            <div className="text-center py-12 px-6">
              <h3 className="text-base font-semibold mb-1.5">
                {mode === 'driver' ? 'No requests found' : 'No drivers found'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                {searchCenter 
                  ? `No active posts within ${radiusKm}km of ${searchCenter.name}`
                  : 'Try adjusting your filters or searching for a location.'}
              </p>
              <Button onClick={handleClearFilters} variant="outline">
                Clear Filters
              </Button>
            </div>
          ) : (
            filteredData.data.slice(0, 50).map((item) => {
              // Render Hot Shot cards differently
              if (mode === 'sender' && item._type === 'driver' && item.availability?.hot_shot) {
                const config = item.availability.hot_shot_config || {};
                const availStatus = formatAvailabilityStatus(
                  config.availableNow,
                  config.availableUntil,
                  config.nextAvailable,
                  item.availability?.timezone
                );
                
                return (
                  <Card key={item.driver.id} className="p-3 rounded-xl bg-white border border-[#E5E7EB]">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Badge className="mb-2 bg-[#FF7A00] text-white">
                            <Zap className="w-3 h-3 mr-1" />
                            HOT SHOT
                          </Badge>
                          <p className="font-semibold text-sm">
                            {isAuthenticated ? (item.driver?.name || 'Driver') : redactName(item.driver?.name, true)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {isAuthenticated ? item.availability.from_address : redactAddress(item.availability.from_address, true)}
                          </p>
                          <div className="mt-2 text-xs text-gray-600 space-y-1">
                            <p>Max Distance: {config.maxDistanceKm}km</p>
                            <p>Max Time: {config.maxTimeMin} min</p>
                            <p>Base Fee: ${config.baseFeeCad}</p>
                          </div>
                          {availStatus && (
                            <div className={cn("mt-2 px-2 py-1 rounded-full text-[10px] font-semibold inline-block", availStatus.color)}>
                              {availStatus.text}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleOpenOffer(item)}
                        size="sm"
                        className="w-full h-8 text-xs bg-[#2FB5C0] hover:bg-[#28A3AD]"
                      >
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Message Driver
                      </Button>
                    </div>
                  </Card>
                );
              }
              
              // Regular cards
              return mode === 'driver'
                ? <RequestCard 
                    key={item.id} 
                    request={item} 
                    currentUser={currentUser}
                    isGuest={!isAuthenticated}
                    onView={() => handleViewDetails(item)}
                    onOffer={() => handleOpenOffer(item)}
                    onChat={() => handleChat(item)}
                  />
                : <DriverCard 
                    key={item.driver.id} 
                    availability={item.availability} 
                    driver={item.driver} 
                    currentUser={currentUser}
                    isGuest={!isAuthenticated}
                    onView={() => handleViewDetails(item)}
                    onOffer={() => handleOpenOffer(item)}
                    onChat={() => handleChat(item)}
                  />;
            })
          )}
        </div>
      ) : (
        <div className="flex-1 relative pb-24">
          <MapView 
            data={filteredData.data.slice(0, 100)} 
            userLocation={searchCenter || DEFAULT_CENTER}
            radiusKm={radiusKm}
            mode={mode} 
            isGuest={!isAuthenticated}
            className="h-full w-full" 
          />
        </div>
      )}

      <DetailsSheet
        item={selectedItem}
        mode={mode}
        isGuest={!isAuthenticated}
        open={showDetailsSheet}
        onClose={() => setShowDetailsSheet(false)}
        onOffer={() => {
          setShowDetailsSheet(false);
          handleOpenOffer(selectedItem);
        }}
        onChat={() => {
          setShowDetailsSheet(false);
          handleChat(selectedItem);
        }}
      />
    </div>
  );
}
