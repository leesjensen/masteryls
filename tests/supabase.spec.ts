import { test, expect } from 'playwright-test-coverage';

import { createClient } from '@supabase/supabase-js';
import config from '../config';

const supabase = createClient(config.supabase.url, config.supabase.key);

test('learner access', async ({ request }) => {
  const name = `Test${Math.floor(Math.random() * 100000)}`;
  const email = `${name}@mailinator.com`;
  const password = name;

  const user = await validateRegister(name, email, password);
  try {
    const catalog = await validateCatalogRead();
    expect(catalog).toBeDefined();

    await validateRoleAccess(0);
    await validateRoleAdd(user.id, 'editor', catalog![0].id, {}, true);
  } finally {
    await validateDeleteUser(user.id);
  }
});

test('change password', async ({ request }) => {
  const name = `Test${Math.floor(Math.random() * 100000)}`;
  const email = `${name}@mailinator.com`;
  const password = name;

  const user = await validateRegister(name, email, password);
  try {
    await validateChangePassword('New' + password);
    await validateLogin(email, 'New' + password);
  } finally {
    await validateDeleteUser(user.id);
  }
});

async function validateRegister(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user || !data.session || !data.session.access_token) {
    throw new Error(error?.message || 'Unable to register');
  }

  supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });

  const user = {
    id: data.user.id,
    email,
    name,
  };
  const { error: upsertError } = await supabase.from('user').upsert(user);
  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return user;
}

async function validateLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message || 'Unable to login');
  }

  supabase.auth.setSession({ access_token: data.session?.access_token, refresh_token: data.session?.refresh_token });
}

async function validateChangePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password });
  expect(error).toBeNull();
}

async function validateCatalogRead() {
  const { data, error } = await supabase.from('catalog').select('*');

  expect(error).toBeNull();
  expect(Array.isArray(data)).toBe(true);
  expect(data && data.length > 0).toBe(true);

  return data;
}

async function validateRoleAccess(expectedCount: number) {
  const { data, error } = await supabase.from('role').select('*');

  expect(error).toBeNull();
  expect(Array.isArray(data)).toBe(true);
  expect(data && data.length === expectedCount).toBe(true);
}

async function validateRoleAdd(userId: string, right: string, objectId: string, settings: any, expectedError: boolean) {
  const newRole = {
    user: userId,
    right,
    object: objectId,
    settings,
  };
  const { error } = await supabase.from('role').insert(newRole);

  if (expectedError) {
    expect(error).not.toBeNull();
    return;
  }
  expect(error).toBeNull();
}

async function validateDeleteUser(userId: string): Promise<void> {
  const { error } = await supabase.from('user').delete().eq('id', userId);
  if (error) {
    throw new Error(error.message);
  }
}
