/**
 * MovieDetails.js — Netflix-Style Production Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * CHANGES:
 * 1. Transparent header (80%) with trailer playing behind it
 * 2. Play/pause/replay controls ONLY on video, show on tap, hide on tap elsewhere
 * 3. Below video: only progress bar + remaining time + sound icon
 * 4. No border on video — edge-to-edge like Netflix
 * 5. Full Netflix-mimicry: hero trailer autoplay, fades to info card
 * 6. Receives full movie object from HomeScreen navigation params
 * 7. Uses movieId to fetch cast/crew/comments; movie object for hero display
 * 8. Full-screen attractive shimmer loader
 * 9. Fully optimized, responsive, production-grade
 */

import React, {
  useRef, useEffect, useState, useCallback, memo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, TouchableWithoutFeedback,
  Animated, Dimensions, StatusBar, ImageBackground,
  ActivityIndicator, TextInput, Modal, Platform,
  KeyboardAvoidingView, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../data/theme';
import {
  fetchMovieById,
  fetchCastByMovieId,
  fetchSimilarMovies,
  fetchCommentsByMovieId,
  postComment,
  toggleLike,
  toggleWatchlist,
  rateMovie,
  fetchSeasonsBySeriesId,
  fetchEpisodesBySeasonId,
  getCurrentUser,
} from '../lib/supabase';

// ─── Responsive ───────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const rs = (s) => {
  const { width: w } = Dimensions.get('window');
  if (w < 360) return Math.round(s * 0.86);
  if (w < 414) return Math.round(s * 0.93);
  if (w > 600) return Math.round(s * 1.08);
  return s;
};

// ─── Design Tokens ────────────────────────────────────────────────────────────
const ACCENT = '#00FFB2';
const ACCENT_DIM = '#00CC90';
const BG = COLORS?.bg || '#030F0C';
const GLASS_BORDER = 'rgba(255,255,255,0.13)';
const GLASS_BG = 'rgba(255,255,255,0.07)';
const GLASS_HIGH = 'rgba(255,255,255,0.18)';
const HERO_H = SH * 0.54; // Netflix hero height

// ─── Mock Data (Fallbacks) ────────────────────────────────────────────────────
const MOCK_MOVIE = {
  id: 'm1',
  title: 'NEBULA ASCENT',
  description: 'In a world submerged beneath the crystalline oceans of Kepler-186f, Captain Elara Vance must lead a desperate expedition into the forbidden Nebula Trench to recover a lost energy source that could save the last remaining human enclave from an encroaching deep-sea parasite.',
  poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900',
  hero_image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900',
  trailer_url: null,
  video_url: null,
  genre: ['Action', 'Sci-Fi'],
  category: ['originals'],
  year: 2024,
  rating: 8.9,
  duration: '154 MIN',
  language: 'English',
  is_series: false,
  is_trending: true,
  newly_added: 'ORIGINAL',
  is_4k: true,
  is_hdr: true,
  likes_count: 4821,
  user_liked: false,
  user_watchlisted: false,
  user_rating: 0,
};

