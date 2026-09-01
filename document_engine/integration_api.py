"""Thin HTTP adapter around the submitted Module 4 PDF engine.
The original pdf_engine.py is intentionally left unchanged."""
from fastapi import FastAPI
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .pdf_engine import generate_io_notice, generate_dlsa_packet, generate_judicial_memo

app = FastAPI(title="RemindTrack Module 4 Integration Adapter", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class CasePayload(BaseModel):
    case: dict

def normalize_case(c: dict) -> dict:
    return {
        "case_id": c.get("case_id") or c.get("docket_no") or "UNKNOWN",
        "prisoner_name": c.get("accused_name") or c.get("prisoner_name") or "Unknown",
        "age": c.get("age", 30),
        "fir_no": c.get("fir_no") or "Not available",
        "sections": c.get("sections") or c.get("offence_section") or "Not available",
        "offence": c.get("offence") or c.get("offence_section") or "Not available",
        "court": c.get("court_name") or c.get("court") or "Court of Judicial Magistrate",
        "judge_name": c.get("assigned_judge") or c.get("judge_name") or "Hon'ble Judicial Magistrate",
        "io_name": (c.get("assigned_io") or {}).get("name", "Investigating Officer"),
        "io_rank": "Investigating Officer",
        "police_station": c.get("police_station") or "Not available",
        "days_in_custody": int(c.get("custody_days") or c.get("days_in_custody") or 0),
        "max_sentence_days": int(c.get("maximum_sentence_days") or c.get("max_sentence_days") or 1095),
        "chargesheet_filed": bool(c.get("chargesheet_filed", False)),
        "legal_aid_assigned": c.get("representation_status") == "DLSA Appointed" or bool(c.get("has_counsel", False)),
        "legal_aid_advocate": ((c.get("assigned_dlsa_counsel") or {}).get("name") if isinstance(c.get("assigned_dlsa_counsel"), dict) else None),
        "date_of_arrest": c.get("remand_date") or "Not available",
        "prison": c.get("jail_location") or "Not available",
    }

@app.get("/healthz")
def health():
    return {"status": "ok", "module": "REMANDTRACK-Module4-Adapter"}

@app.post("/api/generate/io-notice")
def io_notice(req: CasePayload):
    case = normalize_case(req.case)
    return Response(content=generate_io_notice(case), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="IO_Delay_Notice_{case["case_id"].replace("-", "_")}.pdf"'})

@app.post("/api/generate/dlsa-packet")
def dlsa(req: CasePayload):
    case = normalize_case(req.case)
    return Response(content=generate_dlsa_packet(case), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="DLSA_Packet_{case["case_id"].replace("-", "_")}.pdf"'})

@app.post("/api/generate/judicial-memo")
def judicial_memo(req: CasePayload):
    case = normalize_case(req.case)
    return Response(content=generate_judicial_memo(case), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="Judicial_Review_Memo_{case["case_id"].replace("-", "_")}.pdf"'})
