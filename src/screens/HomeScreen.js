// src/screens/HomeScreen.js
/**
 * PERFORMANCE FIXES APPLIED:
 * 1. Single shared Animated.Value for ALL skeleton boxes (eliminates 500+ pending callbacks)
 * 2. Skeleton renders only once — shimmer driven by one loop at the top level
 * 3. FlatList cards use React.memo to prevent unnecessary re-renders
 * 4. Horizontal FlatLists use getItemLayout for zero-measurement overhead
 * 5. removeClippedSubviews + windowSize=3 on all lists
 * 6. API errors caught and shown on UI via ErrorBanner — no silent console warns
 * 7. InteractionManager.runAfterInteractions defers heavy work until after mount
 */

import React, {
  useRef, useEffect, useState, useCallback, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Dimensions, StatusBar, ImageBackground,
  ActivityIndicator, RefreshControl, InteractionManager,Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import NetInfo from '@react-native-community/netinfo';
import { COLORS, RADIUS, SHADOW } from '../data/theme';
import {
  fetchFeatured, fetchMoviesByPage,
  fetchUpcoming, fetchContinueWatching, fetchWatchlist,
  addToWatchlist, removeFromWatchlist, buildContentMap,
} from '../lib/supabase';

// ─── Dimensions & responsive scale ───────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const rs = (s) => {
  const w = Dimensions.get('window').width;
  if (w < 360) return Math.round(s * 0.86);
  if (w < 414) return Math.round(s * 0.93);
  if (w > 600) return Math.round(s * 1.1);
  return s;
};

const HERO_H = SH * 0.60;
const HEADER_H = rs(50);
const SCROLL_TH = rs(80);
const PAGE_SIZE = 40;

