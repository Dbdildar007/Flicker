// src/navigation/AppNavigator.js
import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Easing,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, RADIUS } from '../data/theme';

import HomeScreen from '../screens/HomeScreen';
import {
  SearchScreen,
  MovieDetailScreen,
  GenreScreen,
  MoviesScreen,
  FriendsScreen,
  ProfileScreen,
} from '../screens/AllScreens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Responsive helpers ────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const isSmall = SW < 360;
const isMedium = SW >= 360 && SW < 414;

const scale = (size) => {
  if (isSmall) return size * 0.88;
  if (isMedium) return size * 0.94;
  return size;
};

// ── Tab Configuration ─────────────────────────────────────────────────────────
const TAB_CONFIG = {
  HomeTab: { icon: '⊞', label: 'Home' },
  MoviesTab: { icon: '🎬', label: 'Movies' },
  FriendsTab: { icon: '👥', label: 'Friends' },
  ProfileTab: { icon: '👤', label: 'Profile' },
};

// ── Glass constants ───────────────────────────────────────────────────────────
const GLASS_WHITE_BG = 'rgba(255,255,255,0.92)';
const GLASS_WHITE_BORDER = 'rgba(255,255,255,0.75)';
const GLASS_SHADOW = 'rgba(120,140,180,0.22)';
const PILL_ACTIVE_BG = ['rgba(255,255,255,1)', 'rgba(240,245,255,0.98)'];
const PILL_ACTIVE_BORDER = 'rgba(210,220,240,0.9)';
const ACTIVE_TINT = '#3A7BFF'; // Telegram blue
const INACTIVE_TINT = 'rgba(100,110,140,0.7)';
const BAR_BLUR_BG = ['rgba(255,255,255,0.88)', 'rgba(245,248,255,0.95)'];
const INDICATOR_COLOR = '#3A7BFF';

// ── Sliding Background Indicator ─────────────────────────────────────────────
// Follows the active tab like Telegram's sliding pill
function SlidingIndicator({ tabCount, activeIndex, tabWidth }) {
  const slideAnim = useRef(new Animated.Value(activeIndex * tabWidth)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: activeIndex * tabWidth,
        useNativeDriver: true,
        tension: 260,
        friction: 22,
        velocity: 3,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 80,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 12,
        }),
      ]),
    ]).start();
  }, [activeIndex]);

  const pillW = tabWidth - scale(12);
  const pillH = scale(52);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.slidingPill,
        {
          width: pillW,
          height: pillH,
          left: scale(6),
          top: '50%',
          marginTop: -(pillH / 2),
          transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={PILL_ACTIVE_BG}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Top highlight — 3D glass shine */}
      <LinearGradient
        colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { borderRadius: scale(16) }]}
      />
      {/* Bottom inner shadow */}
      <View style={styles.pillInnerShadow} />
    </Animated.View>
  );
}

