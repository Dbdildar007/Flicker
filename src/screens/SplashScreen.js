// src/screens/SplashScreen.js
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions,
  StatusBar, Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../data/theme';

const { width: SW, height: SH } = Dimensions.get('window');

// Each letter of FLICKS as individual animated unit
const LETTERS = ['F', 'L', 'I', 'C', 'K', 'S'];

function AnimatedLetter({ char, index, totalLetters }) {
  const isF = char === 'F';

  // Phase 1: slides in from left
  const slideX     = useRef(new Animated.Value(-SW)).current;
  // Phase 2: jump (scale up)
  const scaleY     = useRef(new Animated.Value(1)).current;
  const scaleX     = useRef(new Animated.Value(1)).current;
  // Phase 3: rocket to right (fast)
  const exitX      = useRef(new Animated.Value(0)).current;
  // Glow opacity
  const glowOpacity = useRef(new Animated.Value(0)).current;
  // Letter opacity
  const letterOpacity = useRef(new Animated.Value(0)).current;

  const STAGGER = 80; // ms between each letter entry

  useEffect(() => {
    const delay = index * STAGGER;

    Animated.sequence([
      // 1. Slide in from left slowly
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: 0,
          duration: 600,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(letterOpacity, {
          toValue: 1,
          duration: 300,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 400,
          delay: delay + 200,
          useNativeDriver: true,
        }),
      ]),
      // 2. Brief pause then JUMP (squash & stretch)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleY, {
            toValue: 1.6,
            duration: 180,
            easing: Easing.out(Easing.back(2)),
            useNativeDriver: true,
          }),
          Animated.timing(scaleY, {
            toValue: 0.85,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleY, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleX, {
            toValue: 0.7,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(scaleX, {
            toValue: 1.1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleX, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // 3. Pause on screen
      Animated.delay(400),
      // 4. ROCKET to the right FAST
      Animated.parallel([
        Animated.timing(exitX, {
          toValue: SW * 1.5,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 200,
          delay: 80,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const letterStyle = {
    transform: [
      { translateX: Animated.add(slideX, exitX) },
      { scaleY },
      { scaleX },
    ],
    opacity: letterOpacity,
  };

  return (
    <Animated.View style={[styles.letterWrap, letterStyle]}>
      {/* Glow halo behind letter */}
      <Animated.View
        style={[
          styles.letterGlow,
          {
            opacity: glowOpacity,
            backgroundColor: isF ? COLORS.red : COLORS.accentGlow,
            shadowColor: isF ? COLORS.red : COLORS.accent,
          },
        ]}
      />
      <Text
        style={[
          styles.letter,
          isF
            ? { color: COLORS.red, textShadowColor: COLORS.red, textShadowRadius: 18 }
            : { color: COLORS.accent, textShadowColor: COLORS.accent, textShadowRadius: 12 },
        ]}
      >
        {char}
      </Text>
    </Animated.View>
  );
}

export default function SplashScreen({ onDone }) {
  const bgOpacity    = useRef(new Animated.Value(0)).current;
  const lineWidth    = useRef(new Animated.Value(0)).current;
  const subTextOpacity = useRef(new Animated.Value(0)).current;
  const versionOpacity = useRef(new Animated.Value(0)).current;
  const scanlineY    = useRef(new Animated.Value(-SH * 0.3)).current;
  const progressW    = useRef(new Animated.Value(0)).current;

  const totalDuration = LETTERS.length * 80 + 600 + 180 + 400 + 280;

  useEffect(() => {
    // Background fade in
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Scan line moves down (CRT feel)
    Animated.loop(
      Animated.timing(scanlineY, {
        toValue: SH,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Top line draws in
    setTimeout(() => {
      Animated.timing(lineWidth, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }).start();
    }, 200);

    // Subtitle appears
    setTimeout(() => {
      Animated.timing(subTextOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 800);

    // Progress bar
    setTimeout(() => {
      Animated.timing(progressW, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start();
    }, 600);

    // Version label
    setTimeout(() => {
      Animated.timing(versionOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 1000);

    // Navigate to home
    const timer = setTimeout(() => {
      onDone && onDone();
    }, totalDuration + 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Deep background gradient */}
      <LinearGradient
        colors={['#010C09', '#021510', '#030F0C', '#000806']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Radial glow spot behind letters */}
      <View style={styles.glowSpot} />

      {/* CRT scan line */}
      <Animated.View
        style={[styles.scanLine, { transform: [{ translateY: scanlineY }] }]}
        pointerEvents="none"
      />

      {/* Particle dots */}
      {[...Array(20)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.particle,
            {
              left: `${(i * 17 + 3) % 100}%`,
              top: `${(i * 23 + 7) % 100}%`,
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              opacity: 0.1 + (i % 5) * 0.06,
            },
          ]}
        />
      ))}

      {/* Top HUD label */}
      <Animated.View style={[styles.topHud, { opacity: bgOpacity }]}>
        <Animated.View
          style={[styles.hudLine, { width: lineWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }) }]}
        />
        <Text style={styles.hudText}>SYSTEM_INITIALIZING</Text>
      </Animated.View>

      {/* Main content area */}
      <View style={styles.centerBlock}>
        {/* Speed lines (decorative) */}
        <View style={styles.speedLines} pointerEvents="none">
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={[
                styles.speedLine,
                { top: 10 + i * 14, width: 60 + i * 20, opacity: 0.15 + i * 0.08 },
              ]}
            />
          ))}
        </View>

        {/* FLICKS letters */}
        <View style={styles.lettersRow}>
          {LETTERS.map((char, i) => (
            <AnimatedLetter
              key={char}
              char={char}
              index={i}
              totalLetters={LETTERS.length}
            />
          ))}
        </View>

        {/* Tagline */}
        <Animated.View style={[styles.taglineWrap, { opacity: subTextOpacity }]}>
          <View style={styles.taglineBorder}>
            <Text style={styles.taglineText}>✦  ELEVATE YOUR VISION  ✦</Text>
          </View>
        </Animated.View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressW.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '65%'],
                }),
              },
            ]}
          />
          <LinearGradient
            colors={[COLORS.accent, '#0066FF', 'rgba(0,255,178,0.3)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>

      {/* Bottom HUD */}
      <Animated.View style={[styles.bottomHud, { opacity: versionOpacity }]}>
        <Text style={styles.versionText}>STREAM_PROTOCOL_V4.0</Text>
        <View style={styles.versionLine} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010C09',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowSpot: {
    position: 'absolute',
    width: SW * 1.2,
    height: SH * 0.5,
    top: '25%',
    left: '-10%',
    borderRadius: SW,
    backgroundColor: 'rgba(0,255,178,0.03)',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0,255,178,0.04)',
    zIndex: 1,
  },
  particle: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: COLORS.accent,
  },
  topHud: {
    position: 'absolute',
    top: 60,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hudLine: {
    height: 1,
    backgroundColor: COLORS.accent,
    opacity: 0.6,
  },
  hudText: {
    color: COLORS.accentDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.5,
    opacity: 0.8,
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  speedLines: {
    position: 'absolute',
    left: -SW * 0.35,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  speedLine: {
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
    marginBottom: 4,
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  letterWrap: {
    position: 'relative',
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterGlow: {
    position: 'absolute',
    width: 70,
    height: 110,
    borderRadius: 20,
    opacity: 0.3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 20,
  },
  letter: {
    fontSize: SW < 380 ? 72 : 86,
    fontWeight: '900',
    letterSpacing: -2,
    includeFontPadding: false,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    // 3D illusion via multiple shadows
    textDecorationLine: 'none',
  },
  taglineWrap: {
    marginTop: 28,
  },
  taglineBorder: {
    borderWidth: 1,
    borderColor: 'rgba(0,255,178,0.25)',
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,255,178,0.05)',
  },
  taglineText: {
    color: COLORS.textSub,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  progressTrack: {
    marginTop: 36,
    width: SW * 0.55,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  bottomHud: {
    position: 'absolute',
    bottom: 52,
    right: 28,
    alignItems: 'flex-end',
  },
  versionText: {
    color: COLORS.accentDim,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    opacity: 0.6,
    marginBottom: 4,
  },
  versionLine: {
    width: 60,
    height: 1,
    backgroundColor: COLORS.accentDim,
    opacity: 0.4,
  },
});
