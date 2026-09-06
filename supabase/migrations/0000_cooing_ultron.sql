-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."bill_status" AS ENUM('unpaid', 'partial', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('active', 'expired', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending', 'sent', 'partial', 'paid', 'overdue', 'voided');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('idle', 'running', 'failed', 'paused');--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_user_id_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"changes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qb_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"qb_id" text NOT NULL,
	"sync_token" text NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"account_sub_type" text,
	"current_balance" numeric(19, 4) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qb_accounts_organization_id_qb_id_unique" UNIQUE("organization_id","qb_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider_id" text DEFAULT 'quickbooks' NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp NOT NULL,
	"realm_id" text,
	"connection_status" "connection_status" DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_connections_organization_id_provider_id_unique" UNIQUE("organization_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "qb_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"qb_id" text NOT NULL,
	"sync_token" text NOT NULL,
	"doc_number" text,
	"txn_date" date NOT NULL,
	"due_date" date,
	"vendor_id" uuid,
	"vendor_name" text,
	"total_amount" numeric(19, 4) NOT NULL,
	"balance" numeric(19, 4) NOT NULL,
	"status" "bill_status" NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qb_bills_organization_id_qb_id_unique" UNIQUE("organization_id","qb_id")
);
--> statement-breakpoint
CREATE TABLE "qb_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"qb_id" text NOT NULL,
	"sync_token" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qb_entities_organization_id_entity_type_qb_id_unique" UNIQUE("organization_id","entity_type","qb_id")
);
--> statement-breakpoint
CREATE TABLE "qb_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"qb_id" text NOT NULL,
	"sync_token" text NOT NULL,
	"doc_number" text,
	"txn_date" date NOT NULL,
	"due_date" date,
	"customer_id" uuid,
	"customer_name" text,
	"total_amount" numeric(19, 4) NOT NULL,
	"balance" numeric(19, 4) NOT NULL,
	"status" "invoice_status" NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qb_invoices_organization_id_qb_id_unique" UNIQUE("organization_id","qb_id")
);
--> statement-breakpoint
CREATE TABLE "qb_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"qb_id" text NOT NULL,
	"sync_token" text NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"item_type" text NOT NULL,
	"unit_price" numeric(19, 4) DEFAULT '0',
	"purchase_cost" numeric(19, 4) DEFAULT '0',
	"quantity_on_hand" numeric(19, 4) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qb_items_organization_id_qb_id_unique" UNIQUE("organization_id","qb_id")
);
--> statement-breakpoint
CREATE TABLE "qb_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"qb_id" text NOT NULL,
	"sync_token" text NOT NULL,
	"txn_date" date NOT NULL,
	"customer_id" uuid,
	"customer_name" text,
	"total_amount" numeric(19, 4) NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qb_payments_organization_id_qb_id_unique" UNIQUE("organization_id","qb_id")
);
--> statement-breakpoint
CREATE TABLE "qb_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"qb_id" text NOT NULL,
	"sync_token" text NOT NULL,
	"display_name" text NOT NULL,
	"company_name" text,
	"email" text,
	"phone" text,
	"balance" numeric(19, 4) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qb_customers_organization_id_qb_id_unique" UNIQUE("organization_id","qb_id")
);
--> statement-breakpoint
CREATE TABLE "qb_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"qb_id" text NOT NULL,
	"sync_token" text NOT NULL,
	"display_name" text NOT NULL,
	"company_name" text,
	"email" text,
	"phone" text,
	"balance" numeric(19, 4) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qb_vendors_organization_id_qb_id_unique" UNIQUE("organization_id","qb_id")
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"records_processed" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sync_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"last_sync_time" timestamp DEFAULT now() NOT NULL,
	"sync_status" "sync_status" DEFAULT 'idle' NOT NULL,
	"records_synced" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sync_cursors_organization_id_entity_type_unique" UNIQUE("organization_id","entity_type")
);
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_accounts" ADD CONSTRAINT "qb_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_bills" ADD CONSTRAINT "qb_bills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_bills" ADD CONSTRAINT "qb_bills_vendor_id_qb_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."qb_vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_entities" ADD CONSTRAINT "qb_entities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_invoices" ADD CONSTRAINT "qb_invoices_customer_id_qb_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."qb_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_invoices" ADD CONSTRAINT "qb_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_items" ADD CONSTRAINT "qb_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_payments" ADD CONSTRAINT "qb_payments_customer_id_qb_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."qb_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_payments" ADD CONSTRAINT "qb_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_customers" ADD CONSTRAINT "qb_customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qb_vendors" ADD CONSTRAINT "qb_vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_cursors" ADD CONSTRAINT "sync_cursors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_org_members_org" ON "organization_members" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_org_members_user" ON "organization_members" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_org" ON "audit_logs" USING btree ("organization_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_accounts_org" ON "qb_accounts" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_bills_org" ON "qb_bills" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_bills_status" ON "qb_bills" USING btree ("organization_id" uuid_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_entities_org_type" ON "qb_entities" USING btree ("organization_id" uuid_ops,"entity_type" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_invoices_date" ON "qb_invoices" USING btree ("organization_id" uuid_ops,"txn_date" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_invoices_org" ON "qb_invoices" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_invoices_status" ON "qb_invoices" USING btree ("organization_id" enum_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_items_org" ON "qb_items" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_payments_org" ON "qb_payments" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_customers_org" ON "qb_customers" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_qb_vendors_org" ON "qb_vendors" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sync_jobs_org" ON "sync_jobs" USING btree ("organization_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sync_jobs_status" ON "sync_jobs" USING btree ("status" enum_ops);
*/