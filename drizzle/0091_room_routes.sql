-- A room on a floor plan can have several routes. A room that has a route keeps it as its only
-- route: the room's `route` becomes `routes`, a list that holds that one route.
UPDATE `event_floor_plans` SET `rooms_json` = (
  SELECT json_group_array(json(rooms.`room`)) FROM (
    SELECT CASE
      WHEN json_type(r.`value`, '$.route') IS NULL THEN r.`value`
      ELSE json_remove(json_set(r.`value`, '$.routes', json_array(json(json_extract(r.`value`, '$.route')))), '$.route')
    END AS `room`
    FROM json_each(`event_floor_plans`.`rooms_json`) r
    ORDER BY r.`key`
  ) rooms
)
WHERE EXISTS (
  SELECT 1 FROM json_each(`event_floor_plans`.`rooms_json`) r WHERE json_type(r.`value`, '$.route') IS NOT NULL
);
