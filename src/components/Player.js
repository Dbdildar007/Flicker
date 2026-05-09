/**
 * PlayerScreen.js — Netflix-Style Full-Screen Video Player (Final)
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW in this version:
 *  • Volume control — vertical swipe up/down on RIGHT half
 *  • Brightness control — vertical swipe up/down on LEFT half
 *  • Both show Netflix-style slim vertical pill indicator with icon
 *  • Indicators auto-hide after 1.5s of no gesture
 *  • Netflix-style simple white spinning arc loader (no glass)
 *
 * ALL existing features retained:
 *  • Auto-landscape, transparent controls, auto-hide 5s
 *  • Play/Pause, ±10s rewind/forward buttons
 *  • Double-tap left/right = ±10s seek with ripple
 *  • Smooth red Netflix progress bar + draggable thumb
 *  • Tap-to-seek, remaining time counter
 *  • Speed selector panel, Episodes panel, Captions panel
 *  • Lock screen (auto-hides unlock icon after 4s)
 *  • Auto-play next episode on end
 *  • Next Episode button (series only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Dependencies:
 *   react-native-video
 *   react-native-linear-gradient
 *   react-native-vector-icons/Feather
 *   react-native-orientation-locker
 *   react-native-system-setting   ← for volume + brightness
 *   react-native-safe-area-context
 * ─────────────────────────────────────────────────────────────────────────────
 * Navigation params:
 *   movie         - full movie object (title, video_url, trailer_url, poster, …)
 *   episode       - current episode object | null
 *   episodes      - all episodes in active season
 *   seasons       - all season objects
 *   currentSeason - active season object
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useRef, useEffect, useState, useCallback, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Dimensions, StatusBar, ImageBackground,
  FlatList, ScrollView, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Feather';
import Orientation from 'react-native-orientation-locker';
import SystemSetting from 'react-native-system-setting';
import { useNavigation, useRoute } from '@react-navigation/native';

// ─── helpers ─────────────────────────────────────────────────────────────────
const getWH = () => {
  const { width: w, height: h } = Dimensions.get('window');
  return { W: Math.max(w, h), H: Math.min(w, h) };
};
const fmt = (secs) => {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${r < 10 ? '0' : ''}${r}`;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// ─── tokens ───────────────────────────────────────────────────────────────────
const RED        = '#E50914';
const ACCENT     = '#00FFB2';
const ACCENT_DIM = '#00CC90';
const BG         = '#030F0C';
const GB         = 'rgba(255,255,255,0.16)';   // glass border
const SPEEDS     = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const MOCK_CAPTIONS = [
  { id: 'en',  label: 'English',  language: 'en'  },
  { id: 'es',  label: 'Español',  language: 'es'  },
  { id: 'fr',  label: 'Français', language: 'fr'  },
  { id: 'off', label: 'Off',      language: null  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GlassLayer
// ─────────────────────────────────────────────────────────────────────────────
const GlassLayer = memo(({ borderRadius = 12, alpha = 0.12 }) => (
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
));

// ─────────────────────────────────────────────────────────────────────────────
// NETFLIX LOADER — simple white arc spinner, exactly like Netflix
// ─────────────────────────────────────────────────────────────────────────────
const NetflixLoader = memo(() => {
  const spinA = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(spinA, { toValue: 1, duration: 800, useNativeDriver: true })
    );
    a.start();
    return () => a.stop();
  }, []);
  const rotate = spinA.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={S.loaderOverlay} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.40)' }]} />
      <Animated.View style={[S.loaderRing, { transform: [{ rotate }] }]} />
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GESTURE INDICATOR — slim vertical pill (brightness left / volume right)
// ─────────────────────────────────────────────────────────────────────────────
const GestureIndicator = memo(({ type, value, visible }) => {
  const opacA = useRef(new Animated.Value(0)).current;
  const mountedA = useRef(false);

  useEffect(() => {
    if (visible && !mountedA.current) {
      mountedA.current = true;
      Animated.timing(opacA, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    } else if (!visible && mountedA.current) {
      mountedA.current = false;
      Animated.timing(opacA, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    }
  }, [visible]);

  const isVol    = type === 'volume';
  const pct      = Math.round(clamp(value) * 100);
  const iconName = isVol
    ? (value === 0 ? 'volume-x' : value < 0.45 ? 'volume-1' : 'volume-2')
    : (value < 0.25 ? 'moon' : 'sun');
  const color    = isVol ? '#ffffff' : '#FFD966';

  return (
    <Animated.View
      style={[S.gIndicator, isVol ? S.gIndicatorRight : S.gIndicatorLeft, { opacity: opacA }]}
      pointerEvents="none"
    >
      {/* Dark frosted pill */}
      <View style={[StyleSheet.absoluteFill, S.gIndicatorBg]} />
      <View style={[StyleSheet.absoluteFill, S.gIndicatorBorder]} />
      {/* Top sheen */}
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
      />

      {/* Icon */}
      <Icon name={iconName} size={15} color={color} style={{ marginBottom: 8 }} />

      {/* Vertical track */}
      <View style={S.gTrack}>
        <View style={[S.gFill, { height: `${pct}%`, backgroundColor: color }]} />
      </View>

      {/* Percent */}
      <Text style={[S.gLabel, { color }]}>{pct}</Text>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SEEK FLASH  (double-tap)
