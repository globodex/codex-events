import type { ProgramRoom } from '#shared/domains/events/program'

interface Point {
  x: number
  y: number
}

export function roomAreaStyle(area: ProgramRoom['area']) {
  return {
    left: `${area.x * 100}%`,
    top: `${area.y * 100}%`,
    width: `${area.width * 100}%`,
    height: `${area.height * 100}%`
  }
}

/**
 * Returns evenly spaced arrow positions along a route.
 * Points and spacing use the same unit. `angle` is the walking direction in degrees.
 */
export function routeArrows(points: Point[], spacing: number) {
  const arrows: Array<Point & { angle: number }> = []
  let distanceToNextArrow = spacing / 2

  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]!
    const to = points[index]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI

    let distance = distanceToNextArrow
    for (; distance < length; distance += spacing) {
      const progress = distance / length
      arrows.push({
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        angle
      })
    }
    distanceToNextArrow = distance - length
  }

  return arrows
}
