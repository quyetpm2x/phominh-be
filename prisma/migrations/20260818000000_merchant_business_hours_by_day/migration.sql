-- CreateTable
CREATE TABLE "merchant_business_hours" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "merchant_business_hours_pkey" PRIMARY KEY ("id")
);

-- Giữ lại khung giờ cũ (nếu merchant nào đã lỡ có) cho cả 7 ngày trước khi xoá 2 cột phẳng cũ, tránh
-- mất cấu hình đã đặt trước khi chuyển sang lịch theo từng thứ (tai-lieu-chuc-nang.md #43).
INSERT INTO "merchant_business_hours" ("id", "merchant_id", "day_of_week", "start_time", "end_time")
SELECT gen_random_uuid(), mp.id, d.day_of_week, mp.business_hours_start, mp.business_hours_end
FROM "merchant_profiles" mp
CROSS JOIN generate_series(0, 6) AS d(day_of_week)
WHERE mp.business_hours_start IS NOT NULL AND mp.business_hours_end IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "merchant_business_hours_merchant_id_day_of_week_key" ON "merchant_business_hours"("merchant_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "merchant_business_hours" ADD CONSTRAINT "merchant_business_hours_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "merchant_profiles" DROP COLUMN "business_hours_start",
                                 DROP COLUMN "business_hours_end";