// ── Single Tab Item ───────────────────────────────────────────────────────────
function TabItem({ icon, label, focused, onPress, tabWidth }) {
  const iconScaleAnim = useRef(new Animated.Value(1)).current;
  const iconTranslateY = useRef(new Animated.Value(focused ? -1 : 0)).current;
  const labelOpacity = useRef(new Animated.Value(focused ? 1 : 0.55)).current;
  const labelScale = useRef(new Animated.Value(focused ? 1 : 0.88)).current;
  const dotScale = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const colorAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconScaleAnim, {
        toValue: focused ? 1.15 : 1,
        useNativeDriver: true,
        tension: 320,
        friction: 14,
      }),
      Animated.spring(iconTranslateY, {
        toValue: focused ? -2 : 0,
        useNativeDriver: true,
        tension: 280,
        friction: 18,
      }),
      Animated.timing(labelOpacity, {
        toValue: focused ? 1 : 0.55,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(labelScale, {
        toValue: focused ? 1 : 0.88,
        useNativeDriver: true,
        tension: 300,
        friction: 15,
      }),
      Animated.spring(dotScale, {
        toValue: focused ? 1 : 0,
        useNativeDriver: true,
        tension: 400,
        friction: 10,
      }),
      Animated.timing(colorAnim, {
        toValue: focused ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  const iconColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [INACTIVE_TINT, ACTIVE_TINT],
  });

  const labelColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [INACTIVE_TINT, ACTIVE_TINT],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.tabItem, { width: tabWidth }]}
    >
      {/* Icon */}
      <Animated.View
        style={{
          transform: [{ scale: iconScaleAnim }, { translateY: iconTranslateY }],
        }}
      >
        <Animated.Text style={[styles.tabIcon, { color: iconColor }]}>
          {icon}
        </Animated.Text>
      </Animated.View>

      {/* Label */}
      <Animated.Text
        style={[
          styles.tabLabel,
          {
            color: labelColor,
            opacity: labelOpacity,
            transform: [{ scale: labelScale }],
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>

      {/* Active dot */}
      <Animated.View
        style={[
          styles.activeDot,
          {
            transform: [{ scale: dotScale }],
            opacity: dotScale,
          },
        ]}
      />
    </TouchableOpacity>
  );
}

// ── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const tabBarWidth = SW - scale(24); // horizontal margin each side
  const tabWidth = tabBarWidth / state.routes.length;

  // Entrance animation
  const barTranslateY = useRef(new Animated.Value(100)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(barTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 160,
        friction: 20,
        delay: 120,
      }),
      Animated.timing(barOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
        delay: 120,
      }),
    ]).start();
  }, []);

  const handleTabPress = useCallback(
    (route, index) => {
      const isFocused = state.index === index;
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    },
    [state.index, navigation]
  );

  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <Animated.View
      style={[
        styles.barWrapper,
        {
          bottom: bottomPad + scale(8),
          transform: [{ translateY: barTranslateY }],
          opacity: barOpacity,
        },
      ]}
    >
      {/* Outer glass shell */}
      <View style={styles.barOuter}>
        {/* Frosted glass BG */}
        <LinearGradient
          colors={BAR_BLUR_BG}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top gloss highlight */}
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.4 }}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: scale(24), overflow: 'hidden' },
          ]}
        />

        {/* Inner tab row */}
        <View style={[styles.tabRow, { height: scale(60) }]}>
          {/* Sliding active pill — rendered behind tab items */}
          <SlidingIndicator
            tabCount={state.routes.length}
            activeIndex={state.index}
            tabWidth={tabWidth}
          />

          {state.routes.map((route, index) => {
            const cfg = TAB_CONFIG[route.name] || { icon: '•', label: route.name };
            return (
              <TabItem
                key={route.key}
                icon={cfg.icon}
                label={cfg.label}
                focused={state.index === index}
                onPress={() => handleTabPress(route, index)}
                tabWidth={tabWidth}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

// ── Floating Action Button ────────────────────────────────────────────────────
function FloatingButton({ onPress }) {
  const pulseScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.5)).current;
  const rotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.08,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sine),
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sine),
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.85,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sine),
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.4,
          duration: 1400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sine),
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotAnim, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    ).start();
  }, []);

  const rotate = rotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={fabStyles.wrapper}>
      {/* Outer glow ring */}
      <Animated.View style={[fabStyles.glowRing, { opacity: glowOpacity }]} />

      <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          <LinearGradient
            colors={['#5A9BFF', '#3A7BFF', '#2260E0']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={fabStyles.btn}
          >
            {/* Glass shine */}
            <LinearGradient
              colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.0)']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 0.55 }}
              style={[StyleSheet.absoluteFill, { borderRadius: scale(28) }]}
            />
            {/* Rotating ring */}
            <Animated.View style={[fabStyles.ring, { transform: [{ rotate }] }]} />
            <Text style={fabStyles.icon}>✦</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Shared Screen Options ─────────────────────────────────────────────────────
const sharedScreenOpts = {
  headerShown: false,
  contentStyle: { backgroundColor: COLORS.bg },
  // Smooth cross-fade for tab switches
  animation: 'fade',
  animationDuration: 200,
};

// ── Stack Navigators ──────────────────────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...sharedScreenOpts,
        animation: 'fade_from_bottom',
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen
        name="MovieDetail"
        component={MovieDetailScreen}
        options={{
          animation: 'ios_from_right',
          animationDuration: 320,
        }}
      />
      <Stack.Screen
        name="GenreScreen"
        component={GenreScreen}
        options={{
          animation: 'ios_from_right',
          animationDuration: 320,
        }}
      />
      <Stack.Screen
        name="SearchScreen"
        component={SearchScreen}
        options={{
          animation: 'fade',
          animationDuration: 200,
        }}
      />
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{
          animation: 'ios_from_right',
          animationDuration: 320,
        }}
      />
    </Stack.Navigator>
  );
}

