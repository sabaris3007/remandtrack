"""
REMANDTRACK – PDF Generation Engine
Monochrome Indian Government / Subordinate Judiciary Standard PDF Engine.
Produces authentic black-and-white official court documents (orders, notices, and memos).
"""

import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.graphics.shapes import Drawing, Line
from reportlab.pdfbase import pdfmetrics

# ── Monochrome Govt Document Palette ───────────────────────────────────────────
BLACK      = colors.black
DARK_GREY  = colors.HexColor("#222222")
MID_GREY   = colors.HexColor("#666666")
LIGHT_GREY = colors.HexColor("#F2F2F2")
WHITE      = colors.white

TODAY = datetime.now().strftime("%d %B %Y")
TODAY_SHORT = datetime.now().strftime("%d/%m/%Y")

# ── Style Helpers ──────────────────────────────────────────────────────────────

def _make_styles():
    base = getSampleStyleSheet()
    custom = {}

    custom["emblem_header"] = ParagraphStyle(
        "emblem_header",
        fontName="Times-Bold",
        fontSize=11,
        leading=14,
        alignment=TA_CENTER,
        textColor=BLACK,
        spaceAfter=1,
    )
    custom["court_header"] = ParagraphStyle(
        "court_header",
        fontName="Times-Bold",
        fontSize=13,
        leading=17,
        alignment=TA_CENTER,
        textColor=BLACK,
        spaceAfter=2,
    )
    custom["doc_title"] = ParagraphStyle(
        "doc_title",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        alignment=TA_CENTER,
        textColor=BLACK,
        spaceAfter=3,
        spaceBefore=3,
    )
    custom["sub_title"] = ParagraphStyle(
        "sub_title",
        fontName="Times-Bold",
        fontSize=9.5,
        leading=12,
        alignment=TA_CENTER,
        textColor=BLACK,
        spaceAfter=2,
    )
    custom["section_head"] = ParagraphStyle(
        "section_head",
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=BLACK,
        spaceBefore=7,
        spaceAfter=2,
    )
    custom["body"] = ParagraphStyle(
        "body",
        fontName="Times-Roman",
        fontSize=9.5,
        leading=13.5,
        alignment=TA_JUSTIFY,
        textColor=BLACK,
        spaceAfter=3,
    )
    custom["body_bold"] = ParagraphStyle(
        "body_bold",
        fontName="Times-Bold",
        fontSize=9.5,
        leading=13.5,
        textColor=BLACK,
    )
    custom["label"] = ParagraphStyle(
        "label",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=BLACK,
    )
    custom["value"] = ParagraphStyle(
        "value",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=BLACK,
    )
    custom["small_center"] = ParagraphStyle(
        "small_center",
        fontName="Times-Roman",
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=BLACK,
    )
    custom["sig_label"] = ParagraphStyle(
        "sig_label",
        fontName="Times-Bold",
        fontSize=9,
        leading=12,
        textColor=BLACK,
    )
    custom["statute"] = ParagraphStyle(
        "statute",
        fontName="Times-Italic",
        fontSize=9,
        leading=12.5,
        alignment=TA_JUSTIFY,
        textColor=BLACK,
        spaceAfter=2,
    )
    custom["warning_box"] = ParagraphStyle(
        "warning_box",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=BLACK,
        alignment=TA_CENTER,
        spaceBefore=2,
        spaceAfter=2,
    )
    return custom


STYLES = _make_styles()

# ── Shared Builders ────────────────────────────────────────────────────────────

def _court_letterhead(court: str, judge: str):
    """Returns list of flowables for the authentic Indian court letterhead block."""
    items = [
        Paragraph("SUBORDINATE JUDICIARY OF INDIA", STYLES["emblem_header"]),
        Paragraph(f"IN THE COURT OF {court.upper()}", STYLES["court_header"]),
        Paragraph(f"PRESIDING OFFICER: {judge.upper()}", STYLES["sub_title"]),
        Paragraph("UNDER THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 (BNSS) / CrPC", STYLES["small_center"]),
        Spacer(1, 2*mm),
        HRFlowable(width="100%", thickness=1.5, color=BLACK, spaceAfter=1.5*mm),
        HRFlowable(width="100%", thickness=0.5, color=BLACK, spaceAfter=3*mm),
    ]
    return items


