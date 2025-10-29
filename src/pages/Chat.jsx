
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, MoreVertical, Shield, Flag, Check, CheckCheck, DollarSign } from "lucide-react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Chat() {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [showCounterDialog, setShowCounterDialog] = useState(false); // New state for counter dialog
  const [offerAmount, setOfferAmount] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [counteringMessage, setCounteringMessage] = useState(null); // New state to hold the message being countered
  const messagesEndRef = useRef(null);
  const [mode, setMode] = useState(() => localStorage.getItem('hitchr.mode') || 'sender');
  const [relatedListing, setRelatedListing] = useState(null);

  const modeColor = mode === 'driver' ? '#2FB5C0' : '#FF7A00';

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);

        // Check for pending chat from session storage
        const pendingChat = sessionStorage.getItem('hitchr.pendingChat');
        if (pendingChat) {
          const { relatedListing: pendingListing } = JSON.parse(pendingChat);
          if (pendingListing) {
            setRelatedListing(pendingListing);
          }
          sessionStorage.removeItem('hitchr.pendingChat');
        }

        // Get related listing from navigation state
        if (location.state?.relatedListing) {
          setRelatedListing(location.state.relatedListing);
        }
      } catch (error) {
        base44.auth.redirectToLogin(window.location.pathname);
      }
    };
    loadUser();

    const handleModeChange = (event) => setMode(event.detail.mode);
    window.addEventListener('HITCHR_MODE_CHANGED', handleModeChange);
    return () => window.removeEventListener('HITCHR_MODE_CHANGED', handleModeChange);
  }, [location]);

  // Fetch or create thread
  const { data: thread, isLoading: isLoadingThread } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      if (!currentUser) return null;

      // If we have a threadId, fetch it
      if (threadId && threadId !== 'new') {
        const threads = await base44.entities.Thread.list();
        return threads.find(t => t.id === threadId);
      }

      // Otherwise, try to resolve from peer param
      const peerId = searchParams.get('peer');
      if (!peerId) return null;

      // Find existing thread
      const participants = [currentUser.id, peerId].sort();
      const allThreads = await base44.entities.Thread.list();
      const existing = allThreads.find(t =>
        t.participants?.length === 2 &&
        t.participants.includes(currentUser.id) &&
        t.participants.includes(peerId)
      );

      if (existing) {
        // Redirect to the existing thread
        navigate(createPageUrl("Chat") + `/${existing.id}`, { replace: true, state: location.state });
        return existing;
      }

      // Create new thread
      const newThread = await base44.entities.Thread.create({
        participants,
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: '',
        open: true,
        unreadCounts: {}
      });

      // Redirect to the new thread
      navigate(createPageUrl("Chat") + `/${newThread.id}`, { replace: true, state: location.state });
      return newThread;
    },
    enabled: !!currentUser
  });

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ['messages', thread?.id],
    queryFn: async () => {
      if (!thread) return [];
      const allMessages = await base44.entities.ChatMessage.list('created_date');
      return allMessages.filter(m => m.threadId === thread.id);
    },
    enabled: !!thread,
    refetchInterval: 3000
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  // Mark messages as read
  useEffect(() => {
    if (!thread || !currentUser || messages.length === 0) return;

    const unreadMessages = messages.filter(m =>
      m.senderId !== currentUser.id &&
      !m.readBy?.includes(currentUser.id)
    );

    if (unreadMessages.length === 0) return;

    // Mark as read
    unreadMessages.forEach(async (msg) => {
      await base44.entities.ChatMessage.update(msg.id, {
        readBy: [...(msg.readBy || []), currentUser.id]
      });
    });

    // Reset unread count
    if (thread.unreadCounts?.[currentUser.id] > 0) {
      base44.entities.Thread.update(thread.id, {
        unreadCounts: { ...thread.unreadCounts, [currentUser.id]: 0 }
      });
    }

    queryClient.invalidateQueries({ queryKey: ['threads'] });
  }, [thread, currentUser, messages, queryClient]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      const message = await base44.entities.ChatMessage.create(messageData);

      // Update thread
      const otherUserId = thread.participants.find(id => id !== currentUser.id);
      await base44.entities.Thread.update(thread.id, {
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: messageData.text || 'Sent an offer',
        unreadCounts: {
          ...thread.unreadCounts,
          [otherUserId]: (thread.unreadCounts?.[otherUserId] || 0) + 1
        }
      });

      return message;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', thread?.id] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      setMessageText("");
      setOfferAmount("");
      setOfferNote("");
      setShowOfferDialog(false);
      setShowCounterDialog(false); // Reset counter dialog state
      setCounteringMessage(null); // Reset countering message
      toast.success("Message sent!"); // Add success toast here
    },
    onError: () => {
      toast.error("Failed to send message");
    }
  });

  const handleSend = () => {
    if (!messageText.trim() || !thread || !currentUser) return;

    sendMessageMutation.mutate({
      threadId: thread.id,
      senderId: currentUser.id,
      type: "text",
      text: messageText,
      readBy: [currentUser.id],
      ...(relatedListing && {
        relatedListing: relatedListing
      })
    });

    // Clear related listing after first message
    if (relatedListing) {
      setRelatedListing(null);
    }
  };

  const handleSendOffer = () => {
    if (!offerAmount || parseFloat(offerAmount) <= 0 || !thread || !currentUser) {
      toast.error("Please enter a valid offer amount.");
      return;
    }

    sendMessageMutation.mutate({
      threadId: thread.id,
      senderId: currentUser.id,
      type: "offer",
      text: `Offered $${offerAmount}`,
      offer: {
        amount: parseFloat(offerAmount),
        currency: "CAD",
        status: "sent",
        note: offerNote
      },
      readBy: [currentUser.id],
      ...(relatedListing && {
        relatedListing: relatedListing
      })
    });

    // Clear related listing after sending an offer
    if (relatedListing) {
      setRelatedListing(null);
    }
  };

  const handleCounterOffer = async () => {
    if (!offerAmount || parseFloat(offerAmount) <= 0 || !counteringMessage || !thread || !currentUser) {
      toast.error("Please enter a valid counter offer amount.");
      return;
    }

    // Mark original offer as countered
    await base44.entities.ChatMessage.update(counteringMessage.id, {
      offer: { ...counteringMessage.offer, status: 'countered' }
    });

    // Send counter offer
    sendMessageMutation.mutate({
      threadId: thread.id,
      senderId: currentUser.id,
      type: "offer",
      text: `Counter-offered $${offerAmount}`,
      offer: {
        amount: parseFloat(offerAmount),
        currency: "CAD",
        status: "sent",
        note: offerNote,
        counterTo: counteringMessage.id // Link to the message being countered
      },
      readBy: [currentUser.id]
    });

    // Invalidate queries to refresh messages and reflect status change on original message
    queryClient.invalidateQueries({ queryKey: ['messages', thread?.id] });
  };

  const handleOfferAction = async (message, action) => {
    if (!message.offer) return;

    const newStatus = action === 'accept' ? 'accepted' : 'withdrawn'; // Only accept or withdraw now

    await base44.entities.ChatMessage.update(message.id, {
      offer: { ...message.offer, status: newStatus }
    });

    // Send system message
    sendMessageMutation.mutate({
      threadId: thread.id,
      senderId: currentUser.id,
      type: "system",
      text: action === 'accept' ? `✅ Offer accepted for $${message.offer.amount}` : `Offer withdrawn ($${message.offer.amount})`,
      readBy: [currentUser.id]
    });

    queryClient.invalidateQueries({ queryKey: ['messages', thread?.id] });
  };

  const handleOpenCounterDialog = (message) => {
    setCounteringMessage(message);
    setOfferAmount(message.offer.amount.toString()); // Pre-fill with original offer amount
    setOfferNote(''); // Clear note for new counter
    setShowCounterDialog(true);
  };

  const handleBlock = async () => {
    if (!currentUser || !otherUser) return;

    const messaging = currentUser.messaging || {};
    const blockedIds = messaging.blockedUserIds || [];

    if (blockedIds.includes(otherUser.id)) {
      // Unblock
      await base44.auth.updateMe({
        messaging: {
          ...messaging,
          blockedUserIds: blockedIds.filter(id => id !== otherUser.id)
        }
      });
      toast.success("User unblocked");
    } else {
      // Block
      await base44.auth.updateMe({
        messaging: {
          ...messaging,
          blockedUserIds: [...blockedIds, otherUser.id]
        }
      });
      toast.success("User blocked");
    }

    queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    setCurrentUser(await base44.auth.me());
  };

  // Add loading skeleton
  if (isLoadingThread) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="max-w-lg mx-auto px-2 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl("Inbox"))} className="rounded-xl h-11 w-11">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-20 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className={cn("flex gap-2", i % 2 === 0 ? 'justify-end' : 'justify-start')}>
              {i % 2 !== 0 && <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />}
              <div className={cn("max-w-[75%]", i % 2 === 0 && 'items-end flex flex-col')}>
                <div className={cn("rounded-2xl px-4 py-2.5", i % 2 === 0 ? 'bg-gray-900' : 'bg-white border')}>
                  <div className={cn("h-4 rounded w-48 animate-pulse", i % 2 === 0 ? 'bg-gray-700' : 'bg-gray-200')} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!thread) {
    return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  }

  const otherUserId = thread.participants?.find(id => id !== currentUser?.id);
  const otherUser = users.find(u => u.id === otherUserId);

  if (!otherUser) {
    return <div className="min-h-screen bg-white flex items-center justify-center">User not found</div>;
  }

  const otherUserColor = otherUser.is_driver ? '#2FB5C0' : '#FF7A00';
  const isBlocked = currentUser?.messaging?.blockedUserIds?.includes(otherUser.id);
  const amBlocked = otherUser.messaging?.blockedUserIds?.includes(currentUser?.id);

  const getPlaceholder = () => {
    if (mode === 'sender') {
      return "Ask about routes, pickup windows, or price…";
    }
    return "Ask about item size, pickup location, or timing…";
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-2 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Inbox"))}
            className="rounded-xl h-11 w-11"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            {otherUser.avatar_url ? (
              <img
                src={otherUser.avatar_url}
                alt={otherUser.full_name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                style={{ backgroundColor: otherUserColor }}
              >
                {otherUser.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 truncate">
                {otherUser.full_name || 'User'}
              </h2>
              <button
                onClick={() => navigate(createPageUrl("Profile") + `?user=${otherUser.id}`)}
                className="text-sm text-gray-500 hover:underline"
              >
                View Profile
              </button>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl h-11 w-11">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleBlock}>
                <Shield className="w-4 h-4 mr-2" />
                {isBlocked ? 'Unblock User' : 'Block User'}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                <Flag className="w-4 h-4 mr-2" />
                Report User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <p className="text-center text-gray-500">Loading messages...</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-2">No messages yet</p>
            <p className="text-gray-500">Say hi 👋 or make an offer</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMe = message.senderId === currentUser?.id;
            const sender = users.find(u => u.id === message.senderId);
            const isRead = message.readBy?.includes(otherUserId);

            return (
              <div key={message.id} className={cn("flex gap-2", isMe ? "justify-end" : "justify-start")}>
                {!isMe && sender && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                    style={{ backgroundColor: otherUserColor }}
                  >
                    {sender.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}

                <div className={cn("max-w-[75%]", isMe && "items-end flex flex-col")}>
                  {message.relatedListing && (
                    <div className="text-xs bg-gray-100 rounded-full px-3 py-1 mb-1">
                      {message.relatedListing.title}
                    </div>
                  )}

                  {message.type === 'offer' && message.offer ? (
                    <div className="bg-white border-2 rounded-2xl p-4 shadow-sm" style={{ borderColor: modeColor }}>
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5" style={{ color: modeColor }} />
                        <span className="font-bold text-lg" style={{ color: modeColor }}>
                          ${message.offer.amount}
                        </span>
                        <span
                          className="ml-auto text-xs px-2 py-1 rounded-full font-semibold"
                          style={{
                            backgroundColor:
                              message.offer.status === 'accepted' ? '#E0F7F4' :
                              message.offer.status === 'countered' ? '#FFF3E0' : // New status
                              message.offer.status === 'withdrawn' ? '#F5F5F5' :
                              '#FFF3E0',
                            color:
                              message.offer.status === 'accepted' ? '#00C37A' :
                              message.offer.status === 'countered' ? '#FF7A00' : // New status
                              message.offer.status === 'withdrawn' ? '#7C8B96' :
                              '#FF7A00'
                          }}
                        >
                          {/* Display 'Countered' for countered status */}
                          {message.offer.status === 'countered' ? 'Countered' : message.offer.status}
                        </span>
                      </div>
                      {message.offer.note && (
                        <p className="text-sm text-gray-600 mb-3">{message.offer.note}</p>
                      )}
                      {!isMe && message.offer.status === 'sent' && ( // Only show actions if it's not my offer and still 'sent'
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleOfferAction(message, 'accept')}
                            className="flex-1"
                            style={{ backgroundColor: '#00C37A', color: '#FFFFFF' }}
                          >
                            Accept ${message.offer.amount}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenCounterDialog(message)}
                            className="flex-1"
                          >
                            Counter
                          </Button>
                        </div>
                      )}
                      {isMe && message.offer.status === 'sent' && ( // If it's my offer and still 'sent'
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOfferAction(message, 'withdraw')}
                          className="w-full text-gray-600" // Changed text color
                        >
                          Withdraw Offer
                        </Button>
                      )}
                    </div>
                  ) : message.type === 'system' ? (
                    <div className="text-center text-sm text-gray-500 italic">
                      {message.text}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5",
                        isMe ? "bg-gray-900 text-white rounded-br-lg" : "bg-white border rounded-bl-lg"
                      )}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1 mt-1 px-2">
                    <p className="text-xs text-gray-400">
                      {format(new Date(message.created_date), 'p')}
                    </p>
                    {isMe && (
                      <div className="text-gray-400">
                        {isRead ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      {isBlocked || amBlocked ? (
        <div className="sticky bottom-0 bg-gray-100 border-t border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-600">
            {isBlocked ? "You've blocked this user" : "You've been blocked by this user"}
          </p>
        </div>
      ) : (
        <div className="sticky bottom-0 bg-white border-t border-gray-200">
          <div className="max-w-lg mx-auto p-2 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOfferAmount(''); // Clear amount when opening new offer dialog
                setOfferNote(''); // Clear note when opening new offer dialog
                setShowOfferDialog(true);
              }}
              className="flex-shrink-0"
            >
              <DollarSign className="w-4 h-4 mr-1" />
              Offer
            </Button>

            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={getPlaceholder()}
              className="flex-1 h-11 rounded-xl"
            />

            <Button
              onClick={handleSend}
              disabled={!messageText.trim()}
              size="icon"
              className="h-11 w-11 rounded-xl"
              style={{ backgroundColor: modeColor, color: '#FFFFFF' }}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Offer Dialog */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="offerAmount">Amount (CAD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="offerAmount"
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 pl-9"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="offerNote">Note (Optional)</Label>
              <Textarea
                id="offerNote"
                value={offerNote}
                onChange={(e) => setOfferNote(e.target.value)}
                placeholder="Add any details about your offer..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendOffer} style={{ backgroundColor: modeColor, color: '#FFFFFF' }}>
              Send Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Counter Offer Dialog */}
      <Dialog open={showCounterDialog} onOpenChange={setShowCounterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Counter Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Original offer</p>
              <p className="text-2xl font-bold" style={{ color: modeColor }}>
                ${counteringMessage?.offer?.amount}
              </p>
            </div>
            <div>
              <Label htmlFor="counterOfferAmount">Your Counter Offer (CAD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="counterOfferAmount"
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 pl-9"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="counterOfferNote">Note (Optional)</Label>
              <Textarea
                id="counterOfferNote"
                value={offerNote}
                onChange={(e) => setOfferNote(e.target.value)}
                placeholder="Explain your counter offer..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCounterDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCounterOffer} style={{ backgroundColor: modeColor, color: '#FFFFFF' }}>
              Send Counter Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
