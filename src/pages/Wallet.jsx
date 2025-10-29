import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet as WalletIcon, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  DollarSign, 
  Lock, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Info,
  Copy,
  Mail,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import HitchrLogo from "../components/HitchrLogo";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const TRANSACTION_TYPES = {
  DEPOSIT: { label: "Deposit", icon: ArrowDownCircle, color: "text-green-600", bg: "bg-green-50" },
  HOLD: { label: "Held (Escrow)", icon: Lock, color: "text-orange-600", bg: "bg-orange-50" },
  RELEASE: { label: "Released", icon: ArrowUpCircle, color: "text-green-600", bg: "bg-green-50" },
  REFUND: { label: "Refund", icon: ArrowDownCircle, color: "text-blue-600", bg: "bg-blue-50" },
  ADJUSTMENT: { label: "Adjustment", icon: DollarSign, color: "text-purple-600", bg: "bg-purple-50" },
  FEE: { label: "Platform Fee", icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
  PAYOUT_SENT: { label: "Payout Sent", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
  PAYOUT_PENDING: { label: "Payout Pending", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" }
};

export default function Wallet() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [mode, setMode] = useState(() => localStorage.getItem('hitchr.mode') || 'sender');
  const [filterType, setFilterType] = useState('all');
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const modeColor = mode === 'driver' ? '#2FB5C0' : '#FF7A00';

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

  // Fetch ledger entries with auto-refresh
  const { data: ledgerEntries = [], isLoading: isLoadingLedger, refetch: refetchLedger } = useQuery({
    queryKey: ['ledger', currentUser?.id],
    queryFn: async () => {
      const entries = await base44.entities.LedgerEntry.list('-created_date');
      setLastUpdated(new Date());
      return entries.filter(e => 
        e.sender_id === currentUser.id || e.driver_id === currentUser.id
      );
    },
    enabled: !!currentUser,
    refetchInterval: 30000 // Auto-refresh every 30 seconds
  });

  // Fetch requests for escrow calculation
  const { data: requests = [], refetch: refetchRequests } = useQuery({
    queryKey: ['user-requests', currentUser?.id],
    queryFn: () => base44.entities.Request.list(),
    enabled: !!currentUser,
    refetchInterval: 30000
  });

  // Fetch payout requests
  const { data: payoutRequests = [] } = useQuery({
    queryKey: ['user-payout-requests', currentUser?.id],
    queryFn: async () => {
      const all = await base44.entities.PayoutRequest.list('-requested_at');
      return all.filter(p => p.user_id === currentUser.id);
    },
    enabled: !!currentUser,
    refetchInterval: 30000
  });

  // Fetch users for counterpart names
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    refetchInterval: 60000
  });

  // Calculate balances
  const balances = React.useMemo(() => {
    if (!currentUser) return { available: 0, onHold: 0, pending: 0, totalEarned: 0, totalSpent: 0 };

    const available = currentUser.wallet_balance || 0;
    
    // On Hold: items in escrow
    const onHold = requests
      .filter(r => r.status === 'in_escrow' && r.poster_id === currentUser.id)
      .reduce((sum, r) => sum + (r.final_price || 0), 0);

    // Pending: items waiting for payout
    const pending = ledgerEntries
      .filter(e => e.type === 'PAYOUT_PENDING' && e.driver_id === currentUser.id && e.status === 'pending')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    // Total earned (driver)
    const totalEarned = ledgerEntries
      .filter(e => e.driver_id === currentUser.id && ['RELEASE', 'PAYOUT_SENT'].includes(e.type) && e.status === 'completed')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    // Total spent (sender)
    const totalSpent = ledgerEntries
      .filter(e => e.sender_id === currentUser.id && ['HOLD', 'FEE', 'DEPOSIT'].includes(e.type) && e.status === 'completed')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    return { available, onHold, pending, totalEarned, totalSpent };
  }, [currentUser, requests, ledgerEntries]);

  // Get pending actions
  const pendingActions = React.useMemo(() => {
    const actions = [];
    
    // Pending payouts
    payoutRequests.filter(p => p.status === 'pending').forEach(p => {
      actions.push({
        type: 'withdrawal',
        amount: p.amount,
        status: 'Awaiting Admin Processing',
        date: p.requested_at,
        icon: Clock,
        color: 'text-yellow-600'
      });
    });

    // Pending deposits (status pending in ledger)
    ledgerEntries.filter(e => e.type === 'DEPOSIT' && e.status === 'pending').forEach(e => {
      actions.push({
        type: 'deposit',
        amount: e.amount,
        status: 'Awaiting Admin Confirmation',
        date: e.created_date,
        icon: Clock,
        color: 'text-blue-600'
      });
    });

    return actions.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [payoutRequests, ledgerEntries]);

  // Get recent job settlements
  const recentSettlements = React.useMemo(() => {
    const completedRequests = requests.filter(r => r.status === 'completed' && (r.poster_id === currentUser?.id || r.driver_id === currentUser?.id));
    return completedRequests.slice(0, 5).map(req => {
      const deliveryFee = req.final_price || 0;
      const platformFee = deliveryFee * 0.2;
      const driverPayout = deliveryFee * 0.8;
      
      return {
        id: req.id,
        date: req.updated_date,
        role: req.poster_id === currentUser?.id ? 'sender' : 'driver',
        deliveryFee,
        platformFee,
        driverPayout,
        pickup: req.pickup_address?.split(',')[0],
        dropoff: req.dropoff_address?.split(',')[0]
      };
    });
  }, [requests, currentUser]);

  // Filter ledger entries
  const filteredLedger = React.useMemo(() => {
    if (filterType === 'all') return ledgerEntries;
    if (filterType === 'deposits') return ledgerEntries.filter(e => e.type === 'DEPOSIT');
    if (filterType === 'holds') return ledgerEntries.filter(e => e.type === 'HOLD');
    if (filterType === 'payouts') return ledgerEntries.filter(e => ['PAYOUT_SENT', 'PAYOUT_PENDING'].includes(e.type));
    if (filterType === 'refunds') return ledgerEntries.filter(e => e.type === 'REFUND');
    if (filterType === 'adjustments') return ledgerEntries.filter(e => ['ADJUSTMENT', 'FEE'].includes(e.type));
    return ledgerEntries;
  }, [ledgerEntries, filterType]);

  const handleRefresh = async () => {
    await Promise.all([
      refetchLedger(),
      refetchRequests(),
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] }),
      queryClient.invalidateQueries({ queryKey: ['user-payout-requests'] })
    ]);
    
    // Reload user to get updated balance
    const user = await base44.auth.me();
    setCurrentUser(user);
    
    toast.success('Wallet updated');
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('payment@hitchrapp.ca');
    toast.success('Email copied to clipboard');
  };

  const handleCopyMemo = () => {
    if (currentUser) {
      navigator.clipboard.writeText(`HITCHR-${currentUser.id.substring(0, 8).toUpperCase()}`);
      toast.success('Memo copied to clipboard');
    }
  };

  const createDepositRequestMutation = useMutation({
    mutationFn: async () => {
      // Create pending deposit ledger entry
      await base44.entities.LedgerEntry.create({
        sender_id: currentUser.id,
        type: 'DEPOSIT',
        amount: 0, // Amount unknown until admin confirms
        status: 'pending',
        memo: `Deposit request - awaiting e-Transfer to payment@hitchrapp.ca`,
        created_by: currentUser.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      toast.success('Deposit request created');
      setShowAddFunds(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create deposit request');
    }
  });

  const createPayoutRequestMutation = useMutation({
    mutationFn: async ({ amount, payout_email, legal_name }) => {
      // Create payout request
      const request = await base44.entities.PayoutRequest.create({
        user_id: currentUser.id,
        amount: parseFloat(amount),
        payout_email,
        legal_name,
        status: 'pending',
        requested_at: new Date().toISOString()
      });

      // Create pending ledger entry
      await base44.entities.LedgerEntry.create({
        driver_id: currentUser.id,
        type: 'PAYOUT_PENDING',
        amount: -parseFloat(amount),
        status: 'pending',
        memo: `Payout request #${request.id.substring(0, 8)}`,
        created_by: currentUser.id
      });

      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['user-payout-requests'] });
      toast.success('Withdrawal request submitted');
      setShowWithdraw(false);
      setWithdrawAmount('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to submit withdrawal request');
    }
  });

  const handleDepositRequest = () => {
    createDepositRequestMutation.mutate();
  };

  const handleWithdrawRequest = () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (parseFloat(withdrawAmount) > balances.available) {
      toast.error('Insufficient balance');
      return;
    }

    // Check for pending withdrawals
    const hasPendingWithdrawal = payoutRequests.some(p => p.status === 'pending');
    if (hasPendingWithdrawal) {
      toast.error('You already have a pending withdrawal request');
      return;
    }

    createPayoutRequestMutation.mutate({
      amount: withdrawAmount,
      payout_email: currentUser.payout_email || currentUser.email,
      legal_name: currentUser.legal_name || currentUser.full_name
    });
  };

  const handleTransactionClick = (transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetails(true);
  };

  const handleMessageCounterpart = () => {
    if (selectedTransaction?.counterpart_user_id) {
      navigate(createPageUrl("Chat") + `?peer=${selectedTransaction.counterpart_user_id}`);
      setShowTransactionDetails(false);
    }
  };

  const handleViewJob = () => {
    if (selectedTransaction?.job_id) {
      navigate(createPageUrl("RequestDetails") + `?request_id=${selectedTransaction.job_id}`);
      setShowTransactionDetails(false);
    }
  };

  if (!currentUser) {
    return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  }

  const hasPendingWithdrawal = payoutRequests.some(p => p.status === 'pending');

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HitchrLogo mode={mode} size={24} />
              <h1 className="text-xl font-semibold">Wallet</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className="h-9 w-9"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Last Updated Indicator */}
        {lastUpdated && (
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
            <CheckCircle2 className="w-3 h-3 text-green-600" />
            <span>Updated {format(lastUpdated, 'p')}</span>
          </div>
        )}

        {/* Balances Summary */}
        <Card className="p-6 rounded-2xl bg-white border-none shadow-[var(--shadow)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${modeColor}15` }}>
              <WalletIcon className="w-6 h-6" style={{ color: modeColor }} />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Available Balance</p>
              <p className="text-3xl font-bold" style={{ color: modeColor }}>
                ${balances.available.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-[var(--subtle-bg)]">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-orange-600" />
                <p className="text-xs text-[var(--text-secondary)]">Held (Escrow)</p>
              </div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                ${balances.onHold.toFixed(2)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--subtle-bg)]">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-yellow-600" />
                <p className="text-xs text-[var(--text-secondary)]">Pending Verification</p>
              </div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                ${balances.pending.toFixed(2)}
              </p>
            </div>

            {currentUser.is_driver && (
              <div className="p-3 rounded-xl bg-[var(--subtle-bg)]">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <p className="text-xs text-[var(--text-secondary)]">Lifetime Earned</p>
                </div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  ${balances.totalEarned.toFixed(2)}
                </p>
              </div>
            )}

            {currentUser.is_sender && (
              <div className="p-3 rounded-xl bg-[var(--subtle-bg)]">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <p className="text-xs text-[var(--text-secondary)]">Lifetime Spent</p>
                </div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  ${balances.totalSpent.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => setShowAddFunds(true)}
            className="h-14 rounded-xl flex flex-col items-center justify-center"
            style={{ backgroundColor: modeColor, color: '#FFFFFF' }}
          >
            <ArrowDownCircle className="w-5 h-5 mb-1" />
            <span className="text-sm font-semibold">Add Funds</span>
          </Button>

          <Button
            onClick={() => setShowWithdraw(true)}
            disabled={hasPendingWithdrawal}
            variant="outline"
            className="h-14 rounded-xl flex flex-col items-center justify-center border-2"
            style={{ borderColor: hasPendingWithdrawal ? '#E5E7EB' : modeColor, color: hasPendingWithdrawal ? '#9CA3AF' : modeColor }}
          >
            <ArrowUpCircle className="w-5 h-5 mb-1" />
            <span className="text-sm font-semibold">Withdraw</span>
          </Button>
        </div>

        {/* Pending Actions */}
        {pendingActions.length > 0 && (
          <Card className="p-4 rounded-2xl bg-white border-none shadow-[var(--shadow)]">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Pending Actions
            </h3>
            <div className="space-y-2">
              {pendingActions.map((action, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[var(--subtle-bg)]">
                  <div className="flex items-center gap-3">
                    <action.icon className={cn("w-5 h-5", action.color)} />
                    <div>
                      <p className="text-sm font-semibold capitalize">{action.type}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{action.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">${action.amount.toFixed(2)}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {format(new Date(action.date), 'MMM d')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recent Job Settlements */}
        {recentSettlements.length > 0 && (
          <Card className="p-4 rounded-2xl bg-white border-none shadow-[var(--shadow)]">
            <h3 className="text-lg font-semibold mb-3">Recent Job Settlements</h3>
            <div className="space-y-2">
              {recentSettlements.map((settlement) => (
                <div key={settlement.id} className="p-3 rounded-xl bg-[var(--subtle-bg)]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">
                      {settlement.pickup} → {settlement.dropoff}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {settlement.role}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[var(--text-secondary)]">Delivery Fee:</span>
                      <span className="font-semibold ml-1">${settlement.deliveryFee.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Platform Fee:</span>
                      <span className="font-semibold ml-1 text-red-600">-${settlement.platformFee.toFixed(2)}</span>
                    </div>
                    {settlement.role === 'driver' && (
                      <div>
                        <span className="text-[var(--text-secondary)]">Driver Payout:</span>
                        <span className="font-semibold ml-1 text-green-600">${settlement.driverPayout.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">
                    {format(new Date(settlement.date), 'MMM d, yyyy')}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Important Notices */}
        <Card className="p-4 rounded-2xl bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-blue-900">
              <p>• Delivery fees include a 20% platform fee</p>
              <p>• Item deposits are held in escrow during delivery</p>
              <p>• Payouts occur after delivery confirmation</p>
              <p>• Withdrawals processed within 1-2 business days</p>
            </div>
          </div>
        </Card>

        {/* Transaction Ledger */}
        <Card className="p-4 rounded-2xl bg-white border-none shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold mb-4">Transaction History</h3>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
            {['all', 'deposits', 'holds', 'payouts', 'refunds', 'adjustments'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className="pill-chip whitespace-nowrap h-8 px-4 rounded-full text-sm font-semibold transition-all flex-shrink-0 capitalize"
                style={filterType === type ? {
                  backgroundColor: modeColor,
                  borderColor: modeColor,
                  color: '#FFFFFF'
                } : {
                  backgroundColor: 'transparent',
                  borderColor: '#E7E9EB',
                  color: '#333F48'
                }}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Ledger List */}
          <div className="space-y-2">
            {isLoadingLedger ? (
              <p className="text-center text-sm text-[var(--text-secondary)] py-8">Loading...</p>
            ) : filteredLedger.length === 0 ? (
              <p className="text-center text-sm text-[var(--text-secondary)] py-8">No transactions yet</p>
            ) : (
              filteredLedger.map((entry) => {
                const typeInfo = TRANSACTION_TYPES[entry.type] || TRANSACTION_TYPES.ADJUSTMENT;
                const Icon = typeInfo.icon;
                const isDebit = ['HOLD', 'FEE', 'PAYOUT_SENT', 'PAYOUT_PENDING'].includes(entry.type);
                
                return (
                  <div
                    key={entry.id}
                    onClick={() => handleTransactionClick(entry)}
                    className="flex items-center justify-between p-3 rounded-xl bg-[var(--subtle-bg)] hover:bg-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", typeInfo.bg)}>
                        <Icon className={cn("w-5 h-5", typeInfo.color)} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {typeInfo.label}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {format(new Date(entry.created_date), 'MMM d, yyyy h:mm a')}
                        </p>
                        {entry.memo && (
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {entry.memo}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-lg font-bold", isDebit ? "text-red-600" : "text-green-600")}>
                        {isDebit ? '-' : '+'}${Math.abs(entry.amount).toFixed(2)}
                      </p>
                      {entry.status && entry.status !== 'completed' && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {entry.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Add Funds Dialog */}
      <Dialog open={showAddFunds} onOpenChange={setShowAddFunds}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Funds via e-Transfer</DialogTitle>
            <DialogDescription>
              Send an e-Transfer to add funds to your Hitchr wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[var(--subtle-bg)]">
              <Label className="text-xs text-[var(--text-secondary)] mb-2 block">Send to:</Label>
              <div className="flex items-center justify-between">
                <p className="font-mono text-base font-semibold">payment@hitchrapp.ca</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyEmail}
                  className="h-8 w-8"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--subtle-bg)]">
              <Label className="text-xs text-[var(--text-secondary)] mb-2 block">Reference (Required):</Label>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-base">
                  Use your Hitchr email: {currentUser.email}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex gap-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm text-blue-900 space-y-1">
                  <p><strong>Important:</strong> Use your Hitchr email as the e-Transfer reference.</p>
                  <p>Once you send the e-Transfer, an admin will confirm and add funds to your wallet within 24 hours.</p>
                  <p>Autodeposit recommended for fastest processing.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFunds(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDepositRequest}
              disabled={createDepositRequestMutation.isPending}
              style={{ backgroundColor: modeColor, color: '#FFFFFF' }}
            >
              {createDepositRequestMutation.isPending ? 'Processing...' : 'I Sent the e-Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Funds will be sent to your registered payout email
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Amount (CAD)</Label>
              <div className="relative mt-2">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={balances.available}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-10 h-12 text-lg"
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Available: ${balances.available.toFixed(2)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--subtle-bg)]">
              <Label className="text-xs text-[var(--text-secondary)] mb-2 block">Payout to:</Label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[var(--text-secondary)]" />
                <p className="font-semibold">
                  {currentUser.payout_email || currentUser.email}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex gap-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p>Admin will manually send your e-Transfer within 1-2 business days.</p>
                  <p className="mt-2">You cannot submit another withdrawal request until this one is processed.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdraw(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleWithdrawRequest}
              disabled={createPayoutRequestMutation.isPending}
              style={{ backgroundColor: modeColor, color: '#FFFFFF' }}
            >
              {createPayoutRequestMutation.isPending ? 'Processing...' : 'Request Withdrawal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog open={showTransactionDetails} onOpenChange={setShowTransactionDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--subtle-bg)]">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", 
                  TRANSACTION_TYPES[selectedTransaction.type]?.bg)}>
                  {React.createElement(TRANSACTION_TYPES[selectedTransaction.type]?.icon, {
                    className: cn("w-6 h-6", TRANSACTION_TYPES[selectedTransaction.type]?.color)
                  })}
                </div>
                <div>
                  <p className="font-semibold">{TRANSACTION_TYPES[selectedTransaction.type]?.label}</p>
                  <p className="text-2xl font-bold" style={{ color: modeColor }}>
                    ${Math.abs(selectedTransaction.amount).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Date</span>
                  <span className="text-sm font-semibold">
                    {format(new Date(selectedTransaction.created_date), 'PPpp')}
                  </span>
                </div>

                {selectedTransaction.job_id && (
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Job ID</span>
                    <span className="text-sm font-mono">
                      {selectedTransaction.job_id.substring(0, 8)}
                    </span>
                  </div>
                )}

                {selectedTransaction.counterpart_name && (
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Counterpart</span>
                    <span className="text-sm font-semibold">
                      {selectedTransaction.counterpart_name}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Status</span>
                  <Badge variant={selectedTransaction.status === 'completed' ? 'default' : 'outline'}>
                    {selectedTransaction.status}
                  </Badge>
                </div>

                {selectedTransaction.memo && (
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">Memo</span>
                    <span className="text-sm">{selectedTransaction.memo}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {selectedTransaction.counterpart_user_id && (
                  <Button
                    variant="outline"
                    onClick={handleMessageCounterpart}
                    className="flex-1"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                )}
                {selectedTransaction.job_id && (
                  <Button
                    variant="outline"
                    onClick={handleViewJob}
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Job
                  </Button>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransactionDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}