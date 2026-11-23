ALTER TABLE event_role_assignments ADD staff_challenge_id text CHECK (
  staff_challenge_id IS NULL OR (is_staff = 1 AND staff_track_id IS NULL)
);
