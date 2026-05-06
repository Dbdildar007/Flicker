// src/navigation/AppNavigator.js
import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Easing, Keyboard
} from 'react-native';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, RADIUS } from '../data/theme';
import Icon from 'react-native-vector-icons/Feather';
const AnimatedIcon = Animated.createAnimatedComponent(Icon);
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import MovieDetails from '../components/MovieDetails';
import FriendsScreen from '../screens/FriendScreen';
import ProfileScreen from '../screens/Profile';
import Player from '../components/Player'
import {
  GenreScreen,
  Chart,
} from '../screens/AllScreens';


const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Responsive helpers ─────────────────────────────────────────────────────────
const getDimensions = () => Dimensions.get('window');

const scale = (size) => {
  const { width } = getDimensions();
  if (width < 360) return Math.round(size * 0.86);
  if (width < 414) return Math.round(size * 0.93);
  if (width > 600) return Math.round(size * 1.08); // tablets
  return size;
};

// ── Tab Configuration ──────────────────────────────────────────────────────────
const TAB_CONFIG = {
  HomeTab: { icon: 'home', label: 'Home' },
  SearchTab: { icon: 'search', label: 'Search' },
  FriendsTab: { icon: 'users', label: 'Friends' },
  ProfileTab: { icon: 'user', label: 'Profile' },
};

// ── Design tokens ──────────────────────────────────────────────────────────────
const ACTIVE_COLOR = '#2a0bf3ff';
const INACTIVE_COLOR = '#15e3edff';

// Bar: 24% transparent white glass
const BAR_BG_COLORS = ['rgba(247, 244, 244, 0.24)', 'rgba(255,255,255,0.20)'];
const BAR_BORDER = 'rgba(240, 236, 236, 0.28)';
const BAR_TOP_SHINE = ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.0)'];

// Active pill: #00FFB2 tinted glass
const PILL_BG_COLORS = ['rgba(239, 246, 244, 0.42)', 'rgba(247, 254, 252, 0.1)'];
const PILL_SHINE = ['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.0)'];
const PILL_BORDER = 'rgba(240, 244, 243, 0.38)';
const PILL_SHADOW = '#f5f6f9ff';

// ── Sliding pill indicator (Telegram-style) ───────────────────────────────────
function SlidingIndicator({ activeIndex, tabWidth }) {
  const slideAnim = useRef(new Animated.Value(activeIndex * tabWidth)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fast spring slide — like Telegram
    Animated.spring(slideAnim, {
      toValue: activeIndex * tabWidth,
      useNativeDriver: true,
      bounciness: 4,
      speed: 26,
    }).start();

    // Subtle squish feedback
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 55,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.8)),
      }),
    ]).start();
  }, [activeIndex]);

  const pillW = tabWidth - scale(10);
  const pillH = scale(54);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.slidingPill,
        {
          width: pillW,
          height: pillH,
          left: scale(5),
          top: '50%',
          marginTop: -(pillH / 2),
          transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      {/* Main tinted fill */}
      <LinearGradient
        colors={PILL_BG_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: scale(30) }]}
      />
      {/* Top shine — 3D raised glass */}
      <LinearGradient
        colors={PILL_SHINE}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.52 }}
        style={[StyleSheet.absoluteFill, { borderRadius: scale(30) }]}
      />
      {/* Bottom depth shadow */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.10)']}
        start={{ x: 0, y: 0.6 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: scale(30) }]}
      />
    </Animated.View>
  );
}

