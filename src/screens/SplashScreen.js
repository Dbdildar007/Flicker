// src/screens/SplashScreen.js
import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Easing,
} from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Responsive Scale ───────────────────────────────────────────────────────────
const scale  = (size) => (SW / 390) * size;
const vscale = (size) => (SH / 844) * size;

// ─── Colors ─────────────────────────────────────────────────────────────────────
const TEAL        = '#00C6A7';
const TEAL_BRIGHT = '#00FFD5';
const BLUE        = '#005FFF';
const BLUE_EDGE   = '#003DB2';
const MID_COLOR   = '#0096CC';
const BG          = '#000000';

// ─── F Geometry (all responsive) ───────────────────────────────────────────────
const F_H        = scale(200);   // full height
const F_W        = scale(152);   // bounding box width
const SPINE_W    = scale(44);    // vertical bar width
const TOP_H      = scale(44);    // top crossbar height
const MID_H      = scale(36);    // mid crossbar height
const MID_W      = scale(110);   // mid crossbar width (shorter than top)
const TOP_Y      = 0;            // top crossbar sits at very top
const MID_Y      = scale(84);    // mid crossbar y offset
const CUT_GAP    = scale(5);     // gap between spine and crossbars ("cut" look)

// ─── Animation constants ────────────────────────────────────────────────────────
// Netflix zooms out from ~20x → 1x in ~700ms using a very fast easeOut.
// Total splash: ~1300ms before navigate.
const ZOOM_FROM  = 22;
const ZOOM_DUR   = 700;
const HOLD_DUR   = 400;
const FADE_DUR   = 200;

export default function SplashScreen({ onDone }) {
  const scaleAnim    = useRef(new Animated.Value(ZOOM_FROM)).current;
  const glowOpacity  = useRef(new Animated.Value(0)).current;
  const screenFade   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // ── Zoom out (Netflix-style rapid deceleration) ──
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: ZOOM_DUR,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();

    // ── Glow builds in during second half of zoom ──
    setTimeout(() => {
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: ZOOM_DUR * 0.45,
        useNativeDriver: true,
      }).start();
    }, ZOOM_DUR * 0.42);

    // ── Fade out + navigate ──
    const navTimer = setTimeout(() => {
      Animated.timing(screenFade, {
        toValue: 0,
        duration: FADE_DUR,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        onDone && onDone();
      });
    }, ZOOM_DUR + HOLD_DUR);

    return () => clearTimeout(navTimer);
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: screenFade }]}>
      <StatusBar hidden />

      {/* ── Ambient glow (appears as F lands) ── */}
      <Animated.View
        style={[styles.glow, { opacity: glowOpacity }]}
        pointerEvents="none"
      />

      {/* ══════════════════════════════════════════
          THE F  —  zooms from giant → final size
      ══════════════════════════════════════════ */}
      <Animated.View
        style={[styles.fWrap, { transform: [{ scale: scaleAnim }] }]}
        pointerEvents="none"
      >
        {/* ── Vertical spine (teal with blue left edge) ── */}
        <View style={styles.spine}>
          {/* Blue left-edge accent strip */}
          <View style={styles.spineBlueEdge} />
          {/* White shine */}
          <View style={styles.spineShine} />
        </View>

        {/* ── Top crossbar (blue) ── */}
        <View style={styles.crossbarTop} />

        {/* ── Mid crossbar (teal-blue blend) ── */}
        <View style={styles.crossbarMid} />

        {/* ── Diagonal cut line — the signature slash ── */}
        <View style={styles.cutLine} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── StyleSheet ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Soft teal-blue glow behind the F
  glow: {
    position: 'absolute',
    width:  scale(320),
    height: scale(320),
    borderRadius: scale(160),
    backgroundColor: 'rgba(0,198,167,0.10)',
    shadowColor: TEAL_BRIGHT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: scale(90),
  },

  // Container that receives the scale transform
  fWrap: {
    width:  F_W,
    height: F_H,
  },

  // ── Spine ──────────────────────────────────────────────────────────────────
  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SPINE_W,
    height: F_H,
    backgroundColor: TEAL,
    borderRadius: scale(6),
    overflow: 'hidden',
    shadowColor: TEAL_BRIGHT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: scale(22),
    elevation: 18,
  },

  // Deep blue strip on the left edge of the spine
  spineBlueEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: scale(8),
    height: '100%',
    backgroundColor: BLUE_EDGE,
  },

  // Subtle white shine
  spineShine: {
    position: 'absolute',
    left: scale(10),
    top: scale(8),
    width: scale(5),
    height: F_H - scale(16),
    borderRadius: scale(3),
    backgroundColor: 'rgba(255,255,255,0.13)',
  },

  // ── Top crossbar ───────────────────────────────────────────────────────────
  crossbarTop: {
    position: 'absolute',
    left: SPINE_W + CUT_GAP,
    top: TOP_Y,
    width: F_W - SPINE_W - CUT_GAP,
    height: TOP_H,
    backgroundColor: BLUE,
    borderTopRightRadius: scale(6),
    borderBottomRightRadius: scale(3),
    shadowColor: '#4DA6FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: scale(14),
    elevation: 14,
  },

  // ── Mid crossbar ────────────────────────────────────────────────────────────
  crossbarMid: {
    position: 'absolute',
    left: SPINE_W + CUT_GAP,
    top: MID_Y,
    width: MID_W - SPINE_W - CUT_GAP,
    height: MID_H,
    backgroundColor: MID_COLOR,
    borderTopRightRadius: scale(4),
    borderBottomRightRadius: scale(4),
    shadowColor: TEAL_BRIGHT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: scale(10),
    elevation: 10,
  },

  // ── Diagonal cut / slash across the F ──────────────────────────────────────
  // A thin dark line rotated ~8° creates a "sliced" premium look.
  // Positioned at mid-height, spans the full width.
  cutLine: {
    position: 'absolute',
    left:  -scale(8),
    top:   F_H * 0.47,
    width: F_W + scale(16),
    height: scale(3.5),
    backgroundColor: BG,
    opacity: 0.68,
    transform: [{ rotate: '-8deg' }],
  },
});
