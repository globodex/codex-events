ALTER TABLE events ADD participant_photos_enabled integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE event_photos ADD is_participant_upload integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE event_photos ADD is_hidden integer NOT NULL DEFAULT false CHECK (
  is_hidden = 0 OR (is_participant_upload = 1 AND is_publicly_visible = 0)
);
