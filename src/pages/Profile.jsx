
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "../components/ThemeProvider";
import { User, Truck, Phone, Bell, LogOut, Wallet, Palette, BookUser, ChevronRight, Edit, ShieldX, Upload, DollarSign, Package, Car, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import HitchrLogo from "../components/HitchrLogo";
import AddressInput from "../components/AddressInput";
import ThemeSwitch from "../components/ThemeSwitch";
import HotShotAvailabilityPicker from "../components/HotShotAvailabilityPicker"; // Assuming this component exists

const categoryOptions = ["food", "auto_parts", "retail", "firewood", "misc", "rideshare", "beer_run"];

const SmartSuggestions = ({ field, onSelect }) => {
  const suggestions = {
    capacityNotes: [
      "Can carry large items (furniture, appliances)",
      "Truck bed available",
      "Can carry up to 4 passengers",
      "Small parcels only",
      "Temperature controlled storage",
    ],
  };

  const currentSuggestions = suggestions[field] || [];

  return (
    <div className="flex flex-wrap gap-2 mt-2 text-sm">
      {currentSuggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className="px-3 py-1 bg-gray-100 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-200"
        >
          {s}
        </button>
      ))}
    </div>
  );
};

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const fileInputRef = React.useRef(null);

  const [mode, setMode] = useState(() => localStorage.getItem('hitchr.mode') || 'sender');

  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [editingUser, setEditingUser] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  
  const [hotShotEnabled, setHotShotEnabled] = useState(false);
  const [hotShotBaseLocation, setHotShotBaseLocation] = useState("");
  const [hotShotBaseLat, setHotShotBaseLat] = useState(null);
  const [hotShotBaseLng, setHotShotBaseLng] = useState(null);
  const [hotShotMaxDistance, setHotShotMaxDistance] = useState("50");
  const [hotShotMaxTime, setHotShotMaxTime] = useState("60");
  const [hotShotBaseFee, setHotShotBaseFee] = useState("25");
  const [hotShotNotes, setHotShotNotes] = useState("");
  const [hotShotAvailability, setHotShotAvailability] = useState([]); // New state for availability
  const [hotShotErrors, setHotShotErrors] = useState({});
  const [hotShotDirty, setHotShotDirty] = useState(false);

  useEffect(() => {
    const handleModeChange = (event) => setMode(event.detail.mode);
    window.addEventListener('HITCHR_MODE_CHANGED', handleModeChange);
    return () => window.removeEventListener('HITCHR_MODE_CHANGED', handleModeChange);
  }, []);

  const modeColor = mode === 'driver' ? '#2FB5C0' : '#FF7A00';
  const modeColorLight = mode === 'driver' ? '#E6F9FB' : '#FFE8D6';

  const {data: userRequests } = useQuery({
      queryKey: ['user-escrow-requests', user?.id],
      queryFn: () => base44.entities.Request.filter({ filter: { poster_id: { eq: user.id }, status: { eq: 'in_escrow' } } }),
      enabled: !!user
  });

  const pendingAmount = (userRequests || []).reduce((acc, req) => acc + (req.final_price || 0), 0);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setEditingUser(currentUser);
        
        // Load hotshot config
        if (currentUser.hotshot) {
          setHotShotEnabled(currentUser.hotshot.enabled || false);
          setHotShotBaseLocation(currentUser.hotshot.baseLocation?.label || "");
          setHotShotBaseLat(currentUser.hotshot.baseLocation?.lat || null);
          setHotShotBaseLng(currentUser.hotshot.baseLocation?.lng || null);
          setHotShotMaxDistance(String(currentUser.hotshot.maxDistanceKm || 50));
          setHotShotMaxTime(String(currentUser.hotshot.maxTimeMin || 60));
          setHotShotBaseFee(String(currentUser.hotshot.baseFeeCad || 25));
          setHotShotNotes(currentUser.hotshot.notes || "");
          setHotShotAvailability(currentUser.hotshot.availability?.windows || []); // Load availability
        }
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const updateUserMutation = useMutation({
    mutationFn: async (data) => {
      const updatePayload = { ...data };
      delete updatePayload.id;
      delete updatePayload.created_date;
      delete updatePayload.updated_date;
      delete updatePayload.email;
      return await base44.auth.updateMe(updatePayload);
    },
    onSuccess: (updatedUser) => {
      console.log('[PROFILE] User updated successfully');
      const newUser = {...user, ...updatedUser};
      setUser(newUser);
      setEditingUser(newUser);
      queryClient.setQueryData(['user', 'me'], newUser);
      queryClient.invalidateQueries({queryKey: ['users']});
    },
    onError: (error) => {
      console.error("[PROFILE] Profile update failed:", error);
      setStatusMessage({ type: 'error', text: 'Failed to update profile' });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  });
  
  const uploadAvatarMutation = useMutation({
      mutationFn: async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return file_url;
      },
      onSuccess: (url) => {
          console.log('[PROFILE] Photo uploaded successfully');
          updateUserMutation.mutate({ avatar_url: url });
      },
      onError: (error) => {
          console.error("[PROFILE] Photo upload failed:", error);
          setStatusMessage({ type: 'error', text: 'Failed to upload photo' });
          setTimeout(() => setStatusMessage(null), 5000);
      }
  });

  const handleAvatarChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          uploadAvatarMutation.mutate(file);
      }
  };

  const handleSaveProfile = async () => {
    try {
      const payload = {};
      for (const key in editingUser) {
        if (JSON.stringify(editingUser[key]) !== JSON.stringify(user[key])) {
          payload[key] = editingUser[key];
        }
      }

      if (Object.keys(payload).length > 0) {
        await updateUserMutation.mutateAsync(payload);
        setStatusMessage({ type: 'success', text: 'Profile updated' });
        setTimeout(() => setStatusMessage(null), 3000);
      }
      setShowProfileEdit(false);
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };
  
  const handleDriverToggle = (isDriver) => {
      updateUserMutation.mutate({ is_driver: isDriver });
  }
  
  const validateHotShotConfig = () => {
    const errors = {};
    
    if (hotShotEnabled) {
      if (!hotShotBaseLocation || !hotShotBaseLat || !hotShotBaseLng) {
        errors.baseLocation = "Base location is required";
      }
      
      const distance = parseFloat(hotShotMaxDistance);
      if (isNaN(distance) || distance < 1 || distance > 500) {
        errors.maxDistance = "Distance must be between 1-500 km";
      }
      
      const time = parseFloat(hotShotMaxTime);
      if (isNaN(time) || time < 5 || time > 600) {
        errors.maxTime = "Time must be between 5-600 minutes";
      }
      
      const fee = parseFloat(hotShotBaseFee);
      if (isNaN(fee) || fee < 0) {
        errors.baseFee = "Fee must be 0 or greater";
      }
      
      if (hotShotNotes.length > 120) {
        errors.notes = "Notes must be 120 characters or less";
      }

      if (hotShotAvailability.length === 0) {
        errors.availability = "At least one availability window is required";
      }

      hotShotAvailability.forEach((window, index) => {
        if (window.days.length === 0) {
          errors[`window${index}Days`] = "Select at least one day";
        }
        const [startH, startM] = window.start.split(':').map(Number);
        const [endH, endM] = window.end.split(':').map(Number);
        if (startH * 60 + startM >= endH * 60 + endM) {
          errors[`window${index}Time`] = "End time must be after start time";
        }
      });
    }
    
    setHotShotErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSaveAndPostHotShot = async () => {
    if (!validateHotShotConfig()) {
      return;
    }
    
    try {
      const hotShotConfig = {
        enabled: hotShotEnabled,
        postId: user.hotshot?.postId || null, // Preserve postId if it exists, or initialize
        baseLocation: hotShotEnabled ? {
          lat: hotShotBaseLat,
          lng: hotShotBaseLng,
          label: hotShotBaseLocation
        } : user.hotshot?.baseLocation || null, // Keep existing if disabling
        maxDistanceKm: parseFloat(hotShotMaxDistance), // Always save
        maxTimeMin: parseFloat(hotShotMaxTime), // Always save
        baseFeeCad: parseFloat(hotShotBaseFee), // Always save
        notes: hotShotNotes, // Always save
        availability: {
          timezone: 'America/Vancouver', // Hardcoded for now
          windows: hotShotAvailability,
          blackoutDates: []
        }
      };
      
      if (hotShotEnabled) {
        // Compute availability status
        const { computeAvailability } = await import('../components/HotShotAvailabilityUtils');
        const availStatus = computeAvailability(hotShotAvailability, [], 'America/Vancouver');
        
        // Create or update Hot Shot post
        const postData = {
          driver_id: user.id,
          driver_snapshot: {
            name: user.full_name,
            email: user.email,
            vehicle_type: user.vehicle_type
          },
          from_address: hotShotBaseLocation,
          from_latitude: hotShotBaseLat,
          from_longitude: hotShotBaseLng,
          to_address: hotShotBaseLocation,
          to_latitude: hotShotBaseLat,
          to_longitude: hotShotBaseLng,
          depart_at: new Date().toISOString(),
          hot_shot: true,
          hot_shot_config: { // New field to store full config on the post
            maxDistanceKm: hotShotConfig.maxDistanceKm,
            maxTimeMin: hotShotConfig.maxTimeMin,
            baseFeeCad: hotShotConfig.baseFeeCad,
            notes: hotShotConfig.notes,
            availability: hotShotConfig.availability,
            availableNow: availStatus.availableNow,
            availableUntil: availStatus.availableUntil,
            nextAvailable: availStatus.nextAvailable,
          },
          vehicle_type: user.vehicle_type,
          capacities: user.categories_served || [],
          min_fee: hotShotConfig.baseFeeCad, // Use the configured base fee
          notes: `Hot Shot: ${hotShotConfig.notes || "Available for special trips"}. Max ${hotShotConfig.maxDistanceKm}km, ${hotShotConfig.maxTimeMin}min.`,
          status: "active"
        };
        
        let postId = user.hotshot?.postId;
        
        if (postId) {
          // Update existing post
          try {
            await base44.entities.DriverAvailability.update(postId, postData);
          } catch (error) {
            // Post might not exist, create new one
            console.warn("Hot Shot post ID existed but update failed, creating new one:", error);
            const newPost = await base44.entities.DriverAvailability.create(postData);
            postId = newPost.id;
          }
        } else {
          // Create new post
          const newPost = await base44.entities.DriverAvailability.create(postData);
          postId = newPost.id;
        }
        
        hotShotConfig.postId = postId; // Update postId in user's hotshot config
        
        await updateUserMutation.mutateAsync({ hotshot: hotShotConfig });
        setHotShotDirty(false);
        setStatusMessage({ type: 'success', text: 'Hot Shot settings saved and posted!' });
        setTimeout(() => setStatusMessage(null), 3000);
        
        queryClient.invalidateQueries({ queryKey: ['home-data'] });
        queryClient.invalidateQueries({ queryKey: ['driver-availabilities'] });
        queryClient.invalidateQueries({ queryKey: ['current-posts'] }); // Invalidate current posts
        
        // Navigate to Post → Current Posts
        navigate(createPageUrl('Post') + '?tab=current');
      } else {
        // Hot Shot disabled - pause existing post if it exists
        if (user.hotshot?.postId) {
          try {
            await base44.entities.DriverAvailability.update(user.hotshot.postId, { status: "paused" });
          } catch (error) {
            console.error("Failed to pause hot shot post:", error);
          }
        }
        // Do NOT set hotShotConfig.postId = null; here. Keep the postId to link to the paused post.
        
        await updateUserMutation.mutateAsync({ hotshot: hotShotConfig });
        setHotShotDirty(false);
        setStatusMessage({ type: 'success', text: 'Hot Shot disabled' });
        setTimeout(() => setStatusMessage(null), 3000);
        
        queryClient.invalidateQueries({ queryKey: ['home-data'] });
        queryClient.invalidateQueries({ queryKey: ['driver-availabilities'] });
        queryClient.invalidateQueries({ queryKey: ['current-posts'] }); // Invalidate current posts
      }
    } catch (error) {
      console.error("Failed to save hot shot:", error);
      setStatusMessage({ type: 'error', text: 'Failed to save Hot Shot settings' });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (!user) return <div className="p-8 text-center text-sm">Loading...</div>;

  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HitchrLogo mode={mode} size={24} />
              <h1 className="text-xl font-semibold">Profile</h1>
            </div>
          </div>
          
          {statusMessage && (
            <div className={`mt-3 flex items-start gap-2 p-3 rounded-lg ${
              statusMessage.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              )}
              <p className={`text-sm font-medium ${
                statusMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>{statusMessage.text}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        <Card className="p-4 rounded-2xl bg-white border-none shadow-[var(--shadow)]">
          <div className="flex items-start gap-4 mb-6">
            <div className="relative w-16 h-16 flex-shrink-0">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                />
                {user.avatar_url ? (
                    <img src={user.avatar_url} alt="Profile" className="w-16 h-16 rounded-full object-cover"/>
                ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-xl font-semibold">
                      {user.full_name?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                )}
                <Button 
                    size="icon"
                    onClick={() => fileInputRef.current.click()}
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border shadow-md"
                    aria-label="Upload profile photo"
                >
                    <Upload className="w-3 h-3 text-slate-600"/>
                </Button>
            </div>
            <div className="flex-1 pt-1">
              <div className="flex items-center gap-2">
                 <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {user.full_name || user.id}
                 </h2>
                 <button 
                    onClick={() => {
                        setEditingUser(user);
                        setShowProfileEdit(true);
                    }} 
                    className="text-[var(--primary)]"
                 >
                   <Edit className="w-3 h-3" />
                 </button>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Link to={createPageUrl("Wallet")} className="w-full text-left flex items-center justify-between p-3 bg-[var(--subtle-bg)] rounded-xl min-h-[60px]">
                <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-[var(--text-secondary)]" />
                    <div>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">Wallet</span>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Balance: ${(user.wallet_balance || 0).toFixed(2)}
                      </p>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </Link>
            <Link to={createPageUrl("AddressBook")} className="w-full text-left flex items-center justify-between p-3 bg-[var(--subtle-bg)] rounded-xl min-h-[60px]">
                <div className="flex items-center gap-3">
                    <BookUser className="w-5 h-5 text-[var(--text-secondary)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Address Book</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </Link>
            <Link to={createPageUrl("NotificationsSettings")} className="w-full text-left flex items-center justify-between p-3 bg-[var(--subtle-bg)] rounded-xl min-h-[60px]">
                <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Notifications</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </Link>
            <Link to={createPageUrl("BlockedUsers")} className="w-full text-left flex items-center justify-between p-3 bg-[var(--subtle-bg)] rounded-xl min-h-[60px]">
                <div className="flex items-center gap-3">
                    <ShieldX className="w-5 h-5 text-[var(--text-secondary)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Blocked Users</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </Link>
          </div>
        </Card>

        {/* Role Selection with Pill Chips */}
        <Card className="p-4 rounded-2xl bg-white border-none shadow-[var(--shadow)]">
          <h3 className="font-semibold text-sm mb-3">I want to...</h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={async () => {
                const newIsSender = !user.is_sender;
                await updateUserMutation.mutateAsync({ is_sender: newIsSender });
                
                if (!newIsSender && user.is_driver) {
                  setMode('driver');
                  localStorage.setItem('hitchr.mode', 'driver');
                  window.dispatchEvent(new CustomEvent('HITCHR_MODE_CHANGED', { detail: { mode: 'driver' } }));
                  await base44.auth.updateMe({ current_mode: 'driver', last_mode_change: new Date().toISOString() });
                }
              }}
              className="pill-chip h-9 px-4 rounded-full text-sm font-semibold transition-all"
              style={user.is_sender ? {
                backgroundColor: '#FF7A00',
                borderColor: '#FF7A00',
                color: '#FFFFFF'
              } : {
                backgroundColor: 'transparent',
                borderColor: '#E7E9EB',
                color: '#333F48'
              }}
            >
              Send Packages
            </button>
            <button
              onClick={async () => {
                const newIsDriver = !user.is_driver;
                await updateUserMutation.mutateAsync({ is_driver: newIsDriver });
                
                if (!newIsDriver && user.is_sender) {
                  setMode('sender');
                  localStorage.setItem('hitchr.mode', 'sender');
                  window.dispatchEvent(new CustomEvent('HITCHR_MODE_CHANGED', { detail: { mode: 'sender' } }));
                  await base44.auth.updateMe({ current_mode: 'sender', last_mode_change: new Date().toISOString() });
                } else if (newIsDriver && !user.is_sender) {
                  setMode('driver');
                  localStorage.setItem('hitchr.mode', 'driver');
                  window.dispatchEvent(new CustomEvent('HITCHR_MODE_CHANGED', { detail: { mode: 'driver' } }));
                  await base44.auth.updateMe({ current_mode: 'driver', last_mode_change: new Date().toISOString() });
                }
              }}
              className="pill-chip h-9 px-4 rounded-full text-sm font-semibold transition-all"
              style={user.is_driver ? {
                backgroundColor: '#2FB5C0',
                borderColor: '#2FB5C0',
                color: '#FFFFFF'
              } : {
                backgroundColor: 'transparent',
                borderColor: '#E7E9EB',
                color: '#333F48'
              }}
            >
              Drive & Deliver
            </button>
          </div>
        </Card>
        
        {/* Driver Settings */}
        {user?.is_driver && (
          <Card className="p-4 rounded-2xl bg-white border-none shadow-[var(--shadow)]">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: '#2FB5C0' }}>
              <Truck className="w-4 h-4" />
              Driver Settings
            </h3>
            <div className="space-y-4">
                {/* Categories with Pill Chips */}
                <div className="pt-2">
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
                    Willing to Carry
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categoryOptions.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          const current = user.categories_served || [];
                          const updated = current.includes(cat)
                            ? current.filter(c => c !== cat)
                            : [...current, cat];
                          updateUserMutation.mutate({ categories_served: updated });
                        }}
                        className="pill-chip h-8 px-4 text-sm rounded-full font-semibold transition-all capitalize"
                        style={(user.categories_served || []).includes(cat) ? {
                          backgroundColor: '#2FB5C0',
                          borderColor: '#2FB5C0',
                          color: '#FFFFFF'
                        } : {
                          backgroundColor: 'transparent',
                          borderColor: '#E7E9EB',
                          color: '#333F48'
                        }}
                      >
                        {cat.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Hot Shot Availability Card */}
                <div className="border border-[#E7E9EB] rounded-xl p-4 bg-[#FAFAFA]">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <Zap className="w-5 h-5 text-[#FF7A00]" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-[#333F48]">Hot Shot Availability</p>
                        <p className="text-xs text-[#7C8B96] mt-0.5">
                          Not currently going that way but willing to make a special trip around a town or nearby area.
                        </p>
                      </div>
                    </div>
                    <ThemeSwitch
                      checked={hotShotEnabled}
                      onCheckedChange={(checked) => {
                        setHotShotEnabled(checked);
                        setHotShotDirty(true);
                        if (!checked) {
                          setHotShotErrors({});
                        }
                      }}
                      label="Hot Shot"
                      ariaLabel="Toggle Hot Shot Availability"
                    />
                  </div>
                  
                  {hotShotEnabled && (
                    <div className="mt-4 space-y-3 border-t border-[#E7E9EB] pt-4">
                      <div>
                        <Label className="text-xs font-medium text-[#333F48] mb-1 block">Base Location</Label>
                        <AddressInput
                          value={hotShotBaseLocation}
                          onChange={(e) => {
                            setHotShotBaseLocation(e.target.value);
                            setHotShotDirty(true);
                          }}
                          onLocationUpdate={(data) => {
                            setHotShotBaseLocation(data.address);
                            setHotShotBaseLat(data.lat);
                            setHotShotBaseLng(data.lng);
                            setHotShotErrors({...hotShotErrors, baseLocation: null});
                            setHotShotDirty(true);
                          }}
                          placeholder="Enter your base location"
                          className="h-9 text-sm"
                          name="hotshot-base"
                        />
                        {hotShotErrors.baseLocation && (
                          <p className="text-xs text-red-600 mt-1">{hotShotErrors.baseLocation}</p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-[#333F48] mb-1 block">Max Distance (km)</Label>
                          <Input
                            type="number"
                            min="1"
                            max="500"
                            value={hotShotMaxDistance}
                            onChange={(e) => {
                              setHotShotMaxDistance(e.target.value);
                              setHotShotErrors({...hotShotErrors, maxDistance: null});
                              setHotShotDirty(true);
                            }}
                            className="h-9 text-sm"
                          />
                          {hotShotErrors.maxDistance && (
                            <p className="text-xs text-red-600 mt-1">{hotShotErrors.maxDistance}</p>
                          )}
                        </div>
                        
                        <div>
                          <Label className="text-xs font-medium text-[#333F48] mb-1 block">Max Time (min)</Label>
                          <Input
                            type="number"
                            min="5"
                            max="600"
                            value={hotShotMaxTime}
                            onChange={(e) => {
                              setHotShotMaxTime(e.target.value);
                              setHotShotErrors({...hotShotErrors, maxTime: null});
                              setHotShotDirty(true);
                            }}
                            className="h-9 text-sm"
                          />
                          {hotShotErrors.maxTime && (
                            <p className="text-xs text-red-600 mt-1">{hotShotErrors.maxTime}</p>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-xs text-[#7C8B96]">
                        How far and how long you're willing to go for a special trip.
                      </p>
                      
                      <div>
                        <Label className="text-xs font-medium text-[#333F48] mb-1 block">Base Fee (CAD)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={hotShotBaseFee}
                          onChange={(e) => {
                            setHotShotBaseFee(e.target.value);
                            setHotShotErrors({...hotShotErrors, baseFee: null});
                            setHotShotDirty(true);
                          }}
                          className="h-9 text-sm"
                        />
                        {hotShotErrors.baseFee && (
                          <p className="text-xs text-red-600 mt-1">{hotShotErrors.baseFee}</p>
                        )}
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium text-[#333F48] mb-1 block">
                          Notes <span className="text-[#7C8B96]">(optional, max 120 chars)</span>
                        </Label>
                        <Textarea
                          value={hotShotNotes}
                          onChange={(e) => {
                            setHotShotNotes(e.target.value);
                            setHotShotErrors({...hotShotErrors, notes: null});
                            setHotShotDirty(true);
                          }}
                          maxLength={120}
                          placeholder="Any additional details..."
                          className="h-20 text-sm resize-none"
                        />
                        <div className="flex justify-between items-center mt-1">
                          {hotShotErrors.notes && (
                            <p className="text-xs text-red-600">{hotShotErrors.notes}</p>
                          )}
                          <p className="text-xs text-[#7C8B96] ml-auto">{hotShotNotes.length}/120</p>
                        </div>
                      </div>

                      <HotShotAvailabilityPicker
                        windows={hotShotAvailability}
                        onChange={(windows) => {
                          setHotShotAvailability(windows);
                          setHotShotErrors({...hotShotErrors, availability: null});
                          setHotShotDirty(true);
                        }}
                        errors={hotShotErrors}
                      />
                      {hotShotErrors.availability && (
                        <p className="text-xs text-red-600">{hotShotErrors.availability}</p>
                      )}
                      
                      <Button 
                        onClick={handleSaveAndPostHotShot}
                        disabled={updateUserMutation.isPending || (!hotShotDirty && hotShotEnabled)}
                        className="w-full h-9 text-sm bg-[#2FB5C0] hover:bg-[#28A3AD]"
                      >
                        {updateUserMutation.isPending ? 'Saving...' : (hotShotDirty ? (hotShotEnabled ? 'Save & Post Now' : 'Save') : 'Edit Hot Shot Settings')}
                      </Button>
                    </div>
                  )}

                  {!hotShotEnabled && hotShotDirty && (
                    <div className="mt-3">
                      <Button 
                        onClick={handleSaveAndPostHotShot}
                        disabled={updateUserMutation.isPending}
                        className="w-full h-9 text-sm bg-[#2FB5C0] hover:bg-[#28A3AD]"
                      >
                        {updateUserMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>
            </div>
          </Card>
        )}

        <Card className="p-3 rounded-2xl bg-white border-none shadow-[var(--shadow)]">
            <Label className="flex items-center gap-2 px-1 text-sm mb-2 font-semibold">
              <Palette className="w-4 h-4 text-[var(--text-secondary)]" />
              Theme
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2 rounded-lg border-2 transition-all text-sm font-semibold",
                    theme === option.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-transparent bg-[var(--subtle-bg)] text-[var(--text-secondary)] hover:bg-white"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
        </Card>

        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full h-10 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 text-sm font-semibold"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Edit Profile Dialog */}
      {showProfileEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={editingUser.full_name || ''}
                  onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                  placeholder="John Doe"
                  autoComplete="name"
                  name="full-name"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                  placeholder="(555) 123-4567"
                  type="tel"
                  autoComplete="tel"
                  name="phone"
                  className="h-9 text-sm"
                />
              </div>
              {editingUser.is_driver && (
                <>
                  <div>
                    <Label>Vehicle Type</Label>
                    <Select 
                      value={editingUser.vehicle_type || 'car'}
                      onValueChange={(value) => setEditingUser({...editingUser, vehicle_type: value})}
                    >
                      <SelectTrigger className="h-9 text-sm bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                         className="z-[100] bg-white border-[#E5E7EB] shadow-lg rounded-lg"
                         position="popper"
                         sideOffset={4}
                      >
                        <SelectItem value="car" className="text-sm">Car</SelectItem>
                        <SelectItem value="truck" className="text-sm">Truck</SelectItem>
                        <SelectItem value="van" className="text-sm">Van</SelectItem>
                        <SelectItem value="suv" className="text-sm">SUV</SelectItem>
                        <SelectItem value="motorcycle" className="text-sm">Motorcycle</SelectItem>
                        <SelectItem value="other" className="text-sm">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Capacity Notes</Label>
                    <SmartSuggestions
                      field="capacityNotes"
                      onSelect={(value) => setEditingUser({...editingUser, capacity_notes: value})}
                    />
                    <Textarea
                      value={editingUser.capacity_notes || ''}
                      onChange={(e) => setEditingUser({...editingUser, capacity_notes: e.target.value})}
                      placeholder="e.g., 'Truck bed available', 'Can carry 4 passengers'"
                      className="mt-2 text-sm"
                      autoCapitalize="sentences"
                      spellCheck="true"
                      name="capacity-notes"
                    />
                  </div>
                  <div>
                    <Label>Base Fee ($)</Label>
                    <Input
                      type="number"
                      value={editingUser.base_fee || 0}
                      onChange={(e) => setEditingUser({...editingUser, base_fee: parseFloat(e.target.value)})}
                      min="0"
                      step="1"
                      inputMode="decimal"
                      autoComplete="off"
                      name="base-fee"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label>Payout Email (e-Transfer)</Label>
                    <Input
                      value={editingUser.payout_email || ''}
                      onChange={(e) => setEditingUser({...editingUser, payout_email: e.target.value})}
                      placeholder="your.email@example.com"
                      type="email"
                      autoComplete="email"
                      name="payout-email"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label>Legal Name (for payouts)</Label>
                    <Input
                      value={editingUser.legal_name || ''}
                      onChange={(e) => setEditingUser({...editingUser, legal_name: e.target.value})}
                      placeholder="John William Doe"
                      autoComplete="name"
                      name="legal-name"
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowProfileEdit(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} className="flex-1 bg-[var(--primary)]">
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
