
import React, { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Car, Calendar, Beer, Users, MessageSquare, Tag, Utensils, Wrench, ShoppingBag, Flame, Package, ShoppingCart, Droplet, Repeat, Zap, Star } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useETA } from '@/components/useETA';
import { redactName, redactAddress } from '../DataRedaction';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { openChat, openOffer } from "../ChatHelpers";

const categoryIcons = {
  food: Utensils,
  auto_parts: Wrench,
  retail: ShoppingBag,
  firewood: Flame,
  misc: Package,
  groceries: ShoppingCart,
  parcels: Package,
  liquids: Droplet,
  passengers: Users,
  beer_run: Beer,
  rideshare: Car
};

export default function DetailsSheet({ item, mode, isGuest, open, onClose, onOffer, onChat }) {
  const navigate = useNavigate();
  const [notesExpanded, setNotesExpanded] = useState(false);
  const { computeETA } = useETA();

  if (!item) return null;

  const isDriverMode = mode === 'driver';
  const driver = isDriverMode ? null : item.driver;
  const request = isDriverMode ? item : null;
  const availability = isDriverMode ? null : item.availability;

  const rawDisplayName = driver?.name || driver?.full_name || request?.poster_name || 'User';
  const displayName = isGuest ? redactName(rawDisplayName, true) : rawDisplayName;
  const avatarUrl = driver?.avatar_url || null;

  const categories = driver?.categories_served || (request?.item_type ? [request?.item_type] : []);
  const notes = availability?.notes || request?.item_notes || '';
  const truncatedNotes = notes.length > 100 && !notesExpanded ? notes.substring(0, 100) + '...' : notes;

  const etaInfo = isDriverMode ? computeETA(request) : computeETA({ availability, driver });
  const isBooked = request?.status === 'booked';

  const originName = isGuest
    ? redactAddress(etaInfo?.originName || '', true)
    : etaInfo?.originName || '';
  const destName = isGuest
    ? redactAddress(etaInfo?.destName || '', true)
    : etaInfo?.destName || '';

  const handleViewProfile = () => {
    if (isGuest) {
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }

    if (driver) {
      navigate(createPageUrl('DriverDetails') + `?driver_id=${driver.id}&is_test=${driver._isTestData || false}`);
      onClose();
    }
  };

  const handleChatClick = async () => {
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
      onClose();
    } catch (error) {
      console.error("Error opening chat:", error);
      toast.error("Couldn't open chat. Try again.");
    }
  };

  const handleOfferClick = async () => {
    try {
      if (mode === 'driver') {
        await openOffer(
          item.id,
          item.poster_id || item.sender_profile_id,
          navigate
        );
      } else {
        await openOffer(
          item.availability?.id || item.driver?.id,
          item.driver?.id,
          navigate
        );
      }
      onClose();
    } catch (error) {
      console.error("Error opening offer:", error);
      toast.error("Couldn't open offer. Try again.");
    }
  };

  const modeColor = mode === 'driver' ? '#2FB5C0' : '#FF7A00';
  const accentColor = modeColor;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="h-[65vh] rounded-t-3xl border-none"
        style={{ 
          boxShadow: '0 -4px 10px rgba(0, 0, 0, 0.08)',
          backgroundColor: '#FFFFFF'
        }}
      >
        <div className="flex items-center justify-between mb-6 -mx-6 -mt-6 px-6 py-4 rounded-t-3xl" style={{ backgroundColor: modeColor }}>
          <h2 className="text-xl font-bold text-white">Details</h2>
        </div>

        <div className="flex flex-col h-[calc(65vh-100px)] overflow-y-auto pb-4 space-y-6">
          <div className="flex items-center gap-4 cursor-pointer" onClick={handleViewProfile}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-xl"
                style={{ background: 'linear-gradient(135deg, #2FB5C0 0%, #FF8C42 100%)' }}
              >
                {displayName?.charAt(0) || 'U'}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-[#111111]">{displayName}</h2>
              
              {driver && driver.driver_rating_count > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-semibold text-[#111111]">
                    {driver.driver_rating_avg?.toFixed(1) || '0.0'}
                  </span>
                  <span className="text-sm text-[#7C8B96]">
                    ({driver.driver_rating_count} {driver.driver_rating_count === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}
              
              {request && request.sender_snapshot?.sender_rating_count > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-semibold text-[#111111]">
                    {request.sender_snapshot?.sender_rating_avg?.toFixed(1) || '0.0'}
                  </span>
                  <span className="text-sm text-[#7C8B96]">
                    ({request.sender_snapshot?.sender_rating_count} {request.sender_snapshot?.sender_rating_count === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}
              
              {driver?.vehicle_type && (
                <div className="flex items-center gap-2 text-sm text-[#444444] mt-1">
                  <Car className="w-4 h-4" />
                  <span className="capitalize">{driver.vehicle_type}</span>
                </div>
              )}
              {isGuest && (
                <Badge variant="outline" className="mt-2 text-xs">Sign in to view full details</Badge>
              )}
              {isBooked && (
                <Badge className="mt-2 bg-green-100 text-green-800">Booked</Badge>
              )}
            </div>
          </div>

          {etaInfo ? (
            <div>
              <div className="flex items-start gap-2 text-base mb-2">
                {availability?.recurring_pattern && availability.recurring_pattern !== 'None' && (
                  <Repeat className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: modeColor }} />
                )}
                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: modeColor }} />
                <span className="font-semibold text-[#111111]">{originName} → {destName}</span>
              </div>
              
              {availability?.recurring_pattern && availability.recurring_pattern !== 'None' && (
                <div className="flex items-center gap-2 text-sm text-[#444444] ml-7 mt-1">
                  <span>Runs {availability.recurring_pattern}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-[#444444] ml-7 mt-1">
                <Clock className="w-4 h-4" />
                <span>
                  Leaving {originName} • {format(etaInfo.departAt, 'EEE, MMM d, h:mm a')}
                </span>
              </div>

              {etaInfo.etaAt && (
                <div className="flex items-center gap-2 text-sm text-[#444444] ml-7 mt-1">
                  <Clock className="w-4 h-4" />
                  <span>
                    ETA to {destName} • {format(etaInfo.etaAt, 'EEE, MMM d, h:mm a')} {etaInfo.bufferTag}
                  </span>
                </div>
              )}

              {etaInfo.returnDepartAt && (
                <div className="flex items-center gap-2 text-sm text-[#999999] ml-7 mt-1">
                  <Clock className="w-4 h-4" />
                  <span>
                    Return: leaving {destName} • {format(etaInfo.returnDepartAt, 'EEE, MMM d, h:mm a')}
                  </span>
                </div>
              )}

              {request && (request.urgency === 'ASAP' || request.urgency === 'Hot Shot' || request.is_hot_shot) && (
                <div className="flex items-center gap-2 text-sm text-[#444444] ml-7 mt-1">
                  <Zap className="w-4 h-4" style={{ color: modeColor }} />
                  <span className="font-semibold">{request.urgency || 'Hot Shot'} Delivery</span>
                </div>
              )}
              
              {request?.needed_by && (
                <div className="flex items-center gap-2 text-sm text-[#444444] ml-7 mt-1">
                  <Clock className="w-4 h-4" />
                  <span>Needed by {format(new Date(request.needed_by), 'EEE, MMM d, h:mm a')}</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="text-sm text-[#444444]">Leaving time TBD</div>
            </div>
          )}

          {categories.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 text-[#111111]">
                {isDriverMode ? 'Item Type' : 'Will Carry'}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {!isDriverMode && (availability?.hot_shot || driver?.hot_shot_capable) && (
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
                
                {categories.map((cat, idx) => {
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
            </div>
          )}

          {notes && (
            <div>
              <h3 className="font-semibold mb-2 text-[#111111]">Notes</h3>
              <p className="text-sm text-[#444444]">
                {truncatedNotes}
                {notes.length > 100 && (
                  <button
                    onClick={() => setNotesExpanded(!notesExpanded)}
                    className="font-semibold ml-2"
                    style={{ color: modeColor }}
                  >
                    {notesExpanded ? 'See less' : 'See more'}
                  </button>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t" style={{ borderTopColor: '#E7E9EB', backgroundColor: '#FFFFFF' }}>
          <div className="flex gap-3 mt-6">
            <Button
              onClick={handleChatClick}
              variant="outline"
              className="flex-1 h-12"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              Chat
            </Button>
            {!isBooked && (
              <Button
                onClick={handleOfferClick}
                className="flex-1 h-12"
                style={{ backgroundColor: accentColor, color: '#FFFFFF' }}
              >
                <Tag className="w-5 h-5 mr-2" />
                Offer
              </Button>
            )}
            {driver && isBooked && (
              <Button
                onClick={handleViewProfile}
                variant="outline"
                className="flex-1 h-12"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E7E9EB', color: '#333F48' }}
              >
                {isGuest ? 'Sign In' : 'Profile'}
              </Button>
            )}
            {driver && !isBooked && (
              <Button
                onClick={handleViewProfile}
                variant="outline"
                className="h-12 w-12 p-0 flex-shrink-0"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E7E9EB', color: '#333F48' }}
              >
                <Users className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
