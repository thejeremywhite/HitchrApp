
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Car, Truck, Star, MapPin, Clock, DollarSign, MessageSquare, Tag, Utensils, Wrench, ShoppingBag, Flame, Package, FileText, ShoppingCart, Hammer } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { openChat } from '../components/ChatHelpers';

const vehicleIcons = {
  car: Car,
  truck: Truck,
  van: Truck,
  suv: Car,
};

const categoryIcons = {
  food: Utensils,
  auto_parts: Wrench,
  retail: ShoppingBag,
  firewood: Flame,
  misc: Package,
  ride_share: Package,
  documents: FileText,
  groceries: ShoppingCart,
  hardware_tools: Hammer,
  parcels: Package
};

export default function DriverDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const driverId = searchParams.get('driver_id');
  const isTest = searchParams.get('is_test') === 'true';

  // CRITICAL: This is a PUBLIC page, no auth required
  const { data: driver, isLoading: isLoadingDriver } = useQuery({
    queryKey: ['driver-details', driverId, isTest],
    queryFn: async () => {
      if (isTest) {
        const testProfiles = await base44.entities.TestProfile.list();
        const profile = testProfiles.find(p => p.id === driverId);
        if (profile) {
          return {
            ...profile,
            full_name: profile.name,
            _isTestData: true
          };
        }
      } else {
        const users = await base44.entities.User.list();
        return users.find(u => u.id === driverId);
      }
      return null;
    },
    enabled: !!driverId
  });

  // CRITICAL: This is PUBLIC data, no auth required
  const { data: availabilities = [], isLoading: isLoadingAvailabilities } = useQuery({
    queryKey: ['driver-availabilities', driverId, isTest],
    queryFn: async () => {
      const allAvailabilities = await base44.entities.DriverAvailability.list();
      if (isTest) {
        return allAvailabilities.filter(a => a.driver_profile_id === driverId && a.status === 'active');
      } else {
        return allAvailabilities.filter(a => a.driver_id === driverId && a.status === 'active');
      }
    },
    enabled: !!driverId
  });

  const handleMessageClick = async () => {
    try {
      await openChat(
        driverId,
        null,
        navigate
      );
    } catch (error) {
      toast.error("Couldn't open chat. Try again.");
    }
  };

  const handleRequestClick = async () => {
    try {
      const firstAvailability = availabilities[0];
      if (firstAvailability) {
        await openChat(
          driverId,
          {
            id: firstAvailability.id,
            title: `${firstAvailability.from_address.split(',')[0]} → ${firstAvailability.to_address.split(',')[0]}`,
            roleOfOwner: 'driver'
          },
          navigate
        );
      } else {
        toast.error("No active routes available");
      }
    } catch (error) {
      toast.error("Couldn't open chat. Try again.");
    }
  };

  if (isLoadingDriver) {
    return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  }

  if (!driver) {
    return <div className="min-h-screen bg-white flex items-center justify-center">Driver not found</div>;
  }

  const displayName = driver.full_name ? driver.full_name.split(' ')[0] : driver.name ? driver.name.split(' ')[0] : 'Driver';
  const VehicleIcon = vehicleIcons[driver.vehicle_type] || Car;
  const categories = driver.categories_served || [];

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-11 w-11">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Driver Profile</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Card className="p-6">
          <div className="flex items-start gap-4 mb-4">
            {driver.avatar_url ? (
              <img src={driver.avatar_url} alt={displayName} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white font-semibold text-2xl">
                {displayName.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{displayName}</h2>
              {driver._isTestData && <Badge variant="outline" className="mt-1">Test Profile</Badge>}
              <div className="flex items-center gap-2 mt-2">
                <VehicleIcon className="w-5 h-5 text-[var(--primary)]" />
                <span className="text-sm capitalize">{driver.vehicle_type}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-semibold">4.8</span>
                <span className="text-xs text-[var(--text-secondary)]">(24 trips)</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Willing to Carry</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const Icon = categoryIcons[cat] || Package;
                return (
                  <Badge key={cat} variant="outline" className="flex items-center gap-1">
                    <Icon className="w-3 h-3" />
                    <span className="capitalize">{cat.replace('_', ' ')}</span>
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-5 h-5 text-[var(--primary)]" />
              <span>Base Fee: <strong>${driver.base_fee || 15}</strong></span>
            </div>
          </div>
        </Card>

        <div>
          <h3 className="font-semibold text-lg mb-3">Active Routes</h3>
          {isLoadingAvailabilities ? (
            <p className="text-sm text-[var(--text-secondary)]">Loading routes...</p>
          ) : availabilities.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No active routes posted</p>
          ) : (
            <div className="space-y-3">
              {availabilities.map((avail) => (
                <Card key={avail.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[var(--primary)]" />
                      <span>{avail.from_address.split(',')[0]} → {avail.to_address.split(',')[0]}</span>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{format(new Date(avail.window_start || avail.depart_at), 'MMM d, h:mm a')}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm font-semibold text-[var(--primary)]">${avail.min_fee}</span>
                    <div className="flex gap-1">
                      {(avail.capacities || []).slice(0, 3).map((cat, idx) => {
                        const Icon = categoryIcons[cat] || Package;
                        return (
                          <div key={idx} className="w-5 h-5 rounded-full bg-[var(--subtle-bg)] flex items-center justify-center">
                            <Icon className="w-3 h-3 text-[var(--primary)]" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button 
            onClick={handleMessageClick}
            variant="outline"
            className="h-12 border-2 border-[var(--primary)] text-[var(--primary)]"
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Message
          </Button>
          <Button 
            onClick={handleRequestClick}
            className="h-12 bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
          >
            <Tag className="w-5 h-5 mr-2" />
            Send Request
          </Button>
        </div>
      </div>
    </div>
  );
}
