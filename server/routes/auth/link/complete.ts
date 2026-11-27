import { advanceLink, defineLinkStep } from '#server/domains/accounts/linking'

export default defineLinkStep(advanceLink, 'failed')
