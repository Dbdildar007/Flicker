// src/screens/Friends.js
// ─── Production-level Friends Page ──────────────────────────────────────────

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, Keyboard, Animated, Dimensions, ScrollView,
  StatusBar, Platform, ActivityIndicator, RefreshControl, Modal,
  KeyboardAvoidingView, Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import {
  searchUsers,
  fetchSearchHistory,
  saveSearchHistory,
  removeSearchHistoryItem,
  clearSearchHistory,
  fetchPendingRequests,
  fetchConnectedFriends,
  acceptFriendRequest,
  rejectFriendRequest,
  sendFriendRequest,
  cancelFriendRequest,
  fetchUserProfile,
  subscribeToFriendships,
  subscribeToOnlineStatus,
} from '../lib/supabase';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W * 0.72;

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  bg:          '#070d1a',
  bgCard:      'rgba(10,24,50,0.72)',
  bgCardDark:  'rgba(6,15,35,0.85)',
  border:      'rgba(0,255,198,0.18)',
  borderGlow:  'rgba(0,255,198,0.45)',
  accent:      '#00ffc6',
  accentDim:   'rgba(0,255,198,0.15)',
  accentText:  '#00ffc6',
  purple:      '#6c63ff',
  purpleDim:   'rgba(108,99,255,0.18)',
  white:       '#ffffff',
  grey:        '#8a9bb5',
  greyLight:   '#b0c4de',
  online:      '#00ffc6',
  offline:     '#3a4a6b',
  danger:      '#ff4d6d',
  dangerDim:   'rgba(255,77,109,0.18)',
  glass:       'rgba(255,255,255,0.04)',
  glassBright: 'rgba(255,255,255,0.08)',
  shimmer1:    'rgba(255,255,255,0.03)',
  shimmer2:    'rgba(255,255,255,0.09)',
  shimmer3:    'rgba(255,255,255,0.03)',
};

// ─── Shimmer Component ────────────────────────────────────────────────────────
const Shimmer = ({ width, height, borderRadius = 8, style }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [C.shimmer1, C.shimmer2] });
  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: bg }, style]} />
  );
};

// ─── GlassCard ───────────────────────────────────────────────────────────────
const GlassCard = ({ children, style, glow = false, onPress }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.88} style={[styles.glassCard, glow && styles.glassCardGlow, style]}>
      <View style={styles.glassInner}>{children}</View>
    </Wrapper>
  );
};

// ─── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = ({ url, size = 48, online, style }) => {
  const [err, setErr] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!online) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [online]);

  const initials = '?';
  return (
    <View style={[{ width: size, height: size }, style]}>
      {online && (
        <Animated.View style={[styles.pulseRing, {
          width: size + 10, height: size + 10,
          borderRadius: (size + 10) / 2,
          top: -5, left: -5,
          transform: [{ scale: pulse }],
        }]} />
      )}
      <View style={[styles.avatarWrap, { width: size, height: size, borderRadius: size / 2, borderColor: online ? C.accent : C.border }]}>
        {url && !err ? (
          <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => setErr(true)} />
        ) : (
          <LinearGradient colors={['#1a2a4a', '#0d1a30']} style={[StyleSheet.absoluteFill, { borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: C.accent, fontSize: size * 0.38, fontWeight: '700' }}>{initials}</Text>
          </LinearGradient>
        )}
      </View>
      {online !== undefined && (
        <View style={[styles.onlineDot, { backgroundColor: online ? C.online : C.offline, bottom: 0, right: 0 }]} />
      )}
    </View>
  );
};

// ─── RequestCardShimmer ───────────────────────────────────────────────────────
const RequestCardShimmer = () => (
  <View style={[styles.requestCard, { width: CARD_W, marginRight: 12 }]}>
    <Shimmer width={64} height={64} borderRadius={32} style={{ alignSelf: 'center', marginBottom: 10 }} />
    <Shimmer width={100} height={14} borderRadius={7} style={{ alignSelf: 'center', marginBottom: 6 }} />
    <Shimmer width={70} height={11} borderRadius={5} style={{ alignSelf: 'center', marginBottom: 16 }} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Shimmer width={90} height={36} borderRadius={18} />
      <Shimmer width={90} height={36} borderRadius={18} />
    </View>
  </View>
);

