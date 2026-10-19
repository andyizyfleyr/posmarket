/**
 * Bouton — copie mobile de `src/components/Button.tsx` du web :
 * mêmes variantes (primary, secondary, outline, danger, ghost, white), mêmes
 * tailles (xs → xl) et mêmes rayons (rounded-2xl = 16).
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { COLORS } from '@/theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'danger'
  | 'ghost'
  | 'white';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps {
  children?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

const VARIANTS: Record<ButtonVariant, ViewStyle & { color: string }> = {
  primary: { backgroundColor: COLORS.brand, color: '#FFFFFF' },
  secondary: { backgroundColor: '#111827', color: '#FFFFFF' },
  outline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    color: '#374151',
  },
  danger: { backgroundColor: '#EF4444', color: '#FFFFFF' },
  ghost: { backgroundColor: 'transparent', color: '#4B5563' },
  white: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    color: '#111827',
  },
};

const SIZES: Record<
  ButtonSize,
  { paddingHorizontal: number; paddingVertical: number; fontSize: number; gap: number }
> = {
  xs: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, gap: 4 },
  sm: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 10, gap: 6 },
  md: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 12, gap: 8 },
  lg: { paddingHorizontal: 24, paddingVertical: 14, fontSize: 14, gap: 10 },
  xl: { paddingHorizontal: 32, paddingVertical: 20, fontSize: 16, gap: 12 },
};

export function Button({
  children,
  loading = false,
  loadingText,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
  onPress,
  disabled,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const variantStyle = VARIANTS[variant];
  const sizeStyle = SIZES[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: variantStyle.backgroundColor,
          borderWidth: variantStyle.borderWidth,
          borderColor: variantStyle.borderColor,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical: sizeStyle.paddingVertical,
          gap: sizeStyle.gap,
        },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <View style={[styles.content, { gap: sizeStyle.gap }]}>
          <ActivityIndicator size="small" color={variantStyle.color} />
          {loadingText ? (
            <Text
              style={[
                styles.label,
                { color: variantStyle.color, fontSize: sizeStyle.fontSize },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {loadingText}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={[styles.content, { gap: sizeStyle.gap }]}>
          {icon && iconPosition === 'left' ? <View>{icon}</View> : null}
          <Text
            style={[
              styles.label,
              { color: variantStyle.color, fontSize: sizeStyle.fontSize },
              textStyle,
            ]}
            numberOfLines={1}
          >
            {children}
          </Text>
          {icon && iconPosition === 'right' ? <View>{icon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.7,
  },
});

export default Button;
