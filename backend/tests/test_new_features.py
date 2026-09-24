"""Tests for new features: import/export leads, assignment, team invite with sales_executive."""
import io
import os
import uuid
import pytest
import requests
import pandas as pd
from pathlib import Path


def _load_env():
    p = Path("/app/frontend/.env")
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())


_load_env()
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

OWNER = {"email": "glennmuyskens78776@outlook.com", "password": "Admin@12345"}
CLIENT = {"email": "client@demo.com", "password": "Client@12345"}


@pytest.fixture(scope="module")
def owner_h():
    r = requests.post(f"{API}/auth/login", json=OWNER, timeout=15)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def client_h():
    r = requests.post(f"{API}/auth/login", json=CLIENT, timeout=15)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


# --- Export ---
def test_export_leads_xlsx(owner_h):
    r = requests.get(f"{API}/leads/export", headers=owner_h, timeout=30)
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert "spreadsheet" in ct or "excel" in ct
    # verify it's a valid xlsx: starts with PK
    assert r.content[:2] == b"PK"
    df = pd.read_excel(io.BytesIO(r.content))
    assert "name" in df.columns and "email" in df.columns
    assert "assigned_name" in df.columns


def test_export_forbidden_for_client(client_h):
    r = requests.get(f"{API}/leads/export", headers=client_h, timeout=15)
    assert r.status_code == 403


# --- Import ---
def _make_csv(rows):
    header = "Full Name,Email,Company,Phone,Lead Source,Budget"
    body = "\n".join(",".join(str(c) for c in row) for row in rows)
    return (header + "\n" + body).encode()


