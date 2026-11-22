import { afterEach, describe, expect, test, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import entryPageGetHandler from '../../../../server/api/account/events/[slug]/entry.get'
import galleryPageGetHandler from '../../../../server/api/account/events/[slug]/gallery.get'
import rostersPageGetHandler from '../../../../server/api/account/events/[slug]/rosters.get'
import settingsPageGetHandler from '../../../../server/api/account/events/[slug]/settings.get'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import eventPhotoDeleteHandler from '../../../../server/api/events/[eventId]/photos/[photoId].delete'
import eventPhotoHiddenPatchHandler from '../../../../server/api/events/[eventId]/photos/[photoId]/hidden.patch'
import eventPhotoHighlightPatchHandler from '../../../../server/api/events/[eventId]/photos/[photoId]/highlight.patch'
import eventPhotoImageGetHandler from '../../../../server/api/events/[eventId]/photos/[photoId]/image.get'
import eventPhotoPublicVisibilityPatchHandler from '../../../../server/api/events/[eventId]/photos/[photoId]/public-visibility.patch'
import eventPhotosGetHandler from '../../../../server/api/events/[eventId]/photos/index.get'
import eventPhotosPostHandler from '../../../../server/api/events/[eventId]/photos/index.post'
import publicEventPhotoImageGetHandler from '../../../../server/api/public/events/[slug]/photos/[photoId]/image.get'
import publicEventPhotosGetHandler from '../../../../server/api/public/events/[slug]/photos/index.get'
import {
  auditLogs,
  eventCreditCodes,
  eventCreditOffers,
  eventPhotos,
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { toApiError } from '../../../../server/http/api-error'
import { authenticatedUploadRateLimitBindingName } from '../../../../server/utils/rate-limit'
import { accountEventEntryPageSchema } from '../../../../shared/domains/events/account-event-entry-page'
import { accountEventGalleryPageSchema } from '../../../../shared/domains/events/account-event-gallery-page'
import type { AccountEventPageShell } from '../../../../shared/domains/events/account-event-page-shell'
import { accountEventSettingsPageSchema } from '../../../../shared/domains/events/account-event-settings-page'
import { maxParticipantPhotosPerEvent, type EventPhotoRecord } from '../../../../shared/domains/events/photos'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

type Harness = ReturnType<typeof createApiRouteTestHarness>
type EventInsert = typeof events.$inferInsert
type ApplicationInsert = typeof userApplications.$inferInsert
type PhotoInsert = typeof eventPhotos.$inferInsert

/** The first bytes of every PNG file. The upload checks read the file type from them. */
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const imageRequests = ['variant=preview', 'variant=original', 'variant=original&download=1']

const checkedIn = { checkedInAt: '2026-11-28T08:45:00.000Z', checkInSource: 'staff' as const }
const questions = [
  { id: 'project', type: 'short_text', prompt: 'What do you want to build today?', required: true, options: [] }
]
/** A registration that finished the check-in flow of `event_1`: checked in, questionnaire completed. */
const finishedCheckInFlow = {
  ...checkedIn,
  questionnaireAnswersJson: JSON.stringify([
    { questionId: 'project', prompt: 'What do you want to build today?', value: 'A check-in helper' }
  ]),
  questionnaireCompletedAt: '2026-11-28T08:50:00.000Z'
}

/** Every test user signs in with `auth0|<user id>`. */
function sessionFor(userId: string) {
  return { sub: `auth0|${userId}`, email: `${userId}@example.com` }
}

/** Keeps uploaded files in memory, in place of the R2 bucket for event images. */
class InMemoryBucket {
  private readonly files = new Map<string, Uint8Array>()

  async put(key: string, value: Uint8Array) {
    this.files.set(key, value)
  }

  async get(key: string) {
    const file = this.files.get(key)

    return file ? { body: new Response(file).body! } : null
  }

  async delete(key: string) {
    this.files.delete(key)
  }
}

/** Stands in for the Cloudflare Images binding: every image is 1600x900 and gets the same preview. */
const imagesBinding = {
  info: async () => ({ width: 1600, height: 900 }),
  input: () => ({
    transform: () => ({
      output: async () => ({
        response: () => new Response(new Uint8Array([1, 2, 3])),
        contentType: () => 'image/webp'
      })
    })
  })
}

interface Context {
  harness: Harness
  bucket: InMemoryBucket
}

describe('TASK-451 participant photos', () => {
  const harnesses: Harness[] = []

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  /**
   * `event_1` (slug `build-day`) is a public Build event that allows participant photos. Its
   * check-in flow is on and has one question. It has one credit offer with one code that nobody
   * has claimed. `staff`, `judge` and `event_admin` hold that role in the event.
   * `eventOverrides` change the event.
   */
  async function createContext(eventOverrides: Partial<EventInsert> = {}): Promise<Context> {
    const bucket = new InMemoryBucket()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler },
        { method: 'get', path: '/api/events/:eventId/photos', handler: eventPhotosGetHandler },
        { method: 'post', path: '/api/events/:eventId/photos', handler: eventPhotosPostHandler },
        { method: 'delete', path: '/api/events/:eventId/photos/:photoId', handler: eventPhotoDeleteHandler },
        { method: 'patch', path: '/api/events/:eventId/photos/:photoId/hidden', handler: eventPhotoHiddenPatchHandler },
        { method: 'patch', path: '/api/events/:eventId/photos/:photoId/highlight', handler: eventPhotoHighlightPatchHandler },
        { method: 'patch', path: '/api/events/:eventId/photos/:photoId/public-visibility', handler: eventPhotoPublicVisibilityPatchHandler },
        { method: 'get', path: '/api/events/:eventId/photos/:photoId/image', handler: eventPhotoImageGetHandler },
        { method: 'get', path: '/api/public/events/:slug/photos', handler: publicEventPhotosGetHandler },
        { method: 'get', path: '/api/public/events/:slug/photos/:photoId/image', handler: publicEventPhotoImageGetHandler },
        { method: 'get', path: '/api/account/events/:slug/entry', handler: entryPageGetHandler },
        { method: 'get', path: '/api/account/events/:slug/gallery', handler: galleryPageGetHandler },
        { method: 'get', path: '/api/account/events/:slug/rosters', handler: rostersPageGetHandler },
        { method: 'get', path: '/api/account/events/:slug/settings', handler: settingsPageGetHandler }
      ],
      sessionUser: sessionFor('participant'),
      cloudflareEnv: {
        EVENT_IMAGES: bucket,
        IMAGES: imagesBinding,
        [authenticatedUploadRateLimitBindingName]: { limit: async () => ({ success: true }) }
      },
      runtimeConfig: { auth0: { appBaseUrl: 'https://events.example.com' } }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      { id: 'platform_admin', isPlatformAdmin: true },
      { id: 'event_admin' },
      { id: 'staff' },
      { id: 'judge' },
      { id: 'participant' },
      { id: 'other_participant' },
      { id: 'visitor' }
    ].map(user => ({
      ...user,
      auth0Subject: sessionFor(user.id).sub,
      email: sessionFor(user.id).email,
      displayName: user.id
    })))
    await harness.database.insert(events).values({
      id: 'event_1',
      eventType: 'build',
      name: 'Build Day',
      slug: 'build-day',
      description: 'Build Day fixture',
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2020-01-01T00:00:00.000Z',
      registrationClosesAt: '2099-01-01T00:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 1,
      checkInFlowEnabled: true,
      questionnaireQuestionsJson: JSON.stringify(questions),
      participantPhotosEnabled: true,
      createdByUserId: 'event_admin',
      ...eventOverrides
    })
    await harness.database.insert(eventRoleAssignments).values([
      { id: 'role_event_admin', eventId: 'event_1', userId: 'event_admin', role: 'event_admin', isInJudgePool: false, isStaff: false },
      { id: 'role_staff', eventId: 'event_1', userId: 'staff', role: 'staff', isInJudgePool: false, isStaff: true },
      { id: 'role_judge', eventId: 'event_1', userId: 'judge', role: 'judge', isInJudgePool: true, isStaff: false }
    ])
    await harness.database.insert(eventCreditOffers).values({
      id: 'offer_1',
      eventId: 'event_1',
      name: 'Codex credits',
      description: 'Redeem the code on the provider site.'
    })
    await harness.database.insert(eventCreditCodes).values({ id: 'code_1', creditOfferId: 'offer_1', value: 'CODE-1' })

    return { harness, bucket }
  }

  /** Adds the registration of a user in `event_1`. The default is a confirmed registration of `participant` without a check-in. */
  async function addApplication(context: Context, overrides: Partial<ApplicationInsert> = {}) {
    const userId = overrides.userId ?? 'participant'

    await context.harness.database.insert(userApplications).values({
      id: `application_${userId}`,
      eventId: 'event_1',
      userId,
      status: 'approved',
      submittedAt: '2026-11-20T10:00:00.000Z',
      registrationDetailsJson: '{}',
      updatedAt: '2026-11-20T10:00:00.000Z',
      ...overrides
    })
  }

  /** Adds a stored photo with its file to `event_1`. The default is a visible participant photo that `participant` added. */
  async function addPhoto(context: Context, photo: Partial<PhotoInsert> & { id: string }) {
    const objectKey = `events/event_1/photos/${photo.id}/fixture`

    await context.bucket.put(objectKey, pngBytes)
    await context.harness.database.insert(eventPhotos).values({
      eventId: 'event_1',
      uploadedByUserId: 'participant',
      objectKey,
      imageRevision: 1,
      fileName: `${photo.id}.png`,
      isParticipantUpload: true,
      contentType: 'image/png',
      width: 1600,
      height: 900,
      createdAt: '2026-11-28T10:00:00.000Z',
      ...photo
    })
  }

  function readStoredPhotos(context: Context) {
    return context.harness.database.select().from(eventPhotos)
  }

  async function readStoredPhoto(context: Context, photoId: string) {
    return (await context.harness.database.query.eventPhotos.findFirst({ where: eq(eventPhotos.id, photoId) }))!
  }

  async function readStoredEvent(context: Context) {
    return (await context.harness.database.query.events.findFirst({ where: eq(events.id, 'event_1') }))!
  }

  /** Signs in as the given user. `null` calls without a session. */
  function signIn(userId: string | null) {
    stubAuth0Session(userId ? sessionFor(userId) : null)
  }

  /** Uploads PNG files to the gallery of `event_1` as the given user. */
  function uploadPhotos(context: Context, userId: string | null, fileCount = 1) {
    const form = new FormData()

    for (let index = 1; index <= fileCount; index += 1) {
      form.append('file', new Blob([pngBytes], { type: 'image/png' }), `upload-${index}.png`)
    }

    signIn(userId)
    return context.harness.request('/api/events/event_1/photos', { method: 'POST', body: form })
  }

  /** Changes one mark of a photo as the given user: `hidden`, `highlight` or `public-visibility`. */
  function patchPhoto(
    context: Context,
    userId: string | null,
    photoId: string,
    mark: 'hidden' | 'highlight' | 'public-visibility',
    body: Record<string, boolean>
  ) {
    signIn(userId)
    return context.harness.request(`/api/events/event_1/photos/${photoId}/${mark}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    })
  }

  function setHidden(context: Context, userId: string | null, photoId: string, isHidden: boolean) {
    return patchPhoto(context, userId, photoId, 'hidden', { isHidden })
  }

  /** Reads the photo list of `event_1` as the given user. */
  async function listGalleryPhotos(context: Context, userId: string) {
    signIn(userId)
    const response = await context.harness.request('/api/events/event_1/photos')

    expect(response.status).toBe(200)
    return (await response.json() as { data: EventPhotoRecord[] }).data
  }

  /** Reads the gallery page of `event_1` as the given user. */
  async function readGalleryPage(context: Context, userId: string) {
    signIn(userId)
    const response = await context.harness.request('/api/account/events/build-day/gallery')
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)
    return accountEventGalleryPageSchema.parse(body.data.page)
  }

  /** Opens a photo of `event_1` in the protected gallery as the given user. */
  function requestImage(context: Context, userId: string, photoId: string, query: string) {
    signIn(userId)
    return context.harness.request(`/api/events/event_1/photos/${photoId}/image?${query}`)
  }

  /** Reads the ids of the photos on the public page of `event_1`, without a session. */
  async function listPublicPhotoIds(context: Context) {
    signIn(null)
    const response = await context.harness.request('/api/public/events/build-day/photos')

    expect(response.status).toBe(200)
    return (await response.json() as { data: EventPhotoRecord[] }).data.map(photo => photo.id)
  }

  /** Opens a photo on the public page of `event_1` with the given image revision, without a session. */
  function requestPublicImage(context: Context, photoId: string, imageRevision: number) {
    signIn(null)
    return context.harness.request(`/api/public/events/build-day/photos/${photoId}/image?variant=preview&v=${imageRevision}`)
  }

  describe('adding photos as a participant', () => {
    test('a participant who finished the check-in flow adds a participant photo, without a credit claim', async () => {
      const context = await createContext()
      await addApplication(context, finishedCheckInFlow)

      const response = await uploadPhotos(context, 'participant')

      expect(response.status).toBe(200)
      const storedPhotos = await readStoredPhotos(context)
      expect(storedPhotos).toEqual([expect.objectContaining({
        uploadedByUserId: 'participant',
        fileName: 'upload-1.png',
        isParticipantUpload: true,
        isPubliclyVisible: false,
        isHighlighted: false,
        isHidden: false
      })])
      expect(await response.json()).toMatchObject({
        data: [{ id: storedPhotos[0]!.id, isParticipantUpload: true, isHidden: false, isPubliclyVisible: false }]
      })
      // The participant never claimed the credit of the event.
      const [code] = await context.harness.database.select().from(eventCreditCodes)
      expect(code!.claimedByUserId).toBeNull()
    })

    test.each([
      { who: 'a confirmed participant before check-in', application: {} },
      { who: 'a checked-in participant with an open questionnaire', application: checkedIn },
      { who: 'a participant with a submitted registration', application: { ...finishedCheckInFlow, status: 'submitted' as const } },
      { who: 'a participant with a rejected registration', application: { ...finishedCheckInFlow, status: 'rejected' as const } },
      { who: 'a participant with a withdrawn registration', application: { ...finishedCheckInFlow, status: 'withdrawn' as const } }
    ])('refuses $who', async ({ application }) => {
      const context = await createContext()
      await addApplication(context, application)

      const response = await uploadPhotos(context, 'participant')

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ error: { code: 'event_photo_manage_required' } })
      expect(await readStoredPhotos(context)).toEqual([])
    })

    test('refuses a participant who finished the check-in flow while the event does not allow participant photos', async () => {
      const context = await createContext({ participantPhotosEnabled: false })
      await addApplication(context, finishedCheckInFlow)

      const response = await uploadPhotos(context, 'participant')

      expect(response.status).toBe(403)
      expect(await readStoredPhotos(context)).toEqual([])
    })

    test('an event without questions: the participant adds photos right after check-in', async () => {
      const context = await createContext({ questionnaireQuestionsJson: '[]' })
      await addApplication(context, checkedIn)

      expect((await uploadPhotos(context, 'participant')).status).toBe(200)
    })

    test('an event with the check-in flow off: refused before check-in', async () => {
      const context = await createContext({ checkInFlowEnabled: false })
      await addApplication(context)

      expect((await uploadPhotos(context, 'participant')).status).toBe(403)
    })

    test('an event with the check-in flow off: accepted after check-in', async () => {
      const context = await createContext({ checkInFlowEnabled: false })
      await addApplication(context, checkedIn)

      expect((await uploadPhotos(context, 'participant')).status).toBe(200)
      expect(await readStoredPhotos(context)).toEqual([expect.objectContaining({ isParticipantUpload: true })])
    })

    test.each([
      { userId: 'visitor', status: 403, who: 'a signed-in user without a registration' },
      { userId: null, status: 401, who: 'a visitor without a session' }
    ])('refuses $who', async ({ userId, status }) => {
      const context = await createContext()

      expect((await uploadPhotos(context, userId)).status).toBe(status)
      expect(await readStoredPhotos(context)).toEqual([])
    })
  })

  describe('the limit of photos per participant', () => {
    test('refuses the photo after the 20th and says how many photos are left', async () => {
      const context = await createContext()
      await addApplication(context, finishedCheckInFlow)
      // 19 photos. One of them is hidden: a hidden photo counts too.
      for (let index = 1; index < maxParticipantPhotosPerEvent; index += 1) {
        await addPhoto(context, { id: `photo_${index}`, isHidden: index === 1 })
      }

      const twoPhotos = await uploadPhotos(context, 'participant', 2)

      expect(twoPhotos.status).toBe(409)
      expect(await twoPhotos.json()).toMatchObject({
        error: {
          code: 'event_photo_participant_limit_reached',
          message: 'You can add up to 20 photos to this event. You have 1 left.'
        }
      })
      expect((await uploadPhotos(context, 'participant', 1)).status).toBe(200)

      const oneMorePhoto = await uploadPhotos(context, 'participant', 1)

      expect(oneMorePhoto.status).toBe(409)
      expect(await oneMorePhoto.json()).toMatchObject({
        error: { message: 'You can add up to 20 photos to this event. You have 0 left.' }
      })
      expect(await readStoredPhotos(context)).toHaveLength(maxParticipantPhotosPerEvent)
    })

    test('counts only the photos that this participant added', async () => {
      const context = await createContext()
      await addApplication(context, finishedCheckInFlow)
      for (let index = 1; index <= maxParticipantPhotosPerEvent; index += 1) {
        await addPhoto(context, { id: `photo_${index}`, uploadedByUserId: 'other_participant' })
      }

      expect((await uploadPhotos(context, 'participant')).status).toBe(200)
    })

    test('the database holds the same limit as maxParticipantPhotosPerEvent', async () => {
      // The limit exists twice: as this constant, and in SQL in the database trigger
      // `participant_photo_limit` (migration 0085). `addPhoto` writes to the database directly,
      // so only the trigger can refuse here. The test fails when one copy changes alone.
      const context = await createContext()
      for (let index = 1; index <= maxParticipantPhotosPerEvent; index += 1) {
        await addPhoto(context, { id: `photo_${index}` })
      }

      const refusal = await addPhoto(context, { id: 'one_photo_too_many' }).catch(toApiError)

      expect(refusal).toMatchObject({ code: 'event_photo_participant_limit_reached' })
    })
  })

  test.each([
    ['participant', 404], ['staff', 404], ['judge', 404], ['event_admin', 200], ['platform_admin', 200]
  ] as const)('hidden event gallery access for %s', async (userId, status) => {
    const context = await createContext({ hiddenAt: checkedIn.checkedInAt })
    await addApplication(context, finishedCheckInFlow)
    await addPhoto(context, { id: 'hidden_event_photo' })
    signIn(userId)
    for (const response of [
      await context.harness.request('/api/events/event_1/photos'),
      await requestImage(context, userId, 'hidden_event_photo', 'variant=preview'),
      await uploadPhotos(context, userId),
      await setHidden(context, userId, 'hidden_event_photo', true)
    ]) {
      expect(response.status).toBe(status)
      if (status === 404) expect(await response.json()).toMatchObject({ error: { code: 'event_not_found' } })
    }
  })

  test('rolls back every chunk and deletes staged files when another upload takes the last space', async () => {
    const context = await createContext()
    await addApplication(context, finishedCheckInFlow)
    for (let i = 0; i < 12; i++) await addPhoto(context, { id: `existing_${i}` })
    const put = context.bucket.put.bind(context.bucket)
    vi.spyOn(context.bucket, 'put').mockImplementationOnce(async (key, bytes) => {
      await addPhoto(context, { id: 'concurrent' })
      await put(key, bytes)
    })
    const cleanup = vi.spyOn(context.bucket, 'delete')
    const response = await uploadPhotos(context, 'participant', 8)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: { code: 'event_photo_participant_limit_reached' } })
    expect(await readStoredPhotos(context)).toHaveLength(13)
    expect(cleanup).toHaveBeenCalledTimes(8)
    for (const [key] of cleanup.mock.calls) expect(await context.bucket.get(key)).toBeNull()
    expect(await context.bucket.get('events/event_1/photos/concurrent/fixture')).toBeTruthy()
  })

  test.each([false, true])('keeps staged files only for a committed D1 batch (committed=%s)', async (committed) => {
    const context = await createContext()
    const db = context.harness.d1Database
    const runBatch = db.runAtomicBatch.bind(db)
    const cleanup = vi.spyOn(context.bucket, 'delete')
    vi.spyOn(context.bucket, 'put').mockImplementationOnce(async function (this: InMemoryBucket, key, bytes) {
      await InMemoryBucket.prototype.put.call(this, key, bytes)
      vi.spyOn(db, 'runAtomicBatch').mockImplementationOnce(async (execute) => {
        if (committed) await runBatch(execute)
        throw new Error('Upload database error')
      })
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await uploadPhotos(context, 'staff', 2)
    expect(response.status).toBe(committed ? 200 : 500)
    const rows = await readStoredPhotos(context)
    expect(rows).toHaveLength(committed ? 2 : 0)
    expect(cleanup).toHaveBeenCalledTimes(committed ? 0 : 2)
    for (const row of rows) expect(await context.bucket.get(row.objectKey!)).toBeTruthy()
    for (const [key] of cleanup.mock.calls) expect(await context.bucket.get(key)).toBeNull()
  })

  describe('adding photos as the event team', () => {
    test.each(['staff', 'judge', 'event_admin', 'platform_admin'])('%s adds a photo of the event team', async (userId) => {
      const context = await createContext()

      const response = await uploadPhotos(context, userId)

      expect(response.status).toBe(200)
      expect(await readStoredPhotos(context)).toEqual([expect.objectContaining({
        uploadedByUserId: userId,
        isParticipantUpload: false,
        isPubliclyVisible: false,
        isHighlighted: false
      })])
    })

    test('a staff member with a finished registration still adds a photo of the event team', async () => {
      const context = await createContext()
      await addApplication(context, { ...finishedCheckInFlow, userId: 'staff' })

      expect((await uploadPhotos(context, 'staff')).status).toBe(200)
      expect(await readStoredPhotos(context)).toEqual([expect.objectContaining({ isParticipantUpload: false })])
    })

    test('the event team has no limit of photos', async () => {
      const context = await createContext()
      for (let index = 1; index <= maxParticipantPhotosPerEvent; index += 1) {
        await addPhoto(context, { id: `photo_${index}`, uploadedByUserId: 'staff', isParticipantUpload: false })
      }

      expect((await uploadPhotos(context, 'staff')).status).toBe(200)
    })

    test('stores eight photos of one request within the D1 limit of 100 bound values per statement', async () => {
      const context = await createContext()
      const prepare = context.harness.d1Database.prepare.bind(context.harness.d1Database)
      vi.spyOn(context.harness.d1Database, 'prepare').mockImplementation((sql: string) => {
        expect(sql.match(/\?/g)?.length ?? 0).toBeLessThanOrEqual(100)
        return prepare(sql)
      })

      expect((await uploadPhotos(context, 'staff', 8)).status).toBe(200)
      expect(await readStoredPhotos(context)).toHaveLength(8)
    })
  })

  describe('hiding a participant photo', () => {
    test.each(['staff', 'event_admin'])('%s hides a participant photo and shows it again', async (userId) => {
      const context = await createContext()
      await addPhoto(context, { id: 'photo_1' })

      const hideResponse = await setHidden(context, userId, 'photo_1', true)

      expect(hideResponse.status).toBe(200)
      expect(await hideResponse.json()).toMatchObject({ data: { id: 'photo_1', isHidden: true } })
      expect(await readStoredPhoto(context, 'photo_1')).toMatchObject({ isHidden: true })

      const showResponse = await setHidden(context, userId, 'photo_1', false)

      expect(showResponse.status).toBe(200)
      expect(await showResponse.json()).toMatchObject({ data: { id: 'photo_1', isHidden: false } })
      expect(await readStoredPhoto(context, 'photo_1')).toMatchObject({ isHidden: false })
      expect(await context.harness.database.select().from(auditLogs)).toEqual([
        expect.objectContaining({
          actorUserId: userId,
          entityType: 'event_photo',
          entityId: 'photo_1',
          action: 'event_photo.updated_hidden',
          metadata: { eventId: 'event_1', isHidden: true }
        }),
        expect.objectContaining({
          actorUserId: userId,
          action: 'event_photo.updated_hidden',
          metadata: { eventId: 'event_1', isHidden: false }
        })
      ])
    })

    test.each([
      { userId: 'participant', status: 403, who: 'the participant who added the photo' },
      { userId: 'other_participant', status: 403, who: 'another participant' },
      { userId: null, status: 401, who: 'a visitor without a session' }
    ])('refuses $who', async ({ userId, status }) => {
      const context = await createContext()
      await addApplication(context, finishedCheckInFlow)
      await addApplication(context, { ...finishedCheckInFlow, userId: 'other_participant' })
      await addPhoto(context, { id: 'photo_1' })

      expect((await setHidden(context, userId, 'photo_1', true)).status).toBe(status)
      expect(await readStoredPhoto(context, 'photo_1')).toMatchObject({ isHidden: false })
    })

    test('refuses a photo of the event team', async () => {
      const context = await createContext()
      await addPhoto(context, { id: 'team_photo', uploadedByUserId: 'staff', isParticipantUpload: false })

      const response = await setHidden(context, 'staff', 'team_photo', true)

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({
        error: {
          code: 'event_photo_not_participant_upload',
          message: 'Only photos added by participants can be hidden.'
        }
      })
      expect(await readStoredPhoto(context, 'team_photo')).toMatchObject({ isHidden: false })
    })
  })

  describe('who receives a hidden photo', () => {
    /** `participant` added both photos. `other_participant` is another confirmed participant. */
    async function createContextWithHiddenPhoto() {
      const context = await createContext()
      await addApplication(context, finishedCheckInFlow)
      await addApplication(context, { userId: 'other_participant' })
      await addPhoto(context, { id: 'visible_photo' })
      await addPhoto(context, { id: 'hidden_photo', isHidden: true, createdAt: '2026-11-28T11:00:00.000Z' })

      return context
    }

    test.each([
      { userId: 'participant', who: 'the participant who added it' },
      { userId: 'other_participant', who: 'another participant' }
    ])('$who gets it neither in a list nor as an image', async ({ userId }) => {
      const context = await createContextWithHiddenPhoto()

      expect((await listGalleryPhotos(context, userId)).map(photo => photo.id)).toEqual(['visible_photo'])
      expect((await readGalleryPage(context, userId)).photos.map(photo => photo.id)).toEqual(['visible_photo'])

      for (const imageRequest of imageRequests) {
        expect((await requestImage(context, userId, 'hidden_photo', imageRequest)).status).toBe(404)
        expect((await requestImage(context, userId, 'visible_photo', imageRequest)).status).toBe(200)
      }
    })

    test.each(['staff', 'judge', 'event_admin', 'platform_admin'])('%s gets it, marked as hidden', async (userId) => {
      const context = await createContextWithHiddenPhoto()
      const expectedPhotos = [
        expect.objectContaining({ id: 'visible_photo', isHidden: false }),
        expect.objectContaining({ id: 'hidden_photo', isHidden: true })
      ]

      expect(await listGalleryPhotos(context, userId)).toEqual(expectedPhotos)
      expect((await readGalleryPage(context, userId)).photos).toEqual(expectedPhotos)

      for (const imageRequest of imageRequests) {
        expect((await requestImage(context, userId, 'hidden_photo', imageRequest)).status).toBe(200)
      }
    })
  })

  describe('the public event page', () => {
    test('hiding a public photo takes it off the public page, and showing it again does not put it back', async () => {
      const context = await createContext()
      await addPhoto(context, { id: 'photo_1', isPubliclyVisible: true })
      const publicContentRevision = (await readStoredEvent(context)).publicContentRevision

      expect(await listPublicPhotoIds(context)).toEqual(['photo_1'])
      expect((await requestPublicImage(context, 'photo_1', 1)).status).toBe(200)

      expect((await setHidden(context, 'staff', 'photo_1', true)).status).toBe(200)

      // The same side effects as taking the photo off the public page with its own control.
      expect(await readStoredPhoto(context, 'photo_1')).toMatchObject({
        isHidden: true,
        isPubliclyVisible: false,
        imageRevision: 2
      })
      expect((await readStoredEvent(context)).publicContentRevision).toBe(publicContentRevision + 1)
      expect(await listPublicPhotoIds(context)).toEqual([])
      expect((await requestPublicImage(context, 'photo_1', 1)).status).toBe(404)
      expect((await requestPublicImage(context, 'photo_1', 2)).status).toBe(404)

      expect((await setHidden(context, 'staff', 'photo_1', false)).status).toBe(200)

      expect(await readStoredPhoto(context, 'photo_1')).toMatchObject({ isHidden: false, isPubliclyVisible: false })
      expect(await listPublicPhotoIds(context)).toEqual([])
    })

    test('hiding a photo that is not public changes no public revision', async () => {
      const context = await createContext()
      await addPhoto(context, { id: 'photo_1' })
      const publicContentRevision = (await readStoredEvent(context)).publicContentRevision

      expect((await setHidden(context, 'staff', 'photo_1', true)).status).toBe(200)

      expect(await readStoredPhoto(context, 'photo_1')).toMatchObject({ isHidden: true, imageRevision: 1 })
      expect((await readStoredEvent(context)).publicContentRevision).toBe(publicContentRevision)
    })

    test('a participant photo is on the public page only after the event team marks it public', async () => {
      const context = await createContext()
      await addPhoto(context, { id: 'photo_1' })

      expect(await listPublicPhotoIds(context)).toEqual([])

      expect((await patchPhoto(context, 'staff', 'photo_1', 'public-visibility', { isPubliclyVisible: true })).status).toBe(200)

      expect(await listPublicPhotoIds(context)).toEqual(['photo_1'])
    })
  })

  describe('the other gallery controls of the event team', () => {
    test('the highlight and the public mark of a hidden photo cannot be changed', async () => {
      const context = await createContext()
      await addPhoto(context, { id: 'photo_1', isHidden: true })

      for (const [mark, body] of [
        ['highlight', { isHighlighted: true }],
        ['public-visibility', { isPubliclyVisible: true }]
      ] as const) {
        const response = await patchPhoto(context, 'staff', 'photo_1', mark, body)

        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({
          error: { code: 'event_photo_hidden', message: 'Show this photo again before you change it.' }
        })
      }

      expect(await readStoredPhoto(context, 'photo_1')).toMatchObject({ isHighlighted: false, isPubliclyVisible: false })
    })

    test('a hidden photo keeps its highlight', async () => {
      const context = await createContext()
      await addPhoto(context, { id: 'photo_1', isHighlighted: true })

      expect((await setHidden(context, 'staff', 'photo_1', true)).status).toBe(200)

      expect(await readStoredPhoto(context, 'photo_1')).toMatchObject({ isHidden: true, isHighlighted: true })
    })

    test.each([
      { state: 'visible', isHidden: false },
      { state: 'hidden', isHidden: true }
    ])('the event team deletes a $state participant photo', async ({ isHidden }) => {
      const context = await createContext()
      await addPhoto(context, { id: 'photo_1', isHidden })

      signIn('staff')
      const response = await context.harness.request('/api/events/event_1/photos/photo_1', { method: 'DELETE' })

      expect(response.status).toBe(200)
      expect(await readStoredPhotos(context)).toEqual([])
    })

    test('the event team highlights a visible participant photo', async () => {
      const context = await createContext()
      await addPhoto(context, { id: 'photo_1' })

      const response = await patchPhoto(context, 'staff', 'photo_1', 'highlight', { isHighlighted: true })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { id: 'photo_1', isHighlighted: true, isParticipantUpload: true } })
    })
  })

  describe('the gallery page', () => {
    test('tells a participant who finished the check-in flow that they can add photos', async () => {
      const context = await createContext()
      await addApplication(context, finishedCheckInFlow)

      expect(await readGalleryPage(context, 'participant')).toEqual({
        photos: [],
        canAddParticipantPhotos: true,
        mustFinishCheckInFlowToAddPhotos: false
      })
    })

    test('tells a participant with an open questionnaire to finish the check-in flow before adding photos', async () => {
      const context = await createContext()
      await addApplication(context, checkedIn)

      expect(await readGalleryPage(context, 'participant')).toMatchObject({
        canAddParticipantPhotos: false,
        mustFinishCheckInFlowToAddPhotos: true
      })
    })

    test('does not offer adding photos while the event does not allow participant photos', async () => {
      const context = await createContext({ participantPhotosEnabled: false })
      await addApplication(context, finishedCheckInFlow)

      expect((await readGalleryPage(context, 'participant')).canAddParticipantPhotos).toBe(false)
    })

    test.each(['staff', 'judge', 'event_admin', 'platform_admin'])('%s uploads as the event team, also with a finished registration', async (userId) => {
      const context = await createContext()
      await addApplication(context, { ...finishedCheckInFlow, userId })

      expect((await readGalleryPage(context, userId)).canAddParticipantPhotos).toBe(false)
    })

    test('only the event team learns who added a participant photo', async () => {
      const context = await createContext()
      await addApplication(context, { userId: 'other_participant' })
      await addPhoto(context, { id: 'team_photo', uploadedByUserId: 'staff', isParticipantUpload: false })
      await addPhoto(context, { id: 'participant_photo', createdAt: '2026-11-28T11:00:00.000Z' })
      const staffUploader = { uploadedByUserId: 'staff', uploadedBy: { id: 'staff', displayName: 'staff' } }

      expect((await readGalleryPage(context, 'other_participant')).photos).toEqual([
        expect.objectContaining({ id: 'team_photo', isParticipantUpload: false, ...staffUploader }),
        expect.objectContaining({ id: 'participant_photo', isParticipantUpload: true, uploadedByUserId: null, uploadedBy: null })
      ])
      expect((await readGalleryPage(context, 'staff')).photos).toEqual([
        expect.objectContaining({ id: 'team_photo', ...staffUploader }),
        expect.objectContaining({
          id: 'participant_photo',
          uploadedByUserId: 'participant',
          uploadedBy: { id: 'participant', displayName: 'participant' }
        })
      ])
    })
  })

  describe('the Gallery tab of a participant', () => {
    /** Reads what the event page and a direct link to another tab say about the gallery of `event_1`. */
    async function readGalleryTab(context: Context, userId: string) {
      signIn(userId)
      const entryResponse = await context.harness.request('/api/account/events/build-day/entry')
      const shellResponse = await context.harness.request('/api/account/events/build-day/rosters?includeEventShell=true')

      expect(entryResponse.status).toBe(200)
      expect(shellResponse.status).toBe(200)
      const entryPage = accountEventEntryPageSchema.parse((await entryResponse.json() as { data: { page: unknown } }).data.page)
      const shell = (await shellResponse.json() as { data: { shell: AccountEventPageShell } }).data.shell

      return {
        eventPage: { hasTab: entryPage.tabVisibility.availableTabs.includes('gallery'), hasGallery: entryPage.event.hasGallery },
        directLink: { hasTab: shell.tabVisibility.availableTabs.includes('gallery'), hasGallery: shell.event.hasGallery }
      }
    }

    test('is there for a participant who can add photos, also while the gallery is empty', async () => {
      const context = await createContext()
      await addApplication(context, finishedCheckInFlow)
      const emptyGalleryWithTab = { hasTab: true, hasGallery: false }

      expect(await readGalleryTab(context, 'participant')).toEqual({
        eventPage: emptyGalleryWithTab,
        directLink: emptyGalleryWithTab
      })
    })

    test('is missing while the gallery is empty and the participant cannot add photos', async () => {
      const context = await createContext()
      await addApplication(context, checkedIn)
      const noGallery = { hasTab: false, hasGallery: false }

      expect(await readGalleryTab(context, 'participant')).toEqual({ eventPage: noGallery, directLink: noGallery })
    })

    test('is missing while every photo is hidden and the participant cannot add photos', async () => {
      const context = await createContext()
      await addApplication(context, checkedIn)
      await addPhoto(context, { id: 'hidden_photo', uploadedByUserId: 'other_participant', isHidden: true })
      const noGallery = { hasTab: false, hasGallery: false }
      const galleryWithTab = { hasTab: true, hasGallery: true }

      expect(await readGalleryTab(context, 'participant')).toEqual({ eventPage: noGallery, directLink: noGallery })
      // The event team still sees the hidden photo.
      expect(await readGalleryTab(context, 'staff')).toEqual({ eventPage: galleryWithTab, directLink: galleryWithTab })
    })
  })

  // The event builder reads this setting from the admin event and sends it back when it saves.
  describe('the event setting', () => {
    function patchEvent(context: Context, userId: string | null, body: Record<string, unknown>) {
      signIn(userId)
      return context.harness.request('/api/events/event_1', { method: 'PATCH', body: JSON.stringify(body) })
    }

    test.each(['event_admin', 'platform_admin'])('%s allows participant photos', async (userId) => {
      const context = await createContext({ participantPhotosEnabled: false })

      const response = await patchEvent(context, userId, { participantPhotosEnabled: true })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ data: { participantPhotosEnabled: true } })
      expect((await readStoredEvent(context)).participantPhotosEnabled).toBe(true)
    })

    test('a save without the setting keeps it', async () => {
      const context = await createContext()

      expect((await patchEvent(context, 'event_admin', { city: 'Graz' })).status).toBe(200)
      expect((await readStoredEvent(context)).participantPhotosEnabled).toBe(true)
    })

    test.each([
      { userId: 'staff', status: 403, who: 'event staff' },
      { userId: 'judge', status: 403, who: 'a judge of the event' },
      { userId: 'participant', status: 403, who: 'a participant who finished the check-in flow' },
      { userId: null, status: 401, who: 'a visitor without a session' }
    ])('refuses $who', async ({ userId, status }) => {
      const context = await createContext()
      await addApplication(context, finishedCheckInFlow)

      expect((await patchEvent(context, userId, { participantPhotosEnabled: false })).status).toBe(status)
      expect((await readStoredEvent(context)).participantPhotosEnabled).toBe(true)
    })

    test('the settings page carries the setting for the event builder', async () => {
      const context = await createContext()
      signIn('event_admin')

      const response = await context.harness.request('/api/account/events/build-day/settings')
      const body = await response.json() as { data: { page: unknown } }

      expect(response.status).toBe(200)
      expect(accountEventSettingsPageSchema.parse(body.data.page).event.participantPhotosEnabled).toBe(true)
    })
  })
})
