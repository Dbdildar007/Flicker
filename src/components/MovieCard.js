// src/components/MovieCard.js
import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, Animated, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, RADIUS, SHADOW } from '../data/theme';
import { RatingBadge, SeriesTag } from './UIComponents';

const { width: SW } = Dimensions.get('window');

const PLACEHOLDER = 'https://via.placeholder.com/200x300/030F0C/00FFB2?text=FLICKS';

export default function MovieCard({
  movie,
  width: cardW = 140,
  height: cardH = 200,
  onPress,
  showDetails = true,
  style,
}) {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;

  const handleIn  = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true, tension: 300, friction: 15 }),
      Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  };
  const handleOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 300, friction: 15 }),
      Animated.timing(glowAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  const borderAnim = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,255,178,0.12)', 'rgba(0,255,178,0.65)'],
  });

  const shadowAnim = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.0, 0.5],
  });

  const imgSrc = movie?.poster
    ? { uri: movie.poster }
    : { uri: PLACEHOLDER };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      activeOpacity={1}
      style={[{ marginRight: 12 }, style]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            width: cardW,
            borderColor: borderAnim,
            shadowColor: COLORS.accent,
            shadowOpacity: shadowAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Poster image - full bleed, no white space */}
        <Image
          source={imgSrc}
          style={[styles.image, { width: cardW, height: cardH }]}
          resizeMode="cover"
        />

        {/* Glass overlay gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(3,15,12,0.4)', 'rgba(3,15,12,0.92)']}
          locations={[0.45, 0.72, 1]}
          style={styles.gradient}
        />

        {/* Glass shimmer */}
        <LinearGradient
          colors={['rgba(0,255,178,0.08)', 'transparent']}
          style={styles.shimmer}
        />

        {/* Series tag top-left */}
        {movie?.is_series && <SeriesTag />}

        {/* Rating badge top-right */}
        {movie?.rating > 0 && (
          <View style={styles.ratingPos}>
            <RatingBadge rating={movie.rating} />
          </View>
        )}

        {/* Details */}
        {showDetails && (
          <View style={styles.details}>
            <Text style={styles.genre} numberOfLines={1}>
              {movie?.genre?.[0]?.toUpperCase() || ''}
            </Text>
            <Text style={styles.title} numberOfLines={2}>
              {movie?.title || 'Unknown'}
            </Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: COLORS.bg3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 12,
  },
  image: {
    borderRadius: RADIUS.lg,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderRadius: RADIUS.lg,
  },
  ratingPos: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  details: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
  },
  genre: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  title: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
});
