// src/screens/Friends.js
// ─── Production-level Friends Screen ─────────────────────────────────────────

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, Keyboard, Animated, Dimensions, ScrollView,
  StatusBar, Platform, ActivityIndicator, RefreshControl, Modal,
  KeyboardAvoidingView, Image, Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { useAppContext } from '../context/AppContext';
import {
  searchUsers,
  fetchSearchHistory,
  saveSearchHistory,
  removeSearchHistoryItem,
  clearSearchHistory,
  fetchPendingRequests,
  fetchConnectedFriends,
  fetchAllProfiles,
  acceptFriendRequest,
  rejectFriendRequest,
  sendFriendRequest,
  cancelFriendRequest,
  subscribeToFriendships,
  getSentRequestIds,
} from '../lib/supabase';

const { width: W, height: H } = Dimensions.get('window');
const CARD_W = W * 0.70;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:         '#060c18',
  bgDeep:     '#040910',
  card:       'rgba(8,20,46,0.78)',
  cardDark:   'rgba(4,12,30,0.92)',
  border:     'rgba(0,255,198,0.15)',
  borderGlow: 'rgba(0,255,198,0.5)',
  accent:     '#00ffc6',
  accentDim:  'rgba(0,255,198,0.12)',
  accentMid:  'rgba(0,255,198,0.30)',
  purple:     '#7c6cff',
  purpleDim:  'rgba(124,108,255,0.15)',
  white:      '#ffffff',
  offWhite:   '#e8f0fe',
  grey:       '#7a8fad',
  greyLight:  '#a8bcd4',
  online:     '#00ffc6',
  offline:    '#2e3f5c',
  danger:     '#ff4370',
  dangerDim:  'rgba(255,67,112,0.15)',
  warn:       '#ffb830',
  s1: 'rgba(255,255,255,0.02)',
  s2: 'rgba(255,255,255,0.08)',
};

// ─── Mock data fallback (shown when DB is empty / for dev preview) ─────────────
const MOCK_REQUESTS = [
  { id: 'm1', requester_id: 'u1', requester: { user_id: 'u1', display_name: 'Lyra Vance', unique_id: 'lyra.v', avatar_url: null, is_online: true } },
  { id: 'm2', requester_id: 'u2', requester: { user_id: 'u2', display_name: 'Soren K.', unique_id: 'sorenk', avatar_url: null, is_online: false } },
];

const MOCK_FRIENDS = [
  { user_id: 'f1', display_name: 'Anya Jax', unique_id: 'anyajax', avatar_url: null, is_online: true, last_seen: null },
  { user_id: 'f2', display_name: 'Mira Chen', unique_id: 'mirachen', avatar_url: null, is_online: false, last_seen: new Date(Date.now() - 18000000).toISOString() },
  { user_id: 'f3', display_name: 'Jaxson R.', unique_id: 'jaxr', avatar_url: null, is_online: true, last_seen: null },
];

const MOCK_PROFILES = [
  { user_id: 'p1', display_name: 'Nova Skye', unique_id: 'nova.skye', avatar_url: null, is_online: true },
  { user_id: 'p2', display_name: 'Atlas Moon', unique_id: 'atlasmoon', avatar_url: null, is_online: false },
  { user_id: 'p3', display_name: 'Zara Vex', unique_id: 'zaravex', avatar_url: null, is_online: true },
  { user_id: 'p4', display_name: 'Orion Flux', unique_id: 'orionflux', avatar_url: null, is_online: false },
  { user_id: 'p5', display_name: 'Cleo Dark', unique_id: 'cleodark', avatar_url: null, is_online: true },
  { user_id: 'p6', display_name: 'Remy Volt', unique_id: 'remyvolt', avatar_url: null, is_online: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────
const relTime = (ts) => {
  if (!ts) return 'a while ago';
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

// ─────────────────────────────────────────────────────────────────────────────
// Shimmer
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = ({ width, height, borderRadius = 8, style }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [C.s1, C.s2] });
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: bg }, style]} />;
};

// ─────────────────────────────────────────────────────────────────────────────
// Avatar with animated pulse ring for online users
// ─────────────────────────────────────────────────────────────────────────────
const Avatar = ({ uri, name, size = 48, online, style }) => {
  const [imgErr, setImgErr] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!online) return;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.22, duration: 1000, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [online]);

  const bgColors = online ? ['#0a2818', '#062014'] : ['#0c1428', '#080e1e'];

  return (
    <View style={[{ width: size, height: size }, style]}>
      {online && (
        <Animated.View style={{
          position: 'absolute', top: -6, left: -6,
          width: size + 12, height: size + 12,
          borderRadius: (size + 12) / 2,
          borderWidth: 2, borderColor: C.accent,
          transform: [{ scale: pulse }], opacity: pulseOpacity,
        }} />
      )}
      <View style={{
        width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
        borderWidth: online ? 2 : 1.5,
        borderColor: online ? C.accent : C.border,
      }}>
        {uri && !imgErr ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size }}
            onError={() => setImgErr(true)}
          />
        ) : (
          <LinearGradient colors={bgColors} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: online ? C.accent : C.grey, fontSize: size * 0.35, fontWeight: '700' }}>
              {initials(name)}
            </Text>
          </LinearGradient>
        )}
      </View>
      <View style={{
        position: 'absolute', bottom: 1, right: 1,
        width: size * 0.24, height: size * 0.24,
        borderRadius: size * 0.12,
        backgroundColor: online ? C.online : C.offline,
        borderWidth: 1.5, borderColor: C.bgDeep,
      }} />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shimmers
