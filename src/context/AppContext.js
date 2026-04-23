// src/context/AppContext.js
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../lib/supabase';

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [session, setSession]       = useState(null);
  const [authReady, setAuthReady]   = useState(false);
  const [myList, setMyList]         = useState([]);
  const [toastMsg, setToastMsg]     = useState(null);
  const toastTimer                  = useRef(null);

  useEffect(() => {
    authAPI.getSession().then(s => {
      setSession(s);
      setAuthReady(true);
    });
    // Load my list from storage
    AsyncStorage.getItem('flicks_mylist').then(val => {
      if (val) setMyList(JSON.parse(val));
    }).catch(() => {});
  }, []);

  const showToast = (msg) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2500);
  };

  const toggleMyList = (movieId) => {
    setMyList(prev => {
      const next = prev.includes(movieId)
        ? prev.filter(id => id !== movieId)
        : [...prev, movieId];
      AsyncStorage.setItem('flicks_mylist', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const isInMyList = (movieId) => myList.includes(movieId);

  return (
    <AppCtx.Provider value={{ session, authReady, myList, toggleMyList, isInMyList, showToast, toastMsg }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useAppContext = () => useContext(AppCtx);
