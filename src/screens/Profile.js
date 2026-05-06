// src/screens/ProfileScreen.js
// ─── Production-Level Profile Screen ─────────────────────────────────────────
// Mimics Netflix/Hotstar patterns • 3D Hyped Glass Style • Fully Responsive

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
  Dimensions, StatusBar, Platform, ActivityIndicator, Modal,
  TextInput, Image, FlatList, RefreshControl, Alert,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { useAppContext } from '../context/AppContext';
import {
  fetchMyProfile,
  updateProfile,
  uploadAvatar,
  fetchMyRatedMovies,
  fetchMyWatchlist,
  fetchMyContinueWatching,
  fetchMyStats,
} from '../lib/supabase';

// ─── Try to import optional libs ─────────────────────────────────────────────
let launchImageLibrary;
try { ({ launchImageLibrary } = require('react-native-image-picker')); } catch { }

const { width: W, height: H } = Dimensions.get('window');

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          '#04080f',
  bgMid:       '#060d1c',
  bgCard:      'rgba(8,18,42,0.80)',
  bgCardDark:  'rgba(4,10,26,0.92)',
  border:      'rgba(0,255,198,0.14)',
  borderGlow:  'rgba(0,255,198,0.45)',
  borderSub:   'rgba(255,255,255,0.07)',
  accent:      '#00ffc6',
  accentDim:   'rgba(0,255,198,0.12)',
  accentMid:   'rgba(0,255,198,0.28)',
  accentGlow:  'rgba(0,255,198,0.06)',
  purple:      '#8b5cf6',
  purpleDim:   'rgba(139,92,246,0.15)',
  gold:        '#f59e0b',
  goldDim:     'rgba(245,158,11,0.15)',
  white:       '#ffffff',
  offWhite:    '#dce8f8',
  grey:        '#6b7fa0',
  greyLight:   '#9aafc8',
  danger:      '#ff4370',
  dangerDim:   'rgba(255,67,112,0.14)',
  s1:          'rgba(255,255,255,0.02)',
  s2:          'rgba(255,255,255,0.07)',
};

// ─── Mock fallback data ───────────────────────────────────────────────────────
const MOCK_PROFILE = {
  user_id: 'mock', display_name: 'Elias Thorne', unique_id: 'elias.void',
  avatar_url: null, is_online: true,
  bio: 'Sci-Fi enthusiast. Top 0.5% viewer.',
  subscription_tier: 'PRO',
};
const MOCK_STATS = { followers: 12800, following: 842, watch_time_hours: 2450, rating_count: 48, watchlist_count: 34 };
const MOCK_GENRES = ['Sci-Fi Epic', 'Techno-Thriller', 'Cyber-Noir', 'Psychological'];
const MOCK_RANK = { label: 'Master Explorer', subtitle: 'Top 0.5% of Viewers', icon: '⭐' };

const GENRE_ICONS = {
  'Sci-Fi Epic': '🚀', 'Techno-Thriller': '💻', 'Cyber-Noir': '🌆',
  'Psychological': '🧠', 'Action': '⚡', 'Drama': '🎭',
  'Horror': '👁', 'Comedy': '😄', 'Romance': '💫', 'Documentary': '🎬',
};

// ─── Rank tiers ───────────────────────────────────────────────────────────────
const getRank = (watchHours) => {
  if (watchHours >= 2000) return { label: 'Master Explorer', subtitle: 'Top 0.5% of Viewers', icon: '⭐', color: C.gold };
  if (watchHours >= 1000) return { label: 'Void Walker', subtitle: 'Top 2% of Viewers', icon: '🌌', color: C.purple };
  if (watchHours >= 500)  return { label: 'Star Gazer', subtitle: 'Top 10% of Viewers', icon: '✨', color: C.accent };
  return { label: 'Explorer', subtitle: 'Keep watching!', icon: '🔭', color: C.grey };
};

const fmtNum = (n) => {
  if (!n && n !== 0) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};

// ─── Shimmer ─────────────────────────────────────────────────────────────────
const Shimmer = ({ width, height, borderRadius = 10, style }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [C.s1, C.s2] });
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: bg }, style]} />;
};

