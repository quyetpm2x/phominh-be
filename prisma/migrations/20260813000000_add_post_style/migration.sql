-- CreateEnum
CREATE TYPE "PostFontSize" AS ENUM ('small', 'medium', 'large');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN "text_color" TEXT,
ADD COLUMN "background_color" TEXT,
ADD COLUMN "font_size" "PostFontSize";
