/**
 * PlayerScreen.js — Netflix-Style Full-Screen Video Player
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW in this version:
 *  • Left-side vertical swipe  → Brightness (swipe up = brighter)
 *  • Right-side vertical swipe → Volume     (swipe up = louder)
 *  • Animated HUD bar (icon + vertical fill) appears mid-screen during gesture
 *  • Netflix-style buffering: simple white spinning ring only (no glass)
 *  • All previous features: controls, lock, seek, speed, episodes, captions
 * ─────────────────────────────────────────────────────────────────────────────
 * Required packages (add if missing):
 *   npm i react-native-brightness
 *   npm i react-native-volume-manager
 *   (both gracefully no-op if not linked)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useRef, useEffect, useState, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Dimensions, StatusBar, ImageBackground,
  FlatList, ScrollView, PanResponder, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Feather';
import Orientation from 'react-native-orientation-locker';
import { useNavigation, useRoute } from '@react-navigation/native';

// ── Optional native modules (graceful fallback) ───────────────────────────────
let Brightness = null;
let VolumeManager = null;
try { Brightness = require('react-native-brightness').default; } catch (_) {}
try { VolumeManager = require('react-native-volume-manager').VolumeManager; } catch (_) {}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getWH = () => {
  const { width: w, height: h } = Dimensions.get('window');
  return { W: Math.max(w, h), H: Math.min(w, h) };
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt = (secs) => {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const RED          = '#E50914';
const ACCENT       = '#00FFB2';
const ACCENT_DIM   = '#00CC90';
const BG           = '#030F0C';
const GLASS_BORDER = 'rgba(255,255,255,0.16)';
const GLASS_BG     = 'rgba(255,255,255,0.09)';
const SPEEDS       = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const MOCK_CAPTIONS = [
  { id: 'en',  label: 'English',  language: 'en'  },
  { id: 'es',  label: 'Español',  language: 'es'  },
  { id: 'fr',  label: 'Français', language: 'fr'  },
  { id: 'off', label: 'Off',      language: null   },
];

// ═══════════════════════════════════════════════════════════════════════════════
// GlassLayer
// ═══════════════════════════════════════════════════════════════════════════════
const GlassLayer = ({ borderRadius = 12, alpha = 0.12 }) => (
  <>
    <LinearGradient
      colors={[`rgba(255,255,255,${alpha + 0.08})`, `rgba(255,255,255,${alpha})`]}
      style={[StyleSheet.absoluteFill, { borderRadius }]}
    />
    <LinearGradient
      colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']}
      start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
      style={[StyleSheet.absoluteFill, { borderRadius }]}
    />
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.16)']}
      start={{ x: 0, y: 0.55 }} end={{ x: 0, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius }]}
    />
  </>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Netflix-style Buffering — simple thin white ring
// ═══════════════════════════════════════════════════════════════════════════════
const BufferingOverlay = memo(() => {
  const rotA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotA, { toValue: 1, duration: 750, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const spin = rotA.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={S.bufferWrap} pointerEvents="none">
      <Animated.View style={[S.netflixRing, { transform: [{ rotate: spin }] }]} />
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Volume / Brightness HUD — vertical bar with icon
// ═══════════════════════════════════════════════════════════════════════════════
const GestureHUD = memo(({ type, value, visible }) => {
  const opacA  = useRef(new Animated.Value(0)).current;
  const scaleA = useRef(new Animated.Value(0.90)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacA,  { toValue: 1,    duration: 140, useNativeDriver: true }),
        Animated.spring(scaleA, { toValue: 1,    useNativeDriver: true, tension: 280, friction: 18 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacA,  { toValue: 0,    duration: 280, useNativeDriver: true }),
        Animated.timing(scaleA, { toValue: 0.90, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const isBright   = type === 'brightness';
  const fillPct    = clamp(Math.round(value * 100), 0, 100);
  const iconColor  = isBright ? '#FFE066' : '#fff';

  // pick icon based on level
  const iconName = isBright
    ? (value > 0.55 ? 'sun' : 'moon')
    : (value > 0.55 ? 'volume-2' : value > 0.05 ? 'volume-1' : 'volume-x');

  return (
    <Animated.View
      style={[
        S.gestureHUD,
        isBright ? S.gestureHUDLeft : S.gestureHUDRight,
        { opacity: opacA, transform: [{ scale: scaleA }] },
      ]}
      pointerEvents="none"
    >
      {/* Glass bg */}
      <View style={[StyleSheet.absoluteFill, S.hudBg]} />
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
      />
      {/* Top accent */}
      <View style={[S.hudTopLine, { backgroundColor: iconColor }]} />

      {/* Icon */}
      <Icon name={iconName} size={19} color={iconColor} style={{ marginBottom: 12 }} />

      {/* Vertical bar track */}
      <View style={S.hudTrack}>
        {/* Fill: bottom-up */}
        <View style={[S.hudFill, { height: `${fillPct}%`, backgroundColor: iconColor }]} />
        {/* Glow nub at top of fill */}
        {fillPct > 2 && (
          <View
            style={[
              S.hudNub,
              { bottom: `${fillPct}%`, backgroundColor: iconColor, shadowColor: iconColor },
            ]}
          />
        )}
      </View>

      {/* Percentage */}
      <Text style={[S.hudPct, { color: iconColor }]}>{fillPct}%</Text>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Seek Flash
