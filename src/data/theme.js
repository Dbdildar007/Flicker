// src/data/theme.js
import { Dimensions } from 'react-native';

export const { width: SW, height: SH } = Dimensions.get('window');

export const COLORS = {
  // Core background layers
  bg:         '#030F0C',   // near-black deep teal
  bg2:        '#061A14',
  bg3:        '#0A2218',
  bg4:        '#0D2D1F',

  // Accent - electric teal / cyan
  accent:     '#00FFB2',   // main neon teal
  accentDim:  '#00CC8F',
  accentGlow: 'rgba(0,255,178,0.25)',
  accentBg:   'rgba(0,255,178,0.08)',

  // Red for "F" letter
  red:        '#FF2D55',
  redGlow:    'rgba(255,45,85,0.4)',

  // Card glass
  glass:      'rgba(0,255,178,0.06)',
  glassBorder:'rgba(0,255,178,0.18)',
  glassHigh:  'rgba(0,255,178,0.12)',

  // Text
  text:       '#E8FFF8',
  textSub:    '#7ABFAA',
  textMuted:  '#3D7A65',

  // Rating gold
  gold:       '#FFD700',

  // Tab
  tabBg:      'rgba(3,15,12,0.85)',
  tabActive:  '#00FFB2',
  tabInactive:'rgba(0,255,178,0.35)',

  // Others
  white:      '#FFFFFF',
  black:      '#000000',
  error:      '#FF453A',
  success:    '#30D158',
  overlay:    'rgba(3,15,12,0.75)',
};

export const FONTS = {
  // Use system fonts with weights; install custom font optionally
  black:    'System',
  bold:     'System',
  semiBold: 'System',
  medium:   'System',
  regular:  'System',
};

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
};

export const RADIUS = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  full: 999,
};

export const SHADOW = {
  teal: {
    shadowColor: '#00FFB2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  red: {
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  dark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
};

export const GENRES = ['Action', 'Sci-Fi', 'Horror', 'Comedy', 'Drama', 'Thriller', 'Fantasy', 'Adventure', 'Romance', 'Animation'];
