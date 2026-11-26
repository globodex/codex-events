-- The decks of workshops and challenges: the Markdown slides, materials and links that their pages on
-- the Agenda tab show (shared/domains/events/decks.ts). One table holds both kinds. The event builder
-- saves the challenge list in `events.challenges_json`, so it never writes over a deck.
CREATE TABLE `event_decks` (
  `event_id` text NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `subject_kind` text NOT NULL,
  `subject_id` text NOT NULL,
  `slides_json` text NOT NULL DEFAULT '[]',
  `resources_json` text NOT NULL DEFAULT '[]',
  `updated_at` text NOT NULL,
  PRIMARY KEY (`event_id`, `subject_kind`, `subject_id`),
  CONSTRAINT `event_decks_subject_kind_check` CHECK (`subject_kind` in ('workshop', 'challenge'))
);
--> statement-breakpoint
-- The description of a workshop becomes its first slide, and its "slides" items become materials.
INSERT INTO `event_decks` (`event_id`, `subject_kind`, `subject_id`, `slides_json`, `resources_json`, `updated_at`)
SELECT
  w.`event_id`,
  'workshop',
  w.`session_id`,
  CASE WHEN trim(w.`description`) = '' THEN '[]'
    ELSE json_array(json_object('id', 'slide-1', 'markdown', trim(w.`description`))) END,
  (
    SELECT json_group_array(json(items.`item`)) FROM (
      SELECT CASE WHEN json_extract(r.`value`, '$.kind') = 'slides'
        THEN json_set(r.`value`, '$.kind', 'material') ELSE r.`value` END AS `item`
      FROM json_each(w.`resources_json`) r
      ORDER BY r.`key`
    ) items
  ),
  w.`updated_at`
FROM `event_workshops` w;
--> statement-breakpoint
DROP TABLE `event_workshops`;
--> statement-breakpoint
-- The instructions of a challenge become the first slide of its deck, and its resources become links.
INSERT INTO `event_decks` (`event_id`, `subject_kind`, `subject_id`, `slides_json`, `resources_json`, `updated_at`)
SELECT
  e.`id`,
  'challenge',
  json_extract(c.`value`, '$.id'),
  CASE WHEN trim(coalesce(json_extract(c.`value`, '$.instructions'), '')) = '' THEN '[]'
    ELSE json_array(json_object('id', 'slide-1', 'markdown', trim(json_extract(c.`value`, '$.instructions')))) END,
  (
    SELECT json_group_array(json(items.`item`)) FROM (
      SELECT json_object(
        'id', 'link-' || (r.`key` + 1),
        'kind', 'link',
        'title', trim(json_extract(r.`value`, '$.label')),
        'url', trim(json_extract(r.`value`, '$.url'))
      ) AS `item`
      FROM json_each(c.`value`, '$.resources') r
      ORDER BY r.`key`
    ) items
  ),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `events` e
JOIN json_each(e.`challenges_json`) c;
--> statement-breakpoint
-- The challenge list keeps the rest of each challenge, in the same order.
UPDATE `events` SET `challenges_json` = (
  SELECT json_group_array(json(entries.`item`)) FROM (
    SELECT json_remove(c.`value`, '$.instructions', '$.resources') AS `item`
    FROM json_each(`events`.`challenges_json`) c
    ORDER BY c.`key`
  ) entries
)
WHERE json_array_length(`challenges_json`) > 0;
