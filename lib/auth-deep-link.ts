import type { EmailOtpType } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

function getAuthParams(url: string) {
  const parsedUrl = new URL(url);
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));

  return {
    get(name: string) {
      return parsedUrl.searchParams.get(name) ?? hashParams.get(name);
    },
  };
}

export async function createSessionFromAuthUrl(url: string) {
  const params = getAuthParams(url);
  const errorDescription = params.get('error_description');
  const errorCode = params.get('error_code') ?? params.get('error');

  if (errorDescription || errorCode) {
    throw new Error(errorDescription ?? errorCode ?? 'Authentication failed.');
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;
    return data.session;
  }

  const code = params.get('code');

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) throw error;
    return data.session;
  }

  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) throw error;
    return data.session;
  }

  throw new Error('The confirmation link is invalid or has expired.');
}
