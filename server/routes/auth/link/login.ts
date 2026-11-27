import { authorizeActionLink, defineLinkStep } from '#server/domains/accounts/linking'

export default defineLinkStep(authorizeActionLink, 'invalid')
