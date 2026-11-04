#!/usr/bin/env python3
"""Independently read the JavaScript-created ZIPs with Python's standard library."""
import argparse
import base64
import hashlib
import io
import json
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path, help='--out-dir used by check-unpacker.cjs')
args = parser.parse_args()
expected = json.loads((args.directory / 'EXPECTATIONS.json').read_text())
checks = []
for case in expected:
    raw = (args.directory / case['archive']).read_bytes()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        assert archive.namelist() == [entry['name'] for entry in case['files']]
        assert archive.testzip() is None
        for entry in case['files']:
            original = base64.b64decode(entry['base64'], validate=True)
            restored = archive.read(entry['name'])
            assert restored == original, entry['name']
            assert len(restored) == entry['bytes']
            assert hashlib.sha256(restored).hexdigest() == entry['sha256']
            assert archive.getinfo(entry['name']).compress_type == zipfile.ZIP_STORED
        checks.append({'archive': case['archive'], 'files': len(case['files']), 'bytes_equal': True})
# Independent negative control: an altered stored byte must fail ZIP's CRC check.
raw = bytearray((args.directory / expected[0]['archive']).read_bytes())
with zipfile.ZipFile(io.BytesIO(raw)) as archive:
    first = archive.infolist()[0]
    offset = first.header_offset
    name_len = int.from_bytes(raw[offset + 26:offset + 28], 'little')
    extra_len = int.from_bytes(raw[offset + 28:offset + 30], 'little')
    raw[offset + 30 + name_len + extra_len] ^= 1
try:
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        archive.read(first.filename)
except zipfile.BadZipFile:
    pass
else:
    raise AssertionError('The CRC negative control did not fail')
print(json.dumps({'zip_interoperability': checks, 'changed_byte_rejected_by_CRC': True}, indent=2))
