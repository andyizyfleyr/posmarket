/**
 * Splash animé.
 *
 * Le splash natif est statique : on garde exactement le même fond blanc et le
 * même logo, puis on prolonge l'écran avec le mot POSMARKET dont les lettres
 * s'illuminent en vague. Le splash natif est masqué dès que cette vue est
 * mesurée, ce qui évite le flash blanc entre les deux.
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

const WORDMARK = [
  { char: 'P', color: '#111827' },
  { char: 'O', color: '#111827' },
  { char: 'S', color: '#111827' },
  { char: 'M', color: COLORS.brand },
  { char: 'A', color: COLORS.brand },
  { char: 'R', color: COLORS.brand },
  { char: 'K', color: COLORS.brand },
  { char: 'E', color: COLORS.brand },
  { char: 'T', color: COLORS.brand },
] as const;

interface AnimatedSplashProps {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const [fade] = useState(() => new Animated.Value(1));
  const [letterValues] = useState(() =>
    WORDMARK.map(() => new Animated.Value(0.5)),
  );

  const nativeSplashHidden = useRef(false);
  const finished = useRef(false);
  const fadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Vague gauche → droite : chaque lettre s'illumine et remonte légèrement,
    // puis la boucle repart. Un cycle complet dure ~1,1 s.
    const loops = letterValues.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 70),
          Animated.timing(value, {
            toValue: 1,
            duration: 240,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(value, {
            toValue: 0.5,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.delay((WORDMARK.length - 1 - index) * 70),
        ]),
      ),
    );

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [letterValues]);

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
        <View style={styles.wordmarkRow}>
          {WORDMARK.map((letter, index) => {
            const value = letterValues[index];
            return (
              <Animated.Text
                key={`${letter.char}-${index}`}
                accessible={false}
                style={[
                  styles.letter,
                  {
                    color: letter.color,
                    opacity: value,
                    transform: [
                      {
                        translateY: value.interpolate({
                          inputRange: [0.5, 1],
                          outputRange: [2, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {letter.char}
              </Animated.Text>
            );
          })}
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
  // Le visuel du logo occupe ~454/512 de la hauteur de l'image : le wordmark
  // se place juste sous le bas visible du logo, pas sous la boîte de 200 px.
  wordmarkRow: {
    position: 'absolute',
    top: 188,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 2,
    includeFontPadding: false,
  },
});
