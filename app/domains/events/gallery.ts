export interface PendingGalleryPhotoChange {
  photoId: string
  action: 'delete' | 'public-visibility' | 'highlight' | 'hidden'
}

export interface EventGalleryUploadItem {
  id: string
  name: string
}

export const eventGalleryUploadMaxFilesPerRequest = 5
export const eventGalleryUploadMaxBytesPerRequest = 50 * 1024 * 1024

export function createEventGalleryUploadItems(files: Array<Pick<File, 'name'>>): EventGalleryUploadItem[] {
  return files.map((file, index) => {
    const normalizedName = file.name.trim() || `Photo ${index + 1}`

    return {
      id: `event-gallery-upload-${index}`,
      name: normalizedName
    }
  })
}

export function createEventGalleryUploadBatches<T extends Pick<File, 'size'>>(files: T[]) {
  const batches: T[][] = []
  let currentBatch: T[] = []
  let currentBatchBytes = 0

  for (const file of files) {
    const wouldExceedFileCount = currentBatch.length >= eventGalleryUploadMaxFilesPerRequest
    const wouldExceedByteLimit = currentBatch.length > 0
      && currentBatchBytes + file.size > eventGalleryUploadMaxBytesPerRequest

    if (wouldExceedFileCount || wouldExceedByteLimit) {
      batches.push(currentBatch)
      currentBatch = []
      currentBatchBytes = 0
    }

    currentBatch.push(file)
    currentBatchBytes += file.size
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}
