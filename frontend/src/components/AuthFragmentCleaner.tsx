'use client';

import { useLayoutEffect } from 'react';

const RECOVERY_PATH = '/auth/reset-password';

export const isSupabaseAuthFragment = (hash: string): boolean => {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return fragment.has('access_token') || fragment.has('refresh_token');
};

export default function AuthFragmentCleaner() {
  useLayoutEffect(() => {
    if (
      window.location.pathname !== RECOVERY_PATH &&
      isSupabaseAuthFragment(window.location.hash)
    ) {
      window.history.replaceState(
        window.history.state,
        document.title,
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, []);

  return null;
}
