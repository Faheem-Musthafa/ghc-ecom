import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const projectUrl = new URL(SUPABASE_URL.trim()).origin;

const supabase = createClient(
  projectUrl,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const buckets = [
  'product-images',
  'product-videos',
  'private-documents',
];

for (const bucket of buckets) {
  const { error } = await supabase.storage.emptyBucket(bucket);

  if (error) {
    throw new Error(`Failed to empty ${bucket}: ${error.message}`);
  }

  console.log(`Emptied ${bucket}`);
}
