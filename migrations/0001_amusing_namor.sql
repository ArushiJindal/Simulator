CREATE TABLE "adhoc_analyses" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"videoid" varchar(32) NOT NULL,
	"prompttext" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"result" text,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_queries" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"querytext" text NOT NULL,
	"channels" text NOT NULL,
	"startdate" timestamp with time zone,
	"enddate" timestamp with time zone,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"answer" text,
	"videocount" integer,
	"createdat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "channelname" text;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "publishedat" timestamp with time zone;