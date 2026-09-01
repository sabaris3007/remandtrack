"""Quick API verification test for REMANDTRACK Module 4."""
import urllib.request, json, os, sys

base = "http://127.0.0.1:8000"

# 1. Health check
try:
    with urllib.request.urlopen(f"{base}/healthz") as r:
        print("HEALTH:", json.loads(r.read()))
except Exception as e:
    print("HEALTH FAIL:", e); sys.exit(1)

# 2. List cases
with urllib.request.urlopen(f"{base}/api/cases") as r:
    data = json.loads(r.read())
    print("TOTAL CASES:", data["total"])
    print("SUMMARY:", data["summary"])

# 3. Generate IO Notice
req = urllib.request.Request(
    f"{base}/api/generate/io-notice",
    data=json.dumps({"case_id": "RC-2024-001"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as r:
    pdf = r.read()
    cd = r.headers.get("Content-Disposition", "")
    print(f"IO NOTICE  => {len(pdf):,} bytes | {cd}")
with open("test_io_notice.pdf", "wb") as f:
    f.write(pdf)

# 4. Generate DLSA Packet
req2 = urllib.request.Request(
    f"{base}/api/generate/dlsa-packet",
    data=json.dumps({"case_id": "RC-2024-006"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req2) as r:
    pdf2 = r.read()
    cd2 = r.headers.get("Content-Disposition", "")
    print(f"DLSA PACKET => {len(pdf2):,} bytes | {cd2}")
with open("test_dlsa_packet.pdf", "wb") as f:
    f.write(pdf2)

# 5. Generate Judicial Memo
req3 = urllib.request.Request(
    f"{base}/api/generate/judicial-memo",
    data=json.dumps({"case_id": "RC-2024-011"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req3) as r:
    pdf3 = r.read()
    cd3 = r.headers.get("Content-Disposition", "")
    print(f"JUDICIAL MEMO => {len(pdf3):,} bytes | {cd3}")
with open("test_judicial_memo.pdf", "wb") as f:
    f.write(pdf3)

print()
print("ALL PDF SIZES:")
for fname in ["test_io_notice.pdf", "test_dlsa_packet.pdf", "test_judicial_memo.pdf"]:
    print(f"  {fname}: {os.path.getsize(fname):,} bytes")

print()
print("ALL TESTS PASSED — 3/3 PDF templates generated successfully.")
