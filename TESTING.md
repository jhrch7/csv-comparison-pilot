# Report unpacker verification

The downloadable `report-unpacker.html` is the source: no build step or external JavaScript dependency is needed. Its MIT notice is embedded in the file. The paid pilot's price, input limits and agreement requirements are unchanged.

## Reproduce the local checks

From this repository with Node.js and Python installed:

```sh
node tests/check-unpacker.cjs
```

For independent ZIP verification, choose a new output directory on a temporary volume (the directory must not already exist):

```sh
node tests/check-unpacker.cjs --out-dir NEW_OUTPUT_DIRECTORY
python3 -B tests/check_zip.py NEW_OUTPUT_DIRECTORY
```

The Node checks execute the exact embedded core. They cover the five-file example, six-file UTF-8/BOM/CRLF content, wrapped messages, changed lengths, same-length changed content, malformed checksums, duplicate/unexpected/missing names, unsupported formats, incomplete JSON and multiple blocks. Python independently reads the resulting ZIP files, checks every byte and checksum, and rejects an intentionally altered stored byte through ZIP's CRC check.

The optional browser check launches only a fresh, disposable headless Chrome profile and this local HTML file:

```sh
node tests/check-browser.cjs --chrome CHROME_EXECUTABLE --work-dir NEW_WORK_DIRECTORY
```

It performs actual ZIP downloads, inspects named input/download accessibility nodes, checks changed-content errors, tests editing during checksum work and clearing during file reads, and inspects a 390-pixel layout. The created Chrome profile is removed after process exit. Small screenshots, downloads and a receipt remain in the chosen work directory. `--message-file` can supply an additional saved synthetic report message.

## Observed release checks

Release 1.0.0 was checked with Node.js 24.17.0, Python 3.14.6 and Chrome 156.0.8078.80 on macOS 26.5.2. Two previously verified synthetic email bodies were reused without sending or reading another message: a five-file example and a six-file report from 1,000 combined CSV records / 200,000 input bytes. The latter message body was 113,572 bytes. Both browser-downloaded archives restored all files byte-for-byte; the five core-generated archives also passed Python interoperability checks. Desktop and narrow-layout screenshots were inspected. No HTTP(S) request from the tool document or uncaught browser exception was observed in those interactions.

This is automated browser recovery of preserved synthetic content. It does not establish a customer order, human usability result, new email-provider delivery, raw-MIME decoding, Safari/phone support or acceptance of any paid work. The report files themselves are unchanged; the unpacker does not recalculate the comparison or decide whether the records represent the same entity.

## References inspected

- [Existing inline bundle format and synthetic reports](examples/report): `csv-report-inline-utf8-json-v1`, the five standard names and optional `value_changes.csv`.
- [MDN SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest): SHA-256 on encoded bytes and the secure-context requirement. Unsupported contexts are rejected rather than bypassing checksum verification.
- [MDN Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob): UTF-8 file text, byte arrays and object URLs.
- [PKWARE APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT), sections 4.3.7, 4.3.12, 4.3.16 and 4.4.1: little-endian local/central headers and end record. Archives use stored method 0, ASCII report names and deterministic 1980-01-01 archive timestamps; the original file bytes are preserved.
