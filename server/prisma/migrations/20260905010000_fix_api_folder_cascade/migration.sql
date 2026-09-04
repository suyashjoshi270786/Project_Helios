-- DropForeignKey
ALTER TABLE "ApiRequest" DROP CONSTRAINT "ApiRequest_folderId_fkey";

-- AddForeignKey
ALTER TABLE "ApiRequest" ADD CONSTRAINT "ApiRequest_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ApiFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
