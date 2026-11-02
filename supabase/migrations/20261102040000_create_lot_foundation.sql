-- Etapa 19.19. REVIEW REQUIRED; NOT EXECUTED.
-- Foundation only: no existing RPC, endpoint, frontend flow or stock-consumption
-- rule is replaced here. Product quantity remains the existing aggregate.
-- DDL is intentionally one-time; the legacy-balance backfill itself is safe
-- against duplicate rows within this transaction and aborts on any mismatch.

BEGIN;

DO $preflight$
DECLARE
  relation_name text;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Lot foundation migration requires current_user = postgres';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY[
    'public.products', 'public.orders', 'public.order_items'
  ]
  LOOP
    IF to_regclass(relation_name) IS NULL THEN
      RAISE EXCEPTION 'Required relation is missing: %', relation_name;
    END IF;
  END LOOP;
  IF to_regnamespace('private') IS NULL
     OR (SELECT nspowner FROM pg_namespace WHERE nspname = 'private')
        <> (SELECT oid FROM pg_roles WHERE rolname = 'postgres') THEN
    RAISE EXCEPTION 'Review private schema ownership before creating lot protection';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.products'::regclass
      AND a.attname = 'id' AND a.atttypid <> 'text'::regtype
  ) OR EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.products'::regclass
      AND a.attname = 'quantity' AND a.atttypid <> 'integer'::regtype
  ) OR EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.order_items'::regclass
      AND a.attname = 'id' AND a.atttypid <> 'bigint'::regtype
  ) OR EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.orders'::regclass
      AND a.attname = 'id' AND a.atttypid <> 'text'::regtype
  ) THEN
    RAISE EXCEPTION 'Unexpected key or quantity column type';
  END IF;
  IF EXISTS (SELECT 1 FROM public.products WHERE quantity < 0) THEN
    RAISE EXCEPTION 'Cannot create lots while products has a negative quantity';
  END IF;
  IF to_regclass('public.product_lots') IS NOT NULL
     OR to_regclass('public.order_item_lot_allocations') IS NOT NULL
     OR to_regclass('public.lot_stock_movements') IS NOT NULL THEN
    RAISE EXCEPTION 'Lot foundation relations already exist; inspect before reapplying';
  END IF;
END;
$preflight$;

ALTER TABLE public.products
  ADD COLUMN is_perishable boolean NOT NULL DEFAULT false;

CREATE TABLE public.product_lots (
  id bigint GENERATED ALWAYS AS IDENTITY
    (SEQUENCE NAME public.product_lots_id_seq) PRIMARY KEY,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  lot_code text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_on date NULL,
  initial_quantity integer NOT NULL,
  available_quantity integer NOT NULL,
  is_legacy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT product_lots_code_not_blank_ck
    CHECK (btrim(lot_code) <> ''),
  CONSTRAINT product_lots_initial_quantity_ck
    CHECK (initial_quantity >= 0),
  CONSTRAINT product_lots_available_quantity_ck
    CHECK (available_quantity >= 0),
  -- Technical migration lots deliberately have no invented expiry date.
  CONSTRAINT product_lots_legacy_expiry_ck
    CHECK (NOT is_legacy OR expires_on IS NULL),
  CONSTRAINT product_lots_product_code_key UNIQUE (product_id, lot_code)
);

CREATE INDEX product_lots_fefo_fifo_idx
  ON public.product_lots (product_id, expires_on ASC NULLS LAST, received_at ASC, id ASC)
  WHERE available_quantity > 0;

