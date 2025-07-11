-- CreateTable
CREATE TABLE "KickedUser" (
    "id" SERIAL NOT NULL,
    "giveawayId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,

    CONSTRAINT "KickedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KickedUser_giveawayId_username_key" ON "KickedUser"("giveawayId", "username");

-- AddForeignKey
ALTER TABLE "KickedUser" ADD CONSTRAINT "KickedUser_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
