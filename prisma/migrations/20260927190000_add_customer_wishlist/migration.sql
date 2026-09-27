-- Favorites are kept per customer after sign-in. Guest favorites stay in a
-- short-lived browser session cookie and are copied here on authentication.
CREATE TABLE "WishlistItem" (
    "customerId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("customerId", "productId")
);

CREATE INDEX "WishlistItem_customerId_createdAt_idx" ON "WishlistItem"("customerId", "createdAt");
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");

ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