// ═══════════════════════════════════════════════════════════════════════════════
const SeekFlash = memo(({ side, visible }) => {
  const opacA  = useRef(new Animated.Value(0)).current;
  const scaleA = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    if (visible) {
      opacA.setValue(0.92);
      scaleA.setValue(0.80);
      Animated.parallel([
        Animated.timing(opacA,  { toValue: 0,    duration: 620, useNativeDriver: true }),
        Animated.spring(scaleA, { toValue: 1.06, useNativeDriver: true, tension: 220, friction: 12 }),
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
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)']}
        style={[StyleSheet.absoluteFill, { borderRadius: 48 }]}
      />
      <Icon name={side === 'left' ? 'rotate-ccw' : 'rotate-cw'} size={24} color="#fff" />
      <Text style={S.seekFlashTxt}>10s</Text>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Panel (slides from right)
// ═══════════════════════════════════════════════════════════════════════════════
const Panel = memo(({ children, visible, onClose }) => {
  const slideA = useRef(new Animated.Value(300)).current;
  const opacA  = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.parallel([
        Animated.spring(slideA, { toValue: 0, useNativeDriver: true, tension: 200, friction: 24 }),
        Animated.timing(opacA,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideA, { toValue: 300, duration: 230, useNativeDriver: true }),
        Animated.timing(opacA,  { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  if (!show) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: opacA }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.48)' }]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[S.panel, { transform: [{ translateX: slideA }] }]}>
        <LinearGradient
          colors={['rgba(10,24,18,0.99)', 'rgba(3,12,10,0.99)']}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.30 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[ACCENT, ACCENT_DIM, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={S.panelLine}
        />
        {children}
      </Animated.View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PLAYER
// ═══════════════════════════════════════════════════════════════════════════════
export default function PlayerScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();

  const {
    movie           = {},
    episode:  initEp  = null,
    episodes: allEps  = [],
    seasons:  allSeasons = [],
    currentSeason: initSeason = null,
  } = route.params || {};

  // ── Dims ──────────────────────────────────────────────────────────────────
  const [dims, setDims] = useState(getWH());
  const { W, H } = dims;
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => setDims(getWH()));
    return () => sub?.remove?.();
  }, []);

  // ── Video ─────────────────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const [currentEp,      setCurrentEp]      = useState(initEp);
  const [activeSeason,   setActiveSeason]   = useState(initSeason || allSeasons[0] || null);
  const [seasonEps,      setSeasonEps]      = useState(allEps);
  const [paused,         setPaused]         = useState(false);
  const [currentTime,    setCurrentTime]    = useState(0);
  const [duration,       setDuration]       = useState(0);
  const [buffering,      setBuffering]      = useState(true);
  const [ended,          setEnded]          = useState(false);
  const [speed,          setSpeed]          = useState(1.0);
  const [muted,          setMuted]          = useState(false);

  const videoUri = useMemo(() => {
    if (currentEp?.video_url) return currentEp.video_url;
    return movie?.video_url || movie?.trailer_url || null;
  }, [currentEp, movie]);

  // ── Captions ──────────────────────────────────────────────────────────────
  const [captionsOn,      setCaptionsOn]      = useState(false);
  const [selectedCaption, setSelectedCaption] = useState(MOCK_CAPTIONS[3]);
  const [currentCaption,  setCurrentCaption]  = useState('');

  // ── Controls ──────────────────────────────────────────────────────────────
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsOpac  = useRef(new Animated.Value(1)).current;
  const controlsTimer = useRef(null);

  // ── Lock ──────────────────────────────────────────────────────────────────
  const [locked,        setLocked]        = useState(false);
  const [unlockVisible, setUnlockVisible] = useState(false);
  const unlockOpac  = useRef(new Animated.Value(0)).current;
  const unlockTimer = useRef(null);

  // ── Panels ────────────────────────────────────────────────────────────────
  const [speedPanel,   setSpeedPanel]   = useState(false);
  const [epPanel,      setEpPanel]      = useState(false);
  const [capPanel,     setCapPanel]     = useState(false);

  // ── Seek flash ────────────────────────────────────────────────────────────
  const [leftFlash,  setLeftFlash]  = useState(false);
  const [rightFlash, setRightFlash] = useState(false);
  const tapRef = useRef({ left: 0, right: 0, timer: null });

  // ── Progress ──────────────────────────────────────────────────────────────
  const [dragging,  setDragging]  = useState(false);
  const progressRef  = useRef({ width: 1 });
  const progressAnim = useRef(new Animated.Value(0)).current;
  const lastPrgTime  = useRef(0);

  // ──────────────────────────────────────────────────────────────────────────
  // VOLUME & BRIGHTNESS
  // ──────────────────────────────────────────────────────────────────────────
  const [volume,     setVolume]     = useState(0.7);
  const [brightness, setBrightness] = useState(0.5);
  const [volHUD,     setVolHUD]     = useState(false);
  const [brightHUD,  setBrightHUD]  = useState(false);
  const volHUDTimer    = useRef(null);
  const brightHUDTimer = useRef(null);

  // Refs to avoid stale closures inside PanResponder
  const volRef    = useRef(0.7);
  const brightRef = useRef(0.5);

  // Initialise from system
  useEffect(() => {
    (async () => {
      try {
        if (VolumeManager) {
          const res = await VolumeManager.getVolume();
          const v = typeof res === 'object' ? (res.volume ?? 0.7) : (res ?? 0.7);
          setVolume(v); volRef.current = v;
        }
      } catch (_) {}
      try {
        if (Brightness) {
          const b = await Brightness.getBrightnessLevel();
          setBrightness(b); brightRef.current = b;
        }
      } catch (_) {}
    })();
  }, []);

  const applyVolume = useCallback((v) => {
    const c = clamp(v, 0, 1);
    volRef.current = c;
    setVolume(c);
    try { VolumeManager?.setVolume(c); } catch (_) {}
  }, []);

  const applyBrightness = useCallback((b) => {
    const c = clamp(b, 0.02, 1);
    brightRef.current = c;
    setBrightness(c);
    try {
      if (Brightness) Brightness.setBrightnessLevel(c);
    } catch (_) {}
  }, []);

  const showVolHUD = useCallback(() => {
    setVolHUD(true);
    clearTimeout(volHUDTimer.current);
    volHUDTimer.current = setTimeout(() => setVolHUD(false), 1600);
  }, []);

  const showBrightHUD = useCallback(() => {
    setBrightHUD(true);
    clearTimeout(brightHUDTimer.current);
    brightHUDTimer.current = setTimeout(() => setBrightHUD(false), 1600);
  }, []);

  // ── Brightness PanResponder (LEFT half) ───────────────────────────────────
  const brightStartRef  = useRef(0.5);
  const brightStartYRef = useRef(0);

  const brightPR = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:       (_, g) => Math.abs(g.dy) > 4,
    onMoveShouldSetPanResponder:        (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
    onShouldBlockNativeResponder:       () => true,
    onPanResponderGrant: (evt) => {
      brightStartRef.current  = brightRef.current;
      brightStartYRef.current = evt.nativeEvent.pageY;
    },
    onPanResponderMove: (evt) => {
      const dy    = brightStartYRef.current - evt.nativeEvent.pageY; // up = positive
      const delta = dy / (H * 0.75);
      applyBrightness(brightStartRef.current + delta);
      showBrightHUD();
    },
    onPanResponderRelease: () => {},
    onPanResponderTerminate: () => {},
  }), [H, applyBrightness, showBrightHUD]);

  // ── Volume PanResponder (RIGHT half) ─────────────────────────────────────
  const volStartRef  = useRef(0.7);
  const volStartYRef = useRef(0);

  const volPR = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:       (_, g) => Math.abs(g.dy) > 4,
    onMoveShouldSetPanResponder:        (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
    onShouldBlockNativeResponder:       () => true,
    onPanResponderGrant: (evt) => {
      volStartRef.current  = volRef.current;
      volStartYRef.current = evt.nativeEvent.pageY;
    },
    onPanResponderMove: (evt) => {
      const dy    = volStartYRef.current - evt.nativeEvent.pageY;
      const delta = dy / (H * 0.75);
      applyVolume(volStartRef.current + delta);
      showVolHUD();
    },
    onPanResponderRelease: () => {},
    onPanResponderTerminate: () => {},
  }), [H, applyVolume, showVolHUD]);

  // ── Orientation ───────────────────────────────────────────────────────────
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    Orientation.lockToLandscape();
    return () => {
      StatusBar.setHidden(false, 'fade');
      Orientation.lockToPortrait();
      clearTimeout(controlsTimer.current);
      clearTimeout(unlockTimer.current);
      clearTimeout(volHUDTimer.current);
      clearTimeout(brightHUDTimer.current);
    };
  }, []);

  // ── Controls show/hide ────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    clearTimeout(controlsTimer.current);
    Animated.timing(controlsOpac, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    setControlsVisible(true);
    controlsTimer.current = setTimeout(() => {
      if (!paused && !locked) {
        Animated.timing(controlsOpac, { toValue: 0, duration: 380, useNativeDriver: true }).start(
          () => setControlsVisible(false)
        );
      }
    }, 5000);
  }, [paused, locked]);

  const hideControls = useCallback(() => {
    clearTimeout(controlsTimer.current);
    Animated.timing(controlsOpac, { toValue: 0, duration: 280, useNativeDriver: true }).start(
      () => setControlsVisible(false)
    );
  }, []);

  useEffect(() => {
    if (paused) {
      clearTimeout(controlsTimer.current);
      Animated.timing(controlsOpac, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      setControlsVisible(true);
    } else if (controlsVisible) {
      showControls();
    }
  }, [paused]);

  useEffect(() => { showControls(); }, []);

  // ── Screen tap ────────────────────────────────────────────────────────────
  const handleScreenTap = useCallback(() => {
    if (locked) {
      clearTimeout(unlockTimer.current);
      setUnlockVisible(true);
      Animated.timing(unlockOpac, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      unlockTimer.current = setTimeout(() => {
        Animated.timing(unlockOpac, { toValue: 0, duration: 280, useNativeDriver: true }).start(
          () => setUnlockVisible(false)
        );
      }, 4000);
      return;
    }
    if (controlsVisible) { if (!paused) hideControls(); }
    else showControls();
  }, [locked, controlsVisible, paused, showControls, hideControls]);

  // ── Double-tap seek ───────────────────────────────────────────────────────
  const handleDoubleTap = useCallback((side) => {
    if (locked) return;
    const t = side === 'left'
      ? clamp(currentTime - 10, 0, duration)
      : clamp(currentTime + 10, 0, duration);
    videoRef.current?.seek(t);
    setCurrentTime(t);
    if (duration > 0) progressAnim.setValue(t / duration);
    if (side === 'left') { setLeftFlash(true);  setTimeout(() => setLeftFlash(false),  700); }
    else                 { setRightFlash(true); setTimeout(() => setRightFlash(false), 700); }
    showControls();
  }, [locked, currentTime, duration, showControls]);

  const handleTapZone = useCallback((side) => {
    const r = tapRef.current;
    r[side] = (r[side] || 0) + 1;
    clearTimeout(r.timer);
    r.timer = setTimeout(() => {
      if (r[side] >= 2) handleDoubleTap(side);
      else handleScreenTap();
      r.left = 0; r.right = 0;
    }, 260);
  }, [handleDoubleTap, handleScreenTap]);

  // ── Video callbacks ───────────────────────────────────────────────────────
  const handleProgress = useCallback(({ currentTime: ct }) => {
    const now = Date.now();
    setCurrentTime(ct);
    if (!dragging && now - lastPrgTime.current > 240 && duration > 0) {
      lastPrgTime.current = now;
      Animated.timing(progressAnim, {
        toValue: ct / duration,
        duration: 260,
        useNativeDriver: false,
      }).start();
    }
  }, [duration, dragging]);

  const handleLoad = useCallback(({ duration: d }) => {
    setDuration(d);
    setBuffering(false);
  }, []);

  const playEpisode = useCallback((ep) => {
    setCurrentEp(ep);
    setCurrentTime(0);
    setEnded(false);
    setPaused(false);
    setBuffering(true);
    progressAnim.setValue(0);
    setEpPanel(false);
  }, []);

  const handleEnd = useCallback(() => {
    setEnded(true);
    setPaused(true);
    showControls();
    if (movie?.is_series && currentEp) {
      const idx = seasonEps.findIndex(e => e.id === currentEp.id);
      if (idx !== -1 && idx < seasonEps.length - 1) {
        setTimeout(() => playEpisode(seasonEps[idx + 1]), 1500);
      }
    }
  }, [movie, currentEp, seasonEps, showControls, playEpisode]);

  const handleSeek = useCallback((t) => {
    const c = clamp(t, 0, duration);
    videoRef.current?.seek(c);
    setCurrentTime(c);
    if (duration > 0) progressAnim.setValue(c / duration);
  }, [duration]);

  const hasNext = useMemo(() => {
    const idx = seasonEps.findIndex(e => e.id === currentEp?.id);
    return movie?.is_series && idx !== -1 && idx < seasonEps.length - 1;
  }, [movie, currentEp, seasonEps]);

  const handleNext = useCallback(() => {
    const idx = seasonEps.findIndex(e => e.id === currentEp?.id);
    if (idx !== -1 && idx < seasonEps.length - 1) playEpisode(seasonEps[idx + 1]);
  }, [currentEp, seasonEps, playEpisode]);

  // ── Progress PanResponder ─────────────────────────────────────────────────
  const progressPR = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (evt) => {
      setDragging(true);
      clearTimeout(controlsTimer.current);
      const ratio = clamp(evt.nativeEvent.locationX / progressRef.current.width, 0, 1);
      progressAnim.setValue(ratio);
    },
    onPanResponderMove: (evt) => {
      const ratio = clamp(evt.nativeEvent.locationX / progressRef.current.width, 0, 1);
      progressAnim.setValue(ratio);
    },
    onPanResponderRelease: (evt) => {
      const ratio = clamp(evt.nativeEvent.locationX / progressRef.current.width, 0, 1);
      handleSeek(ratio * duration);
      setDragging(false);
      showControls();
    },
  }), [duration, handleSeek, showControls]);

  const handleProgressTap = useCallback((evt) => {
    const ratio = clamp(evt.nativeEvent.locationX / progressRef.current.width, 0, 1);
    handleSeek(ratio * duration);
    showControls();
  }, [duration, handleSeek, showControls]);

  // ── Rewind / Forward ──────────────────────────────────────────────────────
  const handleRewind = useCallback(() => {
    handleSeek(clamp(currentTime - 10, 0, duration));
    setLeftFlash(true); setTimeout(() => setLeftFlash(false), 700);
    showControls();
  }, [currentTime, duration, handleSeek, showControls]);

  const handleForward = useCallback(() => {
    handleSeek(clamp(currentTime + 10, 0, duration));
    setRightFlash(true); setTimeout(() => setRightFlash(false), 700);
    showControls();
  }, [currentTime, duration, handleSeek, showControls]);

  // ── Lock ──────────────────────────────────────────────────────────────────
  const handleLock = useCallback(() => {
    setLocked(true);
    hideControls();
    setUnlockVisible(true);
    Animated.timing(unlockOpac, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    unlockTimer.current = setTimeout(() => {
      Animated.timing(unlockOpac, { toValue: 0, duration: 280, useNativeDriver: true }).start(
        () => setUnlockVisible(false)
      );
    }, 4000);
  }, [hideControls]);

  const handleUnlock = useCallback(() => {
    setLocked(false);
    clearTimeout(unlockTimer.current);
    Animated.timing(unlockOpac, { toValue: 0, duration: 200, useNativeDriver: true }).start(
      () => setUnlockVisible(false)
    );
    showControls();
  }, [showControls]);

  // ── Captions ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!captionsOn || !selectedCaption?.language) { setCurrentCaption(''); return; }
    const tracks = {
      en: [
        { start: 5, end: 9, text: 'The mission begins now.' },
        { start: 12, end: 17, text: 'Into the Nebula Trench we go…' },
        { start: 22, end: 28, text: 'We have never seen anything like this before.' },
        { start: 35, end: 40, text: 'Stay together. Stay alive.' },
      ],
      es: [
        { start: 5, end: 9, text: 'La misión comienza ahora.' },
        { start: 12, end: 17, text: 'Al foso de la Nebulosa…' },
        { start: 22, end: 28, text: 'Nunca hemos visto algo así antes.' },
        { start: 35, end: 40, text: 'Mantenerse juntos. Mantenerse vivos.' },
      ],
      fr: [
        { start: 5, end: 9, text: 'La mission commence maintenant.' },
        { start: 12, end: 17, text: 'Dans la Tranchée Nébuleuse…' },
        { start: 22, end: 28, text: "Nous n'avons jamais rien vu de tel." },
        { start: 35, end: 40, text: 'Restez ensemble. Restez en vie.' },
      ],
    };
    const hit = (tracks[selectedCaption.language] || []).find(
      c => currentTime >= c.start && currentTime <= c.end
    );
    setCurrentCaption(hit?.text || '');
  }, [currentTime, captionsOn, selectedCaption]);

  const closeAllPanels = useCallback(() => {
    setSpeedPanel(false); setEpPanel(false); setCapPanel(false);
  }, []);

  const displayTitle = currentEp
    ? `${movie?.title || ''} · E${currentEp.episode_number}: ${currentEp.title}`
    : movie?.title || 'Playing';

  const remaining = Math.max(0, duration - currentTime);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar hidden />

      {/* Video */}
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
        <ImageBackground
          source={{ uri: movie?.hero_image || movie?.poster }}
          style={[StyleSheet.absoluteFill, { width: W, height: H }]}
          resizeMode="cover"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        </ImageBackground>
      )}

      {/* Captions */}
      {captionsOn && currentCaption !== '' && (
        <View
          style={[S.captionBox, { bottom: H * 0.11, left: W * 0.12, right: W * 0.12 }]}
          pointerEvents="none"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 6 }]} />
          <Text style={S.captionTxt}>{currentCaption}</Text>
        </View>
      )}

      {/* Netflix buffering */}
      {buffering && <BufferingOverlay />}

      {/* Seek flash */}
      <SeekFlash side="left"  visible={leftFlash}  />
      <SeekFlash side="right" visible={rightFlash} />

      {/* ─── Gesture zones (brightness left / volume right) ── */}
      {!buffering && (
        <>
          {/* LEFT: brightness swipe + single/double tap */}
          <View
            style={[S.gestureZone, { left: 0, width: W / 2, height: H }]}
            {...brightPR.panHandlers}
          >
            <TouchableWithoutFeedback onPress={() => handleTapZone('left')}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </View>

          {/* RIGHT: volume swipe + single/double tap */}
          <View
            style={[S.gestureZone, { right: 0, width: W / 2, height: H }]}
            {...volPR.panHandlers}
          >
            <TouchableWithoutFeedback onPress={() => handleTapZone('right')}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </View>
        </>
      )}

      {/* Brightness HUD */}
      <GestureHUD type="brightness" value={brightness} visible={brightHUD} />

      {/* Volume HUD */}
      <GestureHUD type="volume" value={volume} visible={volHUD} />

      {/* ════════════════════════════════════════════════════════════════════
          CONTROLS OVERLAY
      ════════════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: controlsOpac }]}
        pointerEvents={controlsVisible && !locked ? 'box-none' : 'none'}
      >
        {/* Gradient scrim */}
        <LinearGradient
          colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.76)']}
          locations={[0, 0.22, 0.78, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* TOP BAR */}
        <View style={[S.topBar, { paddingTop: Math.max(insets.top, 10) + 4 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.topBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={20} alpha={0.14} />
            <Icon name="chevron-left" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={S.topTitleWrap}>
            <Text style={S.topTitle} numberOfLines={1}>{displayTitle}</Text>
            {currentEp && (
              <Text style={S.topSub}>
                {activeSeason ? `Season ${activeSeason.season_number} · ` : ''}{fmt(remaining)} remaining
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={handleLock} style={S.topBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={20} alpha={0.14} />
            <Icon name="lock" size={15} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* CENTER CONTROLS */}
        <View style={S.centerRow}>
          <TouchableOpacity onPress={handleRewind} style={S.sideBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={29} alpha={0.14} />
            <Icon name="rotate-ccw" size={22} color="#fff" />
            <Text style={S.sideBtnLbl}>10</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setPaused(p => !p); showControls(); }}
            style={S.playBtn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)']}
              style={[StyleSheet.absoluteFill, { borderRadius: 44 }]}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.48)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 44 }]}
            />
            <Icon
              name={ended ? 'refresh-cw' : paused ? 'play' : 'pause'}
              size={34}
              color="#fff"
              style={paused && !ended ? { marginLeft: 4 } : {}}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForward} style={S.sideBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={29} alpha={0.14} />
            <Icon name="rotate-cw" size={22} color="#fff" />
            <Text style={S.sideBtnLbl}>10</Text>
          </TouchableOpacity>
        </View>

        {/* BOTTOM BAR */}
        <View style={[S.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>

          {/* Progress bar */}
          <View
            style={S.progressWrap}
            onLayout={(e) => { progressRef.current.width = e.nativeEvent.layout.width; }}
            {...progressPR.panHandlers}
          >
            <TouchableWithoutFeedback onPress={handleProgressTap}>
              <View style={S.progressTrack}>
                {/* Red fill */}
                <Animated.View
                  style={[
                    S.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
                {/* White thumb */}
                <Animated.View
                  style={[
                    S.progressThumb,
                    {
                      left: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                      marginLeft: -8,
                    },
                  ]}
                >
                  <View style={S.thumbCircle} />
                  <View style={S.thumbGlow} />
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          </View>

          {/* Bottom icon row */}
          <View style={S.btmRow}>
            {/* Left: Next */}
            <View style={S.btmLeft}>
              {movie?.is_series && hasNext && (
                <TouchableOpacity onPress={handleNext} style={S.btmBtn} activeOpacity={0.8}>
                  <GlassLayer borderRadius={16} alpha={0.14} />
                  <Icon name="skip-forward" size={13} color="#fff" />
                  <Text style={S.btmBtnLbl}>Next</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Center: time */}
            <Text style={S.timeText}>-{fmt(remaining)}</Text>

            {/* Right icons */}
            <View style={S.btmRight}>
              {/* CC */}
              <TouchableOpacity
                onPress={() => { closeAllPanels(); setCapPanel(true); showControls(); }}
                style={[S.btmBtn, captionsOn && S.btmBtnOn]}
                activeOpacity={0.8}
              >
                <GlassLayer borderRadius={16} alpha={captionsOn ? 0.20 : 0.12} />
                {captionsOn && (
                  <LinearGradient
                    colors={['rgba(0,255,178,0.24)', 'rgba(0,255,178,0.06)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                  />
                )}
                <Icon name="message-square" size={12} color={captionsOn ? ACCENT : '#fff'} />
                <Text style={[S.btmBtnLbl, captionsOn && { color: ACCENT }]}>CC</Text>
              </TouchableOpacity>

              {/* Episodes */}
              {movie?.is_series && (
                <TouchableOpacity
                  onPress={() => { closeAllPanels(); setEpPanel(true); showControls(); }}
                  style={S.btmBtn}
                  activeOpacity={0.8}
                >
                  <GlassLayer borderRadius={16} alpha={0.12} />
                  <Icon name="list" size={12} color="#fff" />
                  <Text style={S.btmBtnLbl}>Episodes</Text>
                </TouchableOpacity>
              )}

              {/* Speed */}
              <TouchableOpacity
                onPress={() => { closeAllPanels(); setSpeedPanel(true); showControls(); }}
                style={[S.btmBtn, S.speedBtnWrap]}
                activeOpacity={0.8}
              >
                <GlassLayer borderRadius={16} alpha={0.12} />
                {speed !== 1.0 && (
                  <LinearGradient
                    colors={['rgba(0,255,178,0.18)', 'rgba(0,255,178,0.04)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                  />
                )}
                <Text style={[S.speedLbl, speed !== 1.0 && { color: ACCENT }]}>{speed}×</Text>
              </TouchableOpacity>

              {/* Mute */}
              <TouchableOpacity onPress={() => setMuted(m => !m)} style={S.btmBtn} activeOpacity={0.8}>
                <GlassLayer borderRadius={16} alpha={0.12} />
                <Icon name={muted ? 'volume-x' : 'volume-2'} size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════════════
          LOCKED
      ════════════════════════════════════════════════════════════════════ */}
      {locked && (
        <Animated.View
          style={[S.unlockWrap, { opacity: unlockOpac }]}
          pointerEvents={unlockVisible ? 'box-none' : 'none'}
        >
          <TouchableOpacity onPress={handleUnlock} style={S.unlockBtn} activeOpacity={0.85}>
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
            <LinearGradient
              colors={[ACCENT, ACCENT_DIM, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, borderRadius: 1 }}
            />
            <Icon name="unlock" size={17} color="#fff" />
            <Text style={S.unlockLbl}>Unlock</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SPEED PANEL
      ════════════════════════════════════════════════════════════════════ */}
      <Panel visible={speedPanel} onClose={() => setSpeedPanel(false)}>
        <View style={S.panelContent}>
          <View style={S.panelHdr}>
            <Text style={S.panelTitle}>Playback Speed</Text>
            <TouchableOpacity onPress={() => setSpeedPanel(false)} style={S.panelX}>
              <GlassLayer borderRadius={15} alpha={0.12} />
              <Icon name="x" size={13} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          {SPEEDS.map(s => {
            const on = speed === s;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => { setSpeed(s); setSpeedPanel(false); showControls(); }}
                style={[S.panelOpt, on && S.panelOptOn]}
                activeOpacity={0.8}
              >
                {on && (
                  <LinearGradient
                    colors={['rgba(0,255,178,0.18)', 'rgba(0,255,178,0.04)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
                  />
                )}
                <GlassLayer borderRadius={12} alpha={on ? 0 : 0.07} />
                {on && <View style={S.optDot}><LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: 5 }]} /></View>}
                <Text style={[S.panelOptTxt, on && S.panelOptTxtOn]}>
                  {s === 1.0 ? 'Normal (1×)' : `${s}×`}
                </Text>
                {on && <Icon name="check" size={13} color={ACCENT} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Panel>

      {/* ════════════════════════════════════════════════════════════════════
          EPISODES PANEL
      ════════════════════════════════════════════════════════════════════ */}
      <Panel visible={epPanel} onClose={() => setEpPanel(false)}>
        <View style={S.panelContent}>
          <View style={S.panelHdr}>
            <Text style={S.panelTitle}>{movie?.title || 'Episodes'}</Text>
            <TouchableOpacity onPress={() => setEpPanel(false)} style={S.panelX}>
              <GlassLayer borderRadius={15} alpha={0.12} />
              <Icon name="x" size={13} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {allSeasons.length > 1 && (
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingBottom: 10 }}
            >
              {allSeasons.map(s => {
                const on = activeSeason?.id === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => { setActiveSeason(s); showControls(); }}
                    style={[S.seasonTab, on && S.seasonTabOn]}
                    activeOpacity={0.8}
                  >
                    {on
                      ? <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
                      : <GlassLayer borderRadius={14} alpha={0.10} />
                    }
                    <Text style={[S.seasonTabTxt, on && { color: BG }]}>S{s.season_number}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <FlatList
            data={seasonEps}
            keyExtractor={e => e.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
            renderItem={({ item }) => {
              const playing = currentEp?.id === item.id;
              return (
                <TouchableOpacity
                  onPress={() => playEpisode(item)}
                  style={[S.epCard, playing && S.epCardOn]}
                  activeOpacity={0.8}
                >
                  {playing
                    ? <LinearGradient colors={['rgba(0,255,178,0.18)', 'rgba(0,255,178,0.04)']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                    : <GlassLayer borderRadius={12} alpha={0.07} />
                  }
                  {item.thumbnail_url ? (
                    <ImageBackground
                      source={{ uri: item.thumbnail_url }}
                      style={S.epThumb}
                      imageStyle={{ borderRadius: 7 }}
                    >
                      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
                      {playing && (
                        <View style={S.epPlayIcon}>
                          <Text style={{ color: BG, fontSize: 12 }}>▶</Text>
                        </View>
                      )}
                    </ImageBackground>
                  ) : (
                    <View style={[S.epThumb, { backgroundColor: GLASS_BG, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: playing ? ACCENT : 'rgba(255,255,255,0.45)', fontSize: 14 }}>
                        {playing ? '▶' : `E${item.episode_number}`}
                      </Text>
                    </View>
                  )}
                  <View style={S.epInfo}>
                    <Text style={[S.epNum, playing && { color: ACCENT }]}>Episode {item.episode_number}</Text>
                    <Text style={S.epTitle} numberOfLines={1}>{item.title}</Text>
                    {item.duration && <Text style={S.epDur}>{item.duration}</Text>}
                  </View>
                  {playing && (
                    <View style={S.epBar}>
                      <LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: 2 }]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Panel>

      {/* ════════════════════════════════════════════════════════════════════
          CAPTION PANEL
      ════════════════════════════════════════════════════════════════════ */}
      <Panel visible={capPanel} onClose={() => setCapPanel(false)}>
        <View style={S.panelContent}>
          <View style={S.panelHdr}>
            <Text style={S.panelTitle}>Subtitles & Captions</Text>
            <TouchableOpacity onPress={() => setCapPanel(false)} style={S.panelX}>
              <GlassLayer borderRadius={15} alpha={0.12} />
              <Icon name="x" size={13} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          {MOCK_CAPTIONS.map(cap => {
            const on = selectedCaption?.id === cap.id;
            return (
              <TouchableOpacity
                key={cap.id}
                onPress={() => { setSelectedCaption(cap); setCaptionsOn(cap.language !== null); setCapPanel(false); }}
                style={[S.panelOpt, on && S.panelOptOn]}
                activeOpacity={0.8}
              >
                {on && (
                  <LinearGradient
                    colors={['rgba(0,255,178,0.18)', 'rgba(0,255,178,0.04)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
                  />
                )}
                <GlassLayer borderRadius={12} alpha={on ? 0 : 0.07} />
                {on && <View style={S.optDot}><LinearGradient colors={[ACCENT, ACCENT_DIM]} style={[StyleSheet.absoluteFill, { borderRadius: 5 }]} /></View>}
                <Text style={[S.panelOptTxt, on && S.panelOptTxtOn]}>{cap.label}</Text>
                {on && <Icon name="check" size={13} color={ACCENT} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Panel>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  // ── Netflix buffering ──────────────────────────────────────────────────────
  bufferWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 500,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  netflixRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
    borderTopColor: '#fff',
    shadowColor: '#fff',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },

  // ── Gesture zones ──────────────────────────────────────────────────────────
  gestureZone: {
    position: 'absolute',
    top: 0,
  },

  // ── Gesture HUD ────────────────────────────────────────────────────────────
  gestureHUD: {
    position: 'absolute',
    top: '18%',
    width: 54,
    paddingVertical: 16,
    paddingHorizontal: 15,
    borderRadius: 22,
    alignItems: 'center',
    zIndex: 310,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 14,
  },
  gestureHUDLeft:  { left: 18 },
  gestureHUDRight: { right: 18 },
  hudBg: {
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  hudTopLine: {
    position: 'absolute',
    top: 0, left: 10, right: 10,
    height: 2, borderRadius: 1,
    opacity: 0.75,
  },
  hudTrack: {
    width: 4,
    height: 96,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  hudFill: {
    width: '100%',
    borderRadius: 2,
  },
  hudNub: {
    position: 'absolute',
    left: -3,
    right: -3,
    height: 4,
    borderRadius: 2,
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 3,
  },
  hudPct: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // ── Seek flash ─────────────────────────────────────────────────────────────
  seekFlash: {
    position: 'absolute',
    top: '32%',
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 200,
  },
  seekFlashLeft:  { left: '10%' },
  seekFlashRight: { right: '10%' },
  seekFlashTxt: {
    color: '#fff', fontSize: 11, fontWeight: '800', marginTop: 3,
  },

  // ── Top bar ────────────────────────────────────────────────────────────────
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
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topTitle: {
    color: '#fff', fontSize: 14, fontWeight: '700',
    letterSpacing: 0.3, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  topSub: {
    color: 'rgba(255,255,255,0.48)', fontSize: 10, fontWeight: '500',
    textAlign: 'center', marginTop: 2,
  },

  // ── Center controls ────────────────────────────────────────────────────────
  centerRow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 44,
  },
  sideBtn: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
    gap: 2,
  },
  sideBtnLbl: { color: 'rgba(255,255,255,0.90)', fontSize: 10, fontWeight: '800' },
  playBtn: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.38)',
    shadowColor: '#fff', shadowOpacity: 0.18, shadowRadius: 20, elevation: 18,
  },

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16,
  },
  progressWrap: {
    height: 28, justifyContent: 'center', marginBottom: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: 2,
    overflow: 'visible',
  },
  progressFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: RED, borderRadius: 2,
    shadowColor: RED, shadowOpacity: 0.7, shadowRadius: 5,
  },
  progressThumb: {
    position: 'absolute', top: -8,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
  },
  thumbCircle: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
    shadowColor: '#fff', shadowOpacity: 0.55, shadowRadius: 6,
  },
  thumbGlow: {
    position: 'absolute', top: -5, left: -5, right: -5, bottom: -5,
    borderRadius: 13, backgroundColor: 'rgba(229,9,20,0.28)',
  },
  btmRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  btmLeft:  { width: 90, flexDirection: 'row', alignItems: 'center' },
  timeText: {
    flex: 1, textAlign: 'center',
    color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  btmRight: {
    width: 90, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end', gap: 5,
  },
  btmBtn: {
    height: 32, paddingHorizontal: 9, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER, gap: 3,
  },
  btmBtnOn:   { borderColor: 'rgba(0,255,178,0.40)' },
  btmBtnLbl:  { color: 'rgba(255,255,255,0.85)', fontSize: 9, fontWeight: '700' },
  speedBtnWrap: { minWidth: 40 },
  speedLbl:   { color: 'rgba(255,255,255,0.88)', fontSize: 11, fontWeight: '800' },

  // ── Unlock ─────────────────────────────────────────────────────────────────
  unlockWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 400,
  },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 13,
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.26)',
    shadowColor: '#fff', shadowOpacity: 0.12, shadowRadius: 14, elevation: 10,
  },
  unlockLbl: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },

  // ── Captions ───────────────────────────────────────────────────────────────
  captionBox: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    zIndex: 100,
  },
  captionTxt: {
    color: '#fff', fontSize: 14, fontWeight: '600',
    textAlign: 'center', lineHeight: 21,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // ── Panel ──────────────────────────────────────────────────────────────────
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: 280, overflow: 'hidden',
    borderLeftWidth: 1, borderLeftColor: GLASS_BORDER,
  },
  panelLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
  },
  panelContent: { flex: 1, paddingTop: 14 },
  panelHdr: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 14,
  },
  panelTitle: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  panelX: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER,
  },
  panelOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: 10, marginBottom: 5,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  panelOptOn: {
    borderColor: 'rgba(0,255,178,0.36)',
    shadowColor: ACCENT, shadowOpacity: 0.12, shadowRadius: 5, elevation: 3,
  },
  panelOptTxt:   { flex: 1, color: 'rgba(255,255,255,0.60)', fontSize: 13, fontWeight: '600' },
  panelOptTxtOn: { color: ACCENT, fontWeight: '800' },
  optDot: {
    width: 8, height: 8, borderRadius: 4, overflow: 'hidden',
    shadowColor: ACCENT, shadowOpacity: 0.8, shadowRadius: 4,
  },

  // Season tabs
  seasonTab: {
    paddingHorizontal: 13, paddingVertical: 6,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  seasonTabOn:  { borderColor: ACCENT, shadowColor: ACCENT, shadowOpacity: 0.22, shadowRadius: 5, elevation: 3 },
  seasonTabTxt: { color: 'rgba(255,255,255,0.58)', fontSize: 11, fontWeight: '700' },

  // Episode card
  epCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 9, marginBottom: 7,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  epCardOn: { borderColor: 'rgba(0,255,178,0.36)' },
  epThumb:  { width: 86, height: 52, borderRadius: 7 },
  epPlayIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,255,178,0.22)', borderRadius: 7,
  },
  epInfo:  { flex: 1 },
  epNum:   { color: 'rgba(255,255,255,0.38)', fontSize: 9, fontWeight: '700', marginBottom: 2 },
  epTitle: { color: '#fff', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  epDur:   { color: 'rgba(255,255,255,0.36)', fontSize: 9 },
  epBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    borderRadius: 2, overflow: 'hidden',
  },
});
