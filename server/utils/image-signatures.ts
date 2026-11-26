export const supportedImageContentTypes = [
  'image/jpeg',
  'image/png'
] as const

export type SupportedImageContentType = typeof supportedImageContentTypes[number]

const jpegSignature = [0xff, 0xd8, 0xff] as const
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

function matchesSignature(data: Uint8Array, signature: readonly number[]) {
  if (data.byteLength < signature.length) {
    return false
  }

  return signature.every((byte, index) => data[index] === byte)
}

export function detectSupportedImageContentType(data: Uint8Array): SupportedImageContentType | null {
  if (matchesSignature(data, pngSignature)) {
    return 'image/png'
  }

  if (matchesSignature(data, jpegSignature)) {
    return 'image/jpeg'
  }

  return null
}

/** The size of an image in pixels. */
export interface ImageSize {
  width: number
  height: number
}

// The frame header markers of a JPEG (SOF0 to SOF15) hold its size. C4, C8 and CC are other markers.
function isJpegFrameHeader(marker: number) {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
}

/** Reads the size of a JPEG from its frame header. A JPEG is a list of segments after its first two bytes. */
function readJpegSize(data: Uint8Array, view: DataView): ImageSize | null {
  let offset = 2
  while (offset + 9 <= data.byteLength) {
    // Each segment starts with 0xFF and a marker byte, then the length of the segment without the marker.
    if (data[offset] !== 0xff) {
      return null
    }
    const marker = data[offset + 1]!
    if (marker === 0xff) {
      offset += 1
    } else if (isJpegFrameHeader(marker)) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) }
    } else {
      offset += 2 + view.getUint16(offset + 2)
    }
  }
  return null
}

/**
 * The size of a PNG or JPEG image, read from its first bytes, or null when they do not name it. A PNG
 * names its size in its first chunk, at a fixed place.
 */
export function readImageSize(data: Uint8Array): ImageSize | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let size: ImageSize | null = null
  if (matchesSignature(data, pngSignature) && data.byteLength >= 24) {
    size = { width: view.getUint32(16), height: view.getUint32(20) }
  } else if (matchesSignature(data, jpegSignature)) {
    size = readJpegSize(data, view)
  }

  return size && size.width > 0 && size.height > 0 ? size : null
}
