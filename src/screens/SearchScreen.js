// src/screens/SearchScreen.js
/**
 * Optimized Search Screen
 * ─────────────────────────────────────────────────────────────────
 * • All API calls via centralized supabase.js (searchMovies, fetchMoviesByPage, fetchFilterOptions)
 * • 3-col vertical grid only (no banner cards)
 * • White 3D hyped glass UI on text input + cards
 * • Keyboard dismiss on tap anywhere (TouchableWithoutFeedback)
 * • Debounced search 200ms
 * • Infinite scroll pagination
 * • Shared shimmer (zero callback leak)
 * • Fully responsive via rs() scale helper
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList,
  TouchableOpacity, TouchableWithoutFeedback,
  Animated, Dimensions, StatusBar,
  ImageBackground, ActivityIndicator, ScrollView,
  Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, RADIUS, SHADOW } from '../data/theme';

// ── All API imported from central supabase.js ─────────────────────────────────
import {
  searchMovies,
  fetchMoviesByPage,
  fetchFilterOptions,
} from '../lib/supabase';

import { limitWords } from '../utils/helper';

// ─── Responsive ───────────────────────────────────────────────────────────────
const rs = (s) => {
  const { width: w } = Dimensions.get('window');
  if (w < 360) return Math.round(s * 0.82);
  if (w < 414) return Math.round(s * 0.92);
  if (w > 768) return Math.round(s * 1.18); // tablets
  if (w > 600) return Math.round(s * 1.08);
  return s;
};

const getLayout = () => {
  const { width: W } = Dimensions.get('window');
  const COLS    = 3;
  const H_PAD   = rs(14);
  const GAP     = rs(9);
  const CARD_W  = (W - H_PAD * 2 - GAP * (COLS - 1)) / COLS;
  const CARD_H  = CARD_W * 1.52;
  return { COLS, H_PAD, GAP, CARD_W, CARD_H, W };
};

const PAGE_SIZE   = 24; // divisible by 3 — keeps rows clean
const HISTORY_KEY = '@flicks_search_history';
const MAX_HISTORY = 12;

// ─── Shared shimmer ───────────────────────────────────────────────────────────
const shimA = new Animated.Value(0);
let shimStarted = false;
const startShimmer = () => {
  if (shimStarted) return;
  shimStarted = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(shimA, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(shimA, { toValue: 0, duration: 900, useNativeDriver: true }),
    ])
  ).start();
};
const shimOpac = shimA.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.44] });

// ─── SkeletonBox ──────────────────────────────────────────────────────────────
const SkeletonBox = memo(({ width, height, borderRadius = rs(10), style }) => (
  <Animated.View style={[{ width, height, borderRadius, overflow: 'hidden', opacity: shimOpac }, style]}>
    <LinearGradient
      colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
      start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
      style={StyleSheet.absoluteFill}
    />
  </Animated.View>
));

function SearchSkeleton() {
  const { CARD_W, CARD_H, H_PAD, GAP } = getLayout();
  return (
    <View style={{ paddingHorizontal: H_PAD, paddingTop: rs(10) }}>
      {[0, 1, 2, 3].map(row => (
        <View key={row} style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
          {[0, 1, 2].map(i => (
            <SkeletonBox key={i} width={CARD_W} height={CARD_H} borderRadius={rs(12)} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────
const SeriesBadge = memo(() => (
  <View style={S.seriesBadge}>
    <LinearGradient colors={['rgba(255,45,85,0.55)', 'rgba(255,45,85,0.25)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
    <Text style={S.seriesTxt}>SERIES</Text>
  </View>
));

const TrendingBadge = memo(() => (
  <View style={S.trendBadge}>
    <LinearGradient colors={['rgba(255,215,0,0.40)', 'rgba(255,215,0,0.15)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
    <Text style={S.trendTxt}>🔥</Text>
  </View>
));

const NewBadge = memo(({ label }) => (
  <View style={S.newBadge}>
    <LinearGradient colors={[COLORS.accentGlow || 'rgba(0,255,178,0.5)', 'rgba(0,255,178,0.10)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
    <Text style={S.newTxt}>{label}</Text>
  </View>
));

const RatingChip = memo(({ rating }) => (
  <View style={S.ratingChip}>
    <LinearGradient colors={['rgba(255,215,0,0.30)', 'rgba(255,215,0,0.08)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(6) }]} />
    <Text style={S.ratingTxt}>⭐ {Number(rating).toFixed(1)}</Text>
  </View>
));

// ─── Movie Card (3-col grid, white glass style) ──────────────────────────────
const MovieCard = memo(({ item, onPress }) => {
  const { CARD_W, CARD_H } = getLayout();
  const scaleA = useRef(new Animated.Value(1)).current;

  const onIn  = useCallback(() =>
    Animated.spring(scaleA, { toValue: 0.93, useNativeDriver: true, tension: 320, friction: 10 }).start(), []);
  const onOut = useCallback(() =>
    Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 320, friction: 10 }).start(), []);

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      onPressIn={onIn}
      onPressOut={onOut}
      activeOpacity={1}
    >
      <Animated.View style={[S.card, { width: CARD_W, height: CARD_H, transform: [{ scale: scaleA }] }]}>

        {/* Outer white glass border */}
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.55)',
            'rgba(255,255,255,0.18)',
            'rgba(255,255,255,0.08)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: rs(13) }]}
        />

        {/* Inner card */}
        <View style={[S.cardInner, { borderRadius: rs(12) }]}>
          {item.poster ? (
            <ImageBackground
              source={{ uri: item.poster }}
              style={{ flex: 1 }}
              imageStyle={{ borderRadius: rs(12) }}
              resizeMode="cover"
            >
              {/* Bottom scrim */}
              <LinearGradient
                colors={['rgba(3,10,8,0)', 'rgba(3,10,8,0.5)', 'rgba(3,10,8,0.96)']}
                locations={[0, 0.55, 1]}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
              />

              {/* Top shine overlay for glass effect */}
              <LinearGradient
                colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 0.35 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
              />

              {/* Badges top */}
              <View style={S.cardBadgeRow}>
                {item.is_series && <SeriesBadge />}
                {item.is_trending && <TrendingBadge />}
              </View>
              {item.newly_added && (
                <NewBadge label={item.newly_added} />
              )}

              {/* Bottom info */}
              <View style={S.cardBottom}>
                {/* White glass info panel */}
                <LinearGradient
                  colors={[
                    'rgba(255,255,255,0.18)',
                    'rgba(255,255,255,0.08)',
                  ]}
                  style={[S.cardInfoPanel, { borderRadius: rs(8) }]}
                >
                  {/* Top shine on panel */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.40)', 'rgba(255,255,255,0.0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 0.5 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: rs(8) }]}
                  />
                  <Text style={S.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {item.rating != null && <RatingChip rating={item.rating} />}
                </LinearGradient>
              </View>
            </ImageBackground>
          ) : (
            <View style={[S.cardNoImage, { borderRadius: rs(12) }]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
              />
              <Text style={S.cardTitle} numberOfLines={3}>{limitWords(item.title, 10)}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Filter Chip ─────────────────────────────────────────────────────────────
const FilterChip = memo(({ label, active, onPress }) => {
  const scaleA = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scaleA, { toValue: 0.90, useNativeDriver: true, tension: 380, friction: 10 }).start();
  const onOut = () => Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 380, friction: 10 }).start();

  return (
    <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      <Animated.View style={[S.filterChip, active && S.filterChipActive, { transform: [{ scale: scaleA }] }]}>
        {active ? (
          <>
            <LinearGradient colors={[COLORS.accent || '#00FFB2', COLORS.accentDim || '#00CC90']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
            <LinearGradient colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
          </>
        ) : (
          <>
            <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.05)']}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
            <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
          </>
        )}
        <Text style={[S.filterChipTxt, active && S.filterChipTxtActive]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── History Tag ─────────────────────────────────────────────────────────────
const HistoryTag = memo(({ text, onPress, onRemove }) => (
  <View style={S.historyTag}>
    <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.06)']}
      style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
    <LinearGradient colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']}
      start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
      style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
    <TouchableOpacity onPress={() => onPress(text)} activeOpacity={0.75} style={S.historyTagText}>
      <Text style={S.historyTxt} numberOfLines={1}>🕐  {text}</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => onRemove(text)} style={S.historyTagX}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={S.historyXTxt}>✕</Text>
    </TouchableOpacity>
  </View>
));

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = memo(({ query }) => (
  <View style={S.emptyWrap}>
    <View style={S.emptyIcon}>
      <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(50) }]} />
      <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(50) }]} />
      <Text style={{ fontSize: rs(36) }}>🔍</Text>
    </View>
    <Text style={S.emptyTitle}>No results for "{query}"</Text>
    <Text style={S.emptySub}>Try different keywords or adjust your filters</Text>
  </View>
));

