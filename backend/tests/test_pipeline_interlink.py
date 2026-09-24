"""Tests for the unified Pipeline interlink feature (iteration 6)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

OWNER = {"email": "glennmuyskens78776@outlook.com", "password": "Admin@12345"}
CLIENT = {"email": "client@demo.com", "password": "Client@12345"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_headers():
    return {"Authorization": f"Bearer {_login(OWNER)}"}


@pytest.fixture(scope="module")
def client_headers():
    return {"Authorization": f"Bearer {_login(CLIENT)}"}


# ---------------- Pipeline feed ----------------
def test_pipeline_feed_includes_leads_and_deals(owner_headers):
    r = requests.get(f"{API}/pipeline", headers=owner_headers, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    kinds = {i["kind"] for i in items}
    assert "lead" in kinds, f"Expected leads in pipeline feed. Got kinds: {kinds}"
    # Each item must have stage/title/kind/id
    for i in items[:5]:
        for k in ("id", "kind", "title", "stage", "value"):
            assert k in i


def test_pipeline_forbidden_for_client(client_headers):
    r = requests.get(f"{API}/pipeline", headers=client_headers, timeout=30)
    assert r.status_code == 403


# ---------------- Lead auto-creates contact + company ----------------
def test_create_lead_autocreates_contact_and_company(owner_headers):
    ts = int(time.time() * 1000)
    payload = {
        "name": f"TEST_Interlink Lead {ts}",
        "email": f"test_interlink_{ts}@example.com",
        "company": f"TEST_Interlink Co {ts}",
        "status": "New",
        "budget": 5000,
    }
    r = requests.post(f"{API}/leads", json=payload, headers=owner_headers, timeout=30)
    assert r.status_code in (200, 201), r.text
    lead = r.json()

    # GET lead back — company_id + contact_id must be populated
    time.sleep(0.5)
    g = requests.get(f"{API}/leads/{lead['id']}", headers=owner_headers, timeout=30).json()
    assert g.get("company_id"), f"Lead should have company_id linked. Got: {g}"
    assert g.get("contact_id"), f"Lead should have contact_id linked. Got: {g}"

    # Verify company exists
    companies = requests.get(f"{API}/companies", headers=owner_headers, timeout=30).json()
    assert any(c["id"] == g["company_id"] for c in companies), "Auto-created company missing"

    # Verify contact exists
    contacts = requests.get(f"{API}/contacts", headers=owner_headers, timeout=30).json()
    assert any(c["id"] == g["contact_id"] for c in contacts), "Auto-created contact missing"
    return lead["id"]


# ---------------- Stage moves w/ side effects ----------------
@pytest.fixture(scope="module")
def a_lead(owner_headers):
    ts = int(time.time() * 1000)
    r = requests.post(f"{API}/leads", json={
        "name": f"TEST_StageLead {ts}",
        "email": f"test_stage_{ts}@ex.com",
        "company": f"TEST_StageCo {ts}",
        "status": "New",
        "budget": 8000,
    }, headers=owner_headers, timeout=30)
    return r.json()


def test_move_lead_to_contacted_updates_status(owner_headers, a_lead):
    r = requests.post(f"{API}/pipeline/lead/{a_lead['id']}/stage",
                      json={"stage": "Contacted"}, headers=owner_headers, timeout=30)
    assert r.status_code == 200
    # Pipeline feed reflects it
    feed = requests.get(f"{API}/pipeline", headers=owner_headers, timeout=30).json()
    entry = next((i for i in feed if i["kind"] == "lead" and i["id"] == a_lead["id"]), None)
    assert entry and entry["stage"] == "Contacted"


def test_move_lead_to_proposal_creates_proposal(owner_headers, a_lead):
    r = requests.post(f"{API}/pipeline/lead/{a_lead['id']}/stage",
                      json={"stage": "Proposal"}, headers=owner_headers, timeout=30)
    assert r.status_code == 200
    assert "Proposal draft created" in r.json().get("actions", [])
    proposals = requests.get(f"{API}/proposals", headers=owner_headers, timeout=30).json()
    linked = [p for p in proposals if p.get("lead_id") == a_lead["id"]]
    assert linked, "Linked proposal should exist"
    assert linked[0]["status"] == "Draft"


def test_move_lead_to_negotiation_creates_contract(owner_headers, a_lead):
    r = requests.post(f"{API}/pipeline/lead/{a_lead['id']}/stage",
                      json={"stage": "Negotiation"}, headers=owner_headers, timeout=30)
    assert r.status_code == 200
    assert "Contract draft created" in r.json().get("actions", [])
    contracts = requests.get(f"{API}/contracts", headers=owner_headers, timeout=30).json()
    linked = [c for c in contracts if c.get("lead_id") == a_lead["id"]]
    assert linked, "Linked contract should exist"


def test_move_lead_to_won_converts_and_accepts_proposals(owner_headers, a_lead):
    r = requests.post(f"{API}/pipeline/lead/{a_lead['id']}/stage",
                      json={"stage": "Won"}, headers=owner_headers, timeout=30)
    assert r.status_code == 200, r.text
    actions = r.json().get("actions", [])
    assert any("Won deal" in a for a in actions), f"Expected lead->deal conversion. Actions: {actions}"
    assert any("Client & project" in a for a in actions), f"Expected client+project creation. Actions: {actions}"
    assert any("Accepted" in a for a in actions), f"Expected proposals->Accepted. Actions: {actions}"

    # Proposal should now be Accepted
    proposals = requests.get(f"{API}/proposals", headers=owner_headers, timeout=30).json()
    linked = [p for p in proposals if p.get("lead_id") == a_lead["id"]]
    assert linked and linked[0]["status"] == "Accepted"

    # Lead is marked converted and thus no longer appears in pipeline
    feed = requests.get(f"{API}/pipeline", headers=owner_headers, timeout=30).json()
    assert not any(i["kind"] == "lead" and i["id"] == a_lead["id"] for i in feed), \
        "Converted lead should not appear in pipeline"

    # A deal now exists in Won linked to this lead
    deals = requests.get(f"{API}/deals", headers=owner_headers, timeout=30).json()
    linked_deal = [d for d in deals if d.get("lead_id") == a_lead["id"]]
    assert linked_deal and linked_deal[0]["stage"] == "Won"


def test_client_forbidden_stage_move(client_headers, owner_headers, a_lead):
    r = requests.post(f"{API}/pipeline/lead/{a_lead['id']}/stage",
                      json={"stage": "Proposal"}, headers=client_headers, timeout=30)
    assert r.status_code == 403


# ---------------- Deal stage effects via pipeline ----------------
def test_move_deal_to_proposal_creates_proposal(owner_headers):
    ts = int(time.time() * 1000)
    d = requests.post(f"{API}/deals",
                      json={"title": f"TEST_Deal {ts}", "company": f"TEST_DealCo {ts}",
                            "value": 3000, "stage": "New"},
                      headers=owner_headers, timeout=30).json()
    r = requests.post(f"{API}/pipeline/deal/{d['id']}/stage",
                      json={"stage": "Proposal"}, headers=owner_headers, timeout=30)
    assert r.status_code == 200
    assert "Proposal draft created" in r.json().get("actions", [])
    proposals = requests.get(f"{API}/proposals", headers=owner_headers, timeout=30).json()
    assert any(p.get("deal_id") == d["id"] for p in proposals)
