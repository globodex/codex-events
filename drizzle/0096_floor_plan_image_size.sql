-- The size in pixels of each floor plan image, read from the uploaded file. The map takes the shape of
-- its image before the image has loaded. An image stored before this migration gets its size when the
-- image is replaced.
ALTER TABLE `event_floor_plans` ADD `image_width` integer;
--> statement-breakpoint
ALTER TABLE `event_floor_plans` ADD `image_height` integer;
