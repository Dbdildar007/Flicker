// src/screens/HomeScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, Animated,
  StatusBar, RefreshControl, Text, TouchableOpacity,
  Dimensions,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../data/theme';
import { moviesAPI } from '../lib/supabase';
import FlicksHeader from '../components/FlicksHeader';
import HeroCarousel from '../components/HeroCarousel';
import MovieRow from '../components/MovieRow';
import CategoryGrid from '../components/CategoryGrid';
import { NoInternet, Toast, SkeletonBox } from '../components/UIComponents';
import { useAppContext } from '../context/AppContext';

const { width: SW } = Dimensions.get('window');
const HEADER_H = 90;

// Skeleton home layout
function HomeSkeleton() {
  return (
    <View style={skelStyles.container}>
      {/* Hero skeleton */}
      <SkeletonBox width={SW} height={SW * 0.62} borderRadius={0} />
      <View style={{ padding: 20, marginTop: 20 }}>
        <SkeletonBox width={180} height={16} style={{ marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[0, 1, 2, 3].map(i => (
            <View key={i}>
              <SkeletonBox width={140} height={200} borderRadius={RADIUS.lg} />
              <SkeletonBox width={100} height={10} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
        <SkeletonBox width={160} height={16} style={{ marginTop: 28, marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[0, 1, 2, 3].map(i => (
            <SkeletonBox key={i} width={140} height={200} borderRadius={RADIUS.lg} />
          ))}
        </View>
      </View>
    </View>
  );
}

const skelStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
});

export default function HomeScreen({ navigation }) {
  const { toggleMyList, isInMyList, showToast, toastMsg } = useAppContext();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [isConnected, setIsConnected]     = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  const [featured, setFeatured]           = useState([]);
  const [trending, setTrending]           = useState([]);
  const [editorChoice, setEditorChoice]   = useState([]);
  const [newlyAdded, setNewlyAdded]       = useState([]);
  const [series, setSeries]               = useState([]);
  const [actionMovies, setActionMovies]   = useState([]);
  const [scifiMovies, setScifiMovies]     = useState([]);

  // Monitor network
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsub();
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoadingInitial(true);
    try {
      const [home, action, scifi] = await Promise.all([
        moviesAPI.getHomeData(),
        moviesAPI.getByGenre('Action'),
        moviesAPI.getByGenre('Sci-Fi'),
      ]);
      setFeatured(home.featured);
      setTrending(home.trending);
      setEditorChoice(home.editorChoice);
      setNewlyAdded(home.newlyAdded);
      setSeries(home.series);
      setActionMovies(action);
      setScifiMovies(scifi);
    } catch (err) {
      console.error('[HomeScreen loadData]', err);
      showToast('Failed to load content. Pull to refresh.');
    } finally {
      setLoadingInitial(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Skeleton shows for at least 1s for polish
    const t = setTimeout(() => loadData(), 800);
    return () => clearTimeout(t);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const goToDetail = (movie) => {
    navigation.navigate('MovieDetail', { movieId: movie.id, movie });
  };

  const goToGenre = (category) => {
    navigation.navigate('GenreScreen', { genre: category.label });
  };

  const handleSearch = () => navigation.navigate('SearchScreen');
  const handleProfile = () => navigation.navigate('ProfileScreen');

  // Not connected
  if (!isConnected) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <NoInternet onRetry={() => loadData()} />
      </View>
    );
  }

  // Loading skeleton (1s minimum)
  if (loadingInitial) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <HomeSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Glass Header */}
      <FlicksHeader
        scrollY={scrollY}
        onSearch={handleSearch}
        onProfile={handleProfile}
      />

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
            progressBackgroundColor={COLORS.bg2}
          />
        }
      >
        {/* HERO CAROUSEL */}
        <HeroCarousel
          items={featured.length ? featured : trending.slice(0, 6)}
          onWatchNow={goToDetail}
          onMyList={(m) => {
            toggleMyList(m.id);
            showToast(isInMyList(m.id) ? 'Removed from My List' : 'Added to My List ✓');
          }}
          isInMyList={isInMyList}
        />

        <View style={styles.content}>
          {/* Continue Watching (mocked with trending data + progress) */}
          {trending.length > 0 && (
            <ContinueWatchingRow
              data={trending.slice(0, 6)}
              onItemPress={goToDetail}
            />
          )}

          {/* Trending Now */}
          {trending.length > 0 && (
            <MovieRow
              title="Trending Now"
              data={trending}
              onSeeAll={() => navigation.navigate('GenreScreen', { genre: 'Trending' })}
              onItemPress={goToDetail}
              cardWidth={140}
              cardHeight={200}
              autoScroll={true}
              autoScrollSpeed={0.3}
            />
          )}

          {/* Category cards */}
          <CategoryGrid onCategoryPress={goToGenre} title="Browse Categories" />

          {/* New & Trending */}
          {newlyAdded.length > 0 && (
            <MovieRow
              title="New & Trending"
              data={newlyAdded}
              onSeeAll={() => navigation.navigate('GenreScreen', { genre: 'New' })}
              onItemPress={goToDetail}
              cardWidth={160}
              cardHeight={225}
            />
          )}

          {/* Series */}
          {series.length > 0 && (
            <MovieRow
              title="Top Series"
              data={series}
              onSeeAll={() => navigation.navigate('GenreScreen', { genre: 'Series' })}
              onItemPress={goToDetail}
              cardWidth={150}
              cardHeight={210}
              autoScroll={true}
              autoScrollSpeed={0.25}
            />
          )}

          {/* Action */}
          {actionMovies.length > 0 && (
            <MovieRow
              title="Action & Thrill"
              data={actionMovies}
              onSeeAll={() => navigation.navigate('GenreScreen', { genre: 'Action' })}
              onItemPress={goToDetail}
              cardWidth={140}
              cardHeight={200}
            />
          )}

          {/* Sci-Fi */}
          {scifiMovies.length > 0 && (
            <MovieRow
              title="Sci-Fi Universe"
              data={scifiMovies}
              onSeeAll={() => navigation.navigate('GenreScreen', { genre: 'Sci-Fi' })}
              onItemPress={goToDetail}
              cardWidth={140}
              cardHeight={200}
            />
          )}

          {/* Editor's Choice */}
          {editorChoice.length > 0 && (
            <MovieRow
              title="Editor's Choice"
              data={editorChoice}
              onSeeAll={() => navigation.navigate('GenreScreen', { genre: 'Editor' })}
              onItemPress={goToDetail}
              cardWidth={155}
              cardHeight={218}
            />
          )}

          {/* Another category row after categories */}
          {trending.length > 6 && (
            <MovieRow
              title="Popular on Flicks"
              data={trending.slice(6)}
              onSeeAll={() => navigation.navigate('GenreScreen', { genre: 'Popular' })}
              onItemPress={goToDetail}
              cardWidth={140}
              cardHeight={200}
            />
          )}

          <View style={{ height: 100 }} />
        </View>
      </Animated.ScrollView>

      {/* Toast */}
      <Toast message={toastMsg} />
    </View>
  );
}

