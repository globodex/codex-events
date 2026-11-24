-- Build events keep one list that participants choose from: the challenge list with its open
-- tracks. Every registration track of a Build event becomes a published open track of the same
-- event, and the track choices and staff tracks move with it. Nothing of a track is cut: when a
-- track does not fit the challenge rules (shared/domains/events/challenges.ts), the check below
-- fails and the whole migration stops.
CREATE TABLE `_build_track_merge` AS
SELECT
  t.`id`,
  t.`event_id`,
  t.`display_order`,
  t.`name` AS `title`,
  t.`short_description`
    || CASE WHEN trim(t.`full_description`) <> '' THEN char(10) || char(10) || t.`full_description` ELSE '' END
    || coalesce((
      SELECT char(10) || char(10) || '**Links**' || char(10) || group_concat(
        '- [' || json_extract(r.`value`, '$.title') || '](' || json_extract(r.`value`, '$.url') || ')'
          || CASE WHEN trim(coalesce(json_extract(r.`value`, '$.description'), '')) <> ''
            THEN ': ' || json_extract(r.`value`, '$.description')
            ELSE '' END,
        char(10)
      )
      FROM (SELECT `value` FROM json_each(t.`resources_json`) ORDER BY json_extract(`value`, '$.displayOrder')) r
    ), '') AS `instructions`,
  t.`staff_instructions`
FROM `event_tracks` t
JOIN `events` e ON e.`id` = t.`event_id`
WHERE e.`event_type` = 'build';
--> statement-breakpoint
CREATE TABLE `_build_track_merge_check` (`fits` integer NOT NULL CHECK (`fits` = 1));
--> statement-breakpoint
INSERT INTO `_build_track_merge_check` (`fits`)
SELECT CASE
  WHEN length(m.`id`) <= 64
    AND length(trim(m.`title`)) BETWEEN 1 AND 120
    AND length(trim(m.`instructions`)) BETWEEN 1 AND 4000
    AND length(trim(m.`staff_instructions`)) <= 4000
  THEN 1 ELSE 0 END
FROM `_build_track_merge` m;
--> statement-breakpoint
INSERT INTO `_build_track_merge_check` (`fits`)
SELECT CASE WHEN json_array_length(e.`challenges_json`) + count(*) <= 20 THEN 1 ELSE 0 END
FROM `_build_track_merge` m
JOIN `events` e ON e.`id` = m.`event_id`
GROUP BY e.`id`;
--> statement-breakpoint
INSERT INTO `_build_track_merge_check` (`fits`)
SELECT 0
FROM `_build_track_merge` m
JOIN `events` e ON e.`id` = m.`event_id`
JOIN json_each(e.`challenges_json`) c ON json_extract(c.`value`, '$.id') = m.`id`;
--> statement-breakpoint
UPDATE `events` SET
  `challenges_json` = (
    SELECT json_group_array(json(entries.`item`)) FROM (
      SELECT c.`value` AS `item`, 0 AS `part`, c.`key` AS `position`
      FROM json_each(`events`.`challenges_json`) c
      UNION ALL
      SELECT json_object(
        'id', m.`id`,
        'title', m.`title`,
        'instructions', m.`instructions`,
        'resources', json('[]'),
        'isPublished', json('true'),
        'isOpenTrack', json('true'),
        'staffInstructions', m.`staff_instructions`
      ), 1, m.`display_order`
      FROM `_build_track_merge` m
      WHERE m.`event_id` = `events`.`id`
      ORDER BY `part`, `position`
    ) entries
  ),
  `public_content_revision` = `public_content_revision` + 1
WHERE EXISTS (SELECT 1 FROM `_build_track_merge` m WHERE m.`event_id` = `events`.`id`);
--> statement-breakpoint
UPDATE `user_applications` SET `selected_challenge_id` = `selected_track_id`, `selected_track_id` = NULL
WHERE EXISTS (SELECT 1 FROM `_build_track_merge` m WHERE m.`id` = `user_applications`.`selected_track_id`);
--> statement-breakpoint
UPDATE `event_role_assignments` SET `staff_challenge_id` = `staff_track_id`, `staff_track_id` = NULL
WHERE EXISTS (SELECT 1 FROM `_build_track_merge` m WHERE m.`id` = `event_role_assignments`.`staff_track_id`);
--> statement-breakpoint
DELETE FROM `event_tracks`
WHERE EXISTS (SELECT 1 FROM `_build_track_merge` m WHERE m.`id` = `event_tracks`.`id`);
--> statement-breakpoint
DROP TABLE `_build_track_merge_check`;
--> statement-breakpoint
DROP TABLE `_build_track_merge`;
