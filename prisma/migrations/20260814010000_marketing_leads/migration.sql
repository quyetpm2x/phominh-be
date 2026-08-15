CREATE TABLE "marketing_leads" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled_at" TIMESTAMP(3),

    CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "marketing_leads_type_created_at_idx" ON "marketing_leads"("type", "created_at");
