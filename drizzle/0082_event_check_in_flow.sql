ALTER TABLE events ADD check_in_flow_enabled integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE events ADD questionnaire_questions_json text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE user_applications ADD questionnaire_answers_json text;
--> statement-breakpoint
ALTER TABLE user_applications ADD questionnaire_completed_at text;
