
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, DollarSign, CheckCircle, Route, Clock, Calendar, Truck, Package, AlertCircle, Pause, Play, Edit, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import AddressInput from "../components/AddressInput";
import SmartSuggestions, { saveToRecents } from "../components/SmartSuggestions";
import PriceQuickPicks from "../components/PriceQuickPicks";
import { usePricing } from "@/components/usePricing";
import { cn } from "@/lib/utils";
import HitchrLogo from "../components/HitchrLogo";
import { Input } from "@/components/ui/input";
import AddressPicker from "../components/AddressPicker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatAvailabilityStatus, formatAvailabilityWindows } from "../components/HotShotAvailabilityUtils";

const SenderPost = forwardRef((props, ref) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState(null); // Added error state
    const [searchParams] = useSearchParams();
    const preselectedDriverId = searchParams.get('driver_id');
    const isTestDriver = searchParams.get('is_test') === 'true';
    const { calculatePrice } = usePricing();
    
    const [currentUser, setCurrentUser] = useState(null);
    const [pickupAddress, setPickupAddress] = useState("");
    const [pickupLat, setPickupLat] = useState(null);
    const [pickupLng, setPickupLng] = useState(null);
    const [dropoffAddress, setDropoffAddress] = useState("");
    const [dropoffLat, setDropoffLat] = useState(null);
    const [dropoffLng, setDropoffLng] = useState(null);
    const [itemType, setItemType] = useState("misc");
    const [itemNotes, setItemNotes] = useState("");
    const [offeredPrice, setOfferedPrice] = useState("");

    // Beer Run specific fields
    const [earliestPickupTime, setEarliestPickupTime] = useState("");
    const [latestDeliveryTime, setLatestDeliveryTime] = useState("");
    
    // Rideshare specific fields
    const [pickupWindow, setPickupWindow] = useState("");
    const [dropoffWindow, setDropoffWindow] = useState("");
    const [numPassengers, setNumPassengers] = useState("");
    const [seatsRequired, setSeatsRequired] = useState("");

    // State for controlling AddressPicker sheets
    const [showPickupPicker, setShowPickupPicker] = useState(false);
    const [showDropoffPicker, setShowDropoffPicker] = useState(false);

    useEffect(() => {
      const loadUser = async () => {
        try {
          const user = await base44.auth.me();
          setCurrentUser(user);
        } catch (error) {
          base44.auth.redirectToLogin();
        }
      };
      loadUser();
    }, []);

    const createRequestMutation = useMutation({
      mutationFn: (newRequest) => base44.entities.Request.create(newRequest),
      onSuccess: () => {
        console.log('[POST] Request created successfully');
        setShowSuccess(true);
        setError(null); // Clear error on success
        queryClient.invalidateQueries({queryKey: ['requests', 'home-data']});
        setTimeout(() => navigate("/"), 4000);
      },
      onError: (error) => {
        console.error('[POST] Failed to post request:', error);
        setError(error.message || "Failed to post request. Please try again."); // Set error state
      },
    });

    const handlePost = async () => {
      setError(null); // Clear previous errors
      
      if (!currentUser && !isTestDriver) {
        setError("User information not loaded.");
        return;
      }
      if (!pickupAddress || !offeredPrice) {
        setError("Pickup address and price are required.");
        return;
      }
      
      const price = parseFloat(offeredPrice);
      if (isNaN(price) || price <= 0) {
        setError("Price must be a positive number.");
        return;
      }

      // Validations for specific item types
      if (itemType === 'rideshare') {
          if (!pickupWindow || !dropoffWindow) {
              setError("Pickup and Dropoff windows are required for Rideshare.");
              return;
          }
          if (parseInt(numPassengers) <= 0 || parseInt(seatsRequired) <= 0) {
              setError("Number of passengers and seats required must be positive for Rideshare.");
              return;
          }
          if (parseInt(seatsRequired) > parseInt(numPassengers)) {
              setError("Seats required cannot be more than the number of passengers.");
              return;
          }
      }
      if (itemType === 'beer_run') {
          if (!earliestPickupTime || !latestDeliveryTime) {
              setError("Earliest Pickup Time and Latest Delivery Time are required for Beer Run.");
              return;
          }
          const earliest = new Date(earliestPickupTime);
          const latest = new Date(latestDeliveryTime);
          if (earliest.getTime() >= latest.getTime()) {
              setError("Latest Delivery Time must be after Earliest Pickup Time.");
              return;
          }
      }

      // Save to recents
      if (itemNotes) saveToRecents('itemNotes', itemNotes);

      const requestData = {
        pickup_address: pickupAddress,
        pickup_latitude: pickupLat,
        pickup_longitude: pickupLng,
        dropoff_address: dropoffAddress,
        dropoff_latitude: dropoffLat,
        dropoff_longitude: dropoffLng,
        item_type: itemType,
        item_notes: itemNotes,
        offered_price: price,
        status: "open",
      };
      
      // Add Beer Run specific fields
      if (itemType === 'beer_run') {
        requestData.earliest_pickup_time = earliestPickupTime ? new Date(earliestPickupTime).toISOString() : null;
        requestData.latest_delivery_time = latestDeliveryTime ? new Date(latestDeliveryTime).toISOString() : null;
      }
      
      // Add Rideshare specific fields
      if (itemType === 'rideshare') {
        requestData.pickup_window = pickupWindow ? new Date(pickupWindow).toISOString() : null;
        requestData.dropoff_window = dropoffWindow ? new Date(dropoffWindow).toISOString() : null;
        requestData.num_passengers = numPassengers ? parseInt(numPassengers) : null;
        requestData.seats_required = seatsRequired ? parseInt(numPassengers) : null; // Should be seatsRequired, not numPassengers
      }
      
      if (preselectedDriverId) {
        if (isTestDriver) {
          requestData.is_test_data = true;
        } else {
          requestData.poster_id = currentUser.id;
          requestData.driver_id = preselectedDriverId;
        }
      } else {
        requestData.poster_id = currentUser.id;
      }

      createRequestMutation.mutate(requestData);
    };

    useImperativeHandle(ref, () => ({
      submit: handlePost
    }));
    
    const categories = [
      { value: "food", label: "Food" },
      { value: "auto_parts", label: "Auto Parts" },
      { value: "retail", label: "Retail" },
      { value: "firewood", label: "Firewood" },
      { value: "beer_run", label: "Beer Run" },
      { value: "rideshare", label: "Rideshare" },
      { value: "misc", label: "Misc" },
    ];

    // Calculate suggested price
    const distance = pickupLat && pickupLng && dropoffLat && dropoffLng
      ? Math.sqrt(Math.pow(dropoffLat - pickupLat, 2) + Math.pow(dropoffLng - pickupLng, 2)) * 111 // Approximation: 1 degree ~ 111km
      : 20; // Default to 20km if coordinates not set
    const suggestedPrice = calculatePrice(distance, itemType);

    if (showSuccess) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-white text-center p-3">
          <CheckCircle className="w-12 h-12 text-green-500 mb-3 animate-in fade-in zoom-in duration-500" />
          <h1 className="text-lg font-bold text-center text-[var(--primary)] mb-2">Request Posted!</h1>
          <p className="text-sm text-center text-[var(--text-secondary)]">Your request is live. Drivers will see it shortly.</p>
        </div>
      );
    }

    return (
        <div className="p-3 space-y-3 pb-24">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label className="font-semibold mb-1.5 block text-xs">Pickup Location*</label>
              <AddressInput
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Enter pickup address"
                className="h-9 text-sm"
                name="pickup-address"
                onLocationUpdate={(data) => {
                  setPickupAddress(data.address);
                  setPickupLat(data.lat);
                  setPickupLng(data.lng);
                }}
                onOpenPicker={() => setShowPickupPicker(true)}
              />
            </div>
            <div>
              <label className="font-semibold mb-1.5 block text-xs">Dropoff Location (Optional)</label>
              <AddressInput
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                placeholder="Enter dropoff address"
                className="h-9 text-sm"
                name="dropoff-address"
                onLocationUpdate={(data) => {
                  setDropoffAddress(data.address);
                  setDropoffLat(data.lat);
                  setDropoffLng(data.lng);
                }}
                onOpenPicker={() => setShowDropoffPicker(true)}
              />
            </div>
            <div>
              <label className="font-semibold mb-1.5 block text-xs">Category*</label>
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>{categories.map(cat => <SelectItem key={cat.value} value={cat.value} className="text-sm">{cat.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            
            {/* Beer Run Specific Fields */}
            {itemType === 'beer_run' && (
              <>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  ⚠️ Recipient may need valid ID for delivery of alcohol products.
                </div>
                <div>
                  <label className="font-semibold mb-1.5 block text-xs">Earliest Pickup Time</label>
                  <input
                    type="datetime-local"
                    value={earliestPickupTime}
                    onChange={(e) => setEarliestPickupTime(e.target.value)}
                    className="w-full h-9 px-2 border border-[var(--border)] rounded-lg bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="font-semibold mb-1.5 block text-xs">Latest Delivery Time</label>
                  <input
                    type="datetime-local"
                    value={latestDeliveryTime}
                    onChange={(e) => setLatestDeliveryTime(e.target.value)}
                    className="w-full h-9 px-2 border border-[var(--border)] rounded-lg bg-white text-sm"
                  />
                </div>
              </>
            )}
            
            {/* Rideshare Specific Fields */}
            {itemType === 'rideshare' && (
              <>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  ℹ️ Driver must have legal seating for offered passengers.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold mb-1.5 block text-xs">Pickup Window</label>
                    <input
                      type="datetime-local"
                      value={pickupWindow}
                      onChange={(e) => setPickupWindow(e.target.value)}
                      className="w-full h-9 px-2 border border-[var(--border)] rounded-lg bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="font-semibold mb-1.5 block text-xs">Dropoff Window</label>
                    <input
                      type="datetime-local"
                      value={dropoffWindow}
                      onChange={(e) => setDropoffWindow(e.target.value)}
                      className="w-full h-9 px-2 border border-[var(--border)] rounded-lg bg-white text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold mb-1.5 block text-xs">Number of Passengers</label>
                    <input
                      type="number"
                      value={numPassengers}
                      onChange={(e) => setNumPassengers(e.target.value)}
                      placeholder="1"
                      className="w-full h-9 px-2 border border-[var(--border)] rounded-lg bg-white text-sm"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold mb-1.5 block text-xs">Seats Required</label>
                    <input
                      type="number"
                      value={seatsRequired}
                      onChange={(e) => setSeatsRequired(e.target.value)}
                      placeholder="1"
                      className="w-full h-9 px-2 border border-[var(--border)] rounded-lg bg-white text-sm"
                      min="1"
                    />
                  </div>
                </div>
              </>
            )}
            
            <div>
              <label className="font-semibold mb-1.5 block text-xs">Notes</label>
              <SmartSuggestions
                field="itemNotes"
                onSelect={(value) => setItemNotes(value)}
              />
              <Textarea 
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder={itemType === 'beer_run' ? "e.g., '24-pack of Kokanee, needs to be picked up from Liquor Mart'" : itemType === 'rideshare' ? "e.g., 'Need ride to the airport, 2 people with 3 suitcases'" : "e.g., 'A large box, heavy'"} 
                    className="h-16 text-sm mt-2"
                    autoCapitalize="sentences"
                    spellCheck="true"
                    name="item-notes"
              />
            </div>
            <div>
              <label className="font-semibold mb-1.5 block text-xs">Offered Price*</label>
              <PriceQuickPicks
                suggestedPrice={suggestedPrice}
                onSelect={(value) => setOfferedPrice(value.toString())}
              />
              <div className="relative mt-2">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                    value={offeredPrice}
                    onChange={(e) => setOfferedPrice(e.target.value)}
                    type="number" 
                    placeholder={itemType === 'beer_run' ? "25.00" : "20.00"} 
                    className="w-full pl-7 h-9 px-2 border border-[var(--border)] rounded-lg text-sm" 
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    autoComplete="off"
                    name="price"
                />
              </div>
              {itemType === 'beer_run' && (
                <p className="text-[10px] text-gray-500 mt-1">Base fee for Beer Run: $25 + distance</p>
              )}
            </div>

            {/* Pickup Picker Sheet */}
            <AddressPicker
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              onLocationUpdate={(data) => {
                setPickupAddress(data.address);
                setPickupLat(data.lat);
                setPickupLng(data.lng);
                setShowPickupPicker(false); // Close after selection
              }}
              placeholder="Enter pickup address"
              name="pickup-picker"
              sheetOpen={showPickupPicker}
              onSheetClose={() => setShowPickupPicker(false)}
            />

            {/* Dropoff Picker Sheet */}
            <AddressPicker
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              onLocationUpdate={(data) => {
                setDropoffAddress(data.address);
                setDropoffLat(data.lat);
                setDropoffLng(data.lng);
                setShowDropoffPicker(false); // Close after selection
              }}
              placeholder="Enter dropoff address"
              name="dropoff-picker"
              sheetOpen={showDropoffPicker}
              onSheetClose={() => setShowDropoffPicker(false)}
            />
        </div>
    );
});

const DriverPost = forwardRef((props, ref) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [fromAddress, setFromAddress] = useState("");
    const [fromLat, setFromLat] = useState(null);
    const [fromLng, setFromLng] = useState(null);
    const [toAddress, setToAddress] = useState("");
    const [toLat, setToLat] = useState(null);
    const [toLng, setToLng] = useState(null);
    const [departAt, setDepartAt] = useState("");
    const [hasReturnTrip, setHasReturnTrip] = useState(false);
    const [returnDepartAt, setReturnDepartAt] = useState("");
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringDays, setRecurringDays] = useState([]);
    const [notes, setNotes] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [errors, setErrors] = useState({});
    const [availableSeats, setAvailableSeats] = useState(""); // New state for available seats
    const [error, setError] = useState(null); // Added error state

    // State for controlling AddressPicker sheets
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    useEffect(() => {
      const loadUser = async () => {
        try {
          const user = await base44.auth.me();
          setCurrentUser(user);
        } catch (error) {
          base44.auth.redirectToLogin();
        }
      };
      loadUser();
    }, []);

    const createAvailabilityMutation = useMutation({
      mutationFn: (data) => base44.entities.DriverAvailability.create(data),
      onSuccess: () => {
        console.log('[POST] Availability posted successfully');
        setError(null); // Clear error on success
        queryClient.invalidateQueries({queryKey: ['home-data']});
        queryClient.invalidateQueries({queryKey: ['current-posts']}); // Invalidate current posts to refresh the list
        navigate('/'); // Navigate home after successful post
      },
      onError: (error) => {
        console.error('[POST] Failed to post availability:', error);
        setError(error.message || "Failed to post availability. Please try again."); // Set error state
      },
    });

    useImperativeHandle(ref, () => ({
      submit: handlePostAvailability
    }));
    
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weekdaysFull = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const weekendsFull = ["Sat", "Sun"];

    const toggleRecurringDay = (day) => {
      setRecurringDays(prev => 
        prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
      );
      setErrors(prev => ({...prev, recurringDays: null}));
    };

    const selectWeekdays = () => {
      setRecurringDays(weekdaysFull);
      setErrors(prev => ({...prev, recurringDays: null}));
    };

    const selectWeekends = () => {
      setRecurringDays(weekendsFull);
      setErrors(prev => ({...prev, recurringDays: null}));
    };

    const handlePostAvailability = () => {
      setError(null); // Clear previous errors
      
      if (!currentUser) {
        setError("User information not loaded.");
        return;
      }
      
      const newErrors = {};
      
      if (!fromAddress || !toAddress || !departAt) {
        newErrors.general = "Origin, destination, and departure time are required.";
      }

      if (hasReturnTrip && !returnDepartAt) {
        newErrors.returnTime = "Please enter return time.";
      }

      if (isRecurring && recurringDays.length === 0) {
        newErrors.recurringDays = "Please select at least one day for recurring trip.";
      }
      
      if (availableSeats && parseInt(availableSeats) < 0) { // Changed to < 0 to allow 0 seats
        newErrors.availableSeats = "Available seats cannot be negative.";
      }


      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setError(newErrors.general || "Please fix the errors below to post."); // Set error state
        return;
      }

      // Save to recents
      if (notes) saveToRecents('driverNotes', notes);

      const availabilityData = {
        driver_id: currentUser.id,
        driver_snapshot: {
          name: currentUser.full_name,
          email: currentUser.email,
          vehicle_type: currentUser.vehicle_type
        },
        from_address: fromAddress,
        from_latitude: fromLat,
        from_longitude: fromLng,
        to_address: toAddress,
        to_latitude: toLat,
        to_longitude: toLng,
        depart_at: new Date(departAt).toISOString(),
        return_depart_at: hasReturnTrip ? new Date(returnDepartAt).toISOString() : null,
        is_recurring: isRecurring,
        recurring_days: isRecurring ? recurringDays : [],
        window_start: new Date(departAt).toISOString(),
        vehicle_type: currentUser.vehicle_type,
        capacities: currentUser.categories_served || [],
        min_fee: currentUser.base_fee || 15,
        notes: notes,
        status: "active",
        available_seats: availableSeats ? parseInt(availableSeats) : null // New field
      };

      createAvailabilityMutation.mutate(availabilityData);
    };

    const modeColor = '#2FB5C0';
    const modeColorLight = '#E6F9FB';

    return (
        <div className="p-3 space-y-3 pb-32">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 font-semibold text-xs">
                  <Route className="w-3 h-3"/> Route
                </Label>
                <div className="space-y-2">
                  <div>
                    <Label className="text-[10px] text-[var(--text-secondary)] mb-0.5 block">From (Origin)</Label>
                    <AddressInput
                      value={fromAddress}
                      onChange={(e) => setFromAddress(e.target.value)}
                      placeholder="Origin address"
                      className="h-9 text-sm"
                      name="from-address"
                      onLocationUpdate={(data) => {
                        setFromAddress(data.address);
                        setFromLat(data.lat);
                        setFromLng(data.lng);
                      }}
                      onOpenPicker={() => setShowFromPicker(true)}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-[var(--text-secondary)] mb-0.5 block">To (Destination)</Label>
                    <AddressInput
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value)}
                      placeholder="Destination address"
                      className="h-9 text-sm"
                      name="to-address"
                      onLocationUpdate={(data) => {
                        setToAddress(data.address);
                        setToLat(data.lat);
                        setToLng(data.lng);
                      }}
                      onOpenPicker={() => setShowToPicker(true)}
                    />
                  </div>
                </div>
            </div>
            
            <div className="space-y-3">
                <Label className="flex items-center gap-1.5 font-semibold text-xs">
                  <Clock className="w-3 h-3"/> Trip Times
                </Label>
                
                <div>
                  <Label className="text-[10px] text-[var(--text-secondary)] mb-0.5 block">Leaving Origin*</Label>
                  <input
                    type="datetime-local"
                    value={departAt}
                    onChange={(e) => {
                      setDepartAt(e.target.value);
                      setErrors(prev => ({...prev, general: null}));
                    }}
                    className="w-full h-9 px-2 border border-[var(--border)] rounded-lg bg-white text-sm"
                  />
                </div>
                
                {/* Return Trip Pill */}
                <div>
                  <Label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Return Trip?</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHasReturnTrip(false);
                        setErrors(prev => ({...prev, returnTime: null}));
                      }}
                      className="pill-chip h-9 px-4 rounded-full text-sm font-semibold transition-all"
                      style={!hasReturnTrip ? {
                        backgroundColor: modeColor,
                        borderColor: modeColor,
                        color: '#FFFFFF'
                      } : {
                        backgroundColor: 'transparent',
                        borderColor: '#E7E9EB',
                        color: '#333F48'
                      }}
                    >
                      One-Way
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasReturnTrip(true)}
                      className="pill-chip h-9 px-4 rounded-full text-sm font-semibold transition-all"
                      style={hasReturnTrip ? {
                        backgroundColor: modeColor,
                        borderColor: modeColor,
                        color: '#FFFFFF'
                      } : {
                        backgroundColor: 'transparent',
                        borderColor: '#E7E9EB',
                        color: '#333F48'
                      }}
                    >
                      Round Trip
                    </button>
                  </div>
                </div>
                
                {hasReturnTrip && (
                  <div>
                    <Label className="text-[10px] text-[var(--text-secondary)] mb-0.5 block">Leaving Destination*</Label>
                    <input
                      type="datetime-local"
                      value={returnDepartAt}
                      onChange={(e) => {
                        setReturnDepartAt(e.target.value);
                        setErrors(prev => ({...prev, returnTime: null}));
                      }}
                      className="w-full h-9 px-2 border border-[var(--border)] rounded-lg bg-white text-sm"
                    />
                    {errors.returnTime && (
                      <p className="text-xs text-red-600 mt-1">{errors.returnTime}</p>
                    )}
                  </div>
                )}

                {/* Recurring Trip Pill */}
                <div>
                  <Label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Recurring Trip?</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecurring(false);
                        if (isRecurring) setRecurringDays([]);
                        setErrors(prev => ({...prev, recurringDays: null}));
                      }}
                      className="pill-chip h-9 px-4 rounded-full text-sm font-semibold transition-all"
                      style={!isRecurring ? {
                        backgroundColor: modeColor,
                        borderColor: modeColor,
                        color: '#FFFFFF'
                      } : {
                        backgroundColor: 'transparent',
                        borderColor: '#E7E9EB',
                        color: '#333F48'
                      }}
                    >
                      One-Time
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRecurring(true)}
                      className="pill-chip h-9 px-4 rounded-full text-sm font-semibold transition-all flex items-center gap-2"
                      style={isRecurring ? {
                        backgroundColor: modeColor,
                        borderColor: modeColor,
                        color: '#FFFFFF'
                      } : {
                        backgroundColor: 'transparent',
                        borderColor: '#E7E9EB',
                        color: '#333F48'
                      }}
                    >
                      <Calendar className="w-4 h-4" />
                      Recurring
                    </button>
                  </div>
                </div>

                {isRecurring && (
                  <div>
                    <Label className="flex items-center gap-1.5 font-semibold text-xs mb-2">
                      <Calendar className="w-3 h-3"/> Select Days
                    </Label>
                    
                    {/* Quick Select Pills */}
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={selectWeekdays}
                        className="pill-chip h-7 px-3 text-xs rounded-full font-semibold transition-all"
                        style={(recurringDays.length === 5 && weekdaysFull.every(d => recurringDays.includes(d))) ? {
                          backgroundColor: modeColor,
                          borderColor: modeColor,
                          color: '#FFFFFF'
                        } : {
                          backgroundColor: 'transparent',
                          borderColor: '#E7E9EB', // Changed from modeColor for better readability
                          color: '#333F48'        // Changed from modeColor for better readability
                        }}
                      >
                        Weekdays
                      </button>
                      <button
                        type="button"
                        onClick={selectWeekends}
                        className="pill-chip h-7 px-3 text-xs rounded-full font-semibold transition-all"
                        style={(recurringDays.length === 2 && weekendsFull.every(d => recurringDays.includes(d))) ? {
                          backgroundColor: modeColor,
                          borderColor: modeColor,
                          color: '#FFFFFF'
                        } : {
                          backgroundColor: 'transparent',
                          borderColor: '#E7E9EB', // Changed from modeColor for better readability
                          color: '#333F48'        // Changed from modeColor for better readability
                        }}
                      >
                        Weekends
                      </button>
                    </div>

                    {/* Weekday Pills */}
                    <div className="flex flex-wrap gap-2">
                      {weekdays.map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleRecurringDay(day)}
                          className="pill-chip h-8 px-4 text-sm rounded-full font-semibold transition-all"
                          style={recurringDays.includes(day) ? {
                            backgroundColor: modeColor,
                            borderColor: modeColor,
                            color: '#FFFFFF'
                          } : {
                            backgroundColor: 'transparent',
                            borderColor: '#E7E9EB',
                            color: '#333F48'
                          }}
                        >
                          {day}
                        </button>
                      ))}
                    </div>

                    {errors.recurringDays && (
                      <p className="text-xs text-red-600 mt-2">{errors.recurringDays}</p>
                    )}
                  </div>
                )}
            </div>
            
            <div className="space-y-1.5">
                <Label className="font-semibold text-xs">Available Seats (For Rideshare)</Label>
                <Input
                  type="number"
                  value={availableSeats}
                  onChange={(e) => {
                    setAvailableSeats(e.target.value);
                    setErrors(prev => ({...prev, availableSeats: null}));
                  }}
                  placeholder="e.g., 3"
                  className="h-9 text-sm"
                  min="0" // Changed to 0 to allow 0 seats if driver carries cargo but not passengers
                />
                <p className="text-[10px] text-gray-500">How many passengers can you take?</p>
                {errors.availableSeats && (
                  <p className="text-xs text-red-600 mt-1">{errors.availableSeats}</p>
                )}
            </div>
            
            <div className="space-y-1.5">
                <Label className="font-semibold text-xs">Notes for Senders</Label>
                <SmartSuggestions
                  field="driverNotes"
                  onSelect={(value) => setNotes(value)}
                />
                <Textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., 'I have space for small packages', 'Truck bed available for large items', 'Available for beer runs', 'Can take 2 passengers'" 
                    className="h-16 text-sm mt-2"
                    autoCapitalize="sentences"
                    spellCheck="true"
                    name="driver-notes"
                />
            </div>

            {/* From Picker Sheet */}
            <AddressPicker
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              onLocationUpdate={(data) => {
                setFromAddress(data.address);
                setFromLat(data.lat);
                setFromLng(data.lng);
                setShowFromPicker(false); // Close after selection
              }}
              placeholder="Origin address"
              name="from-picker"
              sheetOpen={showFromPicker}
              onSheetClose={() => setShowFromPicker(false)}
            />

            {/* To Picker Sheet */}
            <AddressPicker
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              onLocationUpdate={(data) => {
                setToAddress(data.address);
                setToLat(data.lat);
                setToLng(data.lng);
                setShowToPicker(false); // Close after selection
              }}
              placeholder="Destination address"
              name="to-picker"
              sheetOpen={showToPicker}
              onSheetClose={() => setShowToPicker(false)}
            />
        </div>
    );
});

