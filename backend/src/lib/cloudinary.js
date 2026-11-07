const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

const cloudinaryName = process.env.CLOUDINARY_NAME;
const configured = Boolean(
  cloudinaryName &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

cloudinary.config({
  cloud_name: cloudinaryName,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

function requireCloudinary() {
  if (!configured) {
    const error = new Error('Cloudinary uploads are not configured on the backend.');
    error.status = 503;
    throw error;
  }
}

function uploadAsset(buffer, { folder, resourceType, format }) {
  requireCloudinary();
  const publicId = `cci-connect/${folder}/${crypto.randomUUID()}`;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      public_id: publicId,
      resource_type: resourceType,
      type: 'upload',
      overwrite: false,
      unique_filename: true,
      use_filename: false,
      allowed_formats: [format],
      invalidate: true
    }, (error, result) => {
      if (error) return reject(error);
      if (!result?.secure_url || !result.public_id) {
        return reject(new Error('Cloudinary did not return a secure asset URL and public ID.'));
      }
      resolve({
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type
      });
    });
    stream.end(buffer);
  });
}

function deleteAsset({ publicId, resourceType }) {
  requireCloudinary();
  if (
    typeof publicId !== 'string' ||
    !/^cci-connect\/(profile|posts|galleries|events)\/[a-f0-9-]{36}$/.test(publicId) ||
    !['image', 'video'].includes(resourceType)
  ) {
    throw new Error('The Cloudinary asset reference is invalid.');
  }
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true
  });
}

async function deleteAssets(assets) {
  const uniqueAssets = new Map();
  assets.filter(Boolean).forEach((asset) => {
    if (asset.publicId && !asset.resourceType) {
      throw new Error('The Cloudinary asset resource type is missing.');
    }
    if (asset.publicId) uniqueAssets.set(asset.publicId, asset);
  });
  const failedIds = [];
  for (const asset of uniqueAssets.values()) {
    try {
      const result = await deleteAsset(asset);
      if (!['ok', 'not found'].includes(result.result)) failedIds.push(asset.publicId);
    } catch (error) {
      failedIds.push(asset.publicId);
    }
  }
  if (failedIds.length) {
    throw new Error(`Cloudinary could not delete ${failedIds.length} uploaded asset(s): ${failedIds.join(', ')}.`);
  }
}

module.exports = { uploadAsset, deleteAsset, deleteAssets, isConfigured: configured };