// ── Updated TabItem ────────────────────────────────────────────────────────────
function TabItem({ icon, label, focused, onPress, tabWidth }) {
  // 1. Native Values (Transforms/Opacity) - useNativeDriver: true
  const iconScale = useRef(new Animated.Value(focused ? 1.2 : 1)).current;
  const iconShiftY = useRef(new Animated.Value(focused ? -1.5 : 0)).current;
  const labelScale = useRef(new Animated.Value(focused ? 1.08 : 1)).current;
  const labelOpac = useRef(new Animated.Value(focused ? 1 : 0.5)).current;
  const dotScale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  // 2. JS Value (Color) - useNativeDriver: false
  // We initialize this specifically to avoid the "native node" error
  const colorAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    // Standard Native Animations
    Animated.parallel([
      Animated.timing(iconScale, {
        toValue: focused ? 1.2 : 1,
        duration: 180,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(iconShiftY, {
        toValue: focused ? -1.5 : 0,
        duration: 180,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(labelOpac, {
        toValue: focused ? 1 : 0.5,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
      Animated.timing(dotScale, {
        toValue: focused ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start();

    // JS-Thread Animation for Color
    // This MUST have useNativeDriver: false
    Animated.timing(colorAnim, {
      toValue: focused ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.linear,
    }).start();

  }, [focused]); // Dependency array ensures this runs when focus changes

  // Interpolate the color based on the JS-driven value
  const tintColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [INACTIVE_COLOR, ACTIVE_COLOR],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.tabItem, { width: tabWidth }]}
    >
      <Animated.View
        style={{
          transform: [{ scale: iconScale }, { translateY: iconShiftY }],
        }}
      >
        <AnimatedIcon
          name={icon} // This comes from your TAB_CONFIG
          size={scale(22)}
          style={[
            styles.tabIcon,
            {
              color: tintColor,
              // Optional: Adds a neon glow effect when active
              textShadowColor: ACTIVE_COLOR,
              textShadowOffset: { width: 0, height: 0 },
            }
          ]}
        />
      </Animated.View>

      <Animated.Text
        numberOfLines={1}
        style={[
          styles.tabLabel,
          {
            color: tintColor,
            opacity: labelOpac,
            transform: [{ scale: labelScale }],
          },
        ]}
      >
        {label}
      </Animated.Text>

      <Animated.View
        style={[
          styles.activeDot,
          {
            transform: [{ scale: dotScale }],
            opacity: dotScale,
            backgroundColor: ACTIVE_COLOR // Ensure dot is always the active color
          }
        ]}
      />
    </TouchableOpacity>
  );
}
// ── Custom Tab Bar ─────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { width: currentWidth } = getDimensions();
  const tabBarWidth = currentWidth - scale(20) * 2;
  const tabWidth = tabBarWidth / state.routes.length;

  // Entrance animation
  const barY = useRef(new Animated.Value(80)).current;
  const barOpac = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(barY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
        speed: 14,
        delay: 100,
      }),
      Animated.timing(barOpac, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
        delay: 100,
      }),
    ]).start();
  }, []);

  const handlePress = useCallback(
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

  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <Animated.View
      style={[
        styles.barWrapper,
        {
          bottom: bottomPad + scale(2),
          left: scale(20),
          right: scale(20),
          transform: [{ translateY: barY }],
          opacity: barOpac,
        },
      ]}
    >
      <View style={styles.barOuter}>
        {/* Layer 1: 24% transparent glass base */}
        <LinearGradient
          colors={BAR_BG_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: scale(360) }]}
        />

        {/* Layer 2: top-edge shine — 3D raised look */}
        <LinearGradient
          colors={BAR_TOP_SHINE}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.38 }}
          style={[StyleSheet.absoluteFill, { borderRadius: scale(36) }]}
        />

        {/* Layer 3: left-to-right bevel */}
        <LinearGradient
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { borderRadius: scale(36) }]}
        />

        {/* Layer 4: bottom inner shadow for depth */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)']}
          start={{ x: 0, y: 0.65 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: scale(36) }]}
        />

        {/* Tab row */}
        <View style={[styles.tabRow, { height: scale(62) }]}>
          <SlidingIndicator
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
                onPress={() => handlePress(route, index)}
                tabWidth={tabWidth}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

