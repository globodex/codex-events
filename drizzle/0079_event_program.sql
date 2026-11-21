CREATE TABLE event_agenda_programs (
  event_id text PRIMARY KEY NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  agenda_item_id text NOT NULL,
  tracks_json text NOT NULL
);
--> statement-breakpoint
CREATE TABLE event_agenda_favorites (
  event_id text NOT NULL REFERENCES event_agenda_programs(event_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  PRIMARY KEY (event_id, user_id, session_id)
);
--> statement-breakpoint
CREATE INDEX event_agenda_favorites_user_idx ON event_agenda_favorites(user_id);
--> statement-breakpoint
CREATE TABLE event_floor_plans (
  id text PRIMARY KEY NOT NULL,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  object_key text NOT NULL,
  image_revision integer NOT NULL DEFAULT 1,
  rooms_json text NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
CREATE INDEX event_floor_plans_event_idx ON event_floor_plans(event_id);
