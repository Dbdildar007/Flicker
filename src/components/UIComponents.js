// src/components/UIComponents.js
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, Linking, Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, RADIUS, SHADOW, SPACING } from '../data/theme';

const { width: SW } = Dimensions.get('window');

// ── GlassCard ─────────────────────────────────────────────────────────────
export function GlassCard({ children, style, onPress, borderColor, glowColor, active }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glowAnim, { toValue: active ? 1 : 0, duration: 300, useNativeDriver: false }).start();
  }, [active]);

  const handlePressIn  = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, tension: 300 }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 300 }).start();

  const bColor = borderColor || COLORS.glassBorder;
  const gColor = glowColor   || COLORS.accent;

  const borderColorInterp = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [bColor, gColor],
  });

  const shadowOpacityInterp = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.45],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPress ? handlePressIn : undefined}
      onPressOut={onPress ? handlePressOut : undefined}
      activeOpacity={1}
      disabled={!onPress}
    >
      <Animated.View
        style={[
          styles.glassCard,
          {
            transform: [{ scale: scaleAnim }],
            borderColor: borderColorInterp,
            shadowColor: gColor,
            shadowOpacity: shadowOpacityInterp,
          },
          style,
        ]}
      >
        <LinearGradient
          colors={['rgba(0,255,178,0.06)', 'rgba(0,20,15,0.85)', 'rgba(0,0,0,0.4)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── SkeletonBox ────────────────────────────────────────────────────────────
export function SkeletonBox({ width = '100%', height = 16, style, borderRadius = RADIUS.md }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: COLORS.bg3, opacity: anim },
        style,
      ]}
    />
  );
}

// ── Skeleton Card ──────────────────────────────────────────────────────────
export function SkeletonCard({ width = 140, height = 200 }) {
  return (
    <View style={{ marginRight: 12 }}>
      <SkeletonBox width={width} height={height} borderRadius={RADIUS.lg} />
      <SkeletonBox width={width * 0.7} height={10} style={{ marginTop: 8 }} />
      <SkeletonBox width={width * 0.4} height={8} style={{ marginTop: 4 }} />
    </View>
  );
}

// ── Rating Stars ────────────────────────────────────────────────────────────
export function RatingStars({ rating = 0, max = 5, size = 14, onRate }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {Array.from({ length: max }).map((_, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onRate && onRate(i + 1)}
          disabled={!onRate}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: size, color: i < rating ? COLORS.gold : 'rgba(255,215,0,0.25)' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── NoInternet ─────────────────────────────────────────────────────────────
export function NoInternet({ onRetry }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const openSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() =>
        Linking.openSettings()
      );
    } else {
      Linking.openURL('App-Prefs:WIFI').catch(() => Linking.openSettings());
    }
  };

  return (
    <View style={niStyles.container}>
      <LinearGradient
        colors={['#010C09', '#021510', '#030F0C']}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[niStyles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
        <LinearGradient
          colors={['rgba(255,45,85,0.15)', 'rgba(255,45,85,0.05)']}
          style={niStyles.iconBg}
        />
        <Text style={niStyles.icon}>📡</Text>
      </Animated.View>
      <Text style={niStyles.title}>No Connection</Text>
      <Text style={niStyles.subtitle}>
        Check your internet data or Wi-Fi connection.{'\n'}
        Streaming requires an active connection.
      </Text>
      <View style={niStyles.btnRow}>
        <TouchableOpacity onPress={onRetry} style={niStyles.retryBtn} activeOpacity={0.8}>
          <LinearGradient colors={[COLORS.accent, COLORS.accentDim]} style={niStyles.retryGrad}>
            <Text style={niStyles.retryText}>↻  Retry</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={openSettings} style={niStyles.settingsBtn} activeOpacity={0.8}>
          <Text style={niStyles.settingsText}>⚙  Open Settings</Text>
        </TouchableOpacity>
      </View>
      <Text style={niStyles.hint}>
        💡 Tip: Turn on mobile data or connect to Wi-Fi
      </Text>
    </View>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
export function Toast({ message }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (message) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 120 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [message]);

  if (!message) return null;
  return (
    <Animated.View
      style={[
        toastStyles.container,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['rgba(0,255,178,0.18)', 'rgba(0,255,178,0.06)']}
        style={toastStyles.bg}
      />
      <Text style={toastStyles.text}>{message}</Text>
    </Animated.View>
  );
}

// ── RatingBadge ──────────────────────────────────────────────────────────
export function RatingBadge({ rating }) {
  const color = rating >= 8 ? '#00FF94' : rating >= 6 ? COLORS.gold : COLORS.error;
  return (
    <View style={[rbStyles.badge, { backgroundColor: color + '22', borderColor: color + '66' }]}>
      <Text style={[rbStyles.text, { color }]}>{Number(rating).toFixed(1)}</Text>
    </View>
  );
}

// ── SeriesTag ──────────────────────────────────────────────────────────────
export function SeriesTag() {
  return (
    <View style={stStyles.tag}>
      <LinearGradient
        colors={['rgba(0,255,178,0.25)', 'rgba(0,255,178,0.08)']}
        style={StyleSheet.absoluteFill}
      />
      <Text style={stStyles.text}>SERIES</Text>
    </View>
  );
}

// ── GenreTag ──────────────────────────────────────────────────────────────
export function GenreTag({ genre }) {
  return (
    <View style={gtStyles.tag}>
      <Text style={gtStyles.text}>{genre}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 10,
  },
});

const niStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  iconBg: { ...StyleSheet.absoluteFillObject, borderRadius: 50 },
  icon: { fontSize: 48 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 12, letterSpacing: 0.5 },
  subtitle: { color: COLORS.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  btnRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  retryBtn: { borderRadius: RADIUS.full, overflow: 'hidden' },
  retryGrad: { paddingHorizontal: 28, paddingVertical: 13 },
  retryText: { color: '#000', fontWeight: '800', fontSize: 14 },
  settingsBtn: { borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: RADIUS.full, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: COLORS.glass },
  settingsText: { color: COLORS.accent, fontWeight: '700', fontSize: 13 },
  hint: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
});

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    zIndex: 9999,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    overflow: 'hidden',
    maxWidth: '80%',
  },
  bg: { ...StyleSheet.absoluteFillObject },
  text: { color: COLORS.accent, fontWeight: '700', fontSize: 13, paddingHorizontal: 20, paddingVertical: 10 },
});

const rbStyles = StyleSheet.create({
  badge: { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: 11, fontWeight: '800' },
});

const stStyles = StyleSheet.create({
  tag: {
    position: 'absolute', top: 8, left: 8,
    borderRadius: 4, borderWidth: 1, borderColor: COLORS.glassBorder,
    paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden',
  },
  text: { color: COLORS.accent, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
});

const gtStyles = StyleSheet.create({
  tag: {
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(0,255,178,0.2)',
    backgroundColor: 'rgba(0,255,178,0.08)', paddingHorizontal: 8, paddingVertical: 3,
  },
  text: { color: COLORS.accentDim, fontSize: 10, fontWeight: '600' },
});