// ─── Error Banner ─────────────────────────────────────────────────────────────
const ErrorBanner = memo(({ message, onRetry }) => {
  if (!message) return null;
  return (
    <View style={S.errorBanner}>
      <LinearGradient colors={['rgba(255,45,85,0.22)', 'rgba(255,45,85,0.08)']}
        style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]} />
      <Text style={S.errorTxt}>⚠️  {message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={S.errorRetry}>
          <Text style={S.errorRetryTxt}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ─── Filter Section ───────────────────────────────────────────────────────────
const FilterSection = memo(({ title, options, selected, onToggle }) => {
  if (!options?.length) return null;
  return (
    <View style={S.filterSection}>
      <Text style={S.filterSectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.filterScroll}
        keyboardShouldPersistTaps="handled">
        {options.map(opt => (
          <FilterChip key={String(opt)} label={String(opt)}
            active={selected.includes(opt)} onPress={() => onToggle(opt)} />
        ))}
      </ScrollView>
    </View>
  );
});

// ─── Row helper: chunk flat array into rows of 3 ─────────────────────────────
function chunkIntoRows(arr, size = 3) {
  const rows = [];
  for (let i = 0; i < arr.length; i += size) {
    rows.push(arr.slice(i, i + size));
  }
  return rows;
}

// ─── SEARCH SCREEN ────────────────────────────────────────────────────────────
export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { H_PAD, GAP, CARD_W, CARD_H } = getLayout();

  // ── State ──────────────────────────────────────────────────────────────────
  const [results,     setResults]     = useState([]);
  const [defaultList, setDefaultList] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [searching,   setSearching]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState('');
  const [history,     setHistory]     = useState([]);
  const [hasMore,     setHasMore]     = useState(true);
  const [page,        setPage]        = useState(0);

  // Filter options (from DB)
  const [availYears,  setAvailYears]  = useState([]);
  const [availLangs,  setAvailLangs]  = useState([]);
  const [availGenres, setAvailGenres] = useState([]);
  const [selYears,    setSelYears]    = useState([]);
  const [selLangs,    setSelLangs]    = useState([]);
  const [selGenres,   setSelGenres]   = useState([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState(''); // Add this

  const debounceRef = useRef(null);
  const inputRef    = useRef(null);
  const listRef     = useRef(null);

  const isSearchMode = query.length > 0 || selYears.length > 0 || selLangs.length > 0 || selGenres.length > 0;
  const displayData  = isSearchMode ? results : defaultList;
  const gridRows     = useMemo(() => chunkIntoRows(displayData, 3), [displayData]);

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    startShimmer();
    StatusBar.setHidden(true, 'fade');
    loadHistory();
    loadFilterOptions();
    loadDefaultMovies(0);
    return () => StatusBar.setHidden(false, 'fade');
  }, []);

  // ── History ────────────────────────────────────────────────────────────────
  const loadHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { }
  };

  const addToHistory = useCallback((term) => {
    if (!term.trim()) return;
    setHistory(prev => {
      const next = [term, ...prev.filter(h => h !== term)].slice(0, MAX_HISTORY);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => { });
      return next;
    });
  }, []);

  const removeFromHistory = useCallback((term) => {
    setHistory(prev => {
      const next = prev.filter(h => h !== term);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => { });
      return next;
    });
  }, []);

  const clearAllHistory = useCallback(() => {
    setHistory([]);
    AsyncStorage.removeItem(HISTORY_KEY).catch(() => { });
  }, []);

  // ── Load filter options ────────────────────────────────────────────────────
  const loadFilterOptions = async () => {
    const { years, languages, genres } = await fetchFilterOptions();
    setAvailYears(years);
    setAvailLangs(languages);
    setAvailGenres(genres);
  };

  // ── Default movies ─────────────────────────────────────────────────────────
  const loadDefaultMovies = useCallback(async (pg = 0) => {
    if (pg === 0) setLoading(true);
    else setLoadingMore(true);
    setError('');

    try {
      const data = await fetchMoviesByPage(pg, PAGE_SIZE);
      if (pg === 0) setDefaultList(data);
      else setDefaultList(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setPage(pg + 1);
    } catch {
      setError('Could not load movies. Tap to retry.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────
  const performSearch = useCallback(async (q, years, langs, genres, pg = 0) => {
    const hasQuery   = q.trim().length > 0;
    const hasFilters = years.length > 0 || langs.length > 0 || genres.length > 0;
    if (!hasQuery && !hasFilters) { setResults([]); return; }

    if (pg === 0) setSearching(true);
    else setLoadingMore(true);
    setError('');

    const { data, hasMore: more, error: err } = await searchMovies({
      query: q, years, languages: langs, genres, page: pg, pageSize: PAGE_SIZE,
    });

    if (err) {
  setError('Search failed. Please try again.');
} else {
  if (pg === 0) setResults(data);
  else setResults(prev => [...prev, ...data]);
  setHasMore(more);
  setPage(pg + 1);
  // History is now handled only by the Keyboard 'Search' button
}

    setSearching(false);
    setLoadingMore(false);
  }, [addToHistory]);

  // ── Debounce: auto-search on query/filter change ───────────────────────────
// ── Debounce: Only update the search term string after typing pauses
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(query);
  }, 600); 
  return () => clearTimeout(timer);
}, [query]);

// ── Search Trigger: Only runs when the debounced term or filters change
useEffect(() => {
  if (!isSearchMode) {
    setResults([]);
    return;
  }
  setPage(0);
  setHasMore(true);
  performSearch(query, selYears, selLangs, selGenres, 0);
}, [debouncedQuery, selYears, selLangs, selGenres]); // Change 'query' to 'debouncedQuery'

  // ── Toggle filters ─────────────────────────────────────────────────────────
  const toggleYear  = useCallback(y => setSelYears(p  => p.includes(y) ? p.filter(x => x !== y) : [...p, y]),  []);
  const toggleLang  = useCallback(l => setSelLangs(p  => p.includes(l) ? p.filter(x => x !== l) : [...p, l]),  []);
  const toggleGenre = useCallback(g => setSelGenres(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]), []);

  const clearAllFilters = useCallback(() => {
    setQuery(''); setSelYears([]); setSelLangs([]); setSelGenres([]);
    inputRef.current?.clear();
    Keyboard.dismiss();
  }, []);

  // ── Card press ─────────────────────────────────────────────────────────────
  const handleCardPress = useCallback((item) => {
    Keyboard.dismiss();
    navigation?.navigate?.('MovieDetail', { movieId: item.id });
  }, [navigation]);

  // ── Pagination on scroll ───────────────────────────────────────────────────
  const handleScrollEnd = useCallback(({ nativeEvent: ne }) => {
    const dist = ne.contentSize.height - ne.contentOffset.y - ne.layoutMeasurement.height;
    if (dist < rs(280) && !loadingMore && hasMore && !searching && !loading) {
      if (isSearchMode) performSearch(query, selYears, selLangs, selGenres, page);
      else loadDefaultMovies(page);
    }
  }, [loadingMore, hasMore, searching, loading, isSearchMode, query, selYears, selLangs, selGenres, page]);

  const hasActiveFilters = selYears.length > 0 || selLangs.length > 0 || selGenres.length > 0;

  // ── Row renderer ───────────────────────────────────────────────────────────
  const renderRow = useCallback(({ item: row, index }) => (
    <View style={[S.gridRow, { gap: GAP, paddingHorizontal: H_PAD, marginBottom: GAP }]}>
      {row.map(movie => <MovieCard key={movie.id} item={movie} onPress={handleCardPress} />)}
      {/* Pad incomplete last row */}
      {row.length < 3 && Array(3 - row.length).fill(0).map((_, k) => (
        <View key={`pad_${k}`} style={{ width: CARD_W }} />
      ))}
    </View>
  ), [handleCardPress, GAP, H_PAD, CARD_W]);

  const keyExtractor = useCallback((row, i) => `row_${i}_${row[0]?.id}`, []);

  // ── List Header ────────────────────────────────────────────────────────────
  const ListHeader = useMemo(() => (
    <View style={{ paddingHorizontal: H_PAD }}>
      {availYears.length > 0 && (
        <FilterSection title="Year" options={availYears} selected={selYears} onToggle={toggleYear} />
      )}
      {availLangs.length > 0 && (
        <FilterSection title="Language" options={availLangs} selected={selLangs} onToggle={toggleLang} />
      )}
      {availGenres.length > 0 && (
        <FilterSection title="Genre" options={availGenres} selected={selGenres} onToggle={toggleGenre} />
      )}
      {hasActiveFilters && (
        <TouchableOpacity onPress={clearAllFilters} style={S.clearFiltersBtn}>
          <LinearGradient colors={['rgba(255,45,85,0.20)', 'rgba(255,45,85,0.08)']}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
          <LinearGradient colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
          <Text style={S.clearFiltersTxt}>✕  Clear all filters</Text>
        </TouchableOpacity>
      )}
      <ErrorBanner
        message={error}
        onRetry={() => isSearchMode
          ? performSearch(query, selYears, selLangs, selGenres, 0)
          : loadDefaultMovies(0)}
      />
      <View style={S.resultHeader}>
        <View style={S.resultAccentBar} />
        <Text style={S.resultLabel}>
          {isSearchMode
            ? searching ? 'Searching…' : `${results.length} result${results.length !== 1 ? 's' : ''}`
            : 'Browse All'}
        </Text>
        {searching && <ActivityIndicator color={COLORS.accent || '#00FFB2'} size="small" style={{ marginLeft: rs(8) }} />}
      </View>
    </View>
  ), [availYears, availLangs, availGenres, selYears, selLangs, selGenres,
    hasActiveFilters, error, isSearchMode, results.length, searching, query,
    clearAllFilters, toggleYear, toggleLang, toggleGenre, H_PAD]);

  const bottomPad = Math.max(insets.bottom, 12) + rs(80);

  // ── Dismiss keyboard on background tap ────────────────────────────────────
  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
      <View style={S.root}>
        <StatusBar hidden />

        {/* ── Fixed Top Section ── */}
        <View style={[S.topSection, { paddingTop: insets.top + rs(8) }]}>
          {/* Deep glass background */}
          <LinearGradient
            colors={['rgba(5,18,14,0.98)', 'rgba(5,18,14,0.92)']}
            style={StyleSheet.absoluteFill}
          />
          {/* White glass sheen at top */}
          <LinearGradient
            colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Accent top line */}
          <LinearGradient
            colors={[COLORS.accent || '#00FFB2', COLORS.accentDim || '#00CC90', 'rgba(0,255,178,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={S.topAccentLine}
          />

          {/* ── Search Bar ── */}
          <View style={S.searchRow}>
            {/* 3D White Glass Input */}
            <View style={S.searchBarOuter}>
              {/* White glass outer border */}
              <LinearGradient
                colors={
                  query.length > 0
                    ? ['rgba(255,255,255,0.90)', 'rgba(255,255,255,0.55)', 'rgba(0,255,178,0.50)']
                    : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0.08)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
              />
              <View style={S.searchBarInner}>
                {/* Inner glass fill */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: rs(26) }]}
                />
                {/* Top shine */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.36)', 'rgba(255,255,255,0.0)']}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: rs(26) }]}
                />
                {/* Bottom depth */}
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']}
                  start={{ x: 0, y: 0.6 }} end={{ x: 0, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: rs(26) }]}
                />
                <Text style={S.searchIcon}>🔍</Text>
 <TextInput
  ref={inputRef}
  style={S.searchInput}
  placeholder="Search movies, series…"
  placeholderTextColor="rgba(255,255,255,0.42)"
  value={query}
  onChangeText={setQuery}
  returnKeyType="search"
  onSubmitEditing={() => {
    Keyboard.dismiss();
    const cleanQuery = query.trim();
    if (cleanQuery.length > 0) {
      // 1. Force the search to start immediately without waiting for the timer
      setDebouncedQuery(cleanQuery); 
      // 2. Save only the full sentence/word to history
      addToHistory(cleanQuery);
    }
  }}
  autoCorrect={false}
  autoCapitalize="none"
  selectionColor={COLORS.accent || '#00FFB2'}
