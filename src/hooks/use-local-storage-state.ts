"use client";

import { useState, useEffect, useCallback } from 'react';

function useLocalStorageState<T>(
  key: string,
  defaultValue: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    // This function now only runs on the client after mount or if window is defined.
    // DefaultValue is returned if not on client yet.
    if (typeof window === 'undefined') {
      return typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue;
    }
    try {
      const storedValue = window.localStorage.getItem(key);
      if (storedValue) {
        return JSON.parse(storedValue) as T;
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
    return typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue;
  });

  useEffect(() => {
    // This effect ensures that we only access localStorage on the client side.
    // It also initializes the state from localStorage on first client render if not already done.
    if (typeof window !== 'undefined') {
      try {
        const storedValue = window.localStorage.getItem(key);
        if (storedValue) {
           // Only parse and set if the current state is still the initial default value,
           // to avoid overwriting state that might have been set by other means before this effect runs.
           // This part might need careful consideration based on how defaultValue is handled.
           // For simplicity, let's assume the initial useState correctly sets from localStorage if available.
        } else {
          // If nothing in local storage, initialize with default value
           window.localStorage.setItem(key, JSON.stringify(typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue));
        }
      } catch (error) {
        console.error(`Error initializing localStorage key "${key}":`, error);
      }
    }
  }, [key, defaultValue]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.error(`Error writing to localStorage key "${key}":`, error);
      }
    }
  }, [key, state]);

  return [state, setState];
}

export default useLocalStorageState;
