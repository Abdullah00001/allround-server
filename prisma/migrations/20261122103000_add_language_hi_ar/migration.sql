-- AlterEnum: Hindi + Arabic (client 19-language set; HU retained in enum)
ALTER TYPE "Language" ADD VALUE IF NOT EXISTS 'HI';
ALTER TYPE "Language" ADD VALUE IF NOT EXISTS 'AR';
