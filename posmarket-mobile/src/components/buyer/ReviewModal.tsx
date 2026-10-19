/**
 * Modale d'avis produit — copie mobile de
 * `src/components/buyer/ReviewModal.tsx` du web (sélecteur d'étoiles,
 * commentaire, publication).
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowRight, Star } from 'lucide-react-native';
import { SheetModal } from '@/components/buyer/SheetModal';
import { ProductThumb } from '@/components/buyer/ui';
import { COLORS } from '@/theme';

export interface ReviewTargetProduct {
  id: string;
  name: string;
  image: string;
  business_type?: string;
  store_id?: string;
}

interface ReviewModalProps {
  visible: boolean;
  product?: ReviewTargetProduct | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<boolean>;
}

const LABELS = ['Moyen', 'Bien', 'Très bien', 'Excellent !'];

export function ReviewModal({
  visible,
  product,
  busy = false,
  onClose,
  onSubmit,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setRating(5);
      setComment('');
      setCommentError(null);
    }
  }, [visible]);

  if (!product) return null;

  const title = product.business_type === 'food' ? 'Noter votre repas' : 'Noter le produit';
  const placeholder =
    product.business_type === 'food'
      ? 'Comment était votre repas ?'
      : 'Partagez votre expérience avec ce produit...';

  const handleSubmit = async () => {
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

  const isBusy = submitting || busy;

  return (
    <SheetModal
      visible={visible}
      title={title}
      subtitle={product.name}
      icon={<Star size={20} color={COLORS.brand} fill={COLORS.brand} />}
      busy={isBusy}
      onClose={onClose}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.form}
      >
        <View style={styles.productRow}>
          <ProductThumb src={product.image} size={48} iconSize={18} />
          <Text style={styles.productName} numberOfLines={1}>
            {product.name}
          </Text>
        </View>

        <View style={styles.ratingBox}>
          <Text style={styles.ratingLabel}>Votre note</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                style={styles.starBtn}
                accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''}`}
              >
                <Star
                  size={30}
                  fill={star <= rating ? '#FBBF24' : 'transparent'}
                  color={star <= rating ? '#FBBF24' : '#E5E7EB'}
                  strokeWidth={star <= rating ? 0 : 2}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingWord}>
            {rating >= 5 ? 'Excellent !' : LABELS[rating - 2] || ''}
          </Text>
        </View>

        <View>
          <Text style={styles.commentLabel}>Commentaire</Text>
          <TextInput
            value={comment}
            onChangeText={(v) => {
              setComment(v);
              setCommentError(null);
            }}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
            style={[styles.comment, commentError ? styles.commentError : null]}
          />
          {commentError ? <Text style={styles.errorText}>{commentError}</Text> : null}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={isBusy}
          style={[styles.submit, isBusy && styles.disabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <ArrowRight size={16} color="#FFFFFF" />
          )}
          <Text style={styles.submitText}>Publier mon avis</Text>
        </Pressable>
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  form: {
    padding: 24,
    gap: 24,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  productName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  ratingBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
    backgroundColor: 'rgba(249,250,251,0.6)',
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
  },
  ratingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starBtn: {
    padding: 4,
  },
  ratingWord: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  commentLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginLeft: 4,
    marginBottom: 8,
  },
  comment: {
    width: '100%',
    minHeight: 110,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  commentError: {
    borderColor: '#FECDD3',
  },
  errorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F87171',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: COLORS.ink,
    borderRadius: 16,
  },
  submitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default ReviewModal;
