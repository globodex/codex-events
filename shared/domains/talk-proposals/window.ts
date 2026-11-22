export function isTalkProposalWindowOpen(opensAt: string | null, closesAt: string | null, now = Date.now()) {
  return now >= Date.parse(opensAt ?? '') && now <= Date.parse(closesAt ?? '')
}
