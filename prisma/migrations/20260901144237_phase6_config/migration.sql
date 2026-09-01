-- AlterTable
ALTER TABLE "app_config" ADD COLUMN     "auto_paused_at" TIMESTAMPTZ,
ADD COLUMN     "auto_paused_reason" TEXT,
ADD COLUMN     "bounce_rate_min_sample" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "bounce_rate_threshold_pct" DOUBLE PRECISION NOT NULL DEFAULT 5.0;
