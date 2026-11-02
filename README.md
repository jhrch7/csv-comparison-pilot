# CSV comparison pilot

Compare two CSV exports by one agreed key and get a small, auditable difference report.

**Pilot enquiries: indicative A$40 total for up to 1,000 combined data rows.**
The final quote confirms scope, availability, turnaround and payment method before an order is accepted. One correction within the agreed comparison rules is included. This is an enquiry offer.

[Request a quote by email](mailto:jayos00001@gmail.com?subject=CSV%20comparison%20pilot).
Start with the two row counts, column headers and the key you want compared. Please wait for agreement before sending files.

## What you receive

- Rows with a unique key found only in the first file.
- Rows with a unique key found only in the second file.
- A separate review file for blank keys and every row affected by a duplicated key.
- A shared-key list, row counts, source hashes and output hashes.

The default comparison is exact and case-sensitive. Trimming or Unicode case-folding can be agreed explicitly. A shared key does not prove two records describe the same entity; non-key columns are not compared.

## Pilot limits

Use synthetic or non-sensitive catalogue-style CSV data. This pilot is unsuitable for confidential customer records, credentials, regulated data or high-stakes decisions. Files and results pass through email and an AI-assisted processing workflow. Keep your original files.

The pilot covers two UTF-8 CSV files with headers, one key column, at most 1,000 data rows combined and 200 KB combined. Live account access, scraping, enrichment, fuzzy identity matching and automatic changes to a source system are outside the scope.

## Inspect a real synthetic example

The [example inputs](examples) contain fictional names and `.example.test` email addresses. They were processed by the existing Local Row Check 1.0.0 command-line tool. The [generated reports](examples/report) are actual tool output, not a customer result or a claimed sale.

| Source | Input rows | Only in that source | Shared unique key | Needs review |
|---|---:|---:|---:|---:|
| Left | 5 | 1 | 1 | 3 |
| Right | 3 | 1 | 1 | 1 |

For each source: input = only + shared + review. Every duplicated-key group goes to review, including the matching row from the other source.

See [the method and output guide](METHOD.md) before requesting a quote. The sample was executed and its hashes and row counts checked. Processing uses AI-assisted tools.