/>
                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setQuery('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <View style={S.clearInputBtn}>
                      <LinearGradient colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.10)']}
                        style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]} />
                      <Text style={S.clearInputTxt}>✕</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {(query.length > 0 || hasActiveFilters) && (
              <TouchableOpacity onPress={clearAllFilters} style={S.cancelBtn}>
                <Text style={S.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Search History ── */}
          {history.length > 0 && !isSearchMode && (
            <View style={S.historySection}>
              <View style={S.historySectionHeader}>
                <Text style={S.historyLabel}>Recent</Text>
                <TouchableOpacity onPress={clearAllHistory}>
                  <Text style={S.historyClearAll}>Clear all</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.historyScroll}
                keyboardShouldPersistTaps="handled">
                {history.map(h => (
                  <HistoryTag key={h} text={h}
                    onPress={t => { setQuery(t); inputRef.current?.focus(); }}
                    onRemove={removeFromHistory}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bottom fade */}
          <LinearGradient
            colors={['rgba(5,18,14,0)', COLORS.bg || '#030F0C']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={S.topFade}
            pointerEvents="none"
          />
        </View>

        {/* ── Content ── */}
        {loading ? (
          <SearchSkeleton />
        ) : isSearchMode && results.length === 0 && !searching ? (
          <EmptyState query={query || 'selected filters'} />
        ) : (
          <FlatList
            ref={listRef}
            data={gridRows}
            renderItem={renderRow}
            keyExtractor={keyExtractor}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={{ paddingTop: rs(10), paddingBottom: bottomPad }}
            showsVerticalScrollIndicator={false}
            onScroll={handleScrollEnd}
            scrollEventThrottle={16}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={6}
            removeClippedSubviews={Platform.OS === 'android'}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListFooterComponent={loadingMore ? (
              <View style={S.loadMoreRow}>
                <ActivityIndicator color={COLORS.accent || '#00FFB2'} size="small" />
                <Text style={S.loadMoreTxt}>Loading more…</Text>
              </View>
            ) : null}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const { H_PAD, GAP, CARD_W, CARD_H } = getLayout();

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg || '#030F0C' },

  // Top fixed section
  topSection: {
    zIndex: 10,
    paddingHorizontal: rs(14),
    paddingBottom: rs(8),
    overflow: 'visible',
    // White glass shadow for depth
    shadowColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 1,
    shadowRadius: rs(16),
    elevation: 14,
  },
  topAccentLine: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: rs(1.5),
  },
  topFade: {
    position: 'absolute', bottom: -rs(20), left: 0, right: 0,
    height: rs(20), pointerEvents: 'none',
  },

  // 3D White Glass Search Bar
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(4) },
  searchBarOuter: {
    flex: 1,
    borderRadius: rs(28),
    padding: rs(1.5),
    // 3D shadow
    shadowColor: 'rgba(255,255,255,0.25)',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 1,
    shadowRadius: rs(14),
    elevation: 12,
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: rs(26),
    paddingHorizontal: rs(14),
    paddingVertical: rs(10),
    overflow: 'hidden',
  },
  searchIcon: { fontSize: rs(15), marginRight: rs(8) },
  searchInput: {
    flex: 1,
    // White text — key change
    color: '#FFFFFF',
    fontSize: rs(14),
    fontWeight: '600',
    letterSpacing: 0.2,
    paddingVertical: 0,
    // Text shadow for 3D depth
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: rs(1) },
    textShadowRadius: rs(3),
  },
  clearInputBtn: {
    width: rs(24), height: rs(24), borderRadius: rs(12),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginLeft: rs(6),
  },
  clearInputTxt: { color: 'rgba(255,255,255,0.80)', fontSize: rs(10), fontWeight: '800' },
  cancelBtn:    { marginLeft: rs(12), paddingVertical: rs(6) },
  cancelTxt:    { color: COLORS.accent || '#00FFB2', fontSize: rs(13), fontWeight: '700' },

  // History
  historySection: { marginTop: rs(10), marginBottom: rs(4) },
  historySectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: rs(8),
  },
  historyLabel:  { color: 'rgba(255,255,255,0.55)', fontSize: rs(11), fontWeight: '700', letterSpacing: 0.6 },
  historyClearAll: { color: COLORS.accent || '#00FFB2', fontSize: rs(11), fontWeight: '700' },
  historyScroll: { gap: rs(8), paddingRight: rs(16) },
  historyTag: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: rs(20), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    paddingLeft: rs(12), paddingRight: rs(6), paddingVertical: rs(6),
  },
  historyTagText: { maxWidth: rs(120) },
  historyTxt:     { color: 'rgba(255,255,255,0.75)', fontSize: rs(12), fontWeight: '500' },
  historyTagX:    { marginLeft: rs(8), padding: rs(2) },
  historyXTxt:    { color: 'rgba(255,255,255,0.40)', fontSize: rs(10), fontWeight: '800' },

  // Filters
  filterSection: { marginTop: rs(12) },
  filterSectionTitle: {
    color: 'rgba(255,255,255,0.50)', fontSize: rs(10), fontWeight: '800',
    letterSpacing: 1.0, marginBottom: rs(7), textTransform: 'uppercase',
  },
  filterScroll: { gap: rs(7), paddingRight: rs(16) },
  filterChip: {
    paddingHorizontal: rs(14), paddingVertical: rs(7),
    borderRadius: rs(20), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    minWidth: rs(44),
  },
  filterChipActive: { borderColor: 'rgba(0,255,178,0.50)' },
  filterChipTxt: { color: 'rgba(255,255,255,0.70)', fontSize: rs(12), fontWeight: '600', textAlign: 'center' },
  filterChipTxtActive: { color: '#030F0C', fontWeight: '800' },

  clearFiltersBtn: {
    alignSelf: 'flex-start', marginTop: rs(10),
    paddingHorizontal: rs(14), paddingVertical: rs(7),
    borderRadius: rs(20), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.35)',
  },
  clearFiltersTxt: { color: COLORS.red || '#FF2D55', fontSize: rs(12), fontWeight: '700' },

  // Result header
  resultHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: rs(16), marginBottom: rs(10),
  },
  resultAccentBar: {
    width: rs(3), height: rs(17), borderRadius: rs(2),
    backgroundColor: COLORS.accent || '#00FFB2', marginRight: rs(8),
    shadowColor: COLORS.accent || '#00FFB2',
    shadowOpacity: 0.9, shadowRadius: rs(6),
  },
  resultLabel: { color: '#FFFFFF', fontSize: rs(15), fontWeight: '800', letterSpacing: 0.2 },

  // Grid
  gridRow: { flexDirection: 'row' },

  // Movie card — 3D white glass
  card: {
    borderRadius: rs(13),
    padding: rs(1.5),
    // 3D white glass shadow
    shadowColor: 'rgba(255,255,255,0.30)',
    shadowOffset: { width: 0, height: rs(5) },
    shadowOpacity: 1,
    shadowRadius: rs(12),
    elevation: 14,
  },
  cardInner: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: COLORS.bg2 || '#0A1A14',
  },
  cardBadgeRow: {
    position: 'absolute', top: rs(5), left: rs(5),
    flexDirection: 'row', gap: rs(4),
  },
  cardBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: rs(6),
  },
  cardInfoPanel: {
    padding: rs(6),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: rs(8),
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: rs(9),
    fontWeight: '700',
    letterSpacing: 0.1,
    lineHeight: rs(12),
    // White text shadow for 3D
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: rs(1) },
    textShadowRadius: rs(3),
    marginBottom: rs(3),
  },
  cardNoImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: rs(8),
    backgroundColor: COLORS.bg2 || '#0A1A14',
  },

  // Badges
  seriesBadge: {
    paddingHorizontal: rs(5), paddingVertical: rs(2),
    borderRadius: rs(4), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.40)',
  },
  seriesTxt: { color: COLORS.red || '#FF2D55', fontSize: rs(6), fontWeight: '900', letterSpacing: 0.6 },
  trendBadge: {
    paddingHorizontal: rs(5), paddingVertical: rs(2),
    borderRadius: rs(4), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.32)',
  },
  trendTxt: { fontSize: rs(9) },
  newBadge: {
    position: 'absolute', bottom: rs(28), left: rs(5),
    paddingHorizontal: rs(5), paddingVertical: rs(2),
    borderRadius: rs(4), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,255,178,0.35)',
  },
  newTxt: { color: COLORS.accent || '#00FFB2', fontSize: rs(6), fontWeight: '900', letterSpacing: 0.5 },
  ratingChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: rs(4), paddingVertical: rs(1),
    borderRadius: rs(5), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.28)',
  },
  ratingTxt: { color: COLORS.gold || '#FFD700', fontSize: rs(7.5), fontWeight: '700' },

  // Error
  errorBanner: {
    marginTop: rs(10),
    paddingHorizontal: rs(14), paddingVertical: rs(10),
    borderRadius: rs(10), overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.26)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  errorTxt:      { color: '#FFFFFF', fontSize: rs(12), fontWeight: '600', flex: 1 },
  errorRetry:    {
    paddingHorizontal: rs(12), paddingVertical: rs(4),
    borderRadius: rs(8), borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  errorRetryTxt: { color: COLORS.accent || '#00FFB2', fontSize: rs(11), fontWeight: '800' },

  // Empty
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: rs(36), paddingTop: rs(70),
  },
  emptyIcon: {
    width: rs(86), height: rs(86), borderRadius: rs(43),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    marginBottom: rs(20),
    shadowColor: 'rgba(255,255,255,0.20)',
    shadowOffset: { width: 0, height: rs(6) },
    shadowOpacity: 1, shadowRadius: rs(16),
  },
  emptyTitle: { color: '#FFFFFF', fontSize: rs(17), fontWeight: '800', textAlign: 'center', marginBottom: rs(8) },
  emptySub:   { color: 'rgba(255,255,255,0.50)', fontSize: rs(13), textAlign: 'center', lineHeight: rs(19) },

  // Load more
  loadMoreRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: rs(20), gap: rs(10),
  },
  loadMoreTxt: { color: 'rgba(255,255,255,0.40)', fontSize: rs(12) },
});
