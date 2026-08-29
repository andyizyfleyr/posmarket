'use client';

import React from 'react';
import { MapPin, Plus, Home, Briefcase, Edit2, Trash2 } from 'lucide-react';
import Button from '@/components/Button';
import { BuyerAddress } from './accountTypes';
import { EmptyState, PanelSkeleton } from './accountUtils';

interface AddressesTabProps {
  addresses: BuyerAddress[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (address: BuyerAddress) => void;
  onDelete: (id: string) => void;
  deletingId?: string | null;
}

const AddressIcon: React.FC<{ name?: string }> = ({ name }) => {
  if (name === 'Maison') return <Home size={18} />;
  if (name === 'Bureau') return <Briefcase size={18} />;
  return <MapPin size={18} />;
};

export const AddressesTab: React.FC<AddressesTabProps> = ({
  addresses,
  loading,
  onAdd,
  onEdit,
  onDelete,
  deletingId,
}) => {
  if (loading && addresses.length === 0) return <PanelSkeleton rows={2} />;

  if (addresses.length === 0) {
    return (
      <EmptyState
        icon={<MapPin size={34} />}
        title="Aucune adresse enregistrée"
        subtitle="Ajoutez une adresse de livraison pour pré-remplir vos commandes en un clic."
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={onAdd}
            className="rounded-full px-6 text-[10px] font-black uppercase tracking-widest"
          >
            Ajouter une adresse
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-400 px-1">
          {addresses.length} adresse{addresses.length > 1 ? 's' : ''} enregistrée{addresses.length > 1 ? 's' : ''}
        </p>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={onAdd}
          className="rounded-xl"
        >
          Ajouter
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className={`bg-white p-4 rounded-[24px] border transition-all ${
              addr.is_default
                ? 'border-[#f56b2a] shadow-md ring-1 ring-[#f56b2a]/20'
                : 'border-gray-100 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                  <AddressIcon name={addr.name} />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-[#002f34] text-sm truncate">{addr.name}</p>
                  {addr.is_default && (
                    <span className="text-[9px] font-black text-[#f56b2a] uppercase tracking-widest">
                      Par défaut
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onEdit(addr)}
                  className="p-2 text-gray-400 hover:text-[#f56b2a] active:scale-90 transition-all"
                  aria-label={`Modifier ${addr.name}`}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onDelete(addr.id)}
                  disabled={deletingId === addr.id}
                  className="p-2 text-red-300 hover:text-red-500 active:scale-90 transition-all disabled:opacity-50"
                  aria-label={`Supprimer ${addr.name}`}
                >
                  <Trash2 size={16} className={deletingId === addr.id ? 'animate-pulse' : ''} />
                </button>
              </div>
            </div>
            <div className="pl-[52px]">
              <p className="text-xs font-black text-gray-900">{addr.full_name}</p>
              <p className="text-[11px] text-gray-500 font-bold mt-1">{addr.address}</p>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight mt-0.5">
                {addr.city}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};