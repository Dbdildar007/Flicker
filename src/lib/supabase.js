// src/lib/supabase.js
// ─── Supabase client + ALL movie/search APIs ─────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Chunked storage adapter ──────────────────────────────────────────────────
// AsyncStorage silently fails when a single value exceeds ~2 MB.
// This adapter splits large values into 900-char chunks.
const CHUNK_SIZE = 900;

const ChunkedStorage = {
  async getItem(key) {
    try {
      const plain = await AsyncStorage.getItem(key);
      if (plain === null) return null;
      if (plain.startsWith('__CHUNKED__')) {
        const count = parseInt(plain.replace('__CHUNKED__', ''), 10);
        const keys  = Array.from({ length: count }, (_, i) => `${key}__chunk_${i}`);
        const pairs = await AsyncStorage.multiGet(keys);
        return pairs.map(([, v]) => v || '').join('');
      }
      return plain;
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    try {
      if (value.length <= CHUNK_SIZE) {
        await AsyncStorage.setItem(key, value);
        return;
      }
      const chunks = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }
      const pairs = chunks.map((chunk, i) => [`${key}__chunk_${i}`, chunk]);
      await AsyncStorage.multiSet(pairs);
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

// ── Client ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://cxbmopvqjmtnfiheqtob.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4Ym1vcHZxam10bmZpaGVxdG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjQzNjEsImV4cCI6MjA4Nzg0MDM2MX0.rVR2zu3RdBkBW19mrhusDoRPrprpJLJSvkBHQ4kFyK4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: ChunkedStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: (...args) => fetch(...args) },
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) return;
});

// ── Internal error handler ────────────────────────────────────────────────────
const handle = (data, error, fallback = []) => {
  if (error) { console.warn('[Supabase]', error.message); return fallback; }
  return data ?? fallback;
};

// ─────────────────────────────────────────────────────────────────────────────
// MOVIE FIELD PRESETS  (avoids repeating long select strings)
// ─────────────────────────────────────────────────────────────────────────────
const MOVIE_CARD_FIELDS =
  'id,title,poster,rating,genre,category,is_series,is_trending,newly_added,year,language,duration';

const MOVIE_DETAIL_FIELDS =
  'id,title,description,poster,hero_image,genre,category,year,rating,newly_added,is_series,is_featured,is_trending,duration,language,release_date';

const MOVIE_SEARCH_FIELDS =
  'id,title,poster,hero_image,rating,genre,category,year,language,is_series,is_trending,newly_added';

// ─────────────────────────────────────────────────────────────────────────────
// ── AUTH API ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
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

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ── MOVIES ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/** Featured movies for hero carousel */
export const fetchFeatured = async () => {
  const { data, error } = await supabase
    .from('movies')
    .select(MOVIE_DETAIL_FIELDS)
    .eq('is_featured', true)
    .limit(10);
  return handle(data, error);
};

/**
 * Paginated all-movies (used in Browse / Search default state).
 * page = 0-based index, pageSize = rows per fetch.
 */
export const fetchMoviesByPage = async (page = 0, pageSize = 30) => {
  const from = page * pageSize;
  const to   = from + pageSize - 1;
  const { data, error } = await supabase
    .from('movies')
    .select(MOVIE_CARD_FIELDS)
    .order('created_at', { ascending: false })
    .range(from, to);
  return handle(data, error);
};

/** Trending movies */
export const fetchTrending = async (limit = 20) => {
  const { data, error } = await supabase
    .from('movies')
    .select(MOVIE_CARD_FIELDS)
    .eq('is_trending', true)
    .limit(limit);
  return handle(data, error);
};

/** Upcoming movies */
export const fetchUpcoming = async (limit = 20) => {
  const { data, error } = await supabase
    .from('movies')
    .select('id,title,poster,genre,is_series,release_date,newly_added')
    .eq('is_upcoming', true)
    .order('release_date', { ascending: true })
    .limit(limit);
  return handle(data, error);
};

/** Single movie detail */
export const fetchMovieById = async (id) => {
  const { data, error } = await supabase
    .from('movies')
    .select(MOVIE_DETAIL_FIELDS)
    .eq('id', id)
    .single();
  return handle(data, error, null);
};

// ─────────────────────────────────────────────────────────────────────────────
// ── SEARCH API  (all search logic lives here) ─────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paginated full-text + filter search.
 *
 * @param {object} params
 * @param {string}   params.query       - Text query (ilike match on title)
 * @param {number[]} params.years       - Selected release years
 * @param {string[]} params.languages   - Selected languages
 * @param {string[]} params.genres      - Selected genres
 * @param {number}   params.page        - 0-based page index
 * @param {number}   params.pageSize    - Items per page (default 21)
 * @returns {{ data: Movie[], hasMore: boolean, error: string|null }}
 */
