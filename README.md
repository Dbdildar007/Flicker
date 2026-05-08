/**
 * FIXES GUIDE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 1. HOW TO HIDE THE FLOATING BUTTON ON MovieDetail & Player
 * 2. HOW TO MAKE THE BOTTOM TAB APPEAR INSTANTLY ON BACK NAVIGATION
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ═══════════════════════════════════════════════════════════════════════════════
// FIX 1: HIDE FLOATING BUTTON ON MovieDetail / Player
// ═══════════════════════════════════════════════════════════════════════════════
//
// In AppNavigator.js, inside the MainTabs() component, replace:
//
//   <FloatingButton onPress={() => { }} />
//
// WITH:
//
//   <FloatingButtonConditional state={/* need to pass tab state here */} />
//
// The cleanest approach: use a Context or the navigation state to detect
// the active leaf route. Here is the complete replacement for MainTabs():
//
// ─────────────────────────────────────────────────────────────────────────────

// STEP A: Add this helper inside AppNavigator.js (outside MainTabs):
function getDeepActiveRoute(state) {
  if (!state) return null;
  const route = state.routes[state.index];
  if (route?.state) return getDeepActiveRoute(route.state);
  return route?.name;
}

// STEP B: Replace the MainTabs() function with this updated version:
function MainTabs() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Track which screen the user is on via tab navigator's state
  const [activeRoute, setActiveRoute] = useState(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Routes where the Floating Button should be HIDDEN
  const FAB_HIDDEN_ROUTES = ['MovieDetail', 'Player', 'GenreScreen'];
  const showFAB = !FAB_HIDDEN_ROUTES.includes(activeRoute);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Tab.Navigator
        tabBar={(props) => {
          if (keyboardVisible) return null;
          const route = getDeepActiveRoute(props.state);
          const hiddenOnRoutes = ['MovieDetail', 'Player', 'GenreScreen'];
          if (hiddenOnRoutes.includes(route)) return null;
          return <CustomTabBar {...props} />;
        }}
        screenOptions={{
          headerShown: false,
          lazy: false,
          freezeOnBlur: false,
        }}
        // ← This is the key: listen to state changes to track the active route
        screenListeners={{
          state: (e) => {
            const route = getDeepActiveRoute(e.data.state);
            setActiveRoute(route);
          },
        }}
      >
        <Tab.Screen name="HomeTab" component={HomeStack} />
        <Tab.Screen name="SearchTab" component={SearchStack} />
        <Tab.Screen name="FriendsTab" component={FriendStack} />
        <Tab.Screen name="ProfileTab" component={ProfileStack} />
      </Tab.Navigator>

      {/* FAB is now conditionally rendered based on active route */}
      {showFAB && <FloatingButton onPress={() => { }} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS WORKS:
// - screenListeners.state fires every time the navigation state changes,
//   including when you go back from MovieDetail to HomeMain.
// - We track the deepest active route name.
// - When it's MovieDetail or Player, we don't render <FloatingButton> at all.
//   This is better than visibility:hidden — it completely unmounts it.
// ─────────────────────────────────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════════════════════
// FIX 2: BOTTOM TAB APPEARING SLOWLY ON BACK NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════
//
// The delay you're seeing is caused by the ENTRANCE ANIMATION on CustomTabBar.
// In AppNavigator.js, the CustomTabBar has this useEffect:
//
//   useEffect(() => {
//     Animated.parallel([
//       Animated.spring(barY, { toValue: 0, ... delay: 100 }),
//       Animated.timing(barOpac, { toValue: 1, ... delay: 100 }),
//     ]).start();
//   }, []);   ← This runs once on MOUNT
//
// Because `tabBar` re-mounts CustomTabBar when going from MovieDetail back to
// HomeMain (since hiddenOnRoutes removed it), the animation plays from scratch.
//
// ── SOLUTION A (Best): Keep tab bar mounted, just hide/show it ───────────────
//
// Instead of returning null for hidden routes, set opacity/translateY to 0:

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { width: currentWidth } = getDimensions();
  const tabBarWidth = currentWidth - scale(20) * 2;
  const tabWidth = tabBarWidth / state.routes.length;

  // Entrance animation — only plays once on app boot, not on every back nav
  const barY = useRef(new Animated.Value(80)).current;
  const barOpac = useRef(new Animated.Value(0)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return; // ← SKIP if already animated in once
    mounted.current = true;
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

  // Determine visibility based on active route WITHOUT unmounting
  const activeRoute = getDeepActiveRoute(state);
  const hiddenOnRoutes = ['MovieDetail', 'Player', 'GenreScreen'];
  const isHidden = hiddenOnRoutes.includes(activeRoute) || keyboardVisible; // ← pass keyboardVisible as prop

  const handlePress = useCallback(
    (route, index) => {
      const isFocused = state.index === index;
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
    },
    [state.index, navigation]
  );

  const bottomPad = Math.max(insets.bottom, 10);

  return (
    // ↓ Use pointerEvents="none" + opacity=0 to hide without unmounting
    <Animated.View
      pointerEvents={isHidden ? 'none' : 'auto'}
      style={[
        styles.barWrapper,
        {
          bottom: bottomPad + scale(2),
          left: scale(20),
          right: scale(20),
          transform: [{ translateY: barY }],
          opacity: isHidden ? 0 : barOpac, // ← immediately 0 when hidden, no animation
        },
      ]}
    >
      {/* ... rest of bar content unchanged ... */}
    </Animated.View>
  );
}

// ── SOLUTION B (Quick fix, less optimal): Reduce animation duration ───────────
//
// If you want to keep the current unmount/remount approach but make it faster,
// just reduce the delay and duration in the entrance animation:

useEffect(() => {
  Animated.parallel([
    Animated.spring(barY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 2,       // ← was 6, reduced for speed
      speed: 40,           // ← was 14, much faster now
      delay: 0,            // ← was 100, no delay
    }),
    Animated.timing(barOpac, {
      toValue: 1,
      duration: 80,        // ← was 300ms, now nearly instant
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
      delay: 0,            // ← was 100, no delay
    }),
  ]).start();
}, []);

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDATION: Use Solution A.
// It keeps the tab bar in the component tree at all times (performance++),
// instantly shows it on back navigation with zero re-animation,
// and hides it cleanly while preventing touches on hidden areas.
// ─────────────────────────────────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════════════════════
// ADDITIONAL: Register MovieDetail in HomeStack (AppNavigator.js)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Make sure MovieDetails is imported and registered in HomeStack:
//
// import MovieDetails from '../components/MovieDetails';
//
// function HomeStack() {
//   return (
//     <Stack.Navigator screenOptions={{ ...sharedScreenOpts, freezeOnBlur: true }}>
//       <Stack.Screen name="HomeMain" component={HomeScreen} />
//       <Stack.Screen
//         name="MovieDetail"
//         component={MovieDetails}   ← Use the new component
//         options={{
//           headerShown: false,
//           gestureEnabled: true,
//           gestureDirection: 'vertical',
//         }}
//       />
//       ...
//     </Stack.Navigator>
//   );
// }
//
// SearchStack should also have MovieDetail registered the same way.
// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// DEPENDENCIES TO INSTALL (if not already in your project)
// ═══════════════════════════════════════════════════════════════════════════════
//
//   npm install react-native-video
//   npm install @react-native-community/slider
//
// For iOS: cd ios && pod install
//
// react-native-video docs: https://thewidlarzgroup.github.io/react-native-video/
// ═══════════════════════════════════════════════════════════════════════════════
