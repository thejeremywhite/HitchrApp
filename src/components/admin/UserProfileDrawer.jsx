import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Wallet, CheckCircle, XCircle, Truck, Package } from "lucide-react";
import { format } from "date-fns";

export default function UserProfileDrawer({ open, onClose, user, onAction }) {
  const { data: userPosts = [] } = useQuery({
    queryKey: ['user-posts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const [requests, availabilities] = await Promise.all([
        base44.entities.Request.filter({ filter: { poster_id: { eq: user.id } } }),
        base44.entities.DriverAvailability.filter({ filter: { driver_id: { eq: user.id } } })
      ]);
      return [...requests, ...availabilities];
    },
    enabled: !!user && open
  });

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                {user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{user.full_name || 'User'}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Basic Info */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">Basic Info</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">User ID</p>
                <p className="font-mono text-xs">{user.id.substring(0, 8)}...</p>
              </div>
              <div>
                <p className="text-gray-500">Current Mode</p>
                <Badge 
                  style={{
                    backgroundColor: user.current_mode === 'driver' ? '#E6F9FB' : '#FFE8D6',
                    color: user.current_mode === 'driver' ? '#2FB5C0' : '#FF7A00',
                  }}
                >
                  {user.current_mode === 'driver' ? <Truck className="w-3 h-3 mr-1" /> : <Package className="w-3 h-3 mr-1" />}
                  {user.current_mode || 'sender'}
                </Badge>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {user.email}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {user.phone || 'Not set'}
                  {user.phone_verified ? (
                    <CheckCircle className="w-3 h-3 text-green-600" />
                  ) : (
                    <XCircle className="w-3 h-3 text-gray-400" />
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Wallet Balance</p>
                <p className="flex items-center gap-1 font-semibold text-green-600">
                  <Wallet className="w-3 h-3" />
                  ${(user.wallet_balance || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Joined</p>
                <p>{format(new Date(user.created_date), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">Roles & Permissions</h3>
            <div className="flex flex-wrap gap-2">
              {user.is_driver && <Badge variant="outline">Driver</Badge>}
              {user.is_sender && <Badge variant="outline">Sender</Badge>}
              {user.is_admin && <Badge variant="default">Admin</Badge>}
              {user.is_blocked && <Badge variant="destructive">Banned</Badge>}
            </div>
          </div>

          {/* Ratings */}
          {(user.driver_rating_count > 0 || user.sender_rating_count > 0) && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-gray-700">Ratings</h3>
              <div className="grid grid-cols-2 gap-3">
                {user.driver_rating_count > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">As Driver</p>
                    <p className="text-lg font-bold">
                      ⭐ {user.driver_rating_avg?.toFixed(1) || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">{user.driver_rating_count} ratings</p>
                  </div>
                )}
                {user.sender_rating_count > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">As Sender</p>
                    <p className="text-lg font-bold">
                      ⭐ {user.sender_rating_avg?.toFixed(1) || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">{user.sender_rating_count} ratings</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Posts */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">
              Recent Posts ({userPosts.length})
            </h3>
            <div className="space-y-2">
              {userPosts.slice(0, 5).map(post => (
                <div key={post.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {post.pickup_address?.split(',')[0] || post.from_address?.split(',')[0] || 'Post'}
                      </p>
                      {(post.dropoff_address || post.to_address) && (
                        <p className="text-xs text-gray-500">
                          → {post.dropoff_address?.split(',')[0] || post.to_address?.split(',')[0]}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {post.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {format(new Date(post.created_date), 'MMM d, yyyy')}
                  </p>
                </div>
              ))}
              {userPosts.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No posts yet</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2 pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const amount = prompt('Enter amount to credit:');
                if (amount) onAction('WALLET_CREDIT', user, { amount, reason: 'Admin credit' });
              }}
            >
              Credit Wallet
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onAction(user.phone_verified ? 'UNVERIFY_PHONE' : 'VERIFY_PHONE', user)}
            >
              {user.phone_verified ? 'Unverify' : 'Verify'} Phone
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onAction(user.is_blocked ? 'UNBAN_USER' : 'BAN_USER', user)}
            >
              {user.is_blocked ? 'Unban' : 'Ban'} User
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}