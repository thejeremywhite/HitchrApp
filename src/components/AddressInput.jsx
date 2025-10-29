
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Crosshair, Loader2, MapPin, Navigation, Zap } from 'lucide-react';
import { searchAddresses } from './LocationUtils';
import { turboLocateMe, cancelTurboLocate } from './TurboLocationUtils';
import { base44 } from '@/api/base44Client';

export default function AddressInput({ 
  value, 
  onChange, 
  placeholder, 
  className,
  onLocationUpdate,
  name = "address",
  onOpenPicker
}) {
  const [isLocating, setIsLocating] = useState(false);
  const [locateStage, setLocateStage] = useState(null);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [currentUser, setCurrentUser] = useState(null);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const lastLocateRef = useRef(0);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const authenticated = await base44.auth.isAuthenticated();
        if (authenticated) {
          const user = await base44.auth.me();
          setCurrentUser(user);
        }
      } catch (error) {
        // Silent fail
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      cancelTurboLocate();
    };
  }, []);

  const fetchTypedSuggestions = async (query) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const results = await searchAddresses(query);
      setSuggestions(results);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Address search error:', error);
      setSuggestions([]);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(e);
    setError('');
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      fetchTypedSuggestions(newValue);
    }, 300);
  };

  const handleSuggestionSelect = (suggestion) => {
    let displayAddress = suggestion.formatted_address;
    if (suggestion.interpolated && !suggestion.is_fallback) {
      displayAddress += ' (approx.)';
    }
    
    onChange({ target: { value: displayAddress } });
    
    if (onLocationUpdate) {
      onLocationUpdate({
        address: suggestion.formatted_address,
        lat: suggestion.lat,
        lng: suggestion.lng,
        place_id: suggestion.place_id,
        provider: suggestion.provider,
        interpolated: suggestion.interpolated || false,
        source: suggestion.is_fallback ? 'gps-coords' : 'suggestion'
      });
    }
    
    console.log('[ADDRESS] Selected address:', suggestion.formatted_address);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
    inputRef.current?.blur();
  };

  const handleTurboLocate = async () => {
    const now = Date.now();
    const timeSinceLastLocate = now - lastLocateRef.current;
    const forceHighAccuracy = timeSinceLastLocate < 5000;
    
    lastLocateRef.current = now;
    setIsLocating(true);
    setError('');
    setLocateStage(null);

    await turboLocateMe({
      currentUser,
      forceHighAccuracy,
      
      onCacheHit: (coords) => {
        setLocateStage('cache');
        setIsLocating(false);
        
        // IMMEDIATELY update location - don't wait for suggestions
        if (onLocationUpdate) {
          onLocationUpdate({
            lat: coords.lat,
            lng: coords.lng,
            address: `📍 Last location: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
            source: 'cache',
            loading: true
          });
        }
      },
      
      onFastFix: (coords) => {
        setLocateStage('fast');
        setIsLocating(false);
        
        // IMMEDIATELY update location - don't wait for suggestions
        if (onLocationUpdate) {
          onLocationUpdate({
            lat: coords.lat,
            lng: coords.lng,
            address: `Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
            source: 'gps',
            accuracy: coords.accuracy
          });
        }
      },
      
      onRefine: (coords) => {
        setLocateStage('refine');
        
        // Silent update - don't move cursor or show toast
        if (onLocationUpdate) {
          onLocationUpdate({
            lat: coords.lat,
            lng: coords.lng,
            address: `Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
            source: 'gps-refined',
            accuracy: coords.accuracy
          });
        }
      },
      
      onSuggestions: (newSuggestions, source) => {
        if (newSuggestions.length > 0) {
          // Add header based on source
          const header = source === 'cache' 
            ? "📍 Using last location"
            : source === 'fast_fix'
            ? "✓ Location found"
            : "⚡ Refined location";
          
          const withHeader = [
            { formatted_address: header, is_header: true },
            ...newSuggestions
          ];
          
          setSuggestions(withHeader);
          setShowSuggestions(true);
          setActiveSuggestionIndex(1); // Select first real suggestion
        }
      },
      
      onError: (errorInfo) => {
        setIsLocating(false);
        setLocateStage(null);
        
        if (!errorInfo.telemetry.cache_used) {
          setError("Couldn't get GPS. Try again or type address.");
        }
      }
    });
    
    // Keep spinner for max 2 seconds even if no fix
    setTimeout(() => {
      setIsLocating(false);
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    // Filter out header items for keyboard navigation
    const selectableIndices = suggestions
      .map((s, i) => s.is_header ? null : i)
      .filter(i => i !== null);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const currentIdx = selectableIndices.indexOf(activeSuggestionIndex);
        if (currentIdx < selectableIndices.length - 1) {
          setActiveSuggestionIndex(selectableIndices[currentIdx + 1]);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        const currIdx = selectableIndices.indexOf(activeSuggestionIndex);
        if (currIdx > 0) {
          setActiveSuggestionIndex(selectableIndices[currIdx - 1]);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (activeSuggestionIndex >= 0 && !suggestions[activeSuggestionIndex]?.is_header && !suggestions[activeSuggestionIndex]?.is_error) {
          handleSuggestionSelect(suggestions[activeSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
        break;
    }
  };

  const getSuggestionIcon = (suggestion) => {
    if (suggestion.is_header) return null;
    if (suggestion.is_error) return null;
    
    if (locateStage === 'refine') {
      return <Zap className="w-5 h-5 text-blue-500" />;
    }
    if (suggestion.is_exact || suggestion.distance_m === 0) {
      return <MapPin className="w-5 h-5 text-[#43B2C4]" />;
    }
    if (suggestion.interpolated) {
      return <span className="w-5 h-5 flex items-center justify-center text-[#F59E0B]">≈</span>;
    }
    return <Navigation className="w-5 h-5 text-[#7C8B96]" />;
  };

  return (
    <div className="space-y-1 relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          className={`pr-12 ${className || ''}`}
          autoComplete="street-address"
          name={name}
          aria-autocomplete="list"
          aria-controls="address-suggestions"
          aria-activedescendant={activeSuggestionIndex >= 0 ? `suggestion-${activeSuggestionIndex}` : undefined}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenPicker || handleTurboLocate}
          disabled={isLocating || !navigator.onLine}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 bg-[#43B2C4] hover:bg-[#3599AA] rounded-lg"
          title={!navigator.onLine ? "Offline" : onOpenPicker ? "Choose saved address" : "Use my location"}
          aria-label={onOpenPicker ? "Choose saved address" : "Use my location"}
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <Crosshair className="w-5 h-5 text-white" />
          )}
        </Button>
      </div>

      {error && !showSuggestions && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          id="address-suggestions"
          role="listbox"
          className="absolute z-50 w-full bg-white border border-[#E5E7EB] rounded-xl shadow-lg mt-1 max-h-[40vh] overflow-y-auto"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          {suggestions.map((suggestion, index) => {
            if (suggestion.is_header) {
              return (
                <div
                  key={`header-${index}`}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] bg-gray-50 border-b"
                >
                  {suggestion.formatted_address}
                </div>
              );
            }
            
            return (
              <button
                key={suggestion.place_id || index}
                id={`suggestion-${index}`}
                role="option"
                aria-selected={index === activeSuggestionIndex}
                aria-label={suggestion.formatted_address}
                type="button"
                onClick={() => handleSuggestionSelect(suggestion)}
                disabled={suggestion.is_error}
                className={`w-full text-left px-4 py-3 hover:bg-[#F5F5F5] transition-colors flex items-start gap-3 ${
                  index === activeSuggestionIndex ? 'bg-[#E6F9FB]' : ''
                } ${suggestion.is_error ? 'text-red-600' : ''}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getSuggestionIcon(suggestion)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#111827] truncate">
                    {suggestion.formatted_address}
                    {suggestion.interpolated && !suggestion.is_fallback && (
                      <span className="text-[#7C8B96] ml-1">(approx.)</span>
                    )}
                  </div>
                  {suggestion.distance_m !== null && suggestion.distance_m !== undefined && !suggestion.is_fallback && (
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      {suggestion.distance_m < 1000 
                        ? `${suggestion.distance_m} m away`
                        : `${(suggestion.distance_m / 1000).toFixed(1)} km away`}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
