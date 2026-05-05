// src/screens/SearchScreen.js
/**
 * Netflix-style Search Screen
 * ─────────────────────────────────────────────────────────────────
 * Features:
 *  • Debounced live search (250ms) from Supabase movies table
 *  • Search history with individual remove + tap-to-search
 *  • Year, Language, Genre multi-select filters (all from DB)
 *  • Staggered card grid: 2 rows of 3 → 1 banner → 3-col repeat
 *  • Infinite scroll pagination (20 per page)
 *  • Shared single shimmer loop (no callback leak)
 *  • ErrorBanner + empty state + loading skeleton
 *  • All card badges: SERIES, TRENDING, NEW, rating
 *  • React.memo + getItemLayout for zero measure overhead
 *  • Fully responsive via rs() scale helper
 *  • 3D hyped glass design using COLORS from theme.js
 */

import React, {
    useState, useEffect, useRef, useCallback,
    useMemo, memo,
} from 'react';
import {
    View, Text, TextInput, StyleSheet, FlatList,
    TouchableOpacity, Animated, Dimensions, StatusBar,
    ImageBackground, ActivityIndicator, ScrollView,
    KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, RADIUS, SHADOW } from '../data/theme';
import { supabase } from '../lib/supabase';
import { limitWords } from '../utils/helper'; 
// ─── Responsive ───────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const rs = (s) => {
    const w = Dimensions.get('window').width;
    if (w < 360) return Math.round(s * 0.86);
    if (w < 414) return Math.round(s * 0.93);
    if (w > 600) return Math.round(s * 1.1);
    return s;
};

// Grid card sizes
const COLS = 3;
const CARD_GAP = rs(8);
const H_PAD = rs(16);
const SMALL_W = (SW - H_PAD * 2 - CARD_GAP * (COLS - 1)) / COLS;
const SMALL_H = SMALL_W * 1.48;
const BANNER_W = SW * 0.75;
const BANNER_H = BANNER_W * 0.58;
const PAGE_SIZE = 21; // 7 × 3 keeps rows clean
const HISTORY_KEY = '@flicks_search_history';
const MAX_HISTORY = 12;

// ─── Shared shimmer (one loop, zero callback leak) ────────────────
const shimA = new Animated.Value(0);
let shimStarted = false;
const startShimmer = () => {
    if (shimStarted) return;
    shimStarted = true;
    Animated.loop(
        Animated.sequence([
            Animated.timing(shimA, { toValue: 1, duration: 850, useNativeDriver: true }),
            Animated.timing(shimA, { toValue: 0, duration: 850, useNativeDriver: true }),
        ])
    ).start();
};
const shimOpac = shimA.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.48] });

// ─── SkeletonBox ─────────────────────────────────────────────────
const SkeletonBox = memo(({ width, height, borderRadius = rs(10), style }) => (
    <Animated.View style={[{ width, height, borderRadius, overflow: 'hidden', opacity: shimOpac }, style]}>
        <LinearGradient
            colors={[COLORS.glass, COLORS.glassHigh, COLORS.glass]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
        />
        <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
            style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius, borderWidth: 1, borderColor: COLORS.glassBorder }]} />
    </Animated.View>
));

function SearchSkeleton() {
    return (
        <View style={S.skelWrap}>
            {/* 2 rows of 3 small cards */}
            {[0, 1].map(row => (
                <View key={row} style={S.skelRow}>
                    {[0, 1, 2].map(i => (
                        <SkeletonBox key={i} width={SMALL_W} height={SMALL_H} borderRadius={RADIUS.md} />
                    ))}
                </View>
            ))}
            {/* banner */}
            <View style={S.skelBannerRow}>
                <SkeletonBox width={BANNER_W} height={BANNER_H} borderRadius={RADIUS.lg} />
                <View style={{ gap: rs(8) }}>
                    <SkeletonBox width={SMALL_W - rs(4)} height={(BANNER_H - rs(8)) / 2} borderRadius={RADIUS.md} />
                    <SkeletonBox width={SMALL_W - rs(4)} height={(BANNER_H - rs(8)) / 2} borderRadius={RADIUS.md} />
                </View>
            </View>
            {/* 2 more rows */}
            {[0, 1].map(row => (
                <View key={`r2_${row}`} style={S.skelRow}>
                    {[0, 1, 2].map(i => (
                        <SkeletonBox key={i} width={SMALL_W} height={SMALL_H} borderRadius={RADIUS.md} />
                    ))}
                </View>
            ))}
        </View>
    );
}

