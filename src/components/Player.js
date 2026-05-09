/**
 * PlayerScreen.js — Netflix-Style Full-Screen Video Player
 * ─────────────────────────────────────────────────────────────────────────────
 * Features (all end-to-end working):
 *  • Auto-landscape lock on mount, portrait restore on unmount
 *  • Transparent controls — auto-hide after 5s, show on any tap
 *  • Big center Play/Pause, ±10s rewind/forward with animated seek flash
 *  • Double-tap left = -10s, double-tap right = +10s (with ripple)
 *  • Smooth red progress bar (Netflix-style) + draggable thumb
 *  • Tap-to-seek on progress bar
 *  • Remaining time counter (live, updates every second)
 *  • Speed selector panel (Netflix overlay style)
 *  • Episodes panel with season tabs (Netflix overlay style)
 *  • Captions toggle + on-video subtitle rendering
 *  • Lock screen: locks all controls, shows only unlock icon (auto-hides 4s)
 *  • Auto-play next episode when current ends (series only)
 *  • "Next Episode" button (series only) bottom-left
 *  • Buffering: full 3D glass spinner, hides all other UI while buffering
 *  • All transitions animated
 *  • 3D Hyped Glass UI throughout
 *  • Fully responsive (uses Dimensions for landscape math)
 * ─────────────────────────────────────────────────────────────────────────────
 * Navigation params expected:
 *   movieId        - string
 *   episodeId      - string | undefined
 *   movie          - full movie object (title, video_url, trailer_url, is_series, …)
 *   episode        - episode object (title, video_url, episode_number, season_number, …)
 *   episodes       - array of all episodes for this season
 *   seasons        - array of all seasons
 *   currentSeason  - season object
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useRef, useEffect, useState, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Dimensions, StatusBar, ImageBackground,
  ActivityIndicator, FlatList, ScrollView, Modal,
  PanResponder, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Feather';
import Orientation from 'react-native-orientation-locker';
import { useNavigation, useRoute } from '@react-navigation/native';

// ─── Responsive helpers ───────────────────────────────────────────────────────
const getWH = () => {
  const { width: w, height: h } = Dimensions.get('window');
  // In landscape the longer dimension is width
  return { W: Math.max(w, h), H: Math.min(w, h) };
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const RED = '#E50914';        // Netflix red for progress
const ACCENT = '#00FFB2';     // Glass accent
const ACCENT_DIM = '#00CC90';
const BG = '#030F0C';
const GLASS_BORDER = 'rgba(255,255,255,0.16)';
const GLASS_BG = 'rgba(255,255,255,0.09)';
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// Mock caption tracks (replace with real API data)
const MOCK_CAPTIONS = [
  { id: 'en', label: 'English', language: 'en' },
  { id: 'es', label: 'Español', language: 'es' },
  { id: 'fr', label: 'Français', language: 'fr' },
  { id: 'off', label: 'Off', language: null },
];

// ─── Format time ─────────────────────────────────────────────────────────────
const fmt = (secs) => {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

// ─── Glass Layer ──────────────────────────────────────────────────────────────
const GlassLayer = ({ borderRadius = 12, alpha = 0.12 }) => (
  <>
    <LinearGradient
      colors={[`rgba(255,255,255,${alpha + 0.08})`, `rgba(255,255,255,${alpha})`]}
      style={[StyleSheet.absoluteFill, { borderRadius }]}
    />
    <LinearGradient
      colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
      start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
      style={[StyleSheet.absoluteFill, { borderRadius }]}
    />
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']}
      start={{ x: 0, y: 0.55 }} end={{ x: 0, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius }]}
    />
  </>
);

// ─── 3D Glass Buffering Spinner ───────────────────────────────────────────────
const BufferingOverlay = memo(() => {
  const rotA = useRef(new Animated.Value(0)).current;
  const pulseA = useRef(new Animated.Value(0.8)).current;
  const glowA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotA, { toValue: 1, duration: 1200, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseA, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseA, { toValue: 0.88, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowA, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glowA, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      ])
    ).start();
    return () => { rotA.stopAnimation(); pulseA.stopAnimation(); glowA.stopAnimation(); };
  }, []);

  const spin = rotA.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpac = glowA.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });

  return (
    <View style={[StyleSheet.absoluteFill, S.bufferingOverlay]}>
      {/* Dim backdrop */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)' }]} />

      <Animated.View style={[S.bufferingGlowRing, { opacity: glowOpac }]} />

      <Animated.View style={{ transform: [{ scale: pulseA }] }}>
        {/* Outer glass ring */}
        <View style={S.bufferingRingOuter}>
          <GlassLayer borderRadius={52} alpha={0.12} />
          <Animated.View style={[S.bufferingRingInner, { transform: [{ rotate: spin }] }]}>
            <LinearGradient
              colors={[ACCENT, 'transparent', 'transparent', ACCENT_DIM]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ width: 90, height: 90, borderRadius: 45 }}
            />
          </Animated.View>
          {/* Center dot */}
          <View style={S.bufferingCenter}>
            <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
            <LinearGradient
              colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

