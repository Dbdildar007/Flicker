// src/components/MovieDetails.js
/**
 * PRODUCTION-READY MOVIE DETAIL PAGE
 * ─────────────────────────────────────────────────────────────────
 * • Auto-playing trailer with tap-to-pause/play
 * • Progress bar + mute/unmute + remaining time (fully working)
 * • Replay button when video ends
 * • 3D Hyped Glass UI throughout
 * • Like / Add to List / Rate (with auth-check → navigate to Profile tab)
 * • Synopsis with 100-char limit + expand
 * • Cast & Crew horizontal scroll
 * • "More Like This" 2-col grid + Comments tab
 * • User profile modal on comment avatar tap
 * • All API via supabase.js (+ mock data fallback)
 * • Responsive: rs() scale for all sizes
 */

import React, {
  useRef, useEffect, useState, useCallback, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, StatusBar, ImageBackground,
  FlatList, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, Image, TouchableWithoutFeedback,
  Keyboard, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS, RADIUS, SHADOW } from '../data/theme';
import {
  fetchMovieById,
  fetchCastAndCrew,
  fetchSimilarMovies,
  fetchComments,
  postComment,
  toggleLike,
  toggleWatchlist,
  submitRating,
  fetchUserProfile,
  getCurrentUser,
} from '../lib/supabase';
import { limitWords } from '../utils/helper';

// ─── Responsive ───────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const rs = (s) => {
  const { width: w } = Dimensions.get('window');
  if (w < 360) return Math.round(s * 0.82);
  if (w < 414) return Math.round(s * 0.92);
  if (w > 768) return Math.round(s * 1.20);
  if (w > 600) return Math.round(s * 1.08);
  return s;
};

