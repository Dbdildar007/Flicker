// src/lib/supabase.js
// ─── Supabase client + ALL APIs (movies + friends) ───────────────────────────

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Chunked storage adapter ──────────────────────────────────────────────────
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
    } catch { return null; }
  },

  async setItem(key, value) {
    try {
      if (value.length <= CHUNK_SIZE) { await AsyncStorage.setItem(key, value); return; }
      const chunks = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
      const pairs = chunks.map((chunk, i) => [`${key}__chunk_${i}`, chunk]);
      await AsyncStorage.multiSet(pairs);
      await AsyncStorage.setItem(key, `__CHUNKED__${chunks.length}`);
    } catch (e) { console.warn('[ChunkedStorage.setItem]', e.message); }
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
    } catch (e) { console.warn('[ChunkedStorage.removeItem]', e.message); }
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
// MOVIE FIELD PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const MOVIE_CARD_FIELDS =
  'id,title,poster,rating,genre,category,is_series,is_trending,newly_added,year,language,duration';
const MOVIE_DETAIL_FIELDS =
  'id,title,description,poster,hero_image,genre,category,year,rating,newly_added,is_series,is_featured,is_trending,duration,language,release_date';
const MOVIE_SEARCH_FIELDS =
  'id,title,poster,hero_image,rating,genre,category,year,language,is_series,is_trending,newly_added';

// ─────────────────────────────────────────────────────────────────────────────
// ── AUTH API ──────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export const authAPI = {
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    } catch (err) { console.error('[authAPI.getSession]', err); return null; }
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ── MOVIES ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export const fetchFeatured = async () => {
  const { data, error } = await supabase.from('movies').select(MOVIE_DETAIL_FIELDS).eq('is_featured', true).limit(10);
  return handle(data, error);
};

export const fetchMoviesByPage = async (page = 0, pageSize = 30) => {
  const from = page * pageSize;
  const to   = from + pageSize - 1;
  const { data, error } = await supabase.from('movies').select(MOVIE_CARD_FIELDS).order('created_at', { ascending: false }).range(from, to);
  return handle(data, error);
};

export const fetchTrending = async (limit = 20) => {
  const { data, error } = await supabase.from('movies').select(MOVIE_CARD_FIELDS).eq('is_trending', true).limit(limit);
  return handle(data, error);
};

export const fetchUpcoming = async (limit = 20) => {
  const { data, error } = await supabase.from('movies').select('id,title,poster,genre,is_series,release_date,newly_added').eq('is_upcoming', true).order('release_date', { ascending: true }).limit(limit);
  return handle(data, error);
};

export const fetchMovieById = async (id) => {
  const { data, error } = await supabase.from('movies').select(MOVIE_DETAIL_FIELDS).eq('id', id).single();
  return handle(data, error, null);
};

// ─────────────────────────────────────────────────────────────────────────────
// ── MOVIE SEARCH & FILTER ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export const searchMovies = async ({ query = '', years = [], languages = [], genres = [], page = 0, pageSize = 21 } = {}) => {
  const from = page * pageSize;
  const to   = from + pageSize - 1;
  try {
    let qb = supabase.from('movies').select(MOVIE_SEARCH_FIELDS).range(from, to).order('rating', { ascending: false });
    if (query.trim())     qb = qb.ilike('title', `%${query.trim()}%`);
    if (years.length)     qb = qb.in('year', years);
    if (languages.length) qb = qb.in('language', languages);
    if (genres.length)    qb = qb.overlaps('genre', genres);
    const { data, error } = await qb;
    if (error) throw error;
    return { data: data ?? [], hasMore: (data?.length ?? 0) === pageSize, error: null };
  } catch (e) {
    console.warn('[searchMovies]', e.message);
    return { data: [], hasMore: false, error: e.message };
  }
};

