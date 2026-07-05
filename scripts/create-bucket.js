const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Could not find .env.local at:", envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    console.log("Checking storage buckets for URL:", supabaseUrl);
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      throw listError;
    }

    const bucketName = 'proofs';
    const exists = buckets.some(b => b.name === bucketName);

    if (exists) {
      console.log(`Bucket '${bucketName}' already exists.`);
    } else {
      console.log(`Bucket '${bucketName}' not found. Creating a public bucket...`);
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: true, // Make it public so files are accessible via public URL
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
      });

      if (error) {
        throw error;
      }
      console.log(`Bucket '${bucketName}' created successfully!`, data);
    }
  } catch (err) {
    console.error("An error occurred:", err.message || err);
    process.exit(1);
  }
}

run();