export const searchMovies = async ({
  query    = '',
  years    = [],
  languages = [],
  genres   = [],
  page     = 0,
  pageSize = 21,
} = {}) => {
  const from = page * pageSize;
  const to   = from + pageSize - 1;

  try {
    let qb = supabase
      .from('movies')
      .select(MOVIE_SEARCH_FIELDS)
      .range(from, to)
      .order('rating', { ascending: false });

    if (query.trim())      qb = qb.ilike('title', `%${query.trim()}%`);
    if (years.length)      qb = qb.in('year', years);
    if (languages.length)  qb = qb.in('language', languages);
    if (genres.length)     qb = qb.overlaps('genre', genres);

    const { data, error } = await qb;
    if (error) throw error;

    return {
      data:    data ?? [],
      hasMore: (data?.length ?? 0) === pageSize,
      error:   null,
    };
  } catch (e) {
    console.warn('[searchMovies]', e.message);
    return { data: [], hasMore: false, error: e.message };
  }
};

/**
 * Fetch all distinct filter options in ONE round-trip.
 * Returns { years, languages, genres }
 */
export const fetchFilterOptions = async () => {
  try {
    const { data, error } = await supabase
      .from('movies')
      .select('year,language,genre');

    if (error) throw error;

    const years = [...new Set((data ?? []).map(m => m.year).filter(Boolean))]
      .sort((a, b) => b - a);

    const languages = [...new Set((data ?? []).map(m => m.language).filter(Boolean))]
      .sort();

    const genreSet = new Set();
    (data ?? []).forEach(m => (m.genre || []).forEach(g => genreSet.add(g)));
    const genres = [...genreSet].sort();

    return { years, languages, genres };
  } catch (e) {
    console.warn('[fetchFilterOptions]', e.message);
    return { years: [], languages: [], genres: [] };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── WATCH PROGRESS ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const _fmtRemaining = (current, duration) => {
  const rem = Math.max(duration - current, 0);
  const m   = Math.floor(rem / 60);
  const h   = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

export const fetchContinueWatching = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('watch_progress')
    .select(`
      id, current_time_sec, duration_sec,
      season_number, episode_number, last_watched, media_type,
      movies ( id, title, poster, is_series, genre )
    `)
    .eq('user_id', userId)
    .order('last_watched', { ascending: false })
    .limit(20);

  if (error) { console.warn('[ContinueWatching]', error.message); return []; }

  return (data ?? []).map(row => ({
    progressId: row.id,
    movieId:    row.movies?.id,
    title:      row.movies?.title,
    poster:     row.movies?.poster,
    is_series:  row.movies?.is_series,
    genre:      row.movies?.genre,
    progress:   row.duration_sec > 0 ? row.current_time_sec / row.duration_sec : 0,
    currentSec: row.current_time_sec,
    durationSec: row.duration_sec,
    season:     row.season_number,
    episode:    row.episode_number,
    remaining:  _fmtRemaining(row.current_time_sec, row.duration_sec),
    lastWatched: row.last_watched,
  }));
};

export const upsertWatchProgress = async ({
  userId, movieId, currentTimeSec, durationSec,
  seasonNumber = null, episodeNumber = null, mediaType = 'movie',
}) => {
  const { error } = await supabase
    .from('watch_progress')
    .upsert(
      {
        user_id:        userId,
        movie_id:       movieId,
        current_time_sec: currentTimeSec,
        duration_sec:   durationSec,
        season_number:  seasonNumber,
        episode_number: episodeNumber,
        media_type:     mediaType,
        last_watched:   new Date().toISOString(),
      },
      { onConflict: 'user_id,movie_id' }
    );
  if (error) throw error;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── WATCHLIST ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export const fetchWatchlist = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('watchlist')
    .select(`
      id, created_at,
      movies ( id, title, poster, rating, is_series, genre, newly_added, is_trending )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { console.warn('[Watchlist]', error.message); return []; }
  return (data ?? []).map(row => ({ watchId: row.id, ...row.movies }));
};

export const addToWatchlist = async (userId, movieId) => {
  const { error } = await supabase
    .from('watchlist')
    .upsert({ user_id: userId, movie_id: movieId }, { onConflict: 'user_id,movie_id' });
  if (error) throw error;
};

export const removeFromWatchlist = async (userId, movieId) => {
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('movie_id', movieId);
  if (error) throw error;
};

export const isInWatchlist = async (userId, movieId) => {
  if (!userId || !movieId) return false;
  const { data, error } = await supabase
    .from('watchlist')
    .select('id')
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .maybeSingle();
  if (error) return false;
  return !!data;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── CONTENT MAP HELPER ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Build genre/category maps from a flat movies array (no extra DB call needed).
 * Returns { genres, categories, genreMap, categoryMap }
 */
export const buildContentMap = (movies = []) => {
  const genreMap    = {};
  const categoryMap = {};

  movies.forEach(m => {
    (m.genre    || []).forEach(g => { genreMap[g]    = genreMap[g]    || []; genreMap[g].push(m);    });
    (m.category || []).forEach(c => { categoryMap[c] = categoryMap[c] || []; categoryMap[c].push(m); });
  });

  return {
    genres:      Object.keys(genreMap),
    categories:  Object.keys(categoryMap),
    genreMap,
    categoryMap,
  };
};
