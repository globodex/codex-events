-- The page of a workshop: a program session with staff. It holds the description and the slides,
-- materials and links that the staff of the workshop and the event admins add. The session itself
-- stays in the program (`event_agenda_programs.tracks_json`).
CREATE TABLE event_workshops (
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  description text NOT NULL DEFAULT '',
  resources_json text NOT NULL DEFAULT '[]',
  updated_at text NOT NULL,
  PRIMARY KEY (event_id, session_id)
);
