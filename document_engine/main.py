"""
REMANDTRACK – FastAPI Application
Module 4: 1-Click Judicial Document & Notice Generator
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from mock_data import CASES, CASES_BY_ID
from pdf_engine import generate_io_notice, generate_dlsa_packet, generate_judicial_memo

app = FastAPI(
    title="REMANDTRACK – Judicial Document Engine",
    description="Module 4: 1-Click Judicial Document & Notice Generator",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (frontend)
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ── Request model ─────────────────────────────────────────────────────────────

class CaseRequest(BaseModel):
    case_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_case_or_404(case_id: str) -> dict:
    case = CASES_BY_ID.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    return case


def pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    index_path = os.path.join(STATIC_DIR, "index.html")
    with open(index_path, encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/api/cases")
async def list_cases():
    """Return all mock undertrial cases grouped by alert type."""
    return {
        "total": len(CASES),
        "cases": CASES,
        "summary": {
            "IO_DELAY": sum(1 for c in CASES if c["alert_type"] == "IO_DELAY"),
            "DLSA_REQUIRED": sum(1 for c in CASES if c["alert_type"] == "DLSA_REQUIRED"),
            "SATURATION": sum(1 for c in CASES if c["alert_type"] == "SATURATION"),
        }
    }


@app.post("/api/generate/io-notice")
async def generate_io_notice_pdf(req: CaseRequest):
    """Generate IO Delay Inquiry Notice (Template 1) — S.167(2) CrPC."""
    case = get_case_or_404(req.case_id)
    if case["alert_type"] != "IO_DELAY":
        raise HTTPException(
            status_code=400,
            detail=f"Case {req.case_id} is not an IO_DELAY alert. Alert type: {case['alert_type']}"
        )
    pdf_bytes = generate_io_notice(case)
    filename = f"IO_Delay_Notice_{req.case_id.replace('-', '_')}.pdf"
    return pdf_response(pdf_bytes, filename)


@app.post("/api/generate/dlsa-packet")
async def generate_dlsa_packet_pdf(req: CaseRequest):
    """Generate DLSA Legal Aid Assignment Packet (Template 2) — S.12 LSA Act."""
    case = get_case_or_404(req.case_id)
    if case["alert_type"] != "DLSA_REQUIRED":
        raise HTTPException(
            status_code=400,
            detail=f"Case {req.case_id} is not a DLSA_REQUIRED alert. Alert type: {case['alert_type']}"
        )
    pdf_bytes = generate_dlsa_packet(case)
    filename = f"DLSA_Packet_{req.case_id.replace('-', '_')}.pdf"
    return pdf_response(pdf_bytes, filename)


@app.post("/api/generate/judicial-memo")
async def generate_judicial_memo_pdf(req: CaseRequest):
    """Generate Judicial Review Memo for Discharge/Personal Bond (Template 3) — S.436A CrPC."""
    case = get_case_or_404(req.case_id)
    if case["alert_type"] != "SATURATION":
        raise HTTPException(
            status_code=400,
            detail=f"Case {req.case_id} is not a SATURATION alert. Alert type: {case['alert_type']}"
        )
    pdf_bytes = generate_judicial_memo(case)
    filename = f"Judicial_Review_Memo_{req.case_id.replace('-', '_')}.pdf"
    return pdf_response(pdf_bytes, filename)


@app.get("/healthz")
async def health():
    return {"status": "ok", "module": "REMANDTRACK-Module4"}
