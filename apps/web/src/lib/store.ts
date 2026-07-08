import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/auth/authSlice';

/**
 * Root store factory. A factory (not a singleton) keeps SSR requests
 * isolated — each request gets a fresh store.
 */
export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
