// src/components/CategoryGrid.js
import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, RADIUS } from '../data/theme';

const { width: SW } = Dimensions.get('window');

const CATEGORY_DEFS = [
  { id: 'action',    label: 'Action',     icon: '⚡', colors: ['rgba(255,45,85,0.22)', 'rgba(255,45,85,0.06)'] },
  { id: 'sci-fi',    label: 'Sci-Fi',     icon: '🚀', colors: ['rgba(0,160,255,0.22)', 'rgba(0,160,255,0.06)'] },
  { id: 'horror',    label: 'Horror',     icon: '💀', colors: ['rgba(150,0,50,0.25)',  'rgba(150,0,50,0.06)']  },
  { id: 'comedy',    label: 'Comedy',     icon: '😂', colors: ['rgba(255,210,0,0.22)', 'rgba(255,210,0,0.06)'] },
  { id: 'drama',     label: 'Drama',      icon: '🎭', colors: ['rgba(180,100,255,0.22)','rgba(180,100,255,0.06)'] },
  { id: 'thriller',  label: 'Thriller',   icon: '🔪', colors: ['rgba(255,100,0,0.22)', 'rgba(255,100,0,0.06)']  },
  { id: 'fantasy',   label: 'Fantasy',    icon: '🔮', colors: ['rgba(0,220,180,0.22)', 'rgba(0,220,180,0.06)'] },
  { id: 'adventure', label: 'Adventure',  icon: '🗺', colors: ['rgba(0,200,100,0.22)', 'rgba(0,200,100,0.06)']  },
  { id: 'romance',   label: 'Romance',    icon: '💖', colors: ['rgba(255,120,160,0.22)','rgba(255,120,160,0.06)'] },
  { id: 'animation', label: 'Animation',  icon: '🎨', colors: ['rgba(100,200,255,0.22)','rgba(100,200,255,0.06)'] },
];

function CategoryCard({ item, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  const handleIn  = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, tension: 300 }),
      Animated.timing(glowAnim,  { toValue: 1,    duration: 180, useNativeDriver: false }),
    ]).start();
  };
  const handleOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300 }),
      Animated.timing(glowAnim,  { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start();
  };

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,255,178,0.15)', 'rgba(0,255,178,0.7)'],
  });
  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <TouchableOpacity
      onPress={() => onPress && onPress(item)}
      onPressIn={handleIn}
      onPressOut={handleOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.card,
          {
            borderColor,
            shadowColor: COLORS.accent,
            shadowOpacity,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Main gradient */}
        <LinearGradient
          colors={item.colors}
          style={StyleSheet.absoluteFill}
        />
        {/* Overlay glass shimmer */}
        <LinearGradient
          colors={['rgba(255,255,255,0.04)', 'transparent']}
          style={styles.shimmer}
        />
        {/* Bottom edge accent line */}
        <View style={styles.accentLine} />

        <Text style={styles.icon}>{item.icon}</Text>
        <Text style={styles.label}>{item.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function CategoryGrid({ onCategoryPress, title = 'Browse Categories' }) {
  const COLS = 2;
  const cardW = (SW - 48 - 12) / COLS;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollRow}
      >
        {CATEGORY_DEFS.map(item => (
          <CategoryCard key={item.id} item={item} onPress={onCategoryPress} />
        ))}
      </ScrollView>
    </View>
  );
}

const CARD_W = (SW - 48 - 12) / 2;

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  header: { paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  scrollRow: {
    paddingHorizontal: 20,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    width: CARD_W * 0.75,
    height: 80,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
    marginRight: 0,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  accentLine: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 1.5,
    backgroundColor: COLORS.accent,
    opacity: 0.4,
    borderRadius: 1,
  },
  icon: { fontSize: 26, marginBottom: 5 },
  label: { color: COLORS.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});
