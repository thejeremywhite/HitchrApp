import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { MapPin, Package, DollarSign, Clock } from "lucide-react";
import { format } from "date-fns";

export default function JobDrawer({ open, onClose, job }) {
  if (!job) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Job Details</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Job ID</span>
              <span className="font-mono text-xs">{job.id.substring(0, 8)}...</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Status</span>
              <Badge>{job.status}</Badge>
            </div>
          </div>

          {/* Route */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Route
            </h3>
            <div className="pl-6 space-y-2">
              <div>
                <p className="text-xs text-gray-500">Pickup</p>
                <p className="text-sm font-medium">{job.pickup_address}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Dropoff</p>
                <p className="text-sm font-medium">{job.dropoff_address}</p>
              </div>
            </div>
          </div>

          {/* Item */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              Item
            </h3>
            <div className="pl-6">
              <p className="text-sm">{job.item_type?.replace(/_/g, ' ')}</p>
              {job.item_notes && (
                <p className="text-xs text-gray-600 mt-1">{job.item_notes}</p>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Pricing
            </h3>
            <div className="pl-6 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Offered:</span>
                <span className="font-semibold">${(job.offered_price || 0).toFixed(2)}</span>
              </div>
              {job.final_price && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Final:</span>
                  <span className="font-semibold text-green-600">${job.final_price.toFixed(2)}</span>
                </div>
              )}
              {job.product_hold > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Product Hold:</span>
                  <span className="font-semibold text-orange-600">${job.product_hold.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timeline
            </h3>
            <div className="pl-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span>{format(new Date(job.created_date), 'MMM d, yyyy HH:mm')}</span>
              </div>
              {job.pickup_time && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Picked Up:</span>
                  <span>{format(new Date(job.pickup_time), 'MMM d, yyyy HH:mm')}</span>
                </div>
              )}
              {job.dropoff_time && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivered:</span>
                  <span>{format(new Date(job.dropoff_time), 'MMM d, yyyy HH:mm')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}