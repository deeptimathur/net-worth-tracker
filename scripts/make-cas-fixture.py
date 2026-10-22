"""Generate a SYNTHETIC, password-protected CAS-style PDF for tests.

All names, ids and values are made up. Never commit a real statement.
Usage: python3 scripts/make-cas-fixture.py tests/fixtures/sample-cas.pdf
"""
import io
import sys

from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

PASSWORD = "ABCDE1234F"  # fake PAN-style password

rows = [
    ("CDSL Demat Account", "GROWW INVEST TECH PRIVATE LIMITED", "DP Id: 12088700 Client Id: 10004321", "12", "4,25,310.50"),
    ("CDSL Demat Account", "ANGEL ONE LIMITED", "DP Id: 12081600 Client Id: 10009876", "2", "1,250.00"),
    ("NSDL Demat Account", "ZERODHA BROKING LIMITED", "DP ID: IN303575 Client ID: 10005555", "5", "98,765.43"),
    ("Mutual Fund Folios", "8 Folios", "", "8", "7,10,000.25"),
]

buf = io.BytesIO()
c = canvas.Canvas(buf, pagesize=A4)
y = 800
c.setFont("Helvetica-Bold", 12)
c.drawString(40, y, "CONSOLIDATED ACCOUNT STATEMENT"); y -= 18
c.setFont("Helvetica", 9)
c.drawString(40, y, "CAS ID: XX000000  Statement for the period from 01-08-2026 to 31-08-2026"); y -= 14
c.drawString(40, y, "TEST INVESTOR  PAN: ABCDE1234F"); y -= 24
c.setFont("Helvetica-Bold", 10)
c.drawString(40, y, "YOUR CONSOLIDATED PORTFOLIO VALUE"); c.drawString(400, y, "` 12,35,326.18"); y -= 24
c.drawString(40, y, "Summary of value of holdings"); y -= 16
c.setFont("Helvetica", 8)
for h, x in [("Account Type", 40), ("Account Details", 150), ("No. of ISINs / Schemes", 380), ("Value in `", 480)]:
    c.drawString(x, y, h)
y -= 14
for kind, name, ids, count, value in rows:
    c.drawString(40, y, kind)
    c.drawString(150, y, name)
    c.drawString(380, y, count)
    c.drawRightString(550, y, value)
    if ids:
        y -= 11
        c.drawString(150, y, ids)
    y -= 16
c.drawString(40, y, "Total"); c.drawRightString(550, y, "12,35,326.18"); y -= 30
c.drawString(40, y, "Note: values are as on 31-08-2026."); c.showPage()

c.setFont("Helvetica", 8)
c.drawString(40, 800, "HOLDING STATEMENT AS ON 31-08-2026")
c.drawString(40, 785, "GROWW INVEST TECH PRIVATE LIMITED  DP Id: 12088700 Client Id: 10004321")
c.drawString(40, 770, "INE000A01010  EXAMPLE INDUSTRIES LTD  10.000  1,234.50  12,345.00")
c.drawString(40, 755, "Portfolio Value  4,25,310.50")
c.showPage()
c.save()

writer = PdfWriter(clone_from=PdfReader(io.BytesIO(buf.getvalue())))
writer.encrypt(user_password=PASSWORD, owner_password=None, algorithm="AES-256")
with open(sys.argv[1], "wb") as f:
    writer.write(f)
print("wrote", sys.argv[1])
