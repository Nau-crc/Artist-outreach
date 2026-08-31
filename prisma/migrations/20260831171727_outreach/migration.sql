-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('DISCOVERED', 'REVIEW_REQUIRED', 'REVIEWED', 'DISCARDED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('NOT_FOUND', 'FOUND', 'INVALID', 'BOUNCED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('UNKNOWN', 'REQUESTED', 'PENDING', 'CONFIRMED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('NOT_REVIEWED', 'ELIGIBLE', 'NOT_ELIGIBLE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DiscoverySourceType" AS ENUM ('API', 'DIRECTORY', 'CSV', 'MANUAL');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('VERIFIED', 'UNVERIFIED', 'PROHIBITED');

-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'RATE_LIMITED');

-- CreateEnum
CREATE TYPE "ConsentRequestStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('NEWSLETTER');

-- CreateEnum
CREATE TYPE "ConsentRecordStatus" AS ENUM ('CONFIRMED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('EMAIL_LINK', 'PUBLIC_FORM', 'MANUAL');

-- CreateEnum
CREATE TYPE "NewsletterSubscriptionStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('UNSUBSCRIBE', 'COMPLAINT', 'HARD_BOUNCE', 'MANUAL', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EmailPurpose" AS ENUM ('CONSENT_REQUEST', 'DOUBLE_OPTIN', 'NEWSLETTER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailMessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'OPENED', 'CLICKED');

-- CreateEnum
CREATE TYPE "AuditActorKind" AS ENUM ('USER', 'SYSTEM', 'WEBHOOK', 'PUBLIC');

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "artist_name" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "discipline" TEXT,
    "country" CHAR(2),
    "city" TEXT,
    "language" TEXT,
    "contact_status" "ContactStatus" NOT NULL DEFAULT 'DISCOVERED',
    "email_status" "EmailStatus" NOT NULL DEFAULT 'NOT_FOUND',
    "consent_status" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "permission" "Permission" NOT NULL DEFAULT 'NOT_REVIEWED',
    "last_action_at" TIMESTAMPTZ,
    "reviewed_at" TIMESTAMPTZ,
    "reviewed_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_sources" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscoverySourceType" NOT NULL,
    "compliance_status" "ComplianceStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "compliance_notes" TEXT,
    "terms_url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "discovery_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_runs" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'RUNNING',
    "results_count" INTEGER NOT NULL DEFAULT 0,
    "new_contacts_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "triggered_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_sources" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "run_id" UUID,
    "source_id" UUID NOT NULL,
    "source_url" TEXT NOT NULL,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "discovered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tags" (
    "contact_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("contact_id","tag_id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "max_sends" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "consent_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_requests" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "text_version" TEXT NOT NULL,
    "status" "ConsentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "eligibility_snapshot" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL DEFAULT 'NEWSLETTER',
    "status" "ConsentRecordStatus" NOT NULL,
    "source" "ConsentSource" NOT NULL,
    "text_version" TEXT NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMPTZ,
    "evidence" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscriptions" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "status" "NewsletterSubscriptionStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "confirmation_token" TEXT,
    "confirmation_expires_at" TIMESTAMPTZ,
    "confirmed_at" TIMESTAMPTZ,
    "unsubscribed_at" TIMESTAMPTZ,
    "unsubscribe_token" TEXT NOT NULL,
    "consent_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressions" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "notes" TEXT,
    "suppressed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suppressed_by" UUID,

    CONSTRAINT "suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "contact_id" UUID,
    "purpose" "EmailPurpose" NOT NULL,
    "related_id" UUID,
    "provider" TEXT NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "template_id" UUID,
    "text_version" TEXT,
    "status" "EmailMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMPTZ,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "event_type" "EmailEventType" NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "sending_enabled" BOOLEAN NOT NULL DEFAULT false,
    "campaign_enabled" BOOLEAN NOT NULL DEFAULT false,
    "daily_send_limit" INTEGER NOT NULL DEFAULT 0,
    "hourly_send_limit" INTEGER NOT NULL DEFAULT 0,
    "min_interval_seconds" INTEGER NOT NULL DEFAULT 60,
    "consent_request_cooldown_days" INTEGER NOT NULL DEFAULT 90,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_kind" "AuditActorKind" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_contact_status_idx" ON "contacts"("contact_status");

-- CreateIndex
CREATE INDEX "contacts_permission_idx" ON "contacts"("permission");

-- CreateIndex
CREATE INDEX "contacts_consent_status_idx" ON "contacts"("consent_status");

-- CreateIndex
CREATE INDEX "contacts_country_discipline_idx" ON "contacts"("country", "discipline");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_sources_slug_key" ON "discovery_sources"("slug");

-- CreateIndex
CREATE INDEX "discovery_runs_source_id_started_at_idx" ON "discovery_runs"("source_id", "started_at");

-- CreateIndex
CREATE INDEX "contact_sources_contact_id_idx" ON "contact_sources"("contact_id");

-- CreateIndex
CREATE INDEX "contact_sources_source_id_discovered_at_idx" ON "contact_sources"("source_id", "discovered_at");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "consent_requests_token_key" ON "consent_requests"("token");

-- CreateIndex
CREATE INDEX "consent_requests_contact_id_sent_at_idx" ON "consent_requests"("contact_id", "sent_at" DESC);

-- CreateIndex
CREATE INDEX "consents_contact_id_purpose_granted_at_idx" ON "consents"("contact_id", "purpose", "granted_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_confirmation_token_key" ON "newsletter_subscriptions"("confirmation_token");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_unsubscribe_token_key" ON "newsletter_subscriptions"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_contact_id_idx" ON "newsletter_subscriptions"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppressions_email_key" ON "suppressions"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_provider_message_id_key" ON "email_messages"("provider_message_id");

-- CreateIndex
CREATE INDEX "email_messages_contact_id_sent_at_idx" ON "email_messages"("contact_id", "sent_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "email_events_message_id_event_type_provider_event_id_key" ON "email_events"("message_id", "event_type", "provider_event_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_at_idx" ON "audit_logs"("entity_type", "entity_id", "at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_at_idx" ON "audit_logs"("at" DESC);

-- AddForeignKey
ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "discovery_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_sources" ADD CONSTRAINT "contact_sources_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_sources" ADD CONSTRAINT "contact_sources_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "discovery_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_sources" ADD CONSTRAINT "contact_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "discovery_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "consent_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "consent_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