const MOCK_CAST = [
  { id: 'c1', name: 'Marcus Thorne', character: 'Captain Elara', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' },
  { id: 'c2', name: 'Aria Lyra', character: 'The Oracle', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' },
  { id: 'c3', name: 'Dax Byrd', character: 'Commander', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' },
  { id: 'c4', name: 'Nova Chen', character: 'Engineer', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200' },
  { id: 'c5', name: 'Rex Valor', character: 'Pilot', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200' },
];

const MOCK_SIMILAR = [
  { id: 's1', title: 'Dark Horizon', poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400', rating: 7.9, is_series: false },
  { id: 's2', title: 'Chrome City', poster: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400', rating: 8.1, is_series: true },
  { id: 's3', title: 'Quantum Rift', poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400', rating: 8.5, is_series: false },
  { id: 's4', title: 'Solar Drift', poster: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=400', rating: 7.6, is_series: false },
  { id: 's5', title: 'Iron Veil', poster: 'https://images.unsplash.com/photo-1542372147193-a7aca54189cd?w=400', rating: 7.1, is_series: true },
  { id: 's6', title: 'Mars Born', poster: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400', rating: 8.2, is_series: false },
];

const MOCK_COMMENTS = [
  { id: 'cm1', user_id: 'u1', username: 'nebula_fan', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', text: 'Absolutely stunning visuals! The underwater scenes are breathtaking.', created_at: '2024-12-01T10:00:00Z', likes: 42 },
  { id: 'cm2', user_id: 'u2', username: 'sci_fi_lover', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', text: 'Best sci-fi of the year, hands down. The story is gripping from start to finish!', created_at: '2024-12-02T14:30:00Z', likes: 28 },
  { id: 'cm3', user_id: 'u3', username: 'moviecritic99', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', text: 'Marcus Thorne delivers a performance of a lifetime. Wow.', created_at: '2024-12-03T09:15:00Z', likes: 15 },
  { id: 'cm4', user_id: 'u4', username: 'cinephile_x', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100', text: 'The soundtrack alone deserves an award. Every scene hits differently.', created_at: '2024-12-04T18:45:00Z', likes: 33 },
];

const MOCK_SEASONS = [
  { id: 'sea1', series_id: 'm1', season_number: 1 },
  { id: 'sea2', series_id: 'm1', season_number: 2 },
];

const MOCK_EPISODES = {
  sea1: [
    { id: 'ep1', season_id: 'sea1', episode_number: 1, title: 'Into the Deep', duration: '48m', description: 'Captain Elara discovers the forbidden trench.', thumbnail_url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400', video_url: null },
    { id: 'ep2', season_id: 'sea1', episode_number: 2, title: 'The Oracle Speaks', duration: '52m', description: 'A mysterious signal leads the crew deeper.', thumbnail_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400', video_url: null },
    { id: 'ep3', season_id: 'sea1', episode_number: 3, title: 'Phantom Circuit', duration: '45m', description: 'The energy source pulses with alien life.', thumbnail_url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400', video_url: null },
  ],
  sea2: [
    { id: 'ep4', season_id: 'sea2', episode_number: 1, title: 'Surface Tension', duration: '55m', description: 'Season 2 begins with a shocking revelation.', thumbnail_url: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=400', video_url: null },
    { id: 'ep5', season_id: 'sea2', episode_number: 2, title: 'Dark Waters', duration: '49m', description: 'The parasite evolves beyond expectations.', thumbnail_url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400', video_url: null },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const limitWords = (str = '', max = 18) => {
  if (!str) return '';
  const words = str.split(' ');
  return words.length <= max ? str : words.slice(0, max).join(' ') + '…';
};
const limitChars = (str = '', max = 120) => {
  if (!str || str.length <= max) return str;
  return str.slice(0, max) + '…';
};
const formatTime = (secs) => {
  const s = Math.floor(secs || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ─── Press Scale Hook ─────────────────────────────────────────────────────────
function usePressScale(to = 0.93) {
  const a = useRef(new Animated.Value(1)).current;
  const cfg = { useNativeDriver: true, tension: 300, friction: 10 };
  return {
    anim: a,
    onIn: () => Animated.spring(a, { toValue: to, ...cfg }).start(),
    onOut: () => Animated.spring(a, { toValue: 1, ...cfg }).start(),
  };
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [state, setState] = useState({ msg: '', visible: false });
  const t = useRef(null);
  const show = useCallback((msg, ms = 1800) => {
    clearTimeout(t.current);
    setState({ msg, visible: true });
    t.current = setTimeout(() => setState(s => ({ ...s, visible: false })), ms);
  }, []);
  return { toast: state, showToast: show };
}

// ─── FULL-SCREEN SHIMMER ─────────────────────────────────────────────────────
const FullScreenShimmer = memo(() => {
  const shimA = useRef(new Animated.Value(0)).current;
  const scanA = useRef(new Animated.Value(-SW)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimA, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(shimA, { toValue: 0.3, duration: 1100, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(scanA, { toValue: SW, duration: 1600, useNativeDriver: true })
    ).start();
  }, []);

  const shimOpac = shimA.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.28] });

  const ShimBlock = ({ w, h, br = rs(10), mt = 0, ml = 0 }) => (
    <Animated.View style={{
      width: w, height: h, borderRadius: br,
      marginTop: mt, marginLeft: ml,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.08)',
    }}>
      <Animated.View style={[StyleSheet.absoluteFill, {
        transform: [{ translateX: scanA }],
      }]}>
        <LinearGradient
          colors={['transparent', 'rgba(0,255,178,0.12)', 'rgba(255,255,255,0.18)', 'rgba(0,255,178,0.12)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ width: SW * 0.5, height: '100%' }}
        />
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar hidden />
      {/* Hero shimmer */}
      <ShimBlock w={SW} h={HERO_H} br={0} />
      {/* Gradient overlay on hero */}
      <LinearGradient
        colors={['transparent', 'rgba(3,15,12,0.6)', BG]}
        style={{ position: 'absolute', top: HERO_H * 0.4, left: 0, right: 0, height: HERO_H * 0.6 }}
      />
      {/* Content shimmers */}
      <View style={{ paddingHorizontal: rs(18), marginTop: rs(20) }}>
        {/* Genre badges */}
        <View style={{ flexDirection: 'row', gap: rs(8), marginBottom: rs(16) }}>
          <ShimBlock w={rs(65)} h={rs(26)} br={rs(13)} />
          <ShimBlock w={rs(55)} h={rs(26)} br={rs(13)} />
          <ShimBlock w={rs(45)} h={rs(26)} br={rs(13)} />
        </View>
        {/* Title */}
        <ShimBlock w={SW * 0.72} h={rs(34)} br={rs(8)} />
        <ShimBlock w={SW * 0.45} h={rs(22)} br={rs(8)} mt={rs(10)} />
        {/* Meta chips */}
        <View style={{ flexDirection: 'row', gap: rs(8), marginTop: rs(14) }}>
          {[rs(80), rs(70), rs(90), rs(60)].map((w, i) => (
            <ShimBlock key={i} w={w} h={rs(32)} br={rs(10)} />
          ))}
        </View>
        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: rs(10), marginTop: rs(22) }}>
          <ShimBlock w={(SW - rs(56)) / 3} h={rs(70)} br={rs(14)} />
          <ShimBlock w={(SW - rs(56)) / 3} h={rs(70)} br={rs(14)} />
          <ShimBlock w={(SW - rs(56)) / 3} h={rs(70)} br={rs(14)} />
        </View>
        {/* Synopsis block */}
        <ShimBlock w={SW - rs(36)} h={rs(90)} br={rs(14)} mt={rs(22)} />
        {/* Cast section title */}
        <ShimBlock w={rs(120)} h={rs(22)} br={rs(6)} mt={rs(28)} />
        {/* Cast avatars */}
        <View style={{ flexDirection: 'row', gap: rs(12), marginTop: rs(14) }}>
          {[...Array(4)].map((_, i) => (
            <View key={i} style={{ alignItems: 'center', gap: rs(8) }}>
              <ShimBlock w={rs(64)} h={rs(64)} br={rs(32)} />
              <ShimBlock w={rs(52)} h={rs(10)} br={rs(5)} />
            </View>
          ))}
        </View>
        {/* Tab row */}
        <View style={{ flexDirection: 'row', gap: rs(16), marginTop: rs(28) }}>
          <ShimBlock w={rs(120)} h={rs(32)} br={rs(8)} />
          <ShimBlock w={rs(130)} h={rs(32)} br={rs(8)} />
        </View>
        {/* Grid cards */}
        <View style={{ flexDirection: 'row', gap: rs(12), marginTop: rs(16) }}>
          <ShimBlock w={(SW - rs(48)) / 2} h={rs(170)} br={rs(14)} />
          <ShimBlock w={(SW - rs(48)) / 2} h={rs(170)} br={rs(14)} />
        </View>
        <View style={{ flexDirection: 'row', gap: rs(12), marginTop: rs(12) }}>
          <ShimBlock w={(SW - rs(48)) / 2} h={rs(170)} br={rs(14)} />
          <ShimBlock w={(SW - rs(48)) / 2} h={rs(170)} br={rs(14)} />
        </View>
      </View>
      {/* Accent glow */}
      <Animated.View style={{
        position: 'absolute', top: HERO_H * 0.3, left: SW * 0.2, right: SW * 0.2,
        height: rs(2), borderRadius: rs(1),
        backgroundColor: ACCENT, opacity: shimOpac,
        shadowColor: ACCENT, shadowOpacity: 1, shadowRadius: rs(20),
      }} />
    </View>
  );
});

// ─── Glass Layer ──────────────────────────────────────────────────────────────
const GlassLayer = ({ borderRadius = rs(12), alpha = 0.12 }) => (
  <>
    <LinearGradient colors={[`rgba(255,255,255,${alpha + 0.06})`, `rgba(255,255,255,${alpha})`]} style={[StyleSheet.absoluteFill, { borderRadius }]} />
    <LinearGradient colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }} style={[StyleSheet.absoluteFill, { borderRadius }]} />
    <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.14)']} start={{ x: 0, y: 0.6 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius }]} />
  </>
);

// ─── Toast Banner ─────────────────────────────────────────────────────────────
const ToastBanner = memo(({ msg, visible }) => {
  const opac = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opac, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [visible]);
  return (
    <Animated.View style={[S.toast, { opacity: opac }]} pointerEvents="none">
      <GlassLayer borderRadius={rs(12)} alpha={0.18} />
      <Text style={S.toastTxt}>{msg}</Text>
    </Animated.View>
  );
});

// ─── Star Rating ──────────────────────────────────────────────────────────────
const StarRating = memo(({ value, onChange }) => (
  <View style={{ flexDirection: 'row', gap: rs(8) }}>
    {[1, 2, 3, 4, 5].map(star => (
      <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.75}>
        <Text style={{ fontSize: rs(26), color: star <= value ? '#FFD700' : 'rgba(255,255,255,0.2)' }}>★</Text>
      </TouchableOpacity>
    ))}
  </View>
));

// ─── User Profile Modal ───────────────────────────────────────────────────────
const UserProfileModal = memo(({ user, visible, onClose }) => {
  const scaleA = useRef(new Animated.Value(0.85)).current;
  const opacA = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 200, friction: 20 }),
        Animated.timing(opacA, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleA, { toValue: 0.85, duration: 180, useNativeDriver: true }),
        Animated.timing(opacA, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  if (!user) return null;
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[S.modalOverlay, { opacity: opacA }]}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <Animated.View style={[S.profileModal, { transform: [{ scale: scaleA }], opacity: opacA }]}>
              <LinearGradient colors={['rgba(10,30,22,0.97)', 'rgba(3,15,12,0.99)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(24) }]} />
              <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(24) }]} />
              <LinearGradient colors={[ACCENT, ACCENT_DIM, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.modalAccentLine} />
              <View style={S.modalAvatarWrap}>
                <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: rs(46) }]} />
                {user.avatar ? (
                  <ImageBackground source={{ uri: user.avatar }} style={S.modalAvatar} imageStyle={{ borderRadius: rs(42) }} />
                ) : (
                  <Text style={S.modalAvatarInitial}>{(user.username || 'U')[0].toUpperCase()}</Text>
                )}
                <View style={S.modalOnlineDot} />
              </View>
              <Text style={S.modalUsername}>@{user.username}</Text>
              {user.bio ? <Text style={S.modalBio}>{user.bio}</Text> : null}
              <View style={S.modalStats}>
                {[
                  { label: 'Reviews', val: user.reviews || 0 },
                  { label: 'Followers', val: user.followers || 0 },
                  { label: 'Following', val: user.following || 0 },
                ].map(({ label, val }) => (
                  <View key={label} style={S.modalStatItem}>
                    <Text style={S.modalStatVal}>{val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val}</Text>
                    <Text style={S.modalStatLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={onClose} style={S.modalCloseBtn} activeOpacity={0.8}>
                <GlassLayer borderRadius={rs(20)} />
                <Text style={S.modalCloseTxt}>✕  Close</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ─── NETFLIX-STYLE HERO TRAILER ───────────────────────────────────────────────
// Controls visible only on tap, auto-hide after 3s. Below: thin progress + time + mute.
const HeroTrailer = memo(({ uri, posterUri, onEnded, muted, onMuteToggle }) => {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsOpac = useRef(new Animated.Value(0)).current;
  const controlTimer = useRef(null);

  const showControls = useCallback(() => {
    clearTimeout(controlTimer.current);
    Animated.timing(controlsOpac, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setControlsVisible(true);
    controlTimer.current = setTimeout(() => {
      if (!paused && !ended) {
        Animated.timing(controlsOpac, { toValue: 0, duration: 400, useNativeDriver: true }).start(
          () => setControlsVisible(false)
        );
      }
    }, 3000);
  }, [paused, ended]);

  const hideControls = useCallback(() => {
    clearTimeout(controlTimer.current);
    Animated.timing(controlsOpac, { toValue: 0, duration: 300, useNativeDriver: true }).start(
      () => setControlsVisible(false)
    );
  }, []);

  useEffect(() => {
    return () => clearTimeout(controlTimer.current);
  }, []);

  // Keep controls visible when paused/ended
  useEffect(() => {
    if (paused || ended) {
      clearTimeout(controlTimer.current);
      Animated.timing(controlsOpac, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      setControlsVisible(true);
    }
  }, [paused, ended]);

  const handleVideoTap = useCallback(() => {
    if (controlsVisible) {
      if (!paused && !ended) {
        hideControls();
      }
    } else {
      showControls();
    }
  }, [controlsVisible, paused, ended, showControls, hideControls]);

  const handlePlayPause = useCallback((e) => {
    e.stopPropagation?.();
    if (ended) {
      setEnded(false);
      setPaused(false);
      setCurrentTime(0);
      videoRef.current?.seek(0);
      showControls();
    } else {
      setPaused(p => {
        if (!p) {
          // Pausing — keep controls visible
          clearTimeout(controlTimer.current);
        } else {
          // Resuming — start auto-hide
          showControls();
        }
        return !p;
      });
    }
  }, [ended, showControls]);

  const progress = duration > 0 ? currentTime / duration : 0;
  const remaining = Math.max(duration - currentTime, 0);

  return (
    <View style={S.heroWrap}>
      {/* ── Video / Poster ── */}
      <TouchableWithoutFeedback onPress={handleVideoTap}>
        <View style={{ width: SW, height: HERO_H }}>
          {uri ? (
            <Video
              ref={videoRef}
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              paused={paused}
              muted={muted}
              resizeMode="cover"
              onProgress={({ currentTime: ct }) => setCurrentTime(ct)}
              onLoad={({ duration: d }) => { setDuration(d); setLoading(false); }}
              onEnd={() => { setEnded(true); setPaused(true); onEnded?.(); }}
              onBuffer={({ isBuffering }) => setLoading(isBuffering)}
              repeat={false}
              playInBackground={false}
              ignoreSilentSwitch="ignore"
            />
          ) : (
            <ImageBackground
              source={{ uri: posterUri }}
              style={{ width: SW, height: HERO_H }}
              resizeMode="cover"
            />
          )}

          {/* Deep gradient — bottom fade into BG */}
          <LinearGradient
            colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.25)', 'rgba(3,15,12,0.85)', BG]}
            locations={[0, 0.45, 0.78, 1]}
            style={[StyleSheet.absoluteFill]}
          />
          {/* Side fade vignette */}
          <LinearGradient
            colors={['rgba(3,15,12,0.3)', 'transparent', 'rgba(3,15,12,0.3)']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Loading */}
          {loading && (
            <View style={S.heroLoadingOverlay}>
              <ActivityIndicator color={ACCENT} size="large" />
            </View>
          )}

          {/* ── Tap-to-show controls overlay ── */}
          <Animated.View
            style={[S.heroControlsOverlay, { opacity: controlsOpac }]}
            pointerEvents={controlsVisible ? 'box-none' : 'none'}
          >
            {/* Dark scrim so controls are readable */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.32)' }]} />

            {/* Center play/pause/replay */}
            <View style={S.heroCenterControls}>
              <TouchableOpacity
                onPress={handlePlayPause}
                activeOpacity={0.85}
                style={S.heroCenterBtn}
              >
                <LinearGradient
                  colors={[ACCENT, ACCENT_DIM]}
                  style={[StyleSheet.absoluteFill, { borderRadius: rs(36) }]}
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.40)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: rs(36) }]}
                />
                <Text style={S.heroCenterBtnIcon}>
                  {ended ? '↺' : paused ? '▶' : '⏸'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>

      {/* ── Slim progress bar + remaining time + mute (ALWAYS VISIBLE below video) ── */}
      <View style={S.heroMiniBar}>
        {/* Progress track */}
        <View style={S.heroProgressTrack}>
          <View style={[S.heroProgressFill, { width: `${progress * 100}%` }]} />
        </View>

        {/* Time + Mute row */}
        <View style={S.heroBarRow}>
          <Text style={S.heroTimeText}>
            {formatTime(remaining) !== '0:00' ? `-${formatTime(remaining)}` : 'Ended'}
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onMuteToggle} activeOpacity={0.8} style={S.heroMuteBtn}>
            <GlassLayer borderRadius={rs(16)} alpha={0.12} />
            <Text style={S.heroMuteIcon}>{muted ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

// ─── Action Buttons ───────────────────────────────────────────────────────────
const ActionButtons = memo(({ movie, onLike, onWatchlist, onRate, userRating }) => {
  const [showRater, setShowRater] = useState(false);
  const raterScale = useRef(new Animated.Value(0)).current;

  const toggleRater = useCallback(() => {
    const next = !showRater;
    setShowRater(next);
    Animated.spring(raterScale, { toValue: next ? 1 : 0, useNativeDriver: true, tension: 260, friction: 18 }).start();
  }, [showRater]);

  const { anim: likeA, onIn: likeIn, onOut: likeOut } = usePressScale(0.88);
  const { anim: wlA, onIn: wlIn, onOut: wlOut } = usePressScale(0.88);
  const { anim: rateA, onIn: rateIn, onOut: rateOut } = usePressScale(0.88);

  return (
    <View>
      <View style={S.actionRow}>
        <TouchableOpacity onPress={onLike} onPressIn={likeIn} onPressOut={likeOut} activeOpacity={1}>
          <Animated.View style={[S.actionBtn, { transform: [{ scale: likeA }] }]}>
            <GlassLayer borderRadius={rs(14)} alpha={0.10} />
            {movie?.user_liked && <LinearGradient colors={['rgba(255,45,85,0.28)', 'rgba(255,45,85,0.08)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />}
            <Text style={[S.actionBtnIcon, { color: movie?.user_liked ? '#FF2D55' : '#fff' }]}>♥</Text>
            <Text style={[S.actionBtnLabel, { color: movie?.user_liked ? '#FF2D55' : 'rgba(255,255,255,0.7)' }]}>
              {movie?.user_liked ? 'Liked' : 'Like'}
            </Text>
            {movie?.likes_count > 0 && (
              <Text style={S.actionBtnCount}>{movie.likes_count >= 1000 ? `${(movie.likes_count / 1000).toFixed(1)}K` : movie.likes_count}</Text>
            )}
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity onPress={onWatchlist} onPressIn={wlIn} onPressOut={wlOut} activeOpacity={1}>
          <Animated.View style={[S.actionBtn, { transform: [{ scale: wlA }] }]}>
            <GlassLayer borderRadius={rs(14)} alpha={0.10} />
            {movie?.user_watchlisted && <LinearGradient colors={[`rgba(0,255,178,0.22)`, 'rgba(0,255,178,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />}
            <Text style={[S.actionBtnIcon, { color: movie?.user_watchlisted ? ACCENT : '#fff' }]}>{movie?.user_watchlisted ? '✓' : '+'}</Text>
            <Text style={[S.actionBtnLabel, { color: movie?.user_watchlisted ? ACCENT : 'rgba(255,255,255,0.7)' }]}>
              {movie?.user_watchlisted ? 'In List' : 'My List'}
            </Text>
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleRater} onPressIn={rateIn} onPressOut={rateOut} activeOpacity={1}>
          <Animated.View style={[S.actionBtn, { transform: [{ scale: rateA }] }]}>
            <GlassLayer borderRadius={rs(14)} alpha={0.10} />
            {userRating > 0 && <LinearGradient colors={['rgba(255,215,0,0.22)', 'rgba(255,215,0,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />}
            <Text style={[S.actionBtnIcon, { color: userRating > 0 ? '#FFD700' : '#fff' }]}>★</Text>
            <Text style={[S.actionBtnLabel, { color: userRating > 0 ? '#FFD700' : 'rgba(255,255,255,0.7)' }]}>
              {userRating > 0 ? `${userRating}.0` : 'Rate'}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <Animated.View style={[S.ratingPanel, { transform: [{ scale: raterScale }], opacity: raterScale }]}>
        <LinearGradient colors={['rgba(10,28,20,0.97)', 'rgba(3,15,12,0.99)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
        <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
        <Text style={S.ratingPanelTitle}>Your Rating</Text>
        <StarRating value={userRating} onChange={(v) => { onRate(v); toggleRater(); }} />
      </Animated.View>
    </View>
  );
});

// ─── Cast Card ────────────────────────────────────────────────────────────────
const CastCard = memo(({ item }) => {
  const { anim, onIn, onOut } = usePressScale(0.93);
  return (
    <TouchableOpacity onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      <Animated.View style={[S.castCard, { transform: [{ scale: anim }] }]}>
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)', `rgba(0,255,178,0.08)`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
        <View style={S.castAvatarWrap}>
          <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: rs(36) }]} />
          {item.avatar ? (
            <ImageBackground source={{ uri: item.avatar }} style={S.castAvatar} imageStyle={{ borderRadius: rs(34) }}>
              <LinearGradient colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.45)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(34) }]} />
            </ImageBackground>
          ) : (
            <Text style={{ color: BG, fontSize: rs(22), fontWeight: '900' }}>{(item.name || 'X')[0]}</Text>
          )}
        </View>
        <Text style={S.castName} numberOfLines={2}>{item.name}</Text>
        <Text style={S.castCharacter} numberOfLines={1}>{item.character}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Similar Movie Card ───────────────────────────────────────────────────────
const SimilarCard = memo(({ item, onPress }) => {
  const cardW = (SW - rs(18) * 2 - rs(12)) / 2;
  const { anim, onIn, onOut } = usePressScale(0.95);
  return (
    <TouchableOpacity onPress={() => onPress(item)} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      <Animated.View style={[{ width: cardW, marginBottom: rs(12) }, { transform: [{ scale: anim }] }]}>
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
        <View style={[S.simCardInner, { borderRadius: rs(13) }]}>
          {item.poster ? (
            <ImageBackground source={{ uri: item.poster }} style={[S.simCardImg, { borderTopLeftRadius: rs(13), borderTopRightRadius: rs(13) }]} resizeMode="cover">
              <LinearGradient colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.88)']} style={StyleSheet.absoluteFill} />
              {item.is_series && (
                <View style={S.simSeriesBadge}>
                  <LinearGradient colors={['rgba(255,45,85,0.55)', 'rgba(255,45,85,0.22)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
                  <Text style={S.simSeriesTxt}>SERIES</Text>
                </View>
              )}
              <View style={S.simRating}>
                <Text style={S.simRatingTxt}>⭐ {Number(item.rating || 0).toFixed(1)}</Text>
              </View>
            </ImageBackground>
          ) : (
            <View style={[S.simCardImg, { backgroundColor: GLASS_BG, borderTopLeftRadius: rs(13), borderTopRightRadius: rs(13), alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: rs(11) }}>{limitWords(item.title, 4)}</Text>
            </View>
          )}
          <View style={S.simCardInfo}>
            <LinearGradient colors={['rgba(0,255,178,0.06)', 'rgba(3,15,12,0.4)']} style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(13), borderBottomRightRadius: rs(13) }]} />
            <Text style={S.simCardTitle} numberOfLines={1}>{limitWords(item.title, 5)}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Comment Item ─────────────────────────────────────────────────────────────
const CommentItem = memo(({ item, onAvatarPress }) => (
  <View style={S.commentItem}>
    <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
    <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
    <TouchableOpacity onPress={() => onAvatarPress(item)} activeOpacity={0.85}>
      <View style={S.commentAvatarWrap}>
        <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: rs(22) }]} />
        {item.avatar ? (
          <ImageBackground source={{ uri: item.avatar }} style={S.commentAvatar} imageStyle={{ borderRadius: rs(20) }} />
        ) : (
          <Text style={{ color: BG, fontWeight: '900', fontSize: rs(14) }}>{(item.username || 'U')[0].toUpperCase()}</Text>
        )}
      </View>
    </TouchableOpacity>
    <View style={S.commentContent}>
      <View style={S.commentHeader}>
        <Text style={S.commentUsername}>@{item.username}</Text>
        <Text style={S.commentTime}>{timeAgo(item.created_at)}</Text>
      </View>
      <Text style={S.commentText}>{item.text}</Text>
      {item.likes > 0 && <Text style={S.commentLikes}>♥ {item.likes}</Text>}
    </View>
  </View>
));

// ─── Episode Card ─────────────────────────────────────────────────────────────
const EpisodeCard = memo(({ item, isActive, onPress }) => {
  const { anim, onIn, onOut } = usePressScale(0.96);
  return (
    <TouchableOpacity onPress={() => onPress(item)} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      <Animated.View style={[S.episodeCard, isActive && S.episodeCardActive, { transform: [{ scale: anim }] }]}>
        {isActive
          ? <LinearGradient colors={[`rgba(0,255,178,0.22)`, `rgba(0,255,178,0.06)`]} style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
          : <GlassLayer borderRadius={rs(14)} alpha={0.07} />}
        <LinearGradient colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
        {item.thumbnail_url ? (
          <ImageBackground source={{ uri: item.thumbnail_url }} style={S.episodeThumb} imageStyle={{ borderRadius: rs(10) }}>
            <LinearGradient colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.7)']} style={StyleSheet.absoluteFill} />
            {isActive && (
              <View style={S.episodePlayOverlay}>
                <Text style={{ color: BG, fontSize: rs(18) }}>▶</Text>
              </View>
            )}
          </ImageBackground>
        ) : (
          <View style={[S.episodeThumb, { backgroundColor: GLASS_BG, borderRadius: rs(10), alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: ACCENT, fontSize: rs(20) }}>{isActive ? '▶' : `E${item.episode_number}`}</Text>
          </View>
        )}
        <View style={S.episodeInfo}>
          <Text style={S.episodeNum}>E{item.episode_number}</Text>
          <Text style={S.episodeTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={S.episodeDuration}>{item.duration || '—'}</Text>
          {item.description ? <Text style={S.episodeDesc} numberOfLines={2}>{item.description}</Text> : null}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Section Title ────────────────────────────────────────────────────────────
const SectionTitle = memo(({ title }) => (
  <View style={S.sectionHeader}>
    <View style={S.sectionBar} />
    <Text style={S.sectionTitle}>{title}</Text>
  </View>
));

// ═════════════════════════════════════════════════════════════════════════════
// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export default function MovieDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  // Accept full movie object OR just movieId from HomeScreen
  const { movieId, movie: routeMovie } = route.params || {};
  const { toast, showToast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [movie, setMovie] = useState(routeMovie || null);
  const [cast, setCast] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [comments, setComments] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [activeTab, setActiveTab] = useState('similar');
  const [currentUser, setCurrentUser] = useState(null);
  const [profileModal, setProfileModal] = useState({ visible: false, user: null });
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [muted, setMuted] = useState(true); // Netflix default: muted autoplay
  const [headerOpac] = useState(new Animated.Value(0)); // scrolls to opaque

  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Animated entrance
  const entryOpac = useRef(new Animated.Value(0)).current;
  const entryY = useRef(new Animated.Value(rs(30))).current;

  // Header background opacity based on scroll (Netflix transparent → opaque)
  const headerBg = scrollY.interpolate({
    inputRange: [0, HERO_H * 0.4],
    outputRange: ['rgba(3,15,12,0)', 'rgba(3,15,12,0.85)'],
    extrapolate: 'clamp',
  });

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    loadAll();
    return () => StatusBar.setHidden(false, 'fade');
  }, [movieId]);

  const loadAll = useCallback(async () => {
    const id = movieId || routeMovie?.id;
    if (!id) {
      // Use routeMovie data if no id (edge case)
      const m = routeMovie || MOCK_MOVIE;
      setMovie(m);
      setCast(MOCK_CAST);
      setSimilar(MOCK_SIMILAR);
      setComments(MOCK_COMMENTS);
      setUserRating(m.user_rating || 0);
      setLoading(false);
      runEntrance();
      return;
    }

    try {
      const [user, castData, similarData, commentsData] = await Promise.all([
        getCurrentUser().catch(() => null),
        fetchCastByMovieId(id).catch(() => []),
        fetchSimilarMovies(id).catch(() => []),
        fetchCommentsByMovieId(id).catch(() => []),
      ]);

      // If we already have full movie data from route, use it; otherwise fetch
      let movieData = routeMovie;
      if (!routeMovie || !routeMovie.description) {
        movieData = await fetchMovieById(id).catch(() => null);
      }

      setCurrentUser(user);
      const m = movieData || MOCK_MOVIE;
      setMovie(m);
      setCast(castData?.length ? castData : MOCK_CAST);
      setSimilar(similarData?.length ? similarData : MOCK_SIMILAR);
      setComments(commentsData?.length ? commentsData : MOCK_COMMENTS);
      setUserRating(m.user_rating || 0);

      if (m.is_series) {
        const seasonsData = await fetchSeasonsBySeriesId(id).catch(() => []);
        const sList = seasonsData?.length ? seasonsData : MOCK_SEASONS;
        setSeasons(sList);
        if (sList.length > 0) {
          setActiveSeason(sList[0]);
          const eps = await fetchEpisodesBySeasonId(sList[0].id).catch(() => []);
          const epList = eps?.length ? eps : (MOCK_EPISODES[sList[0].id] || []);
          setEpisodes(epList);
          if (epList.length > 0) setActiveEpisode(epList[0]);
        }
      }

      runEntrance();
    } catch (e) {
      setMovie(routeMovie || MOCK_MOVIE);
      setCast(MOCK_CAST);
      setSimilar(MOCK_SIMILAR);
      setComments(MOCK_COMMENTS);
      runEntrance();
    } finally {
      setLoading(false);
    }
  }, [movieId, routeMovie]);

  const runEntrance = useCallback(() => {
    Animated.parallel([
      Animated.timing(entryOpac, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(entryY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 16 }),
    ]).start();
  }, []);

  // ── Season Switch ──────────────────────────────────────────────────────────
  const handleSeasonSwitch = useCallback(async (season) => {
    setActiveSeason(season);
    setEpisodes([]);
    try {
      const eps = await fetchEpisodesBySeasonId(season.id).catch(() => []);
      const epList = eps?.length ? eps : (MOCK_EPISODES[season.id] || []);
      setEpisodes(epList);
      if (epList.length > 0) setActiveEpisode(epList[0]);
    } catch {
      const fallback = MOCK_EPISODES[season.id] || [];
      setEpisodes(fallback);
      if (fallback.length > 0) setActiveEpisode(fallback[0]);
    }
  }, []);

  // ── Auth Guard ─────────────────────────────────────────────────────────────
  const requireAuth = useCallback(() => {
    if (!currentUser) {
      showToast('Please log in to continue');
      setTimeout(() => navigation.navigate('ProfileTab'), 1200);
      return false;
    }
    return true;
  }, [currentUser, navigation]);

  // ── Like ───────────────────────────────────────────────────────────────────
  const handleLike = useCallback(async () => {
    if (!requireAuth()) return;
    const wasLiked = movie?.user_liked;
    setMovie(m => ({ ...m, user_liked: !wasLiked, likes_count: (m.likes_count || 0) + (wasLiked ? -1 : 1) }));
    showToast(wasLiked ? 'Removed from likes' : '♥ Liked!');
    try { await toggleLike(currentUser.id, movie.id); }
    catch { setMovie(m => ({ ...m, user_liked: wasLiked, likes_count: (m.likes_count || 0) + (wasLiked ? 1 : -1) })); }
  }, [movie, currentUser, requireAuth]);

  // ── Watchlist ──────────────────────────────────────────────────────────────
  const handleWatchlist = useCallback(async () => {
    if (!requireAuth()) return;
    const was = movie?.user_watchlisted;
    setMovie(m => ({ ...m, user_watchlisted: !was }));
    showToast(was ? 'Removed from list' : '✓ Added to My List');
    try { await toggleWatchlist(currentUser.id, movie.id); }
    catch { setMovie(m => ({ ...m, user_watchlisted: was })); }
  }, [movie, currentUser, requireAuth]);

  // ── Rate ───────────────────────────────────────────────────────────────────
  const handleRate = useCallback(async (val) => {
    if (!requireAuth()) return;
    setUserRating(val);
    showToast(`Rated ${val} ★`);
    try { await rateMovie(currentUser.id, movie.id, val); }
    catch { showToast('Could not save rating'); }
  }, [movie, currentUser, requireAuth]);

  // ── Comment ────────────────────────────────────────────────────────────────
  const handlePostComment = useCallback(async () => {
    if (!requireAuth()) return;
    if (!commentText.trim()) return;
    setPostingComment(true);
    const optimistic = {
      id: `temp_${Date.now()}`,
      user_id: currentUser.id,
      username: currentUser.username || 'You',
      avatar: currentUser.avatar || null,
      text: commentText.trim(),
      created_at: new Date().toISOString(),
      likes: 0,
    };
    setComments(c => [optimistic, ...c]);
    setCommentText('');
    Keyboard.dismiss();
    try { await postComment(currentUser.id, movie.id, commentText.trim()); }
    catch { showToast('Could not post comment'); }
    finally { setPostingComment(false); }
  }, [commentText, currentUser, movie, requireAuth]);

  // ── Avatar Press → Profile Modal ───────────────────────────────────────────
  const handleAvatarPress = useCallback((comment) => {
    setProfileModal({
      visible: true,
      user: {
        id: comment.user_id,
        username: comment.username,
        avatar: comment.avatar,
        bio: 'Movie enthusiast 🎬',
        followers: Math.floor(Math.random() * 2000),
        following: Math.floor(Math.random() * 500),
        reviews: Math.floor(Math.random() * 120),
      },
    });
  }, []);

  // ── Similar Press ──────────────────────────────────────────────────────────
  const handleSimilarPress = useCallback((item) => {
    navigation.push('MovieDetail', { movieId: item.id, movie: item });
  }, [navigation]);

  // ── Play ───────────────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    navigation.navigate('Player', { movieId: activeEpisode ? activeEpisode.id : movie?.id, episodeId: activeEpisode?.id });
  }, [movie, activeEpisode, navigation]);

  const bottomPad = Math.max(insets.bottom, 12) + rs(24);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <FullScreenShimmer />;

  const m = movie || MOCK_MOVIE;
  // Prefer trailer_url for autoplay, fallback to video_url, then null (shows poster)
  const trailerUri = m.trailer_url || m.video_url || (activeEpisode?.video_url) || null;
  const posterUri = m.hero_image || m.poster;

  return (
    <View style={S.root}>
      <StatusBar hidden />

      {/* ── Sticky Floating Header (transparent → glass on scroll) ── */}
      <Animated.View
        style={[
          S.stickyHeader,
          { top: 0, backgroundColor: headerBg, paddingTop: insets.top + rs(10) },
        ]}
        pointerEvents="box-none"
      >
        <View style={S.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={S.backBtn}>
            <LinearGradient
              colors={['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.20)', 'rgba(255,255,255,0.06)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(22) }]}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(22) }]}
            />
            <Icon name="chevron-left" size={rs(20)} color="#fff" />
          </TouchableOpacity>
          <Text style={S.headerTitle} numberOfLines={1}>{limitWords(m.title, 4)}</Text>
          {/* Share button */}
          <TouchableOpacity style={S.headerShareBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={rs(20)} alpha={0.12} />
            <Icon name="share-2" size={rs(15)} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Main Scroll ── */}
      <Animated.ScrollView
        ref={scrollRef}
        style={S.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <Animated.View style={{ opacity: entryOpac, transform: [{ translateY: entryY }] }}>

          {/* ── Hero Trailer (edge-to-edge, no border) ── */}
          <HeroTrailer
            uri={trailerUri}
            posterUri={posterUri}
            muted={muted}
            onMuteToggle={() => setMuted(v => !v)}
            onEnded={() => {}}
          />

          {/* ── Content starts here — overlapping the hero bottom gradient ── */}
          <View style={S.contentContainer}>

            {/* ── Title + Genre Card (no extra margin — blends with hero) ── */}
            <View style={S.infoCard}>
              <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)', 'rgba(0,255,178,0.03)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(22) }]} />
              <LinearGradient colors={['rgba(255,255,255,0.24)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.38 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(22) }]} />
              <LinearGradient colors={[ACCENT, ACCENT_DIM, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.infoAccentLine} />

              {/* Genre badges */}
              <View style={S.genreRow}>
                {(m.genre || []).map(g => (
                  <View key={g} style={S.genreBadge}>
                    <LinearGradient colors={[`rgba(0,255,178,0.22)`, 'rgba(0,255,178,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                    <Text style={S.genreBadgeTxt}>{g}</Text>
                  </View>
                ))}
                {m.newly_added && (
                  <View style={[S.genreBadge, { borderColor: 'rgba(255,45,85,0.45)' }]}>
                    <LinearGradient colors={['rgba(255,45,85,0.22)', 'rgba(255,45,85,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                    <Text style={[S.genreBadgeTxt, { color: '#FF2D55' }]}>{m.newly_added}</Text>
                  </View>
                )}
                {m.is_4k && (
                  <View style={[S.genreBadge, { borderColor: 'rgba(255,215,0,0.4)' }]}>
                    <LinearGradient colors={['rgba(255,215,0,0.22)', 'rgba(255,215,0,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                    <Text style={[S.genreBadgeTxt, { color: '#FFD700' }]}>4K</Text>
                  </View>
                )}
                {m.is_hdr && (
                  <View style={[S.genreBadge, { borderColor: 'rgba(255,215,0,0.4)' }]}>
                    <LinearGradient colors={['rgba(255,215,0,0.22)', 'rgba(255,215,0,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                    <Text style={[S.genreBadgeTxt, { color: '#FFD700' }]}>HDR</Text>
                  </View>
                )}
              </View>

              {/* Title */}
              <Text style={S.infoTitle}>{limitWords(m.title, 8)}</Text>

              {/* Meta row */}
              <View style={S.metaRow}>
                {[
                  m.year && { icon: '📅', val: String(m.year) },
                  m.duration && { icon: '⏱', val: m.duration },
                  m.language && { icon: '🌐', val: m.language },
                  m.rating && { icon: '⭐', val: Number(m.rating).toFixed(1) },
                ].filter(Boolean).map((meta, i) => (
                  <View key={i} style={S.metaChip}>
                    <GlassLayer borderRadius={rs(10)} alpha={0.09} />
                    <Text style={S.metaChipTxt}>{meta.icon}  {meta.val}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Big Play CTA ── */}
            <View style={S.playBtnSection}>
              <TouchableOpacity onPress={handlePlay} activeOpacity={0.85} style={S.bigPlayBtn}>
                <LinearGradient colors={[ACCENT, ACCENT_DIM, '#009A6E']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
                <LinearGradient colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
                <Text style={S.bigPlayIcon}>▶</Text>
                <Text style={S.bigPlayLabel}>
                  {activeEpisode ? `Play E${activeEpisode.episode_number}: ${activeEpisode.title}` : 'Play Now'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Action Buttons ── */}
            <View style={S.actionSection}>
              <ActionButtons
                movie={m}
                onLike={handleLike}
                onWatchlist={handleWatchlist}
                onRate={handleRate}
                userRating={userRating}
              />
            </View>

            {/* ── Synopsis ── */}
            <View style={S.synopsisCard}>
              <LinearGradient colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.04)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(18) }]} />
              <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(18) }]} />
              <SectionTitle title="Synopsis" />
              <Text style={S.synopsisText}>
                {synopsisExpanded ? m.description : limitChars(m.description, 120)}
              </Text>
              {m.description && m.description.length > 120 && (
                <TouchableOpacity onPress={() => setSynopsisExpanded(e => !e)} activeOpacity={0.75}>
                  <Text style={S.synopsisToggle}>{synopsisExpanded ? 'Show less ▲' : 'Read more ▼'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Cast & Crew ── */}
            {cast.length > 0 && (
              <View style={S.section}>
                <SectionTitle title="Cast & Crew" />
                <FlatList
                  data={cast}
                  horizontal
                  keyExtractor={i => i.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={S.castList}
                  renderItem={({ item }) => <CastCard item={item} />}
                  getItemLayout={(_, i) => ({ length: rs(112), offset: rs(112) * i, index: i })}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  removeClippedSubviews
                />
              </View>
            )}

            {/* ── Series: Seasons & Episodes ── */}
            {m.is_series && seasons.length > 0 && (
              <View style={S.seriesSection}>
                <SectionTitle title="Episodes" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.seasonTabRow}>
                  {seasons.map(s => {
                    const isActive = activeSeason?.id === s.id;
                    return (
                      <TouchableOpacity key={s.id} onPress={() => handleSeasonSwitch(s)} activeOpacity={0.8} style={[S.seasonTab, isActive && S.seasonTabActive]}>
                        {isActive
                          ? <LinearGradient colors={[ACCENT, ACCENT_DIM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                          : <GlassLayer borderRadius={rs(20)} alpha={0.08} />}
                        <LinearGradient colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                        <Text style={[S.seasonTabTxt, isActive && S.seasonTabTxtActive]}>Season {s.season_number}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {episodes.length > 0 ? (
                  episodes.map(ep => (
                    <EpisodeCard
                      key={ep.id}
                      item={ep}
                      isActive={activeEpisode?.id === ep.id}
                      onPress={(e) => { setActiveEpisode(e); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                    />
                  ))
                ) : (
                  <ActivityIndicator color={ACCENT} style={{ marginTop: rs(20) }} />
                )}
              </View>
            )}

            {/* ── Tabs: More Like This / Comments ── */}
            <View style={S.tabSection}>
              <View style={S.tabHeader}>
                {[
                  { key: 'similar', label: 'More Like This' },
                  { key: 'comments', label: `Comments${comments.length ? ` (${comments.length})` : ''}` },
                ].map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    activeOpacity={0.8}
                    style={[S.tab, activeTab === tab.key && S.tabActive]}
                  >
                    {activeTab === tab.key && (
                      <LinearGradient colors={[ACCENT, ACCENT_DIM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.tabActiveBar} />
                    )}
                    <Text style={[S.tabTxt, activeTab === tab.key && S.tabTxtActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Similar Grid */}
              {activeTab === 'similar' && (
                <View style={S.simGrid}>
                  {similar.length === 0 ? (
                    <Text style={S.emptyTxt}>No similar titles found.</Text>
                  ) : (
                    Array.from({ length: Math.ceil(similar.length / 2) }, (_, i) => (
                      <View key={i} style={S.simRow}>
                        {similar.slice(i * 2, i * 2 + 2).map(item => (
                          <SimilarCard key={item.id} item={item} onPress={handleSimilarPress} />
                        ))}
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* Comments */}
              {activeTab === 'comments' && (
                <View style={S.commentsSection}>
                  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={S.commentInputWrap}>
                      <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
                      <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
                      <TextInput
                        style={S.commentInput}
                        placeholder={currentUser ? 'Add a comment…' : 'Log in to comment…'}
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={commentText}
                        onChangeText={setCommentText}
                        multiline
                        onFocus={() => {
                          if (!currentUser) {
                            showToast('Please log in to comment');
                            navigation.navigate('ProfileTab');
                          }
                        }}
                      />
                      <TouchableOpacity
                        onPress={handlePostComment}
                        disabled={postingComment || !commentText.trim()}
                        activeOpacity={0.8}
                        style={[S.commentSendBtn, (!commentText.trim() || postingComment) && { opacity: 0.4 }]}
                      >
                        <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: rs(18) }]} />
                        {postingComment ? <ActivityIndicator color={BG} size="small" /> : <Text style={S.commentSendTxt}>↑</Text>}
                      </TouchableOpacity>
                    </View>
                  </KeyboardAvoidingView>
                  {comments.length === 0 ? (
                    <Text style={S.emptyTxt}>Be the first to comment!</Text>
                  ) : (
                    comments.map(c => <CommentItem key={c.id} item={c} onAvatarPress={handleAvatarPress} />)
                  )}
                </View>
              )}
            </View>

          </View>{/* end contentContainer */}
        </Animated.View>
      </Animated.ScrollView>

      {/* ── Toast ── */}
      <ToastBanner msg={toast.msg} visible={toast.visible} />

      {/* ── User Profile Modal ── */}
      <UserProfileModal
        user={profileModal.user}
        visible={profileModal.visible}
        onClose={() => setProfileModal({ visible: false, user: null })}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },

  // ── Sticky Header (floats over hero) ──
  stickyHeader: {
    position: 'absolute', left: 0, right: 0, zIndex: 300,
    paddingBottom: rs(10),
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: rs(14), gap: rs(10),
  },
  backBtn: {
    width: rs(42), height: rs(42), borderRadius: rs(21),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: 'rgba(0,255,178,0.20)',
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 1, shadowRadius: rs(10),
    elevation: 10,
  },
  headerTitle: {
    flex: 1, color: 'rgba(255,255,255,0.85)',
    fontSize: rs(14), fontWeight: '700', letterSpacing: 0.3,
  },
  headerShareBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(19),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },

  // ── Hero Trailer ──
  heroWrap: {
    width: SW,
  },
  heroLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroControlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  heroCenterControls: {
    alignItems: 'center', justifyContent: 'center',
  },
  heroCenterBtn: {
    width: rs(72), height: rs(72), borderRadius: rs(36),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: ACCENT, shadowOpacity: 0.6, shadowRadius: rs(20),
    elevation: 20,
  },
  heroCenterBtnIcon: {
    fontSize: rs(28), color: BG, fontWeight: '900',
  },

  // ── Slim mini-bar (always visible) ──
  heroMiniBar: {
    paddingHorizontal: rs(16),
    paddingTop: rs(8),
    paddingBottom: rs(6),
    backgroundColor: 'rgba(3,15,12,0.6)',
  },
  heroProgressTrack: {
    height: rs(3), backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: rs(2), overflow: 'hidden', marginBottom: rs(8),
  },
  heroProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: rs(2),
    shadowColor: ACCENT, shadowOpacity: 0.9, shadowRadius: rs(6),
  },
  heroBarRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  heroTimeText: {
    color: 'rgba(255,255,255,0.55)', fontSize: rs(11), fontWeight: '600',
  },
  heroMuteBtn: {
    width: rs(34), height: rs(34), borderRadius: rs(17),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
  },
  heroMuteIcon: { fontSize: rs(14) },

  // ── Content ──
  contentContainer: {
    marginTop: rs(-rs(8)), // slight overlap with hero bottom
  },

  // ── Info Card ──
  infoCard: {
    marginHorizontal: rs(14),
    marginTop: rs(10),
    borderRadius: rs(22), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
    padding: rs(18),
    shadowColor: 'rgba(0,255,178,0.12)',
    shadowOffset: { width: 0, height: rs(6) }, shadowOpacity: 1, shadowRadius: rs(18),
    elevation: 12,
  },
  infoAccentLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: rs(1.5),
  },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(6), marginBottom: rs(12) },
  genreBadge: {
    paddingHorizontal: rs(12), paddingVertical: rs(5),
    borderRadius: rs(20), overflow: 'hidden',
    borderWidth: 1, borderColor: `rgba(0,255,178,0.28)`,
  },
  genreBadgeTxt: { color: ACCENT, fontSize: rs(10), fontWeight: '800', letterSpacing: 0.6 },
  infoTitle: {
    color: '#fff', fontSize: rs(27), fontWeight: '900',
    letterSpacing: -0.5, lineHeight: rs(34), marginBottom: rs(14),
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: rs(2) }, textShadowRadius: rs(8),
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8) },
  metaChip: {
    paddingHorizontal: rs(12), paddingVertical: rs(6),
    borderRadius: rs(10), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  metaChipTxt: { color: 'rgba(255,255,255,0.75)', fontSize: rs(11), fontWeight: '600' },

  // ── Play CTA ──
  playBtnSection: { marginHorizontal: rs(14), marginTop: rs(14) },
  bigPlayBtn: {
    height: rs(54), borderRadius: rs(16),
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: ACCENT,
    gap: rs(10),
    shadowColor: ACCENT, shadowOpacity: 0.45, shadowRadius: rs(16),
    elevation: 14,
  },
  bigPlayIcon: { color: BG, fontSize: rs(18), fontWeight: '900' },
  bigPlayLabel: { color: BG, fontSize: rs(15), fontWeight: '800', letterSpacing: 0.5 },

  // ── Action Buttons ──
  actionSection: { marginHorizontal: rs(14), marginTop: rs(14) },
  actionRow: { flexDirection: 'row', gap: rs(10) },
  actionBtn: {
    flex: 1, paddingVertical: rs(14), paddingHorizontal: rs(8),
    borderRadius: rs(14), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
    alignItems: 'center', gap: rs(4),
  },
  actionBtnIcon: { fontSize: rs(20), color: '#fff' },
  actionBtnLabel: { color: 'rgba(255,255,255,0.7)', fontSize: rs(11), fontWeight: '700' },
  actionBtnCount: { color: 'rgba(255,255,255,0.4)', fontSize: rs(9), fontWeight: '600' },
  ratingPanel: {
    marginTop: rs(10), padding: rs(16),
    borderRadius: rs(16), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.28)',
    alignItems: 'center', gap: rs(10),
  },
  ratingPanelTitle: { color: 'rgba(255,255,255,0.65)', fontSize: rs(11), fontWeight: '700', letterSpacing: 0.5 },

  // ── Synopsis ──
  synopsisCard: {
    marginHorizontal: rs(14), marginTop: rs(14),
    borderRadius: rs(18), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
    padding: rs(16),
  },
  synopsisText: { color: 'rgba(255,255,255,0.72)', fontSize: rs(13), lineHeight: rs(21), marginTop: rs(6) },
  synopsisToggle: { color: ACCENT, fontSize: rs(12), fontWeight: '700', marginTop: rs(8) },

  // ── Section ──
  section: { marginTop: rs(22) },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(14), marginBottom: rs(12) },
  sectionBar: {
    width: rs(3), height: rs(18), borderRadius: rs(2), marginRight: rs(8),
    backgroundColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.9, shadowRadius: rs(6),
  },
  sectionTitle: { color: '#fff', fontSize: rs(17), fontWeight: '800', letterSpacing: 0.2 },

  // ── Cast ──
  castList: { paddingHorizontal: rs(14), gap: rs(12) },
  castCard: {
    width: rs(98), borderRadius: rs(16), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
    padding: rs(10), alignItems: 'center', gap: rs(7),
    shadowColor: 'rgba(0,255,178,0.10)',
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 1, shadowRadius: rs(10),
    elevation: 8,
  },
  castAvatarWrap: {
    width: rs(68), height: rs(68), borderRadius: rs(34),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 2, borderColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.35, shadowRadius: rs(10),
  },
  castAvatar: { width: rs(64), height: rs(64), borderRadius: rs(32) },
  castName: { color: '#fff', fontSize: rs(10), fontWeight: '800', textAlign: 'center', lineHeight: rs(14) },
  castCharacter: { color: ACCENT, fontSize: rs(9), fontWeight: '600', textAlign: 'center', letterSpacing: 0.4, textTransform: 'uppercase' },

  // ── Series ──
  seriesSection: { marginTop: rs(22) },
  seasonTabRow: { paddingHorizontal: rs(14), gap: rs(8), marginBottom: rs(12) },
  seasonTab: {
    paddingHorizontal: rs(16), paddingVertical: rs(8),
    borderRadius: rs(20), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  seasonTabActive: { borderColor: ACCENT, shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: rs(8), elevation: 6 },
  seasonTabTxt: { color: 'rgba(255,255,255,0.65)', fontSize: rs(12), fontWeight: '700' },
  seasonTabTxtActive: { color: BG },
  episodeCard: {
    marginHorizontal: rs(14), marginBottom: rs(10),
    borderRadius: rs(14), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
    flexDirection: 'row', alignItems: 'center', padding: rs(10), gap: rs(12),
  },
  episodeCardActive: { borderColor: ACCENT },
  episodeThumb: { width: rs(110), height: rs(68), borderRadius: rs(10) },
  episodePlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,255,178,0.25)',
    borderRadius: rs(10),
  },
  episodeInfo: { flex: 1 },
  episodeNum: { color: ACCENT, fontSize: rs(9), fontWeight: '900', letterSpacing: 0.8, marginBottom: rs(2) },
  episodeTitle: { color: '#fff', fontSize: rs(12), fontWeight: '800', marginBottom: rs(2) },
  episodeDuration: { color: 'rgba(255,255,255,0.45)', fontSize: rs(10), fontWeight: '600', marginBottom: rs(3) },
  episodeDesc: { color: 'rgba(255,255,255,0.50)', fontSize: rs(10), lineHeight: rs(14) },

  // ── Tabs ──
  tabSection: { marginTop: rs(22) },
  tabHeader: { flexDirection: 'row', paddingHorizontal: rs(14), borderBottomWidth: 1, borderBottomColor: GLASS_BORDER, marginBottom: rs(16) },
  tab: { flex: 1, paddingVertical: rs(12), alignItems: 'center', position: 'relative' },
  tabActive: {},
  tabActiveBar: { position: 'absolute', bottom: 0, left: rs(10), right: rs(10), height: rs(2), borderRadius: rs(1) },
  tabTxt: { color: 'rgba(255,255,255,0.45)', fontSize: rs(13), fontWeight: '700' },
  tabTxtActive: { color: ACCENT },

  // ── Similar ──
  simGrid: { paddingHorizontal: rs(14) },
  simRow: { flexDirection: 'row', gap: rs(12) },
  simCardInner: { overflow: 'hidden', backgroundColor: BG },
  simCardImg: { width: '100%', height: rs(165) },
  simSeriesBadge: {
    position: 'absolute', top: rs(6), left: rs(6),
    paddingHorizontal: rs(6), paddingVertical: rs(2), borderRadius: rs(4), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.4)',
  },
  simSeriesTxt: { color: '#FF2D55', fontSize: rs(7), fontWeight: '900' },
  simRating: {
    position: 'absolute', bottom: rs(6), right: rs(6),
    paddingHorizontal: rs(7), paddingVertical: rs(3), borderRadius: rs(6), overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.28)',
  },
  simRatingTxt: { color: '#FFD700', fontSize: rs(9), fontWeight: '700' },
  simCardInfo: { paddingHorizontal: rs(8), paddingVertical: rs(8), overflow: 'hidden' },
  simCardTitle: { color: '#fff', fontSize: rs(11), fontWeight: '700' },
  emptyTxt: { color: 'rgba(255,255,255,0.4)', fontSize: rs(13), textAlign: 'center', marginTop: rs(20), marginBottom: rs(10) },

  // ── Comments ──
  commentsSection: { paddingHorizontal: rs(14) },
  commentInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: rs(10),
    borderRadius: rs(16), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
    padding: rs(10), marginBottom: rs(16),
  },
  commentInput: {
    flex: 1, color: '#fff', fontSize: rs(13), fontWeight: '500',
    maxHeight: rs(80), minHeight: rs(36), paddingVertical: 0,
  },
  commentSendBtn: {
    width: rs(36), height: rs(36), borderRadius: rs(18),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: rs(8), elevation: 6,
  },
  commentSendTxt: { color: BG, fontSize: rs(16), fontWeight: '900' },
  commentItem: {
    flexDirection: 'row', gap: rs(12),
    borderRadius: rs(14), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
    padding: rs(12), marginBottom: rs(10),
  },
  commentAvatarWrap: {
    width: rs(42), height: rs(42), borderRadius: rs(21),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1.5, borderColor: ACCENT, flexShrink: 0,
  },
  commentAvatar: { width: rs(40), height: rs(40), borderRadius: rs(20) },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(4) },
  commentUsername: { color: ACCENT, fontSize: rs(11), fontWeight: '800', letterSpacing: 0.3 },
  commentTime: { color: 'rgba(255,255,255,0.35)', fontSize: rs(9), fontWeight: '500' },
  commentText: { color: 'rgba(255,255,255,0.80)', fontSize: rs(12), lineHeight: rs(18) },
  commentLikes: { color: 'rgba(255,100,120,0.70)', fontSize: rs(10), fontWeight: '700', marginTop: rs(5) },

  // ── Profile Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center',
  },
  profileModal: {
    width: SW - rs(48), borderRadius: rs(24),
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
    padding: rs(24), alignItems: 'center',
    shadowColor: ACCENT, shadowOpacity: 0.22, shadowRadius: rs(30), elevation: 24,
  },
  modalAccentLine: { position: 'absolute', top: 0, left: 0, right: 0, height: rs(2) },
  modalAvatarWrap: {
    width: rs(90), height: rs(90), borderRadius: rs(45),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 2.5, borderColor: ACCENT,
    marginBottom: rs(12),
    shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: rs(14), elevation: 12,
  },
  modalAvatar: { width: rs(86), height: rs(86), borderRadius: rs(43) },
  modalAvatarInitial: { color: BG, fontSize: rs(30), fontWeight: '900' },
  modalOnlineDot: {
    position: 'absolute', bottom: rs(4), right: rs(4),
    width: rs(14), height: rs(14), borderRadius: rs(7),
    backgroundColor: ACCENT, borderWidth: 2, borderColor: BG,
    shadowColor: ACCENT, shadowOpacity: 0.8, shadowRadius: rs(6),
  },
  modalUsername: { color: '#fff', fontSize: rs(18), fontWeight: '900', marginBottom: rs(6) },
  modalBio: { color: 'rgba(255,255,255,0.55)', fontSize: rs(12), textAlign: 'center', lineHeight: rs(18), marginBottom: rs(16) },
  modalStats: { flexDirection: 'row', gap: rs(22), marginBottom: rs(22) },
  modalStatItem: { alignItems: 'center', gap: rs(3) },
  modalStatVal: { color: ACCENT, fontSize: rs(18), fontWeight: '900' },
  modalStatLabel: { color: 'rgba(255,255,255,0.45)', fontSize: rs(10), fontWeight: '600', letterSpacing: 0.5 },
  modalCloseBtn: {
    paddingHorizontal: rs(32), paddingVertical: rs(12),
    borderRadius: rs(20), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  modalCloseTxt: { color: 'rgba(255,255,255,0.7)', fontSize: rs(13), fontWeight: '700' },

  // ── Toast ──
  toast: {
    position: 'absolute', bottom: rs(36), alignSelf: 'center',
    paddingHorizontal: rs(20), paddingVertical: rs(12),
    borderRadius: rs(14), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
    zIndex: 999, maxWidth: SW * 0.85,
  },
  toastTxt: { color: '#fff', fontSize: rs(13), fontWeight: '600', textAlign: 'center' },
});