export default function Post() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(() => localStorage.getItem('hitchr.mode') || 'sender');
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || "create");

  const senderPostRef = useRef(null);
  const driverPostRef = useRef(null);

  // Query current posts - ONLY owner's posts
  const { data: currentPosts = [] } = useQuery({
    queryKey: ['current-posts', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const avails = await base44.entities.DriverAvailability.filter({
        filter: { 
          driver_id: { eq: currentUser.id }, 
          status: { in: ['active', 'paused'] }
        }
      });
      // Sort by updated_date descending
      return avails.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
    },
    enabled: !!currentUser && mode === 'driver'
  });

  const updatePostMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DriverAvailability.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-posts'] });
      queryClient.invalidateQueries({ queryKey: ['home-data'] });
    },
    onError: (error) => {
        console.error("Failed to update post status:", error);
        // Optionally display an error message to the user
    }
  });

  useEffect(() => {
    const loadUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
      
      // Auto-select mode based on profile constraints
      let initialMode = localStorage.getItem('hitchr.mode') || 'sender'; // Default fallback

      if (user.is_driver && !user.is_sender) {
        initialMode = 'driver';
      } else if (user.is_sender && !user.is_driver) {
        initialMode = 'sender';
      } else if (user.current_mode) { // If both true, or neither, use user's last preference
        initialMode = user.current_mode;
      }
      setMode(initialMode);
      localStorage.setItem('hitchr.mode', initialMode);
    };
    loadUser();
  }, []);
  
  useEffect(() => {
    const handleModeChange = (event) => setMode(event.detail.mode);
    window.addEventListener('HITCHR_MODE_CHANGED', handleModeChange);
    return () => window.removeEventListener('HITCHR_MODE_CHANGED', handleModeChange);
  }, []);

  const handleDriverPost = () => {
    if (driverPostRef.current) {
      driverPostRef.current.submit();
    } else {
      console.error("Driver form not loaded yet.");
    }
  };

  const handleSenderPost = () => {
    if (senderPostRef.current) {
      senderPostRef.current.submit();
    } else {
      console.error("Sender form not loaded yet.");
    }
  };

  const handleTogglePost = (post) => {
    const newStatus = post.status === 'active' ? 'paused' : 'active';
    updatePostMutation.mutate({ id: post.id, data: { status: newStatus } });
  };

  const handleEditPost = (post) => {
    if (post.hot_shot) {
      // Navigate to Profile and scroll to Hot Shot section
      // The outline requested `navigate(createPageUrl('Profile'))`, but `createPageUrl` is not defined.
      // Assuming the intention is to navigate to the profile page directly.
      navigate('/profile'); 
      setTimeout(() => {
        const hotShotSection = document.querySelector('[data-section="hot-shot"]'); // Assuming such a data attribute exists
        if (hotShotSection) {
          hotShotSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      // For regular posts, switch to the 'create' tab.
      // A more complete "edit" feature would involve passing the post data to DriverPost to pre-fill the form.
      setActiveTab("create");
    }
  };

  const handleModeSwitch = async (newMode) => {
    setMode(newMode);
    localStorage.setItem('hitchr.mode', newMode);
    window.dispatchEvent(new CustomEvent('HITCHR_MODE_CHANGED', { detail: { mode: newMode } }));
    
    // Update user's current_mode in database
    if (currentUser) {
      try {
        await base44.auth.updateMe({
          current_mode: newMode,
          last_mode_change: new Date().toISOString()
        });
      } catch (error) {
        console.error("Failed to update mode:", error);
      }
    }
  };

  const isDriverMode = mode === 'driver';
  const modeColor = isDriverMode ? '#2FB5C0' : '#FF7A00';

  return (
    <div className="max-w-lg mx-auto bg-white min-h-screen pb-24">
       <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)] px-3 py-2">
         <div className="flex items-center gap-2 mb-3">
           <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-7 w-7">
             <ArrowLeft className="w-3 h-3" />
           </Button>
           <HitchrLogo mode={mode} size={20} />
           <h1 className="text-sm font-semibold">{isDriverMode ? 'Post Availability' : 'Post a Request'}</h1>
         </div>
         
         {/* Mode Toggle */}
         {currentUser?.is_driver && currentUser?.is_sender && (
           <div className="flex items-center justify-center gap-2 p-2 bg-gray-50 rounded-lg mb-2">
             <button
               onClick={() => handleModeSwitch('sender')}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                 mode === 'sender' 
                   ? 'bg-[#FF7A00] text-white shadow-md' 
                   : 'bg-white text-gray-600 hover:bg-gray-100'
               }`}
             >
               <Package className="w-4 h-4" />
               Sender
             </button>
             <button
               onClick={() => handleModeSwitch('driver')}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                 mode === 'driver' 
                   ? 'bg-[#2FB5C0] text-white shadow-md' 
                   : 'bg-white text-gray-600 hover:bg-gray-100'
               }`}
             >
               <Truck className="w-4 h-4" />
               Driver
             </button>
           </div>
         )}

         {/* Tabs for Driver Mode */}
         {isDriverMode && (
           <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
             <TabsList className="grid w-full grid-cols-2 h-9">
               <TabsTrigger value="create" className="text-sm">Create</TabsTrigger>
               <TabsTrigger value="current" className="text-sm">Current Posts</TabsTrigger>
             </TabsList>
           </Tabs>
         )}
       </div>
       
       {isDriverMode ? (
         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
           <TabsContent value="create" className="mt-0">
             <DriverPost ref={driverPostRef} />
           </TabsContent>
           <TabsContent value="current" className="mt-0 p-3 space-y-3">
             {currentPosts.length === 0 ? (
               <div className="text-center py-12 text-gray-500">
                 <p className="text-sm">No active posts</p>
                 <Button
                   onClick={() => setActiveTab("create")}
                   variant="link"
                   className="mt-2"
                 >
                   Create your first post
                 </Button>
               </div>
             ) : (
               currentPosts.map((post) => {
                 const isHotShot = post.hot_shot;
                 const config = post.hot_shot_config;
                 const availStatus = isHotShot && config ? formatAvailabilityStatus(
                   config.availableNow,
                   config.availableUntil,
                   config.nextAvailable,
                   config.availability?.timezone
                 ) : null;
                 
                 return (
                   <div
                     key={post.id}
                     className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"
                   >
                     <div className="flex items-start justify-between">
                       <div className="flex-1">
                         {isHotShot && (
                           <Badge className="mb-2 bg-[#FF7A00] text-white">
                             <Zap className="w-3 h-3 mr-1" />
                             HOT SHOT
                           </Badge>
                         )}
                         {isHotShot ? (
                           <>
                             <p className="font-semibold text-sm">{post.from_address}</p>
                             <div className="mt-2 text-xs text-gray-600 space-y-1">
                               <p>Max Distance: {config?.maxDistanceKm || 0}km</p>
                               <p>Max Time: {config?.maxTimeMin || 0} min</p>
                               <p>Base Fee: ${config?.baseFeeCad || 0}</p>
                               {config?.availability && (
                                 <p className="text-[10px] text-gray-500 mt-1">
                                   {formatAvailabilityWindows(config.availability.windows)}
                                 </p>
                               )}
                             </div>
                             {availStatus && (
                               <div className={cn("mt-2 px-2 py-1 rounded-full text-[10px] font-semibold inline-block", availStatus.color)}>
                                 {availStatus.text}
                               </div>
                             )}
                             {post.status === 'paused' && (
                               <div className="mt-2 px-2 py-1 rounded-full text-[10px] font-semibold inline-block bg-gray-100 text-gray-600">
                                 Paused
                               </div>
                             )}
                           </>
                         ) : (
                           <>
                             <p className="font-semibold text-sm">
                               {post.from_address} → {post.to_address}
                             </p>
                             <p className="text-xs text-gray-500 mt-1">
                               {post.notes}
                             </p>
                             {post.status === 'paused' && (
                               <div className="mt-2 px-2 py-1 rounded-full text-[10px] font-semibold inline-block bg-gray-100 text-gray-600">
                                 Paused
                               </div>
                             )}
                           </>
                         )}
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleTogglePost(post)}
                         className="flex-1"
                       >
                         {post.status === 'active' ? (
                           <>
                             <Pause className="w-3 h-3 mr-1" />
                             Pause
                           </>
                         ) : (
                           <>
                             <Play className="w-3 h-3 mr-1" />
                             Resume
                           </>
                         )}
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleEditPost(post)}
                         className="flex-1"
                       >
                         <Edit className="w-3 h-3 mr-1" />
                         Edit
                       </Button>
                     </div>
                   </div>
                 );
               })
             )}
           </TabsContent>
         </Tabs>
       ) : (
         <SenderPost ref={senderPostRef} />
       )}
       
       {activeTab === "create" && (
         <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white border-t border-[var(--border)] p-3" style={{ paddingBottom: '80px', backgroundColor: '#FFFFFF', boxShadow: '0 -2px 6px rgba(0, 0, 0, 0.08)' }}>
           <div className="max-w-lg mx-auto">
             <Button 
               onClick={isDriverMode ? handleDriverPost : handleSenderPost}
               disabled={!currentUser}
               className="w-full h-9 text-sm font-semibold rounded-lg"
               style={{ backgroundColor: modeColor, color: '#FFFFFF' }}
             >
               {isDriverMode ? 'Post Availability' : 'Post Request'}
             </Button>
           </div>
         </div>
       )}
     </div>
  );
}