CREATE TABLE public.order_item_lot_allocations (
  id bigint GENERATED ALWAYS AS IDENTITY
    (SEQUENCE NAME public.order_item_lot_allocations_id_seq) PRIMARY KEY,
  order_item_id bigint NOT NULL
    REFERENCES public.order_items(id) ON DELETE RESTRICT,
  lot_id bigint NOT NULL REFERENCES public.product_lots(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  allocated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  released_at timestamptz NULL,

  CONSTRAINT order_item_lot_allocations_quantity_ck CHECK (quantity > 0),
  CONSTRAINT order_item_lot_allocations_release_time_ck
    CHECK (released_at IS NULL OR released_at >= allocated_at)
);

CREATE INDEX order_item_lot_allocations_order_item_idx
  ON public.order_item_lot_allocations (order_item_id, id);
CREATE INDEX order_item_lot_allocations_lot_idx
  ON public.order_item_lot_allocations (lot_id, id)
  WHERE released_at IS NULL;

CREATE TABLE public.lot_stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY
    (SEQUENCE NAME public.lot_stock_movements_id_seq) PRIMARY KEY,
  lot_id bigint NOT NULL REFERENCES public.product_lots(id) ON DELETE RESTRICT,
  allocation_id bigint NULL
    REFERENCES public.order_item_lot_allocations(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  delta integer NOT NULL,
  previous_quantity integer NOT NULL,
  new_quantity integer NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  request_id uuid NULL,

  CONSTRAINT lot_stock_movements_event_type_ck CHECK (event_type IN (
    'legacy_migration', 'receipt', 'manual_adjustment',
    'order_allocation', 'order_reversal', 'expired_output_override'
  )),
  CONSTRAINT lot_stock_movements_delta_ck CHECK (delta <> 0),
  CONSTRAINT lot_stock_movements_quantities_ck CHECK (
    previous_quantity >= 0
    AND new_quantity >= 0
    AND previous_quantity + delta = new_quantity
  ),
  CONSTRAINT lot_stock_movements_allocation_event_ck CHECK (
    (event_type IN ('order_allocation', 'order_reversal', 'expired_output_override'))
      = (allocation_id IS NOT NULL)
  )
);

CREATE INDEX lot_stock_movements_lot_chronological_idx
  ON public.lot_stock_movements (lot_id, occurred_at DESC, id DESC);
CREATE INDEX lot_stock_movements_request_idx
  ON public.lot_stock_movements (request_id, id)
  WHERE request_id IS NOT NULL;

-- All future lot mutations must pass through protected owner-owned RPCs.
ALTER TABLE public.product_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_lot_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_stock_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.product_lots,
  public.order_item_lot_allocations, public.lot_stock_movements
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE public.product_lots_id_seq,
  public.order_item_lot_allocations_id_seq, public.lot_stock_movements_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.prevent_lot_stock_movement_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000',
    MESSAGE = 'lot_stock_movements is append-only: UPDATE, DELETE and TRUNCATE are forbidden';
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION private.prevent_lot_stock_movement_changes()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER lot_stock_movements_prevent_update_delete
  BEFORE UPDATE OR DELETE ON public.lot_stock_movements
  FOR EACH STATEMENT EXECUTE FUNCTION private.prevent_lot_stock_movement_changes();
CREATE TRIGGER lot_stock_movements_prevent_truncate
  BEFORE TRUNCATE ON public.lot_stock_movements
  FOR EACH STATEMENT EXECUTE FUNCTION private.prevent_lot_stock_movement_changes();

-- The CTE creates one deterministic technical lot only for a product that has
-- no lots. RETURNING limits the companion movement to newly inserted lots.
WITH inserted_lots AS (
  INSERT INTO public.product_lots (
    product_id, lot_code, received_at, expires_on,
    initial_quantity, available_quantity, is_legacy
  )
  SELECT p.id, '__legacy_migration__', clock_timestamp(), NULL,
    p.quantity, p.quantity, true
  FROM public.products p
  WHERE p.quantity > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.product_lots l WHERE l.product_id = p.id
    )
  RETURNING id, available_quantity
)
INSERT INTO public.lot_stock_movements (
  lot_id, allocation_id, event_type, delta, previous_quantity, new_quantity, request_id
)
SELECT id, NULL, 'legacy_migration', available_quantity, 0, available_quantity, NULL
FROM inserted_lots;

-- Product quantity remains the aggregate API field. This migration refuses to
-- continue if pre-existing or future partial data would disagree with lots.
DO $aggregate_check$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products p
    LEFT JOIN public.product_lots l ON l.product_id = p.id
    GROUP BY p.id, p.quantity
    HAVING p.quantity <> COALESCE(sum(l.available_quantity), 0)
  ) THEN
    RAISE EXCEPTION 'Product aggregate quantity differs from available lot quantities';
  END IF;
END;
$aggregate_check$;

-- This foundation does not yet enforce perishable expiry or use allocations.
-- The next reviewed RPC migration must lock products/lots, preserve the
-- aggregate invariant, validate allocation sums, and prevent direct legacy
-- stock writers from bypassing lot changes.

COMMIT;
