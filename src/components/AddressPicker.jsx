
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Crosshair, MapPin, Clock, Target, BookOpen, Loader2, Search, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentLatLng, reverseGeocode } from './LocationUtils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

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

function extractHouseNumber(text) {
  const match = text.match(/^\s*(\d{1,6})\s+(.+)/);
  if (match) {
    return { number: match[1], street: match[2] };
  }
  return null;
}

function composeAddress(number, street) {
  return `${number} ${street.trim()}`.replace(/\s+/g, ' ').trim();
}

export default function AddressPicker({
  value,
  onChange,
  onLocationUpdate,
  placeholder = "Enter address",
  className = "",
  name = "address",
  required = false,
  error = null,
  sheetOpen = false,
  onSheetClose = () => {}
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLocating, setIsLocating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedStreet, setSelectedStreet] = useState(null);
  const [pendingNumber, setPendingNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const lastValueRef = useRef(value);

  // Debounced search query for geocoding API
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms delay for debouncing

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        // Silent fail - guests can still type addresses
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const loadLocation = async () => {
      try {
        const coords = await getCurrentLatLng();
        setUserLocation(coords);
      } catch (error) {
        // Silent fail
      }
    };
    loadLocation();
  }, []);

  // Query saved addresses (active only)
  const { data: savedAddresses = [] } = useQuery({
    queryKey: ['addresses', currentUser?.id],
    queryFn: async () => {
      const allAddresses = await base44.entities.Address.list('-updated_date');
      return allAddresses.filter(a => a.user_id === currentUser.id && !a.is_deleted);
    },
    enabled: !!currentUser,
  });

  const updateLastUsedMutation = useMutation({
    mutationFn: async (addressId) => {
      return await base44.entities.Address.update(addressId, {
        last_used: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    }
  });

  // Query for geocoding suggestions
  const { data: geocodingSuggestions = [], isLoading: isLoadingSuggestions } = useQuery({
    queryKey: ['geocodingSuggestions', debouncedSearchQuery],
    queryFn: async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.length < 3) return [];
      const result = await base44.geocoding.autocomplete(debouncedSearchQuery);
      return result.features.map(feature => ({
        full_address: feature.properties.formatted,
        address_text: feature.properties.formatted, // Using formatted as address_text for consistency
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
        place_id: feature.properties.place_id,
        source: 'geocoding'
      }));
    },
    enabled: !!debouncedSearchQuery && debouncedSearchQuery.length >= 3,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    keepPreviousData: true, // Keep previous data while fetching new ones
  });

  // Handle house number composition
  useEffect(() => {
    const currentValue = value || '';
    const previousValue = lastValueRef.current || '';
    
    const digitMatch = currentValue.match(/^(\d{1,6})\s*$/);
    if (digitMatch) {
      setPendingNumber(digitMatch[1]);
    }
    
    if (selectedStreet && currentValue.startsWith(pendingNumber) && pendingNumber) {
      const composedAddress = composeAddress(pendingNumber, selectedStreet);
      onChange({ target: { value: composedAddress } });
      
      if (onLocationUpdate) {
        onLocationUpdate({
          address: composedAddress,
          lat: null, // We don't have lat/lng for composed addresses unless we geocode it again
          lng: null,
          place_id: null,
          pending_geocode: true,
          source: 'composed'
        });
      }
      
      toast.success(`Address set to ${composedAddress}`);
      setPendingNumber('');
      setSelectedStreet(null);
    }
    
    if (selectedStreet && !currentValue.match(/^\d/) && previousValue.match(/^\d/)) {
      onChange({ target: { value: selectedStreet } });
      setPendingNumber('');
    }
    
    lastValueRef.current = currentValue;
  }, [value, selectedStreet, pendingNumber, onChange, onLocationUpdate]);

  const handleSelectAddress = (address) => {
    const addressText = address.address_text || address.full_address;
    
    if (pendingNumber) {
      const composedAddress = composeAddress(pendingNumber, addressText);
      onChange({ target: { value: composedAddress } });
      
      if (onLocationUpdate) {
        onLocationUpdate({
          address: composedAddress,
          lat: address.latitude || null, // Use lat/lng from geocoding if available, otherwise null
          lng: address.longitude || null,
          place_id: address.place_id || null,
          pending_geocode: !address.latitude || !address.longitude, // Still pending if no coordinates from suggestion
          source: address.source === 'geocoding' ? 'composed_geocoded' : 'composed'
        });
      }
      
      if (address.id && address.source === 'saved') { // Only update last_used for saved addresses
        updateLastUsedMutation.mutate(address.id);
      }
      
      toast.success(`Address set to ${composedAddress}`);
      setPendingNumber('');
      setSelectedStreet(null);
    } else {
      const hasHouseNumber = /^\d{1,6}\s/.test(addressText);
      
      if (!hasHouseNumber && address.source !== 'geocoding') { // If it's a street from saved addresses without a number
        setSelectedStreet(addressText);
      }
      
      onChange({ target: { value: addressText } });
      
      if (onLocationUpdate) {
        onLocationUpdate({
          address: addressText,
          lat: address.latitude,
          lng: address.longitude,
          place_id: address.place_id,
          pending_geocode: !hasHouseNumber && (!address.latitude || !address.longitude),
          source: address.source // 'saved' or 'geocoding'
        });
      }

      if (address.id && address.source === 'saved') {
        updateLastUsedMutation.mutate(address.id);
      }

      if (!hasHouseNumber && address.source !== 'geocoding') { // Only show info for saved streets
        toast.info("You can now type a house number at the start");
      } else {
        toast.success("Address selected");
      }
    }

    onSheetClose();
    setSearchQuery('');
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const coords = await getCurrentLatLng();
      const address = await reverseGeocode(coords.lat, coords.lng);
      
      onChange({ target: { value: address } });
      
      if (onLocationUpdate) {
        onLocationUpdate({
          address,
          lat: coords.lat,
          lng: coords.lng,
          pending_geocode: false,
          source: 'gps'
        });
      }

      onSheetClose();
      setSearchQuery('');
      toast.success("Current location set");
    } catch (error) {
      toast.error("Couldn't get current location");
    } finally {
      setIsLocating(false);
    }
  };

  // This function is intended for the main input field which is no longer rendered by this component.
  // It's kept as per outline, but will be unused unless passed externally.
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(e);
    
    if (selectedStreet && newValue.match(/^(\d{1,6})\s+/)) {
      const extracted = extractHouseNumber(newValue);
      if (extracted && !selectedStreet.match(/^\d/)) {
        const composedAddress = composeAddress(extracted.number, selectedStreet);
        onChange({ target: { value: composedAddress } });
        
        if (onLocationUpdate) {
          onLocationUpdate({
            address: composedAddress,
            lat: null,
            lng: null,
            place_id: null,
            pending_geocode: true,
            source: 'composed'
          });
        }
        
        toast.success(`Address set to ${composedAddress}`);
        setSelectedStreet(null);
        setPendingNumber('');
      }
    }
  };

  // Sort and filter addresses
  const sortedSavedAddresses = [...savedAddresses]
    .sort((a, b) => {
      if (a.is_default_home !== b.is_default_home) return a.is_default_home ? -1 : 1;
      if (a.is_default_work !== b.is_default_work) return a.is_default_work ? -1 : 1;
      const labelA = (a.label || '').toLowerCase();
      const labelB = (b.label || '').toLowerCase();
      if (labelA !== labelB) return labelA.localeCompare(labelB);
      return (a.address_text || '').localeCompare(b.address_text || '');
    });

  const recentAddresses = [...savedAddresses]
    .filter(a => a.last_used)
    .sort((a, b) => new Date(b.last_used) - new Date(a.last_used))
    .slice(0, 5);

  // Apply search filter
  const searchLower = searchQuery.toLowerCase();
  const filteredSaved = sortedSavedAddresses.filter(addr => {
    const searchKey = `${addr.label || ''} ${addr.address_text || ''}`.toLowerCase();
    return searchKey.includes(searchLower);
  });

  const filteredRecent = recentAddresses.filter(addr => {
    const searchKey = `${addr.label || ''} ${addr.address_text || ''}`.toLowerCase();
    return searchKey.includes(searchLower);
  });

  const addressesWithDistance = filteredSaved.map(addr => {
    if (userLocation && addr.latitude && addr.longitude) {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        addr.latitude,
        addr.longitude
      );
      return { ...addr, distance_km: distance };
    }
    return addr;
  });

  // Display conditions for different sections
  const showGeocodingSuggestions = searchQuery.length >= 3 && geocodingSuggestions.length > 0;
  const showSavedAddresses = !searchQuery || (!showGeocodingSuggestions && filteredSaved.length > 0);
  const showRecentAddresses = !searchQuery || (!showGeocodingSuggestions && filteredRecent.length > 0);
  const showNoResults = searchQuery && !isLoadingSuggestions && !showGeocodingSuggestions && filteredSaved.length === 0 && filteredRecent.length === 0;

  return (
    <Sheet open={sheetOpen} onOpenChange={(open) => {
      if (!open) {
        onSheetClose();
        setSearchQuery('');
      }
    }}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh]"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: 'var(--text-strong)' }}>Pick Address</SheetTitle>
        </SheetHeader>
        
        {/* Search Input for the sheet itself */}
        <div className="mt-4 mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search addresses, streets or cities..."
            className="pl-10 pr-10"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--text-strong)' }}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        <div className="space-y-6 overflow-y-auto pb-6" style={{ maxHeight: 'calc(85vh - 140px)' }}>
          {/* Geocoding Suggestions */}
          {isLoadingSuggestions && searchQuery.length >= 3 && (
            <div className="text-center py-4">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--primary)' }} />
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Searching for suggestions...</p>
            </div>
          )}

          {showGeocodingSuggestions && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-strong)' }}>
                <Search className="w-4 h-4" />
                Suggestions
              </h3>
              <div className="space-y-2">
                {geocodingSuggestions.map((addr, index) => (
                  <button
                    key={`geo-${addr.place_id || index}`}
                    onClick={() => handleSelectAddress(addr)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left"
                    style={{
                      minHeight: '44px',
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--track-off)'
                    }}
                    aria-label={`Select suggested address: ${addr.full_address}`}
                  >
                    <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-strong)' }}>{addr.full_address}</p>
                      {/* You can display a secondary line like addr.address_text if it differs from full_address */}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Saved Addresses Section */}
          {currentUser && showSavedAddresses && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-strong)' }}>
                <MapPin className="w-4 h-4" />
                Saved
              </h3>
              <div className="space-y-2">
                {addressesWithDistance.map(addr => (
                  <button
                    key={addr.id}
                    onClick={() => handleSelectAddress(addr)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left"
                    style={{ 
                      minHeight: '44px',
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--track-off)'
                    }}
                    aria-label={`Select ${addr.label}, ${addr.address_text}`}
                  >
                    <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-strong)' }}>{addr.label}</span>
                        {addr.is_default_home && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Home</span>
                        )}
                        {addr.is_default_work && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">Work</span>
                        )}
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{addr.address_text}</p>
                      {addr.distance_km !== undefined && (
                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                          {addr.distance_km < 1 
                            ? `${Math.round(addr.distance_km * 1000)} m away`
                            : `${addr.distance_km.toFixed(1)} km away`}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Addresses Section */}
          {currentUser && showRecentAddresses && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-strong)' }}>
                <Clock className="w-4 h-4" />
                Recent
              </h3>
              <div className="space-y-2">
                {filteredRecent.map(addr => (
                  <button
                    key={`recent-${addr.id}`}
                    onClick={() => handleSelectAddress(addr)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left"
                    style={{ 
                      minHeight: '44px',
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--track-off)'
                    }}
                    aria-label={`Select recent address, ${addr.label} - ${addr.address_text}`}
                  >
                    <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-strong)' }}>{addr.label}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{addr.address_text}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State / No Search Results */}
          {showNoResults && (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">No results for &quot;{searchQuery}&quot;</p>
              <p className="text-xs">Try a different search term or use your current location.</p>
            </div>
          )}

          {/* No Addresses State (only if no search query and no suggestions) */}
          {currentUser && savedAddresses.length === 0 && !searchQuery && (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">No saved addresses yet</p>
              <p className="text-xs">Add addresses to your Address Book for quick access</p>
            </div>
          )}

          {/* Use Current Location */}
          {!searchQuery && ( // Only show if not actively searching
            <div>
              <button
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors"
                style={{ 
                  minHeight: '44px',
                  borderColor: 'var(--primary)',
                  backgroundColor: 'var(--surface)'
                }}
                aria-label="Use current location"
              >
                {isLocating ? (
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
                ) : (
                  <Target className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                )}
                <div className="text-left">
                  <p className="font-semibold" style={{ color: 'var(--primary)' }}>
                    Use Current Location
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fill with GPS</p>
                </div>
              </button>
            </div>
          )}

          {/* Manage Address Book Link */}
          {currentUser && (
            <div className="pt-4 border-t" style={{ borderColor: 'var(--track-off)' }}>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onSheetClose();
                  setSearchQuery('');
                  navigate(createPageUrl('AddressBook'));
                }}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Manage Address Book
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
