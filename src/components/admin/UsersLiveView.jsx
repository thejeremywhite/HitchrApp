import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  RefreshCw, 
  MessageSquare, 
  Eye, 
  MoreVertical,
  Truck,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserProfileDrawer from "./UserProfileDrawer";
import JobDrawer from "./JobDrawer";

export default function UsersLiveView({ onMessageUser }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [actionStatus, setActionStatus] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobDrawer, setShowJobDrawer] = useState(false);

  const { data: users = [], refetch, isLoading } = useQuery({
    queryKey: ['admin-users-live'],
    queryFn: () => base44.entities.User.list(),
    refetchInterval: autoRefresh ? 30000 : false
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['admin-requests-live'],
    queryFn: () => base44.entities.Request.list(),
    refetchInterval: autoRefresh ? 30000 : false
  });

  const { data: threads = [] } = useQuery({
    queryKey: ['admin-threads'],
    queryFn: async () => {
      const adminUser = await base44.auth.me();
      const allThreads = await base44.entities.Thread.list();
      return allThreads.filter(t => t.participants?.includes(adminUser.id));
    },
    refetchInterval: autoRefresh ? 30000 : false
  });

  const adminActionMutation = useMutation({
    mutationFn: async ({ action, targetUserId, metadata }) => {
      const response = await base44.functions.invoke('adminAction', {
        action,
        targetUserId,
        metadata
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      setActionStatus(prev => ({
        ...prev,
        [variables.targetUserId]: { type: 'success', message: data.message }
      }));
      setTimeout(() => {
        setActionStatus(prev => {
          const newState = { ...prev };
          delete newState[variables.targetUserId];
          return newState;
        });
      }, 3000);
      queryClient.invalidateQueries({ queryKey: ['admin-users-live'] });
    },
    onError: (error, variables) => {
      setActionStatus(prev => ({
        ...prev,
        [variables.targetUserId]: { type: 'error', message: error.response?.data?.error || 'Action failed' }
      }));
      setTimeout(() => {
        setActionStatus(prev => {
          const newState = { ...prev };
          delete newState[variables.targetUserId];
          return newState;
        });
      }, 3000);
    }
  });

  const getUserActiveJob = (userId) => {
    return requests.find(r => 
      (r.poster_id === userId || r.driver_id === userId) && 
      ['in_progress', 'matched', 'booked', 'in_escrow'].includes(r.status)
    );
  };

  const getUnreadCount = (userId) => {
    const userThreads = threads.filter(t => t.participants?.includes(userId));
    const adminUser = threads[0]?.participants?.find(id => id !== userId);
    return userThreads.reduce((sum, t) => sum + (t.unreadCounts?.[adminUser] || 0), 0);
  };

  const totalUnread = useMemo(() => {
    return threads.reduce((sum, t) => {
      const adminId = t.participants?.[0]; // Assuming admin is always first or we need to find it
      return sum + (t.unreadCounts?.[adminId] || 0);
    }, 0);
  }, [threads]);

  const isOnline = (user) => {
    if (!user.last_location_update) return false;
    const lastSeen = new Date(user.last_location_update);
    const now = new Date();
    return (now - lastSeen) < 2 * 60 * 1000; // 2 minutes
  };

  const filteredUsers = useMemo(() => {
    let filtered = users.filter(user => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower);
      
      const matchesMode = modeFilter === 'all' || user.current_mode === modeFilter;
      
      const matchesRole = 
        roleFilter === 'all' ||
        (roleFilter === 'driver' && user.is_driver) ||
        (roleFilter === 'sender' && user.is_sender);

      const matchesOnline = !onlineOnly || isOnline(user);

      return matchesSearch && matchesMode && matchesRole && matchesOnline;
    });

    // Pagination
    const startIndex = (page - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [users, searchTerm, modeFilter, roleFilter, onlineOnly, page, pageSize]);

  const totalPages = Math.ceil(
    users.filter(user => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower);
      const matchesMode = modeFilter === 'all' || user.current_mode === modeFilter;
      const matchesRole = 
        roleFilter === 'all' ||
        (roleFilter === 'driver' && user.is_driver) ||
        (roleFilter === 'sender' && user.is_sender);
      const matchesOnline = !onlineOnly || isOnline(user);
      return matchesSearch && matchesMode && matchesRole && matchesOnline;
    }).length / pageSize
  );

  const handleAction = (action, user, metadata = {}) => {
    adminActionMutation.mutate({
      action,
      targetUserId: user.id,
      metadata
    });
  };

  const handleViewProfile = (user) => {
    setSelectedUser(user);
    setShowProfileDrawer(true);
  };

  const handleViewJob = (job) => {
    setSelectedJob(job);
    setShowJobDrawer(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search users, email, job ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select value={modeFilter} onValueChange={(v) => { setModeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="driver">Driver</SelectItem>
              <SelectItem value="sender">Sender</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="driver">Is Driver</SelectItem>
              <SelectItem value="sender">Is Sender</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={onlineOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setOnlineOnly(!onlineOnly); setPage(1); }}
          >
            Online Now
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              id="auto-refresh"
              className="rounded"
            />
            <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
              Auto-refresh (30s)
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Live Users ({filteredUsers.length})</span>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <Badge variant="default" className="bg-red-600">
                  {totalUnread} unread
                </Badge>
              )}
              <Badge variant="outline" className="font-normal">
                <Clock className="w-3 h-3 mr-1" />
                Updated {format(new Date(), 'HH:mm:ss')}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm">
                  <th className="pb-3 font-semibold">User</th>
                  <th className="pb-3 font-semibold">Mode</th>
                  <th className="pb-3 font-semibold">Roles</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Active Job</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const activeJob = getUserActiveJob(user.id);
                  const online = isOnline(user);
                  const unread = getUnreadCount(user.id);
                  const status = actionStatus[user.id];
                  
                  return (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.full_name} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                                {user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {online && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.full_name || user.email}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge 
                          style={{
                            backgroundColor: user.current_mode === 'driver' ? '#E6F9FB' : '#FFE8D6',
                            color: user.current_mode === 'driver' ? '#2FB5C0' : '#FF7A00',
                          }}
                          className="capitalize"
                        >
                          {user.current_mode === 'driver' ? <Truck className="w-3 h-3 mr-1" /> : <Package className="w-3 h-3 mr-1" />}
                          {user.current_mode || 'sender'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          {user.is_driver && (
                            <Badge variant="outline" className="text-xs">Driver</Badge>
                          )}
                          {user.is_sender && (
                            <Badge variant="outline" className="text-xs">Sender</Badge>
                          )}
                          {user.is_blocked && (
                            <Badge variant="destructive" className="text-xs">Banned</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="text-xs">
                          {online ? (
                            <Badge variant="default" className="bg-green-600">Online</Badge>
                          ) : user.last_location_update ? (
                            <span className="text-gray-500">
                              {formatDistanceToNow(new Date(user.last_location_update), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-gray-400">Never</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        {activeJob ? (
                          <button
                            onClick={() => handleViewJob(activeJob)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            <p className="font-medium">{activeJob.pickup_address?.split(',')[0]}</p>
                            <p className="text-gray-500">→ {activeJob.dropoff_address?.split(',')[0]}</p>
                            <Badge variant="outline" className="mt-1 text-[10px]">
                              {activeJob.status}
                            </Badge>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">No activity</span>
                        )}
                      </td>
                      <td className="py-3">
                        {status && (
                          <div className={`text-xs mb-1 ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {status.type === 'success' ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
                            {status.message}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onMessageUser(user)}
                            title="Message User"
                            className="relative"
                          >
                            <MessageSquare className="w-4 h-4" />
                            {unread > 0 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[10px] rounded-full flex items-center justify-center">
                                {unread}
                              </span>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewProfile(user)}
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAction('FORCE_MODE', user, { mode: user.current_mode === 'driver' ? 'sender' : 'driver' })}>
                                Switch to {user.current_mode === 'driver' ? 'Sender' : 'Driver'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAction(user.phone_verified ? 'UNVERIFY_PHONE' : 'VERIFY_PHONE', user)}>
                                {user.phone_verified ? 'Unverify' : 'Verify'} Phone
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(user.is_blocked ? 'UNBAN_USER' : 'BAN_USER', user)}>
                                {user.is_blocked ? 'Unban' : 'Ban'} User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('RESET_PASSWORD', user)}>
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                const amount = prompt('Enter amount to credit:');
                                if (amount) handleAction('WALLET_CREDIT', user, { amount, reason: 'Admin credit' });
                              }}>
                                Credit Wallet
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                const amount = prompt('Enter amount to debit:');
                                if (amount) handleAction('WALLET_DEBIT', user, { amount, reason: 'Admin debit' });
                              }}>
                                Debit Wallet
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>No users found matching your filters</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawers */}
      {selectedUser && (
        <UserProfileDrawer
          open={showProfileDrawer}
          onClose={() => setShowProfileDrawer(false)}
          user={selectedUser}
          onAction={handleAction}
        />
      )}

      {selectedJob && (
        <JobDrawer
          open={showJobDrawer}
          onClose={() => setShowJobDrawer(false)}
          job={selectedJob}
        />
      )}
    </div>
  );
}