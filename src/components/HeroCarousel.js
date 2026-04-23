// src/components/HeroCarousel.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Animated, Dimensions, Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, RADIUS, SHADOW } from '../data/theme';

const { width: SW } = Dimensions.get('window');
const HERO_H = SW * 0.62;

const PLACEHOLDER = 'https://via.placeholder.com/800x500/030F0C/00FFB2?text=FLICKS';
const INTERVAL = 4500;

export default function HeroCarousel({ items = [], onWatchNow, onMyList, isInMyList }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [nextIdx,   setNextIdx]   = useState(1);

  // Image transition
  const fadeAnim   = useRef(new Animated.Value(1)).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const slideX     = useRef(new Animated.Value(0)).current;

  // Text animation
  const textOpacity = useRef(new Animated.Value(1)).current;
  const textSlide   = useRef(new Animated.Value(0)).current;

  // Dot progress for active slide
  const dotProgress = useRef(new Animated.Value(0)).current;
  const dotTimer    = useRef(null);

  const safeItems = items.length > 0 ? items : [{ id: 'ph', title: 'Discover Movies', genre: ['Action'], rating: 9.0, hero_image: PLACEHOLDER }];

  const startDotProgress = () => {
    dotProgress.setValue(0);
    Animated.timing(dotProgress, {
      toValue: 1,
      duration: INTERVAL - 200,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  };

  const transition = (newIdx) => {
    // Text out
    Animated.parallel([
      Animated.timing(textOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(textSlide, { toValue: -20, duration: 200, useNativeDriver: true }),
    ]).start();

    // Image zoom out + fade
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 350, useNativeDriver: true }),
    ]).start(() => {
      setActiveIdx(newIdx);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.96);

      // Bring in new image
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
      ]).start();

      // Text in
      textSlide.setValue(20);
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 350, delay: 150, useNativeDriver: true }),
        Animated.timing(textSlide, { toValue: 0, duration: 350, delay: 150, useNativeDriver: true }),
      ]).start();

      startDotProgress();
    });
  };

  useEffect(() => {
    if (safeItems.length <= 1) return;
    startDotProgress();
    const timer = setInterval(() => {
      setActiveIdx(prev => {
        const newIdx = (prev + 1) % safeItems.length;
        transition(newIdx);
        return prev; // transition handles actual state change
      });
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [safeItems.length]);

  const current = safeItems[activeIdx] || safeItems[0];
  const imgSrc = current?.hero_image || current?.poster
    ? { uri: current.hero_image || current.poster }
    : { uri: PLACEHOLDER };

  const isInList = isInMyList ? isInMyList(current?.id) : false;

  return (
    <View style={styles.container}>
      {/* Background image with zoom animation */}
      <Animated.View
        style={[
          styles.imageWrap,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Image
          source={imgSrc}
          style={styles.image}
          resizeMode="cover"
        />
        {/* Cinematic crop overlay for letterbox feel */}
        <View style={styles.topCrop} />
      </Animated.View>

      {/* Multi-layer gradient for depth */}
      <LinearGradient
        colors={['rgba(3,15,12,0.1)', 'rgba(3,15,12,0.02)', 'rgba(3,15,12,0.7)', 'rgba(3,15,12,0.98)']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Side vignettes */}
      <LinearGradient
        colors={['rgba(3,15,12,0.6)', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 0.25, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', 'rgba(3,15,12,0.5)']}
        start={{ x: 0.75, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          { opacity: textOpacity, transform: [{ translateY: textSlide }] },
        ]}
      >
        {/* Genre tag */}
        <View style={styles.genreRow}>
          {(current?.genre || []).slice(0, 2).map(g => (
            <View key={g} style={styles.genreTag}>
              <Text style={styles.genreText}>{g.toUpperCase()}</Text>
            </View>
          ))}
          {current?.rating > 0 && (
            <View style={styles.ratingTag}>
              <Text style={styles.ratingText}>★ {Number(current.rating).toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {current?.title}
        </Text>

        {/* Buttons row */}
        <View style={styles.btnRow}>
          {/* Watch Now - glass teal */}
          <TouchableOpacity
            onPress={() => onWatchNow && onWatchNow(current)}
            activeOpacity={0.85}
            style={styles.watchBtn}
          >
            <LinearGradient
              colors={['rgba(0,255,178,0.25)', 'rgba(0,255,178,0.10)']}
              style={styles.watchGrad}
            >
              <View style={styles.watchInner}>
                <Text style={styles.watchIcon}>▶</Text>
                <Text style={styles.watchText}>Watch Now</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* My List - transparent glass */}
          <TouchableOpacity
            onPress={() => onMyList && onMyList(current)}
            activeOpacity={0.8}
            style={styles.listBtn}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.15)']}
              style={styles.listGrad}
            >
              <Text style={styles.listIcon}>{isInList ? '✓' : '+'}</Text>
              <Text style={styles.listText}>My List</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Slide indicators */}
      {safeItems.length > 1 && (
        <View style={styles.dotsRow}>
          {safeItems.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => transition(i)}
              style={styles.dotWrap}
            >
              <View style={[styles.dot, i === activeIdx && styles.dotActive]}>
                {i === activeIdx && (
                  <Animated.View
                    style={[
                      styles.dotFill,
                      { width: dotProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                    ]}
                  />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SW,
    height: HERO_H,
    overflow: 'hidden',
  },
  imageWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topCrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: COLORS.bg,
  },
  content: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  genreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  genreTag: {
    borderWidth: 1,
    borderColor: COLORS.accent + '55',
    backgroundColor: COLORS.accentBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  genreText: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  ratingTag: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  ratingText: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  watchBtn: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.accent + '60',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  watchGrad: {
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  watchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  watchIcon: {
    color: COLORS.accent,
    fontSize: 13,
  },
  watchText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  listBtn: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  listGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  listIcon: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  listText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dotWrap: { padding: 4 },
  dot: {
    height: 3,
    width: 18,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  dotActive: {
    backgroundColor: 'rgba(0,255,178,0.3)',
    width: 36,
  },
  dotFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
});
