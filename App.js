// App.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, AppState, StatusBar,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider } from './src/context/AppContext';
import SplashScreen from './src/screens/SplashScreen';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/data/theme';

// Splash only shows when app is opened from closed state (not from background)
// Just like Netflix / Hotstar / Prime behavior
const SPLASH_KEY = 'flicks_splash_seen';
const SPLASH_DURATION_MS = 3800; // How long until we allow skip if needed

export default function App() {
  const [splashDone, setSplashDone]   = useState(false);
  const [shouldShow, setShouldShow]   = useState(true);   // show splash?
  const [appReady, setAppReady]       = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const wasInBackground = useRef(false);

  useEffect(() => {
    // On mount: check if session storage says we already showed it
    AsyncStorage.getItem(SPLASH_KEY).then(val => {
      if (val === 'shown') {
        // App was in memory / fast resume — skip splash
        setShouldShow(false);
        setSplashDone(true);
      }
      setAppReady(true);
    }).catch(() => {
      setAppReady(true);
    });

    // Listen for app state changes (foreground/background)
    const sub = AppState.addEventListener('change', nextState => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev === 'active' && nextState.match(/inactive|background/)) {
        // App going to background
        wasInBackground.current = true;
        // Clear splash flag so NEXT cold open shows it again
        AsyncStorage.removeItem(SPLASH_KEY).catch(() => {});
      }

      if (prev.match(/inactive|background/) && nextState === 'active') {
        // Returning FROM background — skip splash (like Hotstar)
        if (wasInBackground.current) {
          setShouldShow(false);
          setSplashDone(true);
        }
      }
    });

    return () => sub.remove();
  }, []);

  const handleSplashDone = useCallback(() => {
    // Mark that splash has been shown for this session
    AsyncStorage.setItem(SPLASH_KEY, 'shown').catch(() => {});
    setSplashDone(true);
  }, []);

  if (!appReady) {
    // Render nothing while checking storage (< 50ms usually)
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} translucent={false} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <View style={styles.root}>
            {/* Main app always mounted (hidden behind splash until done) */}
            <View style={[styles.main, { opacity: splashDone ? 1 : 0 }]}>
              {splashDone && <AppNavigator />}
            </View>

            {/* Splash overlay */}
            {!splashDone && shouldShow && (
              <View style={StyleSheet.absoluteFill}>
                <SplashScreen onDone={handleSplashDone} />
              </View>
            )}
          </View>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  main: { flex: 1 },
});
