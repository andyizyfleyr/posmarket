/**
 * Feuille basse « Noter le produit » — sélecteur d'étoiles, commentaire et
 * publication. Design aligné sur le reste de l'espace client.
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
import { Star } from 'lucide-react-native';
import { SheetModal } from '@/components/buyer/SheetModal';
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
const STAR_COLOR = '#FBBF24';
const STAR_EMPTY = '#E5E7EB';

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
      : 'Partagez votre expérience avec ce produit…';

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
      icon={<Star size={16} color={COLORS.brand} fill={COLORS.brand} />}
      busy={isBusy}
      onClose={onClose}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.form}
      >
        <View style={styles.ratingBox}>
          <View style={styles.ratingHead}>
            <Text style={styles.ratingLabel}>Votre note</Text>
            <Text style={styles.ratingWord}>
              {rating >= 5 ? 'Excellent !' : LABELS[rating - 2] || ''}
            </Text>
          </View>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                hitSlop={6}
                style={({ pressed }) => [styles.starBtn, pressed && styles.pressed]}
                accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected: star === rating }}
              >
                <Star
                  size={26}
                  fill={star <= rating ? STAR_COLOR : 'transparent'}
                  color={star <= rating ? STAR_COLOR : STAR_EMPTY}
                  strokeWidth={star <= rating ? 0 : 2}
                />
              </Pressable>
            ))}
          </View>
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
            placeholderTextColor={COLORS.textFaint}
            multiline
            textAlignVertical="top"
            style={[styles.comment, commentError ? styles.commentError : null]}
          />
          {commentError ? (
            <Text style={styles.errorText}>{commentError}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={isBusy}
          style={({ pressed }) => [
            styles.submit,
            (isBusy || pressed) && styles.pressed,
            isBusy && styles.disabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Star size={14} color="#FFFFFF" fill="#FFFFFF" />
          )}
          <Text style={styles.submitText}>Publier mon avis</Text>
        </Pressable>
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  form: {
    padding: 16,
    paddingTop: 4,
    gap: 16,
  },
  ratingBox: {
    gap: 12,
    padding: 14,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  ratingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  ratingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ratingWord: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brand,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  starBtn: {
    padding: 2,
  },
  commentLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  comment: {
    width: '100%',
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.lineStrong,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  commentError: {
    borderColor: '#FECDD3',
  },
  errorText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.danger,
    marginTop: 4,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
  },
  submitText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.surface,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default ReviewModal;