function MoviesStack() {
  return (
    <Stack.Navigator screenOptions={sharedScreenOpts}>
      <Stack.Screen name="MoviesMain" component={MoviesScreen} />
      <Stack.Screen
        name="MovieDetail"
        component={MovieDetailScreen}
        options={{
          animation: 'ios_from_right',
          animationDuration: 320,
        }}
      />
      <Stack.Screen
        name="GenreScreen"
        component={GenreScreen}
        options={{
          animation: 'ios_from_right',
          animationDuration: 320,
        }}
      />
    </Stack.Navigator>
  );
}

// ── Main Tab Navigator ────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // Telegram-style instant crossfade between tabs
          lazy: true,
        }}
      >
        <Tab.Screen name="HomeTab" component={HomeStack} />
        <Tab.Screen name="MoviesTab" component={MoviesStack} />
        <Tab.Screen name="FriendsTab" component={FriendsScreen} />
        <Tab.Screen name="ProfileTab" component={ProfileScreen} />
      </Tab.Navigator>

      {/* FAB sits above the tab bar */}
      <FloatingButton onPress={() => {}} />
    </View>
  );
}

// ── Root Navigator ────────────────────────────────────────────────────────────
export default function AppNavigator() {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: ACTIVE_TINT,
          background: COLORS.bg,
          card: COLORS.bg2 || '#fff',
          text: COLORS.text || '#111',
          border: COLORS.glassBorder || 'rgba(200,210,230,0.4)',
          notification: COLORS.red || '#FF3B30',
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'fade',
          animationDuration: 220,
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Bar ─────────────────────────────────────────────────────────────────────
  barWrapper: {
    position: 'absolute',
    left: scale(12),
    right: scale(12),
    zIndex: 999,
    // Soft floating shadow
    shadowColor: GLASS_SHADOW,
    shadowOffset: { width: 0, height: scale(8) },
    shadowOpacity: 1,
    shadowRadius: scale(24),
    elevation: 24,
  },
  barOuter: {
    borderRadius: scale(24),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS_WHITE_BORDER,
    // Second layer shadow for depth
    shadowColor: 'rgba(80,120,200,0.15)',
    shadowOffset: { width: 0, height: scale(2) },
    shadowOpacity: 1,
    shadowRadius: scale(8),
  },

  // ── Tab Row ─────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(4),
    paddingHorizontal: scale(4),
    position: 'relative',
  },

  // ── Sliding Pill ─────────────────────────────────────────────────────────────
  slidingPill: {
    position: 'absolute',
    borderRadius: scale(18),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PILL_ACTIVE_BORDER,
    // Deep 3-D glass shadow
    shadowColor: 'rgba(58,123,255,0.25)',
    shadowOffset: { width: 0, height: scale(4) },
    shadowOpacity: 1,
    shadowRadius: scale(12),
    elevation: 12,
  },
  pillInnerShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: scale(10),
    borderBottomLeftRadius: scale(18),
    borderBottomRightRadius: scale(18),
    backgroundColor: 'rgba(180,200,240,0.18)',
  },

  // ── Tab Item ─────────────────────────────────────────────────────────────────
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(6),
    zIndex: 2, // sit above sliding pill
  },
  tabIcon: {
    fontSize: scale(19),
    lineHeight: scale(24),
    includeFontPadding: false,
    textAlign: 'center',
  },
  tabLabel: {
    fontSize: scale(10),
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    letterSpacing: 0.2,
    marginTop: scale(2),
    includeFontPadding: false,
    textAlign: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: scale(4),
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: INDICATOR_COLOR,
    shadowColor: INDICATOR_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: scale(4),
  },
});

const fabStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: scale(80),
    right: scale(20),
    zIndex: 998,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(58,123,255,0.22)',
    shadowColor: '#3A7BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: scale(16),
  },
  btn: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    // Deep shadow
    shadowColor: '#3A7BFF',
    shadowOffset: { width: 0, height: scale(6) },
    shadowOpacity: 0.55,
    shadowRadius: scale(14),
    elevation: 18,
  },
  ring: {
    position: 'absolute',
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderTopColor: 'rgba(255,255,255,0.65)',
  },
  icon: {
    color: '#FFFFFF',
    fontSize: scale(22),
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});
