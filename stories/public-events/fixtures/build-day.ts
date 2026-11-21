import type { PublicEvent, PublicEventAgendaItem, PublicEventTrack, PublicPrize } from '~/domains/events/presentation'
import type { EventPhotoRecord } from '#shared/domains/events/photos'
import type { EventCertificate } from '#shared/domains/events/certificates'
import type { PublishedProjectEntry, WinnerEntry } from '~/domains/outcomes/published-outcomes'

// Storybook photos by Matheus Bertelli and Christina Morillo.
// https://www.pexels.com/photo/7172695/
// https://www.pexels.com/photo/1181210/
import tablePhoto from './build-day-table.webp'
import laptopsPhoto from './build-day-laptops.webp'

const today = new Date()

export function dayFromToday(days: number, hour = 0, minutes = 0) {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days, hour, minutes))
    .toISOString()
}

function createAgenda(days: number): PublicEventAgendaItem[] {
  return [
    {
      id: 'welcome',
      startsAt: dayFromToday(days, 8, 30),
      endsAt: dayFromToday(days, 9),
      title: 'Welcome and coffee',
      details: 'Meet the team and get set up for the day.',
      displayOrder: 0
    },
    {
      id: 'build-time',
      startsAt: dayFromToday(days, 9),
      endsAt: dayFromToday(days, 13, 30),
      title: 'Build Time',
      details: 'Work on your project and join a workshop.',
      displayOrder: 1
    },
    {
      id: 'showcase',
      startsAt: dayFromToday(days, 13, 45),
      endsAt: dayFromToday(days, 14, 30),
      title: 'Project demos',
      details: null,
      displayOrder: 2
    }
  ]
}

export const publicTracks: PublicEventTrack[] = [
  {
    name: 'Build a useful tool',
    shortDescription: 'Create something that makes an everyday task easier.',
    fullDescription: 'Start with a task someone repeats every week. Bring a small example you can try with Codex.',
    resources: [{
      title: 'Project starter guide',
      url: 'https://example.com/starter-guide',
      description: 'A short checklist for choosing and trying a project idea.',
      displayOrder: 0
    }],
    displayOrder: 0
  },
  {
    name: 'Explore a new idea',
    shortDescription: 'Build a prototype and share what you learned.',
    displayOrder: 1
  }
]

export const publicBuildDay: PublicEvent = {
  eventType: 'build',
  name: 'Codex Build Day',
  slug: 'storybook-build-day',
  description: 'Bring a project idea and spend the day building with Codex. Join a workshop or share a demo at the end of the day.',
  agendaItems: createAgenda(14),
  tracks: publicTracks,
  backgroundImageUrl: null,
  displayBackgroundImageUrl: null,
  bannerImageUrl: tablePhoto,
  publicContentRevision: 1,
  city: 'Vienna',
  country: 'Austria',
  address: 'Workshop venue',
  registrationOpensAt: dayFromToday(-3),
  registrationClosesAt: dayFromToday(12),
  submissionOpensAt: null,
  submissionClosesAt: null,
  state: 'registration_open',
  maxTeamMembers: 1,
  autoApproveApplications: false,
  talkProposalsEnabled: true,
  talkProposalOpensAt: dayFromToday(-3),
  talkProposalClosesAt: dayFromToday(8),
  inPersonEvent: true,
  applicationXProfileVisible: false,
  applicationLinkedinProfileVisible: false,
  applicationGithubProfileVisible: false,
  applicationChatgptEmailVisible: false,
  applicationOpenaiOrgIdVisible: false,
  applicationLumaEmailVisible: false,
  applicationWhyThisEventVisible: false,
  applicationProofOfExecutionVisible: false,
  applicationTeamIntentVisible: false,
  applicationAiKnowledgeVisible: false,
  requireXProfile: false,
  requireLinkedinProfile: false,
  requireGithubProfile: false,
  requireChatgptEmail: false,
  requireOpenaiOrgId: false,
  requireLumaEmail: false,
  requireWhyThisEvent: false,
  requireProofOfExecution: false,
  requireTeamIntent: false,
  requireAiKnowledge: false,
  requireSubmissionSummary: false,
  requireSubmissionRepositoryUrl: false,
  requireSubmissionDemoUrl: false
}

export const completedBuildDay: PublicEvent = {
  ...publicBuildDay,
  agendaItems: createAgenda(-14),
  registrationOpensAt: dayFromToday(-30),
  registrationClosesAt: dayFromToday(-16),
  state: 'completed'
}

export const publicGalleryPhotos = [
  { id: 'demo-welcome', fileName: 'Morning workshop', url: tablePhoto, width: 1122, height: 748 },
  { id: 'demo-build', fileName: 'Building together', url: laptopsPhoto, width: 840, height: 561 }
].map(({ url, ...photo }): EventPhotoRecord => ({
  ...photo,
  eventId: 'storybook-build-day',
  isPubliclyVisible: true,
  contentType: 'image/webp',
  createdAt: dayFromToday(-14, 10),
  uploadedByUserId: null,
  uploadedBy: null,
  previewUrl: url,
  originalUrl: `${url}?variant=original`
}))

export const publicPrize: PublicPrize = {
  name: 'Best community project',
  description: 'Awarded to a project that helps people in the local community.',
  rewardType: 'api_credits',
  rewardValue: '250',
  rewardCurrency: 'USD',
  awardScope: 'team',
  rankStart: 1,
  rankEnd: 1,
  displayOrder: 0
}

export const publishedProject: PublishedProjectEntry = {
  teamId: 'repair-club',
  teamName: 'Repair Club',
  submissionId: 'repair-map',
  projectName: 'Repair Map',
  summary: 'A map of local repair cafés. Find the next session and see what tools to bring.',
  repositoryUrl: 'https://example.com/repair-map/source',
  demoUrl: 'https://example.com/repair-map',
  teamMembers: [
    {
      id: 'mara-berger',
      fullName: 'Mara Berger',
      bio: 'Volunteer and front-end developer',
      xProfileUrl: null,
      linkedinProfileUrl: null,
      githubProfileUrl: null,
      profileIconUrl: null
    }
  ]
}

export const winningProject: WinnerEntry = {
  ...publishedProject,
  finalRank: 1,
  prizes: [{
    ...publicPrize,
    id: 'community-project',
    eventId: 'storybook-build-day',
    createdAt: dayFromToday(-16)
  }]
}

export const publicCertificate: EventCertificate = {
  participantName: 'Mara Berger',
  eventName: publicBuildDay.name,
  eventSlug: publicBuildDay.slug,
  eventType: 'build',
  eventDateIso: dayFromToday(-14),
  eventDateLabel: new Date(dayFromToday(-14)).toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' }),
  city: publicBuildDay.city,
  country: publicBuildDay.country,
  trackName: null,
  teamName: null,
  projectName: null,
  placement: null,
  prizes: [],
  certificateId: 'BLD-VIE-DEMO',
  backgroundImageUrl: tablePhoto
}
