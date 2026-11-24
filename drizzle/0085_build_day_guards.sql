ALTER TABLE events ADD luma_guest_list_revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE event_luma_guests ADD refresh_revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TRIGGER events_reset_luma_guest_list
AFTER UPDATE OF luma_guest_list_enabled, luma_event_api_id ON events
WHEN OLD.luma_guest_list_enabled AND (
  NOT NEW.luma_guest_list_enabled OR OLD.luma_event_api_id IS NOT NEW.luma_event_api_id
)
BEGIN
  DELETE FROM event_luma_guests WHERE event_id = NEW.id;
  UPDATE events SET luma_guest_list_synced_at = NULL, luma_guest_list_sync_error = NULL,
    luma_guest_list_revision = luma_guest_list_revision + 1 WHERE id = NEW.id;
END;
--> statement-breakpoint
ALTER TABLE user_applications ADD active_luma_email text;
--> statement-breakpoint
CREATE VIEW active_application_luma_emails AS
SELECT a.id AS application_id, lower(trim(u.luma_email)) AS email
FROM user_applications a JOIN users u ON u.id = a.user_id JOIN events e ON e.id = a.event_id
WHERE (a.status = 'submitted' OR a.status = 'approved')
  AND u.deleted_at IS NULL AND trim(u.luma_email) <> ''
  AND (e.luma_guest_list_enabled OR (
    trim(e.luma_event_api_id) <> '' AND trim(e.luma_api_key) <> ''
    AND trim(e.luma_webhook_secret) <> '' AND e.luma_webhook_status = 'configured'
  ));
--> statement-breakpoint
-- Existing data can hold several active registrations with the same Luma email in one event.
-- Only the earliest of them (by submitted_at, then id) gets the email, so the unique index holds.
UPDATE user_applications SET active_luma_email = (
  SELECT own.email FROM active_application_luma_emails own
  WHERE own.application_id = user_applications.id
    AND NOT EXISTS (
      SELECT 1 FROM active_application_luma_emails other
      JOIN user_applications earlier ON earlier.id = other.application_id
      WHERE other.email = own.email
        AND earlier.event_id = user_applications.event_id
        AND (earlier.submitted_at < user_applications.submitted_at
          OR (earlier.submitted_at = user_applications.submitted_at AND earlier.id < user_applications.id))
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX user_applications_active_luma_email_idx
ON user_applications(event_id, active_luma_email) WHERE active_luma_email IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER application_luma_email_insert AFTER INSERT ON user_applications
BEGIN
  UPDATE user_applications SET active_luma_email = (
    SELECT email FROM active_application_luma_emails WHERE application_id = NEW.id
  ) WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER application_luma_email_update AFTER UPDATE OF status, event_id, user_id ON user_applications
BEGIN
  UPDATE user_applications SET active_luma_email = (
    SELECT email FROM active_application_luma_emails WHERE application_id = NEW.id
  ) WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER account_luma_email_update AFTER UPDATE OF luma_email, deleted_at ON users
WHEN NEW.luma_email IS NOT OLD.luma_email OR NEW.deleted_at IS NOT OLD.deleted_at
BEGIN
  UPDATE user_applications SET active_luma_email = (
    SELECT email FROM active_application_luma_emails WHERE application_id = user_applications.id
  ) WHERE user_id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER event_luma_email_update
AFTER UPDATE OF luma_guest_list_enabled, luma_event_api_id, luma_api_key, luma_webhook_secret, luma_webhook_status ON events
WHEN NEW.luma_guest_list_enabled IS NOT OLD.luma_guest_list_enabled
  OR NEW.luma_event_api_id IS NOT OLD.luma_event_api_id OR NEW.luma_api_key IS NOT OLD.luma_api_key
  OR NEW.luma_webhook_secret IS NOT OLD.luma_webhook_secret OR NEW.luma_webhook_status IS NOT OLD.luma_webhook_status
BEGIN
  UPDATE user_applications SET active_luma_email = (
    SELECT email FROM active_application_luma_emails WHERE application_id = user_applications.id
  ) WHERE event_id = NEW.id;
END;
--> statement-breakpoint
CREATE INDEX event_photos_participant_uploader_idx ON event_photos(event_id, uploaded_by_user_id)
WHERE is_participant_upload = 1;
--> statement-breakpoint
CREATE TRIGGER participant_photo_limit BEFORE INSERT ON event_photos
WHEN NEW.is_participant_upload AND (
  SELECT count(*) FROM event_photos WHERE event_id = NEW.event_id
    AND uploaded_by_user_id = NEW.uploaded_by_user_id AND is_participant_upload = 1
) >= 20
BEGIN
  SELECT RAISE(ABORT, 'event_photo_participant_limit_reached');
END;