def _case_details_table(case: dict):
    """Returns a clean monochrome 2-column details table."""
    days = case.get("days_in_custody", case.get("custody_days", 0))
    max_d = case.get("max_sentence_days", case.get("maximum_sentence_days", 1095))
    pct = round((days / max_d) * 100, 1) if max_d else 0

    yrs = max_d // 365
    rem = max_d % 365
    max_sent_str = f"{yrs} Year(s)" + (f" {rem} Day(s)" if rem else "")

    prisoner_name = case.get("prisoner_name", case.get("accused_name", "Undertrial Prisoner"))
    fir_no = case.get("fir_no", case.get("docket_no", case.get("case_id", "N/A")))
    case_id = case.get("case_id", case.get("cnr_number", "N/A"))
    sections = case.get("sections", case.get("offence_section", "IPC / BNSS"))
    offence = case.get("offence", "Alleged Offence")
    arrest_date = case.get("date_of_arrest", case.get("remand_date", "N/A"))
    prison = case.get("prison", case.get("jail_location", "District Jail"))
    io_name = case.get("io_name", "Investigating Officer")
    io_rank = case.get("io_rank", "Inspector of Police")
    police_station = case.get("police_station", "Crime PS")

    data = [
        ["Accused / Undertrial:", prisoner_name, "Case / Docket No:", fir_no],
        ["CNR Number:", case_id, "Police Station:", police_station],
        ["Offence Sections:", sections, "Alleged Offence:", offence],
        ["Date of Remand / Arrest:", arrest_date, "Days in Custody:", f"{days} Days"],
        ["Jail / Prison Location:", prison, "Max Sentence:", max_sent_str],
        ["Investigating Officer:", f"{io_rank} {io_name}", "Custody Saturation:", f"{pct}% of Max"],
    ]

    col_widths = [40*mm, 55*mm, 38*mm, 48*mm]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("FONTNAME",   (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE",   (0,0), (-1,-1), 8),
        ("FONTNAME",   (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTNAME",   (2,0), (2,-1), "Helvetica-Bold"),
        ("TEXTCOLOR",  (0,0), (-1,-1), BLACK),
        ("BACKGROUND", (0,0), (0,-1), LIGHT_GREY),
        ("BACKGROUND", (2,0), (2,-1), LIGHT_GREY),
        ("GRID",       (0,0), (-1,-1), 0.5, BLACK),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",(0,0),(-1,-1), 4),
        ("RIGHTPADDING",(0,0),(-1,-1), 4),
        ("TOPPADDING", (0,0),(-1,-1), 2.5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 2.5),
    ]))
    return t


def _signature_block(judge: str, court: str):
    """3-column official black and white signature row with court seal box."""
    sig_data = [
        [
            Paragraph("<b>COURT SEAL</b><br/><br/>[Subordinate Judiciary]", STYLES["small_center"]),
            "",
            Paragraph(f"<b>{judge}</b><br/>Presiding Judicial Magistrate<br/>{court}", STYLES["sig_label"]),
        ]
    ]
    t = Table(sig_data, colWidths=[55*mm, 55*mm, 71*mm])
    t.setStyle(TableStyle([
        ("ALIGN",  (0,0), (0,0), "CENTER"),
        ("ALIGN",  (2,0), (2,0), "RIGHT"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("BOX",    (0,0), (0,0), 0.75, BLACK),
        ("LINEABOVE",(2,0),(2,0), 1, BLACK),
        ("LEFTPADDING",(0,0),(-1,-1), 4),
        ("RIGHTPADDING",(0,0),(-1,-1), 4),
        ("TOPPADDING", (0,0),(-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ]))
    return t


def _ref_no(doc_type: str, case_id: str) -> str:
    ts = datetime.now().strftime("%Y%m%d%H%M")
    clean_id = str(case_id).replace("/", "_").replace("-", "_")
    return f"CRT/{doc_type}/{clean_id}/{ts}"

# ══════════════════════════════════════════════════════════════════════════════
# TEMPLATE 1 – IO DELAY INQUIRY NOTICE (MONOCHROME)
# ══════════════════════════════════════════════════════════════════════════════

def generate_io_notice(case: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )

    story = []
    court = case.get("court", case.get("court_name", "Court of Judicial Magistrate"))
    judge = case.get("judge_name", "Judicial Magistrate - I")
    case_id = case.get("case_id", case.get("docket_no", "CR-001"))

    # ── Letterhead
    story += _court_letterhead(court, judge)

    # ── Document Title
    story.append(Paragraph("NOTICE TO INVESTIGATING OFFICER (SECTION 187 BNSS / S.167 CrPC)", STYLES["doc_title"]))
    story.append(Paragraph(
        f"<b>Ref. No.:</b> {_ref_no('IO-NOTICE', case_id)} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Date of Issue:</b> {TODAY}",
        STYLES["small_center"]
    ))
    story.append(Spacer(1, 3*mm))

    # ── Statutory Authority Box
    story.append(Paragraph("STATUTORY DIRECTIVE & TIMELINE MANDATE", STYLES["section_head"]))
    stat_data = [[Paragraph(
        "Section 187 of the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) / Section 167(2) CrPC "
        "mandates that the police report / chargesheet must be filed within <b>60 days</b> (or <b>90 days</b> for grave offences) "
        "from the date of initial remand. Non-compliance gives rise to statutory default-bail rights for the undertrial "
        "and requires immediate show-cause explanation from the Investigating Agency.",
        STYLES["statute"]
    )]]
    st = Table(stat_data, colWidths=[170*mm])
    st.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (0,0), LIGHT_GREY),
        ("BOX", (0,0), (0,0), 1, BLACK),
        ("LEFTPADDING", (0,0),(0,0), 6),
        ("RIGHTPADDING",(0,0),(0,0), 6),
        ("TOPPADDING",  (0,0),(0,0), 4),
        ("BOTTOMPADDING",(0,0),(0,0), 4),
    ]))
    story.append(st)
    story.append(Spacer(1, 3*mm))

    # ── Case Details
    story.append(Paragraph("CASE PARTICULARS & DETENTION RECORD", STYLES["section_head"]))
    story.append(_case_details_table(case))
    story.append(Spacer(1, 3*mm))

    # ── Delay Analysis
    days = case.get("days_in_custody", case.get("custody_days", 0))
    overdue = max(0, days - 60)
    story.append(Paragraph("INVESTIGATION DELAY STATUS", STYLES["section_head"]))
    alert_data = [
        ["Total Custody Elapsed:", f"{days} Days"],
        ["Statutory Time Limit (Sec 187 BNSS):", "60 Days / 90 Days"],
        ["Delay Beyond Window:", f"{overdue} Day(s) Overdue"],
        ["Police Report (Chargesheet) Status:", "PENDING / NOT FILED ON RECORD"],
    ]
    at = Table(alert_data, colWidths=[90*mm, 80*mm])
    at.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 8.5),
        ("TEXTCOLOR",(0,0), (-1,-1), BLACK),
        ("BACKGROUND", (0,0), (0,-1), LIGHT_GREY),
        ("GRID",(0,0),(-1,-1), 0.5, BLACK),
        ("LEFTPADDING",(0,0),(-1,-1), 5),
        ("TOPPADDING",(0,0),(-1,-1), 2.5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 2.5),
    ]))
    story.append(at)
    story.append(Spacer(1, 4*mm))

    # ── Notice Body
    story.append(Paragraph("SHOW CAUSE DIRECTIVE", STYLES["section_head"]))
    io_name = case.get("io_name", "Investigating Officer")
    io_rank = case.get("io_rank", "Inspector of Police")
    ps = case.get("police_station", "Jurisdictional Police Station")
    prisoner = case.get("prisoner_name", case.get("accused_name", "Accused"))
    fir = case.get("fir_no", case.get("docket_no", "FIR"))

    notice_paras = [
        f"<b>To:</b> {io_rank} {io_name}, {ps}",
        f"<b>Subject:</b> Show Cause Notice for Failure to Submit Final Police Report within Statutory Limit in Case No. {fir} (Accused: {prisoner})",
        f"1. This Court takes cognizance of the continuous undertrial detention of the accused <b>{prisoner}</b> for <b>{days} days</b> without the submission of the final police report under Section 193 BNSS / Section 173 CrPC.",
        f"2. You are hereby directed to submit the completed case diary and final investigation report before this Court within <b>7 (seven) working days</b> of receipt of this notice.",
        "3. Failure to comply shall lead to initiation of departmental reference to the Superintendent of Police and immediate judicial determination of statutory default bail.",
    ]

    for p in notice_paras:
        story.append(Paragraph(p, STYLES["body"]))
        story.append(Spacer(1, 1.5*mm))

    story.append(Spacer(1, 5*mm))
    story.append(_signature_block(judge, court))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "Copy to: (1) Superintendent of Police &nbsp;|&nbsp; (2) Jail Superintendent &nbsp;|&nbsp; (3) DLSA Secretary &nbsp;|&nbsp; (4) Case Record",
        STYLES["small_center"]
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ══════════════════════════════════════════════════════════════════════════════
# TEMPLATE 2 – DLSA LEGAL AID REFERRAL PACKET (MONOCHROME)
# ══════════════════════════════════════════════════════════════════════════════

