import type { ProgramRoom } from '#shared/domains/events/program'

export function roomAreaStyle(area: ProgramRoom['area']) {
  return {
    left: `${area.x * 100}%`,
    top: `${area.y * 100}%`,
    width: `${area.width * 100}%`,
    height: `${area.height * 100}%`
  }
}
