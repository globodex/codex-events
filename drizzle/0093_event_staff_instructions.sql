-- The general instructions for the event team of an event, in Markdown. Staff read them on the
-- Staff tab, and event admins edit them there.
ALTER TABLE events ADD staff_instructions text NOT NULL DEFAULT '';
