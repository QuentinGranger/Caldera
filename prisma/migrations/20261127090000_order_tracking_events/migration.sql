BEGIN;

-- The trigger and baseline become visible together. A concurrent order update
-- can never fall between taking the baseline and starting the journal.
LOCK TABLE "Order" IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE "OrderTrackingEvent" (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  writer xid8 NOT NULL DEFAULT pg_current_xact_id(),
  reference text NOT NULL,
  kind text NOT NULL,
  status "OrderStatus" NOT NULL,
  fulfillment "FulfillmentStatus" NOT NULL,
  previous_status "OrderStatus",
  previous_fulfillment "FulfillmentStatus",
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "OrderTrackingEvent_writer_id_idx" ON "OrderTrackingEvent" (writer, id);

CREATE FUNCTION record_order_tracking_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "OrderTrackingEvent" (reference, kind, status, fulfillment)
    VALUES (NEW."orderNumber", 'CREATED', NEW.status, NEW."fulfillmentStatus");
  ELSIF (NEW.status, NEW."fulfillmentStatus") IS DISTINCT FROM (OLD.status, OLD."fulfillmentStatus") THEN
    INSERT INTO "OrderTrackingEvent" (reference, kind, status, fulfillment, previous_status, previous_fulfillment)
    VALUES (NEW."orderNumber", 'CHANGED', NEW.status, NEW."fulfillmentStatus", OLD.status, OLD."fulfillmentStatus");
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_tracking_after_change
AFTER INSERT OR UPDATE OF status, "fulfillmentStatus" ON "Order"
FOR EACH ROW EXECUTE FUNCTION record_order_tracking_event();

INSERT INTO "OrderTrackingEvent" (reference, kind, status, fulfillment)
SELECT "orderNumber", 'BASELINE', status, "fulfillmentStatus" FROM "Order";
COMMIT;
