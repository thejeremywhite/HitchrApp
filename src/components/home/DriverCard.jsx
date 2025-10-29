
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation, Clock, MessageSquare, Eye, Utensils, Wrench, ShoppingBag, Flame, Package as PackageIcon, FileText, ShoppingCart, Hammer, Calendar, Beer, Users, Tag, Repeat, Zap } from "lucide-react";
import { format } from "date-fns";
import { usePricing } from "@/components/usePricing";
import { useETA } from "@/components/useETA";
import { Badge } from "@/components/ui/badge";
import { redactName, redactAddress } from "../DataRedaction";
import { useNavigate } from "react-router-dom";
import { openChat } from "../ChatHelpers";
import { toast } from "sonner";

const categoryIcons = {
  food: Utensils,
  auto_parts: Wrench,
  retail: ShoppingBag,
  firewood: Flame,
  misc: PackageIcon,
  ride_share: Users,
  documents: FileText,
  groceries: ShoppingCart,
  parcels: PackageIcon,
  beer_run: Beer,
  rideshare: Users
};

export default function DriverCard({ availability, driver, currentUser, isGuest, onView, onOffer, onChat }) {
  const navigate = useNavigate();
  const { calculatePrice } = usePricing();
  const { computeETA } = useETA();
  
  const displayName = isGuest 
    ? redactName(driver?.full_name || driver?.name || 'Driver', true)
    : (driver?.full_name ? driver.full_name.split(' ')[0] : driver?.name ? driver.name.split(' ')[0] : 'Driver');
  
  const displayCategories = (availability?.capacities || driver?.categories_served || []).slice(0, 3);

  const distance = driver?._distance || 20;
  const category = displayCategories[0] || 'misc';
  const suggestedPrice = calculatePrice(distance, category);
  
  const etaInfo = computeETA({ availability, driver });

  const originName = isGuest 
    ? redactAddress(etaInfo?.originName || '', true).split(',')[0]
    : etaInfo?.originName || '';
  const destName = isGuest 
    ? redactAddress(etaInfo?.destName || '', true).split(',')[0]
    : etaInfo?.destName || '';

  const handleChatClick = async (e) => {
    e.stopPropagation();
    try {
      await openChat(
        driver.id,
        {
          id: availability?.id || driver.id,
          title: `${originName} → ${destName}`,
          roleOfOwner: 'driver'
        },
        navigate
      );
    } catch (error) {
      console.error("Error opening chat:", error);
      toast.error("Couldn't open chat. Try again.");
    }
  };

  const handleOfferClick = async (e) => {
    e.stopPropagation();
    try {
      await openChat(
        driver.id,
        {
          id: availability?.id || driver.id,
          title: `${originName} → ${destName}`,
          roleOfOwner: 'driver'
        },
        navigate
      );
    } catch (error) {
      console.error("Error opening chat:", error);
      toast.error("Couldn't open chat. Try again.");
    }
  };

  return (
    <Card className="p-2 rounded-xl bg-white border border-[#E5E7EB] overflow-hidden" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)' }}>
      <div className="grid grid-cols-[36px_1fr] gap-2">
        <div className="flex flex-col items-center">
          {driver?.avatar_url ? (
            <img 
              src={driver.avatar_url} 
              alt={displayName}
              className="rounded-full object-cover w-9 h-9"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#43B2C4] to-[#FF8C42] flex items-center justify-center text-white font-semibold text-[11px]">
              {displayName?.charAt(0) || 'D'}
            </div>
          )}
          <p className="text-[8px] font-semibold text-center mt-0.5 truncate w-full leading-tight">{displayName}</p>
        </div>

        <div className="flex flex-col min-w-0 overflow-hidden">
          {etaInfo ? (
            <>
              <div className="text-[11px] font-semibold text-[#111111] flex items-center gap-1 leading-[1.25] mb-0.5">
                <Navigation className="w-2.5 h-2.5 flex-shrink-0" style={{ color: '#43B2C4' }} />
                <span className="truncate">
                  {originName} → {destName}
                </span>
              </div>
              <div className="text-[10px] text-[#444444] flex items-center gap-0.5 leading-tight mb-0.5">
                <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">
                  Leaving {originName} • {format(etaInfo.departAt, 'EEE, MMM d, h:mm a')}
                </span>
              </div>
              {etaInfo.etaAt && (
                <div className="text-[10px] text-[#444444] flex items-center gap-0.5 leading-tight mb-1">
                  <Clock className="w-2.5 h-2.5 flex-shrink-0 invisible" />
                  <span className="truncate">
                    ETA {format(etaInfo.etaAt, 'h:mm a')}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-[10px] font-semibold text-[#444444] mb-1">Leaving time TBD</div>
          )}

          <div className="flex items-center justify-between mb-1.5 gap-2">
            <div className="text-green-600 font-bold text-[10px] whitespace-nowrap">
              From ${suggestedPrice}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
              {availability?.recurring_pattern && availability.recurring_pattern !== 'None' && (
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
              
              {(availability?.hot_shot || driver?.hot_shot_capable) && (
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
              
              {displayCategories.map((cat, idx) => {
                const Icon = categoryIcons[cat] || PackageIcon;
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

          <div className="flex flex-wrap gap-1.5">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              size="sm"
              variant="outline"
              className="h-[27px] text-[10px] px-2 rounded flex-1 min-w-[60px]"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#00B8B8', color: '#00B8B8' }}
            >
              <Eye className="w-2.5 h-2.5 mr-0.5" />
              View
            </Button>
            <Button
              onClick={handleOfferClick}
              size="sm"
              className="h-[27px] text-[10px] px-2 rounded flex-1 min-w-[60px]"
              style={{ backgroundColor: '#00B8B8', color: '#FFFFFF' }}
            >
              <Tag className="w-2.5 h-2.5 mr-0.5" />
              Offer
            </Button>
            <Button
              onClick={handleChatClick}
              size="sm"
              variant="outline"
              className="h-[27px] text-[10px] px-2 rounded flex-1 min-w-[60px]"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#00B8B8', color: '#00B8B8' }}
            >
              <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
              Chat
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
