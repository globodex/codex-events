import type { EventFloorPlan, ProgramRoom, ProgramSession } from '#shared/domains/events/program'

interface Point {
  x: number
  y: number
}

type Place = NonNullable<ProgramSession['room']>

/** A room of the event's floor plans as an option of a room select in the event builder. */
export interface ProgramRoomOption {
  key: string
  label: string
  room: Place
}

/** The value of a room in a room select. It equals the `key` of the room's option. */
export function roomOptionKey(room: Place) {
  return JSON.stringify([room.floorPlanId, room.roomId])
}

/** Every room of the floor plans as a room select option, for example "Seminar Room · Ground floor". */
export function programRoomOptions(floorPlans: EventFloorPlan[]): ProgramRoomOption[] {
  return floorPlans.flatMap(floor => floor.rooms.map((room) => {
    const place = { floorPlanId: floor.id, roomId: room.id }
    return { key: roomOptionKey(place), label: `${room.name} · ${floor.name}`, room: place }
  }))
}

export function roomAreaStyle(area: ProgramRoom['area']) {
  return {
    left: `${area.x * 100}%`,
    top: `${area.y * 100}%`,
    width: `${area.width * 100}%`,
    height: `${area.height * 100}%`,
    rotate: `${area.rotation}deg`
  }
}

/** A room by its name and, when it has one, its number at the venue: "U1-1 · AEU103". */
export function roomLabel(room: Pick<ProgramRoom, 'name' | 'number'>) {
  return room.number ? `${room.name} · ${room.number}` : room.name
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
