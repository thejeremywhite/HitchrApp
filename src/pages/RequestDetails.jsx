
import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Package, Clock, DollarSign, MessageSquare, Tag, CheckCircle, Utensils, Wrench, ShoppingBag, Flame, FileText, ShoppingCart, Hammer } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { openChat } from '../components/ChatHelpers'; // Updated import for ChatHelpers - removed openOffer

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

export default function RequestDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request_id');
  // Removed isAuthenticated state and useEffect as authentication is now handled within openChat/openOffer

  // CRITICAL: This is a PUBLIC page, no auth required
  const { data: request, isLoading } = useQuery({
    queryKey: ['request-details', requestId],
    queryFn: async () => {
      const requests = await base44.entities.Request.list();
      return requests.find(r => r.id === requestId);
    },
    enabled: !!requestId
  });

  const handleChatClick = async () => {
    try {
      await openChat(
        request.poster_id || request.sender_profile_id,
        {
          id: request.id,
          title: `${request.pickup_address?.split(',')[0]} → ${request.dropoff_address?.split(',')[0]}`,
          roleOfOwner: 'sender'
        },
        navigate
      );
    } catch (error) {
      toast.error("Couldn't open chat. Try again.");
    }
  };

  const handleOfferClick = async () => {
    try {
      // Same as chat - offer happens in the message thread
      await openChat(
        request.poster_id || request.sender_profile_id,
        {
          id: request.id,
          title: `${request.pickup_address?.split(',')[0]} → ${request.dropoff_address?.split(',')[0]}`,
          roleOfOwner: 'sender'
        },
        navigate
      );
    } catch (error) {
      toast.error("Couldn't open chat. Try again.");
    }
  };

  // Removed handleAcceptClick as its functionality is now handled directly in the button's onClick

  if (isLoading) {
    return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  }

  if (!request) {
    return <div className="min-h-screen bg-white flex items-center justify-center">Request not found</div>;
  }

  const ItemIcon = categoryIcons[request.item_type] || Package;
  const displayName = request.poster_name ? request.poster_name.split(' ')[0] : 'Sender';

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-11 w-11">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Request Details</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Card className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white">
              <ItemIcon className="w-8 h-8"/>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold capitalize">{request.item_type?.replace('_', ' ')}</h2>
              <p className="text-sm text-[var(--text-secondary)]">Posted by {displayName}</p>
              {request._isTestData && <Badge variant="outline" className="mt-1">Test Request</Badge>}
              <Badge className="mt-2" variant="outline">
                {request.status}
              </Badge>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-start gap-2">
              <MapPin className="w-5 h-5 text-[var(--primary)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Pickup</p>
                <p className="text-sm text-[var(--text-secondary)]">{request.pickup_address}</p>
              </div>
            </div>
            {request.dropoff_address && (
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Dropoff</p>
                  <p className="text-sm text-[var(--text-secondary)]">{request.dropoff_address}</p>
                </div>
              </div>
            )}
          </div>

          {request.deliver_by && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Clock className="w-5 h-5 text-[var(--primary)]" />
              <span className="text-sm">
                Deliver by <strong>{format(new Date(request.deliver_by), 'MMM d, yyyy h:mm a')}</strong>
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
            <DollarSign className="w-6 h-6 text-[var(--primary)]" />
            <span className="text-lg font-bold text-[var(--primary)]">
              ${(request.counter_price || request.offered_price).toFixed(2)}
            </span>
          </div>

          {request.item_notes && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-[var(--text-secondary)]">{request.item_notes}</p>
            </div>
          )}
        </Card>

        {/* Updated button handlers */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={handleChatClick}
            variant="outline"
            className="h-12 border-2 border-[var(--primary)] text-[var(--primary)]"
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Chat
          </Button>
          <Button
            onClick={handleOfferClick} // This now calls handleOfferClick which internally uses openChat
            variant="outline"
            className="h-12 border-2 border-[var(--accent)] text-[var(--accent)]"
          >
            <Tag className="w-5 h-5 mr-2" />
            Offer
          </Button>
          <Button
            onClick={() => toast.info("Accept functionality coming soon")}
            className="h-12 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
