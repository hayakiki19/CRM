"""Tests for iteration 3 new features: Lead->Deal, Deal->Client convert endpoints."""
import os
import uuid
import pytest
import requests
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


# --- Lead -> Deal conversion ---
def test_convert_lead_creates_qualified_deal(owner_h):
    unique = uuid.uuid4().hex[:6]
    # Create a lead with budget
    lead_payload = {
        "name": f"TEST Convert {unique}",
        "email": f"TESTconv_{unique}@ex.com",
        "company": "TESTConvCo",
        "budget": "$12,500",
    }
    r = requests.post(f"{API}/leads", json=lead_payload, headers=owner_h, timeout=15)
    assert r.status_code == 200, r.text
    lead = r.json()
    lid = lead["id"]

    # Convert
    rc = requests.post(f"{API}/leads/{lid}/convert", headers=owner_h, timeout=15)
    assert rc.status_code == 200, rc.text
    body = rc.json()
    assert "deal" in body
    deal = body["deal"]
    assert deal["stage"] == "Qualified"
    assert deal["value"] == 12500.0
    assert deal["lead_id"] == lid
    assert deal["company"] == "TESTConvCo"
    did = deal["id"]

    # Verify lead now converted
    g = requests.get(f"{API}/leads/{lid}", headers=owner_h, timeout=15).json()
    assert g.get("converted") is True
    assert g.get("deal_id") == did
    assert g.get("status") == "Qualified"

    # Verify deal exists in deals list
    dl = requests.get(f"{API}/deals", headers=owner_h, timeout=15).json()
    assert any(d["id"] == did for d in dl)

    # cleanup
    requests.delete(f"{API}/deals/{did}", headers=owner_h, timeout=10)
    requests.delete(f"{API}/leads/{lid}", headers=owner_h, timeout=10)


def test_convert_lead_forbidden_for_client(client_h, owner_h):
    unique = uuid.uuid4().hex[:6]
    r = requests.post(f"{API}/leads", json={"name": "TEST_C", "email": f"TESTc_{unique}@ex.com"}, headers=owner_h, timeout=15)
    lid = r.json()["id"]
    rc = requests.post(f"{API}/leads/{lid}/convert", headers=client_h, timeout=15)
    assert rc.status_code == 403
    requests.delete(f"{API}/leads/{lid}", headers=owner_h, timeout=10)


def test_convert_lead_not_found(owner_h):
    r = requests.post(f"{API}/leads/nonexistent-id/convert", headers=owner_h, timeout=15)
    assert r.status_code == 404


# --- Deal -> Client conversion ---
def test_convert_deal_creates_client_and_project(owner_h):
    unique = uuid.uuid4().hex[:6]
    # Create a deal
    deal_payload = {
        "title": f"TEST Deal {unique}",
        "company": f"TESTCompany_{unique}",
        "email": f"TESTdeal_{unique}@ex.com",
        "value": 25000,
        "stage": "Proposal",
    }
    r = requests.post(f"{API}/deals", json=deal_payload, headers=owner_h, timeout=15)
    assert r.status_code == 200, r.text
    deal = r.json()
    did = deal["id"]

    # Convert
    rc = requests.post(f"{API}/deals/{did}/convert", headers=owner_h, timeout=15)
    assert rc.status_code == 200, rc.text
    body = rc.json()
    # Should include client + project references
    assert "client" in body or "client_id" in body or "project" in body or "project_id" in body

    # Verify deal marked won/converted
    dl = requests.get(f"{API}/deals", headers=owner_h, timeout=15).json()
    d = next((x for x in dl if x["id"] == did), None)
    assert d is not None
    assert d.get("converted") is True

    # Verify a client was created for this company
    clients = requests.get(f"{API}/clients", headers=owner_h, timeout=15).json()
    matched_client = next((c for c in clients if c.get("company") == f"TESTCompany_{unique}" or c.get("name") == f"TESTCompany_{unique}"), None)
    assert matched_client is not None, f"No client found for TESTCompany_{unique}"

    # Verify a project exists
    projects = requests.get(f"{API}/projects", headers=owner_h, timeout=15).json()
    matched_project = next((p for p in projects if p.get("client_id") == matched_client.get("id") or p.get("deal_id") == did), None)
    assert matched_project is not None, "No project created from deal conversion"

    # cleanup
    if matched_project:
        requests.delete(f"{API}/projects/{matched_project['id']}", headers=owner_h, timeout=10)
    if matched_client:
        requests.delete(f"{API}/clients/{matched_client['id']}", headers=owner_h, timeout=10)
    requests.delete(f"{API}/deals/{did}", headers=owner_h, timeout=10)


def test_convert_deal_forbidden_for_client(client_h, owner_h):
    unique = uuid.uuid4().hex[:6]
    r = requests.post(f"{API}/deals", json={"title": "TEST_dc", "value": 100}, headers=owner_h, timeout=15)
    did = r.json()["id"]
    rc = requests.post(f"{API}/deals/{did}/convert", headers=client_h, timeout=15)
    assert rc.status_code == 403
    requests.delete(f"{API}/deals/{did}", headers=owner_h, timeout=10)