// ─── Badges ──────────────────────────────────────────────────────
const SeriesBadge = memo(() => (
    <View style={S.seriesBadge}>
        <LinearGradient colors={['rgba(255,45,85,0.42)', 'rgba(255,45,85,0.18)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
        <Text style={S.seriesTxt}>SERIES</Text>
    </View>
));
const TrendingBadge = memo(() => (
    <View style={S.trendBadge}>
        <LinearGradient colors={['rgba(255,215,0,0.32)', 'rgba(255,215,0,0.10)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
        <Text style={S.trendTxt}>🔥</Text>
    </View>
));
const NewBadge = memo(({ label }) => (
    <View style={S.newBadge}>
        <LinearGradient colors={[COLORS.accentGlow, 'rgba(0,255,178,0.08)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
        <Text style={S.newTxt}>{label}</Text>
    </View>
));
const RatingChip = memo(({ rating }) => (
    <View style={S.ratingChip}>
        <LinearGradient colors={['rgba(255,215,0,0.22)', 'rgba(255,215,0,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(6) }]} />
        <Text style={S.ratingTxt}>⭐ {Number(rating).toFixed(1)}</Text>
    </View>
));

// ─── Small Card ──────────────────────────────────────────────────
const SmallCard = memo(({ item, onPress }) => {
    const scaleA = useRef(new Animated.Value(1)).current;
    const onIn = () => Animated.spring(scaleA, { toValue: 0.94, useNativeDriver: true, tension: 300, friction: 10 }).start();
    const onOut = () => Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();

    return (
        <TouchableOpacity onPress={() => onPress(item)} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
            <Animated.View style={[S.smallCard, { transform: [{ scale: scaleA }] }]}>
                {/* Glass border gradient */}
                <LinearGradient
                    colors={[COLORS.glassBorder, 'rgba(0,255,178,0.04)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: rs(11) }]}
                />
                <View style={S.smallCardInner}>
                    {item.poster ? (
                        <ImageBackground
                            source={{ uri: item.poster }}
                            style={S.smallImg}
                            imageStyle={{ borderTopLeftRadius: rs(10), borderTopRightRadius: rs(10) }}
                        >
                            <LinearGradient
                                colors={['rgba(3,15,12,0)', 'rgba(3,15,12,0.88)']}
                                style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]}
                            />
                            {item.is_series && <SeriesBadge />}
                            {item.is_trending && <TrendingBadge />}
                            {item.newly_added && <NewBadge label={item.newly_added} />}
                            {item.rating != null && <RatingChip rating={item.rating} />}
                        </ImageBackground>) : (
                        <View
                            style={[
                                S.contImg,
                                { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center', borderRadius: rs(10) },
                            ]}
                        >
                            <Text style={S.heroTitle}>{limitWords(item.title, 18)}</Text>
                        </View>
                    )}
                    {/* Glass info bottom */}
                    <View style={S.smallInfo}>
                        <LinearGradient
                            colors={['rgba(0,255,178,0.07)', 'rgba(3,15,12,0.55)']}
                            style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: rs(10), borderBottomRightRadius: rs(10) }]}
                        />
                        <Text style={S.smallTitle} numberOfLines={1}>{limitWords(item.title, 18)}</Text>
                    </View>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
});

// ─── Banner Card ─────────────────────────────────────────────────
const BannerCard = memo(({ item, onPress }) => {
    const scaleA = useRef(new Animated.Value(1)).current;
    const onIn = () => Animated.spring(scaleA, { toValue: 0.97, useNativeDriver: true, tension: 280, friction: 12 }).start();
    const onOut = () => Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 280, friction: 12 }).start();

    return (
        <TouchableOpacity onPress={() => onPress(item)} onPressIn={onIn} onPressOut={onOut} activeOpacity={1} style={S.bannerCardWrap}>
            <Animated.View style={[S.bannerCard, { transform: [{ scale: scaleA }] }]}>
                <LinearGradient
                    colors={[COLORS.glassBorder, 'rgba(0,255,178,0.06)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: rs(14) }]}
                />
                 {(item.hero_image || item.poster) && (
                <ImageBackground
                    source={{ uri: item.hero_image || item.poster }}
                    style={S.bannerImg}
                    imageStyle={{ borderRadius: rs(12) }}
                    resizeMode="cover"
                >
                    {/* Multi-stop gradient */}
                    <LinearGradient
                        colors={['rgba(3,15,12,0.05)', 'rgba(3,15,12,0.0)', 'rgba(3,15,12,0.55)', 'rgba(3,15,12,0.95)']}
                        locations={[0, 0.3, 0.65, 1]}
                        style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
                    />
                    <LinearGradient
                        colors={['rgba(3,15,12,0.50)', 'rgba(3,15,12,0.0)']}
                        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]}
                    />

                    {/* Badge row */}
                    <View style={S.bannerBadgeRow}>
                        {item.newly_added && (
                            <View style={S.bannerOrigBadge}>
                                <LinearGradient colors={[COLORS.accent, COLORS.accentDim]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
                                <Text style={S.bannerOrigTxt}>{item.newly_added}</Text>
                            </View>
                        )}
                        {item.is_trending && (
                            <View style={S.bannerTrendChip}>
                                <LinearGradient colors={['rgba(255,215,0,0.28)', 'rgba(255,215,0,0.08)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
                                <Text style={S.bannerTrendTxt}>🔥 TRENDING</Text>
                            </View>
                        )}
                    </View>

                    {/* Bottom content */}
                    <View style={S.bannerContent}>
                        {item.is_series && (
                            <View style={S.bannerSeriesBadge}>
                                <LinearGradient colors={['rgba(255,45,85,0.40)', 'rgba(255,45,85,0.16)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(4) }]} />
                                <Text style={S.bannerSeriesTxt}>SERIES</Text>
                            </View>
                        )}
                        <Text style={S.bannerTitle} numberOfLines={2}>{item.title}</Text>
                        <View style={S.bannerMeta}>
                            {item.genre?.slice(0, 2).map(g => <Text key={g} style={S.bannerMetaTxt}>· {g} </Text>)}
                            {item.year && <Text style={S.bannerMetaTxt}>· {item.year}</Text>}
                            {item.rating != null && <Text style={S.bannerRating}> ⭐ {Number(item.rating).toFixed(1)}</Text>}
                        </View>
                    </View>
                </ImageBackground>)}
            </Animated.View>
        </TouchableOpacity>
    );
});

// ─── Filter Chip ─────────────────────────────────────────────────
const FilterChip = memo(({ label, active, onPress }) => {
    const scaleA = useRef(new Animated.Value(1)).current;
    const onIn = () => Animated.spring(scaleA, { toValue: 0.92, useNativeDriver: true, tension: 350, friction: 10 }).start();
    const onOut = () => Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 350, friction: 10 }).start();

    return (
        <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
            <Animated.View style={[S.filterChip, active && S.filterChipActive, { transform: [{ scale: scaleA }] }]}>
                {active ? (
                    <>
                        <LinearGradient colors={[COLORS.accent, COLORS.accentDim]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                        <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                    </>
                ) : (
                    <>
                        <LinearGradient colors={['rgba(0,255,178,0.10)', 'rgba(0,255,178,0.04)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                        <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                    </>
                )}
                <Text style={[S.filterChipTxt, active && S.filterChipTxtActive]}>{label}</Text>
            </Animated.View>
        </TouchableOpacity>
    );
});

// ─── History Tag ─────────────────────────────────────────────────
const HistoryTag = memo(({ text, onPress, onRemove }) => (
    <View style={S.historyTag}>
        <LinearGradient colors={['rgba(0,255,178,0.10)', 'rgba(0,255,178,0.04)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
        <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
        <TouchableOpacity onPress={() => onPress(text)} activeOpacity={0.75} style={S.historyTagText}>
            <Text style={S.historyTxt} numberOfLines={1}>🕐  {text}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onRemove(text)} style={S.historyTagX} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={S.historyXTxt}>✕</Text>
        </TouchableOpacity>
    </View>
));

// ─── Empty State ─────────────────────────────────────────────────
function EmptyState({ query }) {
    return (
        <View style={S.emptyWrap}>
            <View style={S.emptyIcon}>
                <LinearGradient colors={['rgba(0,255,178,0.14)', 'rgba(0,255,178,0.05)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(50) }]} />
                <LinearGradient colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: rs(50) }]} />
                <Text style={{ fontSize: rs(38) }}>🔍</Text>
            </View>
            <Text style={S.emptyTitle}>No results for "{query}"</Text>
            <Text style={S.emptySub}>Try adjusting your filters or search with different keywords</Text>
        </View>
    );
}

// ─── Error Banner ─────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
    if (!message) return null;
    return (
        <View style={S.errorBanner}>
            <LinearGradient colors={['rgba(255,45,85,0.20)', 'rgba(255,45,85,0.07)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(10) }]} />
            <Text style={S.errorTxt}>⚠️  {message}</Text>
            {onRetry && (
                <TouchableOpacity onPress={onRetry} style={S.errorRetry}>
                    <LinearGradient colors={[COLORS.accentGlow, 'rgba(0,255,178,0.04)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(8) }]} />
                    <Text style={S.errorRetryTxt}>Retry</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// ─── Filter Section ───────────────────────────────────────────────
function FilterSection({ title, options, selected, onToggle }) {
    if (!options?.length) return null;
    return (
        <View style={S.filterSection}>
            <Text style={S.filterSectionTitle}>{title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterScroll}>
                {options.map(opt => (
                    <FilterChip
                        key={String(opt)}
                        label={String(opt)}
                        active={selected.includes(opt)}
                        onPress={() => onToggle(opt)}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

// ─── Grid layout logic ────────────────────────────────────────────
/**
 * Converts flat movie array into layout segments:
 * Segment type A: 3 small cards (rows 0,1 → first 6 items)
 * Segment type B: 1 banner + 2 small side cards (item 6,7,8)
 * Segment type C: 3 small cards again (repeat)
 *
 * We model this as a FlatList where each "row" is one render unit.
 */
function buildGridRows(movies) {
    const rows = [];
    let i = 0;
    let isFirstBlock = true;

    while (i < movies.length) {
        if (isFirstBlock && i < 6) {
            // First 2 groups of 3 small cards
            const chunk = movies.slice(i, i + 3);
            if (chunk.length) rows.push({ type: 'small3', items: chunk, id: `s3_${i}` });
            i += 3;
            if (i >= 6) isFirstBlock = false;
        } else if (!isFirstBlock && (rows.length - 2) % 4 === 0) {
            // Every 4th row after the first block → banner row
            const banner = movies[i];
            const side = movies.slice(i + 1, i + 3);
            rows.push({ type: 'banner', banner, side, id: `b_${i}` });
            i += 3;
        } else {
            const chunk = movies.slice(i, i + 3);
            if (chunk.length) rows.push({ type: 'small3', items: chunk, id: `s3_${i}` });
            i += 3;
        }
    }
    return rows;
}

// ─── Row renderers ─────────────────────────────────────────────────
const Small3Row = memo(({ items, onPress }) => (
    <View style={S.small3Row}>
        {items.map(item => <SmallCard key={item.id} item={item} onPress={onPress} />)}
        {/* Pad if less than 3 in the last row */}
        {items.length < 3 && Array(3 - items.length).fill(0).map((_, k) => (
            <View key={`pad_${k}`} style={{ width: SMALL_W }} />
        ))}
    </View>
));

const BannerRow = memo(({ row, onPress }) => {
    const { banner, side = [] } = row;
    return (
        <View style={S.bannerRow}>
            {banner && <BannerCard item={banner} onPress={onPress} />}
            <View style={S.bannerSide}>
                {side.map(item => <SmallCard key={item.id} item={item} onPress={onPress} />)}
            </View>
        </View>
    );
});

// ─── SEARCH SCREEN ────────────────────────────────────────────────
export default function SearchScreen({ navigation }) {
    const insets = useSafeAreaInsets();

    // ── State ────────────────────────────────────────────────────
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [defaultMovies, setDefaultMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [history, setHistory] = useState([]);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);

    // Filter state (all from DB)
    const [availYears, setAvailYears] = useState([]);
    const [availLangs, setAvailLangs] = useState([]);
    const [availGenres, setAvailGenres] = useState([]);
    const [selYears, setSelYears] = useState([]);
    const [selLangs, setSelLangs] = useState([]);
    const [selGenres, setSelGenres] = useState([]);

    const debounceRef = useRef(null);
    const inputRef = useRef(null);
    const isSearchMode = query.length > 0 || selYears.length > 0 || selLangs.length > 0 || selGenres.length > 0;
    const displayData = isSearchMode ? results : defaultMovies;
    const gridRows = useMemo(() => buildGridRows(displayData), [displayData]);

    // ── Boot ─────────────────────────────────────────────────────
    useEffect(() => {
        startShimmer();
        StatusBar.setHidden(true, 'fade');
        loadHistory();
        Promise.all([loadDefaultMovies(), loadFilterOptions()]);
        return () => StatusBar.setHidden(false, 'fade');
    }, []);

    // ── History ──────────────────────────────────────────────────
    const loadHistory = async () => {
        try {
            const raw = await AsyncStorage.getItem(HISTORY_KEY);
            if (raw) setHistory(JSON.parse(raw));
        } catch { }
    };

    const saveHistory = async (term, list) => {
        try { await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { }
    };

    const addToHistory = useCallback((term) => {
        if (!term.trim()) return;
        setHistory(prev => {
            const next = [term, ...prev.filter(h => h !== term)].slice(0, MAX_HISTORY);
            saveHistory(term, next);
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

    // ── Load filter options from DB ───────────────────────────────
    const loadFilterOptions = async () => {
        try {
            const { data } = await supabase
                .from('movies')
                .select('year,language,genre')
                .order('year', { ascending: false });

            if (data?.length) {
                const years = [...new Set(data.map(m => m.year).filter(Boolean))].sort((a, b) => b - a);
                const langs = [...new Set(data.map(m => m.language).filter(Boolean))].sort();
                const genreSet = new Set();
                data.forEach(m => (m.genre || []).forEach(g => genreSet.add(g)));
                const genres = [...genreSet].sort();
                setAvailYears(years);
                setAvailLangs(langs);
                setAvailGenres(genres);
            }
        } catch (e) { console.warn('filter options:', e.message); }
    };

    // ── Default movies (no search) ───────────────────────────────
    const loadDefaultMovies = async (pg = 0) => {
        if (pg === 0) setLoading(true);
        else setLoadingMore(true);
        setError('');
        try {
            const from = pg * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const { data, error: err } = await supabase
                .from('movies')
                .select('id,title,poster,hero_image,rating,genre,category,year,language,is_series,is_trending,newly_added')
                .order('created_at', { ascending: false })
                .range(from, to);

            if (err) throw err;
            if (pg === 0) setDefaultMovies(data ?? []);
            else setDefaultMovies(prev => [...prev, ...(data ?? [])]);
            setHasMore((data?.length ?? 0) === PAGE_SIZE);
            setPage(pg + 1);
        } catch (e) {
            setError('Could not load movies. Pull down to retry.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // ── Debounced search ──────────────────────────────────────────
    const performSearch = useCallback(async (q, years, langs, genres, pg = 0) => {
        const hasQuery = q.trim().length > 0;
        const hasFilters = years.length > 0 || langs.length > 0 || genres.length > 0;
        if (!hasQuery && !hasFilters) { setResults([]); return; }

        if (pg === 0) setSearching(true);
        else setLoadingMore(true);
        setError('');

        try {
            let qb = supabase
                .from('movies')
                .select('id,title,poster,hero_image,rating,genre,category,year,language,is_series,is_trending,newly_added')
                .range(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE - 1);

            if (hasQuery) qb = qb.ilike('title', `%${q.trim()}%`);
            if (years.length > 0) qb = qb.in('year', years);
            if (langs.length > 0) qb = qb.in('language', langs);
            if (genres.length > 0) qb = qb.overlaps('genre', genres);

            const { data, error: err } = await qb.order('rating', { ascending: false });
            if (err) throw err;

            if (pg === 0) setResults(data ?? []);
            else setResults(prev => [...prev, ...(data ?? [])]);
            setHasMore((data?.length ?? 0) === PAGE_SIZE);
            setPage(pg + 1);

            if (hasQuery && pg === 0) addToHistory(q.trim());
        } catch (e) {
            setError('Search failed. Please try again.');
        } finally {
            setSearching(false);
            setLoadingMore(false);
        }
    }, [addToHistory]);

    // ── Auto-search on query / filter change ─────────────────────
    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (!isSearchMode) { setResults([]); return; }
        debounceRef.current = setTimeout(() => {
            setPage(0);
            setHasMore(true);
            performSearch(query, selYears, selLangs, selGenres, 0);
        }, 250);
        return () => clearTimeout(debounceRef.current);
    }, [query, selYears, selLangs, selGenres]);

    // ── Toggle helpers ────────────────────────────────────────────
    const toggleYear = useCallback(y => setSelYears(p => p.includes(y) ? p.filter(x => x !== y) : [...p, y]), []);
    const toggleLang = useCallback(l => setSelLangs(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]), []);
    const toggleGenre = useCallback(g => setSelGenres(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]), []);

    const clearAllFilters = useCallback(() => {
        setQuery(''); setSelYears([]); setSelLangs([]); setSelGenres([]);
        inputRef.current?.clear();
    }, []);

    // ── Card press ────────────────────────────────────────────────
    const handleCardPress = useCallback((item) => {
        console.log('Movie card pressed:', {
            id: item.id,
            title: item.title,
            is_series: item.is_series,
            is_trending: item.is_trending,
            newly_added: item.newly_added,
            rating: item.rating,
            genre: item.genre,
        });
        // TODO: navigation.navigate('MovieDetail', { movieId: item.id, transition: 'zoom_from_card' });
    }, []);

    // ── Pagination on scroll end ──────────────────────────────────
    const handleScrollEnd = useCallback(({ nativeEvent: ne }) => {
        const dist = ne.contentSize.height - ne.contentOffset.y - ne.layoutMeasurement.height;
        if (dist < rs(300) && !loadingMore && hasMore && !searching && !loading) {
            if (isSearchMode) performSearch(query, selYears, selLangs, selGenres, page);
            else loadDefaultMovies(page);
        }
    }, [loadingMore, hasMore, searching, loading, isSearchMode, query, selYears, selLangs, selGenres, page]);

    const hasActiveFilters = selYears.length > 0 || selLangs.length > 0 || selGenres.length > 0;

    // ── Row renderer ─────────────────────────────────────────────
    const renderRow = useCallback(({ item: row }) => {
        if (row.type === 'banner') return <BannerRow row={row} onPress={handleCardPress} />;
        return <Small3Row items={row.items} onPress={handleCardPress} />;
    }, [handleCardPress]);

    const keyExtractor = useCallback((row) => row.id, []);

    // ─── Header component (non-scroll part above FlatList) ───────
    const ListHeader = useMemo(() => (
        <View>
            {/* Filter sections */}
            {availYears.length > 0 && (
                <FilterSection title="Release Year" options={availYears} selected={selYears} onToggle={toggleYear} />
            )}
            {availLangs.length > 0 && (
                <FilterSection title="Language" options={availLangs} selected={selLangs} onToggle={toggleLang} />
            )}
            {availGenres.length > 0 && (
                <FilterSection title="Genre" options={availGenres} selected={selGenres} onToggle={toggleGenre} />
            )}

            {/* Clear filters */}
            {hasActiveFilters && (
                <TouchableOpacity onPress={clearAllFilters} style={S.clearFiltersBtn}>
                    <LinearGradient colors={['rgba(255,45,85,0.18)', 'rgba(255,45,85,0.07)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(20) }]} />
                    <Text style={S.clearFiltersTxt}>✕  Clear all filters</Text>
                </TouchableOpacity>
            )}

            {/* Error */}
            <ErrorBanner message={error} onRetry={() => isSearchMode
                ? performSearch(query, selYears, selLangs, selGenres, 0)
                : loadDefaultMovies(0)
            } />

            {/* Section label */}
            <View style={S.resultHeader}>
                <View style={S.resultAccentBar} />
                <Text style={S.resultLabel}>
                    {isSearchMode
                        ? searching ? 'Searching…' : `${results.length} result${results.length !== 1 ? 's' : ''}`
                        : 'Browse All'}
                </Text>
                {searching && <ActivityIndicator color={COLORS.accent} size="small" style={{ marginLeft: rs(10) }} />}
            </View>
        </View>
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [availYears, availLangs, availGenres, selYears, selLangs, selGenres, hasActiveFilters, error, isSearchMode, results.length, searching, query]);

    const bottomPad = Math.max(insets.bottom, 12) + rs(74);

    return (
        <KeyboardAvoidingView
            style={S.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            <StatusBar hidden />

            {/* ── Fixed top section ── */}
            <View style={[S.topSection, { paddingTop: insets.top + rs(10) }]}>

                {/* Glass background for top section */}
                <LinearGradient
                    colors={['rgba(3,15,12,0.97)', 'rgba(3,15,12,0.90)']}
                    style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                    colors={['rgba(0,255,178,0.06)', 'rgba(0,255,178,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                {/* Top accent line */}
                <LinearGradient
                    colors={[COLORS.accent, COLORS.accentDim, 'rgba(0,255,178,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={S.topAccentLine}
                />

                {/* Search bar */}
                <View style={S.searchRow}>
                    <View style={S.searchBarWrap}>
                        {/* Glow border */}
                        <LinearGradient
                            colors={query.length > 0 ? [COLORS.accent, COLORS.accentDim] : [COLORS.glassBorder, 'rgba(0,255,178,0.06)']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={[StyleSheet.absoluteFill, { borderRadius: rs(28) }]}
                        />
                        <View style={S.searchBarInner}>
                            <LinearGradient
                                colors={['rgba(0,255,178,0.08)', 'rgba(3,15,12,0.6)']}
                                style={[StyleSheet.absoluteFill, { borderRadius: rs(26) }]}
                            />
                            <LinearGradient
                                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
                                start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
                                style={[StyleSheet.absoluteFill, { borderRadius: rs(26) }]}
                            />
                            <Text style={S.searchIcon}>🔍</Text>
                            <TextInput
                                ref={inputRef}
                                style={S.searchInput}
                                placeholder="Search movies, series…"
                                placeholderTextColor={COLORS.textMuted}
                                value={query}
                                onChangeText={setQuery}
                                returnKeyType="search"
                                onSubmitEditing={() => { Keyboard.dismiss(); if (query.trim()) addToHistory(query.trim()); }}
                                autoCorrect={false}
                                autoCapitalize="none"
                                selectionColor={COLORS.accent}
                            />
                            {query.length > 0 && (
                                <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <View style={S.clearInputBtn}>
                                        <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']} style={[StyleSheet.absoluteFill, { borderRadius: rs(12) }]} />
                                        <Text style={S.clearInputTxt}>✕</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Cancel button */}
                    {(query.length > 0 || hasActiveFilters) && (
                        <TouchableOpacity onPress={() => { clearAllFilters(); Keyboard.dismiss(); }} style={S.cancelBtn}>
                            <Text style={S.cancelTxt}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Search history */}
                {history.length > 0 && !isSearchMode && (
                    <View style={S.historySection}>
                        <View style={S.historySectionHeader}>
                            <Text style={S.historyLabel}>Recent Searches</Text>
                            <TouchableOpacity onPress={() => { setHistory([]); AsyncStorage.removeItem(HISTORY_KEY).catch(() => { }); }}>
                                <Text style={S.historyClearAll}>Clear all</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.historyScroll}>
                            {history.map(h => (
                                <HistoryTag
                                    key={h} text={h}
                                    onPress={t => { setQuery(t); inputRef.current?.focus(); }}
                                    onRemove={removeFromHistory}
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Bottom gradient fade */}
                <LinearGradient
                    colors={['rgba(3,15,12,0)', COLORS.bg]}
                    start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                    style={S.topFade}
                    pointerEvents="none"
                />
            </View>

            {/* ── Scrollable content ── */}
            {loading ? (
                <View style={[S.skelScrollWrap, { paddingTop: rs(8) }]}>
                    <SearchSkeleton />
                </View>
            ) : isSearchMode && results.length === 0 && !searching ? (
                <EmptyState query={query || 'selected filters'} />
            ) : (
                <FlatList
                    data={gridRows}
                    renderItem={renderRow}
                    keyExtractor={keyExtractor}
                    ListHeaderComponent={ListHeader}
                    contentContainerStyle={[S.listContent, { paddingBottom: bottomPad }]}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScrollEnd}
                    scrollEventThrottle={16}
                    initialNumToRender={6}
                    maxToRenderPerBatch={6}
                    windowSize={5}
                    removeClippedSubviews
                    keyboardShouldPersistTaps="handled"
                    ListFooterComponent={loadingMore ? (
                        <View style={S.loadMoreRow}>
                            <ActivityIndicator color={COLORS.accent} size="small" />
                            <Text style={S.loadMoreTxt}>Loading more…</Text>
                        </View>
                    ) : null}
                />
            )}
        </KeyboardAvoidingView>
    );
}

// ─── STYLES ───────────────────────────────────────────────────────
const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },

    // Top section
    topSection: {
        zIndex: 10,
        paddingHorizontal: rs(16),
        paddingBottom: rs(6),
        overflow: 'visible',
    },
    topAccentLine: {
        position: 'absolute', top: 0, left: 0, right: 0,
        height: rs(1.5),
    },
    topFade: {
        position: 'absolute', bottom: -rs(18), left: 0, right: 0,
        height: rs(18), pointerEvents: 'none',
    },

    // Search bar
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        marginBottom: rs(4),
    },
    searchBarWrap: {
        flex: 1, borderRadius: rs(28),
        padding: rs(1.5),
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: rs(3) },
        shadowOpacity: 0.3, shadowRadius: rs(10),
        elevation: 10,
    },
    searchBarInner: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: rs(26),
        paddingHorizontal: rs(14), paddingVertical: rs(10),
        overflow: 'hidden',
    },
    searchIcon: { fontSize: rs(15), marginRight: rs(8) },
    searchInput: {
        flex: 1,
        color: COLORS.text,
        fontSize: rs(14),
        fontWeight: '500',
        letterSpacing: 0.2,
        paddingVertical: 0,
    },
    clearInputBtn: {
        width: rs(22), height: rs(22), borderRadius: rs(11),
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', marginLeft: rs(6),
    },
    clearInputTxt: { color: COLORS.textSub, fontSize: rs(10), fontWeight: '700' },
    cancelBtn: { marginLeft: rs(12), paddingVertical: rs(6) },
    cancelTxt: { color: COLORS.accent, fontSize: rs(13), fontWeight: '700' },

    // History
    historySection: { marginTop: rs(10), marginBottom: rs(4) },
    historySectionHeader: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: rs(8),
    },
    historyLabel: { color: COLORS.textSub, fontSize: rs(12), fontWeight: '700', letterSpacing: 0.5 },
    historyClearAll: { color: COLORS.accent, fontSize: rs(11), fontWeight: '700' },
    historyScroll: { gap: rs(8), paddingRight: rs(16) },
    historyTag: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: rs(20), overflow: 'hidden',
        borderWidth: 1, borderColor: COLORS.glassBorder,
        paddingLeft: rs(12), paddingRight: rs(6),
        paddingVertical: rs(6),
    },
    historyTagText: { maxWidth: rs(120) },
    historyTxt: { color: COLORS.textSub, fontSize: rs(12), fontWeight: '500' },
    historyTagX: { marginLeft: rs(8), padding: rs(2) },
    historyXTxt: { color: COLORS.textMuted, fontSize: rs(10), fontWeight: '700' },

    // Filters
    filterSection: { marginTop: rs(15) },
    filterSectionTitle: {
        color: COLORS.textSub, fontSize: rs(11), fontWeight: '700',
        letterSpacing: 0.8, marginBottom: rs(8), textTransform: 'uppercase',
    },
    filterScroll: { gap: rs(8), paddingRight: rs(16) },
    filterChip: {
        paddingHorizontal: rs(14), paddingVertical: rs(7),
        borderRadius: rs(20), overflow: 'hidden',
        borderWidth: 1, borderColor: COLORS.glassBorder,
        minWidth: rs(48),
    },
    filterChipActive: { borderColor: COLORS.accentDim },
    filterChipTxt: {
        color: COLORS.textSub, fontSize: rs(12), fontWeight: '600',
        textAlign: 'center',
    },
    filterChipTxtActive: { color: COLORS.bg, fontWeight: '800' },

    // Clear filters
    clearFiltersBtn: {
        alignSelf: 'flex-start',
        marginTop: rs(12),
        paddingHorizontal: rs(14), paddingVertical: rs(7),
        borderRadius: rs(20), overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,45,85,0.30)',
    },
    clearFiltersTxt: { color: COLORS.red, fontSize: rs(12), fontWeight: '700' },

    // Results header
    resultHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: rs(16), marginTop: rs(18), marginBottom: rs(12),
    },
    resultAccentBar: {
        width: rs(3), height: rs(18), borderRadius: rs(2),
        backgroundColor: COLORS.accent, marginRight: rs(8),
        shadowColor: COLORS.accent, shadowOpacity: 0.8, shadowRadius: rs(6),
    },
    resultLabel: {
        color: COLORS.text, fontSize: rs(16), fontWeight: '800', letterSpacing: 0.2,
    },

    // List
    skelScrollWrap: { flex: 1 },
    listContent: { paddingHorizontal: H_PAD },
    skelWrap: { padding: H_PAD, gap: rs(10) },
    skelRow: { flexDirection: 'row', gap: CARD_GAP, marginBottom: rs(8) },
    skelBannerRow: { flexDirection: 'row', gap: CARD_GAP, marginBottom: rs(8) },

    // Grid rows
    small3Row: {
        flexDirection: 'row',
        gap: CARD_GAP,
        marginBottom: CARD_GAP,
    },
    bannerRow: {
        flexDirection: 'row',
        gap: CARD_GAP,
        marginBottom: CARD_GAP,
        alignItems: 'flex-start',
    },
    bannerCardWrap: { width: BANNER_W },
    bannerSide: {
        flex: 1,
        gap: CARD_GAP,
        justifyContent: 'space-between',
    },

    // Small card
    smallCard: {
        width: SMALL_W,
        borderRadius: rs(11), overflow: 'hidden',
        borderWidth: 1, borderColor: COLORS.glassBorder,
        ...SHADOW.dark,
    },
    smallCardInner: { borderRadius: rs(10), overflow: 'hidden', backgroundColor: COLORS.bg2 },
    smallImg: { width: '100%', height: SMALL_H * 0.72 },
    smallInfo: {
        padding: rs(7), overflow: 'hidden',
        minHeight: SMALL_H * 0.28,
    },
    smallTitle: {
        color: COLORS.text, fontSize: rs(10), fontWeight: '700', lineHeight: rs(13),
    },

    // Banner card
    bannerCard: {
        width: BANNER_W, borderRadius: rs(14),
        overflow: 'hidden',
        borderWidth: 1, borderColor: COLORS.glassBorder,
        ...SHADOW.dark,
    },
    bannerImg: { width: '100%', height: BANNER_H },
    bannerBadgeRow: {
        position: 'absolute', top: rs(8), left: rs(8),
        flexDirection: 'row', gap: rs(6),
    },
    bannerOrigBadge: {
        paddingHorizontal: rs(8), paddingVertical: rs(3),
        borderRadius: rs(4), overflow: 'hidden',
    },
    bannerOrigTxt: { color: COLORS.bg, fontSize: rs(8), fontWeight: '900', letterSpacing: 0.8 },
    bannerTrendChip: {
        paddingHorizontal: rs(7), paddingVertical: rs(3),
        borderRadius: rs(4), overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,215,0,0.30)',
    },
    bannerTrendTxt: { color: COLORS.gold, fontSize: rs(8), fontWeight: '800' },
    bannerContent: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: rs(10),
    },
    bannerSeriesBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: rs(7), paddingVertical: rs(2),
        borderRadius: rs(4), overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,45,85,0.38)',
        marginBottom: rs(5),
    },
    bannerSeriesTxt: { color: COLORS.red, fontSize: rs(7), fontWeight: '900', letterSpacing: 0.8 },
    bannerTitle: {
        color: COLORS.text, fontSize: rs(14), fontWeight: '800',
        letterSpacing: -0.3, lineHeight: rs(18), marginBottom: rs(5),
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: rs(1) }, textShadowRadius: rs(4),
    },
    bannerMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    bannerMetaTxt: { color: COLORS.textSub, fontSize: rs(10), marginRight: rs(2) },
    bannerRating: { color: COLORS.gold, fontSize: rs(10), fontWeight: '700' },

    // Badges on small card
    seriesBadge: {
        position: 'absolute', top: rs(5), left: rs(5),
        paddingHorizontal: rs(5), paddingVertical: rs(2),
        borderRadius: rs(4), overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,45,85,0.38)',
    },
    seriesTxt: { color: COLORS.red, fontSize: rs(6), fontWeight: '900', letterSpacing: 0.6 },
    trendBadge: {
        position: 'absolute', top: rs(5), right: rs(5),
        paddingHorizontal: rs(5), paddingVertical: rs(2),
        borderRadius: rs(4), overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,215,0,0.30)',
    },
    trendTxt: { color: COLORS.gold, fontSize: rs(9) },
    newBadge: {
        position: 'absolute', bottom: rs(25), left: rs(5),
        paddingHorizontal: rs(5), paddingVertical: rs(2),
        borderRadius: rs(4), overflow: 'hidden',
        borderWidth: 1, borderColor: COLORS.glassBorder,
    },
    newTxt: { color: COLORS.accent, fontSize: rs(6), fontWeight: '900', letterSpacing: 0.6 },
    ratingChip: {
        position: 'absolute', bottom: rs(5), right: rs(5),
        paddingHorizontal: rs(5), paddingVertical: rs(2),
        borderRadius: rs(6), overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,215,0,0.24)',
    },
    ratingTxt: { color: COLORS.gold, fontSize: rs(8), fontWeight: '700' },

    // Error
    errorBanner: {
        marginHorizontal: rs(16), marginTop: rs(10),
        paddingHorizontal: rs(14), paddingVertical: rs(10),
        borderRadius: rs(10), overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,45,85,0.24)',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    errorTxt: { color: COLORS.text, fontSize: rs(12), fontWeight: '600', flex: 1 },
    errorRetry: {
        paddingHorizontal: rs(12), paddingVertical: rs(4),
        borderRadius: rs(8), overflow: 'hidden',
        borderWidth: 1, borderColor: COLORS.glassBorder,
    },
    errorRetryTxt: { color: COLORS.accent, fontSize: rs(11), fontWeight: '800' },

    // Empty
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: rs(32), paddingTop: rs(60) },
    emptyIcon: {
        width: rs(90), height: rs(90), borderRadius: rs(45),
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', borderWidth: 1, borderColor: COLORS.glassBorder,
        marginBottom: rs(22), ...SHADOW.teal,
    },
    emptyTitle: {
        color: COLORS.text, fontSize: rs(18), fontWeight: '800',
        textAlign: 'center', marginBottom: rs(10),
    },
    emptySub: {
        color: COLORS.textSub, fontSize: rs(13), textAlign: 'center', lineHeight: rs(20),
    },

    // Load more
    loadMoreRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: rs(20), gap: rs(10),
    },
    loadMoreTxt: { color: COLORS.textMuted, fontSize: rs(12) },
});