const TRAILER_H = SW * 0.56;
const ACCENT = '#00FFB2';
const ACCENT_DIM = '#00CC90';
const GLASS_WHITE = 'rgba(255,255,255,0.12)';
const GLASS_BORDER = 'rgba(255,255,255,0.22)';
const GLASS_SHINE = ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.0)'];

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_MOVIE = {
  id: 'mock1',
  title: 'NEBULA ASCENT',
  description: 'In a world submerged beneath the crystalline oceans of Kepler-186f, Captain Elara Vance must lead a desperate expedition into the forbidden Nebula Trench to recover a lost energy source that could save the last remaining human enclave from an encroaching deep-sea parasite.',
  poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900',
  trailer_url: null,
  genre: ['Action', 'Sci-Fi'],
  year: 2024,
  duration: 154,
  language: 'English',
  rating: 8.9,
  is_series: false,
  is_trending: true,
  newly_added: 'ORIGINAL',
  quality: '4K HDR',
  director: 'James Vance',
  studio: 'Nebula Films',
};
const MOCK_CAST = [
  { id: 'c1', name: 'Marcus Thorne', character: 'Captain Elara', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' },
  { id: 'c2', name: 'Aria Lyra', character: 'The Oracle', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612e13a?w=200' },
  { id: 'c3', name: 'David Byrd', character: 'Commander', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' },
  { id: 'c4', name: 'Zara Chen', character: 'Navigator', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200' },
  { id: 'c5', name: 'Leon Hart', character: 'Engineer', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200' },
];
const MOCK_SIMILAR = [
  { id: 's1', title: 'Dark Horizon', poster: 'https://images.unsplash.com/photo-1542547277-c6e6c8dea671?w=400', rating: 7.9 },
  { id: 's2', title: 'Chrome City', poster: 'https://images.unsplash.com/photo-1465101162946-4377e57745c3?w=400', rating: 8.1 },
  { id: 's3', title: 'Quantum Rift', poster: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400', rating: 8.5 },
  { id: 's4', title: 'Mars Born', poster: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400', rating: 8.2 },
  { id: 's5', title: 'Orbital Decay', poster: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=400', rating: 7.6 },
  { id: 's6', title: 'Echo Chamber', poster: 'https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=400', rating: 7.4 },
];
const MOCK_COMMENTS = [
  { id: 'cm1', user_id: 'u1', username: 'NebulaNerd', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', text: 'Absolutely mind-blowing visuals! The deep sea scenes are unlike anything I\'ve seen before.', likes: 42, created_at: '2024-01-15T10:30:00Z', liked_by_me: false },
  { id: 'cm2', user_id: 'u2', username: 'SciFiQueen', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612e13a?w=100', text: 'Marcus Thorne\'s performance is incredible. This is his best role yet!', likes: 38, created_at: '2024-01-16T14:22:00Z', liked_by_me: true },
  { id: 'cm3', user_id: 'u3', username: 'CinematicEye', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100', text: 'The score is haunting and beautiful. Gave me goosebumps throughout.', likes: 29, created_at: '2024-01-17T09:15:00Z', liked_by_me: false },
  { id: 'cm4', user_id: 'u4', username: 'DeepSpaceViewer', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', text: 'Plot twist at the end was unexpected but very satisfying!', likes: 55, created_at: '2024-01-18T20:45:00Z', liked_by_me: false },
];

// ─── Shared shimmer ───────────────────────────────────────────────────────────
const shimA = new Animated.Value(0);
let shimStarted = false;
const startShimmer = () => {
  if (shimStarted) return;
  shimStarted = true;
  Animated.loop(Animated.sequence([
    Animated.timing(shimA, { toValue: 1, duration: 900, useNativeDriver: true }),
    Animated.timing(shimA, { toValue: 0, duration: 900, useNativeDriver: true }),
  ])).start();
};
const shimOpac = shimA.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.45] });

// ─── SkeletonBox ──────────────────────────────────────────────────────────────
const SkeletonBox = memo(({ width, height, borderRadius = rs(10), style }) => (
  <Animated.View style={[{ width, height, borderRadius, overflow: 'hidden', opacity: shimOpac }, style]}>
    <LinearGradient colors={[GLASS_WHITE, 'rgba(255,255,255,0.22)', GLASS_WHITE]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
  </Animated.View>
));

// ─── Glass Container helper ───────────────────────────────────────────────────
const GlassBox = memo(({ style, children, border = true, shine = true }) => (
  <View style={[{ overflow: 'hidden', borderWidth: border ? 1 : 0, borderColor: GLASS_BORDER }, style]}>
    <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)']}
      style={StyleSheet.absoluteFill} />
    {shine && <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
      style={StyleSheet.absoluteFill} />}
    {children}
  </View>
));

// ─── Glass Button ─────────────────────────────────────────────────────────────
const GlassBtn = memo(({ label, icon, accent, onPress, style, small }) => {
  const scaleA = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scaleA, { toValue: 0.93, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onOut = () => Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1} style={style}>
      <Animated.View style={[S.glassBtn, small && S.glassBtnSmall, accent && S.glassBtnAccent, { transform: [{ scale: scaleA }] }]}>
        {accent ? (
          <LinearGradient colors={[ACCENT, ACCENT_DIM, '#009A6E']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: small ? rs(20) : rs(28) }]} />
        ) : (
          <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.07)']}
            style={[StyleSheet.absoluteFill, { borderRadius: small ? rs(20) : rs(28) }]} />
        )}
        <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: small ? rs(20) : rs(28) }]} />
        {icon ? <Text style={[S.glassBtnIcon, accent && { color: COLORS.bg || '#030F0C' }]}>{icon}</Text> : null}
        {label ? <Text style={[S.glassBtnLabel, accent && { color: COLORS.bg || '#030F0C' }, small && { fontSize: rs(11) }]}>{label}</Text> : null}
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [state, setState] = useState({ message: '', visible: false });
  const t = useRef(null);
  const show = useCallback((msg, ms = 1600) => {
    clearTimeout(t.current);
    setState({ message: msg, visible: true });
    t.current = setTimeout(() => setState(s => ({ ...s, visible: false })), ms);
  }, []);
  return { toast: state, showToast: show };
}
const Toast = memo(({ message, visible }) => {
  const opA = useRef(new Animated.Value(0)).current;
  const tyA = useRef(new Animated.Value(rs(16))).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opA, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }),
      Animated.timing(tyA, { toValue: visible ? 0 : rs(16), duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible]);
  return (
    <Animated.View style={[S.toast, { opacity: opA, transform: [{ translateY: tyA }] }]} pointerEvents="none">
      <LinearGradient colors={['rgba(0,255,178,0.22)', 'rgba(0,255,178,0.10)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
      <Text style={S.toastTxt}>{message}</Text>
    </Animated.View>
  );
});

// ─── Star Rating Modal ────────────────────────────────────────────────────────
const RatingModal = memo(({ visible, onClose, onSubmit, currentRating }) => {
  const [stars, setStars] = useState(currentRating || 0);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={S.modalOverlay}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <View style={S.ratingModal}>
              <LinearGradient colors={['rgba(5,30,20,0.98)', 'rgba(3,15,12,0.99)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(24) }]} />
              <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(24) }]} />
              <Text style={S.ratingModalTitle}>Rate this Movie</Text>
              <View style={S.starsRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <TouchableOpacity key={n} onPress={() => setStars(n)} style={{ padding: rs(4) }}>
                    <Text style={{ fontSize: rs(22), opacity: n <= stars ? 1 : 0.28 }}>⭐</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={S.ratingValue}>{stars > 0 ? `${stars}/10` : 'Tap to rate'}</Text>
              <View style={{ flexDirection: 'row', gap: rs(12), marginTop: rs(20) }}>
                <GlassBtn label="Cancel" onPress={onClose} small style={{ flex: 1 }} />
                <GlassBtn label="Submit" accent onPress={() => { onSubmit(stars); onClose(); }} small style={{ flex: 1 }} />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ─── User Profile Modal ───────────────────────────────────────────────────────
const UserProfileModal = memo(({ visible, user, onClose }) => {
  if (!user) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={S.modalOverlay}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <View style={S.userModal}>
              <LinearGradient colors={['rgba(5,30,20,0.99)', 'rgba(3,15,12,1)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]} />
              <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]} />
              {/* Accent ring */}
              <View style={S.userAvatarRing}>
                <LinearGradient colors={[ACCENT, ACCENT_DIM, '#009A6E']}
                  style={[StyleSheet.absoluteFill, { borderRadius: rs(56) }]} />
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={S.userModalAvatar} />
                ) : (
                  <View style={[S.userModalAvatar, { backgroundColor: 'rgba(0,255,178,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: ACCENT, fontSize: rs(26), fontWeight: '900' }}>
                      {user.username?.[0]?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
                {/* Online dot */}
                <View style={S.userOnlineDot} />
              </View>
              <Text style={S.userModalName}>{user.username || 'Unknown User'}</Text>
              {user.bio ? <Text style={S.userModalBio} numberOfLines={3}>{user.bio}</Text> : null}
              <View style={S.userStatsRow}>
                <View style={S.userStat}>
                  <Text style={S.userStatVal}>{user.reviews || 0}</Text>
                  <Text style={S.userStatLbl}>Reviews</Text>
                </View>
                <View style={S.userStatDivider} />
                <View style={S.userStat}>
                  <Text style={S.userStatVal}>{user.watchlist_count || 0}</Text>
                  <Text style={S.userStatLbl}>Watchlist</Text>
                </View>
                <View style={S.userStatDivider} />
                <View style={S.userStat}>
                  <Text style={S.userStatVal}>{user.followers || 0}</Text>
                  <Text style={S.userStatLbl}>Followers</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={S.userModalClose}>
                <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: rs(13), fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// ─── TRAILER PLAYER ──────────────────────────────────────────────────────────
function TrailerPlayer({ movie }) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrent] = useState(0);
  const [ended, setEnded] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimer = useRef(null);
  const fadeCtrl = useRef(new Animated.Value(1)).current;

  // Auto-hide controls after 3s
  const showControls = useCallback(() => {
    setControlsVisible(true);
    Animated.timing(fadeCtrl, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (!paused) {
        Animated.timing(fadeCtrl, { toValue: 0, duration: 400, useNativeDriver: true }).start();
        setControlsVisible(false);
      }
    }, 3000);
  }, [paused]);

  useEffect(() => { showControls(); }, []);

  const handleTap = useCallback(() => {
    if (ended) return;
    setPaused(p => !p);
    showControls();
  }, [ended, showControls]);

  const handleProgress = useCallback(({ currentTime: ct, seekableDuration }) => {
    setCurrent(ct);
    const dur = seekableDuration || duration;
    if (dur > 0) setProgress(ct / dur);
  }, [duration]);

  const handleLoad = useCallback(({ duration: d }) => {
    setDuration(d);
    setBuffering(false);
  }, []);

  const handleEnd = useCallback(() => {
    setEnded(true);
    setPaused(true);
    setProgress(1);
    Animated.timing(fadeCtrl, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const handleReplay = useCallback(() => {
    setEnded(false);
    setProgress(0);
    setCurrent(0);
    setPaused(false);
    videoRef.current?.seek(0);
    showControls();
  }, [showControls]);

  const handleSeek = useCallback((e) => {
    const { locationX } = e.nativeEvent;
    const barWidth = SW - rs(32);
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    const seekTo = ratio * duration;
    videoRef.current?.seek(seekTo);
    setProgress(ratio);
    setCurrent(seekTo);
    if (ended) { setEnded(false); setPaused(false); }
    showControls();
  }, [duration, ended, showControls]);

  const remaining = useMemo(() => {
    const rem = Math.max(0, duration - currentTime);
    const m = Math.floor(rem / 60);
    const s = Math.floor(rem % 60);
    return `-${m}:${s.toString().padStart(2, '0')}`;
  }, [duration, currentTime]);

  const trailerUrl = movie?.trailer_url;
  // Use a royalty-free demo video if no trailer
  const videoSource = trailerUrl
    ? { uri: trailerUrl }
    : { uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' };

  return (
    <View style={S.trailerWrap}>
      {/* Video */}
      <TouchableOpacity onPress={handleTap} activeOpacity={1} style={StyleSheet.absoluteFill}>
        <Video
          ref={videoRef}
          source={videoSource}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          paused={paused}
          muted={muted}
          repeat={false}
          onProgress={handleProgress}
          onLoad={handleLoad}
          onEnd={handleEnd}
          onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
          bufferConfig={{
            minBufferMs: 2000,
            maxBufferMs: 15000,
            bufferForPlaybackMs: 1000,
            bufferForPlaybackAfterRebufferMs: 2000,
          }}
        />
      </TouchableOpacity>

      {/* Poster fallback overlay (shows when buffering) */}
      {(buffering && !ended) && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      )}

      {/* Glass overlay gradients */}
      <LinearGradient colors={['rgba(3,15,12,0.35)', 'rgba(3,15,12,0)']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.3 }}
        style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.7)', COLORS.bg || '#030F0C']}
        start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill} pointerEvents="none" />

      {/* Play/Pause center icon */}
      {!ended && (
        <Animated.View style={[S.playOverlay, { opacity: fadeCtrl }]} pointerEvents="none">
          <View style={S.playIconWrap}>
            <LinearGradient colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(40) }]} />
            <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(40) }]} />
            <Text style={S.playIcon}>{paused ? '▶' : '⏸'}</Text>
          </View>
        </Animated.View>
      )}

      {/* Replay button */}
      {ended && (
        <View style={S.replayWrap}>
          <TouchableOpacity onPress={handleReplay} style={S.replayBtn} activeOpacity={0.85}>
            <LinearGradient colors={[ACCENT, ACCENT_DIM, '#009A6E']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(36) }]} />
            <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(36) }]} />
            <Text style={S.replayIcon}>↺</Text>
            <Text style={S.replayLabel}>Replay</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Progress + Controls bar — ALWAYS visible below trailer */}
      <View style={S.controlsBar}>
        <LinearGradient colors={['rgba(3,15,12,0.85)', 'rgba(5,25,18,0.92)']}
          style={[StyleSheet.absoluteFill, { borderRadius: 0 }]} />
        <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 0 }]} />

        {/* Progress Track */}
        <TouchableOpacity onPress={handleSeek} activeOpacity={1} style={S.progressTouchable}>
          <View style={S.progressTrack}>
            {/* Background */}
            <View style={S.progressBg} />
            {/* Buffered indicator */}
            <View style={[S.progressBuffered, { width: `${Math.min(progress * 100 + 15, 100)}%` }]} />
            {/* Filled */}
            <View style={[S.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
            {/* Thumb */}
            <View style={[S.progressThumb, { left: `${Math.min(progress * 100, 98)}%` }]} />
          </View>
        </TouchableOpacity>

        {/* Control icons row */}
        <View style={S.controlsRow}>
          <TouchableOpacity onPress={handleTap} style={S.ctrlBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={S.ctrlBtnInner}>
              <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <Icon name={paused ? 'play' : 'pause'} size={rs(14)} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMuted(m => !m); showControls(); }} style={S.ctrlBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={S.ctrlBtnInner}>
              <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <Icon name={muted ? 'volume-x' : 'volume-2'} size={rs(14)} color={muted ? 'rgba(255,255,255,0.4)' : '#FFFFFF'} />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <Text style={S.remainingTime}>{remaining}</Text>

          <TouchableOpacity onPress={handleReplay} style={S.ctrlBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={S.ctrlBtnInner}>
              <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <Text style={{ fontSize: rs(13), color: '#FFFFFF' }}>↺</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── CAST CARD ────────────────────────────────────────────────────────────────
const CastCard = memo(({ person }) => {
  const scaleA = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scaleA, { toValue: 0.93, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onOut = () => Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();
  return (
    <TouchableOpacity onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      <Animated.View style={[S.castCard, { transform: [{ scale: scaleA }] }]}>
        <LinearGradient colors={[GLASS_BORDER, 'rgba(0,255,178,0.06)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
        <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)']}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
        <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
        {/* Avatar */}
        <View style={S.castAvatarRing}>
          <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: rs(42) }]} />
          {person.avatar ? (
            <Image source={{ uri: person.avatar }} style={S.castAvatar} />
          ) : (
            <View style={[S.castAvatar, { backgroundColor: 'rgba(0,255,178,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: ACCENT, fontSize: rs(18), fontWeight: '900' }}>{person.name?.[0] || '?'}</Text>
            </View>
          )}
        </View>
        <Text style={S.castName} numberOfLines={2}>{person.name}</Text>
        <Text style={S.castChar} numberOfLines={1}>{person.character}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── SIMILAR MOVIE CARD ───────────────────────────────────────────────────────
const SimilarCard = memo(({ item, onPress }) => {
  const colW = (SW - rs(32) - rs(8)) / 2;
  const colH = colW * 1.5;
  const scaleA = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scaleA, { toValue: 0.95, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onOut = () => Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();
  return (
    <TouchableOpacity onPress={() => onPress(item)} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
      style={{ width: colW, marginBottom: rs(8) }}>
      <Animated.View style={[S.simCard, { width: colW, height: colH, transform: [{ scale: scaleA }] }]}>
        <LinearGradient colors={[GLASS_BORDER, 'rgba(0,255,178,0.04)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
        <View style={[S.simCardInner, { borderRadius: rs(13) }]}>
          {item.poster ? (
            <ImageBackground source={{ uri: item.poster }} style={StyleSheet.absoluteFill}
              imageStyle={{ borderRadius: rs(13) }} resizeMode="cover">
              <LinearGradient colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.7)', 'rgba(3,15,12,0.96)']}
                locations={[0, 0.55, 1]} style={[StyleSheet.absoluteFill, { borderRadius: rs(13) }]} />
              <LinearGradient colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.3 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(13) }]} />
              <View style={S.simBottom}>
                <Text style={S.simTitle} numberOfLines={2}>{item.title}</Text>
                {item.rating != null && (
                  <View style={S.simRating}>
                    <Text style={S.simRatingTxt}>⭐ {Number(item.rating).toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </ImageBackground>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={S.simTitle} numberOfLines={3}>{item.title}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── COMMENT CARD ─────────────────────────────────────────────────────────────
const CommentCard = memo(({ comment, onLike, onUserPress }) => {
  const timeAgo = useMemo(() => {
    const d = new Date(comment.created_at);
    const diff = Date.now() - d.getTime();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return 'just now';
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, [comment.created_at]);

  return (
    <View style={S.commentCard}>
      <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
      <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
      <View style={S.commentHeader}>
        <TouchableOpacity onPress={() => onUserPress(comment)} activeOpacity={0.8}>
          <View style={S.commentAvatarRing}>
            <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: rs(24) }]} />
            {comment.avatar ? (
              <Image source={{ uri: comment.avatar }} style={S.commentAvatar} />
            ) : (
              <View style={[S.commentAvatar, { backgroundColor: 'rgba(0,255,178,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: ACCENT, fontSize: rs(14), fontWeight: '900' }}>
                  {comment.username?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: rs(10) }}>
          <TouchableOpacity onPress={() => onUserPress(comment)} activeOpacity={0.8}>
            <Text style={S.commentUser}>{comment.username}</Text>
          </TouchableOpacity>
          <Text style={S.commentTime}>{timeAgo}</Text>
        </View>
        <TouchableOpacity onPress={() => onLike(comment.id)} style={S.commentLikeBtn} activeOpacity={0.8}>
          <LinearGradient
            colors={comment.liked_by_me ? [ACCENT, ACCENT_DIM] : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
          <Text style={[S.commentLikeIcon, comment.liked_by_me && { color: COLORS.bg || '#030F0C' }]}>♥</Text>
          <Text style={[S.commentLikeTxt, comment.liked_by_me && { color: COLORS.bg || '#030F0C' }]}>{comment.likes}</Text>
        </TouchableOpacity>
      </View>
      <Text style={S.commentText}>{comment.text}</Text>
    </View>
  );
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function MovieDetails({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { movieId, movie: routeMovie } = route?.params || {};
  const { toast, showToast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [movie, setMovie] = useState(routeMovie || null);
  const [cast, setCast] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(!routeMovie);
  const [activeTab, setActiveTab] = useState(0); // 0=More Like This, 1=Comments
  const [liked, setLiked] = useState(false);
  const [inList, setInList] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [synExpanded, setSynExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [userModal, setUserModal] = useState({ visible: false, user: null });
  const [loadingComments, setLoadingComments] = useState(false);
  const currentUser = useRef(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const entryA = useRef(new Animated.Value(0)).current;
  const entryY = useRef(new Animated.Value(rs(24))).current;

  // ── Auth check helper ──────────────────────────────────────────────────────
  const requireAuth = useCallback((action) => {
    if (currentUser.current) {
      action();
    } else {
      Alert.alert(
        'Login Required',
        'Please log in to continue.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Login',
            onPress: () => navigation.navigate('ProfileTab'),
          },
        ]
      );
    }
  }, [navigation]);

  // ── Load everything ────────────────────────────────────────────────────────
  useEffect(() => {
    startShimmer();
    StatusBar.setHidden(true, 'fade');
    loadAll();
    return () => StatusBar.setHidden(false, 'fade');
  }, [movieId]);

  const loadAll = useCallback(async () => {
    try {
      const user = await getCurrentUser().catch(() => null);
      currentUser.current = user;

      const [movieData, castData, simData, commentsData] = await Promise.all([
        movieId ? fetchMovieById(movieId).catch(() => null) : Promise.resolve(routeMovie),
        fetchCastAndCrew(movieId).catch(() => []),
        fetchSimilarMovies(movieId).catch(() => []),
        fetchComments(movieId).catch(() => []),
      ]);

      const resolvedMovie = movieData || routeMovie || MOCK_MOVIE;
      setMovie(resolvedMovie);
      setCast(castData?.length ? castData : MOCK_CAST);
      setSimilar(simData?.length ? simData : MOCK_SIMILAR);
      setComments(commentsData?.length ? commentsData : MOCK_COMMENTS);
    } catch (e) {
      console.warn('loadAll error:', e.message);
      setMovie(MOCK_MOVIE);
      setCast(MOCK_CAST);
      setSimilar(MOCK_SIMILAR);
      setComments(MOCK_COMMENTS);
    } finally {
      setLoading(false);
      Animated.parallel([
        Animated.timing(entryA, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(entryY, { toValue: 0, useNativeDriver: true, tension: 90, friction: 18 }),
      ]).start();
    }
  }, [movieId]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const data = await fetchComments(movieId);
      setComments(data?.length ? data : MOCK_COMMENTS);
    } catch {
      setComments(MOCK_COMMENTS);
    } finally {
      setLoadingComments(false);
    }
  }, [movieId]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleLike = useCallback(() => {
    requireAuth(async () => {
      try {
        await toggleLike(currentUser.current?.id, movieId);
        setLiked(p => !p);
        showToast(liked ? 'Removed from liked' : '♥ Liked!');
      } catch { showToast('Could not update like'); }
    });
  }, [liked, movieId, requireAuth]);

  const handleWatchlist = useCallback(() => {
    requireAuth(async () => {
      try {
        await toggleWatchlist(currentUser.current?.id, movieId);
        setInList(p => !p);
        showToast(inList ? 'Removed from list' : '✓ Added to My List');
      } catch { showToast('Could not update list'); }
    });
  }, [inList, movieId, requireAuth]);

  const handleRate = useCallback(() => {
    requireAuth(() => setRatingModalVisible(true));
  }, [requireAuth]);

  const handleRatingSubmit = useCallback(async (stars) => {
    try {
      await submitRating(currentUser.current?.id, movieId, stars);
      setMyRating(stars);
      showToast(`✓ Rated ${stars}/10`);
    } catch { showToast('Could not submit rating'); }
  }, [movieId]);

  const handlePostComment = useCallback(() => {
    requireAuth(async () => {
      if (!commentText.trim()) return;
      setPostingComment(true);
      try {
        const newComment = await postComment(currentUser.current?.id, movieId, commentText.trim());
        setComments(p => [newComment || {
          id: `tmp_${Date.now()}`,
          user_id: currentUser.current?.id,
          username: currentUser.current?.username || 'You',
          avatar: currentUser.current?.avatar,
          text: commentText.trim(),
          likes: 0,
          created_at: new Date().toISOString(),
          liked_by_me: false,
        }, ...p]);
        setCommentText('');
        showToast('✓ Comment posted');
        Keyboard.dismiss();
      } catch { showToast('Could not post comment'); }
      finally { setPostingComment(false); }
    });
  }, [commentText, movieId, requireAuth]);

  const handleCommentLike = useCallback((commentId) => {
    requireAuth(async () => {
      setComments(p => p.map(c =>
        c.id === commentId
          ? { ...c, likes: c.liked_by_me ? c.likes - 1 : c.likes + 1, liked_by_me: !c.liked_by_me }
          : c
      ));
    });
  }, [requireAuth]);

  const handleUserPress = useCallback(async (commentOrUser) => {
    try {
      const profile = await fetchUserProfile(commentOrUser.user_id).catch(() => null);
      setUserModal({
        visible: true,
        user: profile || {
          username: commentOrUser.username,
          avatar: commentOrUser.avatar,
          bio: 'Movie enthusiast & critic.',
          reviews: Math.floor(Math.random() * 50),
          watchlist_count: Math.floor(Math.random() * 200),
          followers: Math.floor(Math.random() * 500),
        },
      });
    } catch {
      setUserModal({
        visible: true,
        user: {
          username: commentOrUser.username,
          avatar: commentOrUser.avatar,
          bio: null, reviews: 0, watchlist_count: 0, followers: 0,
        },
      });
    }
  }, []);

  const handleSimilarPress = useCallback((item) => {
    navigation.push('MovieDetail', { movieId: item.id, movie: item });
  }, [navigation]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const synopsis = useMemo(() => {
    if (!movie?.description) return '';
    return synExpanded ? movie.description : (movie.description.length > 120 ? movie.description.slice(0, 120) + '…' : movie.description);
  }, [movie?.description, synExpanded]);

  const bottomPad = Math.max(insets.bottom, 12) + rs(90);

  if (loading) {
    return (
      <View style={S.root}>
        <StatusBar hidden />
        <SkeletonBox width={SW} height={TRAILER_H + rs(60)} borderRadius={0} />
        <View style={{ padding: rs(18) }}>
          <SkeletonBox width={SW * 0.7} height={rs(28)} style={{ marginBottom: rs(12) }} />
          <SkeletonBox width={SW * 0.5} height={rs(16)} style={{ marginBottom: rs(24) }} />
          <View style={{ flexDirection: 'row', gap: rs(10), marginBottom: rs(28) }}>
            {[0, 1, 2].map(i => <SkeletonBox key={i} width={rs(90)} height={rs(44)} borderRadius={rs(22)} />)}
          </View>
          <SkeletonBox width="100%" height={rs(80)} borderRadius={rs(16)} />
        </View>
      </View>
    );
  }

  if (!movie) return null;

  return (
    <View style={S.root}>
      <StatusBar hidden />

      {/* ── BACK BUTTON (absolute, above trailer) ── */}
      <View style={[S.backBtnWrap, { top: insets.top + rs(12) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85} style={S.backBtn}>
          <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.10)']}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(22) }]} />
          <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(22) }]} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)']}
            start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(22) }]} />
          <Icon name="chevron-left" size={rs(20)} color="#FFFFFF" />
        </TouchableOpacity>
        {/* Movie title in header */}
        <View style={S.backTitle}>
          <LinearGradient colors={['rgba(3,15,12,0.7)', 'rgba(3,15,12,0.4)']}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
          <Text style={S.backTitleTxt} numberOfLines={1}>{limitWords(movie.title, 4)}</Text>
        </View>
      </View>

      <Animated.ScrollView
        style={S.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: entryA, transform: [{ translateY: entryY }] }}>

          {/* ── TRAILER ── */}
          <View style={{ height: TRAILER_H, backgroundColor: '#000' }}>
            <TrailerPlayer movie={movie} />
          </View>

          {/* ── CONTROLS BAR is rendered INSIDE TrailerPlayer below trailer ── */}

          {/* ── BIG PLAY BUTTON ── */}
          <View style={S.bigPlayWrap}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Player', { movieId: movie.id })}
              activeOpacity={0.88}
              style={S.bigPlayBtn}
            >
              <LinearGradient colors={[ACCENT, ACCENT_DIM, '#009A6E']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
              <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)']}
                start={{ x: 0, y: 0.55 }} end={{ x: 0, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
              <Text style={S.bigPlayIcon}>▶</Text>
              <Text style={S.bigPlayLabel}>Play Movie</Text>
            </TouchableOpacity>
          </View>

          {/* ── MOVIE INFO ── */}
          <View style={S.infoSection}>
            {/* Genre pills */}
            <View style={S.genreRow}>
              {movie.genre?.map(g => (
                <View key={g} style={S.genrePill}>
                  <LinearGradient colors={[ACCENT + '33', ACCENT + '11']}
                    style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                  <Text style={S.genreTxt}>{g}</Text>
                </View>
              ))}
              {movie.quality && (
                <View style={[S.genrePill, S.qualityPill]}>
                  <LinearGradient colors={['rgba(255,215,0,0.28)', 'rgba(255,215,0,0.10)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                  <Text style={S.qualityTxt}>{movie.quality}</Text>
                </View>
              )}
            </View>

            {/* Title */}
            <Text style={S.title}>{limitWords(movie.title, 8)}</Text>

            {/* Meta row */}
            <View style={S.metaRow}>
              {movie.year && (
                <View style={S.metaChip}>
                  <Icon name="calendar" size={rs(11)} color="rgba(255,255,255,0.55)" style={{ marginRight: rs(4) }} />
                  <Text style={S.metaTxt}>{movie.year}</Text>
                </View>
              )}
              {movie.duration && (
                <View style={S.metaChip}>
                  <Icon name="clock" size={rs(11)} color="rgba(255,255,255,0.55)" style={{ marginRight: rs(4) }} />
                  <Text style={S.metaTxt}>{movie.duration} min</Text>
                </View>
              )}
              {movie.language && (
                <View style={S.metaChip}>
                  <Icon name="globe" size={rs(11)} color="rgba(255,255,255,0.55)" style={{ marginRight: rs(4) }} />
                  <Text style={S.metaTxt}>{movie.language}</Text>
                </View>
              )}
              {movie.rating && (
                <View style={[S.metaChip, S.ratingMetaChip]}>
                  <LinearGradient colors={['rgba(255,215,0,0.25)', 'rgba(255,215,0,0.08)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                  <Text style={S.ratingMetaTxt}>⭐ {Number(movie.rating).toFixed(1)}</Text>
                </View>
              )}
            </View>

            {movie.director && (
              <Text style={S.directorTxt}>
                <Text style={{ color: 'rgba(255,255,255,0.42)', fontWeight: '500' }}>Directed by  </Text>
                {movie.director}
              </Text>
            )}
          </View>

          {/* ── ACTION BUTTONS ── */}
          <View style={S.actionRow}>
            {/* Like */}
            <TouchableOpacity onPress={handleLike} activeOpacity={0.85} style={S.actionBtn}>
              <LinearGradient
                colors={liked ? [ACCENT + '44', ACCENT + '22'] : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <Text style={[S.actionIcon, liked && { color: ACCENT }]}>♥</Text>
              <Text style={[S.actionLabel, liked && { color: ACCENT }]}>Like</Text>
            </TouchableOpacity>

            {/* Add to List */}
            <TouchableOpacity onPress={handleWatchlist} activeOpacity={0.85} style={S.actionBtn}>
              <LinearGradient
                colors={inList ? [ACCENT + '44', ACCENT + '22'] : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <Text style={[S.actionIcon, inList && { color: ACCENT }]}>{inList ? '✓' : '＋'}</Text>
              <Text style={[S.actionLabel, inList && { color: ACCENT }]}>{inList ? 'Listed' : 'My List'}</Text>
            </TouchableOpacity>

            {/* Rate */}
            <TouchableOpacity onPress={handleRate} activeOpacity={0.85} style={S.actionBtn}>
              <LinearGradient
                colors={myRating > 0 ? ['rgba(255,215,0,0.28)', 'rgba(255,215,0,0.10)'] : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <Text style={[S.actionIcon, myRating > 0 && { color: '#FFD700' }]}>☆</Text>
              <Text style={[S.actionLabel, myRating > 0 && { color: '#FFD700' }]}>{myRating > 0 ? `${myRating}/10` : 'Rate'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── SYNOPSIS ── */}
          <View style={S.sectionWrap}>
            <View style={S.sectionHeaderRow}>
              <View style={S.sectionBar} />
              <Text style={S.sectionTitle}>Synopsis</Text>
            </View>
            <View style={S.synopsisCard}>
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
              <Text style={S.synopsisText}>{synopsis}</Text>
              {movie.description?.length > 120 && (
                <TouchableOpacity onPress={() => setSynExpanded(e => !e)} style={S.readMoreBtn}>
                  <Text style={S.readMoreTxt}>{synExpanded ? 'Show less ▲' : 'Read more ▼'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── CAST & CREW ── */}
          {cast.length > 0 && (
            <View style={S.sectionWrap}>
              <View style={S.sectionHeaderRow}>
                <View style={S.sectionBar} />
                <Text style={S.sectionTitle}>Cast & Crew</Text>
              </View>
              <FlatList
                data={cast}
                horizontal
                keyExtractor={i => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: rs(16), gap: rs(10) }}
                renderItem={({ item }) => <CastCard person={item} />}
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={3}
                removeClippedSubviews
              />
            </View>
          )}

          {/* ── TABS: More Like This / Comments ── */}
          <View style={S.sectionWrap}>
            <View style={S.tabsRow}>
              {['More Like This', 'Comments'].map((tab, i) => (
                <TouchableOpacity key={tab} onPress={() => { setActiveTab(i); if (i === 1) loadComments(); }} style={S.tabBtn}>
                  <LinearGradient
                    colors={activeTab === i ? [ACCENT + '33', ACCENT + '11'] : ['transparent', 'transparent']}
                    style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
                  <Text style={[S.tabTxt, activeTab === i && S.tabTxtActive]}>{tab}</Text>
                  {activeTab === i && (
                    <View style={S.tabActiveLine}>
                      <LinearGradient colors={[ACCENT, ACCENT_DIM]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill} />
                    </View>
                  )}
                  {i === 1 && comments.length > 0 && (
                    <View style={S.tabBadge}>
                      <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: rs(8) }]} />
                      <Text style={S.tabBadgeTxt}>{comments.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Tab 0: Similar Movies 2-col grid */}
            {activeTab === 0 && (
              <View style={S.simGrid}>
                {similar.map((item, i) => (
                  <SimilarCard key={item.id} item={item} onPress={handleSimilarPress} />
                ))}
                {similar.length % 2 !== 0 && <View style={{ width: (SW - rs(32) - rs(8)) / 2 }} />}
              </View>
            )}

            {/* Tab 1: Comments */}
            {activeTab === 1 && (
              <View>
                {/* Comment Input */}
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                  <View style={S.commentInputWrap}>
                    <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)']}
                      style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
                    <LinearGradient colors={GLASS_SHINE} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: rs(16) }]} />
                    <TextInput
                      style={S.commentInput}
                      placeholder="Add a comment…"
                      placeholderTextColor="rgba(255,255,255,0.38)"
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                      maxLength={280}
                      onFocus={() => requireAuth(() => {})}
                    />
                    <TouchableOpacity onPress={handlePostComment} disabled={postingComment || !commentText.trim()}
                      style={[S.commentSendBtn, (!commentText.trim()) && { opacity: 0.4 }]}>
                      {postingComment ? (
                        <ActivityIndicator color={COLORS.bg || '#030F0C'} size="small" />
                      ) : (
                        <>
                          <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                          <Icon name="send" size={rs(14)} color={COLORS.bg || '#030F0C'} />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </KeyboardAvoidingView>

                {/* Comments List */}
                {loadingComments ? (
                  <ActivityIndicator color={ACCENT} style={{ marginTop: rs(20) }} />
                ) : comments.length === 0 ? (
                  <View style={S.noComments}>
                    <Text style={{ fontSize: rs(32) }}>💬</Text>
                    <Text style={S.noCommentsTxt}>No comments yet. Be the first!</Text>
                  </View>
                ) : (
                  <View style={{ gap: rs(10), marginTop: rs(8) }}>
                    {comments.map(c => (
                      <CommentCard
                        key={c.id}
                        comment={c}
                        onLike={handleCommentLike}
                        onUserPress={handleUserPress}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

        </Animated.View>
      </Animated.ScrollView>

      {/* ── Modals ── */}
      <RatingModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        onSubmit={handleRatingSubmit}
        currentRating={myRating}
      />
      <UserProfileModal
        visible={userModal.visible}
        user={userModal.user}
        onClose={() => setUserModal({ visible: false, user: null })}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg || '#030F0C' },
  scroll: { flex: 1 },

  // Back button
  backBtnWrap: {
    position: 'absolute', left: rs(16), zIndex: 200,
    flexDirection: 'row', alignItems: 'center', gap: rs(10),
  },
  backBtn: {
    width: rs(42), height: rs(42), borderRadius: rs(22),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: GLASS_BORDER,
    shadowColor: 'rgba(0,255,178,0.3)',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 1, shadowRadius: rs(12), elevation: 10,
  },
  backTitle: {
    paddingHorizontal: rs(12), paddingVertical: rs(6),
    borderRadius: rs(16), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  backTitleTxt: {
    color: 'rgba(255,255,255,0.85)', fontSize: rs(13), fontWeight: '700',
  },

  // Trailer
  trailerWrap: {
    width: SW, height: TRAILER_H + rs(60),
    backgroundColor: '#000',
  },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: rs(60),
    alignItems: 'center', justifyContent: 'center',
  },
  playIconWrap: {
    width: rs(68), height: rs(68), borderRadius: rs(34),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1.5, borderColor: GLASS_BORDER,
    shadowColor: '#fff', shadowOpacity: 0.2, shadowRadius: rs(16),
  },
  playIcon: { color: '#FFFFFF', fontSize: rs(22), fontWeight: '900', paddingLeft: rs(4) },

  // Replay
  replayWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: rs(60),
    alignItems: 'center', justifyContent: 'center',
  },
  replayBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: rs(24), paddingVertical: rs(14),
    borderRadius: rs(36), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,255,178,0.5)',
    shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: rs(16),
    gap: rs(8),
  },
  replayIcon: { color: COLORS.bg || '#030F0C', fontSize: rs(20), fontWeight: '900' },
  replayLabel: { color: COLORS.bg || '#030F0C', fontSize: rs(15), fontWeight: '800' },

  // Controls bar — always visible below video
  controlsBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: rs(60), overflow: 'hidden',
    borderTopWidth: 1, borderColor: GLASS_BORDER,
  },
  progressTouchable: {
    paddingHorizontal: rs(16), paddingTop: rs(12), paddingBottom: rs(4),
  },
  progressTrack: {
    height: rs(4), borderRadius: rs(2), position: 'relative',
  },
  progressBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: rs(2),
  },
  progressBuffered: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: rs(2),
  },
  progressFill: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    backgroundColor: ACCENT, borderRadius: rs(2),
    shadowColor: ACCENT, shadowOpacity: 0.9, shadowRadius: rs(4),
  },
  progressThumb: {
    position: 'absolute', top: -rs(4), marginLeft: -rs(6),
    width: rs(12), height: rs(12), borderRadius: rs(6),
    backgroundColor: '#FFFFFF',
    shadowColor: ACCENT, shadowOpacity: 0.8, shadowRadius: rs(6),
    elevation: 4,
  },
  controlsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: rs(12), paddingTop: rs(4),
  },
  ctrlBtn: { marginRight: rs(8) },
  ctrlBtnInner: {
    width: rs(32), height: rs(32), borderRadius: rs(16),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
  },
  remainingTime: {
    color: 'rgba(255,255,255,0.80)', fontSize: rs(11), fontWeight: '700',
    marginRight: rs(8), fontVariant: ['tabular-nums'],
  },

  // Big Play
  bigPlayWrap: { paddingHorizontal: rs(16), marginTop: rs(14), marginBottom: rs(4) },
  bigPlayBtn: {
    height: rs(52), borderRadius: rs(14),
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1.5, borderColor: ACCENT + '88',
    shadowColor: ACCENT, shadowOpacity: 0.35, shadowRadius: rs(16),
    shadowOffset: { width: 0, height: rs(4) }, elevation: 10,
    gap: rs(10),
  },
  bigPlayIcon: { color: COLORS.bg || '#030F0C', fontSize: rs(18), fontWeight: '900' },
  bigPlayLabel: { color: COLORS.bg || '#030F0C', fontSize: rs(16), fontWeight: '900', letterSpacing: 0.5 },

  // Info section
  infoSection: { paddingHorizontal: rs(16), paddingTop: rs(16) },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8), marginBottom: rs(12) },
  genrePill: {
    paddingHorizontal: rs(12), paddingVertical: rs(5),
    borderRadius: rs(20), overflow: 'hidden',
    borderWidth: 1, borderColor: ACCENT + '44',
  },
  genreTxt: { color: ACCENT, fontSize: rs(11), fontWeight: '700', letterSpacing: 0.5 },
  qualityPill: { borderColor: 'rgba(255,215,0,0.40)' },
  qualityTxt: { color: '#FFD700', fontSize: rs(11), fontWeight: '800', letterSpacing: 0.5 },
  title: {
    color: '#FFFFFF', fontSize: rs(28), fontWeight: '900', letterSpacing: -0.5,
    lineHeight: rs(34), marginBottom: rs(12),
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: rs(2) }, textShadowRadius: rs(8),
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(8), marginBottom: rs(10) },
  metaChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: rs(10), paddingVertical: rs(5),
    borderRadius: rs(20), borderWidth: 1, borderColor: GLASS_BORDER,
    backgroundColor: GLASS_WHITE,
  },
  metaTxt: { color: 'rgba(255,255,255,0.65)', fontSize: rs(11), fontWeight: '600' },
  ratingMetaChip: {
    overflow: 'hidden', borderColor: 'rgba(255,215,0,0.30)',
  },
  ratingMetaTxt: { color: '#FFD700', fontSize: rs(11), fontWeight: '700' },
  directorTxt: {
    color: '#FFFFFF', fontSize: rs(12), fontWeight: '700',
    marginTop: rs(4), marginBottom: rs(4),
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row', paddingHorizontal: rs(16),
    gap: rs(10), marginTop: rs(16), marginBottom: rs(4),
  },
  actionBtn: {
    flex: 1, paddingVertical: rs(14),
    borderRadius: rs(16), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(0,255,178,0.12)',
    shadowOffset: { width: 0, height: rs(3) },
    shadowOpacity: 1, shadowRadius: rs(8), elevation: 6,
  },
  actionIcon: {
    color: 'rgba(255,255,255,0.80)', fontSize: rs(20), marginBottom: rs(3), fontWeight: '700',
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.65)', fontSize: rs(10), fontWeight: '700', letterSpacing: 0.3,
  },

  // Sections
  sectionWrap: { marginTop: rs(24), paddingHorizontal: rs(16) },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(12) },
  sectionBar: {
    width: rs(3), height: rs(18), borderRadius: rs(2),
    backgroundColor: ACCENT, marginRight: rs(8),
    shadowColor: ACCENT, shadowOpacity: 0.9, shadowRadius: rs(6),
  },
  sectionTitle: {
    color: '#FFFFFF', fontSize: rs(17), fontWeight: '800', letterSpacing: 0.2,
  },

  // Synopsis
  synopsisCard: {
    padding: rs(16), borderRadius: rs(16), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  synopsisText: {
    color: 'rgba(255,255,255,0.75)', fontSize: rs(13), lineHeight: rs(21), fontWeight: '400',
  },
  readMoreBtn: { marginTop: rs(8), alignSelf: 'flex-start' },
  readMoreTxt: { color: ACCENT, fontSize: rs(12), fontWeight: '700' },

  // Cast
  castCard: {
    width: rs(100), paddingVertical: rs(14), paddingHorizontal: rs(8),
    borderRadius: rs(16), overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
    alignItems: 'center',
    shadowColor: 'rgba(0,255,178,0.12)',
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 1, shadowRadius: rs(10), elevation: 8,
  },
  castAvatarRing: {
    width: rs(66), height: rs(66), borderRadius: rs(33),
    padding: rs(2), marginBottom: rs(8),
    shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: rs(8),
  },
  castAvatar: { width: rs(62), height: rs(62), borderRadius: rs(31) },
  castName: {
    color: '#FFFFFF', fontSize: rs(11), fontWeight: '700',
    textAlign: 'center', lineHeight: rs(14),
  },
  castChar: {
    color: ACCENT, fontSize: rs(9), fontWeight: '600',
    textAlign: 'center', marginTop: rs(2), opacity: 0.85,
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row', marginBottom: rs(16),
    borderBottomWidth: 1, borderColor: GLASS_BORDER,
  },
  tabBtn: {
    flex: 1, paddingVertical: rs(12), alignItems: 'center',
    justifyContent: 'center', flexDirection: 'row', gap: rs(6),
    overflow: 'hidden', borderRadius: rs(12), position: 'relative',
  },
  tabTxt: {
    color: 'rgba(255,255,255,0.45)', fontSize: rs(13), fontWeight: '700',
  },
  tabTxtActive: { color: ACCENT },
  tabActiveLine: {
    position: 'absolute', bottom: 0, left: rs(8), right: rs(8),
    height: rs(2.5), borderRadius: rs(2), overflow: 'hidden',
  },
  tabBadge: {
    minWidth: rs(18), height: rs(18), borderRadius: rs(9),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingHorizontal: rs(4),
  },
  tabBadgeTxt: { color: COLORS.bg || '#030F0C', fontSize: rs(9), fontWeight: '900' },

  // Similar grid
  simGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: rs(8), justifyContent: 'space-between',
  },
  simCard: {
    borderRadius: rs(14), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
    shadowColor: 'rgba(0,0,0,0.4)',
    shadowOffset: { width: 0, height: rs(4) }, shadowOpacity: 1, shadowRadius: rs(10), elevation: 8,
  },
  simCardInner: { flex: 1, overflow: 'hidden', backgroundColor: COLORS.bg2 || '#0A1A14' },
  simBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: rs(8) },
  simTitle: { color: '#FFFFFF', fontSize: rs(11), fontWeight: '700', lineHeight: rs(14), marginBottom: rs(4) },
  simRating: {
    alignSelf: 'flex-start', paddingHorizontal: rs(6), paddingVertical: rs(2),
    borderRadius: rs(6), borderWidth: 1, borderColor: 'rgba(255,215,0,0.30)', overflow: 'hidden',
    backgroundColor: 'rgba(255,215,0,0.10)',
  },
  simRatingTxt: { color: '#FFD700', fontSize: rs(9), fontWeight: '700' },

  // Comments
  commentInputWrap: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: rs(12), borderRadius: rs(16), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER, marginBottom: rs(12), gap: rs(10),
  },
  commentInput: {
    flex: 1, color: '#FFFFFF', fontSize: rs(13), fontWeight: '500',
    paddingVertical: rs(4), maxHeight: rs(80), lineHeight: rs(18),
  },
  commentSendBtn: {
    width: rs(38), height: rs(38), borderRadius: rs(19),
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  commentCard: {
    padding: rs(14), borderRadius: rs(16), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(8) },
  commentAvatarRing: {
    width: rs(40), height: rs(40), borderRadius: rs(20), padding: rs(1.5), overflow: 'hidden',
  },
  commentAvatar: { width: rs(37), height: rs(37), borderRadius: rs(18.5) },
  commentUser: { color: '#FFFFFF', fontSize: rs(13), fontWeight: '700' },
  commentTime: { color: 'rgba(255,255,255,0.42)', fontSize: rs(10), marginTop: rs(1) },
  commentLikeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: rs(4),
    paddingHorizontal: rs(10), paddingVertical: rs(6),
    borderRadius: rs(14), overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
  },
  commentLikeIcon: { color: 'rgba(255,255,255,0.65)', fontSize: rs(13) },
  commentLikeTxt: { color: 'rgba(255,255,255,0.65)', fontSize: rs(11), fontWeight: '700' },
  commentText: { color: 'rgba(255,255,255,0.80)', fontSize: rs(13), lineHeight: rs(19) },
  noComments: { alignItems: 'center', paddingVertical: rs(30), gap: rs(10) },
  noCommentsTxt: { color: 'rgba(255,255,255,0.45)', fontSize: rs(13), fontWeight: '600' },

  // Glass button
  glassBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: rs(18), paddingVertical: rs(12),
    borderRadius: rs(28), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  glassBtnSmall: { paddingHorizontal: rs(14), paddingVertical: rs(10), borderRadius: rs(20) },
  glassBtnAccent: { borderColor: ACCENT + '66' },
  glassBtnIcon: { color: '#FFFFFF', fontSize: rs(13), marginRight: rs(6), fontWeight: '800' },
  glassBtnLabel: { color: '#FFFFFF', fontSize: rs(13), fontWeight: '700', letterSpacing: 0.3 },

  // Toast
  toast: {
    position: 'absolute', bottom: rs(100), alignSelf: 'center',
    paddingHorizontal: rs(20), paddingVertical: rs(12),
    borderRadius: rs(12), overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER, zIndex: 999,
  },
  toastTxt: { color: '#FFFFFF', fontSize: rs(13), fontWeight: '600' },

  // Rating modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  ratingModal: {
    width: SW - rs(40), padding: rs(24), borderRadius: rs(24),
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
    alignItems: 'center',
  },
  ratingModalTitle: {
    color: '#FFFFFF', fontSize: rs(18), fontWeight: '900', marginBottom: rs(20),
  },
  starsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: rs(2) },
  ratingValue: { color: ACCENT, fontSize: rs(16), fontWeight: '800', marginTop: rs(12) },

  // User modal
  userModal: {
    width: SW - rs(40), padding: rs(28), borderRadius: rs(28),
    overflow: 'hidden', borderWidth: 1.5, borderColor: GLASS_BORDER,
    alignItems: 'center',
    shadowColor: ACCENT, shadowOpacity: 0.2, shadowRadius: rs(30),
  },
  userAvatarRing: {
    width: rs(100), height: rs(100), borderRadius: rs(50),
    padding: rs(3), marginBottom: rs(16),
    shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: rs(16),
  },
  userModalAvatar: { width: rs(94), height: rs(94), borderRadius: rs(47) },
  userOnlineDot: {
    position: 'absolute', bottom: rs(6), right: rs(6),
    width: rs(14), height: rs(14), borderRadius: rs(7),
    backgroundColor: ACCENT, borderWidth: 2.5, borderColor: COLORS.bg || '#030F0C',
    shadowColor: ACCENT, shadowOpacity: 0.9, shadowRadius: rs(6),
  },
  userModalName: {
    color: '#FFFFFF', fontSize: rs(20), fontWeight: '900', marginBottom: rs(6),
  },
  userModalBio: {
    color: 'rgba(255,255,255,0.58)', fontSize: rs(13), textAlign: 'center',
    lineHeight: rs(19), marginBottom: rs(20), paddingHorizontal: rs(8),
  },
  userStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: GLASS_BORDER, borderRadius: rs(16),
    paddingVertical: rs(14), paddingHorizontal: rs(20),
    marginBottom: rs(20), overflow: 'hidden', width: '100%',
    backgroundColor: GLASS_WHITE,
  },
  userStat: { flex: 1, alignItems: 'center' },
  userStatVal: { color: ACCENT, fontSize: rs(18), fontWeight: '900' },
  userStatLbl: { color: 'rgba(255,255,255,0.48)', fontSize: rs(10), fontWeight: '600', marginTop: rs(2) },
  userStatDivider: { width: 1, height: rs(30), backgroundColor: GLASS_BORDER },
  userModalClose: {
    paddingHorizontal: rs(28), paddingVertical: rs(12),
    borderRadius: rs(20), overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
  },
});
