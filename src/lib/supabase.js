// src/lib/supabase.js
// ─── Supabase client setup ────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

//const SUPABASE_URL  = 'https://cxbmopvqjmtnfiheqtob.supabase.co';
//const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4Ym1vcHZxam10bmZpaGVxdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjQzNjEsImV4cCI6MjA4Nzg0MDM2MX0.rVR2zu3RdBkBW19mrhusDoRPrprpJLJSvkBHQ4kFyK4';


// src/lib/supabase.js

//import { createClient } from '@supabase/supabase-js';
//import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Chunked storage adapter ──────────────────────────────────────────────────
// AsyncStorage silently fails when a single value exceeds ~2MB or ~18k properties.
// This adapter splits large values into 1KB chunks on write and reassembles on read.
const CHUNK_SIZE = 900; // characters per chunk (safe under AsyncStorage limits)

const ChunkedStorage = {
  async getItem(key) {
    try {
      // First try reading as a plain value
      const plain = await AsyncStorage.getItem(key);
      if (plain !== null) {
        // Check if it's a chunked value
        if (plain.startsWith('__CHUNKED__')) {
          const count = parseInt(plain.replace('__CHUNKED__', ''), 10);
          const keys  = Array.from({ length: count }, (_, i) => `${key}__chunk_${i}`);
          const pairs = await AsyncStorage.multiGet(keys);
          return pairs.map(([, v]) => v || '').join('');
        }
        return plain;
      }
      return null;
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    try {
      if (value.length <= CHUNK_SIZE) {
        // Small enough — store directly, clean up any old chunks
        await AsyncStorage.setItem(key, value);
        return;
      }
      // Split into chunks
      const chunks = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }
      const pairs = chunks.map((chunk, i) => [`${key}__chunk_${i}`, chunk]);
      await AsyncStorage.multiSet(pairs);
      // Store a manifest so getItem knows how many chunks to read
      await AsyncStorage.setItem(key, `__CHUNKED__${chunks.length}`);
    } catch (e) {
      console.warn('[ChunkedStorage.setItem]', e.message);
    }
  },

  async removeItem(key) {
    try {
      const plain = await AsyncStorage.getItem(key);
      if (plain?.startsWith('__CHUNKED__')) {
        const count = parseInt(plain.replace('__CHUNKED__', ''), 10);
        const keys  = Array.from({ length: count }, (_, i) => `${key}__chunk_${i}`);
        await AsyncStorage.multiRemove(keys);
      }
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('[ChunkedStorage.removeItem]', e.message);
    }
  },
};

const SUPABASE_URL = 'https://cxbmopvqjmtnfiheqtob.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4Ym1vcHZxam10bmZpaGVxdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjQzNjEsImV4cCI6MjA4Nzg0MDM2MX0.rVR2zu3RdBkBW19mrhusDoRPrprpJLJSvkBHQ4kFyK4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage:         ChunkedStorage,  // ← replaces AsyncStorage directly
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,        // ← add this for React Native
  },
  global: { fetch: (...args) => fetch(...args) },
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) return; 
});

//export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  //auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true },
  // Tune realtime + fetch timeout
  //global: { fetch: (...args) => fetch(...args) },
//});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const handle = (data, error, fallback = []) => {
  if (error) { console.warn('[Supabase]', error.message); return fallback; }
  return data ?? fallback;
};

// ─── MOVIES ───────────────────────────────────────────────────────────────────

/** Featured movies for hero carousel (is_featured = true) */
export const fetchFeatured = async () => {
  const { data, error } = await supabase
    .from('movies')
    .select('id,title,description,poster,hero_image,genre,category,year,rating,newly_added,is_series,is_featured')
    .eq('is_featured', true)
    .limit(10);
  return handle(data, error);
};

/**
 * All movies — used to build dynamic genre/category rows.
 * Paginated: pass `page` (0-based) and `pageSize`.
 */
export const fetchMoviesByPage = async (page = 0, pageSize = 40) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from('movies')
    .select('id,title,poster,rating,genre,category,is_series,is_trending,newly_added,is_upcoming,release_date,duration')
    .order('created_at', { ascending: false })
    .range(from, to);
  return handle(data, error);
};

