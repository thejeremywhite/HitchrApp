import React from "react";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Navigation, 
  MapPin, 
  ShoppingBag, 
  Package, 
  Truck,
  Check
} from "lucide-react";

const STATUS_CONFIG = {
  accepted: { 
    label: "Accepted", 
    icon: CheckCircle, 
    color: "bg-blue-100 text-blue-800 border-blue-200" 
  },
  en_route_pickup: { 
    label: "En Route to Pickup", 
    icon: Navigation, 
    color: "bg-purple-100 text-purple-800 border-purple-200" 
  },
  arrived_pickup: { 
    label: "Arrived at Pickup", 
    icon: MapPin, 
    color: "bg-yellow-100 text-yellow-800 border-yellow-200" 
  },
  purchased_item: { 
    label: "Item Purchased", 
    icon: ShoppingBag, 
    color: "bg-orange-100 text-orange-800 border-orange-200" 
  },
  picked_up: { 
    label: "Picked Up", 
    icon: Package, 
    color: "bg-teal-100 text-teal-800 border-teal-200" 
  },
  en_route_dropoff: { 
    label: "En Route to Dropoff", 
    icon: Truck, 
    color: "bg-indigo-100 text-indigo-800 border-indigo-200" 
  },
  arrived_dropoff: { 
    label: "Arrived at Dropoff", 
    icon: MapPin, 
    color: "bg-green-100 text-green-800 border-green-200" 
  },
  delivered: { 
    label: "Delivered", 
    icon: Check, 
    color: "bg-green-100 text-green-800 border-green-200" 
  }
};

export default function JobStatusChip({ status, className = "" }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.accepted;
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.color} border px-3 py-1.5 ${className}`}
    >
      <Icon className="w-4 h-4 mr-1.5" />
      {config.label}
    </Badge>
  );
}