def generate_dlsa_packet(case: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )

    story = []
    court = case.get("court", case.get("court_name", "Court of Judicial Magistrate"))
    judge = case.get("judge_name", "Judicial Magistrate - I")
    case_id = case.get("case_id", case.get("docket_no", "CR-001"))

    # ── Letterhead
    story += _court_letterhead(court, judge)

    # ── Title
    story.append(Paragraph("DISTRICT LEGAL SERVICES AUTHORITY (DLSA) REFERRAL", STYLES["doc_title"]))
    story.append(Paragraph("EXPEDITED LEGAL AID ASSIGNMENT & BAIL DIRECTIVE", STYLES["sub_title"]))
    story.append(Paragraph(
        f"<b>Ref. No.:</b> {_ref_no('DLSA-PACKET', case_id)} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Date:</b> {TODAY}",
        STYLES["small_center"]
    ))
    story.append(Spacer(1, 3*mm))

    # ── Statutory Basis
    story.append(Paragraph("CONSTITUTIONAL & STATUTORY MANDATE", STYLES["section_head"]))
    stat_data = [[Paragraph(
        "Under <b>Section 479(1) Proviso of BNSS 2023</b> and <b>Article 39A of the Constitution of India</b>, "
        "every indigent or unrepresented undertrial who has undergone one-third (first-time offender) or one-half "
        "of the maximum imprisonment is entitled to free legal aid defense and mandatory facilitation of personal bond bail.",
        STYLES["statute"]
    )]]
    st = Table(stat_data, colWidths=[170*mm])
    st.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(0,0), LIGHT_GREY),
        ("BOX",        (0,0),(0,0), 1, BLACK),
        ("LEFTPADDING",(0,0),(0,0), 6),
        ("RIGHTPADDING",(0,0),(0,0), 6),
        ("TOPPADDING", (0,0),(0,0), 4),
        ("BOTTOMPADDING",(0,0),(0,0), 4),
    ]))
    story.append(st)
    story.append(Spacer(1, 3*mm))

    # ── Case Details
    story.append(Paragraph("UNDERTRIAL PRISONER PARTICULARS", STYLES["section_head"]))
    story.append(_case_details_table(case))
    story.append(Spacer(1, 3*mm))

    # ── Referral Order Body
    story.append(Paragraph("JUDICIAL DIRECTION TO DLSA SECRETARY", STYLES["section_head"]))
    prisoner = case.get("prisoner_name", case.get("accused_name", "Undertrial"))
    prison = case.get("prison", case.get("jail_location", "District Jail"))
    days = case.get("days_in_custody", case.get("custody_days", 0))

    referral_paras = [
        f"<b>To:</b> The Secretary, District Legal Services Authority (DLSA)",
        f"<b>Subject:</b> Assignment of Legal Aid Defense Counsel for Undertrial: {prisoner} (Lodged at {prison})",
        f"1. The undertrial prisoner <b>{prisoner}</b> has undergone continuous custody of <b>{days} days</b> and is currently unrepresented.",
        "2. The Secretary, DLSA is hereby directed to assign a Legal Aid Defense Counsel / Panel Advocate within <b>48 hours</b>.",
        "3. The assigned counsel shall interact with the prisoner and submit appropriate bail / personal bond application under Section 479 BNSS on the next hearing date.",
    ]

    for p in referral_paras:
        story.append(Paragraph(p, STYLES["body"]))
        story.append(Spacer(1, 1.5*mm))

    # ── Checklist Table
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("DOCUMENTS ENCLOSED WITH THIS REFERRAL", STYLES["section_head"]))
    checklist = [
        ["[✓]", "Copy of Remand Order and Custody Certificate"],
        ["[✓]", "Offence Section Summary & Nominal Roll Extract"],
        ["[✓]", "Form 3 Statutory Bail Draft Sheet"],
    ]
    ct = Table(checklist, colWidths=[10*mm, 160*mm])
    ct.setStyle(TableStyle([
        ("FONTNAME",(0,0),(-1,-1),"Helvetica"),
        ("FONTSIZE",(0,0),(-1,-1),8.5),
        ("TEXTCOLOR",(0,0),(-1,-1),BLACK),
        ("LEFTPADDING",(0,0),(-1,-1),4),
        ("TOPPADDING",(0,0),(-1,-1),2),
        ("BOTTOMPADDING",(0,0),(-1,-1),2),
        ("GRID",(0,0),(-1,-1),0.4, BLACK),
    ]))
    story.append(ct)

    story.append(Spacer(1, 5*mm))
    story.append(_signature_block(judge, court))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "Copy to: (1) DLSA Secretary &nbsp;|&nbsp; (2) Jail Superintendent &nbsp;|&nbsp; (3) Case Record",
        STYLES["small_center"]
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ══════════════════════════════════════════════════════════════════════════════
# TEMPLATE 3 – JUDICIAL REVIEW ORDER SHEET (MONOCHROME)
# ══════════════════════════════════════════════════════════════════════════════