// ── Continue Watching Row ──────────────────────────────────────────────────
import { Image } from 'react-native';
function ContinueWatchingRow({ data, onItemPress }) {
  return (
    <View style={cwStyles.container}>
      <View style={cwStyles.header}>
        <Text style={cwStyles.title}>Continue Watching</Text>
        <TouchableOpacity>
          <Text style={cwStyles.seeAll}>SEE ALL</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      >
        {data.slice(0, 5).map((movie, idx) => {
          const progress = 0.2 + (idx * 0.15) % 0.75; // mock progress
          return (
            <TouchableOpacity
              key={movie.id}
              onPress={() => onItemPress && onItemPress(movie)}
              activeOpacity={0.85}
              style={cwStyles.card}
            >
              {/* Thumbnail */}
              <Image
                source={{ uri: movie.hero_image || movie.poster || 'https://via.placeholder.com/280x150/030F0C/00FFB2?text=FLICKS' }}
                style={cwStyles.thumb}
                resizeMode="cover"
              />
              {/* Gradient overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(3,15,12,0.9)']}
                style={StyleSheet.absoluteFill}
              />
              {/* Glass border */}
              <View style={cwStyles.glassBorder} />

              {/* Play button */}
              <View style={cwStyles.playBtn}>
                <LinearGradient
                  colors={['rgba(0,255,178,0.35)', 'rgba(0,255,178,0.15)']}
                  style={cwStyles.playGrad}
                >
                  <Text style={cwStyles.playIcon}>▶</Text>
                </LinearGradient>
              </View>

              {/* Info */}
              <View style={cwStyles.info}>
                {movie.is_series && (
                  <Text style={cwStyles.seriesLabel}>SERIES</Text>
                )}
                <Text style={cwStyles.movieTitle} numberOfLines={1}>{movie.title}</Text>
                <Text style={cwStyles.ep} numberOfLines={1}>
                  {movie.is_series ? 'S1 E3 • 24 min left' : `${Math.round(progress * 100)}% watched`}
                </Text>
              </View>

              {/* Progress bar */}
              <View style={cwStyles.progressTrack}>
                <LinearGradient
                  colors={[COLORS.accent, COLORS.accentDim]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[cwStyles.progressFill, { width: `${progress * 100}%` }]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const cwStyles = StyleSheet.create({
  container: { marginBottom: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  title: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  seeAll: { color: COLORS.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  card: {
    width: 200,
    marginRight: 12,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    backgroundColor: COLORS.bg2,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  thumb: { width: 200, height: 115 },
  glassBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: COLORS.accent,
    opacity: 0.2,
  },
  playBtn: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: [{ translateX: -18 }, { translateY: -18 }],
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.accent + '55',
  },
  playGrad: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: COLORS.accent, fontSize: 14 },
  info: { padding: 10, paddingBottom: 6 },
  seriesLabel: { color: COLORS.accent, fontSize: 8, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  movieTitle: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  ep: { color: COLORS.textSub, fontSize: 10 },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 0 },
  progressFill: { height: '100%', borderRadius: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { paddingTop: 0 },
  content: { paddingTop: 20 },
});
