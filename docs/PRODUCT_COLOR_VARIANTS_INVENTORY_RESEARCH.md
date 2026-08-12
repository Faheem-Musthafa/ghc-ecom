# Product color variants, identifiers, and inventory

Research date: 2026-08-11

## Recommended decision

Model a catalogue item and its sellable versions separately:

- A **product** is the shared customer-facing grouping: title, description, brand,
  category, and common media.
- A **variant** is one exact sellable option combination, such as `Black`, or
  `Black / Large`. Every variant has an immutable internal ID, a unique SKU, its
  own price/media overrides when needed, and its own stock.
- A **barcode/GTIN** is a machine-readable trade-item identifier. It is not a
  human-facing alias and must not be renamed or repurposed as one.
- An **alias** is an additional human-facing or legacy lookup name. Store aliases
  separately from both SKU and barcode.

This matches established commerce models. Shopify defines color and size choices
as product variants, supports inventory per variant, and describes the variant as
the link between merchandising, price, inventory, fulfillment, and channels
([Shopify variants](https://help.shopify.com/en/manual/products/variants),
[Shopify ProductVariant API](https://shopify.dev/docs/api/admin-graphql/latest/objects/ProductVariant)).
Google Merchant Center likewise requires every variant to be submitted as a
separate product ID while sharing an item-group ID
([Google item group ID](https://support.google.com/merchants/answer/6324507)).

## Repository-specific assessment

This repository already follows the core model:

- `ProductVariant` has a globally unique SKU and owns its price, active state,
  color attributes, images, cart references, reservations, and stock movements.
- `InventoryLevel` is unique by warehouse and variant, with separate `onHand`,
  `reserved`, and low-stock threshold values.
- Creating a variant creates a zero-stock inventory row in every warehouse, and
  creating a warehouse does the inverse for every existing variant.
- The storefront selects and checks stock for the exact color variant; the admin
  catalogue and inventory tools already work at variant/SKU level.

The project decision is to replace its existing flexible `barcode` field with an
optional globally unique `alias` on each variant. The migration renames the column
and rewrites checkout/order snapshot keys, preserving existing values while changing
their application meaning. Alias is available in catalogue editing, CSV
import/export, order snapshots, and inventory search.

If scanner or marketplace identifiers are needed later, add a new standards-aware
identifier model and do not export these aliases as GTINs. Other hardening
opportunities are moving from one alias to a one-to-many alias table if multiple
legacy codes become necessary, and modeling damaged/safety-stock/quality-control
quantities if warehouse operations require those states.

## Identity terms: do not merge these fields

| Field | Audience and purpose | Cardinality | Recommended rule |
| --- | --- | --- | --- |
| `variant.id` | Internal database/API identity | One per variant | Immutable UUID; use for carts, orders, and relations |
| `sku` | Merchant's internal stock-keeping code | One primary SKU per variant | Required and globally unique in this store |
| `gtin` / `barcode` | Scanner, retailer, marketplace, or 3PL trade-item identity | Zero or more identifiers per variant | Preserve as text, validate by scheme, and make normalized value unique |
| `alias` | Human or legacy search term, such as `Midnight`, `BLK`, or an old catalogue code | Zero or more per variant | Searchable; never claim it is a GTIN or send it as one |
| `color.name` | Customer-facing option value, such as `Midnight Black` | One selected color value per color-only variant | Reusable canonical value plus optional swatch metadata |

Shopify explicitly says SKUs are internal codes, that scanners normally read the
barcode field rather than the SKU, and that no two variants should have the same
SKU. Its example requires 12 SKUs for 3 sizes times 4 colors
([Shopify SKU guidance](https://help.shopify.com/en/manual/products/details/sku)).
It separately describes a barcode as a machine-readable identifier and requires a
unique barcode per variant for its fulfillment network
([Shopify fulfillment identifiers](https://help.shopify.com/en/manual/shipping/shopify-fulfillment-network/inventory-management)).

GS1 is stricter for standards-based retail identifiers: every style, color, and
size variation is a unique product and receives a unique GTIN
([GS1 GTIN decision support](https://www.gs1.org/1/gtinrules/en/decision-support/decision/1),
[GS1 size/color GTIN FAQ](https://support.gs1.org/support/solutions/articles/43000734083-how-many-gs1-gtins-do-i-need-when-i-have-a-product-with-many-sizes-and-colours-),
[GS1 GTIN Management Standard](https://www.gs1.org/sites/default/files/docs/barcodes/GS1_GTIN_Management_Standard.pdf)).
A barcode's bars are the scannable representation of the GTIN, and one GTIN may be
assigned to only one product, although it can appear on every physical unit of
that same product
([GS1: how GTINs and barcodes work](https://support.gs1.org/support/solutions/articles/43000734095-how-do-gs1-gtins-and-barcodes-work-)).

### What “rename barcode into alias” should mean

Do **not** perform a blind database rename from `barcode` to `alias`. First classify
the existing values:

1. If the value is a real UPC, EAN, or GTIN, keep it as a barcode/GTIN identifier.
2. If it is a private code printed in a scannable symbol, migrate it to an
   identifier with scheme `INTERNAL_BARCODE`; label it “Internal scan code” in the
   UI, not GTIN.
3. If it is merely a nickname or old catalogue lookup term, migrate it to a
   variant alias and label it “Alias.”

This classification prevents a human nickname from being exported in a marketplace
barcode field or used by a 3PL as if it were a globally unique trade identifier.
Shopify's product CSV, for example, treats SKU as the variant's inventory code and
Barcode as its UPC/EAN/ISBN value
([Shopify product CSV fields](https://help.shopify.com/en/manual/products/import-export/using-csv)).

## Recommended logical data model

The names below are conceptual; implementation can follow the repository's naming
conventions.

```text
Product
  id
  title, description, brand, category, status
  common media and attributes
  has many ProductVariant

ProductOption
  id, productId, name                  # Color, Size, Material

ProductOptionValue
  id, optionId, displayName, slug
  swatchHex?, swatchImageUrl?, sortOrder

ProductVariant
  id, productId
  sku
  price, compareAtPrice?, cost?
  status, trackInventory, allowBackorder
  weight/dimensions and variant media
  has selected option values

VariantIdentifier
  id, variantId
  scheme                               # GTIN_8, UPC_A/GTIN_12, EAN_13/GTIN_13,
                                       # GTIN_14, INTERNAL_BARCODE, SUPPLIER_CODE
  displayValue, normalizedValue
  isPrimary, activeFrom?, activeTo?

VariantAlias
  id, variantId
  alias, normalizedAlias
  kind                                 # display, legacy, supplier, search
  locale?, isActive

InventoryBalance
  variantId, locationId
  onHand, committed, reserved, damaged, safetyStock, qualityControl
  version, updatedAt

InventoryMovement
  id, variantId, locationId
  state, delta, reason
  referenceType, referenceId, idempotencyKey, actorId, createdAt
```

For a color-only catalogue, enforce one variant for each `(product, color)` pair.
If size or another option is added later, enforce uniqueness of the complete sorted
option-value combination rather than only `(product, color)`. Google requires every
combination in one variant group to be unique, and expects its color, price,
availability, image, and landing-page selection to agree
([Google item group ID requirements](https://support.google.com/merchants/answer/6324507),
[Google color attribute](https://support.google.com/merchants/answer/6324487)).

### Database invariants

- `ProductVariant.sku` is non-empty and globally unique after case normalization.
- A variant option combination is unique within its product.
- A normalized scanner identifier is unique across active variants. Do not allow
  one scan to resolve to two sellable variants.
- An alias is optional descriptive text and is not an identifier; duplicate alias
  names are allowed and operational lookups use the globally unique SKU instead.
- Inventory balances are unique by `(variantId, locationId)` and quantities cannot
  become negative unless the explicit backorder policy allows sale below zero.
- Every inventory change creates an immutable movement/audit record with an
  idempotency key.
- Carts and orders reference `variant.id`, never only `product.id`, color text,
  barcode, alias, or SKU. Order lines also snapshot SKU, option labels, price, and
  tax-relevant facts so later catalogue edits do not rewrite order history.

PostgreSQL unique constraints/indexes are the correct enforcement mechanism for
identifier uniqueness
([PostgreSQL unique indexes](https://www.postgresql.org/docs/current/indexes.html)).
For checkout or reservation updates, lock the affected inventory row in the same
transaction before checking and decrementing availability; PostgreSQL documents
that `SELECT ... FOR UPDATE` locks selected rows against concurrent updates
([PostgreSQL locking clauses](https://www.postgresql.org/docs/current/sql-select.html)).

### GTIN storage and validation

- Store barcode values as strings, never numeric database types; leading zeroes
  can be meaningful.
- Preserve the entered representation for labels, and also compute a canonical
  comparison value.
- Validate the permitted length and GS1 check digit for identifiers declared as
  GTIN. Do not label an arbitrary internal number as a GTIN merely because it is
  numeric.
- For cross-format deduplication, compare GTIN-8, GTIN-12, and GTIN-13 in their
  zero-padded 14-digit canonical form. GS1 recommends 14-digit database storage,
  while warning that meaningful leading zeroes in GTIN-12 must be preserved
  ([GS1 database communication](https://www.gs1.org/edi-xml/technical-user-guide/Item_Numbers),
  [GS1 General Specifications](https://ref.gs1.org/standards/genspecs/?azure-portal=true)).
- Do not auto-generate purported GS1 GTINs without a number range assigned to the
  brand owner. An internal barcode may be generated under a separately named
  private scheme if the scanners and downstream integrations support it.

## Color representation and storefront behavior

Keep the merchant's customer-facing color name exactly as sold, for example
`Toasted Walnut`, instead of silently replacing it with `Brown`. A separate optional
normalized family such as `brown` can support filters. Google explicitly requires
the submitted color to match the landing-page value and permits unique color names
([Google color guidance](https://support.google.com/merchants/answer/6324487)).

Recommended color fields are:

- `displayName`: exact storefront/merchant name.
- `slug`: stable URL-safe value.
- `family`: optional normalized filter family such as `black` or `brown`.
- `swatchHex`: optional UI approximation only; it must not replace photographs.
- `swatchImage` or texture: useful for wood, fabric, stone, or multicolor finishes.
- Variant-specific primary image and gallery.
- `sortOrder` and active status.

The product page should select an exact variant. When color changes, update its
image, SKU, price if different, availability, quantity limit, delivery promise, and
URL state. Google supports either single-page variant selectors or separate variant
pages, but the structured data must represent the grouping and exact variant
([Google product variant structured data](https://developers.google.com/search/docs/appearance/structured-data/product-variants)).

An API response can expose the distinction directly:

```json
{
  "id": "product-uuid",
  "title": "Arden Chair",
  "options": [{ "name": "Color", "values": ["Walnut", "Black"] }],
  "variants": [
    {
      "id": "variant-walnut-uuid",
      "options": { "Color": "Walnut" },
      "sku": "ARD-CHR-WAL",
      "primaryBarcode": "08912345678905",
      "aliases": ["Natural Walnut", "WAL"],
      "available": 8
    },
    {
      "id": "variant-black-uuid",
      "options": { "Color": "Black" },
      "sku": "ARD-CHR-BLK",
      "primaryBarcode": "08912345678912",
      "aliases": ["Midnight", "BLK"],
      "available": 3
    }
  ]
}
```

The example identifiers illustrate shape only; they are not numbers to use in
production.

## Stock model and workflows

Stock belongs to the exact variant and location. Never keep one writable product
quantity and try to divide it among colors in application code. Product-level stock
is a derived display value, such as the sum of sellable quantities, and must not be
used to fulfill an order when the chosen color is unavailable.

Shopify models a one-to-one relationship from product variant to inventory item,
then one inventory level for every location stocking that item. Each level holds
quantities for that item at that location
([Shopify inventory object relationships](https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states)).
Its inventory states distinguish `on_hand`, `available`, `committed`, `reserved`,
`damaged`, `safety_stock`, and `quality_control`; `on_hand` is the sum of the
physical-location states and `available` is what may be sold
([Shopify inventory states](https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps)).

Use these workflows:

1. **Receipt:** add stock to the exact variant and location with a purchase-order
   reference.
2. **Cart:** check availability for messaging, but do not permanently decrement it.
3. **Checkout/order placement:** atomically lock or compare-and-swap the exact
   variant-location balance, verify available quantity, and move the quantity to
   committed/reserved state. Use an idempotency key so payment or webhook retries
   cannot double-decrement.
4. **Cancellation/payment expiry:** release committed/reserved quantity back to
   available.
5. **Fulfillment:** remove committed units from on-hand inventory for the same
   variant actually shipped.
6. **Return:** receive the exact variant; move it to quality control first when the
   condition is unknown, then to available or damaged.
7. **Correction/stocktake:** record a reasoned adjustment instead of overwriting a
   quantity without history.

`available` should be derived consistently from the state model rather than being
mutated independently in multiple modules. A practical formula is:

```text
available = onHand - committed - reserved - damaged - safetyStock - qualityControl
```

If the application stores `available` for fast reads, update it in the same database
transaction and retain the movement ledger as the audit trail.

## SKU policy for colors

Every color gets a different SKU. A readable pattern is acceptable if it remains
stable and unique, for example:

```text
ARD-CHR-WAL
ARD-CHR-BLK
ARD-CHR-OAK
```

Use a controlled abbreviation dictionary (`BLK` always means black), avoid spaces
and ambiguous characters, and do not recycle an old SKU for a different variant.
Do not make application joins depend on parsing the SKU; the suffix is for people,
while `variant.id` is the durable relation key. Shopify recommends short,
consistent, unique SKUs and specifically calls out color-based SKU differentiation
([Shopify SKU best practices](https://help.shopify.com/en/manual/products/details/sku)).

Changing a display color name must not automatically change the SKU or GTIN. SKU
changes can disrupt fulfillment integrations, and Shopify warns not to change a SKU
after submitting the product to its fulfillment network
([Shopify fulfillment identifiers](https://help.shopify.com/en/manual/shipping/shopify-fulfillment-network/inventory-management)).

## Marketplace and SEO export

- Export one record per exact variant, with a unique item ID, SKU, color, price,
  availability, image, and GTIN when one legitimately exists.
- Give all variants of the same product a common group ID; never reuse that group ID
  for another product.
- Make the landing page preselect the exported variant, whether by query parameter
  or a variant URL.
- Emit `ProductGroup` / `Product` structured data with `variesBy`, `hasVariant`, and
  `productGroupID` as appropriate
  ([Google product variant structured data](https://developers.google.com/search/docs/appearance/structured-data/product-variants)).
- Do not export aliases in `gtin`, `mpn`, or barcode fields. Export an alias only to
  a destination field whose contract explicitly supports that alias type.

## Safe migration sequence

1. Add variant identity and option-value structures without removing existing
   product fields.
2. Create one default variant for every legacy product; then split products that
   already represent multiple colors into exact color variants.
3. Assign a unique SKU to every variant and resolve duplicates before adding the
   database uniqueness constraint.
4. Inventory all existing `barcode` values and classify them as valid GTIN/UPC/EAN,
   private scanner codes, aliases, or invalid/unknown values. Preserve the raw value
   and migration decision for audit.
5. Move legitimate scan identifiers to `VariantIdentifier`; move only true human or
   legacy names to `VariantAlias`.
6. Backfill inventory balances per variant and location. Reconcile their total to a
   physical stocktake or an agreed legacy snapshot.
7. Change cart, wishlist where relevant, order lines, returns, adjustments,
   fulfillment, and marketplace feeds to use `variant.id`.
8. Add unique/check constraints after the data is clean.
9. Cut reads to the variant model, monitor unresolved barcode/alias searches and
   inventory reconciliation, then retire legacy product-level quantity fields.

Do not silently split one product-level quantity equally across colors; there is no
evidence that such an allocation matches physical stock. Require a merchant count or
import per color.

## Acceptance tests

- Creating `Black` and `Walnut` variants under one product requires two different
  SKUs and produces two independent stock balances.
- Ordering the last black unit makes black unavailable without affecting walnut.
- Two simultaneous attempts to buy the last unit cannot both succeed.
- Scanning a GTIN resolves exactly one variant; scanning an internal code does not
  get exported as a GTIN.
- Searching an alias can find its variant, but an ambiguous alias returns a choice
  or validation error rather than silently selecting one.
- Renaming `Midnight Black` to `Onyx Black` does not change variant ID, SKU, GTIN,
  existing order snapshots, or stock.
- A cancelled or expired order releases the exact color that it reserved.
- A returned black item cannot increase walnut stock.
- Feed exports contain one row per color variant with one shared product-group ID.
- Invalid GTIN lengths/check digits and duplicate normalized GTINs are rejected.

## Final project decision

Implement **different SKU and stock per color variant** and replace the application's
current `barcode` field with **Alias**. Preserve existing stored values through a
column rename and snapshot-key migration. Treat the resulting values only as
human/legacy lookup aliases; if barcode/GTIN support is introduced later, implement
it as a separate standards-aware scanner identifier.