export const fetchFilterOptions = async () => {
  try {
    const { data, error } = await supabase.from('movies').select('year,language,genre');
    if (error) throw error;
    const years = [...new Set((data ?? []).map(m => m.year).filter(Boolean))].sort((a, b) => b - a);
    const languages = [...new Set((data ?? []).map(m => m.language).filter(Boolean))].sort();
    const genreSet = new Set();
    (data ?? []).forEach(m => (m.genre || []).forEach(g => genreSet.add(g)));
    return { years, languages, genres: [...genreSet].sort() };
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
  const m = Math.floor(rem / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

export const fetchContinueWatching = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('watch_progress')
    .select(`id, current_time_sec, duration_sec, season_number, episode_number, last_watched, media_type, movies ( id, title, poster, is_series, genre )`)
    .eq('user_id', userId)
    .order('last_watched', { ascending: false })
    .limit(20);
  if (error) { console.warn('[ContinueWatching]', error.message); return []; }
  return (data ?? []).map(row => ({
    progressId: row.id, movieId: row.movies?.id, title: row.movies?.title,
    poster: row.movies?.poster, is_series: row.movies?.is_series, genre: row.movies?.genre,
    progress: row.duration_sec > 0 ? row.current_time_sec / row.duration_sec : 0,
    currentSec: row.current_time_sec, durationSec: row.duration_sec,
    season: row.season_number, episode: row.episode_number,
    remaining: _fmtRemaining(row.current_time_sec, row.duration_sec),
    lastWatched: row.last_watched,
  }));
};

export const upsertWatchProgress = async ({ userId, movieId, currentTimeSec, durationSec, seasonNumber = null, episodeNumber = null, mediaType = 'movie' }) => {
  const { error } = await supabase.from('watch_progress').upsert(
    { user_id: userId, movie_id: movieId, current_time_sec: currentTimeSec, duration_sec: durationSec, season_number: seasonNumber, episode_number: episodeNumber, media_type: mediaType, last_watched: new Date().toISOString() },
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
    .select(`id, created_at, movies ( id, title, poster, rating, is_series, genre, newly_added, is_trending )`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) { console.warn('[Watchlist]', error.message); return []; }
  return (data ?? []).map(row => ({ watchId: row.id, ...row.movies }));
};

export const addToWatchlist = async (userId, movieId) => {
  const { error } = await supabase.from('watchlist').upsert({ user_id: userId, movie_id: movieId }, { onConflict: 'user_id,movie_id' });
  if (error) throw error;
};

export const removeFromWatchlist = async (userId, movieId) => {
  const { error } = await supabase.from('watchlist').delete().eq('user_id', userId).eq('movie_id', movieId);
  if (error) throw error;
};

export const isInWatchlist = async (userId, movieId) => {
  if (!userId || !movieId) return false;
  const { data, error } = await supabase.from('watchlist').select('id').eq('user_id', userId).eq('movie_id', movieId).maybeSingle();
  if (error) return false;
  return !!data;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── CONTENT MAP HELPER ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export const buildContentMap = (movies = []) => {
  const genreMap = {}, categoryMap = {};
  movies.forEach(m => {
    (m.genre || []).forEach(g => { genreMap[g] = genreMap[g] || []; genreMap[g].push(m); });
    (m.category || []).forEach(c => { categoryMap[c] = categoryMap[c] || []; categoryMap[c].push(m); });
  });
  return { genres: Object.keys(genreMap), categories: Object.keys(categoryMap), genreMap, categoryMap };
};

// ═════════════════════════════════════════════════════════════════════════════
// ══ FRIENDS & SOCIAL API ═════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════

// Profile fields returned in friend queries
const PROFILE_FIELDS = 'user_id, display_name, avatar_url, unique_id, is_online, last_seen';

// ─────────────────────────────────────────────────────────────────────────────
// ── SEARCH & EXPLORE USERS ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search profiles by display_name or unique_id.
 * Returns paginated results, online users first.
 * Used in: friend search bar, explore sheet.
 */
export const searchUsers = async ({ query = '', page = 0, pageSize = 10 } = {}) => {
  const from = page * pageSize;
  const to   = from + pageSize - 1;

  try {
    let qb = supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .order('is_online', { ascending: false })
      .order('display_name', { ascending: true })
      .range(from, to);

    if (query.trim()) {
      qb = qb.or(`display_name.ilike.%${query.trim()}%,unique_id.ilike.%${query.trim()}%`);
    }

    const { data, error } = await qb;
    if (error) throw error;
    return { data: data ?? [], error: null };
  } catch (e) {
    console.warn('[searchUsers]', e.message);
    return { data: [], error: e.message };
  }
};

/**
 * Fetch all profiles for the Connect tab (paginated, for exploration).
 * Excludes the current user. Online users first.
 */
export const fetchAllProfiles = async (currentUserId, page = 0, pageSize = 10) => {
  const from = page * pageSize;
  const to   = from + pageSize - 1;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .neq('user_id', currentUserId)
      .order('is_online', { ascending: false })
      .order('display_name', { ascending: true })
      .range(from, to);
    if (error) throw error;
    return { data: data ?? [], hasMore: (data?.length ?? 0) === pageSize };
  } catch (e) {
    console.warn('[fetchAllProfiles]', e.message);
    return { data: [], hasMore: false };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── PENDING REQUESTS ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all pending friend requests directed AT the current user.
 * Joins requester's profile for display.
 *
 * @param {string} userId - Current user's ID (addressee)
 */
export const fetchPendingRequests = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      requester_id,
      created_at,
      requester:profiles!fk_friendships_requester (
        ${PROFILE_FIELDS}
      )
    `)
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    // Fallback: try without FK alias if schema uses different naming
    const { data: fallback, error: err2 } = await supabase
      .from('friendships')
      .select(`id, requester_id, created_at`)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (err2) throw err2;

    // Enrich with profile data separately
    if (!fallback || fallback.length === 0) return [];
    const ids = fallback.map(r => r.requester_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .in('user_id', ids);

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
    return fallback.map(r => ({ ...r, requester: profileMap[r.requester_id] || null }));
  }

  return data ?? [];
};

// ─────────────────────────────────────────────────────────────────────────────
// ── CONNECTED FRIENDS ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all accepted friends for the current user.
 * Returns the OTHER person's profile in each relationship.
 * Online users sorted first.
 *
 * @param {string} userId - Current user's ID
 */
export const fetchConnectedFriends = async (userId) => {
  if (!userId) return [];

  try {
    // Fetch friendships where user is requester
    const { data: asRequester, error: e1 } = await supabase
      .from('friendships')
      .select(`addressee_id`)
      .eq('requester_id', userId)
      .eq('status', 'accepted');

    // Fetch friendships where user is addressee
    const { data: asAddressee, error: e2 } = await supabase
      .from('friendships')
      .select(`requester_id`)
      .eq('addressee_id', userId)
      .eq('status', 'accepted');

    if (e1 || e2) throw e1 || e2;

    const friendIds = [
      ...(asRequester || []).map(r => r.addressee_id),
      ...(asAddressee || []).map(r => r.requester_id),
    ];

    if (friendIds.length === 0) return [];

    // Fetch profiles for all friend IDs
    const { data: profiles, error: e3 } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .in('user_id', friendIds)
      .order('is_online', { ascending: false })
      .order('display_name', { ascending: true });

    if (e3) throw e3;
    return profiles ?? [];

  } catch (e) {
    console.warn('[fetchConnectedFriends]', e.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── SEND FRIEND REQUEST ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a friend request.
 * Checks for duplicate before inserting to avoid DB constraint errors.
 *
 * @param {string} requesterId
 * @param {string} addresseeId
 */
export const sendFriendRequest = async (requesterId, addresseeId) => {
  if (!requesterId || !addresseeId || requesterId === addresseeId) {
    throw new Error('Invalid request');
  }

  // Check if a relationship already exists (either direction)
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),` +
      `and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === 'accepted') throw new Error('Already friends');
    if (existing.status === 'pending') throw new Error('Request already sent');
  }

  const { error } = await supabase
    .from('friendships')
    .insert([{ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' }]);

  if (error) throw error;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── ACCEPT FRIEND REQUEST ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accept a pending request by its friendship row ID.
 * @param {string} requestId - friendships.id
 */
export const acceptFriendRequest = async (requestId) => {
  if (!requestId) throw new Error('No request ID');
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', requestId);
  if (error) throw error;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── REJECT / DELETE FRIEND REQUEST ───────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reject (delete) a pending request by ID.
 * @param {string} requestId - friendships.id
 */
export const rejectFriendRequest = async (requestId) => {
  if (!requestId) throw new Error('No request ID');
  const { error } = await supabase.from('friendships').delete().eq('id', requestId);
  if (error) throw error;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── CANCEL SENT REQUEST ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cancel a pending request that the current user sent.
 * @param {string} requesterId
 * @param {string} addresseeId
 */
export const cancelFriendRequest = async (requesterId, addresseeId) => {
  if (!requesterId || !addresseeId) throw new Error('Invalid params');
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('requester_id', requesterId)
    .eq('addressee_id', addresseeId)
    .eq('status', 'pending');
  if (error) throw error;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── UNFRIEND ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove a friend (delete accepted friendship, either direction).
 */
export const unfriend = async (userId, friendId) => {
  if (!userId || !friendId) throw new Error('Invalid params');
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${friendId}),` +
      `and(requester_id.eq.${friendId},addressee_id.eq.${userId})`
    );
  if (error) throw error;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── GET SENT REQUEST IDs ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a list of addressee_ids to whom the current user has sent pending requests.
 * Used to initialize the "Follow / Cancel" button states in the UI.
 */
export const getSentRequestIds = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('friendships')
    .select('addressee_id')
    .eq('requester_id', userId)
    .eq('status', 'pending');
  if (error) { console.warn('[getSentRequestIds]', error.message); return []; }
  return (data ?? []).map(r => r.addressee_id);
};

// ─────────────────────────────────────────────────────────────────────────────
// ── REAL-TIME SUBSCRIPTIONS ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to all friendship events involving the current user.
 * Calls `callback` on INSERT, UPDATE, DELETE.
 *
 * @param {string} userId
 * @param {Function} callback
 * @returns Supabase channel (call .unsubscribe() on cleanup)
 */
export const subscribeToFriendships = (userId, callback) => {
  if (!userId) return { unsubscribe: () => {} };

  return supabase
    .channel(`friendships:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friendships',
      },
      (payload) => {
        // Only invoke callback if this event involves the current user
        const row = payload.new || payload.old;
        if (row?.requester_id === userId || row?.addressee_id === userId) {
          callback(payload);
        }
      }
    )
    .subscribe();
};

/**
 * Subscribe to online status changes in profiles.
 * Calls `callback` whenever any friend's is_online / last_seen changes.
 *
 * @param {string[]} friendIds - Array of user_ids to watch
 * @param {Function} callback
 */
export const subscribeToOnlineStatus = (friendIds, callback) => {
  if (!friendIds || friendIds.length === 0) return { unsubscribe: () => {} };

  return supabase
    .channel('online_status')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=in.(${friendIds.join(',')})`,
      },
      callback
    )
    .subscribe();
};

// ─────────────────────────────────────────────────────────────────────────────
// ── ONLINE PRESENCE (Update current user's status) ────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark the current user as online. Call on app foreground.
 */
export const setOnline = async (userId) => {
  if (!userId) return;
  await supabase
    .from('profiles')
    .update({ is_online: true, last_seen: new Date().toISOString() })
    .eq('user_id', userId);
};

/**
 * Mark the current user as offline. Call on app background/close.
 */
export const setOffline = async (userId) => {
  if (!userId) return;
  await supabase
    .from('profiles')
    .update({ is_online: false, last_seen: new Date().toISOString() })
    .eq('user_id', userId);
};

// ─────────────────────────────────────────────────────────────────────────────
// ── SEARCH HISTORY  (AsyncStorage — fast, local, no DB round-trip) ────────────
// ─────────────────────────────────────────────────────────────────────────────

const HISTORY_KEY = 'sv_search_history';
const HISTORY_MAX = 10;

/**
 * Returns the stored search history (array of profile objects).
 */
export const fetchSearchHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

/**
 * Prepend a user to search history, deduplicating by user_id.
 * Trims to HISTORY_MAX entries.
 */
export const saveSearchHistory = async (user) => {
  try {
    let history = await fetchSearchHistory();
    history = [user, ...history.filter(h => h.user_id !== user.user_id)].slice(0, HISTORY_MAX);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) { console.warn('[saveSearchHistory]', e.message); }
};

/**
 * Remove a single user from search history by user_id.
 */
export const removeSearchHistoryItem = async (userId) => {
  try {
    let history = await fetchSearchHistory();
    history = history.filter(h => h.user_id !== userId);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) { console.warn('[removeSearchHistoryItem]', e.message); }
};

/**
 * Clear entire search history.
 */
export const clearSearchHistory = async () => {
  try { await AsyncStorage.removeItem(HISTORY_KEY); }
  catch (e) { console.warn('[clearSearchHistory]', e.message); }
};
// ═══════════════════════════════════════════════════════════════════════════
// ADD THESE EXPORTS TO YOUR EXISTING src/lib/supabase.js FILE
// Place after the existing exports at the bottom of the file
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// ── PROFILE API ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's full profile from the profiles table.
 * Returns null if not found (caller should show empty state or create profile).
 *
 * @param {string} userId
 */
export const fetchMyProfile = async (userId) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, unique_id, is_online, last_seen, bio, subscription_tier, top_genres, created_at')
    .eq('user_id', userId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found → graceful
    console.warn('[fetchMyProfile]', error.message);
    return null;
  }
  return data;
};

/**
 * Update profile fields for the current user.
 * Performs an upsert so it works even if the row doesn't exist yet.
 *
 * @param {string} userId
 * @param {object} updates  - Partial profile fields: { display_name, bio, avatar_url, ... }
 */
export const updateProfile = async (userId, updates) => {
  if (!userId) throw new Error('No user ID');
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { user_id: userId, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
};

/**
 * Upload a profile avatar to Supabase Storage and return the public URL.
 * Bucket name: 'avatars' — create this in your Supabase dashboard if it doesn't exist.
 * Set the bucket to PUBLIC for URLs to work without auth.
 *
 * @param {string} userId
 * @param {string} localUri - Local file URI from image picker
 * @returns {string} Public URL of the uploaded avatar
 */
export const uploadAvatar = async (userId, localUri) => {
  if (!userId || !localUri) throw new Error('Missing params');

  // Build a FormData blob for RN upload
  const ext  = localUri.split('.').pop()?.toLowerCase() || 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${userId}/avatar.${ext}`;

  // React Native fetch-based upload (works without Node.js fs)
  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: mime, upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Bust cache by appending timestamp
  return `${data.publicUrl}?t=${Date.now()}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── PROFILE STATS ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate profile stats in a single optimized call.
 * Returns: { followers, following, watch_time_hours, rating_count, watchlist_count }
 *
 * All counts come from a single Promise.all to minimize latency.
 *
 * @param {string} userId
 */
export const fetchMyStats = async (userId) => {
  if (!userId) return null;

  try {
    const [followers, following, watchTime, ratingCount, watchlistCount] = await Promise.all([
      // Followers: friendships where this user is addressee + accepted
      supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('addressee_id', userId)
        .eq('status', 'accepted'),

      // Following: friendships where this user is requester + accepted
      supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('requester_id', userId)
        .eq('status', 'accepted'),

      // Total watch time in seconds from watch_progress
      supabase
        .from('watch_progress')
        .select('current_time_sec')
        .eq('user_id', userId),

      // Number of movies rated
      supabase
        .from('movie_ratings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),

      // Watchlist size
      supabase
        .from('watchlist')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    // Sum watch time seconds → hours
    const totalSecs = (watchTime.data || []).reduce((acc, r) => acc + (r.current_time_sec || 0), 0);
    const watch_time_hours = Math.floor(totalSecs / 3600);

    return {
      followers:         followers.count  ?? 0,
      following:         following.count  ?? 0,
      watch_time_hours,
      rating_count:      ratingCount.count ?? 0,
      watchlist_count:   watchlistCount.count ?? 0,
    };
  } catch (e) {
    console.warn('[fetchMyStats]', e.message);
    return { followers: 0, following: 0, watch_time_hours: 0, rating_count: 0, watchlist_count: 0 };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ── RATED / LIKED MOVIES ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch movies the user has rated (liked).
 * Joins movie_ratings → movies to get poster/title.
 * Ordered by rating desc, then by date desc.
 *
 * @param {string} userId
 * @param {number} limit
 */
export const fetchMyRatedMovies = async (userId, limit = 20) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('movie_ratings')
    .select(`
      id,
      rating,
      created_at,
      movies (
        id,
        title,
        poster,
        genre,
        year,
        is_series
      )
    `)
    .eq('user_id', userId)
    .order('rating', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.warn('[fetchMyRatedMovies]', error.message); return []; }

  return (data ?? [])
    .filter(r => r.movies) // drop orphaned ratings
    .map(r => ({
      id:        r.movies.id,
      title:     r.movies.title,
      poster:    r.movies.poster,
      genre:     r.movies.genre,
      year:      r.movies.year,
      is_series: r.movies.is_series,
      rating:    r.rating,
    }));
};

// ─────────────────────────────────────────────────────────────────────────────
// ── WATCHLIST FOR PROFILE ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch watchlist movies for the profile screen (lightweight).
 * Re-uses the existing watchlist table join pattern.
 *
 * @param {string} userId
 * @param {number} limit
 */
export const fetchMyWatchlist = async (userId, limit = 20) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('watchlist')
    .select(`
      id,
      created_at,
      movies (
        id,
        title,
        poster,
        genre,
        year,
        rating,
        is_series
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.warn('[fetchMyWatchlist]', error.message); return []; }

  return (data ?? [])
    .filter(r => r.movies)
    .map(r => ({
      id:        r.movies.id,
      title:     r.movies.title,
      poster:    r.movies.poster,
      genre:     r.movies.genre,
      year:      r.movies.year,
      rating:    r.movies.rating,
      is_series: r.movies.is_series,
      watchId:   r.id,
    }));
};

// ─────────────────────────────────────────────────────────────────────────────
// ── CONTINUE WATCHING FOR PROFILE ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch in-progress movies for the profile screen.
 * Reuses the existing watch_progress table join.
 * Filters out items that are fully watched (progress >= 95%).
 *
 * @param {string} userId
 * @param {number} limit
 */
export const fetchMyContinueWatching = async (userId, limit = 20) => {
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
      movies (
        id,
        title,
        poster,
        genre,
        is_series
      )
    `)
    .eq('user_id', userId)
    .order('last_watched', { ascending: false })
    .limit(limit);

  if (error) { console.warn('[fetchMyContinueWatching]', error.message); return []; }

  const _fmtRemaining = (cur, dur) => {
    const rem = Math.max(dur - cur, 0);
    const m   = Math.floor(rem / 60);
    const h   = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  };

  return (data ?? [])
    .filter(r => {
      if (!r.movies) return false;
      // Skip fully-watched items (>= 95%)
      const pct = r.duration_sec > 0 ? r.current_time_sec / r.duration_sec : 0;
      return pct < 0.95;
    })
    .map(r => ({
      movieId:    r.movies.id,
      id:         r.movies.id,
      title:      r.movies.title,
      poster:     r.movies.poster,
      genre:      r.movies.genre,
      is_series:  r.movies.is_series,
      progress:   r.duration_sec > 0 ? r.current_time_sec / r.duration_sec : 0,
      currentSec: r.current_time_sec,
      durationSec: r.duration_sec,
      season:     r.season_number,
      episode:    r.episode_number,
      remaining:  _fmtRemaining(r.current_time_sec, r.duration_sec),
      lastWatched: r.last_watched,
    }));
};

// ─────────────────────────────────────────────────────────────────────────────
// ── TOP GENRES HELPER ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the user's top genres from their watch history + ratings.
 * Call this once after loading and persist to profile.top_genres via updateProfile.
 *
 * @param {string} userId
 * @returns {string[]} Top 5 genres sorted by frequency
 */
export const computeTopGenres = async (userId) => {
  if (!userId) return [];
  try {
    // Pull genres from rated movies
    const { data: rated } = await supabase
      .from('movie_ratings')
      .select('movies(genre)')
      .eq('user_id', userId)
      .limit(50);

    // Pull genres from watch history
    const { data: watched } = await supabase
      .from('watch_progress')
      .select('movies(genre)')
      .eq('user_id', userId)
      .limit(50);

    const freqMap = {};
    const addGenres = (rows) => {
      (rows || []).forEach(r => {
        (r.movies?.genre || []).forEach(g => {
          freqMap[g] = (freqMap[g] || 0) + 1;
        });
      });
    };

    addGenres(rated);
    addGenres(watched);

    return Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre);
  } catch (e) {
    console.warn('[computeTopGenres]', e.message);
    return [];
  }
};

/**
 * supabase_additions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ADD THESE FUNCTIONS TO YOUR EXISTING src/lib/supabase.js
 * All functions are optimized for production (indexed queries, minimal fetches,
 * proper error handling, mock fallbacks).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── PASTE THIS BLOCK INTO supabase.js ────────────────────────────────────────
// Make sure `supabase` client is already initialized at the top of the file.

// ─── fetchMovieById ──────────────────────────────────────────────────────────
/**
 * Fetch a single movie/series with all metadata.
 * @param {string} id
 */
export async function fetchMovieById(id) {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// ─── fetchCastByMovieId ──────────────────────────────────────────────────────
/**
 * Fetch cast/crew for a movie.
 * Requires a `cast` table: (id, movie_id, name, character, avatar, role)
 * @param {string} movieId
 */
export async function fetchCastByMovieId(movieId) {
  const { data, error } = await supabase
    .from('cast')
    .select('id, name, character, avatar, role')
    .eq('movie_id', movieId)
    .order('order_index', { ascending: true })
    .limit(12);
  if (error) throw error;
  return data || [];
}

// ─── fetchSimilarMovies ───────────────────────────────────────────────────────
/**
 * Fetch similar movies — same genre(s), exclude current movie.
 * @param {string} movieId
 * @param {number} limit
 */
export async function fetchSimilarMovies(movieId, limit = 8) {
  // First get the current movie's genres
  const { data: current } = await supabase
    .from('movies')
    .select('genre')
    .eq('id', movieId)
    .single();

  if (!current?.genre?.length) {
    // Fallback: just return recent movies
    const { data, error } = await supabase
      .from('movies')
      .select('id, title, poster, rating, is_series, is_trending, newly_added, genre')
      .neq('id', movieId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  // Use overlap operator for array genres
  const { data, error } = await supabase
    .from('movies')
    .select('id, title, poster, rating, is_series, is_trending, newly_added, genre')
    .neq('id', movieId)
    .overlaps('genre', current.genre)
    .order('rating', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ─── fetchCommentsByMovieId ───────────────────────────────────────────────────
/**
 * Fetch comments for a movie, joined with user profiles.
 * Requires a `comments` table: (id, movie_id, user_id, text, created_at, likes)
 * Requires a `profiles` table: (id, username, avatar)
 * @param {string} movieId
 * @param {number} limit
 */
export async function fetchCommentsByMovieId(movieId, limit = 30) {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      id, text, created_at, likes,
      user_id,
      profiles:user_id (username, avatar)
    `)
    .eq('movie_id', movieId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Flatten profile join
  return (data || []).map(c => ({
    id: c.id,
    user_id: c.user_id,
    text: c.text,
    created_at: c.created_at,
    likes: c.likes || 0,
    username: c.profiles?.username || 'Anonymous',
    avatar: c.profiles?.avatar || null,
  }));
}

// ─── postComment ─────────────────────────────────────────────────────────────
/**
 * Post a comment on a movie.
 * @param {string} userId
 * @param {string} movieId
 * @param {string} text
 */
export async function postComment(userId, movieId, text) {
  if (!userId || !movieId || !text?.trim()) throw new Error('Invalid params');
  const { data, error } = await supabase
    .from('comments')
    .insert({ user_id: userId, movie_id: movieId, text: text.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── toggleLike ──────────────────────────────────────────────────────────────
/**
 * Like or unlike a movie. Uses upsert for idempotency.
 * Requires a `likes` table: (user_id, movie_id) with unique(user_id, movie_id)
 * @param {string} userId
 * @param {string} movieId
 */
export async function toggleLike(userId, movieId) {
  if (!userId || !movieId) throw new Error('Invalid params');

  // Check if already liked
  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', userId)
      .eq('movie_id', movieId);
    if (error) throw error;
    return { liked: false };
  } else {
    const { error } = await supabase
      .from('likes')
      .insert({ user_id: userId, movie_id: movieId });
    if (error) throw error;
    return { liked: true };
  }
}

// ─── toggleWatchlist ─────────────────────────────────────────────────────────
/**
 * Add or remove from watchlist.
 * Requires a `watchlist` table: (user_id, movie_id)
 * @param {string} userId
 * @param {string} movieId
 */
export async function toggleWatchlist(userId, movieId) {
  if (!userId || !movieId) throw new Error('Invalid params');

  const { data: existing } = await supabase
    .from('watchlist')
    .select('id')
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('movie_id', movieId);
    if (error) throw error;
    return { watchlisted: false };
  } else {
    const { error } = await supabase
      .from('watchlist')
      .insert({ user_id: userId, movie_id: movieId });
    if (error) throw error;
    return { watchlisted: true };
  }
}

// ─── rateMovie ───────────────────────────────────────────────────────────────
/**
 * Rate a movie (1-5 stars). Upserts so user can update their rating.
 * Requires a `ratings` table: (user_id, movie_id, value)
 * @param {string} userId
 * @param {string} movieId
 * @param {number} value  1-5
 */
export async function rateMovie(userId, movieId, value) {
  if (!userId || !movieId || value < 1 || value > 5) throw new Error('Invalid params');
  const { data, error } = await supabase
    .from('ratings')
    .upsert(
      { user_id: userId, movie_id: movieId, value },
      { onConflict: 'user_id,movie_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── fetchSeasonsBySeriesId ───────────────────────────────────────────────────
/**
 * Fetch all seasons for a series, ordered by season_number.
 * @param {string} seriesId
 */
export async function fetchSeasonsBySeriesId(seriesId) {
  const { data, error } = await supabase
    .from('seasons')
    .select('id, series_id, season_number, created_at')
    .eq('series_id', seriesId)
    .order('season_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── fetchEpisodesBySeasonId ─────────────────────────────────────────────────
/**
 * Fetch all episodes for a season, ordered by episode_number.
 * @param {string} seasonId
 */
export async function fetchEpisodesBySeasonId(seasonId) {
  const { data, error } = await supabase
    .from('episodes')
    .select('id, season_id, episode_number, title, duration, description, video_url, thumbnail_url, created_at')
    .eq('season_id', seasonId)
    .order('episode_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── getCurrentUser ───────────────────────────────────────────────────────────
/**
 * Get the currently authenticated user + their profile.
 * Returns null if not logged in.
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar, bio')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    username: profile?.username || user.email?.split('@')[0] || 'User',
    avatar: profile?.avatar || null,
    bio: profile?.bio || null,
  };
}