// ─── GlassCard ───────────────────────────────────────────────────────────────
const GlassCard = ({ children, style, glowColor, onPress, noPad }) => {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} activeOpacity={0.85} style={[styles.glassCard, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)', 'rgba(0,0,0,0.0)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill} borderRadius={20}
      />
      {glowColor && <View style={[styles.cardTopGlow, { backgroundColor: glowColor }]} />}
      <View style={noPad ? {} : { padding: 18 }}>{children}</View>
    </Wrap>
  );
};

// ─── Movie Card (horizontal) ──────────────────────────────────────────────────
const MovieCard = ({ item, onPress, showProgress }) => {
  const [imgErr, setImgErr] = useState(false);
  const progress = showProgress && item.progress ? item.progress : 0;
  return (
    <TouchableOpacity style={styles.movieCard} onPress={() => onPress?.(item)} activeOpacity={0.88}>
      <View style={styles.movieCardInner}>
        {item.poster && !imgErr ? (
          <Image source={{ uri: item.poster }} style={styles.moviePoster} onError={() => setImgErr(true)} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#0a1828', '#060e1c']} style={styles.moviePoster}>
            <Text style={{ fontSize: 28, textAlign: 'center' }}>🎬</Text>
          </LinearGradient>
        )}
        {/* Gradient overlay */}
        <LinearGradient colors={['transparent', 'rgba(4,8,15,0.95)']} style={styles.movieOverlay} />
        {showProgress && progress > 0 && (
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBarFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
          </View>
        )}
        {item.rating && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{'★'.repeat(item.rating)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.movieCardTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
      {showProgress && item.remaining && (
        <Text style={styles.movieCardMeta}>{item.remaining} left</Text>
      )}
    </TouchableOpacity>
  );
};

// ─── Section Row (horizontal scroll) ─────────────────────────────────────────
const HSection = ({ title, data, loading, onSeeAll, onPressItem, showProgress, emptyMsg }) => (
  <View style={styles.hSection}>
    <View style={styles.hSectionHeader}>
      <Text style={styles.hSectionTitle}>{title}</Text>
      {onSeeAll && data?.length > 0 && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAllText}>View All</Text>
        </TouchableOpacity>
      )}
    </View>
    {loading ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 18, gap: 12 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ width: 120 }}>
            <Shimmer width={120} height={172} borderRadius={14} style={{ marginBottom: 8 }} />
            <Shimmer width={90} height={11} borderRadius={5} />
          </View>
        ))}
      </ScrollView>
    ) : !data || data.length === 0 ? (
      <View style={styles.emptySection}>
        <Text style={styles.emptySectionText}>{emptyMsg || 'Nothing here yet'}</Text>
      </View>
    ) : (
      <FlatList
        data={data}
        renderItem={({ item }) => <MovieCard item={item} onPress={onPressItem} showProgress={showProgress} />}
        keyExtractor={i => String(i.id || i.movieId)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: 18, paddingRight: 6, gap: 12 }}
      />
    )}
  </View>
);

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
const EditModal = ({ visible, profile, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [saving, setSaving] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setName(profile?.display_name || '');
      setBio(profile?.bio || '');
      setAvatarUri(profile?.avatar_url || null);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 68, friction: 9 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.88, duration: 160, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
      setTimeout(() => scaleAnim.setValue(0.88), 200);
    }
  }, [visible]);

  const pickImage = async () => {
    if (!launchImageLibrary) {
      Alert.alert('Not available', 'Image picker not installed. Add react-native-image-picker.');
      return;
    }
    launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 }, (res) => {
      if (res.didCancel || res.errorCode) return;
      const asset = res.assets?.[0];
      if (asset?.uri) setAvatarUri(asset.uri);
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name cannot be empty' });
      return;
    }
    setSaving(true);
    try {
      await onSave({ display_name: name.trim(), bio: bio.trim(), avatarLocalUri: avatarUri !== profile?.avatar_url ? avatarUri : null });
      onClose();
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); }}>
          <View style={styles.modalBg}>
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.editModal, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
                <LinearGradient
                  colors={['rgba(0,255,198,0.07)', 'rgba(139,92,246,0.05)', 'rgba(4,10,26,0.98)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill} borderRadius={28}
                />
                <View style={styles.editModalGlowLine} />

                <Text style={styles.editModalTitle}>Edit Profile</Text>

                {/* Avatar */}
                <TouchableOpacity style={styles.editAvatarWrap} onPress={pickImage} activeOpacity={0.8}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.editAvatar} />
                  ) : (
                    <LinearGradient colors={['#0a2018', '#060e18']} style={styles.editAvatar}>
                      <Text style={{ color: C.accent, fontSize: 30, fontWeight: '700' }}>
                        {(name || 'U')[0]?.toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                  <View style={styles.editAvatarOverlay}>
                    <Text style={{ color: C.white, fontSize: 18 }}>📷</Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.editAvatarHint}>Tap to change photo</Text>

                {/* Fields */}
                <View style={styles.editFieldWrap}>
                  <Text style={styles.editLabel}>Display Name</Text>
                  <View style={styles.editInputWrap}>
                    <TextInput
                      style={styles.editInput}
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name..."
                      placeholderTextColor={C.grey}
                      maxLength={40}
                    />
                  </View>
                </View>

                <View style={styles.editFieldWrap}>
                  <Text style={styles.editLabel}>Bio</Text>
                  <View style={[styles.editInputWrap, { height: 80 }]}>
                    <TextInput
                      style={[styles.editInput, { height: 72, textAlignVertical: 'top' }]}
                      value={bio}
                      onChangeText={setBio}
                      placeholder="Tell your story..."
                      placeholderTextColor={C.grey}
                      multiline
                      maxLength={160}
                    />
                  </View>
                  <Text style={styles.charCount}>{bio.length}/160</Text>
                </View>

                {/* Buttons */}
                <View style={styles.editBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
                    <Text style={{ color: C.grey, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color={C.bg} size="small" />
                    ) : (
                      <Text style={{ color: C.bg, fontWeight: '900', fontSize: 14 }}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Stat Tile ────────────────────────────────────────────────────────────────
const StatTile = ({ icon, value, label, color }) => (
  <View style={[styles.statTile]}>
    <LinearGradient
      colors={['rgba(255,255,255,0.04)', 'rgba(0,0,0,0.0)']}
      style={StyleSheet.absoluteFill} borderRadius={18}
    />
    <View style={[styles.statIconWrap, { backgroundColor: `${color}18`, borderColor: `${color}30` }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
    </View>
    <Text style={[styles.statValue, { color: color || C.white }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { session, authReady } = useAppContext();
  const userId = session?.user?.id;

  // ─ Data
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [ratedMovies, setRatedMovies] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);

  // ─ Loading
  const [profileLoading, setProfileLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  // ─ Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.7)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const orbAnim1 = useRef(new Animated.Value(1)).current;
  const orbAnim2 = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authReady) return;
    if (!session) { setProfileLoading(false); return; }
    loadAll();
    startAmbientAnims();
  }, [authReady, session]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadProfile(), loadStats(), loadMovieData()]);
    startEntryAnim();
  }, [userId]);

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const data = await fetchMyProfile(userId);
      setProfile(data || MOCK_PROFILE);
    } catch { setProfile(MOCK_PROFILE); }
    finally { setProfileLoading(false); }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await fetchMyStats(userId);
      setStats(data || MOCK_STATS);
    } catch { setStats(MOCK_STATS); }
    finally { setStatsLoading(false); }
  };

  const loadMovieData = async () => {
    setMoviesLoading(true);
    try {
      const [rated, wl, cw] = await Promise.all([
        fetchMyRatedMovies(userId).catch(() => []),
        fetchMyWatchlist(userId).catch(() => []),
        fetchMyContinueWatching(userId).catch(() => []),
      ]);
      setRatedMovies(rated || []);
      setWatchlist(wl || []);
      setContinueWatching(cw || []);
    } catch { }
    finally { setMoviesLoading(false); }
  };


  // ─────────────────────────────────────────────────────────────────────────
  // Animations
  // ─────────────────────────────────────────────────────────────────────────
  const startEntryAnim = () => {
    Animated.parallel([
      Animated.spring(avatarScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7, delay: 100 }),
      Animated.timing(contentFade, { toValue: 1, duration: 500, useNativeDriver: true, delay: 200 }),
    ]).start();
  };

  const startAmbientAnims = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbAnim1, { toValue: 1.15, duration: 3500, useNativeDriver: true }),
        Animated.timing(orbAnim1, { toValue: 1, duration: 3500, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbAnim2, { toValue: 0.85, duration: 4500, useNativeDriver: true }),
        Animated.timing(orbAnim2, { toValue: 1, duration: 4500, useNativeDriver: true }),
      ])
    ).start();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Save Profile
  // ─────────────────────────────────────────────────────────────────────────
  const handleSaveProfile = async ({ display_name, bio, avatarLocalUri }) => {
    let avatar_url = profile?.avatar_url;
    if (avatarLocalUri) {
      try { avatar_url = await uploadAvatar(userId, avatarLocalUri); }
      catch { Toast.show({ type: 'error', text1: 'Image upload failed' }); }
    }
    await updateProfile(userId, { display_name, bio, avatar_url });
    setProfile(prev => ({ ...prev, display_name, bio, avatar_url }));
    Toast.show({ type: 'success', text1: '✅ Profile updated!' });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Computed
  // ─────────────────────────────────────────────────────────────────────────
  const rank = useMemo(() => getRank(stats?.watch_time_hours || 0), [stats]);
  const topGenres = useMemo(() => profile?.top_genres || MOCK_GENRES, [profile]);
  const avatarUri = profile?.avatar_url;
  const displayName = profile?.display_name || 'Explorer';

  // Parallax avatar scale on scroll
  const avatarParallax = scrollY.interpolate({ inputRange: [0, 150], outputRange: [1, 0.7], extrapolate: 'clamp' });
  const avatarOpacity = scrollY.interpolate({ inputRange: [0, 120], outputRange: [1, 0.3], extrapolate: 'clamp' });

  // ─────────────────────────────────────────────────────────────────────────
  // Not logged in
  // ─────────────────────────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <LinearGradient colors={[C.bg, C.bgMid, C.bg]} style={styles.root}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 20 }}>👤</Text>
          <Text style={{ color: C.white, fontSize: 22, fontWeight: '900', marginBottom: 10 }}>Your Profile</Text>
          <Text style={{ color: C.grey, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            Sign in to access your profile, watchlist, and viewing stats.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: C.accent, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 20, shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 16 }}
            onPress={() => navigation?.navigate('Login')}>
            <Text style={{ color: C.bg, fontWeight: '900', fontSize: 16 }}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <LinearGradient colors={[C.bg, '#070e1f', C.bg]} style={StyleSheet.absoluteFill} />

      {/* Ambient orbs */}
      <Animated.View style={[styles.orb1, { transform: [{ scale: orbAnim1 }] }]} />
      <Animated.View style={[styles.orb2, { transform: [{ scale: orbAnim2 }] }]} />



        {/* ── HERO SECTION ──────────────────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
          {/* Avatar */}
          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: Animated.multiply(avatarScale, avatarParallax) }], opacity: avatarOpacity }]}>
            <LinearGradient
              colors={[C.accentMid, 'rgba(0,255,198,0.05)']}
              style={styles.avatarGlowRing}
            />
            {profileLoading ? (
              <Shimmer width={110} height={110} borderRadius={55} />
            ) : avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#0a2818', '#062012']} style={styles.avatar}>
                <Text style={{ color: C.accent, fontSize: 42, fontWeight: '800' }}>
                  {displayName[0]?.toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            {/* Online indicator */}
            {profile?.is_online && (
              <View style={styles.onlineDot} />
            )}
          </Animated.View>

          {/* Name & badge */}
          <Animated.View style={[styles.heroInfo, { opacity: contentFade }]}>
            {profileLoading ? (
              <>
                <Shimmer width={160} height={26} borderRadius={13} style={{ marginBottom: 10 }} />
                <Shimmer width={100} height={22} borderRadius={11} />
              </>
            ) : (
              <>
                <Text style={styles.displayName}>{displayName}</Text>
                {profile?.unique_id && <Text style={styles.uniqueId}>@{profile.unique_id}</Text>}
                {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
                <View style={styles.tierBadgeRow}>
                  <LinearGradient
                    colors={profile?.subscription_tier === 'PRO' ? ['#f59e0b', '#d97706'] : [C.accentMid, C.accent]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.tierBadge}>
                    <Text style={styles.tierBadgeText}>
                      {profile?.subscription_tier === 'PRO' ? '⚡ PRO MEMBER' : '🌟 FREE TIER'}
                    </Text>
                  </LinearGradient>
                </View>
              </>
            )}

            {/* Edit button */}
            <TouchableOpacity style={styles.editBtn} onPress={() => setShowEdit(true)}>
              <LinearGradient colors={[C.accentDim, 'rgba(0,255,198,0.04)']} style={StyleSheet.absoluteFill} borderRadius={16} />
              <Text style={styles.editBtnText}>✏️  Edit Profile</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Animated.View style={[{ opacity: contentFade }]}>

          {/* ── STATS ROW ──────────────────────────────────────────────── */}
          <View style={styles.statsGrid}>
            {statsLoading ? (
              [0, 1, 2, 3].map(i => <Shimmer key={i} width={(W - 60) / 2} height={100} borderRadius={18} />)
            ) : (
              <>
                <StatTile icon="👥" value={fmtNum(stats?.followers)} label="Followers" color={C.accent} />
                <StatTile icon="➕" value={fmtNum(stats?.following)} label="Following" color={C.purple} />
                <StatTile icon="⏱" value={`${fmtNum(stats?.watch_time_hours)}h`} label="Watch Time" color={C.gold} />
                <StatTile icon="⭐" value={fmtNum(stats?.rating_count)} label="Rated" color="#60a5fa" />
              </>
            )}
          </View>

          {/* ── STREAMING RANK ─────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 18, marginBottom: 16 }}>
            <GlassCard glowColor={rank.color} style={{ borderColor: `${rank.color}30` }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Text style={[styles.sectionTitleInline, { flex: 1 }]}>🏆  Streaming Rank</Text>
              </View>
              <View style={styles.rankRow}>
                {/* Rank ring */}
                <View style={[styles.rankRing, { borderColor: rank.color }]}>
                  <View style={[styles.rankRingInner, { borderColor: `${rank.color}50` }]}>
                    <Text style={{ fontSize: 28 }}>{rank.icon}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 18 }}>
                  <Text style={[styles.rankLabel, { color: rank.color }]}>{rank.label}</Text>
                  <Text style={styles.rankSubtitle}>{rank.subtitle}</Text>
                  {/* Progress to next rank */}
                  <View style={styles.rankProgressWrap}>
                    <View style={[styles.rankProgressFill, {
                      width: `${Math.min(((stats?.watch_time_hours || 0) % 500) / 500 * 100, 100)}%`,
                      backgroundColor: rank.color,
                    }]} />
                  </View>
                  <Text style={styles.rankProgressLabel}>
                    {Math.max(500 - ((stats?.watch_time_hours || 0) % 500), 0)}h to next rank
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* ── TOP GENRES ─────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 18, marginBottom: 16 }}>
            <GlassCard>
              <Text style={styles.sectionTitleInline}>🎯  Top Genres</Text>
              <View style={styles.genreWrap}>
                {topGenres.map((g, i) => (
                  <View key={g} style={[styles.genrePill, i === 0 && styles.genrePillActive]}>
                    {i === 0 && <LinearGradient colors={[C.accentDim, 'rgba(0,255,198,0.06)']} style={StyleSheet.absoluteFill} borderRadius={20} />}
                    <Text style={{ fontSize: 14, marginRight: 6 }}>{GENRE_ICONS[g] || '🎬'}</Text>
                    <Text style={[styles.genrePillText, i === 0 && { color: C.accent }]}>{g}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </View>

          {/* ── QUICK ACTIONS ──────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 18, marginBottom: 16, gap: 10 }}>
            {[
              { icon: '⚙️', label: 'Account Settings', sub: 'Privacy, notifications, security', onPress: () => navigation?.navigate('Settings') },
              { icon: '💎', label: 'Subscription Details', sub: profile?.subscription_tier === 'PRO' ? 'PRO Member · Active' : 'Upgrade to PRO', onPress: () => navigation?.navigate('Subscription') },
              { icon: '🎨', label: 'Appearance', sub: 'Theme, language, display', onPress: () => navigation?.navigate('Appearance') },
            ].map(item => (
              <TouchableOpacity key={item.label} style={styles.actionRow} onPress={item.onPress} activeOpacity={0.82}>
                <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} borderRadius={16} />
                <View style={styles.actionIconWrap}>
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionLabel}>{item.label}</Text>
                  <Text style={styles.actionSub}>{item.sub}</Text>
                </View>
                <Text style={{ color: C.grey, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── CONTINUE WATCHING ──────────────────────────────────────── */}
          <HSection
            title="▶  Continue Watching"
            data={continueWatching}
            loading={moviesLoading}
            showProgress
            onPressItem={(item) => navigation?.navigate('Player', { movieId: item.movieId })}
            emptyMsg="Nothing in progress"
          />

          {/* ── WATCHLIST ──────────────────────────────────────────────── */}
          <HSection
            title="🔖  My Watchlist"
            data={watchlist}
            loading={moviesLoading}
            onSeeAll={() => navigation?.navigate('Watchlist')}
            onPressItem={(item) => navigation?.navigate('MovieDetail', { movieId: item.id })}
            emptyMsg="Add movies to your watchlist"
          />

          {/* ── RATED MOVIES ───────────────────────────────────────────── */}
          <HSection
            title="⭐  Liked & Rated"
            data={ratedMovies}
            loading={moviesLoading}
            onSeeAll={() => navigation?.navigate('Ratings')}
            onPressItem={(item) => navigation?.navigate('MovieDetail', { movieId: item.id })}
            emptyMsg="Rate movies to see them here"
          />

          {/* ── SIGN OUT ───────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 18, marginTop: 8 }}>
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: async () => {
                  try {
                    const { supabase } = require('../lib/supabase');
                    await supabase.auth.signOut();
                    navigation?.reset({ index: 0, routes: [{ name: 'Login' }] });
                  } catch (e) { Toast.show({ type: 'error', text1: 'Sign out failed' }); }
                }},
              ])}
              activeOpacity={0.8}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          {/* App version */}
          <Text style={styles.versionText}>Stream.Void v1.0.0 • Made with 🛸</Text>

        </Animated.View>
      </Animated.ScrollView>

      {/* ── EDIT MODAL ────────────────────────────────────────────────────── */}
      <EditModal
        visible={showEdit}
        profile={profile}
        onClose={() => setShowEdit(false)}
        onSave={handleSaveProfile}
      />

      <Toast
        config={{
          success: ({ text1 }) => (
            <View style={{ backgroundColor: 'rgba(0,255,198,0.1)', borderWidth: 1, borderColor: C.accentMid, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, marginHorizontal: 14 }}>
              <Text style={{ color: C.accent, fontWeight: '700', fontSize: 14 }}>{text1}</Text>
            </View>
          ),
          error: ({ text1 }) => (
            <View style={{ backgroundColor: C.dangerDim, borderWidth: 1, borderColor: C.danger, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, marginHorizontal: 14 }}>
              <Text style={{ color: C.danger, fontWeight: '700', fontSize: 14 }}>{text1}</Text>
            </View>
          ),
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Orbs
  orb1: {
    position: 'absolute', top: '5%', right: '-18%',
    width: W * 0.65, height: W * 0.65, borderRadius: W * 0.325,
    backgroundColor: C.accent, opacity: 0.04,
  },
  orb2: {
    position: 'absolute', top: '20%', left: '-22%',
    width: W * 0.75, height: W * 0.75, borderRadius: W * 0.375,
    backgroundColor: C.purple, opacity: 0.04,
  },

  // Hero
  hero: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 24 },
  avatarWrap: { marginBottom: 20, position: 'relative' },
  avatarGlowRing: {
    position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 70, opacity: 0.5,
  },
  avatar: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 2.5, borderColor: C.accentMid,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  onlineDot: {
    position: 'absolute', bottom: 4, right: 4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.accent, borderWidth: 2.5, borderColor: C.bg,
  },
  heroInfo: { alignItems: 'center', width: '100%' },
  displayName: { color: C.white, fontSize: 26, fontWeight: '900', letterSpacing: 0.3, textAlign: 'center', marginBottom: 4 },
  uniqueId: { color: C.grey, fontSize: 13, marginBottom: 8 },
  bio: { color: C.greyLight, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 12, paddingHorizontal: 12 },
  tierBadgeRow: { marginBottom: 16 },
  tierBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  tierBadgeText: { color: C.bg, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  editBtn: {
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 16,
    borderWidth: 1, borderColor: C.accentMid, overflow: 'hidden',
    shadowColor: C.accent, shadowOpacity: 0.15, shadowRadius: 10,
  },
  editBtnText: { color: C.accent, fontSize: 13, fontWeight: '700' },

  // Stats
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 18, marginBottom: 16,
  },
  statTile: {
    width: (W - 56) / 2, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bgCard, overflow: 'hidden',
    padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8,
  },
  statIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 20, fontWeight: '900', marginBottom: 2 },
  statLabel: { color: C.grey, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Glass card
  glassCard: {
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bgCard, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12,
  },
  cardTopGlow: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 1.5, opacity: 0.6, borderRadius: 1 },

  // Rank
  sectionTitleInline: { color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 16, letterSpacing: 0.2 },
  rankRow: { flexDirection: 'row', alignItems: 'center' },
  rankRing: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
  },
  rankRingInner: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  rankLabel: { fontSize: 17, fontWeight: '900', marginBottom: 3 },
  rankSubtitle: { color: C.grey, fontSize: 12, marginBottom: 10 },
  rankProgressWrap: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  rankProgressFill: { height: 4, borderRadius: 2 },
  rankProgressLabel: { color: C.grey, fontSize: 11 },

  // Genres
  genreWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genrePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden',
  },
  genrePillActive: { borderColor: C.accentMid },
  genrePillText: { color: C.greyLight, fontSize: 13, fontWeight: '600' },

  // Actions
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bgCard, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8,
  },
  actionIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  actionLabel: { color: C.white, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  actionSub: { color: C.grey, fontSize: 12 },

  // Movie sections
  hSection: { marginBottom: 24 },
  hSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, marginBottom: 14,
  },
  hSectionTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  seeAllText: { color: C.accent, fontSize: 13, fontWeight: '600' },
  emptySection: { paddingHorizontal: 18, paddingVertical: 20, alignItems: 'center' },
  emptySectionText: { color: C.grey, fontSize: 13 },

  // Movie card
  movieCard: { width: 120 },
  movieCardInner: { width: 120, height: 172, borderRadius: 14, overflow: 'hidden', marginBottom: 7, backgroundColor: '#0a1525' },
  moviePoster: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  movieOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  progressBarWrap: {
    position: 'absolute', bottom: 5, left: 8, right: 8,
    height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden',
  },
  progressBarFill: { height: 3, backgroundColor: C.accent, borderRadius: 2 },
  ratingBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  ratingBadgeText: { color: C.gold, fontSize: 9 },
  movieCardTitle: { color: C.offWhite, fontSize: 12, fontWeight: '600' },
  movieCardMeta: { color: C.grey, fontSize: 11, marginTop: 2 },

  // Sign out
  signOutBtn: {
    height: 50, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.dangerDim,
    backgroundColor: C.dangerDim, alignItems: 'center', justifyContent: 'center',
  },
  signOutText: { color: C.danger, fontSize: 14, fontWeight: '800' },
  versionText: { color: 'rgba(107,127,160,0.4)', fontSize: 11, textAlign: 'center', marginTop: 16, marginBottom: 8 },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  editModal: {
    width: '100%', borderRadius: 28, borderWidth: 1.5, borderColor: C.border,
    overflow: 'hidden', padding: 24,
    shadowColor: C.accent, shadowOpacity: 0.2, shadowRadius: 30,
  },
  editModalGlowLine: { position: 'absolute', top: 0, left: '25%', right: '25%', height: 2, backgroundColor: C.accent, opacity: 0.55, borderRadius: 1 },
  editModalTitle: { color: C.white, fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  editAvatarWrap: { alignSelf: 'center', marginBottom: 6, position: 'relative' },
  editAvatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: C.accentMid, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  editAvatarOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
  editAvatarHint: { color: C.grey, fontSize: 12, textAlign: 'center', marginBottom: 20 },
  editFieldWrap: { marginBottom: 16 },
  editLabel: { color: C.greyLight, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  editInputWrap: {
    height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden',
    paddingHorizontal: 14, justifyContent: 'center',
  },
  editInput: { color: C.white, fontSize: 15, flex: 1 },
  charCount: { color: C.grey, fontSize: 11, textAlign: 'right', marginTop: 4 },
  editBtnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  saveBtn: {
    flex: 2, height: 48, borderRadius: 16,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.accent, shadowOpacity: 0.45, shadowRadius: 12,
    elevation: 8,
  },
});
