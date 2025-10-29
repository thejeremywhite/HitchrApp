import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users, DollarSign, LayoutDashboard, TestTube2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import UsersLiveView from "../components/admin/UsersLiveView";
import AdminMessageDrawer from "../components/admin/AdminMessageDrawer";
import AdminPayments from "../components/admin/AdminPayments";
import AdminTestTools from "../components/admin/AdminTestTools";

export default function AdminConsole() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('adminConsoleTab') || 'overview');
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMessageDrawer, setShowMessageDrawer] = useState(false);
  const [messageUser, setMessageUser] = useState(null);

  useEffect(() => {
    localStorage.setItem('adminConsoleTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        if (user.email === "thejeremywhite@hotmail.com" || user.is_admin) {
          setIsAdmin(true);
        } else {
          navigate(createPageUrl('Home'));
        }
      } catch (error) {
        console.error("Admin check error:", error);
        navigate(createPageUrl('Home'));
      }
    };
    checkAdmin();
  }, [navigate]);

  const { data: metrics } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const [users, requests, ledger, payouts] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Request.list(),
        base44.entities.LedgerEntry.list(),
        base44.entities.PayoutRequest.list()
      ]);

      const now = new Date();
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
      const twoMinAgo = new Date(now - 2 * 60 * 1000);

      return {
        activeUsers: users.filter(u => u.last_location_update && new Date(u.last_location_update) > oneDayAgo).length,
        driversOnline: users.filter(u => u.current_mode === 'driver' && u.last_location_update && new Date(u.last_location_update) > twoMinAgo).length,
        openPosts: requests.filter(r => r.status === 'open').length,
        paymentsToday: ledger.filter(e => e.created_date && new Date(e.created_date) > oneDayAgo).length,
        payoutsPending: payouts.filter(p => p.status === 'pending').length
      };
    },
    refetchInterval: 30000,
    enabled: isAdmin
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  const handleMessageUser = (user) => {
    setMessageUser(user);
    setShowMessageDrawer(true);
  };

  const handleTileClick = (tile) => {
    switch (tile) {
      case 'activeUsers':
      case 'driversOnline':
        setActiveTab('users');
        break;
      case 'paymentsToday':
      case 'payoutsPending':
        setActiveTab('payments');
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A]">Admin Console</h1>
              <p className="text-sm text-[#475569]">Manage users, payments, and system operations</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-[#0F172A]">{currentUser?.full_name}</p>
                <p className="text-xs text-[#475569]">{currentUser?.email}</p>
              </div>
              <Button variant="outline" onClick={() => navigate(createPageUrl("Home"))}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to App
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid bg-white border">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Users Live
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="test" className="gap-2">
              <TestTube2 className="w-4 h-4" />
              Test Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer" 
                onClick={() => handleTileClick('activeUsers')}
              >
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600">Active Users (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-[#0F172A]">{metrics?.activeUsers || 0}</p>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer" 
                onClick={() => handleTileClick('driversOnline')}
              >
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600">Drivers Online</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">{metrics?.driversOnline || 0}</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600">Open Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-600">{metrics?.openPosts || 0}</p>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer" 
                onClick={() => handleTileClick('paymentsToday')}
              >
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600">Payments Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-purple-600">{metrics?.paymentsToday || 0}</p>
                </CardContent>
              </Card>

              <Card 
                className="hover:shadow-lg transition-shadow cursor-pointer" 
                onClick={() => handleTileClick('payoutsPending')}
              >
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600">Payouts Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-orange-600">{metrics?.payoutsPending || 0}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UsersLiveView onMessageUser={handleMessageUser} />
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <AdminPayments />
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            <AdminTestTools />
          </TabsContent>
        </Tabs>
      </div>

      {messageUser && (
        <AdminMessageDrawer
          open={showMessageDrawer}
          onClose={() => setShowMessageDrawer(false)}
          userId={messageUser.id}
          userName={messageUser.full_name || messageUser.email}
          jobId={null}
          jobContext="Account"
        />
      )}
    </div>
  );
}