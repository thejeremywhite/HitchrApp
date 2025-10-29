import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDistanceToNow } from "date-fns";
import HitchrLogo from "../components/HitchrLogo";

export default function Inbox() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [mode, setMode] = useState(() => localStorage.getItem('hitchr.mode') || 'sender');
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        base44.auth.redirectToLogin(window.location.pathname);
      }
    };
    loadUser();

    const handleModeChange = (event) => setMode(event.detail.mode);
    window.addEventListener('HITCHR_MODE_CHANGED', handleModeChange);
    return () => window.removeEventListener('HITCHR_MODE_CHANGED', handleModeChange);
  }, []);

  const modeColor = mode === 'driver' ? '#2FB5C0' : '#FF7A00';

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['threads', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const allThreads = await base44.entities.Thread.list('-lastMessageAt');
      return allThreads.filter(t => 
        t.participants && t.participants.includes(currentUser.id) && t.open !== false
      );
    },
    enabled: !!currentUser,
    refetchInterval: 5000
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const getUserById = (userId) => users.find(u => u.id === userId);

  const getOtherUser = (thread) => {
    if (!thread.participants || !currentUser) return null;
    const otherId = thread.participants.find(id => id !== currentUser.id);
    return getUserById(otherId);
  };

  const filteredThreads = threads.filter(thread => {
    if (!searchText.trim()) return true;
    const other = getOtherUser(thread);
    return other?.full_name?.toLowerCase().includes(searchText.toLowerCase());
  });

  const getTotalUnread = () => {
    if (!currentUser) return 0;
    return threads.reduce((sum, t) => sum + (t.unreadCounts?.[currentUser.id] || 0), 0);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <HitchrLogo mode={mode} size={24} />
            <h1 className="text-xl font-semibold">Messages</h1>
            {getTotalUnread() > 0 && (
              <Badge className="rounded-full" style={{ backgroundColor: modeColor, color: '#FFFFFF' }}>
                {getTotalUnread()}
              </Badge>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search conversations..."
              className="pl-10 h-10 rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-2 py-4 space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : filteredThreads.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">
              {searchText ? 'No matching conversations' : 'No messages yet'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Start a conversation from a listing or profile
            </p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const otherUser = getOtherUser(thread);
            if (!otherUser) return null;

            const unreadCount = thread.unreadCounts?.[currentUser?.id] || 0;
            const otherUserColor = otherUser.is_driver ? '#2FB5C0' : '#FF7A00';

            return (
              <Card
                key={thread.id}
                onClick={() => navigate(createPageUrl("Chat") + `/${thread.id}`)}
                className="p-4 rounded-xl bg-white cursor-pointer hover:bg-gray-50 transition-colors border-none shadow-sm"
              >
                <div className="flex items-center gap-4">
                  {otherUser.avatar_url ? (
                    <img
                      src={otherUser.avatar_url}
                      alt={otherUser.full_name}
                      className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-xl flex-shrink-0"
                      style={{ backgroundColor: otherUserColor }}
                    >
                      {otherUser.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {otherUser.full_name || 'User'}
                      </h3>
                      {thread.lastMessageAt && (
                        <p className="text-sm text-gray-500 flex-shrink-0">
                          {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate flex-1 ${unreadCount > 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                        {thread.lastMessagePreview || 'No messages yet'}
                      </p>
                      {unreadCount > 0 && (
                        <Badge className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: modeColor, color: '#FFFFFF' }}>
                          {unreadCount}
                        </Badge>
                      )}
                    </div>

                    {thread.lastRelatedListing && (
                      <div className="mt-1">
                        <span className="text-xs text-gray-500 px-2 py-0.5 rounded-full bg-gray-100">
                          {thread.lastRelatedListing.title}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}