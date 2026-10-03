'use client';

import React from 'react';
import { MapPin, Plus, Home, Briefcase, Edit2, Trash2 } from 'lucide-react';
import Button from '@/components/Button';
import { BuyerAddress } from './accountTypes';
import { EmptyState, PanelSkeleton } from './accountUtils';
import { formatPhoneNumber } from '@/utils';

interface AddressesTabProps {
  addresses: BuyerAddress[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (address: BuyerAddress) => void;
  onDelete: (address: BuyerAddress) => void;
  deletingId?: string | null;
}

const AddressIcon: React.FC<{ name?: string }> = ({ name }) => {
  if (name === 'Maison') return <Home size={18} aria-hidden="true" />;
  if (name === 'Bureau') return <Briefcase size={18} aria-hidden="true" />;
  return <MapPin size={18} aria-hidden="true" />;
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
        icon={<MapPin size={34} aria-hidden="true" />}
        title="Aucune adresse enregistrée"
        subtitle="Ajoutez une adresse pour pré-remplir la livraison lors de vos commandes."
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} aria-hidden="true" />}
            onClick={onAdd}
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
        <p className="text-sm font-medium text-gray-500 px-1">
          {addresses.length} adresse{addresses.length > 1 ? 's' : ''} enregistrée
          {addresses.length > 1 ? 's' : ''}
        </p>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} aria-hidden="true" />}
          onClick={onAdd}
          className="rounded-xl"
        >
          Ajouter
        </Button>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {addresses.map((addr) => (
          <li
            key={addr.id}
            className={`bg-white p-4 rounded-card border transition-colors ${
              addr.is_default ? 'border-brand shadow-md ring-1 ring-brand/20' : 'border-line shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                  <AddressIcon name={addr.name} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-ink text-sm truncate">{addr.name}</p>
                  {addr.is_default && (
                    <span className="text-xs font-semibold text-brand">Par défaut</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onEdit(addr)}
                  className="p-2 text-gray-400 hover:text-brand rounded-lg transition-colors"
                  aria-label={`Modifier ${addr.name}`}
                >
                  <Edit2 size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(addr)}
                  disabled={deletingId === addr.id}
                  className="p-2 text-red-400 hover:text-red-600 rounded-lg transition-colors disabled:opacity-50"
                  aria-label={`Supprimer ${addr.name}`}
                >
                  <Trash2 size={16} className={deletingId === addr.id ? 'animate-pulse' : ''} aria-hidden="true" />
                </button>
              </div>
            </div>

            <address className="pl-[52px] not-italic">
              <p className="text-sm font-semibold text-gray-900">{addr.full_name}</p>
              <p className="text-sm text-gray-600 mt-0.5">
                {[addr.address, addr.city].filter(Boolean).join(', ')}
              </p>
              {addr.phone && (
                <p className="text-sm text-gray-500 mt-0.5">{formatPhoneNumber(addr.phone)}</p>
              )}
            </address>
          </li>
        ))}
      </ul>
    </div>
  );
};