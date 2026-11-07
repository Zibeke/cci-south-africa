const allowedFormats = {
  jpg: { mime: 'image/jpeg', resourceType: 'image' },
  png: { mime: 'image/png', resourceType: 'image' },
  webp: { mime: 'image/webp', resourceType: 'image' },
  gif: { mime: 'image/gif', resourceType: 'image' },
  mp4: { mime: 'video/mp4', resourceType: 'video' },
  webm: { mime: 'video/webm', resourceType: 'video' },
  mov: { mime: 'video/quicktime', resourceType: 'video' }
};

function detectFormat(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return 'gif';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'webp';
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (brand === 'qt  ') return 'mov';
    if (/^(isom|iso[2-9]|mp4[12]|avc1|M4V |M4VH|M4VP|MSNV|3gp[4-9]|dash)$/.test(brand)) return 'mp4';
  }
  if (
    buffer.length >= 4 &&
    buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
    buffer.subarray(0, 4096).includes(Buffer.from('webm'))
  ) return 'webm';
  return '';
}

async function inspectUpload(file, allowedResourceTypes) {
  const format = detectFormat(file.buffer);
  const definition = allowedFormats[format];
  if (
    !definition ||
    !allowedResourceTypes.includes(definition.resourceType) ||
    file.mimetype !== definition.mime
  ) {
    const error = new Error('The uploaded file content does not match an allowed image or video format.');
    error.status = 400;
    throw error;
  }
  return { format, resourceType: definition.resourceType };
}

async function validateUploads(files, allowedResourceTypes) {
  const inspected = [];
  for (const file of files) inspected.push(await inspectUpload(file, allowedResourceTypes));
  return inspected;
}

module.exports = { validateUploads };
