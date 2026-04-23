// src/screens/AllScreens.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, FlatList, Image, Animated, Dimensions,
  StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../data/theme';
import { moviesAPI, ratingsAPI } from '../lib/supabase';
import {
  SkeletonBox, RatingBadge, RatingStars, SeriesTag,
  GlassCard, Toast, GenreTag,
} from '../components/UIComponents';
import MovieCard from '../components/MovieCard';
import MovieRow from '../components/MovieRow';
import { useAppContext } from '../context/AppContext';

const { width: SW, height: SH } = Dimensions.get('window');

// ══════════════════════════════════════════════════════════════════════════════
// SEARCH SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export function SearchScreen({ navigation }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const data = await moviesAPI.search(q.trim());
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={[COLORS.bg, COLORS.bg2]} style={StyleSheet.absoluteFill} />

      {/* Search header */}
      <View style={srchStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={srchStyles.back}>
          <Text style={{ color: COLORS.accent, fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <View style={srchStyles.inputWrap}>
          <Text style={{ color: COLORS.textSub, fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search movies, series..."
            placeholderTextColor={COLORS.textMuted}
            style={srchStyles.input}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View style={{ padding: 20, gap: 16 }}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
              <SkeletonBox width={90} height={120} borderRadius={RADIUS.md} />
              <View style={{ flex: 1, gap: 8, paddingTop: 8 }}>
                <SkeletonBox width="70%" height={14} />
                <SkeletonBox width="50%" height={10} />
                <SkeletonBox width="40%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('MovieDetail', { movieId: item.id, movie: item })}
              activeOpacity={0.8}
              style={srchStyles.resultCard}
            >
              <Image
                source={{ uri: item.poster || 'https://via.placeholder.com/90x120/030F0C/00FFB2?text=FLICKS' }}
                style={srchStyles.resultImg}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(0,255,178,0.06)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <View style={srchStyles.resultInfo}>
                {item.is_series && <Text style={srchStyles.seriesLabel}>SERIES</Text>}
                <Text style={srchStyles.resultTitle}>{item.title}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {(item.genre || []).slice(0, 2).map(g => (
                    <GenreTag key={g} genre={g} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  {item.rating > 0 && <Text style={srchStyles.rating}>★ {Number(item.rating).toFixed(1)}</Text>}
                  <Text style={srchStyles.year}>{item.year}</Text>
                  {item.duration && <Text style={srchStyles.duration}>{item.duration}</Text>}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      ) : searched && !loading ? (
        <View style={srchStyles.empty}>
          <Text style={{ fontSize: 44, marginBottom: 14 }}>🎬</Text>
          <Text style={srchStyles.emptyTitle}>No results for "{query}"</Text>
          <Text style={srchStyles.emptySub}>Try a different title or genre</Text>
        </View>
      ) : (
        <View style={srchStyles.hint}>
          <Text style={{ fontSize: 44, marginBottom: 14 }}>🔍</Text>
          <Text style={srchStyles.hintText}>Search for movies, series, genres...</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOVIE DETAIL SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export function MovieDetailScreen({ route, navigation }) {
  const { movie: passedMovie, movieId } = route.params || {};
  const { session, toggleMyList, isInMyList, showToast, toastMsg } = useAppContext();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [movie, setMovie]   = useState(passedMovie || null);
  const [loading, setLoading] = useState(!passedMovie);
  const [userRating, setUserRating] = useState(0);
  const [avgRating, setAvgRating]   = useState(0);

  useEffect(() => {
    if (!passedMovie && movieId) {
      moviesAPI.getById(movieId).then(m => { setMovie(m); setLoading(false); }).catch(() => setLoading(false));
    }
    if (movieId && session?.user?.id) {
      ratingsAPI.getUserRating(session.user.id, movieId).then(setUserRating).catch(() => {});
      ratingsAPI.getAverageRating(movieId).then(setAvgRating).catch(() => {});
    }
  }, [movieId]);

  const handleRate = async (stars) => {
    if (!session?.user?.id) { showToast('Sign in to rate'); return; }
    setUserRating(stars);
    await ratingsAPI.upsertRating(session.user.id, movie.id, stars).catch(() => {});
    ratingsAPI.getAverageRating(movie.id).then(setAvgRating).catch(() => {});
    showToast(`Rated ${stars} ★`);
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (loading || !movie) {
    return (
      <View style={[styles.screen, { paddingTop: 60 }]}>
        <LinearGradient colors={[COLORS.bg, COLORS.bg2]} style={StyleSheet.absoluteFill} />
        <SkeletonBox width={SW} height={SW * 0.65} borderRadius={0} />
        <View style={{ padding: 20, gap: 14 }}>
          <SkeletonBox width="70%" height={26} />
          <SkeletonBox width="50%" height={14} />
          <SkeletonBox width="100%" height={80} borderRadius={12} />
        </View>
      </View>
    );
  }

  const inList = isInMyList(movie.id);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={[COLORS.bg, COLORS.bg2]} style={StyleSheet.absoluteFill} />

      {/* Sticky header */}
      <Animated.View style={[detailStyles.stickyHeader, { opacity: headerOpacity }]}>
        <LinearGradient
          colors={['rgba(3,15,12,0.95)', 'rgba(3,15,12,0.8)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={detailStyles.stickyTitle} numberOfLines={1}>{movie.title}</Text>
      </Animated.View>

      {/* Back button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={detailStyles.backBtn}>
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.3)']}
          style={detailStyles.backGrad}
        >
          <Text style={{ color: COLORS.text, fontSize: 18 }}>←</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      >
        {/* Hero image */}
        <View style={detailStyles.heroWrap}>
          <Image
            source={{ uri: movie.hero_image || movie.poster || 'https://via.placeholder.com/800x500/030F0C/00FFB2?text=' + movie.title }}
            style={detailStyles.heroImg}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(3,15,12,0.5)', COLORS.bg]}
            locations={[0.3, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
          {movie.is_series && (
            <View style={detailStyles.seriesChip}>
              <Text style={{ color: COLORS.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>SERIES</Text>
            </View>
          )}
        </View>

        <View style={detailStyles.body}>
          {/* Tags row */}
          <View style={detailStyles.tagsRow}>
            {(movie.genre || []).slice(0, 3).map(g => <GenreTag key={g} genre={g} />)}
          </View>

          {/* Title */}
          <Text style={detailStyles.title}>{movie.title}</Text>

          {/* Meta */}
          <View style={detailStyles.metaRow}>
            <Text style={detailStyles.year}>{movie.year}</Text>
            {movie.duration && <Text style={detailStyles.dot}>·</Text>}
            {movie.duration && <Text style={detailStyles.duration}>{movie.duration}</Text>}
            {movie.language && <Text style={detailStyles.dot}>·</Text>}
            {movie.language && <Text style={detailStyles.lang}>{movie.language}</Text>}
            {(movie.rating > 0 || avgRating > 0) && (
              <View style={detailStyles.ratingChip}>
                <Text style={detailStyles.ratingVal}>★ {Number(avgRating || movie.rating).toFixed(1)}</Text>
              </View>
            )}
          </View>

          {/* Buttons */}
          <View style={detailStyles.btnsRow}>
            {/* Watch / Play */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={detailStyles.playBtn}
              onPress={() => showToast('Playing ' + movie.title)}
            >
              <LinearGradient
                colors={[COLORS.accent + '30', COLORS.accent + '12']}
                style={detailStyles.playGrad}
              >
                <Text style={detailStyles.playIcon}>▶</Text>
                <Text style={detailStyles.playText}>Play Now</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* My List */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { toggleMyList(movie.id); showToast(inList ? 'Removed from list' : 'Added to My List ✓'); }}
              style={detailStyles.listBtn}
            >
              <LinearGradient
                colors={inList ? ['rgba(0,255,178,0.2)', 'rgba(0,255,178,0.08)'] : ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.2)']}
                style={detailStyles.listGrad}
              >
                <Text style={[detailStyles.listIcon, inList && { color: COLORS.accent }]}>{inList ? '✓' : '+'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity activeOpacity={0.8} style={detailStyles.listBtn} onPress={() => showToast('Share link copied!')}>
              <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.2)']} style={detailStyles.listGrad}>
                <Text style={detailStyles.listIcon}>⤴</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Description */}
          {movie.description ? (
            <View style={detailStyles.descBox}>
              <Text style={detailStyles.descLabel}>About</Text>
              <Text style={detailStyles.desc}>{movie.description}</Text>
            </View>
          ) : null}

          {/* User Rating */}
          <View style={detailStyles.ratingBox}>
            <Text style={detailStyles.ratingLabel}>Rate this {movie.is_series ? 'Series' : 'Movie'}</Text>
            <RatingStars rating={userRating} max={5} size={28} onRate={handleRate} />
            {userRating > 0 && (
              <Text style={{ color: COLORS.accentDim, fontSize: 12, marginTop: 6 }}>
                Your rating: {userRating}/5
              </Text>
            )}
          </View>
        </View>
      </Animated.ScrollView>
      <Toast message={toastMsg} />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GENRE / CATEGORY SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export function GenreScreen({ route, navigation }) {
  const { genre } = route.params || {};
  const [movies, setMovies]   = useState([]);
  const [loading, setLoading] = useState(true);
  const COL_W = (SW - 52) / 2;

  useEffect(() => {
    const fetch = async () => {
      try {
        let data = [];
        if (genre === 'Trending')  data = await moviesAPI.getTrending();
        else if (genre === 'Series') data = await moviesAPI.getSeries();
        else if (genre === 'New')  data = await moviesAPI.getNewlyAdded();
        else                       data = await moviesAPI.getByGenre(genre);
        setMovies(data);
      } catch { setMovies([]); }
      finally { setLoading(false); }
    };
    fetch();
  }, [genre]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={[COLORS.bg, COLORS.bg2]} style={StyleSheet.absoluteFill} />
      <View style={genreStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: COLORS.accent, fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={genreStyles.title}>{genre}</Text>
      </View>
      {loading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 }}>
          {[...Array(6)].map((_, i) => <SkeletonBox key={i} width={COL_W} height={COL_W * 1.4} borderRadius={RADIUS.lg} />)}
        </View>
      ) : movies.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🎬</Text>
          <Text style={{ color: COLORS.textSub, fontSize: 15 }}>No content in {genre} yet</Text>
        </View>
      ) : (
        <FlatList
          data={movies}
          keyExtractor={i => i.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 16, gap: 12, marginBottom: 12 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MovieCard
              movie={item}
              width={COL_W}
              height={COL_W * 1.42}
              onPress={() => navigation.navigate('MovieDetail', { movieId: item.id, movie: item })}
            />
          )}
        />
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOVIES TAB SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export function MoviesScreen({ navigation }) {
  const [movies, setMovies]   = useState([]);
  const [loading, setLoading] = useState(true);
  const COL_W = (SW - 52) / 2;

  useEffect(() => {
    moviesAPI.getMoviesOnly()
      .then(setMovies)
      .catch(() => setMovies([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={[COLORS.bg, COLORS.bg2]} style={StyleSheet.absoluteFill} />
      <View style={genreStyles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ color: COLORS.red, fontSize: 24, fontWeight: '900' }}>F</Text>
          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '900', letterSpacing: 2 }}>LICKS</Text>
        </View>
        <Text style={genreStyles.title}>Movies</Text>
      </View>
      {loading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 }}>
          {[...Array(6)].map((_, i) => <SkeletonBox key={i} width={COL_W} height={COL_W * 1.4} borderRadius={RADIUS.lg} />)}
        </View>
      ) : (
        <FlatList
          data={movies}
          keyExtractor={i => i.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 16, gap: 12, marginBottom: 12 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MovieCard
              movie={item}
              width={COL_W}
              height={COL_W * 1.42}
              onPress={() => navigation.navigate('MovieDetail', { movieId: item.id, movie: item })}
            />
          )}
        />
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FRIENDS TAB (placeholder)
// ══════════════════════════════════════════════════════════════════════════════
export function FriendsScreen() {
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <LinearGradient colors={[COLORS.bg, COLORS.bg2]} style={StyleSheet.absoluteFill} />
      <Text style={{ fontSize: 52, marginBottom: 20 }}>👥</Text>
      <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>Friends Activity</Text>
      <Text style={{ color: COLORS.textSub, fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 }}>
        See what your friends are watching.{'\n'}Social features coming soon!
      </Text>
      <View style={{ marginTop: 32, borderWidth: 1, borderColor: COLORS.glassBorder, borderRadius: RADIUS.full, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: COLORS.glass }}>
        <Text style={{ color: COLORS.accent, fontWeight: '700', fontSize: 13 }}>🚀  Coming Soon</Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE TAB
// ══════════════════════════════════════════════════════════════════════════════
export function ProfileScreen({ navigation }) {
  const { session } = useAppContext();

  return (
    <View style={[styles.screen]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#010C09', '#021510', '#030F0C']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={{ paddingTop: 54, paddingBottom: 100, paddingHorizontal: 24 }}>
        {/* Avatar */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <LinearGradient
            colors={[COLORS.accent + '40', COLORS.accent + '10']}
            style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.accent + '50', marginBottom: 14 }}
          >
            <Text style={{ fontSize: 44 }}>👤</Text>
          </LinearGradient>
          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '800' }}>
            {session?.user?.email?.split('@')[0] || 'Guest User'}
          </Text>
          <Text style={{ color: COLORS.textSub, fontSize: 13, marginTop: 4 }}>
            {session?.user?.email || 'Not signed in'}
          </Text>
        </View>

        {/* Menu items */}
        {[
          { icon: '🎬', label: 'My List',         sub: 'Saved movies & series' },
          { icon: '⭐', label: 'Ratings',         sub: 'Movies you\'ve rated' },
          { icon: '🔔', label: 'Notifications',   sub: 'Updates & new content' },
          { icon: '⚙️', label: 'Settings',        sub: 'Account & preferences' },
          { icon: '🎨', label: 'Appearance',      sub: 'Theme & display' },
          { icon: '🔒', label: 'Privacy',         sub: 'Data & permissions' },
        ].map((item, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.8}
            style={profStyles.menuItem}
            onPress={() => {}}
          >
            <LinearGradient
              colors={['rgba(0,255,178,0.06)', 'rgba(0,0,0,0.3)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={profStyles.menuIcon}>
              <Text style={{ fontSize: 22 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={profStyles.menuLabel}>{item.label}</Text>
              <Text style={profStyles.menuSub}>{item.sub}</Text>
            </View>
            <Text style={{ color: COLORS.accent, fontSize: 16, opacity: 0.6 }}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={profStyles.signOutBtn} activeOpacity={0.8}>
          <LinearGradient
            colors={['rgba(255,45,85,0.15)', 'rgba(255,45,85,0.06)']}
            style={profStyles.signOutGrad}
          >
            <Text style={{ color: COLORS.error, fontWeight: '700', fontSize: 14 }}>🚪  Sign Out</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
});

const srchStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  back: { padding: 4 },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bg2, borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  input: { flex: 1, color: COLORS.text, fontSize: 15, paddingVertical: 0 },
  resultCard: {
    flexDirection: 'row', gap: 14, padding: 12,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.glassBorder,
    backgroundColor: COLORS.bg2, overflow: 'hidden',
  },
  resultImg: { width: 82, height: 112, borderRadius: RADIUS.md },
  resultInfo: { flex: 1, paddingTop: 4 },
  seriesLabel: { color: COLORS.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  resultTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  rating: { color: COLORS.gold, fontWeight: '700', fontSize: 12 },
  year: { color: COLORS.textSub, fontSize: 12 },
  duration: { color: COLORS.textSub, fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: COLORS.textSub, fontSize: 13 },
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  hintText: { color: COLORS.textMuted, fontSize: 14 },
});

const detailStyles = StyleSheet.create({
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    paddingTop: 48, paddingBottom: 12, paddingHorizontal: 60,
    alignItems: 'center',
  },
  stickyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  backBtn: {
    position: 'absolute', top: 50, left: 16, zIndex: 101,
    borderRadius: RADIUS.full, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  backGrad: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  heroWrap: { width: SW, height: SW * 0.62 },
  heroImg: { width: '100%', height: '100%' },
  seriesChip: {
    position: 'absolute', top: 52, right: 16,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.glassBorder,
    backgroundColor: COLORS.glass, paddingHorizontal: 8, paddingVertical: 4,
  },
  body: { padding: 20, paddingTop: 16 },
  tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900', lineHeight: 34, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  year: { color: COLORS.textSub, fontSize: 13 },
  dot: { color: COLORS.textMuted, fontSize: 13 },
  duration: { color: COLORS.textSub, fontSize: 13 },
  lang: { color: COLORS.textSub, fontSize: 13 },
  ratingChip: { backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)' },
  ratingVal: { color: COLORS.gold, fontWeight: '800', fontSize: 12 },
  btnsRow: { flexDirection: 'row', gap: 12, marginBottom: 24, alignItems: 'center' },
  playBtn: { flex: 1, borderRadius: RADIUS.full, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.accent + '50' },
  playGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  playIcon: { color: COLORS.accent, fontSize: 16 },
  playText: { color: COLORS.accent, fontSize: 15, fontWeight: '800' },
  listBtn: { borderRadius: RADIUS.full, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  listGrad: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  listIcon: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  descBox: { marginBottom: 24 },
  descLabel: { color: COLORS.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  desc: { color: COLORS.textSub, fontSize: 14, lineHeight: 22 },
  ratingBox: { alignItems: 'flex-start', padding: 16, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.glassBorder, backgroundColor: COLORS.glass },
  ratingLabel: { color: COLORS.text, fontWeight: '700', fontSize: 14, marginBottom: 12 },
});

const genreStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.glassBorder },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
});

const profStyles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.glassBorder,
    marginBottom: 10, overflow: 'hidden',
  },
  menuIcon: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentBg, alignItems: 'center', justifyContent: 'center',
    marginRight: 14, borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  menuLabel: { color: COLORS.text, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  menuSub: { color: COLORS.textMuted, fontSize: 11 },
  signOutBtn: { marginTop: 24, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,45,85,0.3)' },
  signOutGrad: { alignItems: 'center', paddingVertical: 15 },
});
