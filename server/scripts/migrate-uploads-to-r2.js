const fs = require('fs/promises');
const path = require('path');
const env = require('../config/env');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

// Copies every file in server/uploads/ into the configured R2 bucket, keeping
// the same key so the /uploads/<filename> paths already stored inside note
// contentHtml keep resolving unchanged — no note rewriting required.
//
// Idempotent: a key already present in the bucket is skipped, so this can be
// re-run safely (and should be, right before cutover, to catch anything
// uploaded since the last run).
//
// Local files are NOT deleted. Verify the images render from R2 first, then
// remove server/uploads/ by hand.
//
// Usage:  node scripts/migrate-uploads-to-r2.js [--dry]

const CONTENT_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

const run = async () => {
  const dryRun = process.argv.includes('--dry');

  if (!env.r2Configured) {
    console.error('R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.');
    process.exit(1);
  }

  const uploadsDir = path.join(__dirname, '..', 'uploads');
  let files;
  try {
    files = (await fs.readdir(uploadsDir)).filter((f) => !f.startsWith('.'));
  } catch {
    console.log('No uploads directory — nothing to migrate.');
    return;
  }

  if (files.length === 0) {
    console.log('uploads/ is empty — nothing to migrate.');
    return;
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });

  console.log(`${files.length} file(s) in uploads/ -> bucket "${env.R2_BUCKET}"${dryRun ? '  [DRY RUN]' : ''}\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of files) {
    try {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: filename }));
        console.log(`  skip    ${filename} (already in bucket)`);
        skipped += 1;
        continue;
      } catch {
        // Not present — fall through and upload it.
      }

      if (dryRun) {
        console.log(`  would   ${filename}`);
        uploaded += 1;
        continue;
      }

      const body = await fs.readFile(path.join(uploadsDir, filename));
      await s3.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: filename,
        Body: body,
        ContentType: CONTENT_TYPES[filename.split('.').pop()?.toLowerCase()] || 'application/octet-stream',
      }));
      console.log(`  upload  ${filename}`);
      uploaded += 1;
    } catch (err) {
      console.error(`  FAILED  ${filename}: ${err.message}`);
      failed += 1;
    }
  }

  console.log(`\n${uploaded} uploaded, ${skipped} already present, ${failed} failed.`);
  if (failed > 0) process.exit(1);
};

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
