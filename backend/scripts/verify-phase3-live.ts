import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { createClient, Session, User } from '@supabase/supabase-js';
import sharp from 'sharp';
import { normalizeSupabaseUrl } from '../src/config/env.validation';

interface AuthResult {
  user: User | null;
  session: Session | null;
}

interface Category {
  id: string;
  slug: string;
  isPublished: boolean;
}

interface ProductVariant {
  id: string;
  sku: string;
}

interface ProductImage {
  id: string;
  thumbnailPath: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  mediumPath: string;
  mediumWidth: number;
  mediumHeight: number;
  largePath: string;
  largeWidth: number;
  largeHeight: number;
}

interface Product {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  variants: ProductVariant[];
  images: ProductImage[];
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
const anonymous = createClient(supabaseUrl, publishableKey, clientOptions);

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

async function imageRequest(
  path: string,
  method: 'POST' | 'PUT',
  accessToken: string,
  image: Buffer,
): Promise<ProductImage> {
  const form = new FormData();
  form.set('altText', 'Live verified product image');
  form.set('sortOrder', '0');
  form.set('file', new Blob([Uint8Array.from(image)], { type: 'image/png' }), 'phase3-source.png');
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const text = await response.text();
  if (response.status !== (method === 'POST' ? 201 : 200)) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text}`);
  }
  return JSON.parse(text) as ProductImage;
}

async function verifyStoredDerivative(path: string, maxDimension: number): Promise<void> {
  const { data, error } = await admin.storage.from('product-images').download(path);
  if (error) {
    throw error;
  }
  const metadata = await sharp(Buffer.from(await data.arrayBuffer())).metadata();
  assert(metadata.format === 'webp', `${path} is not WebP`);
  assert(
    (metadata.width ?? maxDimension + 1) <= maxDimension &&
      (metadata.height ?? maxDimension + 1) <= maxDimension,
    `${path} exceeds ${maxDimension}px`,
  );
}

async function storageObjectExists(path: string): Promise<boolean> {
  const segments = path.split('/');
  const filename = segments.pop();
  const { data, error } = await admin.storage
    .from('product-images')
    .list(segments.join('/'), { search: filename });
  if (error) {
    throw error;
  }
  return data.some((object) => object.name === filename);
}

async function run(): Promise<void> {
  const suffix = `${Date.now()}-${randomBytes(5).toString('hex')}`;
  const email = `phase3.catalogue.${suffix}@gmail.com`;
  const password = `T3st!${randomBytes(18).toString('base64url')}`;
  const slug = `phase3-${suffix}`;
  const sku = `PHASE3-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  let userId: string | undefined;
  let categoryId: string | undefined;
  let productId: string | undefined;
  const storagePaths = new Set<string>();

  try {
    const { data: created, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Phase Three Catalogue Manager' },
    });
    if (createUserError) {
      throw createUserError;
    }
    userId = created.user.id;

    const { error: roleError } = await admin
      .from('user_roles')
      .insert({ user_id: userId, role: 'catalogue_manager', assigned_by: userId });
    if (roleError) {
      throw roleError;
    }

    const login = await apiRequest<AuthResult>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    assert(login.session, 'Catalogue manager login did not return a session');
    const accessToken = login.session.access_token;
    console.log('✓ Catalogue manager authenticated');

