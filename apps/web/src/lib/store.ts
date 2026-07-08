import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/auth/authSlice';
import editorReducer from './features/editor/editorSlice';
import videoReducer from './features/video/videoSlice';

/**
 * Root store factory. A factory (not a singleton) keeps SSR requests
 * isolated — each request gets a fresh store.
 */
export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      editor: editorReducer,
      video: videoReducer,
    },
    // The editor stores non-serializable-free but large docs; the interaction
    // base can briefly hold a full document snapshot. Disable the perf-heavy
    // serializable check paths for the editor's live-update action.
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: { ignoredPaths: ['editor.interactionBase'] },
      }),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