def test_import_leads_csv_smart_mapping_and_dedupe(owner_h):
    unique = uuid.uuid4().hex[:8]
    e1 = f"TESTimp1_{unique}@example.com"
    e2 = f"TESTimp2_{unique}@example.com"
    csv_bytes = _make_csv([
        [f"TEST Import One", e1, "AlphaCo", "+1 555 0001", "Website", "5000"],
        [f"TEST Import Two", e2, "BetaCo", "+1 555 0002", "Referral", "8000"],
    ])
    files = {"file": ("leads.csv", csv_bytes, "text/csv")}
    r = requests.post(f"{API}/leads/import", headers=owner_h, files=files, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created"] == 2
    assert data["skipped_duplicates"] == 0
    mapped = set(data["columns_mapped"])
    assert {"name", "email", "company", "phone", "source", "budget"}.issubset(mapped)

    # Re-import same file -> both should be duplicates
    files = {"file": ("leads.csv", csv_bytes, "text/csv")}
    r2 = requests.post(f"{API}/leads/import", headers=owner_h, files=files, timeout=30)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["created"] == 0
    assert d2["skipped_duplicates"] == 2

    # cleanup
    leads = requests.get(f"{API}/leads", headers=owner_h, timeout=15).json()
    for l in leads:
        if l.get("email") in (e1, e2):
            requests.delete(f"{API}/leads/{l['id']}", headers=owner_h, timeout=10)


def test_import_leads_xlsx(owner_h):
    unique = uuid.uuid4().hex[:6]
    df = pd.DataFrame([
        {"Full Name": "TEST Excel A", "Email": f"TESTxa_{unique}@ex.com", "Company": "XA", "Lead Source": "Google"},
        {"Full Name": "TEST Excel B", "Email": f"TESTxb_{unique}@ex.com", "Company": "XB", "Lead Source": "Ads"},
    ])
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        df.to_excel(w, index=False)
    buf.seek(0)
    files = {"file": ("leads.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r = requests.post(f"{API}/leads/import", headers=owner_h, files=files, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["created"] == 2
    # cleanup
    leads = requests.get(f"{API}/leads", headers=owner_h, timeout=15).json()
    for l in leads:
        if l.get("email", "").startswith(f"testxa_{unique}") or l.get("email", "").startswith(f"testxb_{unique}"):
            requests.delete(f"{API}/leads/{l['id']}", headers=owner_h, timeout=10)


def test_import_client_forbidden(client_h):
    files = {"file": ("x.csv", b"Name,Email\nX,x@y.com", "text/csv")}
    r = requests.post(f"{API}/leads/import", headers=client_h, files=files, timeout=15)
    assert r.status_code == 403


# --- Assignment ---
def test_assign_lead_owner(owner_h):
    # create lead
    r = requests.post(f"{API}/leads", json={"name": "TEST_Assignee", "email": f"TESTass_{uuid.uuid4().hex[:6]}@ex.com"}, headers=owner_h, timeout=15)
    assert r.status_code == 200
    lead = r.json()
    lid = lead["id"]
    # get team, pick self
    team = requests.get(f"{API}/team", headers=owner_h, timeout=15).json()
    owner = next(m for m in team if m["role"] == "owner")
    r = requests.post(f"{API}/leads/{lid}/assign", json={"user_id": owner["user_id"]}, headers=owner_h, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["assigned_to"] == owner["name"]
    # verify persisted
    g = requests.get(f"{API}/leads/{lid}", headers=owner_h, timeout=15).json()
    assert g["assigned_user_id"] == owner["user_id"]
    assert g["assigned_name"] == owner["name"]
    requests.delete(f"{API}/leads/{lid}", headers=owner_h, timeout=10)


def test_assign_lead_client_forbidden(client_h, owner_h):
    r = requests.post(f"{API}/leads", json={"name": "TEST_A2", "email": f"TESTass2_{uuid.uuid4().hex[:6]}@ex.com"}, headers=owner_h, timeout=15)
    lid = r.json()["id"]
    team = requests.get(f"{API}/team", headers=owner_h, timeout=15).json()
    r2 = requests.post(f"{API}/leads/{lid}/assign", json={"user_id": team[0]["user_id"]}, headers=client_h, timeout=15)
    assert r2.status_code == 403
    requests.delete(f"{API}/leads/{lid}", headers=owner_h, timeout=10)


def test_update_lead_sets_assigned_name(owner_h):
    r = requests.post(f"{API}/leads", json={"name": "TEST_A3", "email": f"TESTass3_{uuid.uuid4().hex[:6]}@ex.com"}, headers=owner_h, timeout=15)
    lid = r.json()["id"]
    team = requests.get(f"{API}/team", headers=owner_h, timeout=15).json()
    owner = next(m for m in team if m["role"] == "owner")
    upd = requests.put(f"{API}/leads/{lid}", json={"assigned_user_id": owner["user_id"]}, headers=owner_h, timeout=15)
    assert upd.status_code == 200
    assert upd.json().get("assigned_name") == owner["name"]
    requests.delete(f"{API}/leads/{lid}", headers=owner_h, timeout=10)


# --- Team invite sales_executive ---
def test_invite_sales_executive(owner_h):
    email = f"TESTsalesexec_{uuid.uuid4().hex[:6]}@ex.com"
    r = requests.post(f"{API}/team", json={"name": "TEST Sales Exec", "email": email, "role": "sales_executive", "password": "Temp@1234"}, headers=owner_h, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "sales_executive"
    uid = r.json()["user_id"]
    # appears in team list
    team = requests.get(f"{API}/team", headers=owner_h, timeout=15).json()
    assert any(m["user_id"] == uid for m in team)
    # sales_exec can assign
    login = requests.post(f"{API}/auth/login", json={"email": email, "password": "Temp@1234"}, timeout=15)
    assert login.status_code == 200
    se_h = {"Authorization": f"Bearer {login.json()['token']}"}
    # create lead as owner, assign as sales_exec
    lr = requests.post(f"{API}/leads", json={"name": "TEST_forSE", "email": f"TESTfse_{uuid.uuid4().hex[:6]}@ex.com"}, headers=owner_h, timeout=15)
    lid = lr.json()["id"]
    ar = requests.post(f"{API}/leads/{lid}/assign", json={"user_id": uid}, headers=se_h, timeout=15)
    assert ar.status_code == 200, ar.text
    # cleanup
    requests.delete(f"{API}/leads/{lid}", headers=owner_h, timeout=10)
    requests.delete(f"{API}/team/{uid}", headers=owner_h, timeout=10)
