ALTER TABLE event_credit_offers ADD redirect_on_claim integer NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE event_credit_offers SET redirect_on_claim = true WHERE simplified_claiming_only = true;
--> statement-breakpoint
DROP INDEX event_credit_offers_simplified_claiming_event_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX event_credit_offers_redirect_event_idx ON event_credit_offers(event_id) WHERE redirect_on_claim = true;
--> statement-breakpoint
DROP INDEX event_credit_codes_claimed_attendee_eligibility_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX event_credit_codes_claimed_attendee_eligibility_idx ON event_credit_codes(claimed_attendee_eligibility_id, credit_offer_id) WHERE claimed_attendee_eligibility_id IS NOT NULL;
