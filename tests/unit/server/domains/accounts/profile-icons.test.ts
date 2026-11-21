import { describe, expect, test } from 'vitest'

import {
  assertValidProfileIconPart,
  profileIconMaxBytes
} from '../../../../../server/domains/accounts/profile-icons'

const jpegSignatureBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb])
const pngSignatureBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function createOversizedPngBytes(size: number) {
  const data = new Uint8Array(size)
  data.set(pngSignatureBytes)
  return data
}

describe('profile icon utilities', () => {
  test('accepts supported image signatures and derives the content type from bytes', () => {
    const pngResult = assertValidProfileIconPart({
      type: 'image/gif',
      data: pngSignatureBytes
    })

    expect(pngResult.contentType).toBe('image/png')
    expect(pngResult.data.byteLength).toBe(pngSignatureBytes.byteLength)

    const jpegResult = assertValidProfileIconPart({
      type: 'image/png',
      data: jpegSignatureBytes
    })

    expect(jpegResult.contentType).toBe('image/jpeg')
    expect(jpegResult.data.byteLength).toBe(jpegSignatureBytes.byteLength)
  })

  test('rejects unsupported file bytes even when the declared type is allowed', () => {
    expect(() => assertValidProfileIconPart({
      type: 'image/png',
      data: new Uint8Array([1, 2, 3, 4])
    })).toThrowError(/JPEG or PNG/)
  })

  test('rejects files larger than 1MB', () => {
    expect(() => assertValidProfileIconPart({
      type: 'image/png',
      data: createOversizedPngBytes(profileIconMaxBytes + 1)
    })).toThrowError(/1MB or smaller/)
  })
})
