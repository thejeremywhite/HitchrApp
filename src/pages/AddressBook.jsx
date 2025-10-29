
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash2, MapPin, Edit, Home, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AddressPicker from '../components/AddressPicker';
import { toast } from 'sonner';

function AddressForm({ address, onSubmit, onCancel, currentUser }) {
    const [label, setLabel] = useState(address?.label || '');
    const [addressText, setAddressText] = useState(address?.address_text || '');
    const [latitude, setLatitude] = useState(address?.latitude || null);
    const [longitude, setLongitude] = useState(address?.longitude || null);
    const [placeId, setPlaceId] = useState(address?.place_id || null);
    const [provider, setProvider] = useState(address?.provider || null);
    const [interpolated, setInterpolated] = useState(address?.interpolated || false);
    const [pendingGeocode, setPendingGeocode] = useState(address?.pending_geocode || false);

    const handleSubmit = () => {
        if (!label || label.trim() === '') {
            toast.error("Please enter a label.");
            return;
        }
        if (!addressText || addressText.trim() === '') {
            toast.error("Please enter an address.");
            return;
        }
        
        onSubmit({ 
            label: label.trim(), 
            address_text: addressText.trim(),
            latitude,
            longitude,
            place_id: placeId,
            provider,
            interpolated,
            pending_geocode: pendingGeocode,
            is_default_home: label.toLowerCase() === 'home',
            is_default_work: label.toLowerCase() === 'work'
        });
    };

    const handleLocationUpdate = (locationData) => {
        if (locationData) {
            setAddressText(locationData.address);
            setLatitude(locationData.lat);
            setLongitude(locationData.lng);
            setPlaceId(locationData.place_id);
            setProvider(locationData.provider);
            setInterpolated(locationData.interpolated || false);
            setPendingGeocode(locationData.pending_geocode || false);
        }
    };

    return (
        <div className="space-y-4 p-1">
            <div>
                <label className="text-sm font-medium mb-2 block">Label</label>
                <Input
                  placeholder="Label (e.g., Home, Work)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="h-12"
                  autoComplete="off"
                  name="address-label"
                />
            </div>
            
            <div className="flex gap-2">
                <Button 
                    type="button"
                    size="sm" 
                    variant="outline" 
                    onClick={() => setLabel("Home")}
                    className="flex-1"
                >
                    <Home className="w-4 h-4 mr-2"/>Home
                </Button>
                <Button 
                    type="button"
                    size="sm" 
                    variant="outline" 
                    onClick={() => setLabel("Work")}
                    className="flex-1"
                >
                    <Briefcase className="w-4 h-4 mr-2"/>Work
                </Button>
            </div>
            
            <div>
                <label className="text-sm font-medium mb-2 block">Address</label>
                <AddressPicker
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  placeholder="Type address or tap crosshairs"
                  className="h-12"
                  onLocationUpdate={handleLocationUpdate}
                  name="address-text"
                />
            </div>
            
            <div className="flex gap-3 pt-2">
                <Button 
                    type="button"
                    variant="outline" 
                    onClick={onCancel}
                    className="flex-1"
                >
                    Cancel
                </Button>
                <Button 
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1"
                    style={{ backgroundColor: '#FF8A00', color: '#FFFFFF' }}
                >
                    Save Address
                </Button>
            </div>
        </div>
    );
}

export default function AddressBook() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses', currentUser?.id],
    queryFn: async () => {
        const allAddresses = await base44.entities.Address.list('-updated_date');
        return allAddresses.filter(a => a.user_id === currentUser.id);
    },
    enabled: !!currentUser,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ addressData, id }) => {
        if (addressData.is_default_home) {
            const homeAddresses = addresses.filter(a => a.is_default_home && a.id !== id);
            for (const addr of homeAddresses) {
                await base44.entities.Address.update(addr.id, { is_default_home: false });
            }
        }
        if (addressData.is_default_work) {
            const workAddresses = addresses.filter(a => a.is_default_work && a.id !== id);
            for (const addr of workAddresses) {
                await base44.entities.Address.update(addr.id, { is_default_work: false });
            }
        }
        
        const existing = addresses.find(a => 
            a.place_id && addressData.place_id && a.place_id === addressData.place_id && a.id !== id
        );
        
        if (existing) {
            return await base44.entities.Address.update(existing.id, addressData);
        } else if (id) {
            return await base44.entities.Address.update(id, addressData);
        } else {
            return await base44.entities.Address.create({
                ...addressData,
                user_id: currentUser.id
            });
        }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['addresses', currentUser.id]});
      setIsFormOpen(false);
      setEditingAddress(null);
      toast.success("Address saved!");
    },
    onError: (error) => {
        console.error("Failed to save address:", error);
        toast.error("Failed to save address");
    }
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (addressId) => base44.entities.Address.delete(addressId),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['addresses', currentUser.id]});
      toast.success("Address deleted");
    },
    onError: () => {
        console.error("Failed to delete address");
        toast.error("Failed to delete address");
    }
  });

  const handleFormSubmit = (addressData) => {
    saveMutation.mutate({ 
        addressData, 
        id: editingAddress?.id 
    });
  };

  const openAddForm = () => {
    setEditingAddress(null);
    setIsFormOpen(true);
  };

  const openEditForm = (address) => {
    setEditingAddress(address);
    setIsFormOpen(true);
  };

  const handleDelete = (addressId) => {
    if (window.confirm('Are you sure you want to delete this address?')) {
        deleteAddressMutation.mutate(addressId);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-11 w-11">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Address Book</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto p-4 space-y-6">
        <Button onClick={openAddForm} className="w-full h-12 rounded-lg" style={{ backgroundColor: '#FF8A00', color: '#FFFFFF' }}>
            <Plus className="w-5 h-5 mr-2" />
            Add New Address
        </Button>

        <div className="space-y-3">
          {isLoading && <p className="text-center text-[var(--text-secondary)]">Loading addresses...</p>}
          {!isLoading && addresses.length === 0 && (
            <p className="text-center text-[var(--text-secondary)] py-8">No saved addresses yet.</p>
          )}
          {addresses.map(addr => (
            <div key={addr.id} className="flex justify-between items-center p-4 rounded-xl bg-[var(--subtle-bg)] min-h-[72px]">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <MapPin className="w-6 h-6 text-[var(--text-secondary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{addr.label}</p>
                  <p className="text-sm text-[var(--text-secondary)] truncate">{addr.address_text}</p>
                  {addr.pending_geocode && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Needs geocoding</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEditForm(addr)} className="text-gray-500 hover:text-gray-800">
                      <Edit className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(addr.id)} className="text-red-500 hover:bg-red-50">
                    <Trash2 className="w-5 h-5" />
                  </Button>
              </div>
            </div>
          ))}
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="bg-white" style={{ backgroundColor: '#FFFFFF' }}>
                <DialogHeader>
                    <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                </DialogHeader>
                <AddressForm
                    address={editingAddress}
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    currentUser={currentUser}
                />
            </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