// ─── FriendRowShimmer ─────────────────────────────────────────────────────────
const FriendRowShimmer = () => (
  <View style={[styles.friendRow, { marginBottom: 10 }]}>
    <Shimmer width={52} height={52} borderRadius={26} style={{ marginRight: 14 }} />
    <View style={{ flex: 1 }}>
      <Shimmer width={120} height={13} borderRadius={6} style={{ marginBottom: 7 }} />
      <Shimmer width={80} height={11} borderRadius={5} />
    </View>
  </View>
);

// ─── ProfileModal ─────────────────────────────────────────────────────────────
const ProfileModal = ({ visible, profile, onClose, currentUserId, onFollowToggle }) => {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.85, duration: 180, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!profile) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.profileModal, { transform: [{ scale }], opacity }]}>
              <LinearGradient colors={['rgba(0,255,198,0.08)', 'rgba(108,99,255,0.06)', 'rgba(6,15,35,0.98)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill} />
              <View style={styles.profileModalInner}>
                <View style={styles.modalGlowLine} />
                <Avatar url={profile.avatar_url} size={80} online={profile.is_online} style={{ alignSelf: 'center', marginBottom: 14 }} />
                <Text style={styles.modalName}>{profile.display_name || 'Unknown'}</Text>
                {profile.unique_id && <Text style={styles.modalHandle}>@{profile.unique_id}</Text>}
                <View style={styles.modalStatusRow}>
                  <View style={[styles.statusBadge, { backgroundColor: profile.is_online ? 'rgba(0,255,198,0.12)' : 'rgba(58,74,107,0.4)' }]}>
                    <View style={[styles.statusDot, { backgroundColor: profile.is_online ? C.online : C.offline }]} />
                    <Text style={[styles.statusText, { color: profile.is_online ? C.accent : C.grey }]}>
                      {profile.is_online ? 'Online now' : profile.last_seen ? `Last seen ${getRelativeTime(profile.last_seen)}` : 'Offline'}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalDivider} />
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: profile.requestSent ? C.dangerDim : C.accentDim, borderColor: profile.requestSent ? C.danger : C.accent }]}
                  onPress={() => { onFollowToggle(profile); onClose(); }}>
                  <Text style={[styles.modalBtnText, { color: profile.requestSent ? C.danger : C.accent }]}>
                    {profile.requestSent ? 'Cancel Request' : profile.isFriend ? 'Message' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalClose} onPress={onClose}>
                  <Text style={{ color: C.grey, fontSize: 13 }}>Close</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ─── See All Modal ────────────────────────────────────────────────────────────
