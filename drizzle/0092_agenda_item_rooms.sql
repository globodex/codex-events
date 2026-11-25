-- A program can name the room of each public agenda block outside it, for example check-in.
ALTER TABLE event_agenda_programs ADD agenda_item_rooms_json text NOT NULL DEFAULT '[]';
