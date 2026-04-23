// src/components/FlicksHeader.js
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, RADIUS } from '../data/theme';

const { width: SW } = Dimensions.get('window');

export default function FlicksHeader({ scrollY, onSearch, onProfile, notifCount = 0 }) {
  // Header bg opacity: 50% transparent initially, 20% transparent when scrolled
  const headerBgOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [0.5, 0.88],
        extrapolate: 'clamp',
      })
    : new Animated.Value(0.88);

  // Border opacity increases while scrolling
  const borderOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [0.08, 0.3],
        extrapolate: 'clamp',
      })
    : new Animated.Value(0.3);

  // Blur intensity increases while scrolling (visual only via opacity)
  const blurOverlay = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [0, 0.15],
        extrapolate: 'clamp',
      })
    : new Animated.Value(0);

  // Logo scale shrinks slightly on scroll
  const logoScale = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 60],
        outputRange: [1, 0.88],
        extrapolate: 'clamp',
      })
    : new Animated.Value(1);

  return (
    <Animated.View
      style={[
        styles.header,
        {
          backgroundColor: headerBgOpacity.interpolate
            ? headerBgOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(3,15,12,0)', 'rgba(3,15,12,1)'],
              })
            : 'rgba(3,15,12,0.88)',
        },
      ]}
    >
      {/* Glass blur overlay */}
      <Animated.View style={[styles.glassOverlay, { opacity: blurOverlay }]} />

      {/* Top edge glow line */}
      <Animated.View style={[styles.topLine, { opacity: borderOpacity }]} />

      {/* Bottom border */}
      <Animated.View style={[styles.bottomBorder, { opacity: borderOpacity }]} />

      <View style={styles.inner}>
        {/* Logo: FLICKS with F in red */}
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }] }]}>
          <Text style={styles.logoF}>F</Text>
          <Text style={styles.logoRest}>LICKS</Text>
        </Animated.View>

        {/* Right actions */}
        <View style={styles.actions}>
          {/* Search */}
          <TouchableOpacity onPress={onSearch} style={styles.iconBtn} activeOpacity={0.7}>
            <LinearGradient
              colors={['rgba(0,255,178,0.12)', 'rgba(0,255,178,0.04)']}
              style={styles.iconBtnGrad}
            >
              <Text style={styles.iconText}>🔍</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Profile */}
          <TouchableOpacity onPress={onProfile} style={styles.profileBtn} activeOpacity={0.8}>
            <LinearGradient
              colors={[COLORS.accent + '40', COLORS.accent + '15']}
              style={styles.profileGrad}
            >
              <Text style={styles.profileIcon}>👤</Text>
            </LinearGradient>
            {notifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifText}>{notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 44,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,255,178,0.02)',
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.accent,
  },
  bottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: COLORS.accent,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoF: {
    color: COLORS.red,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    textShadowColor: COLORS.red,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    // 3D depth effect
    includeFontPadding: false,
  },
  logoRest: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
    includeFontPadding: false,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  iconBtnGrad: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  iconText: {
    fontSize: 16,
  },
  profileBtn: {
    position: 'relative',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.accent + '60',
  },
  profileGrad: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIcon: {
    fontSize: 18,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.bg,
  },
  notifText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
});
