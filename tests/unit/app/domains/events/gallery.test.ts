import { describe, expect, test } from 'vitest'

import {
  createEventGalleryUploadBatches,
  eventGalleryUploadMaxBytesPerRequest,
  eventGalleryUploadMaxFilesPerRequest
} from '../../../../../app/domains/events/gallery'

describe('event gallery utils', () => {
  test('splits selected files into bounded upload request batches', () => {
    expect(eventGalleryUploadMaxFilesPerRequest).toBe(5)

    const files = Array.from({ length: eventGalleryUploadMaxFilesPerRequest + 1 }, (_, index) => ({
      name: `photo-${index + 1}.png`,
      size: 1
    })) as Array<Pick<File, 'name' | 'size'>>

    const batches = createEventGalleryUploadBatches(files)

    expect(batches.map(batch => batch.length)).toEqual([
      eventGalleryUploadMaxFilesPerRequest,
      1
    ])
  })

  test('starts a new upload batch before the request byte budget is exceeded', () => {
    const batches = createEventGalleryUploadBatches([
      { name: 'opening.png', size: eventGalleryUploadMaxBytesPerRequest - 1 } as Pick<File, 'name' | 'size'>,
      { name: 'team.png', size: 2 } as Pick<File, 'name' | 'size'>
    ])

    expect(batches.map(batch => batch.map(file => file.name))).toEqual([
      ['opening.png'],
      ['team.png']
    ])
  })
})
