CREATE TYPE "public"."user_role" AS ENUM('operador', 'gerente');--> statement-breakpoint
CREATE TYPE "public"."note_status" AS ENUM('open', 'completed', 'closed_incomplete');--> statement-breakpoint
CREATE TYPE "public"."scan_result" AS ENUM('matched', 'manual_matched', 'exceeded', 'unidentified');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invoice_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"nfe_chave_acesso" text NOT NULL,
	"nfe_numero" text NOT NULL,
	"supplier_cnpj" text NOT NULL,
	"supplier_name" text NOT NULL,
	"status" "note_status" DEFAULT 'open' NOT NULL,
	"raw_xml" text NOT NULL,
	"opened_by" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "note_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"c_prod" text NOT NULL,
	"c_ean" text,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"expected_qty" numeric(12, 3) NOT NULL,
	"confirmed_qty" numeric(12, 3) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_event_id" uuid NOT NULL,
	"scanned_code" text NOT NULL,
	"result" "scan_result" NOT NULL,
	"note_id" uuid,
	"note_item_id" uuid,
	"scanned_by" uuid NOT NULL,
	"scanned_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_events_client_event_id_unique" UNIQUE("client_event_id")
);
--> statement-breakpoint
ALTER TABLE "invoice_notes" ADD CONSTRAINT "invoice_notes_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_notes" ADD CONSTRAINT "invoice_notes_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_items" ADD CONSTRAINT "note_items_note_id_invoice_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."invoice_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_note_id_invoice_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."invoice_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_note_item_id_note_items_id_fk" FOREIGN KEY ("note_item_id") REFERENCES "public"."note_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_scanned_by_users_id_fk" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_notes_status_idx" ON "invoice_notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoice_notes_invoice_number_idx" ON "invoice_notes" USING btree ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "note_items_note_id_c_prod_idx" ON "note_items" USING btree ("note_id","c_prod");--> statement-breakpoint
CREATE INDEX "note_items_note_id_idx" ON "note_items" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "scan_events_note_id_idx" ON "scan_events" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "scan_events_result_idx" ON "scan_events" USING btree ("result");