const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET;
if (!bucketName) {
  // Allow local dev without GCS by skipping initialization
  // Consumers should handle when bucket is undefined
  console.warn('GCS_BUCKET is not set. Falling back to local file serving for assets.');
}

function getBucket() {
  if (!bucketName) return null;
  return storage.bucket(bucketName);
}

async function uploadBuffer(buffer, destination, contentType, options = {}) {
  const bucket = getBucket();
  if (!bucket) throw new Error('GCS bucket not configured');
  const file = bucket.file(destination);
  await file.save(buffer, {
    contentType: contentType || 'application/octet-stream',
    resumable: false,
    metadata: {
      cacheControl: options.cacheControl || 'no-cache, no-store, must-revalidate',
      ...(options.customTime ? { customTime: options.customTime } : {})
    }
  });
  // Always make public for brand assets to avoid signed URL expiration
  await file.makePublic().catch(()=>{});
  return `https://storage.googleapis.com/${bucket.name}/${destination}`;
}

async function uploadFile(localPath, destination, contentType, options = {}) {
  const bucket = getBucket();
  if (!bucket) throw new Error('GCS bucket not configured');
  const [file] = await bucket.upload(localPath, {
    destination,
    contentType: contentType || undefined,
    resumable: false,
    metadata: {
      cacheControl: options.cacheControl || 'public, max-age=31536000, immutable',
      ...(options.customTime ? { customTime: options.customTime } : {})
    }
  });
  if (process.env.ASSET_PUBLIC === 'public') {
    await file.makePublic().catch(()=>{});
    return `https://storage.googleapis.com/${bucket.name}/${destination}`;
  }
  return signedReadUrl(destination, Number(options.signedTtlSec || process.env.SIGNED_URL_TTL || 86400));
}

async function signedReadUrl(destination, expiresInSec = Number(process.env.SIGNED_URL_TTL || 3600)) {
  const bucket = getBucket();
  if (!bucket) throw new Error('GCS bucket not configured');
  const [url] = await bucket.file(destination).getSignedUrl({
    action: 'read', version: 'v4', expires: Date.now() + expiresInSec * 1000
  });
  return url;
}

module.exports = { uploadBuffer, uploadFile, signedReadUrl };