// ─────────────────────────────────────────────────────────────────────────────
const RequestShimmer = () => (
  <View style={[S.reqCard, { width: CARD_W, marginRight: 12, alignItems: 'center' }]}>
    <Shimmer width={64} height={64} borderRadius={32} style={{ marginBottom: 12 }} />
    <Shimmer width={110} height={14} borderRadius={7} style={{ marginBottom: 8 }} />
    <Shimmer width={75} height={11} borderRadius={5} style={{ marginBottom: 18 }} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Shimmer width={90} height={36} borderRadius={18} />
      <Shimmer width={90} height={36} borderRadius={18} />
    </View>
  </View>
);

const FriendShimmer = () => (
  <View style={[S.friendRow, { marginBottom: 10, borderColor: 'transparent' }]}>
    <Shimmer width={50} height={50} borderRadius={25} style={{ marginRight: 14 }} />
    <View style={{ flex: 1 }}>
      <Shimmer width={130} height={13} borderRadius={6} style={{ marginBottom: 8 }} />
      <Shimmer width={80} height={11} borderRadius={5} />
    </View>
  </View>
);

const GridShimmer = () => (
  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
    {[0, 1].map(i => (
      <View key={i} style={[S.circleCard, { alignItems: 'center', justifyContent: 'center' }]}>
        <Shimmer width={58} height={58} borderRadius={29} style={{ marginBottom: 10 }} />
        <Shimmer width={80} height={13} borderRadius={6} style={{ marginBottom: 6 }} />
        <Shimmer width={55} height={11} borderRadius={5} style={{ marginBottom: 14 }} />
        <Shimmer width={90} height={34} borderRadius={10} />
      </View>
    ))}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Profile Modal
// ─────────────────────────────────────────────────────────────────────────────
const ProfileModal = ({ visible, profile, onClose, onAction, isFriend, requestSent, actionLoading }) => {
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 70, friction: 9 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.86, duration: 160, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
      setTimeout(() => { scale.setValue(0.82); }, 200);
    }
  }, [visible]);

  if (!profile) return null;

  const btnLabel = isFriend ? 'Message' : requestSent ? 'Cancel Request' : 'Follow';
  const btnColor = requestSent ? C.danger : C.accent;
  const btnBg = requestSent ? C.dangerDim : C.accentDim;
  const btnBorder = requestSent ? C.danger : C.accent;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={S.modalBg}>
          <TouchableWithoutFeedback>
            <Animated.View style={[S.profileModal, { transform: [{ scale }], opacity }]}>
              <LinearGradient
                colors={['rgba(0,255,198,0.06)', 'rgba(124,108,255,0.05)', 'rgba(4,12,30,0.98)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Glow top line */}
              <View style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, backgroundColor: C.accent, opacity: 0.6, borderRadius: 1 }} />

              <Avatar uri={profile.avatar_url} name={profile.display_name} size={84} online={profile.is_online} style={{ alignSelf: 'center', marginTop: 28, marginBottom: 16 }} />
              <Text style={S.modalName}>{profile.display_name || 'User'}</Text>
              {profile.unique_id && <Text style={S.modalHandle}>@{profile.unique_id}</Text>}

              <View style={[S.modalStatusPill, { backgroundColor: profile.is_online ? 'rgba(0,255,198,0.1)' : 'rgba(46,63,92,0.4)', borderColor: profile.is_online ? C.accentMid : C.border }]}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: profile.is_online ? C.online : C.offline, marginRight: 6 }} />
                <Text style={{ color: profile.is_online ? C.accent : C.grey, fontSize: 12, fontWeight: '600' }}>
                  {profile.is_online ? 'Online now' : `Last seen ${relTime(profile.last_seen)}`}
                </Text>
              </View>

              <View style={{ width: '75%', height: 1, backgroundColor: C.border, marginVertical: 20 }} />

              <TouchableOpacity
                style={[S.modalActionBtn, { backgroundColor: btnBg, borderColor: btnBorder }]}
                onPress={onAction}
                disabled={actionLoading}>
                {actionLoading
                  ? <ActivityIndicator color={btnColor} size="small" />
                  : <Text style={{ color: btnColor, fontSize: 15, fontWeight: '800' }}>{btnLabel}</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={{ paddingVertical: 10, marginTop: 4 }}>
                <Text style={{ color: C.grey, fontSize: 13 }}>Dismiss</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Connect Sheet (See All + Explore People)
// ─────────────────────────────────────────────────────────────────────────────
const ConnectSheet = ({ visible, onClose, currentUserId, sentIds, onSentChange }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState('');
  const [pendingMap, setPendingMap] = useState({});
  const [actionMap, setActionMap] = useState({});
  const translateY = useRef(new Animated.Value(H)).current;
  const debounce = useRef(null);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (visible) {
      setPendingMap(sentIds || {});
      reset();
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 58, friction: 9 }).start();
    } else {
      Animated.timing(translateY, { toValue: H, duration: 280, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start();
    }
  }, [visible]);

  const reset = () => { setProfiles([]); setPage(0); setHasMore(true); load(0, '', true); };

  const load = async (p, q = query, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      let data;
      try {
        const res = await searchUsers({ query: q, page: p, pageSize: PAGE_SIZE });
        data = res.data || [];
      } catch {
        data = MOCK_PROFILES;
      }
      if (reset || p === 0) setProfiles(data);
      else setProfiles(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setPage(p + 1);
    } finally { setLoading(false); }
  };

  const handleSearch = (text) => {
    setQuery(text);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(0, text, true), 320);
  };

  const handleFollow = async (uid) => {
    if (!currentUserId) return;
    const sent = pendingMap[uid];
    setActionMap(p => ({ ...p, [uid]: true }));
    try {
      if (sent) {
        await cancelFriendRequest(currentUserId, uid);
        const next = { ...pendingMap }; delete next[uid];
        setPendingMap(next);
        onSentChange && onSentChange(next);
        Toast.show({ type: 'info', text1: 'Request cancelled' });
      } else {
        await sendFriendRequest(currentUserId, uid);
        const next = { ...pendingMap, [uid]: true };
        setPendingMap(next);
        onSentChange && onSentChange(next);
        Toast.show({ type: 'success', text1: '🚀 Request sent!' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message || 'Failed. Try again.' });
    } finally {
      setActionMap(p => { const n = { ...p }; delete n[uid]; return n; });
    }
  };

  const renderUser = ({ item }) => {
    const sent = pendingMap[item.user_id];
    const acting = actionMap[item.user_id];
    return (
      <View style={S.exploreCard}>
        <LinearGradient
          colors={['rgba(0,255,198,0.05)', 'rgba(4,12,30,0.95)']}
          style={StyleSheet.absoluteFill} borderRadius={20}
        />
        {item.is_online && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: C.accent, opacity: 0.4, borderRadius: 1 }} />}
        <Avatar uri={item.avatar_url} name={item.display_name} size={54} online={item.is_online} style={{ marginBottom: 10 }} />
        <Text style={S.exploreCardName} numberOfLines={1}>{item.display_name || 'User'}</Text>
        <Text style={S.exploreCardHandle} numberOfLines={1}>@{item.unique_id || 'unknown'}</Text>
        <TouchableOpacity
          style={[S.followBtn, sent ? S.followBtnCancel : S.followBtnFollow]}
          onPress={() => handleFollow(item.user_id)}
          disabled={acting}>
          {acting
            ? <ActivityIndicator size="small" color={sent ? C.danger : C.bg} />
            : <Text style={[S.followBtnText, sent && { color: C.danger }]}>{sent ? 'Cancel' : 'Follow'}</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      </TouchableWithoutFeedback>
      <Animated.View style={[S.sheet, { transform: [{ translateY }] }]}>
        <LinearGradient colors={['#091525', C.bgDeep]} style={StyleSheet.absoluteFill} />
        <View style={S.sheetHandle} />
        <View style={S.sheetHeader}>
          <Text style={S.sheetTitle}>Explore People</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ color: C.accent, fontSize: 15, fontWeight: '700' }}>Done</Text></TouchableOpacity>
        </View>
        {/* Search inside sheet */}
        <View style={S.sheetSearch}>
          <Text style={{ color: C.grey, fontSize: 18, marginRight: 8 }}>⌕</Text>
          <TextInput
            style={{ flex: 1, color: C.white, fontSize: 14 }}
            placeholder="Search by name or @handle..."
            placeholderTextColor={C.grey}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Text style={{ color: C.grey, fontSize: 16 }}>×</Text>
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={profiles}
          renderItem={renderUser}
          keyExtractor={i => i.user_id}
          numColumns={2}
          contentContainerStyle={{ padding: 14, paddingBottom: 50 }}
          columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
          onEndReached={() => !loading && hasMore && load(page)}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <ActivityIndicator color={C.accent} />
            </View>
          ) : null}
          ListEmptyComponent={!loading ? (
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Text style={{ fontSize: 28, marginBottom: 12 }}>🔭</Text>
              <Text style={{ color: C.grey, fontSize: 15 }}>No explorers found</Text>
            </View>
          ) : <GridShimmer />}
        />
      </Animated.View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NOT LOGGED IN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const NotLoggedIn = ({ navigation }) => {
  const orb1Scale = useRef(new Animated.Value(1)).current;
  const orb2Scale = useRef(new Animated.Value(1)).current;
  const orb1Opacity = useRef(new Animated.Value(0.06)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Scale, { toValue: 1.2, duration: 3000, useNativeDriver: true }),
        Animated.timing(orb1Scale, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Scale, { toValue: 0.8, duration: 4000, useNativeDriver: true }),
        Animated.timing(orb2Scale, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient colors={['#04090f', '#060c1a', '#04090f']} style={{ flex: 1 }}>
      {/* Animated background orbs */}
      <Animated.View style={{
        position: 'absolute', top: '8%', right: '-15%',
        width: W * 0.7, height: W * 0.7, borderRadius: W * 0.35,
        backgroundColor: C.accent, opacity: 0.04,
        transform: [{ scale: orb1Scale }],
      }} />
      <Animated.View style={{
        position: 'absolute', bottom: '12%', left: '-20%',
        width: W * 0.8, height: W * 0.8, borderRadius: W * 0.4,
        backgroundColor: C.purple, opacity: 0.05,
        transform: [{ scale: orb2Scale }],
      }} />
      <Animated.View style={{
        position: 'absolute', top: '40%', left: '10%',
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: C.accent, opacity: 0.03,
        transform: [{ scale: orb1Scale }],
      }} />

      <Animated.ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 60 }}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeIn }}>

        {/* Icon badge */}
        <View style={{
          width: 90, height: 90, borderRadius: 45,
          backgroundColor: 'rgba(0,255,198,0.08)',
          borderWidth: 1.5, borderColor: C.accentMid,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 28,
          shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 25,
        }}>
          <Text style={{ fontSize: 38 }}>🛸</Text>
        </View>

        {/* Headline */}
        <Text style={{ color: C.white, fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 10, letterSpacing: 0.2 }}>
          Watch Together,{'\n'}Explore Further
        </Text>
        <Text style={{ color: C.grey, fontSize: 15, textAlign: 'center', lineHeight: 23, marginBottom: 36, paddingHorizontal: 8 }}>
          Connect with friends, see what they're watching in real-time, and share discoveries across the galaxy.
        </Text>

        {/* Feature pills */}
        {['🎬  Watch movies with friends live', '🌐  See who's online right now', '✉️  Message your circle instantly'].map((txt, i) => (
          <View key={i} style={{
            width: '100%', flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 18, paddingVertical: 13,
            borderRadius: 14, borderWidth: 1, borderColor: C.border,
            backgroundColor: 'rgba(255,255,255,0.02)',
            marginBottom: 10,
          }}>
            <Text style={{ color: C.greyLight, fontSize: 14 }}>{txt}</Text>
          </View>
        ))}

        <View style={{ height: 32 }} />

        {/* CTA buttons */}
        <TouchableOpacity
          style={{
            width: '100%', height: 54, borderRadius: 17,
            backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
            shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 5 },
            elevation: 12,
          }}
          onPress={() => navigation?.navigate('Login')}
          activeOpacity={0.85}>
          <Text style={{ color: C.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 }}>Log In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            width: '100%', height: 54, borderRadius: 17,
            borderWidth: 1.5, borderColor: C.border,
            backgroundColor: 'rgba(255,255,255,0.03)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            overflow: 'hidden',
          }}
          onPress={() => navigation?.navigate('Register')}
          activeOpacity={0.85}>
          <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
          <Text style={{ color: C.white, fontSize: 15, fontWeight: '700' }}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ paddingVertical: 10 }} onPress={() => navigation?.navigate('Register')}>
          <Text style={{ color: C.grey, fontSize: 14 }}>
            New here?{' '}
            <Text style={{ color: C.accent, fontWeight: '700' }}>Create Account</Text>
          </Text>
        </TouchableOpacity>

        <Text style={{ color: 'rgba(122,143,173,0.4)', fontSize: 12, marginTop: 20, textAlign: 'center' }}>
          By continuing you agree to our Terms of Service
        </Text>
      </Animated.ScrollView>
    </LinearGradient>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function FriendsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { session, authReady } = useAppContext();
  const currentUserId = session?.user?.id || null;

  // ─ Data state
  const [pendingReqs, setPendingReqs] = useState([]);
  const [friends, setFriends] = useState([]);
  const [sentMap, setSentMap] = useState({});

  // ─ Loading state (separate per section)
  const [pendingLoading, setPendingLoading] = useState(true);
  const [friendsLoading, setFriendsLoading] = useState(true);

  // ─ UI state
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'connect'
  const [refreshing, setRefreshing] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileActionLoading, setProfileActionLoading] = useState(false);

  // ─ Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // ─ Animation refs
  const searchScale = useRef(new Animated.Value(1)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const searchRef = useRef(null);
  const searchDebounce = useRef(null);
  const subscriptionRef = useRef(null);
  const tabAnim = useRef(new Animated.Value(0)).current;

  // ─────────────────────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authReady || !currentUserId) return;
    loadAll();
    loadSearchHistory();
    const sub = subscribeToFriendships(currentUserId, () => loadAll());
    subscriptionRef.current = sub;
    return () => { try { subscriptionRef.current?.unsubscribe(); } catch { } };
  }, [authReady, currentUserId]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadPending(), loadFriends()]);
  }, [currentUserId]);

  const loadPending = async () => {
    setPendingLoading(true);
    try {
      let data;
      try { data = await fetchPendingRequests(currentUserId); }
      catch { data = MOCK_REQUESTS; }
      setPendingReqs(data || []);
    } catch { setPendingReqs(MOCK_REQUESTS); }
    finally { setPendingLoading(false); }
  };

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      let data;
      try { data = await fetchConnectedFriends(currentUserId); }
      catch { data = MOCK_FRIENDS; }
      setFriends(data || []);

      // Load sent request IDs
      try {
        const ids = await getSentRequestIds(currentUserId);
        const map = {};
        (ids || []).forEach(id => { map[id] = true; });
        setSentMap(map);
      } catch { }
    } catch { setFriends(MOCK_FRIENDS); }
    finally { setFriendsLoading(false); }
  };

  const loadSearchHistory = async () => {
    try {
      const h = await fetchSearchHistory();
      setSearchHistory(h || []);
    } catch { }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Search
  // ─────────────────────────────────────────────────────────────────────────
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    clearTimeout(searchDebounce.current);
    if (!text.trim()) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(() => doSearch(text), 340);
  };

  const doSearch = async (q) => {
    if (!q.trim()) return;
    setSearchLoading(true);
    try {
      let data;
      try {
        const res = await searchUsers({ query: q, page: 0, pageSize: 20 });
        data = res.data || [];
      } catch {
        data = MOCK_PROFILES.filter(p =>
          p.display_name.toLowerCase().includes(q.toLowerCase()) ||
          (p.unique_id || '').toLowerCase().includes(q.toLowerCase())
        );
      }
      setSearchResults(data);
    } finally { setSearchLoading(false); }
  };

  const onSearchFocus = () => {
    setSearchFocused(true);
    Animated.parallel([
      Animated.spring(searchScale, { toValue: 1.02, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const onSearchBlur = () => {
    Animated.spring(searchScale, { toValue: 1, useNativeDriver: true }).start();
  };

  const dismissSearch = () => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery('');
    setSearchResults([]);
    Animated.timing(overlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
  };

  const onSelectUser = async (user) => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery('');
    setSearchResults([]);
    Animated.timing(overlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    try { await saveSearchHistory(user); setSearchHistory(await fetchSearchHistory()); } catch { }
    setSelectedProfile({ ...user, isFriend: friends.some(f => f.user_id === user.user_id) });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Accept / Reject
  // ─────────────────────────────────────────────────────────────────────────
  const handleAccept = async (req) => {
    try {
      await acceptFriendRequest(req.id);
      setPendingReqs(prev => prev.filter(r => r.id !== req.id));
      await loadFriends();
      Toast.show({ type: 'success', text1: '🎉 Friend added!' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message || 'Failed to accept' });
    }
  };

  const handleReject = async (req) => {
    try {
      await rejectFriendRequest(req.id);
      setPendingReqs(prev => prev.filter(r => r.id !== req.id));
      Toast.show({ type: 'info', text1: 'Request declined' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message || 'Failed to decline' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Profile modal action
  // ─────────────────────────────────────────────────────────────────────────
  const handleProfileAction = async () => {
    if (!selectedProfile || !currentUserId) return;
    if (selectedProfile.isFriend) {
      setSelectedProfile(null);
      navigation.navigate('Chat', { friend: selectedProfile });
      return;
    }
    const uid = selectedProfile.user_id;
    const sent = sentMap[uid];
    setProfileActionLoading(true);
    try {
      if (sent) {
        await cancelFriendRequest(currentUserId, uid);
        const next = { ...sentMap }; delete next[uid];
        setSentMap(next);
        Toast.show({ type: 'info', text1: 'Request cancelled' });
      } else {
        await sendFriendRequest(currentUserId, uid);
        setSentMap(prev => ({ ...prev, [uid]: true }));
        Toast.show({ type: 'success', text1: '🚀 Request sent!' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message || 'Action failed' });
    } finally {
      setProfileActionLoading(false);
      setSelectedProfile(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Tab switch
  // ─────────────────────────────────────────────────────────────────────────
  const switchTab = (tab) => {
    setActiveTab(tab);
    Animated.timing(tabAnim, {
      toValue: tab === 'friends' ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Computed
  // ─────────────────────────────────────────────────────────────────────────
  const sortedFriends = useMemo(() =>
    [...friends].sort((a, b) => (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0)),
    [friends]
  );
  const onlineCount = sortedFriends.filter(f => f.is_online).length;
  const hasPending = pendingReqs.length > 0;
  const hasFriends = friends.length > 0;
  const onlyConnect = !friendsLoading && !hasFriends;

  // ─────────────────────────────────────────────────────────────────────────
  // Not logged in
  // ─────────────────────────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (!session) {
    return <NotLoggedIn navigation={navigation} />;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Renders
  // ─────────────────────────────────────────────────────────────────────────
  const renderRequestCard = ({ item }) => (
    <View style={[S.reqCard, { width: CARD_W }]}>
      <LinearGradient
        colors={['rgba(0,255,198,0.08)', 'rgba(124,108,255,0.06)', 'rgba(4,12,30,0.97)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill} borderRadius={20}
      />
      <View style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1.5, backgroundColor: C.accent, opacity: 0.5, borderRadius: 1 }} />
      <TouchableOpacity onPress={() => setSelectedProfile({ ...item.requester, isFriend: false })}>
        <Avatar uri={item.requester?.avatar_url} name={item.requester?.display_name} size={66} online={item.requester?.is_online} style={{ alignSelf: 'center', marginBottom: 12 }} />
        <Text style={S.reqName} numberOfLines={1}>{item.requester?.display_name || 'User'}</Text>
        {item.requester?.unique_id && <Text style={S.reqHandle}>@{item.requester.unique_id}</Text>}
        <Text style={S.reqMeta}>Wants to connect with you</Text>
      </TouchableOpacity>
      <View style={S.reqBtns}>
        <TouchableOpacity style={S.acceptBtn} onPress={() => handleAccept(item)}>
          <Text style={S.acceptTxt}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.declineBtn} onPress={() => handleReject(item)}>
          <Text style={S.declineTxt}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriendRow = (friend) => (
    <TouchableOpacity
      key={friend.user_id}
      style={[S.friendRow, friend.is_online && S.friendRowOnline]}
      onPress={() => setSelectedProfile({ ...friend, isFriend: true })}
      activeOpacity={0.88}>
      {friend.is_online && (
        <LinearGradient
          colors={['rgba(0,255,198,0.07)', 'rgba(0,255,198,0.0)']}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill} borderRadius={18}
        />
      )}
      <Avatar uri={friend.avatar_url} name={friend.display_name} size={50} online={friend.is_online} style={{ marginRight: 14 }} />
      <View style={{ flex: 1 }}>
        <Text style={S.friendName}>{friend.display_name || 'User'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: friend.is_online ? C.online : C.offline, marginRight: 5 }} />
          <Text style={{ color: friend.is_online ? C.accent : C.grey, fontSize: 12 }}>
            {friend.is_online ? 'Online now' : relTime(friend.last_seen)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={S.msgBtn}
        onPress={() => navigation.navigate('Chat', { friend })}>
        <Text style={{ fontSize: 17 }}>✉️</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderConnectCard = ({ item }) => {
    const sent = sentMap[item.user_id];
    const isFriend = friends.some(f => f.user_id === item.user_id);
    return (
      <TouchableOpacity
        style={S.circleCard}
        onPress={() => setSelectedProfile({ ...item, isFriend })}
        activeOpacity={0.88}>
        <LinearGradient
          colors={['rgba(255,255,255,0.04)', 'rgba(0,255,198,0.03)', 'rgba(4,12,30,0.96)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill} borderRadius={22}
        />
        {item.is_online && (
          <View style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1.5, backgroundColor: C.accent, opacity: 0.45, borderRadius: 1 }} />
        )}
        <Avatar uri={item.avatar_url} name={item.display_name} size={58} online={item.is_online} style={{ marginBottom: 10 }} />
        <Text style={S.circleName} numberOfLines={1}>{item.display_name || 'User'}</Text>
        <Text style={S.circleHandle} numberOfLines={1}>@{item.unique_id || 'user'}</Text>
        <TouchableOpacity
          style={[S.circleFollowBtn, isFriend ? S.circleFollowFriend : sent ? S.circleFollowCancel : S.circleFollowDefault]}
          onPress={async (e) => {
            e.stopPropagation();
            if (isFriend) return navigation.navigate('Chat', { friend: item });
            const uid = item.user_id;
            try {
              if (sent) {
                await cancelFriendRequest(currentUserId, uid);
                setSentMap(p => { const n = { ...p }; delete n[uid]; return n; });
                Toast.show({ type: 'info', text1: 'Cancelled' });
              } else {
                await sendFriendRequest(currentUserId, uid);
                setSentMap(p => ({ ...p, [uid]: true }));
                Toast.show({ type: 'success', text1: '🚀 Sent!' });
              }
            } catch (err) {
              Toast.show({ type: 'error', text1: err.message || 'Failed' });
            }
          }}>
          <Text style={[S.circleFollowTxt, (sent && !isFriend) && { color: C.danger }, isFriend && { color: C.accent }]}>
            {isFriend ? 'Message' : sent ? 'Cancel' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSearchContent = () => {
    if (searchQuery.trim()) {
      return (
        <View style={S.searchDrop}>
          {searchLoading ? (
            [0, 1, 2].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                <Shimmer width={38} height={38} borderRadius={19} />
                <View>
                  <Shimmer width={120} height={13} borderRadius={6} style={{ marginBottom: 6 }} />
                  <Shimmer width={80} height={11} borderRadius={5} />
                </View>
              </View>
            ))
          ) : searchResults.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginBottom: 8 }}>🔍</Text>
              <Text style={{ color: C.grey, fontSize: 14 }}>No one found for "{searchQuery}"</Text>
            </View>
          ) : (
            searchResults.map(u => (
              <TouchableOpacity key={u.user_id} style={S.searchRow} onPress={() => onSelectUser(u)}>
                <Avatar uri={u.avatar_url} name={u.display_name} size={38} online={u.is_online} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.white, fontSize: 14, fontWeight: '600' }}>{u.display_name}</Text>
                  {u.unique_id && <Text style={{ color: C.grey, fontSize: 12 }}>@{u.unique_id}</Text>}
                </View>
                {u.is_online && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.online }} />}
              </TouchableOpacity>
            ))
          )}
        </View>
      );
    }
    if (searchHistory.length > 0) {
      return (
        <View style={S.searchDrop}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ color: C.greyLight, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>Recent</Text>
            <TouchableOpacity onPress={async () => { await clearSearchHistory(); setSearchHistory([]); }}>
              <Text style={{ color: C.accent, fontSize: 13 }}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {searchHistory.map(h => (
            <View key={h.user_id} style={S.searchRow}>
              <TouchableOpacity style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }} onPress={() => onSelectUser(h)}>
                <Avatar uri={h.avatar_url} name={h.display_name} size={38} online={h.is_online} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.white, fontSize: 14, fontWeight: '600' }}>{h.display_name}</Text>
                  {h.unique_id && <Text style={{ color: C.grey, fontSize: 12 }}>@{h.unique_id}</Text>}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => { await removeSearchHistoryItem(h.user_id); setSearchHistory(await fetchSearchHistory()); }}
                style={{ padding: 8 }}>
                <Text style={{ color: C.grey, fontSize: 18, lineHeight: 18 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }
    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <LinearGradient colors={[C.bgDeep, '#071020', C.bgDeep]} style={{ flex: 1 }}>

        {/* ── SEARCH BAR ────────────────────────────────────────────────── */}
        <View style={[S.searchWrap, { paddingTop: insets.top + 12 }]}>
          <Animated.View style={[S.searchBar, {
            transform: [{ scale: searchScale }],
            borderColor: searchFocused ? C.accent : C.border,
            shadowColor: searchFocused ? C.accent : 'transparent',
          }]}>
            <LinearGradient
              colors={searchFocused
                ? ['rgba(0,255,198,0.09)', 'rgba(8,20,46,0.95)']
                : ['rgba(255,255,255,0.04)', 'rgba(4,12,30,0.95)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill} borderRadius={28}
            />
            <Text style={{ color: searchFocused ? C.accent : C.grey, fontSize: 20, marginRight: 10, lineHeight: 24 }}>⌕</Text>
            <TextInput
              ref={searchRef}
              style={{ flex: 1, color: C.white, fontSize: 15, letterSpacing: 0.2 }}
              placeholder="Find explorers by name or @handle..."
              placeholderTextColor={C.grey}
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }} style={{ padding: 4 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.white, fontSize: 12, lineHeight: 14 }}>×</Text>
                </View>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        {/* ── SEARCH OVERLAY ────────────────────────────────────────────── */}
        {searchFocused && (
          <TouchableWithoutFeedback onPress={dismissSearch}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { zIndex: 50, backgroundColor: 'rgba(4,9,16,0.94)', opacity: overlayAnim }]}>
              <TouchableWithoutFeedback>
                <View style={{ marginTop: insets.top + 74 }}>
                  {renderSearchContent()}
                </View>
              </TouchableWithoutFeedback>
            </Animated.View>
          </TouchableWithoutFeedback>
        )}

        {/* ── MAIN SCROLL ───────────────────────────────────────────────── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await loadAll(); setRefreshing(false); }}
              tintColor={C.accent}
            />
          }>

          {/* ── PENDING REQUESTS (only if loading or has data) ──────────── */}
          {(pendingLoading || hasPending) && (
            <View style={{ marginTop: 20 }}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>Friend Requests</Text>
                {hasPending && (
                  <View style={S.countBadge}>
                    <Text style={{ color: C.accent, fontSize: 12, fontWeight: '800' }}>{pendingReqs.length}</Text>
                  </View>
                )}
              </View>
              {pendingLoading ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 18, gap: 12 }}>
                  <RequestShimmer /><RequestShimmer />
                </ScrollView>
              ) : (
                <FlatList
                  data={pendingReqs}
                  renderItem={renderRequestCard}
                  keyExtractor={i => i.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: 18, paddingRight: 6, gap: 12 }}
                  snapToInterval={CARD_W + 12}
                  decelerationRate="fast"
                />
              )}
            </View>
          )}

          {/* ── TAB BAR ───────────────────────────────────────────────────── */}
          <View style={S.tabWrap}>
            {!onlyConnect && (
              <TouchableOpacity
                style={[S.tabBtn, activeTab === 'friends' && S.tabBtnActive]}
                onPress={() => switchTab('friends')}>
                {activeTab === 'friends' && (
                  <LinearGradient colors={[C.accentDim, 'rgba(0,255,198,0.04)']} style={StyleSheet.absoluteFill} borderRadius={16} />
                )}
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.online, marginRight: 7 }} />
                <Text style={[S.tabTxt, activeTab === 'friends' && S.tabTxtActive]}>
                  {friendsLoading ? 'Friends' : `${onlineCount}/${friends.length} Online`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[S.tabBtn, activeTab === 'connect' && S.tabBtnActive, onlyConnect && { flex: 1 }]}
              onPress={() => switchTab('connect')}>
              {activeTab === 'connect' && (
                <LinearGradient colors={[C.accentDim, 'rgba(0,255,198,0.04)']} style={StyleSheet.absoluteFill} borderRadius={16} />
              )}
              <Text style={[S.tabTxt, activeTab === 'connect' && S.tabTxtActive]}>
                {onlyConnect ? '🌌  Find Explorers' : 'Connect'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── TAB CONTENT ───────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 14, marginTop: 4 }}>

            {activeTab === 'friends' && (
              friendsLoading ? (
                <View style={{ gap: 10 }}>
                  {[0, 1, 2, 3].map(i => <FriendShimmer key={i} />)}
                </View>
              ) : sortedFriends.length === 0 ? (
                // No friends - redirect to connect tab
                <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 10 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🌌</Text>
                  <Text style={{ color: C.white, fontSize: 17, fontWeight: '800', marginBottom: 8 }}>Your galaxy is quiet</Text>
                  <Text style={{ color: C.grey, fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 21 }}>
                    Start following people to build your circle
                  </Text>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20, backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 12 }}
                    onPress={() => switchTab('connect')}>
                    <Text style={{ color: C.bg, fontWeight: '900', fontSize: 14 }}>Explore People</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {/* Online section label */}
                  {onlineCount > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, marginTop: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.online, marginRight: 8 }} />
                      <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                        Active Now · {onlineCount}
                      </Text>
                    </View>
                  )}
                  {sortedFriends.filter(f => f.is_online).map(f => renderFriendRow(f))}

                  {/* Offline section label */}
                  {sortedFriends.filter(f => !f.is_online).length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: C.border, marginRight: 10 }} />
                      <Text style={{ color: C.grey, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>Offline</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: C.border, marginLeft: 10 }} />
                    </View>
                  )}
                  {sortedFriends.filter(f => !f.is_online).map(f => renderFriendRow(f))}
                </View>
              )
            )}

            {activeTab === 'connect' && (
              friendsLoading ? (
                <View style={{ gap: 0 }}>
                  <GridShimmer /><GridShimmer /><GridShimmer />
                </View>
              ) : (
                <FlatList
                  data={[...friends, ...MOCK_PROFILES.filter(p => !friends.some(f => f.user_id === p.user_id))]}
                  renderItem={renderConnectCard}
                  keyExtractor={i => i.user_id}
                  numColumns={2}
                  scrollEnabled={false}
                  columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
                  ListHeaderComponent={() => (
                    <TouchableOpacity
                      style={[S.exploreAllBtn]}
                      onPress={() => setShowConnect(true)}>
                      <LinearGradient colors={[C.accentDim, 'rgba(0,255,198,0.04)']} style={StyleSheet.absoluteFill} borderRadius={16} />
                      <Text style={{ color: C.accent, fontSize: 14, fontWeight: '700' }}>🔭  Explore All People</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingTop: 30 }}>
                      <ActivityIndicator color={C.accent} />
                    </View>
                  }
                />
              )
            )}
          </View>
        </ScrollView>

        {/* ── PROFILE MODAL ─────────────────────────────────────────────── */}
        <ProfileModal
          visible={!!selectedProfile}
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onAction={handleProfileAction}
          isFriend={selectedProfile?.isFriend}
          requestSent={selectedProfile ? !!sentMap[selectedProfile.user_id] : false}
          actionLoading={profileActionLoading}
        />

        {/* ── CONNECT SHEET ─────────────────────────────────────────────── */}
        <ConnectSheet
          visible={showConnect}
          onClose={() => setShowConnect(false)}
          currentUserId={currentUserId}
          sentIds={sentMap}
          onSentChange={setSentMap}
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
            info: ({ text1 }) => (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, marginHorizontal: 14 }}>
                <Text style={{ color: C.greyLight, fontWeight: '600', fontSize: 14 }}>{text1}</Text>
              </View>
            ),
          }}
        />
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Search
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8, zIndex: 20 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, borderRadius: 28, borderWidth: 1.5,
    paddingHorizontal: 16, overflow: 'hidden',
    shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  searchDrop: {
    marginHorizontal: 12,
    backgroundColor: 'rgba(8,20,46,0.97)',
    borderRadius: 18, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', paddingVertical: 4,
    shadowColor: C.accent, shadowOpacity: 0.15, shadowRadius: 20,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 14, gap: 10 },
  sectionTitle: { color: C.white, fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentMid },

  // Request card
  reqCard: {
    borderRadius: 20, borderWidth: 1.5, borderColor: C.border,
    padding: 20, overflow: 'hidden', backgroundColor: C.card,
    shadowColor: C.accent, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  reqName: { color: C.white, fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 3 },
  reqHandle: { color: C.accent, fontSize: 12, textAlign: 'center', marginBottom: 4 },
  reqMeta: { color: C.grey, fontSize: 12, textAlign: 'center', marginBottom: 18 },
  reqBtns: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flex: 1, height: 40, borderRadius: 20,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 10,
  },
  acceptTxt: { color: C.bg, fontWeight: '900', fontSize: 13 },
  declineBtn: {
    flex: 1, height: 40, borderRadius: 20,
    backgroundColor: C.dangerDim, borderWidth: 1.5, borderColor: C.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  declineTxt: { color: C.danger, fontWeight: '700', fontSize: 13 },

  // Tab
  tabWrap: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 24, marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 18,
    padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tabBtn: {
    flex: 1, height: 44, borderRadius: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  tabBtnActive: {
    borderWidth: 1, borderColor: C.accentMid,
    shadowColor: C.accent, shadowOpacity: 0.18, shadowRadius: 8,
  },
  tabTxt: { color: C.grey, fontSize: 13, fontWeight: '700' },
  tabTxtActive: { color: C.accent },

  // Friend row
  friendRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, padding: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8,
  },
  friendRowOnline: { borderColor: 'rgba(0,255,198,0.28)', shadowColor: C.accent, shadowOpacity: 0.08 },
  friendName: { color: C.white, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  msgBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Circle grid
  circleCard: {
    flex: 1, borderRadius: 22, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.card, padding: 16, alignItems: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
    minHeight: 200,
  },
  circleName: { color: C.white, fontSize: 14, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  circleHandle: { color: C.grey, fontSize: 11, marginBottom: 14, textAlign: 'center' },
  circleFollowBtn: { width: '100%', height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  circleFollowDefault: { backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 8 },
  circleFollowCancel: { backgroundColor: C.dangerDim, borderWidth: 1, borderColor: C.danger },
  circleFollowFriend: { backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentMid },
  circleFollowTxt: { color: C.bg, fontSize: 12, fontWeight: '900' },

  // Explore all btn
  exploreAllBtn: {
    height: 48, borderRadius: 16, borderWidth: 1, borderColor: C.accentMid,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden',
  },

  // Profile modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  profileModal: {
    width: '100%', borderRadius: 28, borderWidth: 1.5, borderColor: C.border,
    overflow: 'hidden', alignItems: 'center', paddingBottom: 28,
    shadowColor: C.accent, shadowOpacity: 0.25, shadowRadius: 30,
  },
  modalName: { color: C.white, fontSize: 21, fontWeight: '900', textAlign: 'center', marginBottom: 4 },
  modalHandle: { color: C.accent, fontSize: 13, marginBottom: 14 },
  modalStatusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, borderWidth: 1 },
  modalActionBtn: {
    width: '85%', height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, marginBottom: 4,
    shadowColor: C.accent, shadowOpacity: 0.25, shadowRadius: 12,
  },

  // Connect sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: H * 0.9, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden', borderWidth: 1, borderColor: C.border,
  },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 14, marginBottom: 2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle: { color: C.white, fontSize: 19, fontWeight: '900' },
  sheetSearch: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14,
  },

  // Explore card inside sheet
  exploreCard: {
    flex: 1, borderRadius: 20, borderWidth: 1, borderColor: C.border,
    padding: 16, alignItems: 'center', overflow: 'hidden',
    backgroundColor: C.card, minHeight: 185,
    shadowColor: C.accent, shadowOpacity: 0.08, shadowRadius: 12,
  },
  exploreCardName: { color: C.white, fontSize: 13, fontWeight: '800', textAlign: 'center', marginBottom: 2 },
  exploreCardHandle: { color: C.grey, fontSize: 11, textAlign: 'center', marginBottom: 12 },
  followBtn: { width: '100%', height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  followBtnFollow: { backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 8 },
  followBtnCancel: { backgroundColor: C.dangerDim, borderWidth: 1, borderColor: C.danger },
  followBtnText: { color: C.bg, fontSize: 12, fontWeight: '900' },
});
