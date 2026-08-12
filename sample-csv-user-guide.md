# Catalogue CSV user guide

Use `sample.csv` as a safe starting point for catalogue imports. Its products are drafts, and the image columns are intentionally blank.

## Import the sample

1. Open the admin catalogue.
2. Select **Import CSV**.
3. Choose `sample.csv` and review the validation result.
4. Start the import, then review the new draft products before publishing them.
5. Set inventory for each exact option after import; inventory is not a CSV column.

## How rows work

Each row is one exact sellable combination. For example, Rain Blue · 350 ml · Pack of 4 has its own SKU, price, comparison price, active state, and inventory.

Keep `product_name`, `category_name`, `status`, `description`, and `material` identical on every row belonging to the same product. Give every row a unique SKU.

- `size` is optional text such as `250 ml`, `Medium`, or `Large`.
- `pack_quantity` is optional, but when supplied it must be a positive whole number.
- Prices are entered in rupees without a currency symbol, such as `1299` or `1299.50`.
- `compare_at_price_rupees` may be blank, but it cannot be lower than `price_rupees`.
- `is_active` accepts `TRUE` or `FALSE`.
- New category names may be created during import.

## Add reusable images

Only public Google Drive file links are accepted. Use `|` between multiple links in the same cell.

- Product-wide image: put the link in `shared_google_drive_image_links`. It only needs to appear on one row for that product.
- Colour-wide image: repeat the same link in `option_google_drive_image_links` on every row for that colour. The importer downloads it once and associates it with all those options.
- Exact-option image: put the link only on the row for that exact colour, size, and pack combination.

Example colour-wide assignment: paste one Rain Blue Drive link into `option_google_drive_image_links` for all four Rain Blue mug rows. Do the same with a different image link for all four Clay Rose rows.

## Before importing your own data

- Keep the header row unchanged.
- Save the file as UTF-8 CSV.
- Check that SKUs contain only letters, numbers, dots, underscores, or hyphens.
- Use a six-digit colour value such as `#517C96`.
- Use `DRAFT` while reviewing new products; change to `PUBLISHED` only when the catalogue is ready for customers.
