
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, User, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function BlockedUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);
  
  const { data: blocks = [], isLoading: isLoadingBlocks } = useQuery({
    queryKey: ['blocks', currentUser?.id],
    queryFn: () => base44.entities.UserBlock.filter({ filter: { blocker_id: { eq: currentUser.id } } }),
    enabled: !!currentUser,
  });

  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
      queryKey: ['all-users'],
      queryFn: () => base44.entities.User.list(),
  });

  const unblockMutation = useMutation({
    mutationFn: (blockId) => base44.entities.UserBlock.delete(blockId),
    onSuccess: () => {
      toast.success("User unblocked");
      queryClient.invalidateQueries({queryKey: ['blocks']});
    },
    onError: () => {
      toast.error("Failed to unblock user");
    }
  });

  const blockedUsers = blocks.map(block => {
    return allUsers.find(u => u.id === block.blocked_id);
  }).filter(Boolean); // Filter out any undefined users

  const isLoading = isLoadingBlocks || isLoadingUsers;

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-11 w-11">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Blocked Users</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {isLoading && <p>Loading...</p>}
        {!isLoading && blockedUsers.length === 0 && (
          <div className="text-center py-16">
            <ShieldCheck className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">You haven't blocked any users.</p>
          </div>
        )}
        {blockedUsers.map(user => {
            const blockRecord = blocks.find(b => b.blocked_id === user.id);
            return (
              <Card key={user.id} className="p-4 rounded-xl flex justify-between items-center bg-white shadow-[var(--shadow)] border-none">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[var(--subtle-bg)] rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-[var(--primary)]" />
                  </div>
                  <div>
                    <p className="font-semibold">{user.full_name || 'Unnamed User'}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => unblockMutation.mutate(blockRecord.id)}>
                  Unblock
                </Button>
              </Card>
            )
        })}
      </div>
    </div>
  );
}
