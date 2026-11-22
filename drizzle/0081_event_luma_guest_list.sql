ALTER TABLE events ADD luma_guest_list_enabled integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE events ADD luma_guest_list_synced_at text;
--> statement-breakpoint
ALTER TABLE events ADD luma_guest_list_sync_error text;
--> statement-breakpoint
CREATE TABLE event_luma_guests (
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email text NOT NULL,
  approval_status text NOT NULL,
  synced_at text NOT NULL,
  PRIMARY KEY (event_id, email)
);