    const category = await apiRequest<Category>(
      '/api/v1/admin/catalogue/categories',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: 'Phase 3 Live Category',
          slug,
          isPublished: true,
        }),
      },
      201,
    );
    categoryId = category.id;

    const product = await apiRequest<Product>(
      '/api/v1/admin/catalogue/products',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          categoryId,
          name: 'Phase 3 Live Product',
          slug,
          shortDescription: 'Temporary live verification product',
          status: 'DRAFT',
          attributes: { material: 'test' },
          seoTitle: 'Phase 3 Live Product',
          seoDescription: 'Temporary catalogue verification product.',
        }),
      },
      201,
    );
    productId = product.id;

    await apiRequest<unknown>(`/api/v1/products/${slug}`, {}, 404);
    const { data: hiddenDraft, error: hiddenDraftError } = await anonymous
      .from('products')
      .select('id')
      .eq('id', productId);
    if (hiddenDraftError) {
      throw hiddenDraftError;
    }
    assert(hiddenDraft?.length === 0, 'RLS exposed a draft product');
    const adminDraft = await apiRequest<Product>(`/api/v1/admin/catalogue/products/${productId}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert(adminDraft.status === 'DRAFT', 'Admin could not retrieve the draft product');
    console.log('✓ Draft product is hidden publicly but visible to catalogue administration');

    const variant = await apiRequest<ProductVariant>(
      `/api/v1/admin/catalogue/products/${productId}/variants`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          sku,
          name: 'Default',
          pricePaise: 129900,
          compareAtPricePaise: 149900,
          attributes: { size: 'standard' },
        }),
      },
      201,
    );
    assert(variant.sku === sku, 'Variant SKU mismatch');
    await apiRequest<unknown>(
      `/api/v1/admin/catalogue/products/${productId}/variants`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          sku,
          name: 'Duplicate',
          pricePaise: 129900,
        }),
      },
      409,
    );
    console.log('✓ SKU uniqueness is enforced');

    const source = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: '#355070',
      },
    })
      .png()
      .toBuffer();
    const image = await imageRequest(
      `/api/v1/admin/catalogue/products/${productId}/images`,
      'POST',
      accessToken,
      source,
    );
    for (const path of [image.thumbnailPath, image.mediumPath, image.largePath]) {
      storagePaths.add(path);
      assert(path.endsWith('.webp'), 'Stored image path is not immutable WebP');
    }
    await Promise.all([
      verifyStoredDerivative(image.thumbnailPath, 400),
      verifyStoredDerivative(image.mediumPath, 800),
      verifyStoredDerivative(image.largePath, 1600),
    ]);
    console.log('✓ Three bounded WebP derivatives were stored and decoded');

    const blockedPath = `unauthorized/${randomBytes(8).toString('hex')}.webp`;
    const { error: blockedUploadError } = await anonymous.storage
      .from('product-images')
      .upload(blockedPath, Buffer.from('blocked'), {
        contentType: 'image/webp',
        upsert: false,
      });
    if (!blockedUploadError) {
      await admin.storage.from('product-images').remove([blockedPath]);
      throw new Error('Anonymous Storage upload was allowed');
    }
    await anonymous.storage.from('product-images').remove([image.thumbnailPath]);
    assert(
      await storageObjectExists(image.thumbnailPath),
      'Unauthorized deletion removed a product image',
    );
    console.log('✓ Public clients cannot upload to or delete from product Storage');

    const published = await apiRequest<Product>(`/api/v1/admin/catalogue/products/${productId}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    assert(published.status === 'PUBLISHED', 'Product was not published');
    const visible = await apiRequest<Product>(`/api/v1/products/${slug}`);
    assert(visible.id === productId, 'Published product is not publicly visible');
    assert(visible.variants.length === 1, 'Published active variant is missing');
    console.log('✓ Published product is visible through the public catalogue');

    const replacementSource = await sharp({
      create: {
        width: 1800,
        height: 1800,
        channels: 3,
        background: '#6d597a',
      },
    })
      .png()
      .toBuffer();
    const replacement = await imageRequest(
      `/api/v1/admin/catalogue/products/${productId}/images/${image.id}`,
      'PUT',
      accessToken,
      replacementSource,
    );
    for (const path of [replacement.thumbnailPath, replacement.mediumPath, replacement.largePath]) {
      storagePaths.add(path);
    }
    assert(replacement.largePath !== image.largePath, 'Replacement reused a mutable Storage path');
    await verifyStoredDerivative(replacement.largePath, 1600);
    assert(
      !(await storageObjectExists(image.largePath)),
      'Replaced Storage object metadata was not cleaned up',
    );
    const productAfterReplacement = await apiRequest<Product>(`/api/v1/products/${slug}`);
    assert(
      productAfterReplacement.images.some((candidate) => candidate.id === replacement.id) &&
        !productAfterReplacement.images.some((candidate) => candidate.id === image.id),
      'Published product does not reference only the replacement image',
    );
    console.log('✓ Replacement uses a new immutable path and removes old objects');

    await apiRequest<unknown>(
      `/api/v1/admin/catalogue/products/${productId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
      },
      204,
    );
    productId = undefined;
    await apiRequest<unknown>(
      `/api/v1/admin/catalogue/categories/${categoryId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
      },
      204,
    );
    categoryId = undefined;
  } finally {
    if (productId) {
      await admin.from('products').delete().eq('id', productId);
    }
    if (categoryId) {
      await admin.from('categories').delete().eq('id', categoryId);
    }
    if (storagePaths.size > 0) {
      await admin.storage.from('product-images').remove([...storagePaths]);
    }
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

void run()
  .then(() => {
    console.log('Phase 3 live verification passed; temporary data and objects were removed.');
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Phase 3 live verification failed: ${message}`);
    process.exitCode = 1;
  });