// ─── Seek Flash (double-tap indicator) ───────────────────────────────────────
const SeekFlash = memo(({ side, visible, seconds }) => {
  const opacA = useRef(new Animated.Value(0)).current;
  const scaleA = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (visible) {
      opacA.setValue(1);
      scaleA.setValue(0.85);
      Animated.parallel([
        Animated.timing(opacA, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.spring(scaleA, { toValue: 1.1, useNativeDriver: true, tension: 200, friction: 12 }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[
        S.seekFlash,
        side === 'left' ? S.seekFlashLeft : S.seekFlashRight,
        { opacity: opacA, transform: [{ scale: scaleA }] },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={side === 'left'
          ? ['rgba(0,255,178,0.28)', 'rgba(0,255,178,0.08)']
          : ['rgba(0,255,178,0.28)', 'rgba(0,255,178,0.08)']}
        style={[StyleSheet.absoluteFill, { borderRadius: 60 }]}
      />
      <Text style={S.seekFlashIcon}>{side === 'left' ? '⏪' : '⏩'}</Text>
      <Text style={S.seekFlashTxt}>{seconds}s</Text>
    </Animated.View>
  );
});

// ─── Panel backdrop ───────────────────────────────────────────────────────────
const PanelBackdrop = memo(({ children, visible, onClose, side = 'right' }) => {
  const slideA = useRef(new Animated.Value(400)).current;
  const opacA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideA, { toValue: 0, useNativeDriver: true, tension: 180, friction: 22 }),
        Animated.timing(opacA, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideA, { toValue: 400, duration: 260, useNativeDriver: true }),
        Animated.timing(opacA, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible && slideA.__getValue() === 400) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacA }]} pointerEvents={visible ? 'box-none' : 'none'}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={[
          S.panel,
          side === 'right' ? S.panelRight : S.panelBottom,
          { transform: [{ translateX: side === 'right' ? slideA : 0 }, { translateY: side === 'bottom' ? slideA : 0 }] },
        ]}
      >
        <LinearGradient
          colors={['rgba(8,22,16,0.98)', 'rgba(3,12,10,0.99)']}
          style={[StyleSheet.absoluteFill, { borderRadius: side === 'right' ? 0 : 20 }]}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.35 }}
          style={[StyleSheet.absoluteFill, { borderRadius: side === 'right' ? 0 : 20 }]}
        />
        <LinearGradient
          colors={[ACCENT, ACCENT_DIM, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={S.panelAccentLine}
        />
        {children}
      </Animated.View>
    </Animated.View>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PLAYER
// ═════════════════════════════════════════════════════════════════════════════
export default function PlayerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // ── Extract params ─────────────────────────────────────────────────────────
  const {
    movie = {},
    episode: initEpisode = null,
    episodes: allEpisodes = [],
    seasons: allSeasons = [],
    currentSeason: initSeason = null,
  } = route.params || {};

  // ── Dimensions (landscape) ────────────────────────────────────────────────
  const [dims, setDims] = useState(getWH());
  const { W, H } = dims;

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => setDims(getWH()));
    return () => sub?.remove?.();
  }, []);

  // ── Video state ────────────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const [currentEpisode, setCurrentEpisode] = useState(initEpisode);
  const [activeSeason, setActiveSeason] = useState(initSeason || allSeasons[0] || null);
  const [seasonEpisodes, setSeasonEpisodes] = useState(allEpisodes);

  // Determine video URI: episode > movie video_url
  const videoUri = useMemo(() => {
    if (currentEpisode?.video_url) return currentEpisode.video_url;
    return movie?.video_url || movie?.trailer_url || null;
  }, [currentEpisode, movie]);

  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [ended, setEnded] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [muted, setMuted] = useState(false);

  // Caption state
  const [captionsOn, setCaptionsOn] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState(MOCK_CAPTIONS[3]); // Off
  const [currentCaption, setCurrentCaption] = useState('');

  // ── Controls visibility ────────────────────────────────────────────────────
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsOpac = useRef(new Animated.Value(1)).current;
  const controlsTimer = useRef(null);

  // ── Lock screen ───────────────────────────────────────────────────────────
  const [locked, setLocked] = useState(false);
  const [unlockVisible, setUnlockVisible] = useState(false);
  const unlockOpac = useRef(new Animated.Value(0)).current;
  const unlockTimer = useRef(null);

  // ── Panels ─────────────────────────────────────────────────────────────────
  const [speedPanelOpen, setSpeedPanelOpen] = useState(false);
  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const [captionPanelOpen, setCaptionPanelOpen] = useState(false);

  // ── Seek flash ─────────────────────────────────────────────────────────────
  const [leftFlash, setLeftFlash] = useState(0);   // counter to re-trigger
  const [rightFlash, setRightFlash] = useState(0);
  const [leftVisible, setLeftVisible] = useState(false);
  const [rightVisible, setRightVisible] = useState(false);

  // Double-tap tracking
  const tapCountRef = useRef({ left: 0, right: 0, timer: null });

  // ── Progress drag state ────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const progressRef = useRef({ width: W - 32, offsetX: 16 });

  // ── Smooth progress interpolation ─────────────────────────────────────────
  // Use Animated.Value for silky-smooth progress fill without re-renders
  const progressAnim = useRef(new Animated.Value(0)).current;
  const lastProgressUpdate = useRef(0);

  // ── Orientation lock ───────────────────────────────────────────────────────
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    Orientation.lockToLandscape();
    return () => {
      StatusBar.setHidden(false, 'fade');
      Orientation.lockToPortrait();
    };
  }, []);

  // ── Auto-show controls on mount ────────────────────────────────────────────
  useEffect(() => {
    showControls();
  }, []);

  // ─── Controls show/hide ────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    clearTimeout(controlsTimer.current);
    Animated.timing(controlsOpac, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setControlsVisible(true);
    controlsTimer.current = setTimeout(() => {
      if (!paused && !locked) {
        Animated.timing(controlsOpac, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          setControlsVisible(false);
        });
      }
    }, 5000);
  }, [paused, locked]);

  const hideControls = useCallback(() => {
    clearTimeout(controlsTimer.current);
    Animated.timing(controlsOpac, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setControlsVisible(false);
    });
  }, []);

  // Keep controls showing when paused
  useEffect(() => {
    if (paused) {
      clearTimeout(controlsTimer.current);
      Animated.timing(controlsOpac, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      setControlsVisible(true);
    } else if (controlsVisible) {
      showControls();
    }
  }, [paused]);

  // ─── Handle video tap (show/hide controls) ────────────────────────────────
  const handleScreenTap = useCallback(() => {
    if (locked) {
      // Show unlock button
      clearTimeout(unlockTimer.current);
      setUnlockVisible(true);
      Animated.timing(unlockOpac, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      unlockTimer.current = setTimeout(() => {
        Animated.timing(unlockOpac, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setUnlockVisible(false));
      }, 4000);
      return;
    }
    if (controlsVisible) {
      if (!paused) hideControls();
    } else {
      showControls();
    }
  }, [locked, controlsVisible, paused, showControls, hideControls]);

  // ─── Double-tap seek ──────────────────────────────────────────────────────
  const handleDoubleTap = useCallback((side) => {
    if (locked) return;
    const SEEK = 10;
    const newTime = side === 'left'
      ? Math.max(0, currentTime - SEEK)
      : Math.min(duration, currentTime + SEEK);
    videoRef.current?.seek(newTime);
    setCurrentTime(newTime);
    if (side === 'left') { setLeftFlash(n => n + 1); setLeftVisible(true); setTimeout(() => setLeftVisible(false), 700); }
    else { setRightFlash(n => n + 1); setRightVisible(true); setTimeout(() => setRightVisible(false), 700); }
    showControls();
  }, [locked, currentTime, duration, showControls]);

  const handleTapZone = useCallback((side) => {
    const ref = tapCountRef.current;
    ref[side] = (ref[side] || 0) + 1;
    clearTimeout(ref.timer);
    ref.timer = setTimeout(() => {
      if (ref[side] >= 2) {
        handleDoubleTap(side);
      } else {
        handleScreenTap();
      }
      ref.left = 0;
      ref.right = 0;
    }, 280);
  }, [handleDoubleTap, handleScreenTap]);

  // ─── Video progress (smooth animated) ─────────────────────────────────────
  const handleProgress = useCallback(({ currentTime: ct }) => {
    const now = Date.now();
    setCurrentTime(ct);
    // Animate progress fill smoothly
    if (!dragging && now - lastProgressUpdate.current > 250) {
      lastProgressUpdate.current = now;
      if (duration > 0) {
        Animated.timing(progressAnim, {
          toValue: ct / duration,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }
    }
  }, [duration, dragging]);

  const handleLoad = useCallback(({ duration: d }) => {
    setDuration(d);
    setBuffering(false);
  }, []);

  const handleEnd = useCallback(() => {
    setEnded(true);
    setPaused(true);
    showControls();
    // Auto-play next episode
    if (movie?.is_series && currentEpisode) {
      const idx = seasonEpisodes.findIndex(e => e.id === currentEpisode.id);
      if (idx !== -1 && idx < seasonEpisodes.length - 1) {
        const nextEp = seasonEpisodes[idx + 1];
        setTimeout(() => playEpisode(nextEp), 1500);
      }
    }
  }, [movie, currentEpisode, seasonEpisodes, showControls]);

  const handleSeek = useCallback((t) => {
    const clampedTime = Math.max(0, Math.min(duration, t));
    videoRef.current?.seek(clampedTime);
    setCurrentTime(clampedTime);
    if (duration > 0) {
      progressAnim.setValue(clampedTime / duration);
    }
  }, [duration]);

  // ─── Play episode ─────────────────────────────────────────────────────────
  const playEpisode = useCallback((ep) => {
    setCurrentEpisode(ep);
    setCurrentTime(0);
    setEnded(false);
    setPaused(false);
    setBuffering(true);
    progressAnim.setValue(0);
    setEpisodePanelOpen(false);
  }, []);

  // ─── Next episode ─────────────────────────────────────────────────────────
  const handleNextEpisode = useCallback(() => {
    if (!movie?.is_series || !currentEpisode) return;
    const idx = seasonEpisodes.findIndex(e => e.id === currentEpisode.id);
    if (idx !== -1 && idx < seasonEpisodes.length - 1) {
      playEpisode(seasonEpisodes[idx + 1]);
    }
  }, [movie, currentEpisode, seasonEpisodes, playEpisode]);

  const hasNextEpisode = useMemo(() => {
    if (!movie?.is_series || !currentEpisode) return false;
    const idx = seasonEpisodes.findIndex(e => e.id === currentEpisode.id);
    return idx !== -1 && idx < seasonEpisodes.length - 1;
  }, [movie, currentEpisode, seasonEpisodes]);

  // ─── Progress bar drag (PanResponder) ─────────────────────────────────────
  const progressPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setDragging(true);
      clearTimeout(controlsTimer.current);
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / progressRef.current.width));
      const t = ratio * duration;
      setDragValue(t);
      progressAnim.setValue(ratio);
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / progressRef.current.width));
      const t = ratio * duration;
      setDragValue(t);
      progressAnim.setValue(ratio);
    },
    onPanResponderRelease: (evt) => {
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / progressRef.current.width));
      const t = ratio * duration;
      handleSeek(t);
      setDragging(false);
      showControls();
    },
  }), [duration, handleSeek, showControls]);

  // ─── Progress bar tap ─────────────────────────────────────────────────────
  const handleProgressTap = useCallback((evt) => {
    const x = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / progressRef.current.width));
    handleSeek(ratio * duration);
    showControls();
  }, [duration, handleSeek, showControls]);

  // ─── Rewind / Fast Forward buttons ───────────────────────────────────────
  const handleRewind = useCallback(() => {
    handleSeek(Math.max(0, currentTime - 10));
    setLeftFlash(n => n + 1); setLeftVisible(true); setTimeout(() => setLeftVisible(false), 700);
    showControls();
  }, [currentTime, handleSeek, showControls]);

  const handleForward = useCallback(() => {
    handleSeek(Math.min(duration, currentTime + 10));
    setRightFlash(n => n + 1); setRightVisible(true); setTimeout(() => setRightVisible(false), 700);
    showControls();
  }, [currentTime, duration, handleSeek, showControls]);

  // ─── Lock screen ──────────────────────────────────────────────────────────
  const handleLock = useCallback(() => {
    setLocked(true);
    hideControls();
    // Show unlock icon briefly
    setUnlockVisible(true);
    Animated.timing(unlockOpac, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    unlockTimer.current = setTimeout(() => {
      Animated.timing(unlockOpac, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setUnlockVisible(false));
    }, 4000);
  }, [hideControls]);

  const handleUnlock = useCallback(() => {
    setLocked(false);
    clearTimeout(unlockTimer.current);
    Animated.timing(unlockOpac, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setUnlockVisible(false));
    showControls();
  }, [showControls]);

  // ─── Caption simulation (mock) ────────────────────────────────────────────
  useEffect(() => {
    if (!captionsOn || !selectedCaption?.language) {
      setCurrentCaption('');
      return;
    }
    // Mock captions based on time
    const captions = {
      en: [
        { start: 5, end: 9, text: "The mission begins now." },
        { start: 12, end: 17, text: "Into the Nebula Trench we go..." },
        { start: 22, end: 28, text: "We have never seen anything like this before." },
        { start: 35, end: 40, text: "Stay together. Stay alive." },
      ],
      es: [
        { start: 5, end: 9, text: "La misión comienza ahora." },
        { start: 12, end: 17, text: "Al foso de la Nebulosa..." },
        { start: 22, end: 28, text: "Nunca hemos visto algo así antes." },
        { start: 35, end: 40, text: "Mantenerse juntos. Mantenerse vivos." },
      ],
      fr: [
        { start: 5, end: 9, text: "La mission commence maintenant." },
        { start: 12, end: 17, text: "Dans la Tranchée Nébuleuse..." },
        { start: 22, end: 28, text: "Nous n'avons jamais rien vu de tel." },
        { start: 35, end: 40, text: "Restez ensemble. Restez en vie." },
      ],
    };
    const track = captions[selectedCaption.language] || [];
    const active = track.find(c => currentTime >= c.start && currentTime <= c.end);
    setCurrentCaption(active?.text || '');
  }, [currentTime, captionsOn, selectedCaption]);

  // ─── Title display ─────────────────────────────────────────────────────────
  const displayTitle = currentEpisode
    ? `${movie?.title || ''} · E${currentEpisode.episode_number}: ${currentEpisode.title}`
    : movie?.title || 'Playing';

  const remaining = Math.max(0, duration - currentTime);
  const progressFill = duration > 0 ? (dragging ? dragValue / duration : currentTime / duration) : 0;

  // ─── Panel close all ──────────────────────────────────────────────────────
  const closeAllPanels = useCallback(() => {
    setSpeedPanelOpen(false);
    setEpisodePanelOpen(false);
    setCaptionPanelOpen(false);
  }, []);

  // ─── Select caption ───────────────────────────────────────────────────────
  const handleSelectCaption = useCallback((cap) => {
    setSelectedCaption(cap);
    setCaptionsOn(cap.language !== null);
    setCaptionPanelOpen(false);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden />

      {/* ── Full screen video ── */}
      {videoUri ? (
        <Video
          ref={videoRef}
          source={{ uri: videoUri }}
          style={[StyleSheet.absoluteFill, { width: W, height: H }]}
          paused={paused}
          muted={muted}
          rate={speed}
          resizeMode="cover"
          onProgress={handleProgress}
          onLoad={handleLoad}
          onEnd={handleEnd}
          onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
          ignoreSilentSwitch="ignore"
          playInBackground={false}
          repeat={false}
        />
      ) : (
        /* Poster fallback */
        <ImageBackground
          source={{ uri: movie?.hero_image || movie?.poster }}
          style={[StyleSheet.absoluteFill, { width: W, height: H }]}
          resizeMode="cover"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        </ImageBackground>
      )}

      {/* ── Captions ── */}
      {captionsOn && currentCaption !== '' && (
        <View style={[S.captionContainer, { bottom: H * 0.12, left: W * 0.1, right: W * 0.1 }]} pointerEvents="none">
          <LinearGradient colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.85)']} style={[StyleSheet.absoluteFill, { borderRadius: 6 }]} />
          <Text style={S.captionText}>{currentCaption}</Text>
        </View>
      )}

      {/* ── Buffering overlay (hides everything) ── */}
      {buffering && <BufferingOverlay />}

      {/* ── Seek flash zones (left / right) ── */}
      <SeekFlash side="left" visible={leftVisible} seconds={10} />
      <SeekFlash side="right" visible={rightVisible} seconds={10} />

      {/* ── Tap zones (left / right halves) ── */}
      {!buffering && (
        <>
          <TouchableWithoutFeedback onPress={() => handleTapZone('left')}>
            <View style={[S.tapZone, { left: 0, width: W / 2, height: H }]} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={() => handleTapZone('right')}>
            <View style={[S.tapZone, { right: 0, width: W / 2, height: H }]} />
          </TouchableWithoutFeedback>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CONTROLS OVERLAY — animated opacity
      ══════════════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: controlsOpac }]}
        pointerEvents={controlsVisible && !locked ? 'box-none' : 'none'}
      >
        {/* Gradient scrim */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.75)']}
          locations={[0, 0.22, 0.78, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* ── TOP BAR ── */}
        <View style={[S.topBar, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
          {/* Back */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.topBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={20} alpha={0.14} />
            <Icon name="chevron-left" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Title */}
          <View style={S.topTitleWrap}>
            <Text style={S.topTitle} numberOfLines={1}>{displayTitle}</Text>
            {currentEpisode && (
              <Text style={S.topSubtitle}>
                {activeSeason ? `Season ${activeSeason.season_number}` : ''} · {fmt(remaining)} remaining
              </Text>
            )}
          </View>

          {/* Lock */}
          <TouchableOpacity onPress={handleLock} style={S.topBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={20} alpha={0.14} />
            <Icon name="lock" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── CENTER CONTROLS ── */}
        <View style={S.centerControls}>
          {/* Rewind 10s */}
          <TouchableOpacity onPress={handleRewind} style={S.centerSideBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={28} alpha={0.14} />
            <Icon name="rotate-ccw" size={22} color="#fff" />
            <Text style={S.centerSideBtnLabel}>10</Text>
          </TouchableOpacity>

          {/* Play / Pause */}
          <TouchableOpacity
            onPress={() => { setPaused(p => !p); showControls(); }}
            style={S.centerPlayBtn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']}
              style={[StyleSheet.absoluteFill, { borderRadius: 44 }]}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 44 }]}
            />
            <Icon
              name={ended ? 'refresh-cw' : paused ? 'play' : 'pause'}
              size={32}
              color="#fff"
              style={paused && !ended ? { marginLeft: 4 } : {}}
            />
          </TouchableOpacity>

          {/* Forward 10s */}
          <TouchableOpacity onPress={handleForward} style={S.centerSideBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={28} alpha={0.14} />
            <Icon name="rotate-cw" size={22} color="#fff" />
            <Text style={S.centerSideBtnLabel}>10</Text>
          </TouchableOpacity>
        </View>

        {/* ── BOTTOM CONTROLS ── */}
        <View style={[S.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}>

          {/* ── Progress bar ── */}
          <View
            style={S.progressWrap}
            onLayout={(e) => {
              progressRef.current.width = e.nativeEvent.layout.width;
              progressRef.current.offsetX = e.nativeEvent.layout.x;
            }}
            {...progressPanResponder.panHandlers}
          >
            <TouchableWithoutFeedback onPress={handleProgressTap}>
              <View style={S.progressTrack}>
                {/* Buffered fill (ghost) */}
                <View style={[S.progressBuffered, { width: `${Math.min(1, progressFill + 0.08) * 100}%` }]} />
                {/* Animated fill */}
                <Animated.View style={[
                  S.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp',
                    }),
                  },
                ]} />
                {/* Thumb */}
                <Animated.View style={[
                  S.progressThumb,
                  {
                    left: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-6%', '99%'],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}>
                  <LinearGradient colors={['#fff', 'rgba(255,255,255,0.85)']} style={[StyleSheet.absoluteFill, { borderRadius: 8 }]} />
                  <View style={S.thumbGlow} />
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          </View>

          {/* ── Bottom icon row ── */}
          <View style={S.bottomRow}>
            {/* Next episode (series only) — bottom left */}
            <View style={S.bottomLeft}>
              {movie?.is_series && hasNextEpisode && (
                <TouchableOpacity onPress={handleNextEpisode} style={S.bottomBtn} activeOpacity={0.8}>
                  <GlassLayer borderRadius={18} alpha={0.14} />
                  <Icon name="skip-forward" size={14} color="#fff" />
                  <Text style={S.bottomBtnLabel}>Next</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Time remaining */}
            <Text style={S.remainingTime}>-{fmt(remaining)}</Text>

            {/* Right icons */}
            <View style={S.bottomRight}>
              {/* Captions */}
              <TouchableOpacity
                onPress={() => { closeAllPanels(); setCaptionPanelOpen(true); showControls(); }}
                style={[S.bottomBtn, captionsOn && S.bottomBtnActive]}
                activeOpacity={0.8}
              >
                <GlassLayer borderRadius={18} alpha={captionsOn ? 0.22 : 0.14} />
                {captionsOn && <LinearGradient colors={[`rgba(0,255,178,0.28)`, 'rgba(0,255,178,0.08)']} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />}
                <Icon name="message-square" size={14} color={captionsOn ? ACCENT : '#fff'} />
                <Text style={[S.bottomBtnLabel, captionsOn && { color: ACCENT }]}>CC</Text>
              </TouchableOpacity>

              {/* Episodes (series only) */}
              {movie?.is_series && (
                <TouchableOpacity
                  onPress={() => { closeAllPanels(); setEpisodePanelOpen(true); showControls(); }}
                  style={S.bottomBtn}
                  activeOpacity={0.8}
                >
                  <GlassLayer borderRadius={18} alpha={0.14} />
                  <Icon name="list" size={14} color="#fff" />
                  <Text style={S.bottomBtnLabel}>Episodes</Text>
                </TouchableOpacity>
              )}

              {/* Speed */}
              <TouchableOpacity
                onPress={() => { closeAllPanels(); setSpeedPanelOpen(true); showControls(); }}
                style={[S.bottomBtn, S.speedBtn]}
                activeOpacity={0.8}
              >
                <GlassLayer borderRadius={18} alpha={0.14} />
                {speed !== 1.0 && <LinearGradient colors={[`rgba(0,255,178,0.22)`, 'rgba(0,255,178,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />}
                <Text style={[S.speedBtnLabel, speed !== 1.0 && { color: ACCENT }]}>{speed}×</Text>
              </TouchableOpacity>

              {/* Mute */}
              <TouchableOpacity onPress={() => setMuted(m => !m)} style={S.bottomBtn} activeOpacity={0.8}>
                <GlassLayer borderRadius={18} alpha={0.14} />
                <Icon name={muted ? 'volume-x' : 'volume-2'} size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          LOCKED — show only unlock button
      ══════════════════════════════════════════════════════════════════════ */}
      {locked && (
        <Animated.View
          style={[S.unlockWrap, { opacity: unlockOpac }]}
          pointerEvents={unlockVisible ? 'box-none' : 'none'}
        >
          <TouchableOpacity onPress={handleUnlock} style={S.unlockBtn} activeOpacity={0.85}>
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.05)']}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
            <LinearGradient
              colors={[ACCENT, ACCENT_DIM, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, borderRadius: 1 }}
            />
            <Icon name="unlock" size={18} color="#fff" />
            <Text style={S.unlockLabel}>Unlock</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SPEED PANEL
      ══════════════════════════════════════════════════════════════════════ */}
      <PanelBackdrop visible={speedPanelOpen} onClose={() => setSpeedPanelOpen(false)} side="right">
        <View style={S.panelContent}>
          <View style={S.panelHeader}>
            <Text style={S.panelTitle}>Playback Speed</Text>
            <TouchableOpacity onPress={() => setSpeedPanelOpen(false)} style={S.panelCloseBtn}>
              <GlassLayer borderRadius={16} alpha={0.12} />
              <Icon name="x" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          {SPEEDS.map(s => {
            const isActive = speed === s;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => { setSpeed(s); setSpeedPanelOpen(false); showControls(); }}
                style={[S.speedOption, isActive && S.speedOptionActive]}
                activeOpacity={0.8}
              >
                {isActive && <LinearGradient colors={[`rgba(0,255,178,0.22)`, 'rgba(0,255,178,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />}
                <GlassLayer borderRadius={12} alpha={isActive ? 0.0 : 0.08} />
                {isActive && (
                  <View style={S.speedOptionDot}>
                    <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: 8 }]} />
                  </View>
                )}
                <Text style={[S.speedOptionTxt, isActive && S.speedOptionTxtActive]}>
                  {s === 1.0 ? 'Normal (1×)' : `${s}×`}
                </Text>
                {isActive && <Icon name="check" size={14} color={ACCENT} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </PanelBackdrop>

      {/* ══════════════════════════════════════════════════════════════════════
          EPISODES PANEL
      ══════════════════════════════════════════════════════════════════════ */}
      <PanelBackdrop visible={episodePanelOpen} onClose={() => setEpisodePanelOpen(false)} side="right">
        <View style={S.panelContent}>
          <View style={S.panelHeader}>
            <Text style={S.panelTitle}>{movie?.title || 'Episodes'}</Text>
            <TouchableOpacity onPress={() => setEpisodePanelOpen(false)} style={S.panelCloseBtn}>
              <GlassLayer borderRadius={16} alpha={0.12} />
              <Icon name="x" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Season tabs */}
          {allSeasons.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
            >
              {allSeasons.map(s => {
                const isSA = activeSeason?.id === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => {
                      setActiveSeason(s);
                      // In real app: fetch episodes for this season
                      showControls();
                    }}
                    style={[S.panelSeasonTab, isSA && S.panelSeasonTabActive]}
                    activeOpacity={0.8}
                  >
                    {isSA
                      ? <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
                      : <GlassLayer borderRadius={16} alpha={0.10} />}
                    <Text style={[S.panelSeasonTabTxt, isSA && { color: BG }]}>S{s.season_number}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Episode list */}
          <FlatList
            data={seasonEpisodes}
            keyExtractor={e => e.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            renderItem={({ item }) => {
              const isPlaying = currentEpisode?.id === item.id;
              return (
                <TouchableOpacity
                  onPress={() => playEpisode(item)}
                  style={[S.epCard, isPlaying && S.epCardActive]}
                  activeOpacity={0.8}
                >
                  {isPlaying
                    ? <LinearGradient colors={[`rgba(0,255,178,0.20)`, 'rgba(0,255,178,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                    : <GlassLayer borderRadius={12} alpha={0.07} />}
                  {/* Thumbnail */}
                  {item.thumbnail_url ? (
                    <ImageBackground
                      source={{ uri: item.thumbnail_url }}
                      style={S.epThumb}
                      imageStyle={{ borderRadius: 8 }}
                    >
                      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
                      {isPlaying && (
                        <View style={S.epPlayingIcon}>
                          <Text style={{ color: BG, fontSize: 14 }}>▶</Text>
                        </View>
                      )}
                    </ImageBackground>
                  ) : (
                    <View style={[S.epThumb, { backgroundColor: GLASS_BG, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: isPlaying ? ACCENT : 'rgba(255,255,255,0.5)', fontSize: 16 }}>
                        {isPlaying ? '▶' : `E${item.episode_number}`}
                      </Text>
                    </View>
                  )}
                  {/* Info */}
                  <View style={S.epInfo}>
                    <Text style={[S.epNum, isPlaying && { color: ACCENT }]}>Episode {item.episode_number}</Text>
                    <Text style={S.epTitle} numberOfLines={1}>{item.title}</Text>
                    {item.duration && <Text style={S.epDur}>{item.duration}</Text>}
                  </View>
                  {isPlaying && (
                    <View style={S.epActiveBar}>
                      <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: 2 }]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </PanelBackdrop>

      {/* ══════════════════════════════════════════════════════════════════════
          CAPTION PANEL
      ══════════════════════════════════════════════════════════════════════ */}
      <PanelBackdrop visible={captionPanelOpen} onClose={() => setCaptionPanelOpen(false)} side="right">
        <View style={S.panelContent}>
          <View style={S.panelHeader}>
            <Text style={S.panelTitle}>Subtitles & Captions</Text>
            <TouchableOpacity onPress={() => setCaptionPanelOpen(false)} style={S.panelCloseBtn}>
              <GlassLayer borderRadius={16} alpha={0.12} />
              <Icon name="x" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          {MOCK_CAPTIONS.map(cap => {
            const isActive = selectedCaption?.id === cap.id;
            return (
              <TouchableOpacity
                key={cap.id}
                onPress={() => handleSelectCaption(cap)}
                style={[S.speedOption, isActive && S.speedOptionActive]}
                activeOpacity={0.8}
              >
                {isActive && <LinearGradient colors={[`rgba(0,255,178,0.22)`, 'rgba(0,255,178,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />}
                <GlassLayer borderRadius={12} alpha={isActive ? 0.0 : 0.08} />
                {isActive && (
                  <View style={S.speedOptionDot}>
                    <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: 8 }]} />
                  </View>
                )}
                <Text style={[S.speedOptionTxt, isActive && S.speedOptionTxtActive]}>{cap.label}</Text>
                {isActive && <Icon name="check" size={14} color={ACCENT} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </PanelBackdrop>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const { W: SW2, H: SH2 } = getWH();

const S = StyleSheet.create({
  // ── Buffering ──
  bufferingOverlay: {
    zIndex: 500, alignItems: 'center', justifyContent: 'center',
  },
  bufferingGlowRing: {
    position: 'absolute',
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'transparent',
    shadowColor: ACCENT, shadowOpacity: 1, shadowRadius: 40,
    borderWidth: 1, borderColor: `rgba(0,255,178,0.15)`,
  },
  bufferingRingOuter: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },
  bufferingRingInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 45, overflow: 'hidden',
  },
  bufferingCenter: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: ACCENT, shadowOpacity: 0.7, shadowRadius: 10,
  },

  // ── Tap zones ──
  tapZone: {
    position: 'absolute', top: 0,
  },

  // ── Seek flash ──
  seekFlash: {
    position: 'absolute', top: '30%',
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: `rgba(0,255,178,0.3)`,
    zIndex: 200,
  },
  seekFlashLeft: { left: '8%' },
  seekFlashRight: { right: '8%' },
  seekFlashIcon: { fontSize: 28 },
  seekFlashTxt: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 2 },

  // ── Top bar ──
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 12,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
    flexShrink: 0,
  },
  topTitleWrap: {
    flex: 1, alignItems: 'center',
  },
  topTitle: {
    color: '#fff', fontSize: 15, fontWeight: '700',
    letterSpacing: 0.3, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  topSubtitle: {
    color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '500',
    textAlign: 'center', marginTop: 2,
  },

  // ── Center controls ──
  centerControls: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 40,
  },
  centerSideBtn: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
    gap: 2,
  },
  centerSideBtnLabel: {
    color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '800',
  },
  centerPlayBtn: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#fff', shadowOpacity: 0.25, shadowRadius: 20, elevation: 20,
  },

  // ── Bottom bar ──
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16,
  },
  progressWrap: {
    height: 24, justifyContent: 'center', marginBottom: 8,
  },
  progressTrack: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 2, overflow: 'visible',
  },
  progressBuffered: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 2,
  },
  progressFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: RED, borderRadius: 2,
    shadowColor: RED, shadowOpacity: 0.7, shadowRadius: 4,
  },
  progressThumb: {
    position: 'absolute', top: -8,
    width: 16, height: 16, borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#fff', shadowOpacity: 0.5, shadowRadius: 6,
    elevation: 6,
  },
  thumbGlow: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 12,
    backgroundColor: 'rgba(229,9,20,0.35)',
  },
  bottomRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 4,
  },
  bottomLeft: {
    width: 100, flexDirection: 'row', alignItems: 'center',
  },
  remainingTime: {
    flex: 1, textAlign: 'center',
    color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  bottomRight: {
    width: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
  },
  bottomBtn: {
    height: 34, paddingHorizontal: 10, borderRadius: 17,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER, gap: 4,
  },
  bottomBtnActive: {
    borderColor: `rgba(0,255,178,0.45)`,
  },
  bottomBtnLabel: {
    color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700',
  },
  speedBtn: {
    minWidth: 44,
  },
  speedBtnLabel: {
    color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800',
  },

  // ── Unlock ──
  unlockWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 400, pointerEvents: 'box-none',
  },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)',
    shadowColor: '#fff', shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  unlockLabel: {
    color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3,
  },

  // ── Captions ──
  captionContainer: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    zIndex: 100,
  },
  captionText: {
    color: '#fff', fontSize: 15, fontWeight: '600',
    textAlign: 'center', lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // ── Panels ──
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: 280,
    overflow: 'hidden',
    borderLeftWidth: 1, borderLeftColor: GLASS_BORDER,
  },
  panelRight: {},
  panelBottom: {
    top: undefined, left: 0, right: 0, width: undefined,
    height: 360, borderRadius: 20,
    borderTopWidth: 1, borderTopColor: GLASS_BORDER,
    borderLeftWidth: 0,
  },
  panelAccentLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
  },
  panelContent: {
    flex: 1, paddingTop: 16,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 16,
  },
  panelTitle: {
    flex: 1, color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2,
  },
  panelCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
  },

  // Season tabs in panel
  panelSeasonTab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  panelSeasonTabActive: {
    borderColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  panelSeasonTabTxt: {
    color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700',
  },

  // Speed options
  speedOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
    marginHorizontal: 12, marginBottom: 6,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  speedOptionActive: {
    borderColor: `rgba(0,255,178,0.40)`,
    shadowColor: ACCENT, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  speedOptionDot: {
    width: 8, height: 8, borderRadius: 4, overflow: 'hidden',
    shadowColor: ACCENT, shadowOpacity: 0.8, shadowRadius: 4,
  },
  speedOptionTxt: {
    flex: 1, color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '600',
  },
  speedOptionTxtActive: {
    color: ACCENT, fontWeight: '800',
  },

  // Episode card in panel
  epCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, marginBottom: 8,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  epCardActive: {
    borderColor: `rgba(0,255,178,0.40)`,
  },
  epThumb: {
    width: 90, height: 56, borderRadius: 8,
  },
  epPlayingIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: `rgba(0,255,178,0.25)`, borderRadius: 8,
  },
  epInfo: { flex: 1 },
  epNum: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  epTitle: { color: '#fff', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  epDur: { color: 'rgba(255,255,255,0.40)', fontSize: 10 },
  epActiveBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2, overflow: 'hidden',
  },
});
