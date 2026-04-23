// src/lib/supabase.js
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Replace with your actual Supabase credentials ──────────────────────────
const SUPABASE_URL  = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';
// ──────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Movies / Series API ────────────────────────────────────────────────────
export const moviesAPI = {

  /** Fetch featured movies for hero carousel */
  async getFeatured() {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[getFeatured]', err.message);
      return [];
    }
  },

  /** Fetch trending movies/series */
  async getTrending() {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('is_trending', true)
        .order('rating', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[getTrending]', err.message);
      return [];
    }
  },

  /** Fetch editor's choice */
  async getEditorChoice() {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('is_editor_choice', true)
        .order('rating', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[getEditorChoice]', err.message);
      return [];
    }
  },

  /** Fetch newly added */
  async getNewlyAdded() {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .not('newly_added', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[getNewlyAdded]', err.message);
      return [];
    }
  },

  /** Fetch by genre/category */
  async getByGenre(genre) {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .contains('genre', [genre])
        .order('rating', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[getByGenre]', err.message);
      return [];
    }
  },

  /** Fetch only series */
  async getSeries() {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('is_series', true)
        .order('rating', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[getSeries]', err.message);
      return [];
    }
  },

  /** Fetch only movies (not series) */
  async getMoviesOnly() {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('is_series', false)
        .order('rating', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[getMoviesOnly]', err.message);
      return [];
    }
  },

  /** Search movies/series by title */
  async search(query) {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .ilike('title', `%${query}%`)
        .limit(30);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[search]', err.message);
      return [];
    }
  },

  /** Get single movie/series by id */
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('[getById]', err.message);
      return null;
    }
  },

  /** Fetch all movies for home (combined) */
  async getHomeData() {
    try {
      const [featured, trending, editorChoice, newlyAdded, series] = await Promise.all([
        moviesAPI.getFeatured(),
        moviesAPI.getTrending(),
        moviesAPI.getEditorChoice(),
        moviesAPI.getNewlyAdded(),
        moviesAPI.getSeries(),
      ]);
      return { featured, trending, editorChoice, newlyAdded, series };
    } catch (err) {
      console.error('[getHomeData]', err.message);
      return { featured: [], trending: [], editorChoice: [], newlyAdded: [], series: [] };
    }
  },
};

// ── Seasons & Episodes API ─────────────────────────────────────────────────
export const episodesAPI = {
  async getSeasons(seriesId) {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*, episodes(*)')
        .eq('series_id', seriesId)
        .order('season_number');
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[getSeasons]', err.message);
      return [];
    }
  },
};

// ── Ratings API ────────────────────────────────────────────────────────────
export const ratingsAPI = {
  async getUserRating(userId, movieId) {
    try {
      const { data, error } = await supabase
        .from('movie_ratings')
        .select('rating')
        .eq('user_id', userId)
        .eq('movie_id', movieId)
        .maybeSingle();
      if (error) throw error;
      return data?.rating || 0;
    } catch (err) {
      console.error('[getUserRating]', err.message);
      return 0;
    }
  },

  async getAverageRating(movieId) {
    try {
      const { data, error } = await supabase
        .from('movie_ratings')
        .select('rating')
        .eq('movie_id', movieId);
      if (error) throw error;
      if (!data?.length) return 0;
      const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
      return Math.round(avg * 10) / 10;
    } catch (err) {
      console.error('[getAverageRating]', err.message);
      return 0;
    }
  },

  async upsertRating(userId, movieId, rating) {
    try {
      const { data, error } = await supabase
        .from('movie_ratings')
        .upsert(
          { user_id: userId, movie_id: movieId, rating, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,movie_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('[upsertRating]', err.message);
      return null;
    }
  },
};

// ── Auth API ───────────────────────────────────────────────────────────────
export const authAPI = {
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } catch (err) {
      throw err;
    }
  },

  async signUp(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    } catch (err) {
      throw err;
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('[signOut]', err.message);
    }
  },

  async getSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch {
      return null;
    }
  },
};