/** Trending movies */
export const fetchTrending = async () => {
  const { data, error } = await supabase
    .from('movies')
    .select('id,title,poster,rating,genre,category,is_series,is_trending,newly_added')
    .eq('is_trending', true)
    .limit(20);
  return handle(data, error);
};

/** Upcoming movies (is_upcoming = true or newly_added = 'UPCOMING') */
export const fetchUpcoming = async () => {
  const { data, error } = await supabase
    .from('movies')
    .select('id,title,poster,genre,is_series,release_date,newly_added')
    .eq('is_upcoming', true)
    .order('release_date', { ascending: true })
    .limit(20);
  console.log('Upcoming movies:', data);
  return handle(data, error);
  
};

// ─── WATCH PROGRESS (Continue Watching) ──────────────────────────────────────

/**
 * Fetch continue-watching items for a user.
 * Joins watch_progress → movies in a single round-trip.
 */
export const fetchContinueWatching = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('watch_progress')
    .select(`
      id,
      current_time_sec,
      duration_sec,
      season_number,
      episode_number,
      last_watched,
      media_type,
      movies (
        id, title, poster, is_series, genre
      )
    `)
    .eq('user_id', userId)
    .order('last_watched', { ascending: false })
    .limit(20);

  if (error) { console.warn('[ContinueWatching]', error.message); return []; }

  // Flatten into a single object per item
  return (data ?? []).map((row) => ({
    progressId: row.id,
    movieId: row.movies?.id,
    title: row.movies?.title,
    poster: row.movies?.poster,
    is_series: row.movies?.is_series,
    genre: row.movies?.genre,
    progress: row.duration_sec > 0 ? row.current_time_sec / row.duration_sec : 0,
    currentSec: row.current_time_sec,
    durationSec: row.duration_sec,
    season: row.season_number,
    episode: row.episode_number,
    remaining: formatRemaining(row.current_time_sec, row.duration_sec),
    lastWatched: row.last_watched,
  }));
};

const formatRemaining = (current, duration) => {
  const rem = Math.max(duration - current, 0);
  const m = Math.floor(rem / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
};

// ─── WATCHLIST (My List) ──────────────────────────────────────────────────────

/** Fetch user's watchlist joined with movie details */
export const fetchWatchlist = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('watchlist')
    .select(`
      id,
      created_at,
      movies (
        id, title, poster, rating, is_series, genre, newly_added, is_trending
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { console.warn('[Watchlist]', error.message); return []; }
  return (data ?? []).map((row) => ({ watchId: row.id, ...row.movies }));
};

/** Add movie to watchlist */
export const addToWatchlist = async (userId, movieId) => {
  const { error } = await supabase
    .from('watchlist')
    .upsert({ user_id: userId, movie_id: movieId }, { onConflict: 'user_id,movie_id' });
  if (error) throw error;
};

/** Remove movie from watchlist */
export const removeFromWatchlist = async (userId, movieId) => {
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('movie_id', movieId);
  if (error) throw error;
};


export const authAPI = {
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    } catch (err) {
      console.error('[authAPI.getSession]', err);
      return null;
    }
  },
};
// ─── Build genre/category map from a flat movies array ───────────────────────
/**
 * Takes the raw movies array and returns:
 * { genres: string[], categories: string[], genreMap: {}, categoryMap: {} }
 * All keys come from DB data — nothing is hardcoded.
 */
export const buildContentMap = (movies = []) => {
  const genreMap = {};
  const categoryMap = {};

  movies.forEach((m) => {
    // genre column is text[] in Postgres
    (m.genre || []).forEach((g) => {
      if (!genreMap[g]) genreMap[g] = [];
      genreMap[g].push(m);
    });
    // category column is text[] in Postgres
    (m.category || []).forEach((c) => {
      if (!categoryMap[c]) categoryMap[c] = [];
      categoryMap[c].push(m);
    });
  });

  return {
    genres: Object.keys(genreMap),
    categories: Object.keys(categoryMap),
    genreMap,
    categoryMap,
  };
};