// ─────────────────────────────────────────────────────────────────────────────
const SeekFlash = memo(({ side, visible }) => {
  const opacA  = useRef(new Animated.Value(0)).current;
  const scaleA = useRef(new Animated.Value(0.75)).current;
  useEffect(() => {
    if (visible) {
      opacA.setValue(1); scaleA.setValue(0.80);
      Animated.parallel([
        Animated.timing(opacA,  { toValue: 0,    duration: 650, useNativeDriver: true }),
        Animated.spring(scaleA, { toValue: 1.12, useNativeDriver: true, tension: 180, friction: 10 }),
      ]).start();
    }
  }, [visible]);
  return (
    <Animated.View
      style={[S.seekFlash, side === 'left' ? S.sfLeft : S.sfRight, { opacity: opacA, transform: [{ scale: scaleA }] }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.03)']}
        style={[StyleSheet.absoluteFill, { borderRadius: 60 }]}
      />
      <Icon name={side === 'left' ? 'rotate-ccw' : 'rotate-cw'} size={26} color="#fff" />
      <Text style={S.sfTxt}>10s</Text>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE PANEL (right edge)
// ─────────────────────────────────────────────────────────────────────────────
const SlidePanel = memo(({ children, visible, onClose }) => {
  const slideA = useRef(new Animated.Value(320)).current;
  const opacA  = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.parallel([
        Animated.spring(slideA, { toValue: 0,   useNativeDriver: true, tension: 220, friction: 26 }),
        Animated.timing(opacA,  { toValue: 1,   duration: 190, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideA, { toValue: 320, duration: 230, useNativeDriver: true }),
        Animated.timing(opacA,  { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  if (!show) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacA }]} pointerEvents={visible ? 'box-none' : 'none'}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.50)' }]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[S.panel, { transform: [{ translateX: slideA }] }]}>
        <LinearGradient colors={['rgba(12,22,18,0.98)', 'rgba(3,12,10,0.99)']} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.3 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient colors={[ACCENT, ACCENT_DIM, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.panelLine} />
        {children}
      </Animated.View>
    </Animated.View>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function PlayerScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();

  const {
    movie           = {},
    episode:        initEpisode  = null,
    episodes:       allEpisodes  = [],
    seasons:        allSeasons   = [],
    currentSeason:  initSeason   = null,
  } = route.params || {};

  // dims
  const [dims, setDims] = useState(getWH());
  const { W, H }        = dims;
  useEffect(() => {
    const s = Dimensions.addEventListener('change', () => setDims(getWH()));
    return () => s?.remove?.();
  }, []);

  // video
  const videoRef      = useRef(null);
  const [currentEpisode, setCurrentEpisode] = useState(initEpisode);
  const [activeSeason,   setActiveSeason]   = useState(initSeason || allSeasons[0] || null);
  const [seasonEpisodes, setSeasonEpisodes] = useState(allEpisodes);
  const videoUri = useMemo(() => {
    if (currentEpisode?.video_url) return currentEpisode.video_url;
    return movie?.video_url || movie?.trailer_url || null;
  }, [currentEpisode, movie]);

  const [paused,      setPaused]      = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [buffering,   setBuffering]   = useState(true);
  const [ended,       setEnded]       = useState(false);
  const [speed,       setSpeed]       = useState(1.0);
  const [muted,       setMuted]       = useState(false);

  // captions
  const [captionsOn,      setCaptionsOn]      = useState(false);
  const [selCaption,      setSelCaption]      = useState(MOCK_CAPTIONS[3]);
  const [currentCaption,  setCurrentCaption]  = useState('');

  // controls
  const [ctrlVisible, setCtrlVisible] = useState(true);
  const ctrlOpac   = useRef(new Animated.Value(1)).current;
  const ctrlTimer  = useRef(null);

  // lock
  const [locked,       setLocked]       = useState(false);
  const [unlockShown,  setUnlockShown]  = useState(false);
  const unlockOpac  = useRef(new Animated.Value(0)).current;
  const unlockTimer = useRef(null);

  // panels
  const [speedOpen,   setSpeedOpen]   = useState(false);
  const [epOpen,      setEpOpen]      = useState(false);
  const [capOpen,     setCapOpen]     = useState(false);

  // seek flash
  const [leftFlash,  setLeftFlash]  = useState(false);
  const [rightFlash, setRightFlash] = useState(false);
  const tapRef = useRef({ left: 0, right: 0, timer: null });

  // progress
  const progressAnim  = useRef(new Animated.Value(0)).current;
  const lastPUpdate   = useRef(0);
  const [dragging,    setDragging]   = useState(false);
  const [dragVal,     setDragVal]    = useState(0);
  const progRef       = useRef({ width: W - 32 });

  // ── VOLUME & BRIGHTNESS ───────────────────────────────────────────────────
  const [volume,      setVolume]      = useState(0.8);
  const [brightness,  setBrightness]  = useState(0.8);
  const [volVis,      setVolVis]      = useState(false);
  const [brightVis,   setBrightVis]   = useState(false);
  const volRef    = useRef(0.8);
  const brightRef = useRef(0.8);
  const volHide   = useRef(null);
  const briHide   = useRef(null);

  useEffect(() => {
    SystemSetting.getVolume().then(v => { volRef.current = v; setVolume(v); }).catch(() => {});
    SystemSetting.getAppBrightness().then(b => {
      const val = b ?? 0.8; brightRef.current = val; setBrightness(val);
    }).catch(() => {});
  }, []);

  const showVol = useCallback(() => {
    setVolVis(true);
    clearTimeout(volHide.current);
    volHide.current = setTimeout(() => setVolVis(false), 1500);
  }, []);
  const showBri = useCallback(() => {
    setBrightVis(true);
    clearTimeout(briHide.current);
    briHide.current = setTimeout(() => setBrightVis(false), 1500);
  }, []);

  // PanResponder factory — confirms vertical gesture before stealing touch
  const makeGesture = useCallback((side) =>
    PanResponder.create({
      onMoveShouldSetPanResponder:        (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 0.7,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 0.7,
      onPanResponderGrant: (_, g) => {
        // snapshot start value
        if (side === 'volume')     volRef._startVal    = volRef.current;
        else                       brightRef._startVal = brightRef.current;
      },
      onPanResponderMove: (_, g) => {
        const range   = H * 0.72;          // full swipe distance
        const delta   = -(g.dy / range);   // up = positive
        if (side === 'volume') {
          const nv = clamp((volRef._startVal ?? volRef.current) + delta);
          volRef.current = nv;
          setVolume(nv);
          SystemSetting.setVolume(nv);
          showVol();
        } else {
          const nv = clamp((brightRef._startVal ?? brightRef.current) + delta);
          brightRef.current = nv;
          setBrightness(nv);
          SystemSetting.setAppBrightness(nv);
          showBri();
        }
      },
      onPanResponderRelease: () => {
        // clear snapshot
        if (side === 'volume') delete volRef._startVal;
        else                   delete brightRef._startVal;
      },
    }),
  [H, showVol, showBri]);

  const leftGesture  = useMemo(() => makeGesture('brightness'), [makeGesture]);
  const rightGesture = useMemo(() => makeGesture('volume'),     [makeGesture]);

  // ── ORIENTATION ───────────────────────────────────────────────────────────
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    Orientation.lockToLandscape();
    return () => { StatusBar.setHidden(false, 'fade'); Orientation.lockToPortrait(); };
  }, []);

  // ── CONTROLS ─────────────────────────────────────────────────────────────
  const showCtrl = useCallback(() => {
    clearTimeout(ctrlTimer.current);
    Animated.timing(ctrlOpac, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    setCtrlVisible(true);
    ctrlTimer.current = setTimeout(() => {
      if (!paused && !locked) {
        Animated.timing(ctrlOpac, { toValue: 0, duration: 360, useNativeDriver: true })
          .start(() => setCtrlVisible(false));
      }
    }, 5000);
  }, [paused, locked]);

  const hideCtrl = useCallback(() => {
    clearTimeout(ctrlTimer.current);
    Animated.timing(ctrlOpac, { toValue: 0, duration: 260, useNativeDriver: true })
      .start(() => setCtrlVisible(false));
  }, []);

  useEffect(() => {
    if (paused) {
      clearTimeout(ctrlTimer.current);
      Animated.timing(ctrlOpac, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      setCtrlVisible(true);
    } else if (ctrlVisible) { showCtrl(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(() => { showCtrl(); }, []); // mount

  // ── TAPS ─────────────────────────────────────────────────────────────────
  const handleScreenTap = useCallback(() => {
    if (locked) {
      clearTimeout(unlockTimer.current);
      setUnlockShown(true);
      Animated.timing(unlockOpac, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      unlockTimer.current = setTimeout(() => {
        Animated.timing(unlockOpac, { toValue: 0, duration: 260, useNativeDriver: true })
          .start(() => setUnlockShown(false));
      }, 4000);
      return;
    }
    if (ctrlVisible) { if (!paused) hideCtrl(); }
    else             showCtrl();
  }, [locked, ctrlVisible, paused, showCtrl, hideCtrl]);

  const handleDoubleTap = useCallback((side) => {
    if (locked) return;
    const nt = side === 'left' ? Math.max(0, currentTime - 10) : Math.min(duration, currentTime + 10);
    videoRef.current?.seek(nt);
    setCurrentTime(nt);
    if (duration > 0) progressAnim.setValue(nt / duration);
    if (side === 'left') { setLeftFlash(true);  setTimeout(() => setLeftFlash(false),  700); }
    else                  { setRightFlash(true); setTimeout(() => setRightFlash(false), 700); }
    showCtrl();
  }, [locked, currentTime, duration, showCtrl]);

  const handleTapZone = useCallback((side) => {
    const r = tapRef.current;
    r[side] = (r[side] || 0) + 1;
    clearTimeout(r.timer);
    r.timer = setTimeout(() => {
      if (r[side] >= 2) handleDoubleTap(side);
      else               handleScreenTap();
      r.left = 0; r.right = 0;
    }, 260);
  }, [handleDoubleTap, handleScreenTap]);

  // ── VIDEO CALLBACKS ───────────────────────────────────────────────────────
  const handleProgress = useCallback(({ currentTime: ct }) => {
    setCurrentTime(ct);
    const now = Date.now();
    if (!dragging && now - lastPUpdate.current > 200 && duration > 0) {
      lastPUpdate.current = now;
      Animated.timing(progressAnim, { toValue: ct / duration, duration: 240, useNativeDriver: false }).start();
    }
  }, [duration, dragging]);

  const handleLoad = useCallback(({ duration: d }) => { setDuration(d); setBuffering(false); }, []);

  const playEpisode = useCallback((ep) => {
    setCurrentEpisode(ep); setCurrentTime(0); setEnded(false);
    setPaused(false); setBuffering(true); progressAnim.setValue(0); setEpOpen(false);
  }, []);

  const handleEnd = useCallback(() => {
    setEnded(true); setPaused(true); showCtrl();
    if (movie?.is_series && currentEpisode) {
      const idx = seasonEpisodes.findIndex(e => e.id === currentEpisode.id);
      if (idx !== -1 && idx < seasonEpisodes.length - 1)
        setTimeout(() => playEpisode(seasonEpisodes[idx + 1]), 1400);
    }
  }, [movie, currentEpisode, seasonEpisodes, showCtrl, playEpisode]);

  const handleSeek = useCallback((t) => {
    const ct = clamp(t, 0, duration);
    videoRef.current?.seek(ct); setCurrentTime(ct);
    if (duration > 0) progressAnim.setValue(ct / duration);
  }, [duration]);

  const handleNextEp = useCallback(() => {
    if (!movie?.is_series || !currentEpisode) return;
    const idx = seasonEpisodes.findIndex(e => e.id === currentEpisode.id);
    if (idx !== -1 && idx < seasonEpisodes.length - 1) playEpisode(seasonEpisodes[idx + 1]);
  }, [movie, currentEpisode, seasonEpisodes, playEpisode]);

  const hasNext = useMemo(() => {
    if (!movie?.is_series || !currentEpisode) return false;
    const idx = seasonEpisodes.findIndex(e => e.id === currentEpisode.id);
    return idx !== -1 && idx < seasonEpisodes.length - 1;
  }, [movie, currentEpisode, seasonEpisodes]);

  // ── PROGRESS PAN ─────────────────────────────────────────────────────────
  const progressPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (evt) => {
      setDragging(true); clearTimeout(ctrlTimer.current);
      const ratio = clamp(evt.nativeEvent.locationX / progRef.current.width);
      setDragVal(ratio * duration); progressAnim.setValue(ratio);
    },
    onPanResponderMove: (evt) => {
      const ratio = clamp(evt.nativeEvent.locationX / progRef.current.width);
      setDragVal(ratio * duration); progressAnim.setValue(ratio);
    },
    onPanResponderRelease: (evt) => {
      const ratio = clamp(evt.nativeEvent.locationX / progRef.current.width);
      handleSeek(ratio * duration); setDragging(false); showCtrl();
    },
  }), [duration, handleSeek, showCtrl]);

  const handleProgTap = useCallback((evt) => {
    handleSeek(clamp(evt.nativeEvent.locationX / progRef.current.width) * duration);
    showCtrl();
  }, [duration, handleSeek, showCtrl]);

  // rewind / forward
  const handleRewind = useCallback(() => {
    handleSeek(Math.max(0, currentTime - 10));
    setLeftFlash(true); setTimeout(() => setLeftFlash(false), 700); showCtrl();
  }, [currentTime, handleSeek, showCtrl]);
  const handleFwd = useCallback(() => {
    handleSeek(Math.min(duration, currentTime + 10));
    setRightFlash(true); setTimeout(() => setRightFlash(false), 700); showCtrl();
  }, [currentTime, duration, handleSeek, showCtrl]);

  // lock
  const handleLock = useCallback(() => {
    setLocked(true); hideCtrl();
    setUnlockShown(true);
    Animated.timing(unlockOpac, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    unlockTimer.current = setTimeout(() => {
      Animated.timing(unlockOpac, { toValue: 0, duration: 260, useNativeDriver: true })
        .start(() => setUnlockShown(false));
    }, 4000);
  }, [hideCtrl]);

  const handleUnlock = useCallback(() => {
    setLocked(false); clearTimeout(unlockTimer.current);
    Animated.timing(unlockOpac, { toValue: 0, duration: 180, useNativeDriver: true })
      .start(() => setUnlockShown(false));
    showCtrl();
  }, [showCtrl]);

  // captions
  useEffect(() => {
    if (!captionsOn || !selCaption?.language) { setCurrentCaption(''); return; }
    const T = {
      en: [{ s:5,e:9,t:"The mission begins now." },{ s:12,e:17,t:"Into the Nebula Trench we go..." },{ s:22,e:28,t:"We have never seen anything like this." },{ s:35,e:40,t:"Stay together. Stay alive." }],
      es: [{ s:5,e:9,t:"La misión comienza ahora." },{ s:12,e:17,t:"Al foso de la Nebulosa..." },{ s:22,e:28,t:"Nunca hemos visto algo así." },{ s:35,e:40,t:"Mantenerse juntos. Mantenerse vivos." }],
      fr: [{ s:5,e:9,t:"La mission commence maintenant." },{ s:12,e:17,t:"Dans la Tranchée Nébuleuse..." },{ s:22,e:28,t:"Nous n'avons jamais rien vu de tel." },{ s:35,e:40,t:"Restez ensemble. Restez en vie." }],
    };
    const a = (T[selCaption.language] || []).find(c => currentTime >= c.s && currentTime <= c.e);
    setCurrentCaption(a?.t || '');
  }, [currentTime, captionsOn, selCaption]);

  const closeAll = useCallback(() => { setSpeedOpen(false); setEpOpen(false); setCapOpen(false); }, []);

  const remaining  = Math.max(0, duration - currentTime);
  const titleLabel = currentEpisode
    ? `${movie?.title || ''} · E${currentEpisode.episode_number}: ${currentEpisode.title}`
    : (movie?.title || 'Playing');

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <View style={[S.root, { width: W, height: H }]}>
      <StatusBar hidden />

      {/* VIDEO */}
      {videoUri ? (
        <Video
          ref={videoRef}
          source={{ uri: videoUri }}
          style={[StyleSheet.absoluteFill, { width: W, height: H }]}
          paused={paused} muted={muted} rate={speed}
          resizeMode="cover"
          onProgress={handleProgress} onLoad={handleLoad}
          onEnd={handleEnd} onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
          ignoreSilentSwitch="ignore" playInBackground={false} repeat={false}
        />
      ) : (
        <ImageBackground
          source={{ uri: movie?.hero_image || movie?.poster }}
          style={[StyleSheet.absoluteFill, { width: W, height: H }]}
          resizeMode="cover"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.48)' }]} />
        </ImageBackground>
      )}

      {/* CAPTIONS */}
      {captionsOn && currentCaption !== '' && (
        <View style={[S.capWrap, { bottom: H * 0.13, left: W * 0.12, right: W * 0.12 }]} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 5 }]} />
          <Text style={S.capTxt}>{currentCaption}</Text>
        </View>
      )}

      {/* LOADER */}
      {buffering && <NetflixLoader />}

      {/* SEEK FLASHES */}
      <SeekFlash side="left"  visible={leftFlash}  />
      <SeekFlash side="right" visible={rightFlash} />

      {/* ──────────────────────────────────────────────────────────────────
          GESTURE + TAP ZONES
          Each half has a gesture PanResponder layer (for swipe) with a
          TouchableWithoutFeedback on top for taps.
          PanResponder only claims the touch after confirming a vertical move,
          so quick taps always fall through to the Touchable.
      ────────────────────────────────────────────────────────────────── */}
      {!buffering && !locked && (
        <>
          {/* LEFT — brightness */}
          <View
            style={[S.gZone, { left: 0, width: W / 2, height: H }]}
            {...leftGesture.panHandlers}
          >
            <TouchableWithoutFeedback onPress={() => handleTapZone('left')}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </View>

          {/* RIGHT — volume */}
          <View
            style={[S.gZone, { right: 0, width: W / 2, height: H }]}
            {...rightGesture.panHandlers}
          >
            <TouchableWithoutFeedback onPress={() => handleTapZone('right')}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </View>
        </>
      )}

      {/* locked-state tap catcher */}
      {locked && (
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      )}

      {/* INDICATORS */}
      <GestureIndicator type="brightness" value={brightness} visible={brightVis} />
      <GestureIndicator type="volume"     value={volume}     visible={volVis}    />

      {/* ══════════════════════════════════════════════════════════════════
          CONTROLS OVERLAY
      ══════════════════════════════════════════════════════════════════ */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: ctrlOpac }]}
        pointerEvents={ctrlVisible && !locked ? 'box-none' : 'none'}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.68)','rgba(0,0,0,0.06)','rgba(0,0,0,0.06)','rgba(0,0,0,0.72)']}
          locations={[0,0.20,0.80,1]}
          style={StyleSheet.absoluteFill}
        />

        {/* TOP BAR */}
        <View style={[S.topBar, { paddingTop: Math.max(insets.top, 10) + 4 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.topBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={20} alpha={0.14} />
            <Icon name="chevron-left" size={21} color="#fff" />
          </TouchableOpacity>
          <View style={S.topMid}>
            <Text style={S.topTitle} numberOfLines={1}>{titleLabel}</Text>
            {currentEpisode && (
              <Text style={S.topSub}>
                {activeSeason ? `Season ${activeSeason.season_number}  ·  ` : ''}{fmt(remaining)} remaining
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={handleLock} style={S.topBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={20} alpha={0.14} />
            <Icon name="lock" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* CENTER CONTROLS */}
        <View style={S.centerRow}>
          <TouchableOpacity onPress={handleRewind} style={S.sidBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={28} alpha={0.14} />
            <Icon name="rotate-ccw" size={22} color="#fff" />
            <Text style={S.sidBtnTxt}>10</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setPaused(p => !p); showCtrl(); }} style={S.playBtn} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(255,255,255,0.30)','rgba(255,255,255,0.10)','rgba(255,255,255,0.04)']} style={[StyleSheet.absoluteFill,{borderRadius:44}]} />
            <LinearGradient colors={['rgba(255,255,255,0.50)','rgba(255,255,255,0)']} start={{x:0,y:0}} end={{x:0,y:0.5}} style={[StyleSheet.absoluteFill,{borderRadius:44}]} />
            <Icon name={ended ? 'refresh-cw' : paused ? 'play' : 'pause'} size={32} color="#fff" style={paused && !ended ? { marginLeft: 4 } : {}} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleFwd} style={S.sidBtn} activeOpacity={0.8}>
            <GlassLayer borderRadius={28} alpha={0.14} />
            <Icon name="rotate-cw" size={22} color="#fff" />
            <Text style={S.sidBtnTxt}>10</Text>
          </TouchableOpacity>
        </View>

        {/* BOTTOM BAR */}
        <View style={[S.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
          {/* Progress */}
          <View
            style={S.progWrap}
            onLayout={e => { progRef.current.width = e.nativeEvent.layout.width; }}
            {...progressPan.panHandlers}
          >
            <TouchableWithoutFeedback onPress={handleProgTap}>
              <View style={S.progTrack}>
                <View style={[S.progBuf, { width: `${Math.min(100,(dragging ? dragVal/duration : currentTime/duration)*100+6)}%` }]} />
                <Animated.View style={[S.progFill, { width: progressAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'], extrapolate:'clamp' }) }]} />
                <Animated.View style={[S.thumb, { left: progressAnim.interpolate({ inputRange:[0,1], outputRange:[0, progRef.current.width - 8], extrapolate:'clamp' }) }]}>
                  <View style={S.thumbInner} />
                  <View style={S.thumbGlow} />
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          </View>

          {/* Icon row */}
          <View style={S.iconRow}>
            <View style={S.iconLeft}>
              {movie?.is_series && hasNext && (
                <TouchableOpacity onPress={handleNextEp} style={S.iconBtn} activeOpacity={0.8}>
                  <GlassLayer borderRadius={18} alpha={0.14} />
                  <Icon name="skip-forward" size={14} color="#fff" />
                  <Text style={S.iconBtnTxt}>Next</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={S.timeLeft}>-{fmt(remaining)}</Text>

            <View style={S.iconRight}>
              {/* CC */}
              <TouchableOpacity onPress={() => { closeAll(); setCapOpen(true); showCtrl(); }}
                style={[S.iconBtn, captionsOn && S.iconBtnOn]} activeOpacity={0.8}>
                <GlassLayer borderRadius={18} alpha={captionsOn ? 0.20 : 0.14} />
                {captionsOn && <LinearGradient colors={['rgba(0,255,178,0.24)','rgba(0,255,178,0.06)']} style={[StyleSheet.absoluteFill,{borderRadius:18}]} />}
                <Icon name="message-square" size={14} color={captionsOn ? ACCENT : '#fff'} />
                <Text style={[S.iconBtnTxt, captionsOn && { color: ACCENT }]}>CC</Text>
              </TouchableOpacity>

              {/* Episodes */}
              {movie?.is_series && (
                <TouchableOpacity onPress={() => { closeAll(); setEpOpen(true); showCtrl(); }} style={S.iconBtn} activeOpacity={0.8}>
                  <GlassLayer borderRadius={18} alpha={0.14} />
                  <Icon name="list" size={14} color="#fff" />
                  <Text style={S.iconBtnTxt}>Episodes</Text>
                </TouchableOpacity>
              )}

              {/* Speed */}
              <TouchableOpacity onPress={() => { closeAll(); setSpeedOpen(true); showCtrl(); }}
                style={[S.iconBtn, speed !== 1.0 && S.iconBtnOn]} activeOpacity={0.8}>
                <GlassLayer borderRadius={18} alpha={0.14} />
                {speed !== 1.0 && <LinearGradient colors={['rgba(0,255,178,0.20)','rgba(0,255,178,0.05)']} style={[StyleSheet.absoluteFill,{borderRadius:18}]} />}
                <Text style={[S.iconBtnTxt,{fontSize:11,fontWeight:'800'}, speed!==1.0&&{color:ACCENT}]}>{speed}×</Text>
              </TouchableOpacity>

              {/* Mute */}
              <TouchableOpacity onPress={() => setMuted(m => !m)} style={S.iconBtn} activeOpacity={0.8}>
                <GlassLayer borderRadius={18} alpha={0.14} />
                <Icon name={muted ? 'volume-x' : 'volume-2'} size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* LOCK OVERLAY */}
      {locked && (
        <Animated.View style={[S.unlockWrap, { opacity: unlockOpac }]} pointerEvents={unlockShown ? 'box-none' : 'none'}>
          <TouchableOpacity onPress={handleUnlock} style={S.unlockBtn} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(255,255,255,0.20)','rgba(255,255,255,0.07)','rgba(255,255,255,0.02)']} style={[StyleSheet.absoluteFill,{borderRadius:26}]} />
            <LinearGradient colors={['rgba(255,255,255,0.34)','rgba(255,255,255,0)']} start={{x:0,y:0}} end={{x:0,y:0.5}} style={[StyleSheet.absoluteFill,{borderRadius:26}]} />
            <View style={[StyleSheet.absoluteFill,{borderRadius:26,borderWidth:1.5,borderColor:'rgba(255,255,255,0.26)'}]} />
            <Icon name="unlock" size={18} color="#fff" />
            <Text style={S.unlockTxt}>Unlock</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ══════════════════════════════ SPEED PANEL ════════════════════════ */}
      <SlidePanel visible={speedOpen} onClose={() => setSpeedOpen(false)}>
        <View style={S.panelContent}>
          <View style={S.panelHead}>
            <Text style={S.panelTitle}>Playback Speed</Text>
            <TouchableOpacity onPress={() => setSpeedOpen(false)} style={S.panelX}>
              <GlassLayer borderRadius={16} alpha={0.12} /><Icon name="x" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          {SPEEDS.map(s => {
            const on = speed === s;
            return (
              <TouchableOpacity key={s} onPress={() => { setSpeed(s); setSpeedOpen(false); showCtrl(); }}
                style={[S.optRow, on && S.optRowOn]} activeOpacity={0.8}>
                {on && <LinearGradient colors={['rgba(0,255,178,0.18)','rgba(0,255,178,0.04)']} style={[StyleSheet.absoluteFill,{borderRadius:12}]} />}
                <GlassLayer borderRadius={12} alpha={on ? 0 : 0.08} />
                {on && <View style={S.optDot}><LinearGradient colors={[ACCENT,ACCENT_DIM]} style={[StyleSheet.absoluteFill,{borderRadius:5}]} /></View>}
                <Text style={[S.optTxt, on && S.optTxtOn]}>{s === 1.0 ? 'Normal (1×)' : `${s}×`}</Text>
                {on && <Icon name="check" size={14} color={ACCENT} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </SlidePanel>

      {/* ══════════════════════════ EPISODES PANEL ═════════════════════════ */}
      <SlidePanel visible={epOpen} onClose={() => setEpOpen(false)}>
        <View style={S.panelContent}>
          <View style={S.panelHead}>
            <Text style={S.panelTitle}>{movie?.title || 'Episodes'}</Text>
            <TouchableOpacity onPress={() => setEpOpen(false)} style={S.panelX}>
              <GlassLayer borderRadius={16} alpha={0.12} /><Icon name="x" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          {allSeasons.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal:16, gap:8, paddingBottom:12 }}>
              {allSeasons.map(s => {
                const isA = activeSeason?.id === s.id;
                return (
                  <TouchableOpacity key={s.id} onPress={() => { setActiveSeason(s); showCtrl(); }}
                    style={[S.seaTab, isA && S.seaTabOn]} activeOpacity={0.8}>
                    {isA ? <LinearGradient colors={[ACCENT,ACCENT_DIM]} style={[StyleSheet.absoluteFill,{borderRadius:16}]} /> : <GlassLayer borderRadius={16} alpha={0.10} />}
                    <Text style={[S.seaTabTxt, isA && { color: BG }]}>S{s.season_number}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          <FlatList data={seasonEpisodes} keyExtractor={e => e.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal:16, paddingBottom:20 }}
            renderItem={({ item }) => {
              const isP = currentEpisode?.id === item.id;
              return (
                <TouchableOpacity onPress={() => playEpisode(item)}
                  style={[S.epCard, isP && S.epCardOn]} activeOpacity={0.8}>
                  {isP ? <LinearGradient colors={['rgba(0,255,178,0.16)','rgba(0,255,178,0.04)']} style={[StyleSheet.absoluteFill,{borderRadius:12}]} /> : <GlassLayer borderRadius={12} alpha={0.07} />}
                  {item.thumbnail_url ? (
                    <ImageBackground source={{ uri: item.thumbnail_url }} style={S.epThumb} imageStyle={{ borderRadius:8 }}>
                      <LinearGradient colors={['rgba(0,0,0,0)','rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
                      {isP && <View style={S.epPlay}><Text style={{ color:BG, fontSize:14 }}>▶</Text></View>}
                    </ImageBackground>
                  ) : (
                    <View style={[S.epThumb,{backgroundColor:'rgba(255,255,255,0.09)',borderRadius:8,alignItems:'center',justifyContent:'center'}]}>
                      <Text style={{ color: isP ? ACCENT : 'rgba(255,255,255,0.45)', fontSize:16 }}>{isP ? '▶' : `E${item.episode_number}`}</Text>
                    </View>
                  )}
                  <View style={S.epInfo}>
                    <Text style={[S.epNum, isP && { color: ACCENT }]}>Episode {item.episode_number}</Text>
                    <Text style={S.epTitle} numberOfLines={1}>{item.title}</Text>
                    {item.duration && <Text style={S.epDur}>{item.duration}</Text>}
                  </View>
                  {isP && <View style={S.epBar}><LinearGradient colors={[ACCENT,ACCENT_DIM]} style={[StyleSheet.absoluteFill,{borderRadius:2}]} /></View>}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </SlidePanel>

      {/* ═════════════════════════ CAPTION PANEL ═══════════════════════════ */}
      <SlidePanel visible={capOpen} onClose={() => setCapOpen(false)}>
        <View style={S.panelContent}>
          <View style={S.panelHead}>
            <Text style={S.panelTitle}>Subtitles & Captions</Text>
            <TouchableOpacity onPress={() => setCapOpen(false)} style={S.panelX}>
              <GlassLayer borderRadius={16} alpha={0.12} /><Icon name="x" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          {MOCK_CAPTIONS.map(cap => {
            const on = selCaption?.id === cap.id;
            return (
              <TouchableOpacity key={cap.id}
                onPress={() => { setSelCaption(cap); setCaptionsOn(cap.language !== null); setCapOpen(false); }}
                style={[S.optRow, on && S.optRowOn]} activeOpacity={0.8}>
                {on && <LinearGradient colors={['rgba(0,255,178,0.18)','rgba(0,255,178,0.04)']} style={[StyleSheet.absoluteFill,{borderRadius:12}]} />}
                <GlassLayer borderRadius={12} alpha={on ? 0 : 0.08} />
                {on && <View style={S.optDot}><LinearGradient colors={[ACCENT,ACCENT_DIM]} style={[StyleSheet.absoluteFill,{borderRadius:5}]} /></View>}
                <Text style={[S.optTxt, on && S.optTxtOn]}>{cap.label}</Text>
                {on && <Icon name="check" size={14} color={ACCENT} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </SlidePanel>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex:1, backgroundColor:'#000' },

  // Netflix loader
  loaderOverlay: { ...StyleSheet.absoluteFillObject, zIndex:500, alignItems:'center', justifyContent:'center' },
  loaderRing: {
    width:44, height:44, borderRadius:22,
    borderWidth:3,
    borderColor:'transparent',
    borderTopColor:'#ffffff',
    borderRightColor:'rgba(255,255,255,0.22)',
  },

  // gesture zones
  gZone: { position:'absolute', top:0, zIndex:10 },

  // volume/brightness indicator
  gIndicator: { position:'absolute', top:'18%', width:44, paddingVertical:14, borderRadius:28, alignItems:'center', overflow:'hidden', zIndex:150, gap:6 },
  gIndicatorLeft:  { left:12 },
  gIndicatorRight: { right:12 },
  gIndicatorBg: { backgroundColor:'rgba(14,14,14,0.82)', borderRadius:28 },
  gIndicatorBorder: { borderRadius:28, borderWidth:1, borderColor:'rgba(255,255,255,0.16)' },
  gTrack: { width:4, height:78, borderRadius:2, backgroundColor:'rgba(255,255,255,0.18)', overflow:'hidden', justifyContent:'flex-end' },
  gFill:  { width:'100%', borderRadius:2 },
  gLabel: { fontSize:10, fontWeight:'800', marginTop:2 },

  // seek flash
  seekFlash: { position:'absolute', top:'28%', width:90, height:90, borderRadius:45, alignItems:'center', justifyContent:'center', overflow:'hidden', zIndex:200, gap:3 },
  sfLeft:  { left:'6%' },
  sfRight: { right:'6%' },
  sfTxt:   { color:'#fff', fontSize:12, fontWeight:'800' },

  // top bar
  topBar: { position:'absolute', top:0, left:0, right:0, flexDirection:'row', alignItems:'center', paddingHorizontal:16, gap:12, zIndex:50 },
  topBtn: { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center', overflow:'hidden', borderWidth:1, borderColor:GB, flexShrink:0 },
  topMid: { flex:1, alignItems:'center' },
  topTitle: { color:'#fff', fontSize:15, fontWeight:'700', letterSpacing:0.3, textAlign:'center', textShadowColor:'rgba(0,0,0,0.85)', textShadowOffset:{width:0,height:1}, textShadowRadius:6 },
  topSub:   { color:'rgba(255,255,255,0.50)', fontSize:11, fontWeight:'500', textAlign:'center', marginTop:2 },

  // center
  centerRow: { position:'absolute', top:0, left:0, right:0, bottom:0, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:44, zIndex:50 },
  sidBtn: { width:56, height:56, borderRadius:28, alignItems:'center', justifyContent:'center', overflow:'hidden', borderWidth:1, borderColor:GB, gap:2 },
  sidBtnTxt: { color:'rgba(255,255,255,0.90)', fontSize:10, fontWeight:'800' },
  playBtn: { width:88, height:88, borderRadius:44, alignItems:'center', justifyContent:'center', overflow:'hidden', borderWidth:2, borderColor:'rgba(255,255,255,0.42)', shadowColor:'#fff', shadowOpacity:0.20, shadowRadius:20, elevation:20 },

  // bottom
  bottomBar: { position:'absolute', bottom:0, left:0, right:0, paddingHorizontal:16, zIndex:50 },
  progWrap:  { height:28, justifyContent:'center', marginBottom:6 },
  progTrack: { height:4, backgroundColor:'rgba(255,255,255,0.20)', borderRadius:2, overflow:'visible' },
  progBuf:   { position:'absolute', left:0, top:0, bottom:0, backgroundColor:'rgba(255,255,255,0.18)', borderRadius:2 },
  progFill:  { position:'absolute', left:0, top:0, bottom:0, backgroundColor:RED, borderRadius:2, shadowColor:RED, shadowOpacity:0.60, shadowRadius:4 },
  thumb:     { position:'absolute', top:-7, width:16, height:16, borderRadius:8 },
  thumbInner:{ ...StyleSheet.absoluteFillObject, borderRadius:8, backgroundColor:'#fff' },
  thumbGlow: { position:'absolute', top:-5, left:-5, right:-5, bottom:-5, borderRadius:13, backgroundColor:'rgba(229,9,20,0.28)' },
  iconRow:   { flexDirection:'row', alignItems:'center', marginBottom:2 },
  iconLeft:  { width:110, flexDirection:'row', alignItems:'center' },
  timeLeft:  { flex:1, textAlign:'center', color:'rgba(255,255,255,0.88)', fontSize:13, fontWeight:'700', textShadowColor:'rgba(0,0,0,0.8)', textShadowOffset:{width:0,height:1}, textShadowRadius:4 },
  iconRight: { width:170, flexDirection:'row', alignItems:'center', justifyContent:'flex-end', gap:8 },
  iconBtn:   { height:32, paddingHorizontal:10, borderRadius:16, flexDirection:'row', alignItems:'center', justifyContent:'center', overflow:'hidden', borderWidth:1, borderColor:GB, gap:4 },
  iconBtnOn: { borderColor:'rgba(0,255,178,0.40)' },
  iconBtnTxt:{ color:'rgba(255,255,255,0.85)', fontSize:10, fontWeight:'700' },

  // unlock
  unlockWrap: { position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center', zIndex:400 },
  unlockBtn:  { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:28, paddingVertical:14, borderRadius:26, overflow:'hidden' },
  unlockTxt:  { color:'#fff', fontSize:15, fontWeight:'700', letterSpacing:0.3 },

  // captions
  capWrap: { position:'absolute', alignItems:'center', justifyContent:'center', overflow:'hidden', borderRadius:5, paddingHorizontal:12, paddingVertical:6, zIndex:100 },
  capTxt:  { color:'#fff', fontSize:15, fontWeight:'600', textAlign:'center', lineHeight:22, textShadowColor:'rgba(0,0,0,0.95)', textShadowOffset:{width:0,height:1}, textShadowRadius:4 },

  // panel
  panel:    { position:'absolute', top:0, right:0, bottom:0, width:290, overflow:'hidden', borderLeftWidth:1, borderLeftColor:GB },
  panelLine:{ position:'absolute', top:0, left:0, right:0, height:1.5 },
  panelContent: { flex:1, paddingTop:18 },
  panelHead: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, marginBottom:16 },
  panelTitle:{ flex:1, color:'#fff', fontSize:15, fontWeight:'800', letterSpacing:0.2 },
  panelX:    { width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center', overflow:'hidden', borderWidth:1, borderColor:GB },
  seaTab:    { paddingHorizontal:14, paddingVertical:7, borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:GB },
  seaTabOn:  { borderColor:ACCENT, shadowColor:ACCENT, shadowOpacity:0.26, shadowRadius:6, elevation:4 },
  seaTabTxt: { color:'rgba(255,255,255,0.65)', fontSize:12, fontWeight:'700' },
  optRow:    { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:16, paddingVertical:13, marginHorizontal:12, marginBottom:6, borderRadius:12, overflow:'hidden', borderWidth:1, borderColor:GB },
  optRowOn:  { borderColor:'rgba(0,255,178,0.36)', shadowColor:ACCENT, shadowOpacity:0.16, shadowRadius:8, elevation:4 },
  optDot:    { width:10, height:10, borderRadius:5, overflow:'hidden', shadowColor:ACCENT, shadowOpacity:0.8, shadowRadius:4 },
  optTxt:    { flex:1, color:'rgba(255,255,255,0.62)', fontSize:14, fontWeight:'600' },
  optTxtOn:  { color:ACCENT, fontWeight:'800' },
  epCard:    { flexDirection:'row', alignItems:'center', gap:10, padding:10, marginBottom:8, borderRadius:12, overflow:'hidden', borderWidth:1, borderColor:GB },
  epCardOn:  { borderColor:'rgba(0,255,178,0.36)' },
  epThumb:   { width:92, height:58, borderRadius:8 },
  epPlay:    { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(0,255,178,0.22)', borderRadius:8 },
  epInfo:    { flex:1 },
  epNum:     { color:'rgba(255,255,255,0.42)', fontSize:10, fontWeight:'700', marginBottom:2 },
  epTitle:   { color:'#fff', fontSize:12, fontWeight:'700', marginBottom:2 },
  epDur:     { color:'rgba(255,255,255,0.38)', fontSize:10 },
  epBar:     { position:'absolute', left:0, top:0, bottom:0, width:3, borderRadius:2, overflow:'hidden' },
});
