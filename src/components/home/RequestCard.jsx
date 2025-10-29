
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, DollarSign, Eye, MessageSquare, Tag, Package, Utensils, Wrench, ShoppingBag, Flame, FileText, ShoppingCart, Hammer, Beer, Users, Zap } from "lucide-react";
import { format } from "date-fns";
import { useETA } from "@/components/useETA";
import { redactName, redactAddress } from "../DataRedaction";
import { openChat } from "../ChatHelpers"; // Removed openOffer
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const categoryIcons = {
  food: Utensils,
  auto_parts: Wrench,
  retail: ShoppingBag,
  firewood: Flame,
  misc: Package,
  ride_share: Users,
  documents: FileText,
  groceries: ShoppingCart,
  parcels: Package,
  beer_run: Beer,
  rideshare: Users
};

export default function RequestCard({ request, currentUser, isGuest, onView, onOffer, onChat }) {
  const navigate = useNavigate();
  const { computeETA } = useETA();
  const etaInfo = computeETA(request);

  const displayName = isGuest
    ? redactName(request?.poster_name || request?.sender_snapshot?.name || 'Sender', true)
    : (request?.poster_name ? request.poster_name.split(' ')[0] : request?.sender_snapshot?.name ? request.sender_snapshot.name.split(' ')[0] : 'Sender');

  const ItemIcon = categoryIcons[request?.item_type] || Package;
  const categoryLabel = (request?.item_type || 'misc').replace('_', ' ');

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
        request.poster_id || request.sender_profile_id,
        {
          id: request.id,
          title: `${originName} → ${destName}`,
          roleOfOwner: 'sender'
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
      // Same as chat - offer happens in the message thread
      await openChat(
        request.poster_id || request.sender_profile_id,
        {
          id: request.id,
          title: `${originName} → ${destName}`,
          roleOfOwner: 'sender'
        },
        navigate
      );
    } catch (error) {
      console.error("Error opening chat for offer:", error); // Updated error message
      toast.error("Couldn't open chat to make an offer. Try again."); // Updated toast message
    }
  };

  return (
    <Card className="p-2 rounded-xl bg-white border border-[#E5E7EB] overflow-hidden" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)' }}>
      <div className="grid grid-cols-[36px_1fr] gap-2">
        <div className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF7A00] to-[#FF8C42] flex items-center justify-center text-white font-semibold text-[11px]">
            {displayName?.charAt(0) || 'S'}
          </div>
          <p className="text-[8px] font-semibold text-center mt-0.5 truncate w-full leading-tight">{displayName}</p>
        </div>

        <div className="flex flex-col min-w-0 overflow-hidden">
          {etaInfo ? (
            <>
              <div className="text-[11px] font-semibold text-[#111111] flex items-center gap-1 leading-[1.25] mb-0.5">
                <MapPin className="w-2.5 h-2.5 flex-shrink-0" style={{ color: '#FF7A00' }} />
                <span className="truncate">
                  {originName} → {destName}
                </span>
              </div>
              <div className="text-[10px] text-[#444444] flex items-center gap-0.5 leading-tight mb-1">
                <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">
                  Deliver by {format(etaInfo.departAt, 'EEE, MMM d, h:mm a')}
                </span>
              </div>
            </>
          ) : (
            <div className="text-[10px] font-semibold text-[#444444] mb-1">Delivery time TBD</div>
          )}

          <div className="flex items-center justify-between mb-1.5 gap-2">
            <div className="text-green-600 font-bold text-[10px] whitespace-nowrap">
              ${(request?.offered_price || 0).toFixed(2)}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
              {(request?.urgency === 'ASAP' || request?.urgency === 'Hot Shot' || request?.is_hot_shot) && (
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
              
              <div className="flex items-center gap-0.5 rounded-full flex-shrink-0"
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
                <ItemIcon className="w-3 h-3" style={{ color: '#222222', stroke: '#222222' }} />
                <span style={{ color: '#222222' }}>{categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1).toLowerCase()}</span>
              </div>
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
              style={{ backgroundColor: '#FFFFFF', borderColor: '#FF7A00', color: '#FF7A00' }}
            >
              <Eye className="w-2.5 h-2.5 mr-0.5" />
              View
            </Button>
            <Button
              onClick={handleOfferClick} // Still uses handleOfferClick, but its implementation changed
              size="sm"
              className="h-[27px] text-[10px] px-2 rounded flex-1 min-w-[60px]"
              style={{ backgroundColor: '#FF7A00', color: '#FFFFFF' }}
            >
              <Tag className="w-2.5 h-2.5 mr-0.5" />
              Offer
            </Button>
            <Button
              onClick={handleChatClick}
              size="sm"
              variant="outline"
              className="h-[27px] text-[10px] px-2 rounded flex-1 min-w-[60px]"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#FF7A00', color: '#FF7A00' }}
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
