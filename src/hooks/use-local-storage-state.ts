
"use client";

import { useState, useEffect } from 'react';

function useLocalStorageState<T>(
  key: string,
  defaultValue: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
  
  const [state, setState] = useState<T>(() => {
    // For server render and initial client render, always start with defaultValue.
    // If defaultValue is a function, it's invoked to get the value.
    // This ensures consistency between server and initial client render.
    return typeof defaultValue === 'function' 
      ? (defaultValue as () => T)() 
      : defaultValue;
  });

  // useEffect to load from localStorage on the client after hydration (mount).
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedValue = window.localStorage.getItem(key);
        if (storedValue !== null) {
          // If a value is found in localStorage, update the state.
          setState(JSON.parse(storedValue) as T);
        } else {
          // If no value in localStorage, the state is already the defaultValue.
          // Write this defaultValue to localStorage to initialize it.
          const valueToStore = typeof defaultValue === 'function' 
                             ? (defaultValue as () => T)() 
                             : defaultValue;
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(`Error reading or initializing localStorage key "${key}":`, error);
        // In case of an error (e.g., parsing), ensure state is reset to a known good default.
        // This also handles cases where defaultValue might be a function.
        setState(typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only re-run if the key changes. defaultValue is handled by useState initializer or written if localStorage is empty.

  // useEffect to save state changes back to localStorage.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // This effect runs after the state has been potentially updated from localStorage
      // by the first effect, or by user actions.
      // We only want to write to localStorage if the state isn't the one initially set by useState before hydration.
      // However, an easier approach that is safe is to always write the current state.
      // If the state came from localStorage and hasn't changed, this is idempotent.
      // If localStorage was empty and initialized with defaultValue, this writes defaultValue.
      // If the user changed the state, this writes the new state.
      // The crucial part is this runs *after* initial client-side hydration and potential state update from localStorage.
      
      // To prevent writing the initial defaultValue if it's still the value from SSR before the first effect has run:
      // We check if this is NOT the very first render pass where state is default AND localStorage might not have been checked.
      // This is a bit subtle: the first effect already handles setting from localStorage or initializing localStorage.
      // So, writing `state` here should always be correct after the first effect cycle.
      const initialRenderDefaultValue = typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue;
      if (state !== initialRenderDefaultValue || localStorage.getItem(key) !== null) {
        try {
          window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
          console.error(`Error writing to localStorage key "${key}":`, error);
        }
      }
    }
  }, [key, state, defaultValue]); // Include defaultValue to correctly manage the condition for initial write

  return [state, setState];
}

export default useLocalStorageState;
