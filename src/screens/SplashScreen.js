// src/screens/SplashScreen.js
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  red:       '#E50914',
  redDeep:   '#B20710',
  redGlow:   'rgba(229,9,20,0.35)',
  redFaint:  'rgba(229,9,20,0.08)',
  white:     '#FFFFFF',
  offWhite:  '#E5E5E5',
  silver:    '#A3A3A3',
  dim:       'rgba(255,255,255,0.18)',
  bg:        '#000000',
};

// ─── Responsive Scale ───────────────────────────────────────────────────────────
const BASE = 390; // iPhone 14 Pro base width
const scale  = (size) => (SW / BASE) * size;
const vscale = (size) => (SH / 844) * size;

// ─── Logo Letter Component ──────────────────────────────────────────────────────
function LogoLetter({ char, index, totalLetters }) {
  const STAGGER    = 60;
  const ENTRY_DUR  = 500;
  const HOLD_DELAY = 300;
  const EXIT_DUR   = 220;

  // Animated values
  const opacity    = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.4)).current;
  const translateY = useRef(new Animated.Value(scale(40))).current;
  const exitX      = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const entryDelay = index * STAGGER;

    // All letters stagger-reveal, then exit together after hold
    const exitDelay = entryDelay + ENTRY_DUR + HOLD_DELAY;
    const exitSlideDir = (index / (totalLetters - 1) - 0.5) * SW * 2.4;

    Animated.sequence([
      Animated.delay(entryDelay),
      // ENTRY: fade + scale up + slide up
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: ENTRY_DUR * 0.5,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: ENTRY_DUR,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: ENTRY_DUR,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(ENTRY_DUR * 0.4),
          Animated.timing(glowOpacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    // Exit: fan-out burst after hold
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(exitX, {
          toValue: exitSlideDir,
          duration: EXIT_DUR,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: EXIT_DUR * 0.8,
          delay: EXIT_DUR * 0.1,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: EXIT_DUR * 0.6,
          useNativeDriver: true,
        }),
      ]).start();
    }, exitDelay);
  }, []);

  const isFirst = index === 0;
  const letterFontSize = scale(SW < 360 ? 78 : SW < 430 ? 94 : 104);

  return (
    <Animated.View
      style={[
        styles.letterWrap,
        {
          transform: [
            { translateY },
            { translateX: exitX },
            { scale: scaleAnim },
          ],
          opacity: Animated.multiply(opacity, exitOpacity),
        },
      ]}
    >
      {/* Red glow behind first letter only, softer glow for rest */}
      <Animated.View
        style={[
          styles.letterGlow,
          {
            opacity: glowOpacity,
            backgroundColor: isFirst ? C.redGlow : 'rgba(255,255,255,0.06)',
            width: scale(isFirst ? 90 : 70),
            height: scale(isFirst ? 120 : 110),
            shadowColor: isFirst ? C.red : 'transparent',
          },
        ]}
      />
      <Text
        style={[
          styles.letterText,
          {
            fontSize: letterFontSize,
            color: isFirst ? C.red : C.white,
            textShadowColor: isFirst ? C.red : 'rgba(255,255,255,0.15)',
            textShadowRadius: isFirst ? 24 : 8,
          },
        ]}
        allowFontScaling={false}
      >
        {char}
      </Text>
    </Animated.View>
  );
}

