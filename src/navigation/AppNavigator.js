// src/navigation/AppNavigator.js
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, RADIUS } from '../data/theme';

import HomeScreen from '../screens/HomeScreen';
import {
  SearchScreen, MovieDetailScreen, GenreScreen,
  MoviesScreen, FriendsScreen, ProfileScreen,
} from '../screens/AllScreens';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();
const { width: SW } = Dimensions.get('window');

// ── Tab Icon Map ─────────────────────────────────────────────────────────────
const TAB_ICONS = {
  HomeTab:     { icon: '⊞',   label: 'HOME'    },
  MoviesTab:   { icon: '🎬',   label: 'MOVIES'  },
  FriendsTab:  { icon: '👥',   label: 'FRIENDS' },
  ProfileTab:  { icon: '👤',   label: 'PROFILE' },
};

// ── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.wrapper, { paddingBottom: insets.bottom || 12 }]}>
      {/* Glass background */}
      <LinearGradient
        colors={['rgba(3,20,15,0.85)', 'rgba(3,15,12,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      {/* Top border glow */}
      <View style={tabStyles.topGlow} />
      {/* Inner glow strip */}
      <LinearGradient
        colors={['rgba(0,255,178,0.08)', 'transparent']}
        style={tabStyles.innerGlow}
      />

      <View style={tabStyles.tabRow}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tabInfo = TAB_ICONS[route.name] || { icon: '•', label: route.name };

          return (
            <TabItem
              key={route.key}
              icon={tabInfo.icon}
              label={tabInfo.label}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({ icon, label, focused, onPress }) {
  const scaleAnim   = useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const glowAnim    = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const labelAnim   = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0.85,
        useNativeDriver: true,
        tension: 300,
        friction: 15,
      }),
      Animated.timing(glowAnim, {
        toValue: focused ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(labelAnim, {
        toValue: focused ? 1 : 0.6,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  const bgColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,255,178,0.0)', 'rgba(0,255,178,0.12)'],
  });

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,255,178,0.0)', 'rgba(0,255,178,0.45)'],
  });

  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={tabStyles.tabItem}
    >
      <Animated.View
        style={[
          tabStyles.tabPill,
          {
            backgroundColor: bgColor,
            borderColor,
            borderWidth: 1,
            shadowColor: COLORS.accent,
            shadowOpacity,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* 3D glass highlight */}
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        <Text
          style={[
            tabStyles.tabIcon,
            { color: focused ? COLORS.accent : COLORS.textMuted },
          ]}
        >
          {icon}
        </Text>
        <Animated.Text
          style={[
            tabStyles.tabLabel,
            {
              color: focused ? COLORS.accent : COLORS.textMuted,
              opacity: labelAnim,
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>

      {/* Active dot under label */}
      {focused && (
        <Animated.View style={[tabStyles.activeDot, { opacity: glowAnim }]} />
      )}
    </TouchableOpacity>
  );
}

// ── Floating Action Button ──────────────────────────────────────────────────
function FloatingButton({ onPress }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = rotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        fabStyles.container,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <LinearGradient
          colors={[COLORS.accent, '#00CC88', '#00A070']}
          style={fabStyles.btn}
        >
          {/* Rotating inner ring */}
          <Animated.View style={[fabStyles.ring, { transform: [{ rotate }] }]} />
          <Text style={fabStyles.icon}>✦</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Home Stack ─────────────────────────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        contentStyle: { backgroundColor: COLORS.bg },
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="GenreScreen"   component={GenreScreen}   options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SearchScreen"  component={SearchScreen}  options={{ animation: 'fade' }} />
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}

// ── Main Tab Navigator ─────────────────────────────────────────────────────
function MainTabs() {
  const [fabVisible, setFabVisible] = React.useState(true);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="HomeTab"    component={HomeStack}    />
        <Tab.Screen name="MoviesTab"  component={MoviesStack}  />
        <Tab.Screen name="FriendsTab" component={FriendsScreen} />
        <Tab.Screen name="ProfileTab" component={ProfileScreen} />
      </Tab.Navigator>

      {/* Floating action button */}
      {fabVisible && (
        <FloatingButton onPress={() => {}} />
      )}
    </View>
  );
}

function MoviesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: COLORS.bg } }}>
      <Stack.Screen name="MoviesMain" component={MoviesScreen} />
      <Stack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="GenreScreen"  component={GenreScreen}  options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}

// ── Root Navigator ─────────────────────────────────────────────────────────
export default function AppNavigator() {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: COLORS.accent,
          background: COLORS.bg,
          card: COLORS.bg2,
          text: COLORS.text,
          border: COLORS.glassBorder,
          notification: COLORS.red,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}>
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── Tab Styles ─────────────────────────────────────────────────────────────
const tabStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    // 3D glass shadow
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  topGlow: {
    height: 1,
    backgroundColor: COLORS.accent,
    opacity: 0.25,
  },
  innerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabPill: {
    borderRadius: RADIUS.xl,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 3,
    includeFontPadding: false,
  },
  tabLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    includeFontPadding: false,
  },
  activeDot: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },
});

const fabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70,
    right: 20,
    zIndex: 500,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  btn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderTopColor: 'rgba(255,255,255,0.6)',
  },
  icon: {
    color: '#000',
    fontSize: 22,
    fontWeight: '900',
  },
});
