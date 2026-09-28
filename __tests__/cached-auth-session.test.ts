import {
  defaultSupabaseAuthStorageKey,
  parseCachedAuthSession,
} from '@/services/cachedAuthSession';

describe('cached Supabase auth session', () => {
  test('derives the storage key used by the Supabase client', () => {
    expect(defaultSupabaseAuthStorageKey('https://project-ref.supabase.co')).toBe(
      'sb-project-ref-auth-token',
    );
  });

  test('returns a persisted session that has the identity needed offline', () => {
    const session = {
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'user-1' },
    };

    expect(parseCachedAuthSession(JSON.stringify(session))?.user.id).toBe('user-1');
  });

  test.each([null, '', 'not-json', JSON.stringify({ access_token: 'missing-user' })])(
    'rejects an invalid persisted session',
    (value) => {
      expect(parseCachedAuthSession(value)).toBeNull();
    },
  );
});
