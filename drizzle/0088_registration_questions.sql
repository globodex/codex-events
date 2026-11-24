ALTER TABLE `events` RENAME COLUMN `questionnaire_questions_json` TO `registration_questions_json`;
--> statement-breakpoint
ALTER TABLE `user_applications` ADD `registration_answers_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
UPDATE `user_applications` SET `registration_answers_json` = `questionnaire_answers_json` WHERE `questionnaire_answers_json` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_applications` DROP COLUMN `questionnaire_answers_json`;
--> statement-breakpoint
ALTER TABLE `user_applications` DROP COLUMN `questionnaire_completed_at`;
