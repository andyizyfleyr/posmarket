import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Blocs squelettes avec effet shimmer identique au web :
 * dégradé #E5E7EB → #F3F4F6 → #E5E7EB qui balaie le bloc en 1,5 s.
 *
 * `SkeletonProvider` crée une seule animation partagée par tous les blocs
 * d'un même écran.
 */

const ShimmerContext = createContext<Animated.Value | null>(null);

export function SkeletonProvider({ children }: { children: React.ReactNode }) {
  const [shimmer] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return (
    <ShimmerContext.Provider value={shimmer}>
      {children}
    </ShimmerContext.Provider>
  );
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const shimmer = useContext(ShimmerContext);
  const [width, setWidth] = useState(0);

  return (
    <View
      style={[styles.skeleton, style]}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next !== width) setWidth(next);
      }}
    >
      {shimmer && width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmer,
            {
              width: Math.max(width * 1.5, 120),
              transform: [
                {
                  translateX: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [width * 1.5, -width * 1.5],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(243,244,246,0)', '#F3F4F6', 'rgba(243,244,246,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});
