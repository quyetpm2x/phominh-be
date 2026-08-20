-- Khu vực thí điểm cho admin bật/tắt + so sánh số liệu (tai-lieu-chuc-nang.md #101)
CREATE TABLE "pilot_areas" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radius_km" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pilot_areas_pkey" PRIMARY KEY ("id")
);
