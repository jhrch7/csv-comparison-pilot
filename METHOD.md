# Method and output guide

The two inputs must have a header and the agreed key column. Non-key columns may differ. The original values stay in the outputs; comparison rules affect the key used for matching.

Blank keys and keys duplicated in either input are reviewed separately. They are not silently dropped or counted as a resolved match. Source record numbers start at 1 after the header and count CSV records, so a quoted field containing a newline remains one record.

## Output files

- `only_left.csv` and `only_right.csv`: unique unmatched rows with source-record and comparison-key metadata.
- `review.csv`: source, source-record number, reason, comparison key and the original row as JSON.
- `shared_keys.csv`: keys occurring exactly once on each side, with both source-record numbers.
- `value_changes.csv`, when selected columns are agreed: one row per changed cell on unique shared keys, with the column, before/after values and both source-record numbers. Every selected column must be present in both files; header order may differ. Keys needing review are not paired.
- `manifest.json`: source and output SHA-256 hashes, byte sizes, comparison rules, metadata-column names and counts.

A complete run exits successfully and includes a complete, parseable `manifest.json`, output files matching all its sizes and hashes, and balanced counts for each source. An output directory or manifest filename by itself is insufficient: a failed write can leave partial CSVs or an incomplete manifest.

The optional value summary separately counts shared keys checked, keys with changes, keys without selected changes and changed cells. Changed cells do not add to the source-row counts. A key with no selected changes does not mean the complete rows agree.

Output CSVs use UTF-8 with BOM. Formula-like cells are prefixed with an apostrophe to reduce spreadsheet formula execution risk. This changes their CSV text representation; original input files remain the authority for original values. Re-saving a CSV or stripping the prefix in a spreadsheet can remove that protection.

The default key comparison uses exact, case-sensitive strings. `trim` removes outer whitespace. `fold` applies Unicode NFKC normalization, collapses whitespace and case-folds, which can merge distinct original strings. These wider key rules need explicit agreement. Selected non-key values are always compared as exact decoded strings; no trimming, numeric, date or currency coercion is applied to them. There is no identity inference or fuzzy matching.

This is a bounded paid pilot using an existing tool, with scope and payment agreed before any order. The public sample documents its output; it does not establish a customer result or recurring income.
