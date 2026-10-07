-- E-mails to the shop itself (new paid order, order to review, customer
-- return, refused refund), through the same outbox as the customer e-mails.
ALTER TYPE "EmailType" ADD VALUE 'SHOP_ORDER_PAID';
ALTER TYPE "EmailType" ADD VALUE 'SHOP_ORDER_REVIEW';
ALTER TYPE "EmailType" ADD VALUE 'SHOP_RETURN_REQUESTED';
ALTER TYPE "EmailType" ADD VALUE 'SHOP_REFUND_FAILED';