// ── Floating Action Button ─────────────────────────────────────────────────────
function FloatingButton({ onPress }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.45)).current;
  const rotVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.07, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.80, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(glow, { toValue: 0.35, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotVal, { toValue: 1, duration: 10000, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, []);

  const rotate = rotVal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const FAB = scale(46);
  const FAB_R = FAB / 2;

  return (
    <View style={[fabStyles.wrapper, { bottom: scale(92), right: scale(18) }]}>
      <Animated.View
        style={[
          fabStyles.glowRing,
          {
            opacity: glow,
            width: FAB + scale(18),
            height: FAB + scale(18),
            borderRadius: (FAB + scale(18)) / 2,
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.82}>
          <LinearGradient
            colors={['#00FFB2', '#00CC90', '#009A6E']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[fabStyles.btn, { width: FAB, height: FAB, borderRadius: FAB_R }]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.0)']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 0.55 }}
              style={[StyleSheet.absoluteFill, { borderRadius: FAB_R }]}
            />
            <Animated.View
              style={[
                fabStyles.ring,
                {
                  width: FAB - scale(8),
                  height: FAB - scale(8),
                  borderRadius: (FAB - scale(8)) / 2,
                  transform: [{ rotate }],
                },
              ]}
            />
            <Text style={[fabStyles.icon, { fontSize: scale(18) }]}>✦</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}



const transitionSpec = {
  open: {
    animation: 'timing',
    config: { duration: 500, easing: Easing.out(Easing.poly(5)) },
  },
  close: {
    animation: 'timing',
    config: { duration: 500, easing: Easing.in(Easing.poly(5)) },
  },
};

const fadeSlideInterpolator = ({ current, layouts }) => {
  return {
    cardStyle: {
      opacity: current.progress,
      transform: [
        {
          translateY: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.height, 0], // slide up from bottom
          }),
        },
      ],
    },
  };
};


// ── Shared screen options ──────────────────────────────────────────────────────
const sharedScreenOpts = {
  headerShown: false,
  contentStyle: { backgroundColor: COLORS.bg },
  animation: 'fade',
  animationDuration: 180,
};

const netflixInterpolator = ({ current, next, layouts }) => ({
  cardStyle: {
    opacity: current.progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0.8, 1],
    }),
    transform: [
      {
        scale: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [60, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  },
  overlayStyle: {
    opacity: current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.6],
    }),
  },
});

// ── Stack navigators ───────────────────────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...sharedScreenOpts,
        animation: 'fade_from_bottom',
        presentation: 'modal',   // transition style
        // animation: 'fade', 
        headerShown: false,
        freezeOnBlur: true
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen
  name="MovieDetail"
  component={MovieDetails}
  options={{
    headerShown: false,
    cardStyleInterpolator: netflixInterpolator,
    transitionSpec: {
      open: { animation: 'timing', config: { duration: 380, easing: Easing.out(Easing.poly(4)) } },
      close: { animation: 'timing', config: { duration: 280, easing: Easing.in(Easing.poly(4)) } },
    },
    gestureEnabled: true,
    gestureDirection: 'vertical',
  }}
/>
      <Stack.Screen name="GenreScreen" component={GenreScreen} options={{ animation: 'ios_from_right', animationDuration: 300 }} />
      <Stack.Screen name="Player" component={Player} options={{ animation: 'ios_from_right', animationDuration: 300 }} />
    </Stack.Navigator>
  );
}

function SearchStack() {
  return (
    <Stack.Navigator screenOptions={{ ...sharedScreenOpts, freezeOnBlur: true }}>
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="MovieDetail" component={MovieDetails} options={{ animation: 'ios_from_right', animationDuration: 300 }} />
      <Stack.Screen name="GenreScreen" component={GenreScreen} options={{ animation: 'ios_from_right', animationDuration: 300 }} />
    </Stack.Navigator>
  );
}

