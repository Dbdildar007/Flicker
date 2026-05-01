// src/screens/HomeScreen.js
import React, {
  useRef, useEffect, useState, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, Animated, Dimensions, StatusBar,
  ImageBackground, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../data/theme';

// ─── Responsive helpers ────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const rs = (s) => {
  const { width } = Dimensions.get('window');
  if (width < 360) return Math.round(s * 0.86);
  if (width < 414) return Math.round(s * 0.93);
  if (width > 600) return Math.round(s * 1.1);
  return s;
};

const HERO_H          = SH * 0.62;
const HEADER_H        = rs(56);
const SCROLL_FADE_END = rs(100);

// ─── Supabase stub (replace with real client) ─────────────────────────────────
// import { supabase } from '../lib/supabase';
const supabase = { from: () => ({ select: () => ({ data: [], error: null }) }) };

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_FEATURED = [
  { id: 'f1', title: 'NEON REBELLION', description: 'In a world where light is currency, one survivor risks everything to unplug the system.', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900', hero_image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900', genre: ['Sci-Fi', 'Thriller'], year: 2024, rating: 8.4, newly_added: 'ORIGINAL', is_series: false },
  { id: 'f2', title: 'DARK HORIZON',   description: 'A rogue astronaut uncovers a conspiracy that spans galaxies and centuries.',               poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900', hero_image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900', genre: ['Sci-Fi', 'Drama'],    year: 2024, rating: 7.9, newly_added: null,       is_series: true  },
  { id: 'f3', title: 'CHROME CITY',    description: 'A detective navigates a dystopian megacity where AI rules the underworld.',              poster: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900', hero_image: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900', genre: ['Action', 'Thriller'], year: 2024, rating: 8.1, newly_added: 'NEW',      is_series: false },
];
const MOCK_CONTINUE = [
  { id: 'c1', title: 'Mars Colony',       poster: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=500', progress: 0.72, season: 2, episode: 4, remaining: '12m', is_series: true  },
  { id: 'c2', title: 'Midnight Protocol', poster: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500', progress: 0.38, season: 1, episode: 7, remaining: '28m', is_series: true  },
  { id: 'c3', title: 'Velocity',          poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500', progress: 0.55, season: null, episode: null, remaining: '54m', is_series: false },
];
const MOCK_WATCHLIST = [
  { id: 'w1', title: 'Orbital Decay',    poster: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=400', year: 2023, rating: 7.6, is_series: false },
  { id: 'w2', title: 'The Last Signal',  poster: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=400', year: 2024, rating: 8.2, is_series: true  },
  { id: 'w3', title: 'Phantom Circuit',  poster: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', year: 2023, rating: 7.1, is_series: false },
  { id: 'w4', title: 'Zero Gravity',     poster: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=400', year: 2024, rating: 7.8, is_series: true  },
];
const MOCK_UPCOMING = [
  { id: 'u1', title: 'Solar Drift',   poster: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=400', release_date: 'Jun 2025', is_series: false },
  { id: 'u2', title: 'Echo Chamber',  poster: 'https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=400', release_date: 'Jul 2025', is_series: true  },
  { id: 'u3', title: 'Iron Veil',     poster: 'https://images.unsplash.com/photo-1542372147193-a7aca54189cd?w=400', release_date: 'Aug 2025', is_series: false },
  { id: 'u4', title: 'Neon Ghosts',   poster: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400', release_date: 'Sep 2025', is_series: true  },
];
const MOCK_GENRE_MAP = {
  Action:   [{ id: 'a1', title: 'Velocity X',    poster: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400', rating: 7.8, is_series: false }, { id: 'a2', title: 'Thunder Run',   poster: 'https://images.unsplash.com/photo-1542372147193-a7aca54189cd?w=400', rating: 7.2, is_series: false }, { id: 'a3', title: 'Black Ops',     poster: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400', rating: 7.5, is_series: true  }],
  Drama:    [{ id: 'd1', title: 'Broken Ties',   poster: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400', rating: 8.3, is_series: true  }, { id: 'd2', title: 'Quiet Storm',   poster: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400', rating: 7.9, is_series: false }, { id: 'd3', title: 'Last Light',    poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400', rating: 8.1, is_series: false }],
  Thriller: [{ id: 't1', title: 'Shadow Line',   poster: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400', rating: 8.0, is_series: false }, { id: 't2', title: 'Deep State',    poster: 'https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=400', rating: 7.6, is_series: true  }, { id: 't3', title: 'The Mole',      poster: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400', rating: 7.4, is_series: false }],
  'Sci-Fi': [{ id: 's1', title: 'Quantum Rift',  poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400', rating: 8.5, is_series: false }, { id: 's2', title: 'Mars Born',     poster: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400', rating: 8.2, is_series: true  }, { id: 's3', title: 'Void Walker',   poster: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=400', rating: 7.7, is_series: false }],
};

// ─── Reusable press-scale hook ────────────────────────────────────────────────
function usePressScale(to = 0.94) {
  const anim = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(anim, { toValue: to,  useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onOut = () => Animated.spring(anim, { toValue: 1,   useNativeDriver: true, tension: 300, friction: 10 }).start();
  return { anim, onIn, onOut };
}

// ─── Glass pill button (reusable) ─────────────────────────────────────────────
function GlassBtn({ label, icon, accent, onPress, style }) {
  const { anim, onIn, onOut } = usePressScale(0.93);
  return (
    <TouchableOpacity
      onPress={onPress} onPressIn={onIn} onPressOut={onOut}
      activeOpacity={1} style={style}
    >
      <Animated.View style={[S.glassBtn, accent && S.glassBtnAccent, { transform: [{ scale: anim }] }]}>
        {/* Base fill */}
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
        {/* 3D top shine */}
        <LinearGradient
          colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.48 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
        />
        {/* Bottom inner shadow */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']}
          start={{ x: 0, y: 0.55 }} end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
        />
        {icon ? <Text style={[S.glassBtnIcon, accent && { color: COLORS.bg }]}>{icon}</Text> : null}
        <Text style={[S.glassBtnLabel, accent && { color: COLORS.bg }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Teal glass icon button ────────────────────────────────────────────────────
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

// ─── Series badge ──────────────────────────────────────────────────────────────
function SeriesBadge() {
  return (
    <View style={S.seriesBadge}>
      <LinearGradient
        colors={[COLORS.accentGlow, 'rgba(0,255,178,0.10)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(5) }]}
      />
      <Text style={S.seriesBadgeText}>SERIES</Text>
    </View>
  );
}

// ─── Rating chip ───────────────────────────────────────────────────────────────
function RatingChip({ rating }) {
  return (
    <View style={S.ratingChip}>
      <LinearGradient
        colors={['rgba(255,215,0,0.20)', 'rgba(255,215,0,0.08)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(7) }]}
      />
      <Text style={S.ratingText}>⭐ {Number(rating).toFixed(1)}</Text>
    </View>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, onSeeAll }) {
  return (
    <View style={S.sectionHeader}>
      <View style={S.sectionTitleRow}>
        {/* Teal accent bar */}
        <View style={S.titleAccentBar} />
        <Text style={S.sectionTitle}>{title}</Text>
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.75}>
          <View style={S.seeAllBtn}>
            <LinearGradient
              colors={['rgba(0,255,178,0.12)', 'rgba(0,255,178,0.05)']}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]}
            />
            <Text style={S.seeAllText}>SEE ALL</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Skeleton pulse ────────────────────────────────────────────────────────────
function Skeleton({ w, h, r = rs(10) }) {
  const o = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.6,  duration: 850, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.25, duration: 850, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: COLORS.glass, opacity: o }} />;
}

// ─── APP HEADER ───────────────────────────────────────────────────────────────
function AppHeader({ scrollY, navigation }) {
  const insets = useSafeAreaInsets();

  const bgColor = scrollY.interpolate({
    inputRange:  [0, SCROLL_FADE_END],
    outputRange: ['rgba(3,15,12,0.50)', 'rgba(3,15,12,0.97)'],
    extrapolate: 'clamp',
  });
  const borderO = scrollY.interpolate({
    inputRange:  [0, SCROLL_FADE_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const shadowO = scrollY.interpolate({
    inputRange:  [0, SCROLL_FADE_END],
    outputRange: [0, 0.7],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        S.header,
        {
          paddingTop: insets.top + rs(6),
          height: HEADER_H + insets.top,
          backgroundColor: bgColor,
          shadowOpacity: shadowO,
          borderBottomColor: borderO.interpolate({
            inputRange:  [0, 1],
            outputRange: [COLORS.accentBg, COLORS.glassBorder],
          }),
        },
      ]}
    >
      {/* Logo */}
      <View style={S.logoWrap}>
        {/* Glow behind F */}
        
        <Text style={S.logoF}>F</Text>
        {/* Cut lines on F */}
        <View style={S.logoCut1} />
      
       
      </View>

      {/* Right icons */}
      <View style={S.headerRight}>
        <View style={{ width: rs(10) }} />
        <IconBtn icon="👤"  onPress={() => {
          console.log('Profile pressed');
          // TODO: navigation.navigate('ProfileScreen', { transition: 'slide_from_right' });
        }} />
      </View>
    </Animated.View>
  );
}

// ─── HERO CAROUSEL ────────────────────────────────────────────────────────────
function HeroCarousel({ items, navigation }) {
  const [idx, setIdx]       = useState(0);
  const fadeAnim            = useRef(new Animated.Value(1)).current;
  const slideAnim           = useRef(new Animated.Value(0)).current;
  const timerRef            = useRef(null);

  const goTo = useCallback((nextIdx, dir = 1) => {
    clearInterval(timerRef.current);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,          duration: 200, useNativeDriver: true }),
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
        <ImageBackground
          source={{ uri: item.hero_image || item.poster }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          {/* 4-stop vertical gradient */}
          <LinearGradient
            colors={['rgba(3,15,12,0.15)', 'rgba(3,15,12,0.0)', 'rgba(3,15,12,0.55)', 'rgba(3,15,12,1.0)']}
            locations={[0, 0.22, 0.62, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Left vignette */}
          <LinearGradient
            colors={['rgba(3,15,12,0.60)', 'rgba(3,15,12,0.0)']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Teal ambient bottom glow */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', COLORS.accentBg]}
            start={{ x: 0.5, y: 0.7 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      </Animated.View>

      {/* Content */}
      <Animated.View style={[S.heroContent, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {/* Badges */}
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
          {item.genre?.slice(0, 2).map((g) => (
            <Text key={g} style={S.heroBadgeSep}>· {g}</Text>
          ))}
          {item.year && <Text style={S.heroBadgeSep}>· {item.year}</Text>}
          {item.is_series && <Text style={S.heroBadgeSep}>· SERIES</Text>}
        </View>

        <Text style={S.heroTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={S.heroDesc}  numberOfLines={3}>{item.description}</Text>

        {/* CTA row */}
        <View style={S.heroBtnRow}>
          <GlassBtn
            accent icon="▶" label="Play Now"
            onPress={() => {
              console.log('Play:', item.id);
              // TODO: navigation.navigate('Player', { movieId: item.id, transition: 'zoom_from_center' });
            }}
            style={{ marginRight: rs(12) }}
          />
          <GlassBtn
            icon="＋" label="My List"
            onPress={() => {
              console.log('Add to list:', item.id);
              // TODO: supabase.from('watchlist').insert({ user_id, movie_id: item.id });
            }}
          />
        </View>
      </Animated.View>

      {/* Dot indicators */}
      <View style={S.dotRow}>
        {items.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i, i > idx ? 1 : -1)} activeOpacity={0.8}>
            <Animated.View style={[S.dot, i === idx ? S.dotActive : S.dotInactive]} />
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
      onPress={() => {
        console.log('Resume:', item.id);
        // TODO: navigation.navigate('Player', { movieId: item.id, resume: true, transition: 'zoom_from_card' });
      }}
    >
      <Animated.View style={[S.contCard, { transform: [{ scale: anim }] }]}>
        {/* Outer glass border glow */}
        <LinearGradient
          colors={[COLORS.glassBorder, 'rgba(0,255,178,0.06)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
        />
        <View style={S.contCardInner}>
          <ImageBackground
            source={{ uri: item.poster }}
            style={S.contPoster}
            imageStyle={{ borderRadius: rs(10), borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
          >
            <LinearGradient
              colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.82)']}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]}
            />
            {item.is_series && <SeriesBadge />}
            {/* Progress bar */}
            <View style={S.progressOuter}>
              <View style={S.progressBg} />
              <View style={[S.progressFill, { width: `${Math.round((item.progress || 0) * 100)}%` }]} />
            </View>
          </ImageBackground>

          {/* Info glass layer */}
          <View style={S.contInfo}>
            <LinearGradient
              colors={['rgba(0,255,178,0.07)', 'rgba(3,15,12,0.4)']}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]}
            />
            <Text style={S.contTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={S.contMeta}>
              {item.is_series ? `S${item.season} E${item.episode} · ` : ''}{item.remaining} left
            </Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── WATCHLIST CARD ───────────────────────────────────────────────────────────
function WatchlistCard({ item }) {
  const { anim, onIn, onOut } = usePressScale(0.95);
  return (
    <TouchableOpacity
      onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      onPress={() => {
        console.log('Watchlist item:', item.id);
        // TODO: navigation.navigate('MovieDetail', { movieId: item.id, transition: 'slide_from_bottom' });
      }}
    >
      <Animated.View style={[S.posterCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient
          colors={[COLORS.glassBorder, 'rgba(0,255,178,0.05)']}
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
            {item.is_series && <SeriesBadge />}
            <RatingChip rating={item.rating} />
          </ImageBackground>

          {/* Bottom glass info */}
          <View style={S.posterInfo}>
            <LinearGradient
              colors={['rgba(0,255,178,0.08)', 'rgba(3,15,12,0.5)']}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]}
            />
            <Text style={S.posterTitle} numberOfLines={2}>{item.title}</Text>
            <TouchableOpacity
              onPress={() => {
                console.log('Remove from list:', item.id);
                // TODO: supabase.from('watchlist').delete().eq('movie_id', item.id).eq('user_id', userId);
              }}
              style={S.removeListBtn}
              activeOpacity={0.8}
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
      onPress={() => {
        console.log('Upcoming:', item.id);
        // TODO: navigation.navigate('ComingSoon', { movieId: item.id, transition: 'slide_from_right' });
      }}
    >
      <Animated.View style={[S.upCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient
          colors={[COLORS.glassBorder, 'rgba(0,255,178,0.05)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
        />
        <View style={S.upCardInner}>
          <ImageBackground
            source={{ uri: item.poster }}
            style={S.upImg}
            imageStyle={{ borderTopLeftRadius: rs(10), borderTopRightRadius: rs(10) }}
          >
            <LinearGradient
              colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.85)']}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]}
            />
            {item.is_series && <SeriesBadge />}
            {/* Release date chip */}
            <View style={S.releaseDateChip}>
              <LinearGradient
                colors={[COLORS.accentGlow, 'rgba(0,255,178,0.12)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(7) }]}
              />
              <Text style={S.releaseDateText}>{item.release_date}</Text>
            </View>
          </ImageBackground>
          <View style={S.upInfo}>
            <LinearGradient
              colors={['rgba(0,255,178,0.07)', 'rgba(3,15,12,0.4)']}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]}
            />
            <Text style={S.upTitle} numberOfLines={2}>{item.title}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── GENRE MOVIE CARD ─────────────────────────────────────────────────────────
function GenreCard({ item }) {
  const { anim, onIn, onOut } = usePressScale(0.94);
  return (
    <TouchableOpacity
      onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      onPress={() => {
        console.log('Movie:', item.id);
        // TODO: navigation.navigate('MovieDetail', { movieId: item.id, transition: 'zoom_from_card' });
      }}
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
            {item.is_series && <SeriesBadge />}
            <RatingChip rating={item.rating} />

            {/* + List pill overlay */}
            <TouchableOpacity
              onPress={() => {
                console.log('Add to list:', item.id);
                // TODO: supabase.from('watchlist').insert({ user_id, movie_id: item.id });
              }}
              style={S.addListPill}
              activeOpacity={0.82}
            >
              <LinearGradient
                colors={['rgba(0,255,178,0.20)', 'rgba(0,255,178,0.08)']}
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
              colors={['rgba(0,255,178,0.07)', 'rgba(3,15,12,0.4)']}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]}
            />
            <Text style={S.genreTitle} numberOfLines={2}>{item.title}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── GENRE ROW ────────────────────────────────────────────────────────────────
function GenreRow({ genre, movies }) {
  if (!movies?.length) return null;
  return (
    <View style={S.section}>
      <SectionHeader
        title={genre}
        onSeeAll={() => {
          console.log('See All genre:', genre);
          // TODO: navigation.navigate('GenreScreen', { genre, transition: 'slide_from_right' });
        }}
      />
      <FlatList
        data={movies}
        horizontal
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.hPad}
        renderItem={({ item }) => <GenreCard item={item} />}
      />
    </View>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const insets  = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [loading,    setLoading]    = useState(true);
  const [featured,   setFeatured]   = useState([]);
  const [continuing, setContinuing] = useState([]);
  const [watchlist,  setWatchlist]  = useState([]);
  const [upcoming,   setUpcoming]   = useState([]);
  const [genreMap,   setGenreMap]   = useState({});
  const [genres,     setGenres]     = useState([]);

  // Content entrance
  const entryOpac = useRef(new Animated.Value(0)).current;
  const entryY    = useRef(new Animated.Value(rs(24))).current;

  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    fetchAll();
    return () => StatusBar.setHidden(false, 'fade');
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(entryOpac, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.spring(entryY,    { toValue: 0, useNativeDriver: true, tension: 90, friction: 18 }),
      ]).start();
    }
  }, [loading]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);

      // ── Featured ────────────────────────────────────────────────────────
      // const { data } = await supabase.from('movies').select('*').eq('is_featured', true).limit(5);
      setFeatured(MOCK_FEATURED);

      // ── Continue watching ────────────────────────────────────────────────
      // const { data } = await supabase.from('movies')
      //   .select('*, watchlist!inner(user_id, progress, season, episode)')
      //   .eq('watchlist.user_id', userId)
      //   .order('watchlist.updated_at', { ascending: false }).limit(10);
      setContinuing(MOCK_CONTINUE);

      // ── My watchlist ─────────────────────────────────────────────────────
      // const { data } = await supabase.from('watchlist')
      //   .select('movies(*)').eq('user_id', userId);
      // setWatchlist(data.map(d => d.movies));
      setWatchlist(MOCK_WATCHLIST);

      // ── Upcoming ─────────────────────────────────────────────────────────
      // const { data } = await supabase.from('movies').select('*').eq('newly_added','UPCOMING').limit(8);
      setUpcoming(MOCK_UPCOMING);

      // ── All genres dynamically from DB ────────────────────────────────────
      // const { data: allMovies } = await supabase.from('movies')
      //   .select('id,title,poster,rating,genre,is_series');
      // const map = {};
      // allMovies?.forEach(m => m.genre?.forEach(g => { map[g] = [...(map[g]||[]), m]; }));
      // setGenreMap(map); setGenres(Object.keys(map));
      setGenreMap(MOCK_GENRE_MAP);
      setGenres(Object.keys(MOCK_GENRE_MAP));

    } catch (e) {
      console.error('fetchAll error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const bottomPad = Math.max(insets.bottom, 12) + rs(74);

  if (loading) {
    return (
      <View style={S.loadWrap}>
        <StatusBar hidden />
        <View style={S.loadLogoWrap}>
          <View style={S.loadLogoGlow} />
          <Text style={S.loadLogoF}>F</Text>
          <Text style={S.loadLogoRest}>LICKS</Text>
        </View>
        <ActivityIndicator color={COLORS.accent} size="large" style={{ marginTop: rs(28) }} />
        <Text style={S.loadText}>Loading…</Text>
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
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <Animated.View style={{ opacity: entryOpac, transform: [{ translateY: entryY }] }}>

          {/* Hero carousel */}
          {featured.length > 0 && <HeroCarousel items={featured} navigation={navigation} />}

          {/* Continue watching */}
          {continuing.length > 0 && (
            <View style={S.section}>
              <SectionHeader
                title="Continue Watching"
                onSeeAll={() => {
                  console.log('See All: Continue Watching');
                  // TODO: navigation.navigate('ContinueWatching', { transition: 'slide_from_right' });
                }}
              />
              <FlatList
                data={continuing}
                horizontal
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.hPad}
                renderItem={({ item }) => <ContinueCard item={item} />}
              />
            </View>
          )}

          {/* My list */}
          {watchlist.length > 0 && (
            <View style={S.section}>
              <SectionHeader
                title="My List"
                onSeeAll={() => {
                  console.log('See All: My List');
                  // TODO: navigation.navigate('Watchlist', { transition: 'slide_from_right' });
                }}
              />
              <FlatList
                data={watchlist}
                horizontal
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.hPad}
                renderItem={({ item }) => <WatchlistCard item={item} />}
              />
            </View>
          )}

          {/* Coming soon */}
          {upcoming.length > 0 && (
            <View style={S.section}>
              <SectionHeader
                title="Coming Soon"
                onSeeAll={() => {
                  console.log('See All: Coming Soon');
                  // TODO: navigation.navigate('ComingSoon', { transition: 'slide_from_right' });
                }}
              />
              <FlatList
                data={upcoming}
                horizontal
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.hPad}
                renderItem={({ item }) => <UpcomingCard item={item} />}
              />
            </View>
          )}

          {/* Dynamic genre rows */}
          {genres.map((g) => (
            <GenreRow key={g} genre={g} movies={genreMap[g]} />
          ))}

        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── STYLESHEET ───────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },

  // Loading
  loadWrap: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  loadLogoWrap:  { flexDirection: 'row', alignItems: 'flex-end', position: 'relative' },
  loadLogoGlow:  {
    position: 'absolute', left: -rs(8), top: -rs(8),
    width: rs(60), height: rs(60), borderRadius: rs(30),
    backgroundColor: COLORS.redGlow,
  },
  loadLogoF:    { color: COLORS.red, fontSize: rs(52), fontWeight: '900', letterSpacing: -1 },
  loadLogoRest: { color: COLORS.text, fontSize: rs(38), fontWeight: '800', letterSpacing: rs(3), paddingBottom: rs(4) },
  loadText:     { color: COLORS.textMuted, fontSize: rs(13), marginTop: rs(14), letterSpacing: 1 },

  // Header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: rs(18), borderBottomWidth: 1,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: rs(4) },
    shadowRadius: rs(14),
    elevation: 16,
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  logoFGlow: {
    position: 'absolute', left: -rs(4), top: -rs(4),
    width: rs(36), height: rs(36), borderRadius: rs(18),
    backgroundColor: COLORS.redGlow,
  },
  logoF: {
    color: COLORS.red, fontSize: rs(30), fontWeight: '900',
    textShadowColor: COLORS.redGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: rs(10),
    zIndex: 1,
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
  heroContent: {
    position: 'absolute', bottom: rs(50),
    left: rs(18), right: rs(18),
  },
  heroBadgeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: rs(10), flexWrap: 'wrap',
  },
  heroBadge: {
    paddingHorizontal: rs(9), paddingVertical: rs(3),
    borderRadius: rs(5), overflow: 'hidden', marginRight: rs(8),
    ...SHADOW.teal,
  },
  heroBadgeText: {
    color: COLORS.bg, fontSize: rs(9), fontWeight: '900', letterSpacing: 1,
  },
  heroBadgeSep: { color: COLORS.textSub, fontSize: rs(11), marginRight: rs(4) },
  heroTitle: {
    color: COLORS.text, fontSize: rs(34), fontWeight: '900',
    letterSpacing: -rs(0.5), lineHeight: rs(40), marginBottom: rs(8),
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: rs(2) },
    textShadowRadius: rs(8),
  },
  heroDesc: {
    color: COLORS.textSub, fontSize: rs(13), lineHeight: rs(20),
    marginBottom: rs(20), letterSpacing: 0.1,
  },
  heroBtnRow: { flexDirection: 'row', alignItems: 'center' },

  // Glass button
  glassBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: rs(20), paddingVertical: rs(11),
    borderRadius: rs(28), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
    ...SHADOW.teal,
  },
  glassBtnAccent: { borderColor: COLORS.accentDim, ...SHADOW.teal },
  glassBtnIcon:   { color: COLORS.textSub, fontSize: rs(14), marginRight: rs(7), fontWeight: '800' },
  glassBtnLabel:  { color: COLORS.textSub, fontSize: rs(13), fontWeight: '700', letterSpacing: 0.4 },

  // Hero dots
  dotRow: {
    position: 'absolute', bottom: rs(16),
    left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: rs(6),
  },
  dot:         { height: rs(4), borderRadius: rs(2) },
  dotActive:   {
    width: rs(22), backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent, shadowOpacity: 0.9, shadowRadius: rs(5),
  },
  dotInactive: { width: rs(6), backgroundColor: COLORS.textMuted },

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
  sectionTitle: {
    color: COLORS.text, fontSize: rs(17), fontWeight: '800', letterSpacing: 0.2,
  },
  seeAllBtn: {
    paddingHorizontal: rs(12), paddingVertical: rs(5),
    borderRadius: rs(14), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  seeAllText: {
    color: COLORS.accent, fontSize: rs(10), fontWeight: '800', letterSpacing: 1,
  },
  hPad: { paddingHorizontal: rs(18), paddingRight: rs(6) },

  // Series badge
  seriesBadge: {
    position: 'absolute', top: rs(7), left: rs(7),
    paddingHorizontal: rs(7), paddingVertical: rs(2),
    borderRadius: rs(5), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  seriesBadgeText: {
    color: COLORS.accent, fontSize: rs(7), fontWeight: '900', letterSpacing: 0.8,
  },

  // Rating chip
  ratingChip: {
    position: 'absolute', bottom: rs(8), right: rs(7),
    paddingHorizontal: rs(7), paddingVertical: rs(3),
    borderRadius: rs(7), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.28)',
  },
  ratingText: { color: COLORS.gold, fontSize: rs(9), fontWeight: '700' },

  // Continue watching
  contCard: {
    width: rs(195), marginRight: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
    ...SHADOW.dark,
  },
  contCardInner: { borderRadius: rs(11), overflow: 'hidden', backgroundColor: COLORS.bg2 },
  contPoster:    { width: '100%', height: rs(110) },
  progressOuter: {
    position: 'absolute', bottom: 0,
    left: 0, right: 0,
    paddingHorizontal: rs(8), paddingBottom: rs(7),
  },
  progressBg: {
    height: rs(3), backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: rs(2),
  },
  progressFill: {
    position: 'absolute', left: rs(8), bottom: rs(7),
    height: rs(3), backgroundColor: COLORS.accent,
    borderRadius: rs(2),
    shadowColor: COLORS.accent, shadowOpacity: 0.9, shadowRadius: rs(4),
  },
  contInfo: {
    paddingHorizontal: rs(10), paddingVertical: rs(9),
    overflow: 'hidden',
  },
  contTitle: { color: COLORS.text,    fontSize: rs(12), fontWeight: '700', marginBottom: rs(3) },
  contMeta:  { color: COLORS.textSub, fontSize: rs(10), fontWeight: '500' },

  // Poster card (watchlist + upcoming)
  posterCard: {
    width: rs(132), marginRight: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
    ...SHADOW.dark,
  },
  posterCardInner: { borderRadius: rs(11), overflow: 'hidden', backgroundColor: COLORS.bg2 },
  posterImg:       { width: '100%', height: rs(178) },
  posterInfo: {
    paddingHorizontal: rs(8), paddingVertical: rs(8),
    overflow: 'hidden',
  },
  posterTitle: {
    color: COLORS.text, fontSize: rs(11), fontWeight: '700',
    marginBottom: rs(7), lineHeight: rs(15),
  },
  removeListBtn: {
    paddingHorizontal: rs(10), paddingVertical: rs(4),
    borderRadius: rs(10), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
    alignSelf: 'flex-start',
  },
  removeListText: { color: COLORS.accent, fontSize: rs(9), fontWeight: '700' },

  // Upcoming
  upCard: {
    width: rs(132), marginRight: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
    ...SHADOW.dark,
  },
  upCardInner: { borderRadius: rs(11), overflow: 'hidden', backgroundColor: COLORS.bg2 },
  upImg:       { width: '100%', height: rs(178) },
  upInfo: {
    paddingHorizontal: rs(8), paddingVertical: rs(8),
    overflow: 'hidden',
  },
  upTitle: { color: COLORS.text, fontSize: rs(11), fontWeight: '700', lineHeight: rs(15) },
  releaseDateChip: {
    position: 'absolute', bottom: rs(8), left: rs(7),
    paddingHorizontal: rs(8), paddingVertical: rs(3),
    borderRadius: rs(7), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  releaseDateText: { color: COLORS.accent, fontSize: rs(9), fontWeight: '700' },

  // Genre card
  genreCard: {
    width: rs(122), marginRight: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
    ...SHADOW.dark,
  },
  genreCardInner: { borderRadius: rs(11), overflow: 'hidden', backgroundColor: COLORS.bg2 },
  genreImg:       { width: '100%', height: rs(168) },
  genreInfo: {
    paddingHorizontal: rs(8), paddingVertical: rs(8),
    overflow: 'hidden',
  },
  genreTitle: { color: COLORS.text, fontSize: rs(11), fontWeight: '700', lineHeight: rs(15) },
  addListPill: {
    position: 'absolute', bottom: rs(8), left: rs(7),
    paddingHorizontal: rs(9), paddingVertical: rs(4),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  addListText: { color: COLORS.accent, fontSize: rs(9), fontWeight: '700' },
});