def generate_judicial_memo(case: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )

    story = []
    court = case.get("court", case.get("court_name", "Court of Judicial Magistrate"))
    judge = case.get("judge_name", "Judicial Magistrate - I")
    case_id = case.get("case_id", case.get("docket_no", "CR-001"))

    # ── Letterhead
    story += _court_letterhead(court, judge)

    # ── Title
    story.append(Paragraph("JUDICIAL ORDER SHEET & STATUTORY COMPLIANCE MEMO", STYLES["doc_title"]))
    story.append(Paragraph("UNDER SECTION 479 BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 / ART. 21", STYLES["sub_title"]))
    story.append(Paragraph(
        f"<b>Order No.:</b> {_ref_no('JUDICIAL-ORDER', case_id)} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Date of Proceeding:</b> {TODAY}",
        STYLES["small_center"]
    ))
    story.append(Spacer(1, 3*mm))

    # ── Alert Banner Box
    days = case.get("days_in_custody", case.get("custody_days", 0))
    max_d = case.get("max_sentence_days", case.get("maximum_sentence_days", 1095))
    pct = round((days / max_d) * 100, 1) if max_d else 0

    banner_text = f"STATUTORY COMPLIANCE AUDIT: {days} DAYS CUSTODY SERVED ({pct}% OF MAXIMUM SENTENCE {max_d} DAYS)"
    alert_data = [[Paragraph(f"<b>{banner_text}</b>", STYLES["warning_box"])]]
    alert_t = Table(alert_data, colWidths=[170*mm])
    alert_t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(0,0), LIGHT_GREY),
        ("BOX",(0,0),(0,0), 1.5, BLACK),
        ("LEFTPADDING",(0,0),(0,0), 6),
        ("RIGHTPADDING",(0,0),(0,0), 6),
        ("TOPPADDING",(0,0),(0,0), 4),
        ("BOTTOMPADDING",(0,0),(0,0), 4),
    ]))
    story.append(alert_t)
    story.append(Spacer(1, 3*mm))

    # ── Case Particulars
    story.append(Paragraph("CASE PARTICULARS & CUSTODY RECORD", STYLES["section_head"]))
    story.append(_case_details_table(case))
    story.append(Spacer(1, 3*mm))

    # ── Saturation Matrix
    story.append(Paragraph("STATUTORY COMPLIANCE ASSESSMENT", STYLES["section_head"]))
    matrix_data = [
        ["Parameter", "Prescribed Statutory Limit", "Recorded Assessment"],
        ["Continuous Custody Duration", f"{max_d} Days Max Imprisonment", f"{days} Days Elapsed ({pct}%)"],
        ["Section 479(1) Half-Term Threshold", f"{max_d//2} Days Custody", "ELIGIBLE FOR BAIL REVIEW"],
        ["Article 21 Fundamental Liberty Review", "Disproportionate Incarceration Bar", "MANDATORY SCRUTINY TRIGGERED"],
    ]
    mt = Table(matrix_data, colWidths=[65*mm, 55*mm, 50*mm])
    mt.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0), LIGHT_GREY),
        ("TEXTCOLOR",(0,0),(-1,-1), BLACK),
        ("FONTNAME",(0,0),(-1,0), "Helvetica-Bold"),
        ("FONTNAME",(0,1),(0,-1), "Helvetica-Bold"),
        ("FONTSIZE",(0,0),(-1,-1), 8),
        ("GRID",(0,0),(-1,-1), 0.5, BLACK),
        ("LEFTPADDING",(0,0),(-1,-1), 4),
        ("TOPPADDING",(0,0),(-1,-1), 2.5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 2.5),
        ("ALIGN",(0,0),(-1,0), "CENTER"),
    ]))
    story.append(mt)
    story.append(Spacer(1, 3*mm))

    # ── Judicial Order Body
    story.append(Paragraph("JUDICIAL ORDER & RECORD OF PROCEEDINGS", STYLES["section_head"]))
    prisoner = case.get("prisoner_name", case.get("accused_name", "Undertrial"))
    prison = case.get("prison", case.get("jail_location", "Central Prison"))

    order_paras = [
        f"1. The detention record of undertrial <b>{prisoner}</b> produced before this Court reveals continuous custody of <b>{days} days</b>.",
        "2. In accordance with <b>Section 479 BNSS 2023</b> and the constitutional guidelines laid down by the Hon'ble Supreme Court of India in <i>Re: Policy Strategy for Grant of Bail (2022)</i>, continued detention without trial adjudication is subject to mandatory judicial review.",
        f"3. <b>Order:</b> The Superintendent of <b>{prison}</b> is directed to verify the nominal roll and submit custody certificate on the next date of hearing. The matter is posted for personal bond release scrutiny.",
    ]

    for p in order_paras:
        story.append(Paragraph(p, STYLES["body"]))
        story.append(Spacer(1, 1.5*mm))

    story.append(Spacer(1, 5*mm))
    story.append(_signature_block(judge, court))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "Copy to: (1) Superintendent of Prison &nbsp;|&nbsp; (2) Public Prosecutor &nbsp;|&nbsp; (3) DLSA Secretary &nbsp;|&nbsp; (4) Court Record",
        STYLES["small_center"]
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
