'use client';

import React, { useState } from 'react';
import { Star, Loader2, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import { ProductThumb } from './accountUtils';

export interface ReviewTargetProduct {
  id: string;
  name: string;
  image: string;
  business_type?: string;
  store_id?: string;
}

interface ReviewModalProps {
  product?: ReviewTargetProduct | null;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<boolean>;
}

const LABELS = ['Moyen', 'Bien', 'Très bien', 'Excellent !'];

export const ReviewModal: React.FC<ReviewModalProps> = ({ product, onClose, onSubmit }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product?.store_id || !product?.id) return;
    if (comment.trim().length < 3) {
      setCommentError('Votre commentaire doit contenir au moins 3 caractères.');
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onSubmit(rating, comment.trim());
      if (ok) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) return null;

  const title =
    product.business_type === 'food' ? 'Noter votre repas' : 'Noter le produit';
  const placeholder =
    product.business_type === 'food'
      ? 'Comment était votre repas ?'
      : 'Partagez votre expérience avec ce produit...';

  return (
    <Modal
      title={title}
      subtitle={product.name}
      icon={<Star size={20} fill="currentColor" />}
      busy={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto" noValidate>
        <div className="flex items-center gap-3 px-1">
          <ProductThumb src={product.image} alt={product.name} className="w-12 h-12" iconSize={18} />
          <p className="text-xs font-black text-[#002f34] truncate">{product.name}</p>
        </div>

        <div className="flex flex-col items-center gap-3 py-5 bg-gray-50/60 rounded-3xl border border-dashed border-gray-200">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Votre note</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 transition-transform active:scale-90"
                aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
              >
                <Star
                  size={30}
                  fill={star <= rating ? '#fbbf24' : 'none'}
                  className={star <= rating ? 'text-amber-400 drop-shadow-sm' : 'text-gray-200'}
                  strokeWidth={star <= rating ? 0 : 2}
                />
              </button>
            ))}
          </div>
          <p className="text-xs font-black text-[#f56b2a] uppercase tracking-widest">
            {rating >= 5 ? 'Excellent !' : LABELS[rating - 2] || ''}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
            Commentaire
          </label>
          <textarea
            required
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setCommentError(null);
            }}
            placeholder={placeholder}
            className={`w-full px-5 py-4 bg-gray-50 border rounded-2xl text-sm font-bold min-h-[110px] resize-none outline-none transition-all focus:ring-2 ${
              commentError
                ? 'border-red-200 focus:ring-red-200/30'
                : 'border-transparent focus:ring-[#f56b2a]/20'
            }`}
          />
          {commentError && (
            <p className="text-[10px] font-bold text-red-400 px-1">{commentError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#002f34] text-white rounded-2xl font-black text-xs shadow-md shadow-gray-200 hover:bg-black active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          Publier mon avis
        </button>
      </form>
    </Modal>
  );
};