// ─── Main Splash Screen ─────────────────────────────────────────────────────────
export default function SplashScreen({ onDone }) {
  // Phase timings (ms)
  const LOGO_STAGGER   = 60;
  const LOGO_ENTRY_DUR = 500;
  const LOGO_HOLD      = 300;
  const LOGO_EXIT_DUR  = 220;
  const LOGO_LAST_ENTRY = (5 * LOGO_STAGGER) + LOGO_ENTRY_DUR;
  const LOGO_ALL_DONE  = LOGO_LAST_ENTRY + LOGO_HOLD + LOGO_EXIT_DUR;

  // After logo exits → Netflix-style F brandmark reveal
  const BRAND_START    = LOGO_ALL_DONE + 200;
  const BRAND_DUR      = 320;
  const HOLD_TOTAL     = BRAND_START + BRAND_DUR + 900;

  // Animated values – global scene
  const bgOpacity      = useRef(new Animated.Value(0)).current;
  const brandScale     = useRef(new Animated.Value(0.7)).current;
  const brandOpacity   = useRef(new Animated.Value(0)).current;
  const brandGlow      = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY       = useRef(new Animated.Value(scale(12))).current;
  const progressAnim   = useRef(new Animated.Value(0)).current;
  const fadeOut        = useRef(new Animated.Value(1)).current;

  // Vignette pulse (subtle breathing)
  const vignettePulse  = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Scene fade-in
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // Vignette pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(vignettePulse, {
          toValue: 0.85,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(vignettePulse, {
          toValue: 0.6,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Progress bar fills over full duration
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: HOLD_TOTAL - 200,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();

    // Brand mark reveal after logo exits
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(brandScale, {
          toValue: 1,
          speed: 14,
          bounciness: 6,
          useNativeDriver: true,
        }),
        Animated.timing(brandOpacity, {
          toValue: 1,
          duration: BRAND_DUR,
          useNativeDriver: true,
        }),
        Animated.timing(brandGlow, {
          toValue: 1,
          duration: BRAND_DUR + 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Tagline enters after brand settles
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
          Animated.timing(taglineY, {
            toValue: 0,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, BRAND_START);

    // Screen fade-out before navigation
    const fadeTimer = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        onDone && onDone();
      });
    }, HOLD_TOTAL);

    return () => clearTimeout(fadeTimer);
  }, []);

  const LETTERS = ['F', 'L', 'I', 'C', 'K', 'S'];

  return (
    <Animated.View style={[styles.root, { opacity: fadeOut }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={false} />

      {/* ── Base black background ── */}
      <View style={StyleSheet.absoluteFill} />

      {/* ── Deep gradient – subtle reddish tint at center ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
        <LinearGradient
          colors={['#0a0000', '#000000', '#000000', '#000000']}
          locations={[0, 0.25, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Radial vignette overlay ── */}
      <Animated.View
        style={[
          styles.vignette,
          {
            opacity: vignettePulse,
          },
        ]}
        pointerEvents="none"
      />

      {/* ── Red center bloom (behind logo area) ── */}
      <Animated.View
        style={[
          styles.centerBloom,
          { opacity: Animated.multiply(bgOpacity, 0.18) },
        ]}
        pointerEvents="none"
      />

      {/* ════════════════════════════════════════════
          PHASE 1 — FLICKS letter burst
      ═════════════════════════════════════════════ */}
      <View style={styles.lettersContainer} pointerEvents="none">
        {LETTERS.map((char, i) => (
          <LogoLetter
            key={char}
            char={char}
            index={i}
            totalLetters={LETTERS.length}
          />
        ))}
      </View>

      {/* ════════════════════════════════════════════
          PHASE 2 — Netflix-style bold F brandmark
      ═════════════════════════════════════════════ */}
      <Animated.View
        style={[
          styles.brandmarkWrap,
          {
            transform: [{ scale: brandScale }],
            opacity: brandOpacity,
          },
        ]}
        pointerEvents="none"
      >
        {/* Outer glow ring */}
        <Animated.View
          style={[
            styles.brandGlowRing,
            { opacity: brandGlow },
          ]}
        />

        {/* The Netflix-style tall "F" pillar block */}
        <View style={styles.brandBlock}>
          {/* Full-height red pillar */}
          <LinearGradient
            colors={[C.redDeep, C.red, '#FF1A25']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.brandPillar}
          />
          {/* F crossbar top */}
          <View style={[styles.brandCrossbar, styles.brandCrossbarTop]} />
          {/* F crossbar mid */}
          <View style={[styles.brandCrossbar, styles.brandCrossbarMid]} />
          {/* Subtle shine line */}
          <View style={styles.brandShine} />
        </View>

        {/* FLICKS wordmark below the icon */}
        <Text style={styles.wordmark} allowFontScaling={false}>
          FLICKS
        </Text>
      </Animated.View>

      {/* ── Tagline ── */}
      <Animated.View
        style={[
          styles.taglineWrap,
          {
            opacity: taglineOpacity,
            transform: [{ translateY: taglineY }],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.tagline} allowFontScaling={false}>
          WATCH ANYWHERE. ANYTIME.
        </Text>
      </Animated.View>

      {/* ════════════════════════════════════════════
          Bottom loader — thin Netflix-style bar
      ═════════════════════════════════════════════ */}
      <View style={styles.loaderTrack} pointerEvents="none">
        <Animated.View
          style={[
            styles.loaderFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          {/* Bright leading edge shimmer */}
          <View style={styles.loaderShimmer} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const BRAND_PILLAR_W  = scale(80);
const BRAND_PILLAR_H  = scale(170);
const CROSSBAR_H      = scale(26);
const CROSSBAR_W_TOP  = scale(130);
const CROSSBAR_W_MID  = scale(100);
const CROSSBAR_TOP_Y  = scale(28);
const CROSSBAR_MID_Y  = scale(88);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Background effects ──────────────────────────────────────────────────────
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  centerBloom: {
    position: 'absolute',
    width: SW * 1.1,
    height: SH * 0.55,
    top: '22%',
    left: SW * -0.05,
    borderRadius: SW,
    backgroundColor: C.red,
  },

  // ── Phase 1 – Letters ───────────────────────────────────────────────────────
  lettersContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: SW,
  },
  letterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: scale(1),
  },
  letterGlow: {
    position: 'absolute',
    borderRadius: scale(20),
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: scale(40),
    elevation: 30,
  },
  letterText: {
    fontWeight: '900',
    letterSpacing: scale(-3),
    includeFontPadding: false,
    textShadowOffset: { width: 0, height: 0 },
  },

  // ── Phase 2 – Brand mark ────────────────────────────────────────────────────
  brandmarkWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGlowRing: {
    position: 'absolute',
    width: BRAND_PILLAR_W * 3.2,
    height: BRAND_PILLAR_H * 1.6,
    borderRadius: BRAND_PILLAR_W * 2,
    backgroundColor: C.redGlow,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: scale(60),
    elevation: 40,
  },
  brandBlock: {
    width: CROSSBAR_W_TOP,
    height: BRAND_PILLAR_H,
    position: 'relative',
    overflow: 'visible',
  },

  // Red vertical pillar (the spine of the "F")
  brandPillar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BRAND_PILLAR_W,
    height: BRAND_PILLAR_H,
    borderRadius: scale(4),
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: scale(20),
    elevation: 20,
  },

  // F crossbars (also red rectangles extending right)
  brandCrossbar: {
    position: 'absolute',
    left: 0,
    height: CROSSBAR_H,
    borderRadius: scale(3),
    backgroundColor: C.red,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: scale(8),
  },
  brandCrossbarTop: {
    top: CROSSBAR_TOP_Y,
    width: CROSSBAR_W_TOP,
  },
  brandCrossbarMid: {
    top: CROSSBAR_MID_Y,
    width: CROSSBAR_W_MID,
  },

  // Subtle white shine line on the pillar edge
  brandShine: {
    position: 'absolute',
    left: scale(3),
    top: scale(6),
    width: scale(4),
    height: BRAND_PILLAR_H - scale(12),
    borderRadius: scale(2),
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // FLICKS wordmark below the icon
  wordmark: {
    marginTop: scale(20),
    color: C.white,
    fontSize: scale(22),
    fontWeight: '700',
    letterSpacing: scale(12),
    textTransform: 'uppercase',
    opacity: 0.9,
  },

  // ── Tagline ─────────────────────────────────────────────────────────────────
  taglineWrap: {
    position: 'absolute',
    bottom: vscale(160),
    alignItems: 'center',
  },
  tagline: {
    color: C.silver,
    fontSize: scale(11),
    fontWeight: '600',
    letterSpacing: scale(3.5),
    textTransform: 'uppercase',
    opacity: 0.75,
  },

  // ── Bottom loader ────────────────────────────────────────────────────────────
  loaderTrack: {
    position: 'absolute',
    bottom: vscale(72),
    left: SW * 0.1,
    right: SW * 0.1,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  loaderFill: {
    height: '100%',
    backgroundColor: C.red,
    borderRadius: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  loaderShimmer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: scale(24),
    backgroundColor: 'rgba(255,200,200,0.6)',
    borderRadius: 1,
  },
});
