import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Navigation,
  MessageSquare,
  Phone,
  AlertCircle,
  Upload,
  MapPin,
  Check,
  Clock,
  DollarSign,
  Package as PackageIcon
} from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import JobStatusChip from "../components/job/JobStatusChip";
import RoutePreview from "../components/job/RoutePreview";
import { openInMaps, openRouteInMaps } from "../components/MapsHelper";
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

const STATUS_PROGRESSION = {
  accepted: { next: 'en_route_pickup', action: 'Start Job', mapsTarget: 'pickup' },
  en_route_pickup: { next: 'arrived_pickup', action: 'Arrived at Pickup', mapsTarget: 'pickup' },
  arrived_pickup: { next: 'picked_up', action: 'Confirm Pickup', mapsTarget: 'dropoff' },
  picked_up: { next: 'en_route_dropoff', action: 'En Route to Dropoff', mapsTarget: 'dropoff' },
  en_route_dropoff: { next: 'arrived_dropoff', action: 'Arrived at Dropoff', mapsTarget: 'dropoff' },
  arrived_dropoff: { next: 'delivered', action: 'Confirm Delivery', mapsTarget: null },
  delivered: { next: null, action: 'Complete Job', mapsTarget: null }
};

export default function DriverJob() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('job_id');
  
  const [currentUser, setCurrentUser] = useState(null);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [mode] = useState('driver');
  const gpsIntervalRef = useRef(null);
  const lastPingRef = useRef(null);

  const modeColor = '#2FB5C0';

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
  }, []);

  const { data: job, isLoading } = useQuery({
    queryKey: ['driver-job', jobId],
    queryFn: async () => {
      const requests = await base44.entities.Request.list();
      return requests.find(r => r.id === jobId);
    },
    enabled: !!jobId && !!currentUser,
    refetchInterval: 10000
  });

  const { data: sender } = useQuery({
    queryKey: ['job-sender', job?.poster_id],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.find(u => u.id === job.poster_id);
    },
    enabled: !!job?.poster_id
  });

  // GPS Ping Recording
  useEffect(() => {
    if (!job || !currentUser || job.driver_id !== currentUser.id) return;
    if (!['in_progress', 'en_route_pickup', 'en_route_dropoff'].includes(job.status)) return;

    const recordPing = async (position) => {
      try {
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        
        // Determine ping interval based on movement
        const isMoving = speed > 2;
        const now = Date.now();
        const lastPing = lastPingRef.current || 0;
        const interval = isMoving ? 10000 : 30000; // 10s when moving, 30s when stationary
        
        if (now - lastPing < interval) return;
        
        await base44.functions.invoke('recordGPSPing', {
          job_id: jobId,
          latitude,
          longitude,
          accuracy,
          speed: speed || 0,
          heading: heading || 0,
          status_step: job.job_status || 'accepted',
          battery_level: navigator.getBattery ? await navigator.getBattery().then(b => b.level * 100) : null,
          app_state: document.visibilityState === 'visible' ? 'foreground' : 'background'
        });
        
        lastPingRef.current = now;
      } catch (error) {
        console.error('GPS ping error:', error);
      }
    };

    if ('geolocation' in navigator) {
      gpsIntervalRef.current = navigator.geolocation.watchPosition(
        recordPing,
        (error) => {
          console.error('GPS error:', error);
          toast.error('Location access denied. Please enable GPS.');
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }

    return () => {
      if (gpsIntervalRef.current) {
        navigator.geolocation.clearWatch(gpsIntervalRef.current);
      }
    };
  }, [job, currentUser, jobId]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ new_status, metadata }) => {
      const response = await base44.functions.invoke('updateJobStatus', {
        job_id: jobId,
        new_status,
        metadata
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-job', jobId] });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: async (file) => {
      const { data } = await base44.functions.invoke('uploadFile', { file });
      await base44.entities.Request.update(jobId, {
        receipt_url: data.file_url
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-job', jobId] });
      setShowReceiptUpload(false);
      setReceiptFile(null);
      toast.success('Receipt uploaded');
    },
    onError: () => {
      toast.error('Failed to upload receipt');
    }
  });

  const handleStatusAdvance = () => {
    if (!job) return;
    
    const currentStatus = job.job_status || 'accepted';
    const config = STATUS_PROGRESSION[currentStatus];
    
    if (!config || !config.next) return;
    
    // Special handling for "Start Job" - open maps first
    if (currentStatus === 'accepted' && config.mapsTarget === 'pickup') {
      openRouteInMaps(
        job.last_ping_lat || job.pickup_latitude,
        job.last_ping_lng || job.pickup_longitude,
        job.pickup_latitude,
        job.pickup_longitude,
        job.pickup_address
      );
      
      // Then update status
      setTimeout(() => {
        updateStatusMutation.mutate({ new_status: config.next });
      }, 500);
      return;
    }
    
    // Special handling for items requiring COD purchase
    if (currentStatus === 'arrived_pickup' && job.product_hold > 0 && !job.receipt_url) {
      setShowReceiptUpload(true);
      return;
    }
    
    // Handle picked up - transition to en route to dropoff and open maps
    if (currentStatus === 'picked_up') {
      openRouteInMaps(
        job.last_ping_lat || job.pickup_latitude,
        job.last_ping_lng || job.pickup_longitude,
        job.dropoff_latitude,
        job.dropoff_longitude,
        job.dropoff_address
      );
      
      setTimeout(() => {
        updateStatusMutation.mutate({ new_status: config.next });
      }, 500);
      return;
    }
    
    // Standard status advancement
    updateStatusMutation.mutate({ new_status: config.next });
  };

  const handleOpenMaps = () => {
    if (!job) return;
    
    const currentStatus = job.job_status || 'accepted';
    const config = STATUS_PROGRESSION[currentStatus];
    
    if (config?.mapsTarget === 'pickup') {
      openInMaps(job.pickup_latitude, job.pickup_longitude, job.pickup_address);
    } else if (config?.mapsTarget === 'dropoff') {
      openInMaps(job.dropoff_latitude, job.dropoff_longitude, job.dropoff_address);
    }
  };

  const handleReceiptUpload = () => {
    if (!receiptFile) return;
    uploadReceiptMutation.mutate(receiptFile);
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading job...</div>;
  }

  if (!job) {
    return <div className="p-8 text-center">Job not found</div>;
  }

  if (job.driver_id !== currentUser?.id) {
    return <div className="p-8 text-center">Unauthorized</div>;
  }

  const currentStatus = job.job_status || 'accepted';
  const config = STATUS_PROGRESSION[currentStatus];

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HitchrLogo mode={mode} size={24} />
              <h1 className="text-xl font-semibold">Active Job</h1>
            </div>
            <JobStatusChip status={currentStatus} />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Job Summary */}
        <Card className="p-4 bg-white">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600">Sender</p>
              <p className="font-semibold">{sender?.full_name || 'Loading...'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Payout</p>
              <p className="font-semibold text-green-600">${((job.final_price || 0) * 0.8).toFixed(2)}</p>
            </div>
          </div>

          {job.product_hold > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-600" />
                <div>
                  <p className="text-sm font-semibold text-orange-900">COD Purchase Required</p>
                  <p className="text-xs text-orange-700">
                    Budget: ${job.product_hold.toFixed(2)}
                    {job.cod_advance_released && ' (Released to wallet)'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <RoutePreview
            fromAddress={job.pickup_address}
            toAddress={job.dropoff_address}
            fromLat={job.pickup_latitude}
            fromLng={job.pickup_longitude}
            toLat={job.dropoff_latitude}
            toLng={job.dropoff_longitude}
            eta={job.estimated_arrival_dropoff}
            currentLat={job.last_ping_lat}
            currentLng={job.last_ping_lng}
          />
        </Card>

        {/* Primary Actions */}
        <div className="space-y-2">
          {config && config.next && (
            <Button
              onClick={handleStatusAdvance}
              disabled={updateStatusMutation.isPending}
              className="w-full h-12 text-base font-semibold"
              style={{ backgroundColor: modeColor, color: '#FFFFFF' }}
            >
              {currentStatus === 'delivered' ? <Check className="w-5 h-5 mr-2" /> : <Navigation className="w-5 h-5 mr-2" />}
              {config.action}
            </Button>
          )}

          {config?.mapsTarget && currentStatus !== 'accepted' && (
            <Button
              onClick={handleOpenMaps}
              variant="outline"
              className="w-full h-12 text-base font-semibold"
              style={{ borderColor: modeColor, color: modeColor }}
            >
              <MapPin className="w-5 h-5 mr-2" />
              Open in Maps
            </Button>
          )}
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Chat") + `?request_id=${jobId}`)}
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Chat
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = `tel:${sender?.phone || ''}`}
            disabled={!sender?.phone}
          >
            <Phone className="w-4 h-4 mr-1" />
            Call
          </Button>
          <Button variant="outline">
            <AlertCircle className="w-4 h-4 mr-1" />
            Issue
          </Button>
        </div>

        {/* Special Actions */}
        {job.product_hold > 0 && !job.receipt_url && currentStatus !== 'accepted' && (
          <Button
            onClick={() => setShowReceiptUpload(true)}
            variant="outline"
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Receipt
          </Button>
        )}

        {/* Job Details */}
        <Card className="p-4 bg-gray-50">
          <h3 className="font-semibold mb-3">Job Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Item Type:</span>
              <span className="font-medium">{job.item_type?.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery Fee:</span>
              <span className="font-medium">${(job.final_price || 0).toFixed(2)}</span>
            </div>
            {job.product_hold > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Product Hold:</span>
                <span className="font-medium text-orange-600">${job.product_hold.toFixed(2)}</span>
              </div>
            )}
            {job.pickup_time && (
              <div className="flex justify-between">
                <span className="text-gray-600">Picked Up:</span>
                <span className="font-medium">{new Date(job.pickup_time).toLocaleTimeString()}</span>
              </div>
            )}
            {job.item_notes && (
              <div>
                <p className="text-gray-600 mb-1">Notes:</p>
                <p className="text-gray-900">{job.item_notes}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Receipt Upload Dialog */}
      <Dialog open={showReceiptUpload} onOpenChange={setShowReceiptUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Purchase Receipt</DialogTitle>
            <DialogDescription>
              Upload a photo or PDF of your receipt for ${job.product_hold?.toFixed(2)} purchase
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="receipt-file">Receipt File</Label>
              <Input
                id="receipt-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files[0])}
              />
            </div>
            {receiptFile && (
              <p className="text-sm text-gray-600">
                Selected: {receiptFile.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptUpload(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReceiptUpload}
              disabled={!receiptFile || uploadReceiptMutation.isPending}
            >
              {uploadReceiptMutation.isPending ? 'Uploading...' : 'Upload Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}