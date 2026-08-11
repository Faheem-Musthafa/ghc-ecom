import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { createClient, User } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from '../src/config/env.validation';

interface AuthResult {
  user: User | null;
  authenticated: boolean;
  roles: string[];
}

interface Profile {
  id: string;
  fullName: string | null;
  phone: string | null;
}

interface Address {
  id: string;
  userId: string;
  label: string;
}

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const apiUrl = requireEnvironment('API_PUBLIC_URL');
const supabaseUrl = normalizeSupabaseUrl(requireEnvironment('SUPABASE_URL'));
const publishableKey = requireEnvironment('SUPABASE_ANON_KEY');
const secretKey = requireEnvironment('SUPABASE_SERVICE_ROLE_KEY');

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const admin = createClient(supabaseUrl, secretKey, clientOptions);
const customerAuth = createClient(supabaseUrl, publishableKey, clientOptions);
const createdUserIds: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  expectedStatus = 200,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : (undefined as T);

  if (response.status !== expectedStatus) {
    throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${text}`);
  }
  return body;
}

async function createConfirmedUser(email: string, password: string): Promise<User> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'RLS Peer' },
  });
  if (error) {
    throw error;
  }
  createdUserIds.push(data.user.id);
  return data.user;
}

async function run(): Promise<void> {
  const suffix = `${Date.now()}-${randomBytes(5).toString('hex')}`;
  const email = `phase2.primary.${suffix}@gmail.com`;
  const peerEmail = `phase2.peer.${suffix}@gmail.com`;
  const password = `T3st!${randomBytes(18).toString('base64url')}`;

  try {
    const registration = await apiRequest<AuthResult>(
      '/api/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          fullName: 'Phase Two Tester',
        }),
      },
      201,
    );
    assert(registration.user, 'Registration did not return a user');
    createdUserIds.push(registration.user.id);
    console.log('✓ Registration created a Supabase user');

    const { error: confirmationError } = await admin.auth.admin.updateUserById(
      registration.user.id,
      { email_confirm: true },
    );
    if (confirmationError) {
      throw confirmationError;
    }

    const login = await apiRequest<AuthResult>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    assert(login.authenticated && login.user, 'Login did not authenticate the browser session');
    console.log('✓ Confirmed customer login returned the cookie-safe browser response');

    const { data: signedIn, error: signInError } = await customerAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !signedIn.session)
      throw signInError || new Error('Supabase test session unavailable');
    const { data: refreshed, error: refreshError } = await customerAuth.auth.refreshSession(
      signedIn.session,
    );
    if (refreshError || !refreshed.session)
      throw refreshError || new Error('Supabase refresh failed');
    const accessToken = refreshed.session.access_token;
    console.log('✓ Refresh token rotation returned a new provider session');

    const profile = await apiRequest<Profile>('/api/v1/me/profile', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert(profile.id === registration.user.id, 'Signup trigger profile mismatch');
    console.log('✓ Signup trigger created the matching profile');

    const { data: roles, error: rolesError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', registration.user.id);
    if (rolesError) {
      throw rolesError;
    }
    assert(
      roles?.some((assignment) => assignment.role === 'customer'),
      'Signup trigger did not assign the customer role',
    );
    console.log('✓ Signup trigger assigned the customer role');

    const peer = await createConfirmedUser(peerEmail, password);
    const rlsClient = createClient(supabaseUrl, publishableKey, {
      ...clientOptions,
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });

    const { data: visibleProfiles, error: ownProfileError } = await rlsClient
      .from('profiles')
      .select('id');
    if (ownProfileError) {
      throw ownProfileError;
    }
    assert(
      visibleProfiles?.length === 1 && visibleProfiles[0]?.id === registration.user.id,
      'RLS did not restrict profile reads to the current customer',
    );

    const { data: peerProfile, error: peerProfileError } = await rlsClient
      .from('profiles')
      .select('id')
      .eq('id', peer.id);
    if (peerProfileError) {
      throw peerProfileError;
    }
    assert(peerProfile?.length === 0, 'RLS exposed another customer profile');
    console.log('✓ RLS hides other customer profiles');

    const { error: crossOwnerInsertError } = await rlsClient.from('addresses').insert({
      user_id: peer.id,
      label: 'Blocked',
      recipient_name: 'Blocked Address',
      phone: '9876543210',
      line1: 'Blocked',
      city: 'Mumbai',
      state: 'Maharashtra',
      postal_code: '400001',
      country: 'IN',
    });
    assert(crossOwnerInsertError, 'RLS allowed an address for another customer');
    console.log('✓ RLS blocks cross-customer address writes');

    const address = await apiRequest<Address>(
      '/api/v1/me/addresses',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          label: 'Home',
          recipientName: 'Phase Two Tester',
          phone: '9876543210',
          line1: '123 Verification Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'IN',
          isDefault: true,
        }),
      },
      201,
    );
    assert(address.userId === registration.user.id, 'Address owner mismatch');
    console.log('✓ Customer address API writes only to the authenticated owner');

    await apiRequest<unknown>(
      '/api/v1/admin/audit-logs',
      { headers: { authorization: `Bearer ${accessToken}` } },
      403,
    );
    console.log('✓ Customer token is rejected from admin APIs');

    await apiRequest<unknown>(
      '/api/v1/auth/logout',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
      },
      204,
    );
    console.log('✓ Logout completed');
  } finally {
    for (const userId of createdUserIds.reverse()) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        console.error(`Cleanup warning for test user: ${error.message}`);
      }
    }
  }
}

void run()
  .then(() => {
    console.log('Phase 2 live verification passed; temporary users were removed.');
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Phase 2 live verification failed: ${message}`);
    process.exitCode = 1;
  });
