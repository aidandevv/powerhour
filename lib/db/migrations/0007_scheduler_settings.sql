ALTER TABLE "user_settings"
  ADD COLUMN "sync_schedule_enabled" boolean DEFAULT true NOT NULL,
  ADD COLUMN "digest_schedule_enabled" boolean DEFAULT true NOT NULL;
