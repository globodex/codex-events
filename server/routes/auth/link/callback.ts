import { completeLinkCallback, defineLinkStep } from '#server/domains/accounts/linking'

export default defineLinkStep(completeLinkCallback, 'login_failed')