function FriendStack() {
  return (
    <Stack.Navigator screenOptions={{ ...sharedScreenOpts, freezeOnBlur: true }}>
      <Stack.Screen name="Friends" component={FriendsScreen} />
      <Stack.Screen name="Chart" component={Chart} options={{ animation: 'ios_from_right', animationDuration: 300 }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ ...sharedScreenOpts, freezeOnBlur: true }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

// ── Main tabs ──────────────────────────────────────────────────────────────────
function MainTabs() {

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  function getActiveRouteName(state) {
  if (!state) return null;
  const route = state.routes[state.index];
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
}

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Tab.Navigator
        //tabBar={(props) => <CustomTabBar {...props} />}
        //tabBar={(props) => keyboardVisible ? null : <CustomTabBar {...props} />}
tabBar={(props) => {
  if (keyboardVisible) return null;
  
  const activeRoute = getActiveRouteName(props.state);
  const hiddenOnRoutes = ['MovieDetail', 'Player', 'GenreScreen'];
  if (hiddenOnRoutes.includes(activeRoute)) return null;
  
  return <CustomTabBar {...props} />;
}}
        screenOptions={{
          headerShown: false,
          lazy: false,         // pre-mount all screens — instant tab switching
          freezeOnBlur: false,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
        />
        <Tab.Screen name="SearchTab" component={SearchStack} />
        <Tab.Screen name="FriendsTab" component={FriendStack} />
        <Tab.Screen name="ProfileTab" component={ProfileStack} />
      </Tab.Navigator>

      <FloatingButton onPress={() => { }} />
    </View>
  );
}

// ── Root navigator ─────────────────────────────────────────────────────────────
export default function AppNavigator() {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: ACTIVE_COLOR,
          background: COLORS.bg,
          card: COLORS.bg2 || '#0a0a0a',
          text: COLORS.text || '#ffffff',
          border: COLORS.glassBorder || 'rgba(255,255,255,0.12)',
          notification: COLORS.red || '#FF3B30',
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'fade',
          animationDuration: 200,
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  barWrapper: {
    position: 'absolute',
    zIndex: 999,
    shadowColor: 'rgba(0,255,178,0.18)',
    shadowOffset: { width: 0, height: scale(6) },
    shadowOpacity: 1,
    shadowRadius: scale(20),
    elevation: 22,
  },

  // Fully-rounded pill — transparent 24% glass
  barOuter: {
    borderRadius: scale(36),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BAR_BORDER,
    backgroundColor: 'rgba(255,255,255,0.18)', // Android fallback
  },

  tabRow: {
    flexDirection: 'row',
    alignItems: 'center', // Keep this to ensure icons stay aligned with each other
    paddingHorizontal: scale(0),
    paddingBottom: scale(0),
    paddingTop: scale(0), // <--- Increase this value to "bring down" the tabs
    position: 'relative',
  },

  slidingPill: {
    position: 'absolute',
    borderRadius: scale(30),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PILL_BORDER,
    shadowColor: PILL_SHADOW,
    shadowOffset: { width: 0, height: scale(3) },
    shadowOpacity: 0.35,
    shadowRadius: scale(10),
    elevation: 10,
  },

  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(5),
    zIndex: 2,
  },

  tabIcon: {
    fontSize: scale(21),
    lineHeight: scale(26),
    includeFontPadding: false,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  tabLabel: {
    fontSize: scale(12),

    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    letterSpacing: 0.15,
    marginTop: scale(2),
    includeFontPadding: false,
    textAlign: 'center',
  },

  activeDot: {
    position: 'absolute',
    bottom: scale(3),
    width: scale(3),
    height: scale(3),
    borderRadius: scale(2),
    backgroundColor: ACTIVE_COLOR,
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: scale(4),
  },
});

const fabStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 998,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    backgroundColor: 'rgba(0,255,178,0.20)',
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: scale(14),
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: scale(5) },
    shadowOpacity: 0.5,
    shadowRadius: scale(12),
    elevation: 16,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderTopColor: 'rgba(255,255,255,0.60)',
  },
  icon: {
    color: '#001a0f',
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
});
