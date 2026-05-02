// src/screens/HomeScreen.js
import React, {
  useRef, useEffect, useState, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Dimensions, StatusBar, ImageBackground,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import NetInfo from '@react-native-community/netinfo';
import { COLORS, RADIUS, SHADOW } from '../data/theme';
import {
  fetchFeatured, fetchMoviesByPage, fetchTrending,
  fetchUpcoming, fetchContinueWatching, fetchWatchlist,
  addToWatchlist, removeFromWatchlist, buildContentMap,
} from '../lib/supabase';

// ─── Responsive scale ─────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const rs = (s) => {
  const w = Dimensions.get('window').width;
  if (w < 360) return Math.round(s * 0.86);
  if (w < 414) return Math.round(s * 0.93);
  if (w > 600) return Math.round(s * 1.1);
  return s;
};

const HERO_H         = SH * 0.60;
const HEADER_H       = rs(56);
const SCROLL_END     = rs(100);
const PAGE_SIZE      = 40;

// ─── Mock fallback data ───────────────────────────────────────────────────────
const MOCK_FEATURED = [
  { id: 'f1', title: 'NEON REBELLION', description: 'In a world where light is currency, one survivor risks everything to unplug the system.', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900', hero_image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900', genre: ['Sci-Fi', 'Thriller'], category: ['originals'], year: 2024, rating: 8.4, newly_added: 'ORIGINAL', is_series: false, is_trending: true  },
  { id: 'f2', title: 'DARK HORIZON',   description: 'A rogue astronaut uncovers a conspiracy spanning galaxies.',                               poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900', hero_image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900', genre: ['Sci-Fi', 'Drama'],    category: ['drama'],     year: 2024, rating: 7.9, newly_added: null,       is_series: true,  is_trending: false },
  { id: 'f3', title: 'CHROME CITY',    description: 'A detective navigates a dystopian megacity where AI rules the underworld.',               poster: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900', hero_image: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900', genre: ['Action', 'Thriller'], category: ['action'],    year: 2024, rating: 8.1, newly_added: 'NEW',      is_series: false, is_trending: true  },
];
const MOCK_CONTINUE = [
  { movieId: 'c1', title: 'Mars Colony',       poster: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=500', progress: 0.72, season: 2, episode: 4, remaining: '12m', is_series: true  },
  { movieId: 'c2', title: 'Midnight Protocol', poster: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500', progress: 0.38, season: 1, episode: 7, remaining: '28m', is_series: true  },
  { movieId: 'c3', title: 'Velocity',          poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500', progress: 0.55, season: null, episode: null, remaining: '54m', is_series: false },
];
const MOCK_WATCHLIST = [
  { id: 'w1', title: 'Orbital Decay',   poster: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=400', rating: 7.6, is_series: false, newly_added: 'NEW',  is_trending: false },
  { id: 'w2', title: 'The Last Signal', poster: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=400', rating: 8.2, is_series: true,  newly_added: null,    is_trending: true  },
  { id: 'w3', title: 'Phantom Circuit', poster: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', rating: 7.1, is_series: false, newly_added: null,    is_trending: false },
];
const MOCK_UPCOMING = [
  { id: 'u1', title: 'Solar Drift',  poster: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=400', release_date: '2025-06-15', is_series: false },
  { id: 'u2', title: 'Echo Chamber', poster: 'https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=400', release_date: '2025-07-20', is_series: true  },
  { id: 'u3', title: 'Iron Veil',    poster: 'https://images.unsplash.com/photo-1542372147193-a7aca54189cd?w=400', release_date: '2025-08-05', is_series: false },
  { id: 'u4', title: 'Neon Ghosts',  poster: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400', release_date: '2025-09-12', is_series: true  },
];
const MOCK_ALL_MOVIES = [
  { id: 'a1', title: 'Velocity X',    poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400', rating: 7.8, genre: ['Action'], category: ['action'],   is_series: false, is_trending: true,  newly_added: null    },
  { id: 'a2', title: 'Thunder Run',   poster: 'https://images.unsplash.com/photo-1542372147193-a7aca54189cd?w=400', rating: 7.2, genre: ['Action'], category: ['action'],   is_series: false, is_trending: false, newly_added: 'NEW'   },
  { id: 'd1', title: 'Broken Ties',   poster: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400', rating: 8.3, genre: ['Drama'],  category: ['drama'],    is_series: true,  is_trending: false, newly_added: null    },
  { id: 'd2', title: 'Quiet Storm',   poster: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400', rating: 7.9, genre: ['Drama'],  category: ['drama'],    is_series: false, is_trending: false, newly_added: null    },
  { id: 't1', title: 'Shadow Line',   poster: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400', rating: 8.0, genre: ['Thriller'],category:['thriller'], is_series: false, is_trending: true,  newly_added: null    },
  { id: 's1', title: 'Quantum Rift',  poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400', rating: 8.5, genre: ['Sci-Fi'], category: ['sci-fi'],   is_series: false, is_trending: false, newly_added: 'NEW'   },
  { id: 's2', title: 'Mars Born',     poster: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400', rating: 8.2, genre: ['Sci-Fi'], category: ['sci-fi'],   is_series: true,  is_trending: true,  newly_added: null    },
];

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, visible }) {
  const opac = useRef(new Animated.Value(0)).current;
  const ty    = useRef(new Animated.Value(rs(20))).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opac, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(ty,   { toValue: 0, useNativeDriver: true, tension: 200, friction: 18 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opac, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(ty,   { toValue: rs(20), duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  return (
    <Animated.View style={[S.toast, { opacity: opac, transform: [{ translateY: ty }] }]}>
      <LinearGradient
        colors={['rgba(0,255,178,0.22)', 'rgba(0,255,178,0.10)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
      />
      <Text style={S.toastText}>{message}</Text>
    </Animated.View>
  );
}

function useToast() {
  const [state, setState] = useState({ message: '', visible: false });
  const timerRef = useRef(null);
  const show = useCallback((message, duration = 2500) => {
    clearTimeout(timerRef.current);
    setState({ message, visible: true });
    timerRef.current = setTimeout(() => setState(s => ({ ...s, visible: false })), duration);
  }, []);
  return { toast: state, showToast: show };
}

// ─── No-internet screen ───────────────────────────────────────────────────────
function NoInternet({ onRetry }) {
  const pulseA = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseA, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulseA, { toValue: 1,    duration: 1200, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={S.noInternetWrap}>
      <Animated.View style={[S.noInternetIcon, { transform: [{ scale: pulseA }] }]}>
        <LinearGradient
          colors={['rgba(0,255,178,0.18)', 'rgba(0,255,178,0.06)']}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(50) }]}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(50) }]}
        />
        <Text style={S.noInternetEmoji}>📡</Text>
      </Animated.View>
      <Text style={S.noInternetTitle}>No Connection</Text>
      <Text style={S.noInternetSub}>Turn on your internet to keep watching</Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.82} style={S.retryBtn}>
        <LinearGradient
          colors={[COLORS.accent, COLORS.accentDim, '#009A6E']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
        />
        <Text style={S.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Skeleton box ─────────────────────────────────────────────────────────────
function SkeletonBox({ width, height, borderRadius = rs(10), style }) {
  const opac = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opac, { toValue: 0.55, duration: 900, useNativeDriver: true }),
      Animated.timing(opac, { toValue: 0.18, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[{ width, height, borderRadius, overflow: 'hidden', opacity: opac }, style]}>
      <LinearGradient
        colors={[COLORS.glass, COLORS.glassHigh, COLORS.glass]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {/* 3D shine strip */}
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ ...StyleSheet.absoluteFillObject, borderRadius, borderWidth: 1, borderColor: COLORS.glassBorder }} />
    </Animated.View>
  );
}

function HomeSkeleton() {
  return (
    <View style={S.skelContainer}>
      <SkeletonBox width={SW} height={SW * 0.62} borderRadius={0} />
      <View style={{ padding: rs(18), marginTop: rs(20) }}>
        <SkeletonBox width={rs(180)} height={rs(16)} style={{ marginBottom: rs(16) }} />
        <View style={{ flexDirection: 'row', gap: rs(12) }}>
          {[0, 1, 2, 3].map(i => (
            <View key={i}>
              <SkeletonBox width={rs(140)} height={rs(200)} borderRadius={RADIUS.lg} />
              <SkeletonBox width={rs(100)} height={rs(10)} style={{ marginTop: rs(8) }} />
            </View>
          ))}
        </View>
        <SkeletonBox width={rs(160)} height={rs(16)} style={{ marginTop: rs(28), marginBottom: rs(16) }} />
        <View style={{ flexDirection: 'row', gap: rs(12) }}>
          {[0, 1, 2, 3].map(i => (
            <SkeletonBox key={i} width={rs(140)} height={rs(200)} borderRadius={RADIUS.lg} />
          ))}
        </View>
        <SkeletonBox width={rs(160)} height={rs(16)} style={{ marginTop: rs(28), marginBottom: rs(16) }} />
        <View style={{ flexDirection: 'row', gap: rs(12) }}>
          {[0, 1, 2].map(i => (
            <SkeletonBox key={i} width={rs(140)} height={rs(200)} borderRadius={RADIUS.lg} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── usePressScale ────────────────────────────────────────────────────────────
function usePressScale(to = 0.94) {
  const anim = useRef(new Animated.Value(1)).current;
  const cfg  = { useNativeDriver: true, tension: 300, friction: 10 };
  const onIn  = () => Animated.spring(anim, { toValue: to, ...cfg }).start();
  const onOut = () => Animated.spring(anim, { toValue: 1,  ...cfg }).start();
  return { anim, onIn, onOut };
}

// ─── Countdown chip for upcoming ─────────────────────────────────────────────
function CountdownChip({ releaseDate }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(releaseDate) - new Date();
      if (diff <= 0) { setLabel('Out Now'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      setLabel(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [releaseDate]);
  return (
    <View style={S.countdownChip}>
      <LinearGradient
        colors={[COLORS.accentGlow, 'rgba(0,255,178,0.10)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(7) }]}
      />
      <Text style={S.countdownText}>🕐 {label}</Text>
    </View>
  );
}

// ─── Small overlay badges ─────────────────────────────────────────────────────
function TrendingBadge() {
  return (
    <View style={S.trendingBadge}>
      <LinearGradient
        colors={['rgba(255,215,0,0.30)', 'rgba(255,215,0,0.10)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(5) }]}
      />
      <Text style={S.trendingText}>🔥 TRENDING</Text>
    </View>
  );
}

function NewBadge({ label }) {
  return (
    <View style={S.newBadge}>
      <LinearGradient
        colors={[COLORS.accentGlow, 'rgba(0,255,178,0.10)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(5) }]}
      />
      <Text style={S.newBadgeText}>{label}</Text>
    </View>
  );
}

function SeriesBadge() {
  return (
    <View style={S.seriesBadge}>
      <LinearGradient
        colors={['rgba(255,45,85,0.40)', 'rgba(255,45,85,0.18)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(5) }]}
      />
      <Text style={S.seriesBadgeText}>SERIES</Text>
    </View>
  );
}

function RatingChip({ rating }) {
  return (
    <View style={S.ratingChip}>
      <LinearGradient
        colors={['rgba(255,215,0,0.22)', 'rgba(255,215,0,0.08)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(7) }]}
      />
      <Text style={S.ratingText}>⭐ {Number(rating).toFixed(1)}</Text>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, onSeeAll }) {
  return (
    <View style={S.sectionHeader}>
      <View style={S.sectionTitleRow}>
        <View style={S.titleAccentBar} />
        <Text style={S.sectionTitle}>{title}</Text>
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.75}>
          <View style={S.seeAllBtn}>
            <LinearGradient
              colors={['rgba(0,255,178,0.14)', 'rgba(0,255,178,0.05)']}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]}
            />
            <Text style={S.seeAllText}>SEE ALL</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Glass CTA button ─────────────────────────────────────────────────────────
function GlassBtn({ label, icon, accent, onPress, style }) {
  const { anim, onIn, onOut } = usePressScale(0.93);
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1} style={style}>
      <Animated.View style={[S.glassBtn, accent && S.glassBtnAccent, { transform: [{ scale: anim }] }]}>
        {accent ? (
          <LinearGradient
            colors={[COLORS.accent, COLORS.accentDim, '#009A6E']}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
          />
        ) : (
          <LinearGradient
            colors={['rgba(0,255,178,0.13)', 'rgba(0,255,178,0.05)']}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
          />
        )}
        <LinearGradient
          colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.48 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)']}
          start={{ x: 0, y: 0.55 }} end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
        />
        {icon ? <Text style={[S.glassBtnIcon, accent && { color: COLORS.bg }]}>{icon}</Text> : null}
        <Text style={[S.glassBtnLabel, accent && { color: COLORS.bg }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Icon button ──────────────────────────────────────────────────────────────
function IconBtn({ icon, onPress }) {
  const { anim, onIn, onOut } = usePressScale(0.88);
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      <Animated.View style={[S.iconBtn, { transform: [{ scale: anim }] }]}>
        <LinearGradient
          colors={['rgba(0,255,178,0.14)', 'rgba(0,255,178,0.05)']}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]}
        />
        <Text style={{ fontSize: rs(15) }}>{icon}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── APP HEADER ───────────────────────────────────────────────────────────────
function AppHeader({ scrollY, navigation }) {
  const insets = useSafeAreaInsets();
  const bgColor = scrollY.interpolate({
    inputRange: [0, SCROLL_END],
    outputRange: ['rgba(3,15,12,0.0)', 'rgba(3,15,12,0.96)'],
    extrapolate: 'clamp',
  });
  const shadowO = scrollY.interpolate({
    inputRange: [0, SCROLL_END], outputRange: [0, 0.7], extrapolate: 'clamp',
  });
  return (
    <Animated.View style={[S.header, { paddingTop: insets.top + rs(4), height: HEADER_H + insets.top, backgroundColor: bgColor, shadowOpacity: shadowO }]}>
      {/* Logo — only "F" rendered with glow + cuts */}
      <View style={S.logoWrap}>
        <View style={S.logoFGlow} />
        <Text style={S.logoF}>F</Text>
        <View style={S.logoCut1} />
        <View style={S.logoCut2} />
        <Text style={S.logoRest}>LICKS</Text>
      </View>

      {/* Bottom gradient fade — blends border into bg */}
      <LinearGradient
        colors={['rgba(3,15,12,0)', COLORS.bg]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={S.headerBottomFade}
        pointerEvents="none"
      />

      <View style={S.headerRight}>
        <IconBtn icon="🔍" onPress={() => { console.log('Search'); /* TODO: navigation.navigate('SearchScreen') */ }} />
        <View style={{ width: rs(10) }} />
        <IconBtn icon="👤" onPress={() => { console.log('Profile'); /* TODO: navigation.navigate('ProfileScreen') */ }} />
      </View>
    </Animated.View>
  );
}

// ─── HERO CAROUSEL ────────────────────────────────────────────────────────────
function HeroCarousel({ items, navigation, onAddList }) {
  const [idx, setIdx]  = useState(0);
  const fadeAnim       = useRef(new Animated.Value(1)).current;
  const slideAnim      = useRef(new Animated.Value(0)).current;
  const timerRef       = useRef(null);

  const goTo = useCallback((nextIdx, dir = 1) => {
    clearInterval(timerRef.current);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,           duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: dir * -rs(22), duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setIdx(nextIdx);
      slideAnim.setValue(dir * rs(22));
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 160, friction: 20 }),
      ]).start();
    });
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => goTo((idx + 1) % items.length, 1), 5000);
    return () => clearInterval(timerRef.current);
  }, [idx, items.length, goTo]);

  const item = items[idx];
  if (!item) return null;

  return (
    <View style={[S.heroWrap, { height: HERO_H }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        <ImageBackground source={{ uri: item.hero_image || item.poster }} style={StyleSheet.absoluteFill} resizeMode="cover">
          <LinearGradient
            colors={['rgba(3,15,12,0.10)', 'rgba(3,15,12,0.0)', 'rgba(3,15,12,0.50)', 'rgba(3,15,12,1.0)']}
            locations={[0, 0.20, 0.60, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(3,15,12,0.55)', 'rgba(3,15,12,0.0)']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Bottom blend into background */}
          <LinearGradient
            colors={['rgba(3,15,12,0)', COLORS.bg]}
            start={{ x: 0.5, y: 0.82 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      </Animated.View>

      <Animated.View style={[S.heroContent, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        <View style={S.heroBadgeRow}>
          {item.newly_added && (
            <View style={S.heroBadge}>
              <LinearGradient
                colors={[COLORS.accent, COLORS.accentDim]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]}
              />
              <Text style={S.heroBadgeText}>{item.newly_added}</Text>
            </View>
          )}
          {item.genre?.slice(0, 2).map(g => <Text key={g} style={S.heroBadgeSep}>· {g}</Text>)}
          {item.year && <Text style={S.heroBadgeSep}>· {item.year}</Text>}
          {item.is_series && <Text style={S.heroBadgeSep}>· SERIES</Text>}
        </View>
        <Text style={S.heroTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={S.heroDesc}  numberOfLines={2}>{item.description}</Text>
        <View style={S.heroBtnRow}>
          <GlassBtn
            accent icon="▶" label="Play Now"
            onPress={() => { console.log('Play:', item.id); /* TODO: navigation.navigate('Player', { movieId: item.id }) */ }}
            style={{ marginRight: rs(12) }}
          />
          <GlassBtn
            icon="＋" label="My List"
            onPress={() => onAddList?.(item)}
          />
        </View>
      </Animated.View>

      {/* Dot indicators */}
      <View style={S.dotRow}>
        {items.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i, i > idx ? 1 : -1)} activeOpacity={0.8}>
            <View style={[S.dot, i === idx ? S.dotActive : S.dotInactive]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── CONTINUE WATCHING CARD ───────────────────────────────────────────────────
function ContinueCard({ item }) {
  const { anim, onIn, onOut } = usePressScale(0.95);
  return (
    <TouchableOpacity
      onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      onPress={() => { console.log('Resume:', item.movieId); /* TODO: navigation.navigate('Player', { movieId: item.movieId, resume: true }) */ }}
    >
      <Animated.View style={[S.contCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient
          colors={[COLORS.glassBorder, 'rgba(0,255,178,0.05)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
        />
        <View style={S.contCardInner}>
          <ImageBackground
            source={{ uri: item.poster }}
            style={S.contPoster}
            imageStyle={{ borderTopLeftRadius: rs(10), borderTopRightRadius: rs(10) }}
          >
            <LinearGradient
              colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.82)']}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]}
            />
            {item.is_series && <SeriesBadge />}
            <View style={S.progressOuter}>
              <View style={S.progressBg} />
              <View style={[S.progressFill, { width: `${Math.min(Math.round((item.progress || 0) * 100), 100)}%` }]} />
            </View>
          </ImageBackground>
          <View style={S.contInfo}>
            <LinearGradient
              colors={['rgba(0,255,178,0.07)', 'rgba(3,15,12,0.5)']}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]}
            />
            <Text style={S.contTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={S.contMeta}>
              {item.is_series && item.season ? `S${item.season} E${item.episode} · ` : ''}{item.remaining} left
            </Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── MY LIST CARD ─────────────────────────────────────────────────────────────
function WatchlistCard({ item, onRemove }) {
  const { anim, onIn, onOut } = usePressScale(0.95);
  return (
    <TouchableOpacity
      onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      onPress={() => { console.log('Open watchlist item:', item.id); /* TODO: navigation.navigate('MovieDetail', { movieId: item.id }) */ }}
    >
      <Animated.View style={[S.posterCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient
          colors={[COLORS.glassBorder, 'rgba(0,255,178,0.04)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
        />
        <View style={S.posterCardInner}>
          <ImageBackground
            source={{ uri: item.poster }}
            style={S.posterImg}
            imageStyle={{ borderTopLeftRadius: rs(10), borderTopRightRadius: rs(10) }}
          >
            <LinearGradient
              colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.88)']}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]}
            />
            {item.is_series  && <SeriesBadge />}
            {item.is_trending && <TrendingBadge />}
            {item.newly_added && <NewBadge label={item.newly_added} />}
            <RatingChip rating={item.rating} />
          </ImageBackground>
          <View style={S.posterInfo}>
            <LinearGradient
              colors={['rgba(0,255,178,0.08)', 'rgba(3,15,12,0.5)']}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]}
            />
            <Text style={S.posterTitle} numberOfLines={2}>{item.title}</Text>
            <TouchableOpacity
              onPress={() => onRemove?.(item)}
              style={S.removeListBtn} activeOpacity={0.82}
            >
              <LinearGradient
                colors={[COLORS.accentGlow, 'rgba(0,255,178,0.06)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]}
              />
              <Text style={S.removeListText}>✓ In List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── UPCOMING CARD ────────────────────────────────────────────────────────────
function UpcomingCard({ item }) {
  const { anim, onIn, onOut } = usePressScale(0.95);
  return (
    <TouchableOpacity
      onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      onPress={() => { console.log('Upcoming:', item.id); /* TODO: navigation.navigate('ComingSoon', { movieId: item.id }) */ }}
    >
      <Animated.View style={[S.posterCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient
          colors={[COLORS.glassBorder, 'rgba(0,255,178,0.04)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
        />
        <View style={S.posterCardInner}>
          <ImageBackground
            source={{ uri: item.poster }}
            style={S.posterImg}
            imageStyle={{ borderTopLeftRadius: rs(10), borderTopRightRadius: rs(10) }}
          >
            <LinearGradient
              colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.85)']}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]}
            />
            {item.is_series && <SeriesBadge />}
            {item.release_date && <CountdownChip releaseDate={item.release_date} />}
          </ImageBackground>
          <View style={S.posterInfo}>
            <LinearGradient
              colors={['rgba(0,255,178,0.07)', 'rgba(3,15,12,0.5)']}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]}
            />
            <Text style={S.posterTitle} numberOfLines={2}>{item.title}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── GENRE/CATEGORY MOVIE CARD ────────────────────────────────────────────────
function MovieCard({ item, onAddList }) {
  const { anim, onIn, onOut } = usePressScale(0.94);
  return (
    <TouchableOpacity
      onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      onPress={() => { console.log('Movie:', item.id); /* TODO: navigation.navigate('MovieDetail', { movieId: item.id, transition: 'zoom_from_card' }) */ }}
    >
      <Animated.View style={[S.genreCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient
          colors={[COLORS.glassBorder, 'rgba(0,255,178,0.04)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
        />
        <View style={S.genreCardInner}>
          <ImageBackground
            source={{ uri: item.poster }}
            style={S.genreImg}
            imageStyle={{ borderTopLeftRadius: rs(10), borderTopRightRadius: rs(10) }}
          >
            <LinearGradient
              colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.90)']}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]}
            />
            {/* Overlay badges — only shown when true */}
            {item.is_series   && <SeriesBadge />}
            {item.is_trending  && (
              <View style={[S.trendingBadge, { bottom: rs(30), top: 'auto', left: rs(7), right: 'auto' }]}>
                <LinearGradient
                  colors={['rgba(255,215,0,0.30)', 'rgba(255,215,0,0.10)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: rs(5) }]}
                />
                <Text style={S.trendingText}>🔥</Text>
              </View>
            )}
            {item.newly_added && (
              <View style={S.newBadge}>
                <LinearGradient
                  colors={[COLORS.accentGlow, 'rgba(0,255,178,0.10)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: rs(5) }]}
                />
                <Text style={S.newBadgeText}>{item.newly_added}</Text>
              </View>
            )}
            <RatingChip rating={item.rating} />
            {/* + List pill */}
            <TouchableOpacity
              onPress={() => onAddList?.(item)} style={S.addListPill} activeOpacity={0.82}
            >
              <LinearGradient
                colors={['rgba(0,255,178,0.22)', 'rgba(0,255,178,0.08)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
              />
              <LinearGradient
                colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
              />
              <Text style={S.addListText}>+ List</Text>
            </TouchableOpacity>
          </ImageBackground>
          <View style={S.genreInfo}>
            <LinearGradient
              colors={['rgba(0,255,178,0.07)', 'rgba(3,15,12,0.5)']}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]}
            />
            <Text style={S.genreTitle} numberOfLines={2}>{item.title}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── CONTENT ROW (genre / category) ──────────────────────────────────────────
function ContentRow({ title, data, onSeeAll, onAddList }) {
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
        // Load cards lazily on scroll for large lists
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const insets        = useSafeAreaInsets();
  const scrollY       = useRef(new Animated.Value(0)).current;
  const { toast, showToast } = useToast();

  // State
  const [isConnected,    setIsConnected]    = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [featured,       setFeatured]       = useState([]);
  const [continuing,     setContinuing]     = useState([]);
  const [watchlist,      setWatchlist]      = useState([]);
  const [upcoming,       setUpcoming]       = useState([]);
  const [allMovies,      setAllMovies]      = useState([]);
  const [page,           setPage]           = useState(0);
  const [hasMore,        setHasMore]        = useState(true);
  const [loadingMore,    setLoadingMore]    = useState(false);

  // Entrance animation
  const entryOpac = useRef(new Animated.Value(0)).current;
  const entryY    = useRef(new Animated.Value(rs(24))).current;

  // Build genre/category map from allMovies
  const { genres, categories, genreMap, categoryMap } = useMemo(
    () => buildContentMap(allMovies),
    [allMovies]
  );

  // Deduplicate section keys (genres + categories minus overlaps)
  const sectionKeys = useMemo(() => {
    const catSet = new Set(categories.map(c => c.toLowerCase()));
    const genreOnly = genres.filter(g => !catSet.has(g.toLowerCase()));
    return [...categories, ...genreOnly];
  }, [genres, categories]);

  // ── Network listener ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? true;
      if (!connected) showToast('📡 No internet connection');
      setIsConnected(connected);
    });
    return () => unsub();
  }, []);

  // ── Initial load (skeleton shows for min 800ms) ────────────────────────────
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    const t = setTimeout(() => loadData(), 800);
    return () => { clearTimeout(t); StatusBar.setHidden(false, 'fade'); };
  }, []);

  // ── Entrance animation after load ─────────────────────────────────────────
  useEffect(() => {
    if (!loadingInitial) {
      Animated.parallel([
        Animated.timing(entryOpac, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.spring(entryY,    { toValue: 0, useNativeDriver: true, tension: 90, friction: 18 }),
      ]).start();
    }
  }, [loadingInitial]);

  // ── Primary data loader ────────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    try {
      // Run all independent fetches in parallel — single round-trip feel
      const [feat, cw, wl, up, movies] = await Promise.all([
        fetchFeatured()                    .catch(() => null),
        fetchContinueWatching(null)        .catch(() => null), // pass real userId
        fetchWatchlist(null)               .catch(() => null), // pass real userId
        fetchUpcoming()                    .catch(() => null),
        fetchMoviesByPage(0, PAGE_SIZE)    .catch(() => null),
      ]);

      setFeatured(   feat?.length   ? feat   : MOCK_FEATURED);
      setContinuing( cw?.length     ? cw     : MOCK_CONTINUE);
      setWatchlist(  wl?.length     ? wl     : MOCK_WATCHLIST);
      setUpcoming(   up?.length     ? up     : MOCK_UPCOMING);
      setAllMovies(  movies?.length ? movies : MOCK_ALL_MOVIES);
      setPage(1);
      setHasMore((movies?.length ?? 0) === PAGE_SIZE);

      if (isRefresh) showToast('✓ Content refreshed');
    } catch (e) {
      console.error('loadData error:', e);
      // Fallback to mock data silently
      setFeatured(MOCK_FEATURED);
      setContinuing(MOCK_CONTINUE);
      setWatchlist(MOCK_WATCHLIST);
      setUpcoming(MOCK_UPCOMING);
      setAllMovies(MOCK_ALL_MOVIES);
      showToast('⚠️ Using offline content');
    } finally {
      setLoadingInitial(false);
      setRefreshing(false);
    }
  }, []);

  // ── Load more movies on scroll end (pagination) ───────────────────────────
  const loadMoreMovies = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const more = await fetchMoviesByPage(page, PAGE_SIZE);
      if (more?.length) {
        setAllMovies(prev => [...prev, ...more]);
        setPage(p => p + 1);
        setHasMore(more.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.warn('loadMore error:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore, hasMore]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    loadData(true);
  }, [loadData]);

  // ── Add to watchlist ──────────────────────────────────────────────────────
  const handleAddList = useCallback(async (movie) => {
    try {
      await addToWatchlist(null, movie.id); // pass real userId
      setWatchlist(prev => {
        if (prev.find(m => m.id === movie.id)) return prev;
        return [movie, ...prev];
      });
      showToast(`✓ ${movie.title} added to My List`);
    } catch {
      showToast('Could not add to list. Try again.');
    }
  }, []);

  // ── Remove from watchlist ─────────────────────────────────────────────────
  const handleRemoveList = useCallback(async (movie) => {
    try {
      await removeFromWatchlist(null, movie.id); // pass real userId
      setWatchlist(prev => prev.filter(m => m.id !== movie.id));
      showToast(`Removed ${movie.title} from My List`);
    } catch {
      showToast('Could not remove. Try again.');
    }
  }, []);

  // ── Detect near-bottom to trigger loadMore ────────────────────────────────
  const handleScroll = useCallback(({ nativeEvent: ne }) => {
    const distFromBottom = ne.contentSize.height - ne.contentOffset.y - ne.layoutMeasurement.height;
    if (distFromBottom < rs(300) && !loadingMore && hasMore) loadMoreMovies();
  }, [loadingMore, hasMore, loadMoreMovies]);

  const bottomPad = Math.max(insets.bottom, 12) + rs(74);

  // ── No internet ───────────────────────────────────────────────────────────
  if (!isConnected && loadingInitial) {
    return (
      <View style={S.root}>
        <StatusBar hidden />
        <NoInternet onRetry={() => loadData()} />
      </View>
    );
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loadingInitial) {
    return (
      <View style={S.root}>
        <StatusBar hidden />
        <HomeSkeleton />
      </View>
    );
  }

  return (
    <View style={S.root}>
      <StatusBar hidden />

      {/* Sticky header */}
      <AppHeader scrollY={scrollY} navigation={navigation} />

      <Animated.ScrollView
        style={S.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          // Drive header animation
          Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )(e);
          // Pagination
          handleScroll(e);
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent, COLORS.accentDim]}
            progressBackgroundColor={COLORS.bg2}
          />
        }
      >
        <Animated.View style={{ opacity: entryOpac, transform: [{ translateY: entryY }] }}>

          {/* Hero carousel — only is_featured items */}
          {featured.length > 0 && (
            <HeroCarousel items={featured} navigation={navigation} onAddList={handleAddList} />
          )}

          {/* Continue watching — from watch_progress */}
          {continuing.length > 0 && (
            <View style={S.section}>
              <SectionHeader
                title="Continue Watching"
                onSeeAll={() => { console.log('SeeAll: ContinueWatching'); /* TODO: navigation.navigate('ContinueWatching') */ }}
              />
              <FlatList
                data={continuing}
                horizontal
                keyExtractor={i => i.movieId || i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.hPad}
                initialNumToRender={3}
                renderItem={({ item }) => <ContinueCard item={item} />}
              />
            </View>
          )}

          {/* My List — from watchlist */}
          {watchlist.length > 0 && (
            <View style={S.section}>
              <SectionHeader
                title="My List"
                onSeeAll={() => { console.log('SeeAll: Watchlist'); /* TODO: navigation.navigate('Watchlist') */ }}
              />
              <FlatList
                data={watchlist}
                horizontal
                keyExtractor={i => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.hPad}
                initialNumToRender={3}
                renderItem={({ item }) => <WatchlistCard item={item} onRemove={handleRemoveList} />}
              />
            </View>
          )}

          {/* Upcoming — is_upcoming = true, with countdown */}
          {upcoming.length > 0 && (
            <View style={S.section}>
              <SectionHeader
                title="Coming Soon"
                onSeeAll={() => { console.log('SeeAll: Upcoming'); /* TODO: navigation.navigate('ComingSoon') */ }}
              />
              <FlatList
                data={upcoming}
                horizontal
                keyExtractor={i => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.hPad}
                initialNumToRender={3}
                renderItem={({ item }) => <UpcomingCard item={item} />}
              />
            </View>
          )}

          {/* Dynamic category rows — all keys from DB category column */}
          {categories.map(cat => (
            <ContentRow
              key={`cat_${cat}`}
              title={cat.charAt(0).toUpperCase() + cat.slice(1)}
              data={categoryMap[cat]}
              onSeeAll={() => { console.log('SeeAll category:', cat); /* TODO: navigation.navigate('CategoryScreen', { category: cat }) */ }}
              onAddList={handleAddList}
            />
          ))}

          {/* Dynamic genre rows — all keys from DB genre column */}
          {genres.map(g => (
            <ContentRow
              key={`gen_${g}`}
              title={g}
              data={genreMap[g]}
              onSeeAll={() => { console.log('SeeAll genre:', g); /* TODO: navigation.navigate('GenreScreen', { genre: g }) */ }}
              onAddList={handleAddList}
            />
          ))}

          {/* Load-more indicator */}
          {loadingMore && (
            <View style={S.loadMoreWrap}>
              <ActivityIndicator color={COLORS.accent} size="small" />
              <Text style={S.loadMoreText}>Loading more…</Text>
            </View>
          )}

        </Animated.View>
      </Animated.ScrollView>

      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },

  // Skeleton
  skelContainer: { flex: 1, backgroundColor: COLORS.bg },

  // Loading more
  loadMoreWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: rs(20), gap: rs(10) },
  loadMoreText: { color: COLORS.textMuted, fontSize: rs(12) },

  // Toast
  toast: {
    position: 'absolute', bottom: rs(100), alignSelf: 'center',
    paddingHorizontal: rs(20), paddingVertical: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
    zIndex: 999, maxWidth: SW * 0.85,
    ...SHADOW.teal,
  },
  toastText: { color: COLORS.text, fontSize: rs(13), fontWeight: '600', textAlign: 'center' },

  // No internet
  noInternetWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: rs(32) },
  noInternetIcon: {
    width: rs(100), height: rs(100), borderRadius: rs(50),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.glassBorder,
    marginBottom: rs(24), ...SHADOW.teal,
  },
  noInternetEmoji: { fontSize: rs(44) },
  noInternetTitle: { color: COLORS.text, fontSize: rs(22), fontWeight: '800', marginBottom: rs(10), textAlign: 'center' },
  noInternetSub:   { color: COLORS.textSub, fontSize: rs(14), textAlign: 'center', lineHeight: rs(21), marginBottom: rs(32) },
  retryBtn: {
    paddingHorizontal: rs(32), paddingVertical: rs(13),
    borderRadius: rs(28), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.accentDim, ...SHADOW.teal,
  },
  retryText: { color: COLORS.bg, fontSize: rs(15), fontWeight: '800', letterSpacing: 0.5 },

  // Header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: rs(18),
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: rs(4) },
    shadowRadius: rs(14),
    elevation: 16,
  },
  headerBottomFade: {
    position: 'absolute', bottom: -rs(18), left: 0, right: 0, height: rs(18),
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  logoFGlow: {
    position: 'absolute', left: -rs(4), top: -rs(6),
    width: rs(34), height: rs(34), borderRadius: rs(17),
    backgroundColor: COLORS.redGlow,
  },
  logoF: {
    color: COLORS.red, fontSize: rs(30), fontWeight: '900',
    textShadowColor: COLORS.redGlow,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: rs(10), zIndex: 1,
  },
  logoCut1: {
    position: 'absolute', left: rs(3), top: rs(10),
    width: rs(13), height: rs(2),
    backgroundColor: COLORS.bg, borderRadius: 1,
    transform: [{ rotate: '12deg' }], zIndex: 2,
  },
  logoCut2: {
    position: 'absolute', left: rs(3), top: rs(17),
    width: rs(9), height: rs(2),
    backgroundColor: COLORS.bg, borderRadius: 1,
    transform: [{ rotate: '8deg' }], zIndex: 2,
  },
  logoRest: {
    color: COLORS.text, fontSize: rs(26), fontWeight: '800',
    letterSpacing: rs(3), marginLeft: rs(1),
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(19),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.glassBorder,
    ...SHADOW.teal,
  },

  // Hero
  heroWrap: { width: SW, overflow: 'hidden' },
  heroContent: { position: 'absolute', bottom: rs(46), left: rs(18), right: rs(18) },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(10), flexWrap: 'wrap' },
  heroBadge: {
    paddingHorizontal: rs(9), paddingVertical: rs(3),
    borderRadius: rs(5), overflow: 'hidden', marginRight: rs(8), ...SHADOW.teal,
  },
  heroBadgeText: { color: COLORS.bg, fontSize: rs(9), fontWeight: '900', letterSpacing: 1 },
  heroBadgeSep: { color: COLORS.textSub, fontSize: rs(11), marginRight: rs(4) },
  heroTitle: {
    color: COLORS.text, fontSize: rs(33), fontWeight: '900',
    letterSpacing: -rs(0.4), lineHeight: rs(39), marginBottom: rs(7),
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: rs(2) }, textShadowRadius: rs(8),
  },
  heroDesc: { color: COLORS.textSub, fontSize: rs(12), lineHeight: rs(18), marginBottom: rs(18) },
  heroBtnRow: { flexDirection: 'row', alignItems: 'center' },
  dotRow: {
    position: 'absolute', bottom: rs(14), left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: rs(6),
  },
  dot:        { height: rs(4), borderRadius: rs(2) },
  dotActive:  { width: rs(22), backgroundColor: COLORS.accent, shadowColor: COLORS.accent, shadowOpacity: 0.9, shadowRadius: rs(5) },
  dotInactive:{ width: rs(6),  backgroundColor: COLORS.textMuted },

  // Glass button
  glassBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: rs(18), paddingVertical: rs(10),
    borderRadius: rs(28), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.teal,
  },
  glassBtnAccent: { borderColor: COLORS.accentDim },
  glassBtnIcon:   { color: COLORS.textSub, fontSize: rs(13), marginRight: rs(6), fontWeight: '800' },
  glassBtnLabel:  { color: COLORS.textSub, fontSize: rs(12), fontWeight: '700', letterSpacing: 0.4 },

  // Section
  section:       { marginTop: rs(26) },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(18), marginBottom: rs(12),
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  titleAccentBar:  {
    width: rs(3), height: rs(18), borderRadius: rs(2),
    backgroundColor: COLORS.accent, marginRight: rs(8),
    shadowColor: COLORS.accent, shadowOpacity: 0.8, shadowRadius: rs(6),
  },
  sectionTitle: { color: COLORS.text, fontSize: rs(17), fontWeight: '800', letterSpacing: 0.2 },
  seeAllBtn: {
    paddingHorizontal: rs(12), paddingVertical: rs(5),
    borderRadius: rs(14), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  seeAllText: { color: COLORS.accent, fontSize: rs(10), fontWeight: '800', letterSpacing: 1 },
  hPad: { paddingHorizontal: rs(18), paddingRight: rs(6) },

  // Badges
  seriesBadge: {
    position: 'absolute', top: rs(7), left: rs(7),
    paddingHorizontal: rs(7), paddingVertical: rs(2),
    borderRadius: rs(5), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.40)',
  },
  seriesBadgeText: { color: COLORS.red, fontSize: rs(7), fontWeight: '900', letterSpacing: 0.8 },
  trendingBadge: {
    position: 'absolute', top: rs(7), right: rs(7),
    paddingHorizontal: rs(7), paddingVertical: rs(3),
    borderRadius: rs(5), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)',
  },
  trendingText: { color: COLORS.gold, fontSize: rs(7), fontWeight: '900', letterSpacing: 0.5 },
  newBadge: {
    position: 'absolute', bottom: rs(32), left: rs(7),
    paddingHorizontal: rs(7), paddingVertical: rs(2),
    borderRadius: rs(5), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  newBadgeText: { color: COLORS.accent, fontSize: rs(7), fontWeight: '900', letterSpacing: 0.8 },
  ratingChip: {
    position: 'absolute', bottom: rs(8), right: rs(7),
    paddingHorizontal: rs(7), paddingVertical: rs(3),
    borderRadius: rs(7), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.28)',
  },
  ratingText: { color: COLORS.gold, fontSize: rs(9), fontWeight: '700' },
  countdownChip: {
    position: 'absolute', bottom: rs(8), left: rs(7),
    paddingHorizontal: rs(8), paddingVertical: rs(3),
    borderRadius: rs(7), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  countdownText: { color: COLORS.accent, fontSize: rs(9), fontWeight: '700' },
  addListPill: {
    position: 'absolute', bottom: rs(8), left: rs(7),
    paddingHorizontal: rs(9), paddingVertical: rs(4),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  addListText: { color: COLORS.accent, fontSize: rs(9), fontWeight: '700' },

  // Continue watching card
  contCard: {
    width: rs(195), marginRight: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.dark,
  },
  contCardInner: { borderRadius: rs(11), overflow: 'hidden', backgroundColor: COLORS.bg2 },
  contPoster:    { width: '100%', height: rs(112) },
  progressOuter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: rs(8), paddingBottom: rs(7) },
  progressBg:    { height: rs(3), backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: rs(2) },
  progressFill:  {
    position: 'absolute', left: rs(8), bottom: rs(7),
    height: rs(3), backgroundColor: COLORS.accent, borderRadius: rs(2),
    shadowColor: COLORS.accent, shadowOpacity: 0.9, shadowRadius: rs(4),
  },
  contInfo:      { paddingHorizontal: rs(10), paddingVertical: rs(9), overflow: 'hidden' },
  contTitle:     { color: COLORS.text,    fontSize: rs(12), fontWeight: '700', marginBottom: rs(3) },
  contMeta:      { color: COLORS.textSub, fontSize: rs(10), fontWeight: '500' },

  // Poster card (watchlist + upcoming — same size)
  posterCard: {
    width: rs(130), marginRight: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.dark,
  },
  posterCardInner: { borderRadius: rs(11), overflow: 'hidden', backgroundColor: COLORS.bg2 },
  posterImg:       { width: '100%', height: rs(175) },
  posterInfo: { paddingHorizontal: rs(8), paddingVertical: rs(8), overflow: 'hidden' },
  posterTitle: {
    color: COLORS.text, fontSize: rs(11), fontWeight: '700',
    marginBottom: rs(7), lineHeight: rs(15),
  },
  removeListBtn: {
    paddingHorizontal: rs(10), paddingVertical: rs(4),
    borderRadius: rs(10), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, alignSelf: 'flex-start',
  },
  removeListText: { color: COLORS.accent, fontSize: rs(9), fontWeight: '700' },

  // Genre / category card
  genreCard: {
    width: rs(120), marginRight: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder, ...SHADOW.dark,
  },
  genreCardInner: { borderRadius: rs(11), overflow: 'hidden', backgroundColor: COLORS.bg2 },
  genreImg:       { width: '100%', height: rs(165) },
  genreInfo:      { paddingHorizontal: rs(8), paddingVertical: rs(8), overflow: 'hidden' },
  genreTitle:     { color: COLORS.text, fontSize: rs(11), fontWeight: '700', lineHeight: rs(15) },
});
