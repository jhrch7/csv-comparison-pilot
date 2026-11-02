# Method and output guide

The two inputs must have a header and the agreed key column. Non-key columns may differ. The original values stay in the outputs; comparison rules affect the key used for matching.

Blank keys and keys duplicated in either input are reviewed separately. They are not silently dropped or counted as a resolved match. Source record numbers start at 1 after the header and count CSV records, so a quoted field containing a newline remains one record.

## Output files

- `only_left.csv` and `only_right.csv`: unique unmatched rows with source-record and comparison-key metadata.
- `review.csv`: source, source-record number, reason, comparison key and the original row as JSON.
- `shared_keys.csv`: keys occurring exactly once on each side, with both source-record numbers.
- `manifest.json`: source and output SHA-256 hashes, byte sizes, comparison rules, metadata-column names and counts.

Output CSVs use UTF-8 with BOM. Formula-like cells are prefixed with an apostrophe to reduce spreadsheet formula execution risk. This changes their CSV text representation; original input files remain the authority for original values. Re-saving a CSV or stripping the prefix in a spreadsheet can remove that protection.

The default comparison uses exact, case-sensitive strings. `trim` removes outer whitespace. `fold` applies Unicode NFKC normalization, collapses whitespace and case-folds, which can merge distinct original strings. These wider rules need explicit agreement. There is no identity inference, fuzzy matching or comparison of non-key values.

This is a bounded paid pilot using an existing tool, with scope and payment agreed before any order. The public sample documents its output; it does not establish a customer result or recurring income.
