// src/components/MovieRow.js
import React, { useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Animated,
} from 'react-native';
import { COLORS, RADIUS, SPACING } from '../data/theme';
import MovieCard from './MovieCard';
import { SkeletonCard } from './UIComponents';

const { width: SW } = Dimensions.get('window');

export default function MovieRow({
  title,
  data = [],
  loading = false,
  onSeeAll,
  onItemPress,
  cardWidth = 140,
  cardHeight = 200,
  autoScroll = false,
  autoScrollSpeed = 0.4,
}) {
  const scrollRef = useRef(null);
  const scrollX   = useRef(0);
  const autoTimer = useRef(null);
  const direction = useRef(1);

  // Subtle auto-scroll (very slow drift)
  useEffect(() => {
    if (!autoScroll || !data.length) return;
    const totalW = data.length * (cardWidth + 12);
    const maxScroll = totalW - SW + 40;

    const tick = () => {
      scrollX.current += autoScrollSpeed * direction.current;
      if (scrollX.current >= maxScroll) { direction.current = -1; }
      if (scrollX.current <= 0)        { direction.current = 1;  }
      scrollRef.current?.scrollTo({ x: scrollX.current, animated: false });
    };

    autoTimer.current = setInterval(tick, 30);
    return () => clearInterval(autoTimer.current);
  }, [autoScroll, data.length, cardWidth, autoScrollSpeed]);

  const pauseAutoScroll = () => clearInterval(autoTimer.current);

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
            <Text style={styles.seeAll}>VIEW ALL</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cards */}
      {loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {[...Array(5)].map((_, i) => (
            <SkeletonCard key={i} width={cardWidth} height={cardHeight} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScrollBeginDrag={pauseAutoScroll}
          onScrollEndDrag={() => {
            if (autoScroll) {
              // Resume after user releases
              const totalW = data.length * (cardWidth + 12);
              const maxScroll = totalW - SW + 40;
              autoTimer.current = setInterval(() => {
                scrollX.current += autoScrollSpeed * direction.current;
                if (scrollX.current >= maxScroll) direction.current = -1;
                if (scrollX.current <= 0)         direction.current = 1;
                scrollRef.current?.scrollTo({ x: scrollX.current, animated: false });
              }, 30);
            }
          }}
          scrollEventThrottle={16}
          onScroll={e => { scrollX.current = e.nativeEvent.contentOffset.x; }}
        >
          {data.map(movie => (
            <MovieCard
              key={movie.id}
              movie={movie}
              width={cardWidth}
              height={cardHeight}
              onPress={() => onItemPress && onItemPress(movie)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  seeAll: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
});
