import { describe, expect, test } from 'vitest'

import { readImageSize } from '../../../../server/utils/image-signatures'

/** The first bytes of a PNG: the signature and the IHDR chunk with the given size. */
function pngHeader(width: number, height: number) {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

/** A JPEG start: SOI, an APP0 segment of 16 bytes, then the frame header with the given marker and size. */
function jpegHeader(frameMarker: number, width: number, height: number, fillBytes = 0) {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)]
  const fill = new Array(fillBytes).fill(0xff)
  const frame = [0xff, frameMarker, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03]
  return new Uint8Array([0xff, 0xd8, ...app0, ...fill, ...frame])
}

describe('readImageSize', () => {
  test('reads the size of a PNG from its first chunk', () => {
    expect(readImageSize(pngHeader(1600, 900))).toEqual({ width: 1600, height: 900 })
  })

  test('reads the size of a JPEG from its frame header after other segments and fill bytes', () => {
    expect(readImageSize(jpegHeader(0xc0, 1200, 800))).toEqual({ width: 1200, height: 800 })
    // A progressive JPEG uses SOF2, and fill bytes may stand before a marker.
    expect(readImageSize(jpegHeader(0xc2, 640, 480, 2))).toEqual({ width: 640, height: 480 })
  })

  test('names no size when the first bytes do not hold one', () => {
    // C4 holds Huffman tables, not a size, and the file ends before a frame header.
    expect(readImageSize(jpegHeader(0xc4, 1200, 800))).toBeNull()
    expect(readImageSize(pngHeader(0, 900))).toBeNull()
    expect(readImageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull()
  })
})
