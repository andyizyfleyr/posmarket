/**
 * Splash animé.
 *
 * Le splash natif est statique : on garde exactement le même fond blanc et le
 * même logo, puis on prolonge l'écran avec trois points orange animés sous le
 * logo. Le splash natif est masqué dès que cette vue est mesurée, ce qui évite
 * le flash blanc entre les deux.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { COLORS } from '@/theme';
import splashIcon from '../../assets/splash-icon.png';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const MIN_VISIBLE_MS = 1100;
const FADE_OUT_MS = 280;

interface AnimatedSplashProps {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const [fade] = useState(() => new Animated.Value(1));
  const [dot1] = useState(() => new Animated.Value(0.35));
  const [dot2] = useState(() => new Animated.Value(0.35));
  const [dot3] = useState(() => new Animated.Value(0.35));

  const nativeSplashHidden = useRef(false);
  const finished = useRef(false);
  const fadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dots = [dot1, dot2, dot3];

    // Vague gauche → droite : chaque point monte en opacité et en taille à son
    // tour, puis la boucle repart sans à-coup.
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(dot, {
            toValue: 1,
            duration: 260,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(dot, {
            toValue: 0.35,
            duration: 260,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.delay((dots.length - 1 - index) * 140),
        ]),
      ),
    );

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dot1, dot2, dot3]);

  useEffect(
    () => () => {
      if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
    },
    [],
  );

  const handleLayout = useCallback(() => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;

    // Le rendu React est prêt et le splash custom est mesuré : on peut retirer
    // le splash natif sans laisser apparaître de fond vide.
    SplashScreen.hideAsync().catch(() => {});

    fadeTimeout.current = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start(({ finished: animationFinished }) => {
        if (!animationFinished || finished.current) return;
        finished.current = true;
        onFinish();
      });
    }, MIN_VISIBLE_MS);
  }, [fade, onFinish]);

  return (
    <Animated.View
      style={[styles.root, { opacity: fade }]}
      onLayout={handleLayout}
      pointerEvents="auto"
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement de PosMarket"
    >
      <View style={styles.logoWrap}>
        <Image
          source={splashIcon}
          style={styles.logo}
          resizeMode="contain"
          accessible={false}
          alt=""
        />
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((dot, index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  opacity: dot,
                  transform: [
                    {
                      scale: dot.interpolate({
                        inputRange: [0.35, 1],
                        outputRange: [0.82, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Le logo garde exactement la taille du splash natif (imageWidth: 200).
  logoWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  // Le visuel du logo occupe ~454/512 de la hauteur de l'image : les points se
  // placent juste sous le bas visible du logo, pas sous la boîte de 200 px.
  dotsRow: {
    position: 'absolute',
    top: 194,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.brand,
  },
});