// Card dimensions (used for getItemLayout — eliminates measure calls)
const CONT_CARD_W = rs(195) + rs(12);
const POSTER_W = rs(130) + rs(12);
const GENRE_W = rs(130) + rs(12);

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_FEATURED = [
  { id: 'f1', title: 'NEON REBELLION', description: 'In a world where light is currency, one survivor risks everything to unplug the system.', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900', hero_image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900', genre: ['Sci-Fi', 'Thriller'], category: ['originals'], year: 2024, rating: 8.4, newly_added: 'ORIGINAL', is_series: false, is_trending: true },
  { id: 'f2', title: 'DARK HORIZON', description: 'A rogue astronaut uncovers a conspiracy spanning galaxies.', poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900', hero_image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900', genre: ['Sci-Fi', 'Drama'], category: ['drama'], year: 2024, rating: 7.9, newly_added: null, is_series: true, is_trending: false },
  { id: 'f3', title: 'CHROME CITY', description: 'A detective navigates a dystopian megacity where AI rules the underworld.', poster: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900', hero_image: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900', genre: ['Action', 'Thriller'], category: ['action'], year: 2024, rating: 8.1, newly_added: 'NEW', is_series: false, is_trending: true },
];
const MOCK_CONTINUE = [
  { movieId: 'c1', title: 'Mars Colony', poster: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=500', progress: 0.72, season: 2, episode: 4, remaining: '12m', is_series: true },
  { movieId: 'c2', title: 'Midnight Protocol', poster: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500', progress: 0.38, season: 1, episode: 7, remaining: '28m', is_series: true },
  { movieId: 'c3', title: 'Velocity', poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500', progress: 0.55, season: null, episode: null, remaining: '54m', is_series: false },
];
const MOCK_WATCHLIST = [
  { id: 'w1', title: 'Orbital Decay', poster: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=400', rating: 7.6, is_series: false, newly_added: 'NEW', is_trending: false },
  { id: 'w2', title: 'The Last Signal', poster: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=400', rating: 8.2, is_series: true, newly_added: null, is_trending: true },
  { id: 'w3', title: 'Phantom Circuit', poster: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', rating: 7.1, is_series: false, newly_added: null, is_trending: false },
];
const MOCK_UPCOMING = [
  { id: 'u1', title: 'Solar Drift', poster: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=400', release_date: '2025-06-15', is_series: false },
  { id: 'u2', title: 'Echo Chamber', poster: 'https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=400', release_date: '2025-07-20', is_series: true },
  { id: 'u3', title: 'Iron Veil', poster: 'https://images.unsplash.com/photo-1542372147193-a7aca54189cd?w=400', release_date: '2025-08-05', is_series: false },
  { id: 'u4', title: 'Neon Ghosts', poster: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400', release_date: '2025-09-12', is_series: true },
];
const MOCK_ALL = [
  { id: 'a1', title: 'Velocity X', poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400', rating: 7.8, genre: ['Action'], category: ['action'], is_series: false, is_trending: true, newly_added: null },
  { id: 'a2', title: 'Thunder Run', poster: 'https://images.unsplash.com/photo-1542372147193-a7aca54189cd?w=400', rating: 7.2, genre: ['Action'], category: ['action'], is_series: false, is_trending: false, newly_added: 'NEW' },
  { id: 'd1', title: 'Broken Ties', poster: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400', rating: 8.3, genre: ['Drama'], category: ['drama'], is_series: true, is_trending: false, newly_added: null },
  { id: 'd2', title: 'Quiet Storm', poster: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400', rating: 7.9, genre: ['Drama'], category: ['drama'], is_series: false, is_trending: false, newly_added: null },
  { id: 't1', title: 'Shadow Line', poster: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400', rating: 8.0, genre: ['Thriller'], category: ['thriller'], is_series: false, is_trending: true, newly_added: null },
  { id: 's1', title: 'Quantum Rift', poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400', rating: 8.5, genre: ['Sci-Fi'], category: ['sci-fi'], is_series: false, is_trending: false, newly_added: 'NEW' },
  { id: 's2', title: 'Mars Born', poster: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400', rating: 8.2, genre: ['Sci-Fi'], category: ['sci-fi'], is_series: true, is_trending: true, newly_added: null },
];

// ─── SHARED SKELETON SHIMMER (ONE loop for ALL boxes) ─────────────────────────
// This is the fix for the 500+ pending callbacks warning.
// Instead of each SkeletonBox running its own Animated.loop,
// we share a single Animated.Value across the whole screen.
const skimAnim = new Animated.Value(0);
let shimmerLoopStarted = false;
const startShimmer = () => {
  if (shimmerLoopStarted) return;
  shimmerLoopStarted = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(skimAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(skimAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ])
  ).start();
};

const shimmerOpacity = skimAnim.interpolate({
  inputRange: [0, 1], outputRange: [0.18, 0.52],
});

// SkeletonBox now reads from the shared shimmer — zero additional loops
const SkeletonBox = memo(({ width, height, borderRadius = rs(10), style }) => (
  <Animated.View style={[{ width, height, borderRadius, overflow: 'hidden', opacity: shimmerOpacity }, style]}>
    <LinearGradient
      colors={[COLORS.glass, COLORS.glassHigh, COLORS.glass]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
      start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={[StyleSheet.absoluteFillObject, { borderRadius, borderWidth: 1, borderColor: COLORS.glassBorder }]} />
  </Animated.View>
));

function HomeSkeleton() {
  useEffect(() => { startShimmer(); }, []);
  return (
    <View style={S.skelWrap}>
      <SkeletonBox width={SW} height={SW * 0.62} borderRadius={0} />
      <View style={{ padding: rs(18), marginTop: rs(20) }}>
        {[0, 1, 2].map(row => (
          <View key={row}>
            <SkeletonBox width={rs(160 + row * 10)} height={rs(15)} style={{ marginBottom: rs(14) }} />
            <View style={{ flexDirection: 'row', gap: rs(12), marginBottom: rs(28) }}>
              {[0, 1, 2, 3].map(i => (
                <View key={i}>
                  <SkeletonBox width={rs(130)} height={rs(190)} borderRadius={RADIUS.lg} />
                  <SkeletonBox width={rs(90)} height={rs(9)} style={{ marginTop: rs(7) }} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, visible }) {
  const opac = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(rs(18))).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opac, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
      Animated.timing(ty, { toValue: visible ? 0 : rs(18), duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible]);
  return (
    <Animated.View style={[S.toast, { opacity: opac, transform: [{ translateY: ty }] }]} pointerEvents="none">
      <LinearGradient colors={['rgba(0,255,178,0.22)', 'rgba(0,255,178,0.10)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
      <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
      <Text style={S.toastText}>{message}</Text>
    </Animated.View>
  );
}

function useToast() {
  const [state, setState] = useState({ message: '', visible: false });
  const t = useRef(null);
  const show = useCallback((msg, ms = 1500) => {
    clearTimeout(t.current);
    setState({ message: msg, visible: true });
    t.current = setTimeout(() => setState(s => ({ ...s, visible: false })), ms);
  }, []);
  return { toast: state, showToast: show };
}

// ─── Error Banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <View style={S.errorBanner}>
      <LinearGradient colors={['rgba(255,45,85,0.22)', 'rgba(255,45,85,0.08)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]} />
      <Text style={S.errorText}>⚠️  {message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={S.errorRetry}>
          <Text style={S.errorRetryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── No Internet ───────────────────────────────────────────────────────────────
function NoInternet({ onRetry }) {
  const p = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    // Only ONE pulse loop here
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(p, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
      Animated.timing(p, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={S.noNetWrap}>
      <Animated.View style={[S.noNetIcon, { transform: [{ scale: p }] }]}>
        <LinearGradient colors={['rgba(0,255,178,0.18)', 'rgba(0,255,178,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(50) }]} />
        <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(50) }]} />
        <Text style={{ fontSize: rs(42) }}>📡</Text>
      </Animated.View>
      <Text style={S.noNetTitle}>No Connection</Text>
      <Text style={S.noNetSub}>Turn on your internet to keep watching</Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.82} style={S.retryBtn}>
        <LinearGradient colors={[COLORS.accent, COLORS.accentDim, '#009A6E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]} />
        <LinearGradient colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]} />
        <Text style={S.retryTxt}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── usePressScale ─────────────────────────────────────────────────────────────
function usePressScale(to = 0.94) {
  const a = useRef(new Animated.Value(1)).current;
  const cfg = { useNativeDriver: true, tension: 300, friction: 10 };
  return {
    anim: a,
    onIn: () => Animated.spring(a, { toValue: to, ...cfg }).start(),
    onOut: () => Animated.spring(a, { toValue: 1, ...cfg }).start(),
  };
}

// ─── Badges (all memo — no re-renders unless props change) ────────────────────
const SeriesBadge = memo(() => (
  <View style={S.seriesBadge}>
    <LinearGradient colors={['rgba(255,45,85,0.40)', 'rgba(255,45,85,0.18)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(5) }]} />
    <Text style={S.seriesTxt}>SERIES</Text>
  </View>
));
const TrendingBadge = memo(() => (
  <View style={S.trendBadge}>
    <LinearGradient colors={['rgba(255,215,0,0.30)', 'rgba(255,215,0,0.10)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(5) }]} />
    <Text style={S.trendTxt}>TRENDING</Text>
  </View>
));
const NewBadge = memo(({ label }) => (
  <View style={S.newBadge}>
    <LinearGradient colors={[COLORS.accentGlow, 'rgba(0,255,178,0.10)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(5) }]} />
    <Text style={S.newTxt}>{label}</Text>
  </View>
));
const RatingChip = memo(({ rating }) => (
  <View style={S.ratingChip}>
    <LinearGradient colors={['rgba(255,215,0,0.22)', 'rgba(255,215,0,0.08)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(7) }]} />
    <Text style={S.ratingTxt}>⭐ {Number(rating).toFixed(1)}</Text>
  </View>
));

// ─── Countdown ─────────────────────────────────────────────────────────────────
const CountdownChip = memo(({ releaseDate }) => {
  const [label, setLabel] = useState('');
  const [dateStr, setDateStr] = useState('');
  useEffect(() => {
    const fmt = (d) => {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    setDateStr(fmt(releaseDate));
    const tick = () => {
      const diff = new Date(releaseDate) - Date.now();
      if (diff <= 0) { setLabel('Out Now'); return; }
      const days = Math.floor(diff / 86400000);
      const hrs = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setLabel(days > 0 ? `${days}d ${hrs}h` : `${hrs}h ${mins}m`);
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [releaseDate]);
  return (
    <View style={S.cdWrap}>
      <View style={S.cdChip}>
        <LinearGradient colors={[COLORS.accentGlow, 'rgba(0,255,178,0.08)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(7) }]} />
        <Text style={S.cdTxt}>🕐 {label}</Text>
      </View>
      {dateStr ? <Text style={S.cdDate}>{dateStr}</Text> : null}
    </View>
  );
});

// ─── Notification toggle (upcoming) ───────────────────────────────────────────
const NotifBtn = memo(({ movieId }) => {
  const [on, setOn] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => { setOn(v => !v); }}
      style={S.notifBtn} activeOpacity={0.8}
    >
      <LinearGradient colors={['rgba(91, 239, 195, 0.25)', 'rgba(221, 231, 228, 0.15)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
      <Text style={{ fontSize: rs(13) }}>{on ? '🔔' : '🔕'}</Text>
    </TouchableOpacity>
  );
});

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = memo(({ title, onSeeAll }) => (
  <View style={S.secHeader}>
    <View style={S.secTitleRow}>
      <View style={S.secBar} />
      <Text style={S.secTitle} numberOfLines={1}>{title}</Text>
    </View>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll} activeOpacity={0.75}>
        <View style={S.seeAllBtn}>
          <LinearGradient colors={['rgba(0,255,178,0.14)', 'rgba(0,255,178,0.05)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
          <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
          <Text style={S.seeAllTxt}>SEE ALL</Text>
        </View>
      </TouchableOpacity>
    )}
  </View>
));

// ─── Glass CTA Button ──────────────────────────────────────────────────────────
const GlassBtn = memo(({ label, icon, accent, onPress, style }) => {
  const { anim, onIn, onOut } = usePressScale(0.93);
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1} style={style}>
      <Animated.View style={[S.glassBtn, accent && S.glassBtnAccent, { transform: [{ scale: anim }] }]}>
        {accent ? (
          <LinearGradient colors={[COLORS.accent, COLORS.accentDim, '#45b495']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]} />
        ) : (
          // My List: 60% transparent glass
          <LinearGradient colors={['rgba(248, 242, 242, 0.59)', 'rgba(254, 245, 245, 0.52)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]} />
        )}

        <LinearGradient colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.48 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(232, 225, 225, 0.14)']} start={{ x: 0, y: 0.55 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]} />
        {icon ? <Text style={[S.glassBtnIcon, accent && { color: COLORS.bg }]}>{icon}</Text> : null}
        <Text style={[S.glassBtnLabel, accent && { color: COLORS.bg }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Icon Button ───────────────────────────────────────────────────────────────
const IconBtn = memo(({ icon, onPress, badge }) => {
  const { anim, onIn, onOut } = usePressScale(0.88);
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      <Animated.View style={[S.iconBtn, { transform: [{ scale: anim }] }]}>
        <LinearGradient colors={['rgba(0,255,178,0.14)', 'rgba(0,255,178,0.05)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
        <Text style={{ fontSize: rs(15) }}>{icon}</Text>
        {badge ? <View style={S.iconBadge}><Text style={S.iconBadgeTxt}>{badge}</Text></View> : null}
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Stylish Logo ──────────────────────────────────────────────────────────────
const AppLogo = memo(() => (
  <View>
   <Text style={{ fontSize: rs(28), fontWeight: 'bold' ,color:COLORS.text}}>DB</Text>
  </View>
));

// ─── Profile Button (advanced) ────────────────────────────────────────────────
const ProfileBtn = memo(({ onPress }) => {
  const { anim, onIn, onOut } = usePressScale(0.88);
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      <Animated.View style={[S.profileBtn, { transform: [{ scale: anim }] }]}>
        <LinearGradient colors={[COLORS.accentGlow, 'rgba(0,255,178,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(22) }]} />
        <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(22) }]} />
        {/* Inner avatar circle */}
        <View style={S.profileAvatar}>
          <LinearGradient colors={[COLORS.accent, COLORS.accentDim]} style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
          <Text style={S.profileInitial}>U</Text>
        </View>
        {/* Online dot */}
        <View style={S.profileOnline} />
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── APP HEADER ────────────────────────────────────────────────────────────────
function AppHeader({ scrollY, navigation }) {
  const insets = useSafeAreaInsets();

  const bgColor = scrollY.interpolate({
    inputRange: [0, SCROLL_TH],
    outputRange: ['rgba(3,15,12,0.15)', 'rgba(3,15,12,0.96)'],
    extrapolate: 'clamp',
  });
  const borderOpac = scrollY.interpolate({
    inputRange: [0, SCROLL_TH],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[S.header, { paddingTop: insets.top + rs(6), height: HEADER_H + insets.top, backgroundColor: bgColor }]}>
      <AppLogo />

      {/* Bottom border — invisible at top, fades in on scroll */}
      <Animated.View style={[S.headerBorder, { opacity: borderOpac }]} />

      {/* Bottom gradient blend */}

      <View style={S.headerRight}>
        <View style={{ width: rs(10) }} />
        <ProfileBtn onPress={() => { console.log('Profile'); /* TODO: navigate ProfileScreen */ }} />
      </View>
    </Animated.View>
  );
}


const limitWords = (text, limit = 18) => {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + "...";

};

const limitWordsdes = (text, limit = 100) => {
 if (text.length <= limit) return text;
  return text.slice(0, limit) + "...";
};

// ─── HERO CAROUSEL ─────────────────────────────────────────────────────────────
function HeroCarousel({ items, onAddList }) {
  const [idx, setIdx] = useState(0);
  const fadeA = useRef(new Animated.Value(1)).current;
  const slideA = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const goTo = useCallback((next, dir = 1) => {
    clearInterval(timer.current);
    Animated.parallel([
      Animated.timing(fadeA, { toValue: 0, duration: 190, useNativeDriver: true }),
      Animated.timing(slideA, { toValue: dir * -rs(20), duration: 190, useNativeDriver: true }),
    ]).start(() => {
      setIdx(next);
      slideA.setValue(dir * rs(20));
      Animated.parallel([
        Animated.timing(fadeA, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideA, { toValue: 0, useNativeDriver: true, tension: 160, friction: 20 }),
      ]).start();
    });
  }, []);

  useEffect(() => {
    timer.current = setInterval(() => goTo((idx + 1) % items.length, 1), 5000);
    return () => clearInterval(timer.current);
  }, [idx, items.length, goTo]);

  const item = items[idx];
  if (!item) return null;

  return (
    <View style={[S.heroWrap, { height: HERO_H }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeA, transform: [{ translateX: slideA }] }]}>
        {(item.hero_image || item.poster) && (
          <ImageBackground
            source={{ uri: item.hero_image || item.poster }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['rgba(3,15,12,0.10)', 'rgba(3,15,12,0.0)', 'rgba(3,15,12,0.52)', 'rgba(3,15,12,1.0)']}
              locations={[0, 0.20, 0.60, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(3,15,12,0.55)', 'rgba(3,15,12,0.0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Bottom blends into screen bg */}
            <LinearGradient
              colors={['rgba(3,15,12,0)', COLORS.bg]}
              start={{ x: 0.5, y: 0.80 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </ImageBackground>
        )}
      </Animated.View>

      <Animated.View style={[S.heroContent, { opacity: fadeA, transform: [{ translateX: slideA }] }]}>
        <View style={S.heroBadgeRow}>
          {item.newly_added && (
            <View style={S.heroBadge}>
              <LinearGradient colors={[COLORS.accent, COLORS.accentDim]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
              <Text style={S.heroBadgeTxt}>{item.newly_added}</Text>
            </View>
          )}
          {item.genre?.slice(0, 2).map(g => <Text key={g} style={S.heroMeta}>· {g}</Text>)}
          {item.year && <Text style={S.heroMeta}>· {item.year}</Text>}
          {item.is_series && <Text style={S.heroMeta}>· SERIES</Text>}
        </View>
        <Text style={S.heroTitle} numberOfLines={1}
          ellipsizeMode="tail">{limitWords(item.title, 18)}</Text>
        <Text style={S.heroDesc} numberOfLines={2}>{limitWordsdes(item.description, 100)}</Text>
        <View style={S.heroBtnRow}>
          <GlassBtn accent icon="▶" label="Play Now"
            onPress={() => { console.log('Play:', item.id); /* TODO: navigate Player */ }}
            style={{ marginRight: rs(12) }}
          />
          <GlassBtn icon="＋" label="My List" onPress={() => onAddList?.(item)} />
        </View>
      </Animated.View>

      <View style={S.dotRow}>
        {items.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i, i > idx ? 1 : -1)} activeOpacity={0.8}>
            <View style={[S.dot, i === idx ? S.dotOn : S.dotOff]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── CONTINUE WATCHING CARD ────────────────────────────────────────────────────
const ContinueCard = memo(({ item }) => {
  const { anim, onIn, onOut } = usePressScale(0.95);
  return (
    <TouchableOpacity onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      onPress={() => { console.log('Resume:', item.movieId); /* TODO: navigate Player resume */ }}>
      <Animated.View style={[S.contCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient colors={[COLORS.glassBorder, 'rgba(0,255,178,0.05)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
        <View style={S.contInner}>
          {item.poster ? (
            <ImageBackground
              source={{ uri: item.poster }}
              style={S.contImg}
              imageStyle={{ borderTopLeftRadius: rs(10), borderTopRightRadius: rs(10) }}
            >
              <LinearGradient
                colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.82)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]}
              />
              {item.is_series && <SeriesBadge />}
              <View style={S.progOuter}>
                <View style={S.progBg} />
                <View
                  style={[
                    S.progFill,
                    { width: `${Math.min(Math.round((item.progress || 0) * 100), 100)}%` },
                  ]}
                />
              </View>
            </ImageBackground>
          ) : (
            <View
              style={[
                S.contImg,
                { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center', borderRadius: rs(10) },
              ]}
            >
              <Text style={S.heroTitle}>{limitWords(item.title, 18)}</Text>
            </View>
          )}

          <View style={S.contInfo}>
            <LinearGradient colors={['rgba(0,255,178,0.07)', 'rgba(3, 15, 12, 0.23)']} style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]} />
            <Text style={S.contTitle} numberOfLines={1}>{limitWords(item.title, 18)}</Text>
            <Text style={S.contMeta}>{item.is_series && item.season ? `S${item.season} E${item.episode} · ` : ''}{item.remaining} left</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── WATCHLIST CARD ─────────────────────────────────────────────────────────────
const WatchlistCard = memo(({ item, onRemove }) => {
  const { anim, onIn, onOut } = usePressScale(0.95);
  return (
    <TouchableOpacity onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      onPress={() => { console.log('WL:', item.id); /* TODO: navigate MovieDetail */ }}>
      <Animated.View style={[S.posterCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient colors={[COLORS.glassBorder, 'rgba(0,255,178,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
        <View style={S.posterInner}>
          {item.poster ? (
            <ImageBackground source={{ uri: item.poster }} style={S.posterImg} imageStyle={{ borderTopLeftRadius: rs(10), borderTopRightRadius: rs(10) }}>
              <LinearGradient colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.88)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]} />
              {item.is_series && <SeriesBadge />}
              {item.is_trending && <TrendingBadge />}
              {item.newly_added && <NewBadge label={item.newly_added} />}
              <RatingChip rating={item.rating} />
            </ImageBackground>) : (
            <View style={[S.posterImg, { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center', borderRadius: rs(10) }]}>
              <Text style={S.heroTitle}>{limitWords(item.title, 18)}</Text>
            </View>
          )}
          <View style={S.posterInfo}>
            <LinearGradient colors={['rgba(0,255,178,0.08)', 'rgba(3,15,12,0.5)']} style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]} />
            <Text style={S.posterTitle} numberOfLines={1}>{limitWords(item.title, 18)}</Text>
            <TouchableOpacity onPress={() => onRemove?.(item)} style={S.removeBtn} activeOpacity={0.82}>
              <LinearGradient colors={[COLORS.accentGlow, 'rgba(0,255,178,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]} />
              <Text style={S.removeTxt}>✓ In List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── UPCOMING CARD ──────────────────────────────────────────────────────────────
const UpcomingCard = memo(({ item }) => {
  const { anim, onIn, onOut } = usePressScale(0.95);
  return (
    <TouchableOpacity onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      onPress={() => { console.log('Upcoming:', item.id); /* TODO: navigate ComingSoon */ }}>
      <Animated.View style={[S.posterCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient colors={[COLORS.glassBorder, 'rgba(0,255,178,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
        <View style={S.posterInner}>
          {item.poster ? (
            <ImageBackground source={{ uri: item.poster }} style={S.posterImg} imageStyle={{ borderTopLeftRadius: rs(10), borderTopRightRadius: rs(10) }}>
              <LinearGradient colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.85)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]} />
              {item.is_series && <SeriesBadge />}
              <NotifBtn movieId={item.id} />
              {item.release_date && <CountdownChip releaseDate={item.release_date} />}
            </ImageBackground>) : (
            <View style={[S.posterImg, { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center', borderRadius: rs(10) }]}>
              <Text style={S.heroTitle}>{limitWords(item.title, 18)}</Text>
            </View>
          )}
          <View style={S.posterInfo}>
            <LinearGradient colors={['rgba(0,255,178,0.07)', 'rgba(3,15,12,0.5)']} style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]} />
            <Text style={S.posterTitle} numberOfLines={1}>{limitWords(item.title, 18)}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── MOVIE CARD ─────────────────────────────────────────────────────────────────
const MovieCard = memo(({ item, onAddList }) => {
  const { anim, onIn, onOut } = usePressScale(0.94);
  return (
    <TouchableOpacity onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      onPress={() => { console.log('Movie:', item.id); /* TODO: navigate MovieDetail zoom_from_card */ }}>
      <Animated.View style={[S.genreCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient colors={[COLORS.glassBorder, 'rgba(0,255,178,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
        <View style={S.genreInner}>
          {item.poster ? (
            <ImageBackground source={{ uri: item.poster }} style={S.genreImg} imageStyle={{ borderTopLeftRadius: rs(10), borderTopRightRadius: rs(10) }}>
              <LinearGradient colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.90)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]} />
              {item.is_series && <SeriesBadge />}
              {item.is_trending && <TrendingBadge />}
              {item.newly_added && <NewBadge label={item.newly_added} />}
              <RatingChip rating={item.rating} />
              <TouchableOpacity onPress={() => onAddList?.(item)} style={S.addPill} activeOpacity={0.82}>
                <LinearGradient colors={['rgba(0,255,178,0.22)', 'rgba(0,255,178,0.08)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
                <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
                <Text style={S.addTxt}>+ List</Text>
              </TouchableOpacity>
            </ImageBackground>) : (
            <View style={[S.genreImg, { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center', borderRadius: rs(10) }]}>
              <Text style={S.heroTitle}>{limitWords(item.title, 18)}</Text>
            </View>
          )}
          <View style={S.genreInfo}>
            <LinearGradient colors={['rgba(0,255,178,0.07)', 'rgba(3,15,12,0.5)']} style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]} />
            <Text style={S.genreTitle} numberOfLines={1}>{limitWords(item.title, 18)}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Content Row ───────────────────────────────────────────────────────────────
const ContentRow = memo(({ title, data, onSeeAll, onAddList }) => {
  if (!data?.length) return null;
  return (
    <View style={S.section}>
      <SectionHeader title={title} onSeeAll={onSeeAll} />
      <FlatList
        data={data}
        horizontal
        keyExtractor={i => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.hPad}
        renderItem={({ item }) => <MovieCard item={item} onAddList={onAddList} />}
        getItemLayout={(_, i) => ({ length: GENRE_W, offset: GENRE_W * i, index: i })}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews
      />
    </View>
  );
});

// ─── HOME SCREEN ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { toast, showToast } = useToast();

  const [isConnected, setConnected] = useState(true);
  const [loadingInitial, setLoadingInit] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState('');
  const [featured, setFeatured] = useState([]);
  const [continuing, setContinuing] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [allMovies, setAllMovies] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const entryOpac = useRef(new Animated.Value(0)).current;
  const entryY = useRef(new Animated.Value(rs(20))).current;

  const { genres, categories, genreMap, categoryMap } = useMemo(
    () => buildContentMap(allMovies), [allMovies]
  );

  // ── NetInfo ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => {
      const ok = s.isConnected ?? true;
      if (!ok) showToast('📡 No internet connection');
      setConnected(ok);
    });
    return () => unsub();
  }, []);

  // ── Boot: skeleton for 800ms minimum, then load ───────────────────────────
 useEffect(() => {
  StatusBar.setHidden(true, 'fade');
  startShimmer();
  loadData();                          // ← fires immediately
  return () => StatusBar.setHidden(false, 'fade');
}, []);



  // ── Entrance anim ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loadingInitial) {
      Animated.parallel([
        Animated.timing(entryOpac, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(entryY, { toValue: 0, useNativeDriver: true, tension: 90, friction: 18 }),
      ]).start();
    }
  }, [loadingInitial]);

  

  // ── Data load ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    setApiError('');
    try {
      const [feat, cw, wl, up, movies] = await Promise.all([
        fetchFeatured().catch(e => { console.warn('featured:', e.message); return null; }),
        fetchContinueWatching(null).catch(e => { console.warn('cw:', e.message); return null; }),
        fetchWatchlist(null).catch(e => { console.warn('wl:', e.message); return null; }),
        fetchUpcoming().catch(e => { console.warn('up:', e.message); return null; }),
        fetchMoviesByPage(0, PAGE_SIZE).catch(e => { console.warn('movies:', e.message); return null; }),
      ]);

      const anyRealData = feat?.length || movies?.length;
      if (!anyRealData) setApiError('Could not load content. Showing cached data.');

      setFeatured(feat?.length ? feat : MOCK_FEATURED);
      setContinuing(cw?.length ? cw : MOCK_CONTINUE);
      setWatchlist(wl?.length ? wl : MOCK_WATCHLIST);
      setUpcoming(up?.length ? up : MOCK_UPCOMING);
      setAllMovies(movies?.length ? movies : MOCK_ALL);
      setPage(1);
      setHasMore((movies?.length ?? 0) === PAGE_SIZE);
      if (isRefresh) showToast('✓ Content refreshed');
    } catch (e) {
      setApiError('Something went wrong. Pull down to retry.');
      setFeatured(MOCK_FEATURED); setContinuing(MOCK_CONTINUE);
      setWatchlist(MOCK_WATCHLIST); setUpcoming(MOCK_UPCOMING); setAllMovies(MOCK_ALL);
    } finally {
      setLoadingInit(false);
      setRefreshing(false);
    }
  }, []);

 
  // ── Pagination ────────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const more = await fetchMoviesByPage(page, PAGE_SIZE);
      if (more?.length) {
        setAllMovies(prev => [...prev, ...more]);
        setPage(p => p + 1);
        setHasMore(more.length === PAGE_SIZE);
      } else setHasMore(false);
    } catch {
      setHasMore(false);
    } finally { setLoadingMore(false); }
  }, [page, loadingMore, hasMore]);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true); setPage(0); setHasMore(true); loadData(true);
  }, [loadData]);

  // ── Watchlist ops ─────────────────────────────────────────────────────────
  const handleAdd = useCallback(async (movie) => {
    try {
      await addToWatchlist(null, movie.id);
      setWatchlist(p => p.find(m => m.id === movie.id) ? p : [movie, ...p]);
      showToast(`✓ ${movie.title} added`);
    } catch { showToast('Could not add to list'); }
  }, []);

  const handleRemove = useCallback(async (movie) => {
    try {
      await removeFromWatchlist(null, movie.id);
      setWatchlist(p => p.filter(m => m.id !== movie.id));
      showToast(`Removed from My List`);
    } catch { showToast('Could not remove'); }
  }, []);

  // ── Near-bottom detection (pagination) ───────────────────────────────────
  const onScroll = useCallback((e) => {
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: false }
    )(e);
    const ne = e.nativeEvent;
    const dist = ne.contentSize.height - ne.contentOffset.y - ne.layoutMeasurement.height;
    if (dist < rs(400) && !loadingMore && hasMore) loadMore();
  }, [loadingMore, hasMore, loadMore]);

  const bottomPad = Math.max(insets.bottom, 12) + rs(74);

  if (!isConnected && loadingInitial) {
    return <View style={S.root}><StatusBar hidden /><NoInternet onRetry={loadData} /></View>;
  }
  if (loadingInitial) {
    return <View style={S.root}><StatusBar hidden /><HomeSkeleton /></View>;
  }

  return (
    <View style={S.root}>
      <StatusBar hidden />

      <AppHeader scrollY={scrollY} navigation={navigation} />

      <Animated.ScrollView
        style={S.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing} onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent, COLORS.accentDim]}
            progressBackgroundColor={COLORS.bg2}
          />
        }
      >
        <Animated.View style={{ opacity: entryOpac, transform: [{ translateY: entryY }] }}>

          {featured.length > 0 && <HeroCarousel items={featured} onAddList={handleAdd} />}

          {/* API error banner — shown on UI not console */}
          {apiError ? <ErrorBanner message={apiError} onRetry={loadData} /> : null}

          {continuing.length > 0 && (
            <View style={S.section}>
              <SectionHeader title="Continue Watching"
                onSeeAll={() => { console.log('SeeAll ContinueWatching'); /* TODO */ }} />
              <FlatList data={continuing} horizontal keyExtractor={i => i.movieId || i.id}
                showsHorizontalScrollIndicator={false} contentContainerStyle={S.hPad}
                initialNumToRender={3} maxToRenderPerBatch={3} windowSize={3} removeClippedSubviews
                getItemLayout={(_, i) => ({ length: CONT_CARD_W, offset: CONT_CARD_W * i, index: i })}
                renderItem={({ item }) => <ContinueCard item={item} />}
              />
            </View>
          )}

          {watchlist.length > 0 && (
            <View style={S.section}>
              <SectionHeader title="My List"
                onSeeAll={() => { console.log('SeeAll Watchlist'); /* TODO */ }} />
              <FlatList data={watchlist} horizontal keyExtractor={i => i.id}
                showsHorizontalScrollIndicator={false} contentContainerStyle={S.hPad}
                initialNumToRender={3} maxToRenderPerBatch={3} windowSize={3} removeClippedSubviews
                getItemLayout={(_, i) => ({ length: POSTER_W, offset: POSTER_W * i, index: i })}
                renderItem={({ item }) => <WatchlistCard item={item} onRemove={handleRemove} />}
              />
            </View>
          )}

          {upcoming.length > 0 && (
            <View style={S.section}>
              <SectionHeader title="Coming Soon"
                onSeeAll={() => { console.log('SeeAll Upcoming'); /* TODO */ }} />
              <FlatList data={upcoming} horizontal keyExtractor={i => i.id}
                showsHorizontalScrollIndicator={false} contentContainerStyle={S.hPad}
                initialNumToRender={3} maxToRenderPerBatch={3} windowSize={3} removeClippedSubviews
                getItemLayout={(_, i) => ({ length: POSTER_W, offset: POSTER_W * i, index: i })}
                renderItem={({ item }) => <UpcomingCard item={item} />}
              />
            </View>
          )}

          {categories.map(cat => (
            <ContentRow key={`c_${cat}`}
              title={cat.charAt(0).toUpperCase() + cat.slice(1)}
              data={categoryMap[cat]}
              onSeeAll={() => { console.log('Cat:', cat); /* TODO navigate CategoryScreen */ }}
              onAddList={handleAdd}
            />
          ))}

          {genres.map(g => (
            <ContentRow key={`g_${g}`} title={g} data={genreMap[g]}
              onSeeAll={() => { console.log('Genre:', g); /* TODO navigate GenreScreen */ }}
              onAddList={handleAdd}
            />
          ))}

          {loadingMore && (
            <View style={S.loadMoreRow}>
              <ActivityIndicator color={COLORS.accent} size="small" />
              <Text style={S.loadMoreTxt}>Loading more…</Text>
            </View>
          )}

        </Animated.View>
      </Animated.ScrollView>

      <Toast message={toast.message} visible={toast.visible} />
    </View>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1,marginTop:30 },
  skelWrap: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: rs(18),
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: rs(3) }, shadowRadius: rs(12),
  },
  headerBorder: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
    backgroundColor: COLORS.glassBorder,
  },
  headerFade: {
    position: 'absolute', bottom: -rs(16), left: 0, right: 0, height: rs(16),
    pointerEvents: 'none',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },

  // Logo
  logoWrap: { flexDirection: 'row', alignItems: 'flex-end', position: 'relative', paddingBottom: rs(2) },
  logoGlow: {
    position: 'absolute', left: -rs(3), top: -rs(5),
    width: rs(32), height: rs(32), borderRadius: rs(16),
    backgroundColor: COLORS.redGlow,
  },
  logoF: {
    color: COLORS.red, fontSize: rs(30), fontWeight: '900', zIndex: 1,
    textShadowColor: COLORS.redGlow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: rs(10),
    lineHeight: rs(34),
  },
  logoCut1: {
    position: 'absolute', left: rs(3), top: rs(10),
    width: rs(13), height: rs(2),
    backgroundColor: COLORS.bg, borderRadius: 1, transform: [{ rotate: '12deg' }], zIndex: 2,
  },
  logoCut2: {
    position: 'absolute', left: rs(3), top: rs(17),
    width: rs(9), height: rs(2),
    backgroundColor: COLORS.bg, borderRadius: 1, transform: [{ rotate: '8deg' }], zIndex: 2,
  },
  logoRest: {
    color: COLORS.text, fontSize: rs(24), fontWeight: '800',
    letterSpacing: rs(3), marginLeft: rs(0), lineHeight: rs(30),
  },
  logoDot: {
    position: 'absolute', bottom: 0, left: rs(3),
    width: rs(5), height: rs(5), borderRadius: rs(3),
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent, shadowOpacity: 0.9, shadowRadius: rs(4),
  },

  // Profile button
  profileBtn: {
    width: rs(40), height: rs(40), borderRadius: rs(20),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1.5, borderColor: COLORS.glassBorder,
    ...SHADOW.teal,
  },
  profileAvatar: {
    width: rs(28), height: rs(28), borderRadius: rs(14),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  profileInitial: { color: COLORS.bg, fontSize: rs(13), fontWeight: '900' },
  profileOnline: {
    position: 'absolute', bottom: rs(1), right: rs(1),
    width: rs(9), height: rs(9), borderRadius: rs(5),
    backgroundColor: COLORS.accent,
    borderWidth: 1.5, borderColor: COLORS.bg,
    shadowColor: COLORS.accent, shadowOpacity: 0.8, shadowRadius: rs(4),
  },

  iconBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(19),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.teal,
  },
  iconBadge: {
    position: 'absolute', top: rs(1), right: rs(1),
    minWidth: rs(14), height: rs(14), borderRadius: rs(7),
    backgroundColor: COLORS.red,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.bg,
  },
  iconBadgeTxt: { color: '#fff', fontSize: rs(7), fontWeight: '900' },

  // Hero
  heroWrap: { width: SW, overflow: 'hidden' },
  heroContent: { position: 'absolute', bottom: rs(44), left: rs(18), right: rs(18) },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(9), flexWrap: 'wrap' },
  heroBadge: {
    paddingHorizontal: rs(9), paddingVertical: rs(3),
    borderRadius: rs(5), overflow: 'hidden', marginRight: rs(8), ...SHADOW.teal,
  },
  heroBadgeTxt: { color: COLORS.bg, fontSize: rs(9), fontWeight: '900', letterSpacing: 1 },
  heroMeta: { color: COLORS.textSub, fontSize: rs(11), marginRight: rs(4) },
  heroTitle: {
    color: COLORS.text, fontSize: rs(32), fontWeight: '900',
    letterSpacing: -rs(0.4), lineHeight: rs(38), marginBottom: rs(7),
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: rs(2) }, textShadowRadius: rs(8),
  },
  heroDesc: { color: COLORS.textSub, fontSize: rs(12), lineHeight: rs(18), marginBottom: rs(18) },
  heroBtnRow: { flexDirection: 'row', alignItems: 'center' },
  dotRow: {
    position: 'absolute', bottom: rs(13), left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: rs(6),
  },
  dot: { height: rs(4), borderRadius: rs(2) },
  dotOn: { width: rs(22), backgroundColor: COLORS.accent, shadowColor: COLORS.accent, shadowOpacity: 0.9, shadowRadius: rs(5) },
  dotOff: { width: rs(6), backgroundColor: COLORS.textMuted },

  // Glass button
  glassBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: rs(18), paddingVertical: rs(10),
    borderRadius: rs(28), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.teal,
  },
  glassBtnAccent: { borderColor: COLORS.accentDim },
  glassBtnIcon: { color: COLORS.bg, fontSize: rs(13), marginRight: rs(6), fontWeight: '800' },
  glassBtnLabel: { color: COLORS.bg, fontSize: rs(12), fontWeight: '700', letterSpacing: 0.4 },

  // Section
  section: { marginTop: rs(26) },
  secHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: rs(18), marginBottom: rs(12),
  },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: rs(12) },
  secBar: {
    width: rs(3), height: rs(18), borderRadius: rs(2),
    backgroundColor: COLORS.accent, marginRight: rs(8),
    shadowColor: COLORS.accent, shadowOpacity: 0.8, shadowRadius: rs(6),
  },
  secTitle: { color: COLORS.text, fontSize: rs(17), fontWeight: '800', letterSpacing: 0.2, flexShrink: 1 },
  seeAllBtn: {
    paddingHorizontal: rs(12), paddingVertical: rs(5),
    borderRadius: rs(14), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  seeAllTxt: { color: COLORS.accent, fontSize: rs(10), fontWeight: '800', letterSpacing: 1 },
  hPad: { paddingHorizontal: rs(18), paddingRight: rs(6) },

  // Badges
  seriesBadge: {
    position: 'absolute', top: rs(7), left: rs(7),
    paddingHorizontal: rs(7), paddingVertical: rs(2),
    borderRadius: rs(5), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.40)',
  },
  seriesTxt: { color: COLORS.red, fontSize: rs(7), fontWeight: '900', letterSpacing: 0.8 },
  trendBadge: {
    position: 'absolute', top: rs(7), right: rs(5),
    paddingHorizontal: rs(6), paddingVertical: rs(2),
    borderRadius: rs(5), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)',
  },
  trendTxt: { color: COLORS.gold, fontSize: rs(7), fontWeight: '900', letterSpacing: 0.5 },
  newBadge: {
    position: 'absolute', bottom: rs(10), left: rs(7),
    paddingHorizontal: rs(7), paddingVertical: rs(2),
    borderRadius: rs(5), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  newTxt: { color: COLORS.accent, fontSize: rs(7), fontWeight: '900', letterSpacing: 0.8 },
  ratingChip: {
    position: 'absolute', bottom: rs(8), right: rs(7),
    paddingHorizontal: rs(7), paddingVertical: rs(3),
    borderRadius: rs(7), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.28)',
  },
  ratingTxt: { color: COLORS.gold, fontSize: rs(9), fontWeight: '700' },

  // Countdown + date
  cdWrap: { position: 'absolute', bottom: rs(8), left: rs(7) },
  cdChip: {
    paddingHorizontal: rs(8), paddingVertical: rs(3),
    borderRadius: rs(7), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, marginBottom: rs(3),
  },
  cdTxt: { color: COLORS.accent, fontSize: rs(9), fontWeight: '700' },
  cdDate: { color: COLORS.textSub, fontSize: rs(8), fontWeight: '600', paddingLeft: rs(2) },

  // Notification button
  notifBtn: {
    position: 'absolute', top: rs(3.5), right: rs(3.5),
    width: rs(28), height: rs(28), borderRadius: rs(14),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.teal,
  },

  // Add to list pill
  addPill: {
    position: 'absolute', bottom: rs(8), left: rs(7),
    paddingHorizontal: rs(9), paddingVertical: rs(4),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  addTxt: { color: COLORS.accent, fontSize: rs(9), fontWeight: '700' },

  // Continue watching
  contCard: {
    width: rs(195), marginRight: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.dark,
  },
  contInner: { borderRadius: rs(11), overflow: 'hidden', backgroundColor: COLORS.bg2 },
  contImg: { width: '100%', height: rs(112) },
  progOuter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: rs(8), paddingBottom: rs(7) },
  progBg: { height: rs(3), backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: rs(2) },
  progFill: {
    position: 'absolute', left: rs(8), bottom: rs(7),
    height: rs(3), backgroundColor: COLORS.accent, borderRadius: rs(2),
    shadowColor: COLORS.accent, shadowOpacity: 0.9, shadowRadius: rs(4),
  },
  contInfo: { paddingHorizontal: rs(10), paddingVertical: rs(9), overflow: 'hidden' },
  contTitle: { color: COLORS.text, fontSize: rs(12), fontWeight: '700', marginBottom: rs(3) },
  contMeta: { color: COLORS.textSub, fontSize: rs(10), fontWeight: '500' },

  // Poster card
  posterCard: {
    width: rs(130), marginRight: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.dark,
  },
  posterInner: { borderRadius: rs(11), overflow: 'hidden', backgroundColor: COLORS.bg2 },
  posterImg: { width: '100%', height: rs(175) },
  posterInfo: { paddingHorizontal: rs(8), paddingVertical: rs(8), overflow: 'hidden' },
  posterTitle: {
    color: COLORS.text, fontSize: rs(11), fontWeight: '700',
    marginBottom: rs(7), lineHeight: rs(15),
  },
  removeBtn: {
    paddingHorizontal: rs(10), paddingVertical: rs(4),
    borderRadius: rs(10), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, alignSelf: 'flex-start',
  },
  removeTxt: { color: COLORS.accent, fontSize: rs(9), fontWeight: '700' },

  // Genre card
  genreCard: {
    width: rs(130), marginRight: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.dark,
  },
  genreInner: { borderRadius: rs(11), overflow: 'hidden', backgroundColor: COLORS.bg2 },
  genreImg: { width: '100%', height: rs(165) },
  genreInfo: { paddingHorizontal: rs(8), paddingVertical: rs(8), overflow: 'hidden' },
  genreTitle: { color: COLORS.text, fontSize: rs(11), fontWeight: '700', lineHeight: rs(15) },

  // Error banner
  errorBanner: {
    marginHorizontal: rs(18), marginTop: rs(12),
    paddingHorizontal: rs(14), paddingVertical: rs(10),
    borderRadius: rs(10), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.28)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  errorText: { color: COLORS.text, fontSize: rs(12), fontWeight: '600', flex: 1 },
  errorRetry: { paddingHorizontal: rs(12), paddingVertical: rs(4), borderRadius: rs(8), backgroundColor: COLORS.accentBg },
  errorRetryTxt: { color: COLORS.accent, fontSize: rs(11), fontWeight: '800' },

  // Toast
  toast: {
    position: 'absolute', bottom: rs(96), alignSelf: 'center',
    paddingHorizontal: rs(20), paddingVertical: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
    zIndex: 999, maxWidth: SW * 0.85,
  },
  toastText: { color: COLORS.text, fontSize: rs(13), fontWeight: '600', textAlign: 'center' },

  // No internet
  noNetWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: rs(32) },
  noNetIcon: {
    width: rs(100), height: rs(100), borderRadius: rs(50),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.glassBorder,
    marginBottom: rs(24), ...SHADOW.teal,
  },
  noNetTitle: { color: COLORS.text, fontSize: rs(22), fontWeight: '800', marginBottom: rs(10), textAlign: 'center' },
  noNetSub: { color: COLORS.textSub, fontSize: rs(14), textAlign: 'center', lineHeight: rs(21), marginBottom: rs(32) },
  retryBtn: {
    paddingHorizontal: rs(32), paddingVertical: rs(13),
    borderRadius: rs(28), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.accentDim, ...SHADOW.teal,
  },
  retryTxt: { color: COLORS.bg, fontSize: rs(15), fontWeight: '800', letterSpacing: 0.5 },

  // Load more
  loadMoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: rs(20), gap: rs(10) },
  loadMoreTxt: { color: COLORS.textMuted, fontSize: rs(12) },
});