const SeeAllModal = ({ visible, onClose, currentUserId }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [pendingMap, setPendingMap] = useState({});
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (visible) {
      setUsers([]); setPage(0); setHasMore(true);
      loadUsers(0, true);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }).start();
    } else {
      Animated.timing(translateY, { toValue: SCREEN_H, duration: 300, useNativeDriver: true }).start();
    }
  }, [visible]);

  const loadUsers = async (p, reset = false) => {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    try {
      const { data } = await searchUsers({ query: '', page: p, pageSize: PAGE_SIZE });
      if (reset) setUsers(data || []);
      else setUsers(prev => [...prev, ...(data || [])]);
      setHasMore((data?.length || 0) === PAGE_SIZE);
      setPage(p + 1);
    } catch { } finally { setLoading(false); }
  };

  const handleFollow = async (profile) => {
    const alreadySent = pendingMap[profile.user_id];
    try {
      if (alreadySent) {
        await cancelFriendRequest(currentUserId, profile.user_id);
        setPendingMap(prev => { const n = { ...prev }; delete n[profile.user_id]; return n; });
        Toast.show({ type: 'info', text1: 'Request cancelled' });
      } else {
        await sendFriendRequest(currentUserId, profile.user_id);
        setPendingMap(prev => ({ ...prev, [profile.user_id]: true }));
        Toast.show({ type: 'success', text1: 'Request sent!' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message || 'Something went wrong' });
    }
  };

  const renderUser = ({ item, index }) => {
    const sent = pendingMap[item.user_id];
    return (
      <View style={styles.exploreCard}>
        <LinearGradient colors={['rgba(0,255,198,0.06)', 'rgba(6,15,35,0.9)']}
          style={StyleSheet.absoluteFill} borderRadius={18} />
        <Avatar url={item.avatar_url} size={52} online={item.is_online} style={{ marginBottom: 8 }} />
        <Text style={styles.exploreCardName} numberOfLines={1}>{item.display_name || 'User'}</Text>
        {item.unique_id && <Text style={styles.exploreCardHandle} numberOfLines={1}>@{item.unique_id}</Text>}
        <TouchableOpacity
          style={[styles.exploreFollowBtn, sent && styles.exploreCancelBtn]}
          onPress={() => handleFollow(item)}>
          <Text style={[styles.exploreFollowText, sent && { color: C.danger }]}>
            {sent ? 'Cancel' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.seeAllOverlay}>
        <Animated.View style={[styles.seeAllSheet, { transform: [{ translateY }] }]}>
          <LinearGradient colors={['#0a1830', '#070d1a']} style={StyleSheet.absoluteFill} />
          <View style={styles.seeAllHandle} />
          <View style={styles.seeAllHeader}>
            <Text style={styles.seeAllTitle}>Explore People</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: C.accent, fontSize: 15 }}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={users}
            renderItem={renderUser}
            keyExtractor={i => i.user_id}
            numColumns={2}
            contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
            columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
            onEndReached={() => loadUsers(page)}
            onEndReachedThreshold={0.4}
            ListFooterComponent={loading ? <ActivityIndicator color={C.accent} style={{ marginTop: 16 }} /> : null}
            ListEmptyComponent={!loading ? <Text style={{ color: C.grey, textAlign: 'center', marginTop: 40 }}>No users found</Text> : null}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const getRelativeTime = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function FriendsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const currentUserId = useRef(null); // set from auth

  // ─ State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [connectedFriends, setConnectedFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSeeAll, setShowSeeAll] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [pendingMap, setPendingMap] = useState({});
  const [actionLoading, setActionLoading] = useState({});

  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const [authLoading, setAuthLoading] = useState(true);

  // ─ Animations
  const searchBarScale = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef(null);
  const searchDebounce = useRef(null);

  // ─ Auth: get current user
  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          currentUserId.current = session.user.id;
          loadAll();
          loadSearchHistory();
          setupSubscriptions();
        }
      } catch (e) { console.warn(e); }
    })();
    return () => { subscriptionRef.current?.unsubscribe(); };
  }, []);

  const subscriptionRef = useRef(null);
  const setupSubscriptions = () => {
    const sub = subscribeToFriendships(currentUserId.current, () => loadAll());
    subscriptionRef.current = sub;
  };

  useEffect(() => {
    // Simulate checking auth session
    setTimeout(() => {
      // Set to false to see the new UI, true to see the friends list
      setIsLoggedIn(false); 
      setAuthLoading(false);
    }, 1500);
  }, []);

  const loadAll = useCallback(async () => {
    if (!isLoggedIn) return;
    await Promise.all([loadPending(), loadFriends()]);
  }, [isLoggedIn]);

  const loadPending = async () => {
    if (!currentUserId.current) return;
    setPendingLoading(true);
    try {
      const data = await fetchPendingRequests(currentUserId.current);
      setPendingRequests(data);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to load requests' });
    } finally { setPendingLoading(false); }
  };

  const loadFriends = async () => {
    if (!currentUserId.current) return;
    setFriendsLoading(true);
    try {
      const data = await fetchConnectedFriends(currentUserId.current);
      setConnectedFriends(data);
    } catch { } finally { setFriendsLoading(false); }
  };

  const loadSearchHistory = async () => {
    const h = await fetchSearchHistory();
    setSearchHistory(h);
  };

  // ─ Search
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    clearTimeout(searchDebounce.current);
    if (!text.trim()) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(() => doSearch(text), 350);
  };

  const doSearch = async (q) => {
    if (!q.trim()) return;
    setSearchLoading(true);
    try {
      const { data } = await searchUsers({ query: q, page: 0, pageSize: 20 });
      setSearchResults(data || []);
    } catch { } finally { setSearchLoading(false); }
  };

  const handleSearchFocus = () => {
    setSearchFocused(true);
    Animated.parallel([
      Animated.spring(searchBarScale, { toValue: 1.025, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handleSearchBlur = () => {
    Animated.spring(searchBarScale, { toValue: 1, useNativeDriver: true }).start();
  };

  const handleSelectResult = async (user) => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery('');
    setSearchResults([]);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    await saveSearchHistory(user);
    setSearchHistory(await fetchSearchHistory());
    setSelectedProfile(user);
  };

  const handleRemoveHistory = async (id) => {
    await removeSearchHistoryItem(id);
    setSearchHistory(await fetchSearchHistory());
  };

  const handleClearHistory = async () => {
    await clearSearchHistory();
    setSearchHistory([]);
  };

  const dismissSearch = () => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery('');
    setSearchResults([]);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  // ─ Accept / Reject
  const handleAccept = async (requestId, requesterId) => {
    setActionLoading(prev => ({ ...prev, [requestId]: 'accept' }));
    try {
      await acceptFriendRequest(requestId);
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      await loadFriends();
      Toast.show({ type: 'success', text1: '🎉 Friend added!' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message || 'Failed to accept' });
    } finally { setActionLoading(prev => { const n = { ...prev }; delete n[requestId]; return n; }); }
  };

  const handleReject = async (requestId) => {
    setActionLoading(prev => ({ ...prev, [requestId]: 'reject' }));
    try {
      await rejectFriendRequest(requestId);
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      Toast.show({ type: 'info', text1: 'Request declined' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message || 'Failed to decline' });
    } finally { setActionLoading(prev => { const n = { ...prev }; delete n[requestId]; return n; }); }
  };

  // ─ Follow / Cancel
  const handleFollowToggle = async (profile) => {
    if (!currentUserId.current) return;
    const uid = profile.user_id;
    const sent = pendingMap[uid];
    setActionLoading(prev => ({ ...prev, [uid]: true }));
    try {
      if (sent) {
        await cancelFriendRequest(currentUserId.current, uid);
        setPendingMap(prev => { const n = { ...prev }; delete n[uid]; return n; });
        Toast.show({ type: 'info', text1: 'Request cancelled' });
      } else {
        await sendFriendRequest(currentUserId.current, uid);
        setPendingMap(prev => ({ ...prev, [uid]: true }));
        Toast.show({ type: 'success', text1: 'Request sent!' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message || 'Something went wrong' });
    } finally { setActionLoading(prev => { const n = { ...prev }; delete n[uid]; return n; }); }
  };

  // ─ Message
  const handleMessage = (friend) => {
    navigation.navigate('Chat', { friend });
  };

  // ─ Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // ─── Sorted friends: online first ─────────────────────────────────────────
  const sortedFriends = useMemo(() =>
    [...connectedFriends].sort((a, b) => (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0)),
    [connectedFriends]
  );

  // ─── Render request card ──────────────────────────────────────────────────
  const renderRequestCard = ({ item }) => {
    const loading = actionLoading[item.id];
    return (
      <TouchableOpacity
        style={[styles.requestCard, { width: CARD_W }]}
        activeOpacity={0.92}
        onPress={() => setSelectedProfile({ ...item.requester, isFriend: false })}>
        <LinearGradient
          colors={['rgba(0,255,198,0.09)', 'rgba(108,99,255,0.07)', 'rgba(6,15,35,0.95)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill} borderRadius={20} />
        <View style={styles.requestCardGlowBorder} />
        <Avatar url={item.requester?.avatar_url} size={64} online={item.requester?.is_online} style={{ alignSelf: 'center', marginBottom: 10 }} />
        <Text style={styles.requestName} numberOfLines={1}>{item.requester?.display_name || 'User'}</Text>
        {item.requester?.unique_id && (
          <Text style={styles.requestHandle}>@{item.requester.unique_id}</Text>
        )}
        <Text style={styles.requestMeta}>Wants to connect</Text>
        <View style={styles.requestBtns}>
          <TouchableOpacity
            style={[styles.acceptBtn, loading === 'accept' && { opacity: 0.7 }]}
            onPress={() => handleAccept(item.id, item.requester_id)}
            disabled={!!loading}>
            {loading === 'accept'
              ? <ActivityIndicator size="small" color={C.bg} />
              : <Text style={styles.acceptBtnText}>Accept</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rejectBtn, loading === 'reject' && { opacity: 0.7 }]}
            onPress={() => handleReject(item.id)}
            disabled={!!loading}>
            {loading === 'reject'
              ? <ActivityIndicator size="small" color={C.danger} />
              : <Text style={styles.rejectBtnText}>Decline</Text>}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render friend row ────────────────────────────────────────────────────
  const renderFriendRow = ({ item }) => (
    <TouchableOpacity
      style={[styles.friendRow, item.is_online && styles.friendRowOnline]}
      activeOpacity={0.88}
      onPress={() => setSelectedProfile({ ...item, isFriend: true })}>
      {item.is_online && (
        <LinearGradient
          colors={['rgba(0,255,198,0.08)', 'rgba(0,255,198,0.0)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill} borderRadius={18} />
      )}
      <Avatar url={item.avatar_url} size={50} online={item.is_online} style={{ marginRight: 14 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.friendName}>{item.display_name || 'User'}</Text>
        <View style={styles.friendStatusRow}>
          <View style={[styles.statusDot, { backgroundColor: item.is_online ? C.online : C.offline, marginRight: 5 }]} />
          <Text style={[styles.friendStatus, { color: item.is_online ? C.accent : C.grey }]}>
            {item.is_online ? 'Online now' : getRelativeTime(item.last_seen)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.msgIcon}
        onPress={() => handleMessage(item)}>
        <Text style={styles.msgIconText}>✉</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // ─── Search overlay content ───────────────────────────────────────────────
  const renderSearchContent = () => {
    if (searchQuery.trim()) {
      return (
        <View style={styles.searchDropdown}>
          {searchLoading ? (
            [0, 1, 2].map(i => <FriendRowShimmer key={i} />)
          ) : searchResults.length === 0 ? (
            <Text style={styles.noResultText}>No users found for "{searchQuery}"</Text>
          ) : (
            searchResults.map(u => (
              <TouchableOpacity key={u.user_id} style={styles.searchResultRow} onPress={() => handleSelectResult(u)}>
                <Avatar url={u.avatar_url} size={38} online={u.is_online} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.searchResultName}>{u.display_name || 'User'}</Text>
                  {u.unique_id && <Text style={styles.searchResultHandle}>@{u.unique_id}</Text>}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      );
    }
    if (searchHistory.length > 0) {
      return (
        <View style={styles.searchDropdown}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent</Text>
            <TouchableOpacity onPress={handleClearHistory}>
              <Text style={{ color: C.accent, fontSize: 13 }}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {searchHistory.map(h => (
            <View key={h.user_id} style={styles.searchResultRow}>
              <TouchableOpacity style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }} onPress={() => handleSelectResult(h)}>
                <Avatar url={h.avatar_url} size={38} online={h.is_online} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.searchResultName}>{h.display_name || 'User'}</Text>
                  {h.unique_id && <Text style={styles.searchResultHandle}>@{h.unique_id}</Text>}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleRemoveHistory(h.user_id)} style={styles.historyRemove}>
                <Text style={{ color: C.grey, fontSize: 16 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }
    return null;
  };

if (authLoading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }
if (!isLoggedIn) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#070d1a', '#0a1128', '#070d1a']} style={StyleSheet.absoluteFill} />
        
        {/* Decorative 3D Floating Orbs in background */}
        <View style={styles.orb1} />
        <View style={styles.orb2} />

        <View style={styles.authContainer}>
          <GlassCard style={styles.authGlassCard}>
            <View style={styles.authIconCircle}>
              <Text style={styles.authEmoji}>🌐</Text>
            </View>
            
            <Text style={styles.authTitle}>Join the Network</Text>
            <Text style={styles.authSubtitle}>
              Connect with explorers worldwide, share your journey, and build your circle in the digital frontier.
            </Text>

            <View style={styles.authActionGap}>
              <TouchableOpacity style={styles.googleBtn} activeOpacity={0.8}>
                <LinearGradient 
                  colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']} 
                  style={styles.authBtnGradient}
                >
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.emailBtn} activeOpacity={0.8}>
                <Text style={styles.emailBtnText}>Continue with Email</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.createBtn} onPress={() => setIsLoggedIn(true)}>
                <Text style={styles.createBtnText}>
                  New here? <Text style={{color: C.accent}}>Create an account</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
          
          <Text style={styles.authFooterText}>
            By continuing, you agree to our Terms of Service.
          </Text>
        </View>
      </View>
    );
  }


  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <LinearGradient colors={['#070d1a', '#0a1128', '#070d1a']} style={styles.root}>

        {/* ── Search Bar ──────────────────────────────────────────────────── */}
        <View style={[styles.searchBarWrap, { paddingTop: insets.top + 14 }]}>
          <Animated.View style={[styles.searchBar, { transform: [{ scale: searchBarScale }], borderColor: searchFocused ? C.accent : C.border }]}>
            <LinearGradient
              colors={searchFocused ? ['rgba(0,255,198,0.1)', 'rgba(10,24,50,0.9)'] : ['rgba(255,255,255,0.05)', 'rgba(6,15,35,0.9)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill} borderRadius={30} />
            <Text style={[styles.searchIcon, { color: searchFocused ? C.accent : C.grey }]}>⌕</Text>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Find explorers..."
              placeholderTextColor={C.grey}
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }} style={styles.clearBtn}>
                <Text style={{ color: C.grey, fontSize: 16 }}>×</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        {/* Search Overlay */}
        {searchFocused && (
          <TouchableWithoutFeedback onPress={dismissSearch}>
            <Animated.View style={[styles.searchOverlay, { opacity: overlayOpacity }]}>
              <TouchableWithoutFeedback>
                <View style={styles.searchDropdownWrap}>
                  {renderSearchContent()}
                </View>
              </TouchableWithoutFeedback>
            </Animated.View>
          </TouchableWithoutFeedback>
        )}

        {/* ── Main Scroll ──────────────────────────────────────────────────── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}>

          {/* ── Pending Requests ──────────────────────────────────────────── */}
         {/* ── Pending Requests ──────────────────────────────────────────── */}
{(pendingLoading || pendingRequests.length > 0) && (
  <View style={styles.sectionWrap}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Friend Requests</Text>
      {pendingRequests.length > 0 && (
        <TouchableOpacity onPress={() => setShowSeeAll(true)} style={styles.seeAllBtn}>
          <LinearGradient 
            colors={[C.accentDim, 'transparent']} 
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
            style={StyleSheet.absoluteFill} 
            borderRadius={20} 
          />
          <Text style={styles.seeAllText}>See All ({pendingRequests.length})</Text>
        </TouchableOpacity>
      )}
    </View>

    {pendingLoading ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 18, gap: 12 }}>
        {[0, 1].map(i => <RequestCardShimmer key={i} />)}
      </ScrollView>
    ) : (
      <FlatList
        data={pendingRequests}
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
          {/* ── Connected Friends ─────────────────────────────────────────── */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Connected Friends</Text>
              <View style={styles.onlineBadge}>
                <View style={[styles.statusDot, { backgroundColor: C.online, marginRight: 5 }]} />
                <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>
                  {sortedFriends.filter(f => f.is_online).length} online
                </Text>
              </View>
            </View>

            {friendsLoading ? (
              <View style={{ paddingHorizontal: 18 }}>
                {[0, 1, 2].map(i => <FriendRowShimmer key={i} />)}
              </View>
            ) : sortedFriends.length === 0 ? (
              <GlassCard style={[styles.emptyCard, { marginHorizontal: 18 }]}>
                <Text style={styles.emptyText}>Connect with people to see them here</Text>
                <TouchableOpacity style={styles.exploreBtn} onPress={() => setShowSeeAll(true)}>
                  <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>Explore People</Text>
                </TouchableOpacity>
              </GlassCard>
            ) : (
              <View style={{ paddingHorizontal: 14, gap: 10 }}>
                {sortedFriends.map(f => renderFriendRow({ item: f }))}
              </View>
            )}
          </View>

        </ScrollView>

        {/* ── Profile Modal ─────────────────────────────────────────────── */}
        <ProfileModal
          visible={!!selectedProfile}
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          currentUserId={currentUserId.current}
          onFollowToggle={handleFollowToggle}
        />

        {/* ── See All Modal ─────────────────────────────────────────────── */}
        <SeeAllModal
          visible={showSeeAll}
          onClose={() => setShowSeeAll(false)}
          currentUserId={currentUserId.current}
        />

        <Toast />
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Search
  searchBarWrap: { paddingHorizontal: 18, paddingBottom: 10, zIndex: 20 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, borderRadius: 30,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 18, overflow: 'hidden',
    shadowColor: C.accent, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  searchIcon: { fontSize: 22, marginRight: 10 },
  searchInput: { flex: 1, color: C.white, fontSize: 15, letterSpacing: 0.3 },
  clearBtn: { padding: 4 },
  searchOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 15,
    backgroundColor: 'rgba(7,13,26,0.92)',
  },
  searchDropdownWrap: {
    marginTop: 0, paddingTop: 110, // below search bar
  },
  searchDropdown: {
    marginHorizontal: 14, backgroundColor: 'rgba(10,24,50,0.98)',
    borderRadius: 18, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', paddingVertical: 6,
    shadowColor: C.accent, shadowOpacity: 0.15, shadowRadius: 18,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  historyTitle: { color: C.greyLight, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  historyRemove: { padding: 8 },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  searchResultName: { color: C.white, fontSize: 14, fontWeight: '600' },
  searchResultHandle: { color: C.grey, fontSize: 12 },
  noResultText: { color: C.grey, textAlign: 'center', padding: 24, fontSize: 14 },

  // Section
  sectionWrap: { marginTop: 22 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginBottom: 14 },
  sectionTitle: { color: C.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  seeAllBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  seeAllText: { color: C.accent, fontSize: 13, fontWeight: '600' },

  // Glass card
  glassCard: {
    borderRadius: 18, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bgCard, overflow: 'hidden',
    shadowColor: C.accent, shadowOpacity: 0.08, shadowRadius: 12,
  },
  glassCardGlow: { borderColor: C.borderGlow, shadowOpacity: 0.22 },
  glassInner: { padding: 16 },

  // Request card
  requestCard: {
    borderRadius: 20, borderWidth: 1.5, borderColor: C.border,
    padding: 20, overflow: 'hidden',
    backgroundColor: C.bgCard,
    shadowColor: C.accent, shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  requestCardGlowBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: C.accent, opacity: 0.35, borderRadius: 1,
  },
  requestName: { color: C.white, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  requestHandle: { color: C.accent, fontSize: 12, textAlign: 'center', marginBottom: 4 },
  requestMeta: { color: C.grey, fontSize: 12, textAlign: 'center', marginBottom: 16 },
  requestBtns: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  acceptBtn: {
    flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.accent,
    shadowColor: C.accent, shadowOpacity: 0.45, shadowRadius: 10,
  },
  acceptBtnText: { color: C.bg, fontSize: 13, fontWeight: '800' },
  rejectBtn: {
    flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.danger, backgroundColor: C.dangerDim,
  },
  rejectBtnText: { color: C.danger, fontSize: 13, fontWeight: '700' },

  // Avatar
  avatarWrap: { borderWidth: 2, overflow: 'hidden', backgroundColor: '#0d1a30' },
  pulseRing: {
    position: 'absolute', borderWidth: 2, borderColor: C.accent, opacity: 0.4,
  },
  onlineDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.bg },

  // Friend row
  friendRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bgCard, padding: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8,
  },
  friendRowOnline: { borderColor: 'rgba(0,255,198,0.32)', shadowColor: C.accent, shadowOpacity: 0.1 },
  friendName: { color: C.white, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  friendStatusRow: { flexDirection: 'row', alignItems: 'center' },
  friendStatus: { fontSize: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  msgIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,255,198,0.1)', borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  msgIconText: { fontSize: 16, color: C.accent },

  // Status
  onlineBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, backgroundColor: 'rgba(0,255,198,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,255,198,0.22)',
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },

  // Empty
  emptyCard: { marginHorizontal: 18, padding: 24, alignItems: 'center' },
  emptyText: { color: C.grey, fontSize: 14, textAlign: 'center' },
  exploreBtn: {
    marginTop: 12, paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: C.accent,
    backgroundColor: C.accentDim,
  },

  // Profile Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  profileModal: {
    width: '100%', borderRadius: 28,
    borderWidth: 1.5, borderColor: C.border, overflow: 'hidden',
    shadowColor: C.accent, shadowOpacity: 0.3, shadowRadius: 30,
  },
  profileModalInner: { padding: 28, alignItems: 'center' },
  modalGlowLine: { position: 'absolute', top: 0, left: 40, right: 40, height: 2, backgroundColor: C.accent, opacity: 0.5, borderRadius: 1 },
  modalName: { color: C.white, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  modalHandle: { color: C.accent, fontSize: 13, marginBottom: 12 },
  modalStatusRow: { marginBottom: 18 },
  modalDivider: { width: '80%', height: 1, backgroundColor: C.border, marginBottom: 18 },
  modalBtn: {
    width: '100%', height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, marginBottom: 12,
  },
  modalBtnText: { fontSize: 14, fontWeight: '700' },
  modalClose: { paddingVertical: 6 },

  // See All Sheet
  seeAllOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  seeAllSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SCREEN_H * 0.88, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden', borderWidth: 1, borderColor: C.border,
  },
  seeAllHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  seeAllHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  seeAllTitle: { color: C.white, fontSize: 18, fontWeight: '800' },

  // Explore cards
  exploreCard: {
    flex: 1, borderRadius: 18, borderWidth: 1, borderColor: C.border,
    padding: 16, alignItems: 'center', overflow: 'hidden',
    backgroundColor: C.bgCard,
    shadowColor: C.accent, shadowOpacity: 0.1, shadowRadius: 12,
  },
  exploreCardName: { color: C.white, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  exploreCardHandle: { color: C.grey, fontSize: 11, textAlign: 'center', marginBottom: 10 },
  exploreFollowBtn: {
    paddingHorizontal: 20, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.accent,
    shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 8,
  },
  exploreFollowText: { color: C.bg, fontSize: 12, fontWeight: '800' },
  exploreCancelBtn: { backgroundColor: C.dangerDim, borderWidth: 1, borderColor: C.danger, shadowOpacity: 0 },
  // AUTH STYLES
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  authGlassCard: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)', // Thin glass
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: C.accent,
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  authIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 255, 198, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.accentDim,
  },
  authEmoji: { fontSize: 32 },
  authTitle: {
    color: C.white,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  authSubtitle: {
    color: C.grey,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  authActionGap: { width: '100%', gap: 16 },
  googleBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  authBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleBtnText: { color: C.white, fontWeight: '700', fontSize: 16 },
  emailBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.accent,
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 4 },
  },
  emailBtnText: { color: C.bg, fontWeight: '800', fontSize: 16 },
  createBtn: { marginTop: 12, alignItems: 'center' },
  createBtnText: { color: C.grey, fontSize: 14, fontWeight: '600' },
  authFooterText: {
    color: 'rgba(138, 155, 181, 0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
  // Floating Orbs
  orb1: {
    position: 'absolute',
    top: '15%',
    right: '-10%',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: C.accent,
    opacity: 0.05,
  },
  orb2: {
    position: 'absolute',
    bottom: '10%',
    left: '-20%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.purple,
    opacity: 0.05,
});
