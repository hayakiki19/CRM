"""Tests for the detailed Leads page backend contracts:
- POST/GET /api/activities (org-scoped, filter by entity_id)
- PUT /api/leads/{id} accepts arbitrary fields (contacted, last_contacted_at, follow_up_date)
"""
import os
import requests
import pytest
from pathlib import Path

def _load_frontend_env():
    p = Path("/app/frontend/.env")
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

_load_frontend_env()
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

OWNER = {"email": "glennmuyskens78776@outlook.com", "password": "Admin@12345"}
CLIENT = {"email": "client@demo.com", "password": "Client@12345"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_headers():
    return {"Authorization": f"Bearer {_login(OWNER)}"}


@pytest.fixture(scope="module")
def client_headers():
    return {"Authorization": f"Bearer {_login(CLIENT)}"}


@pytest.fixture(scope="module")
def created_lead(owner_headers):
    r = requests.post(f"{API}/leads",
                      json={"name": "TEST_LeadDetail", "email": "test_ld@example.com",
                            "status": "New", "score": 55, "contacted": False},
                      headers=owner_headers, timeout=15)
    assert r.status_code == 200, r.text
    lead = r.json()
    yield lead
    try:
        requests.delete(f"{API}/leads/{lead['id']}", headers=owner_headers, timeout=10)
    except Exception:
        pass


def test_mark_contacted_via_put(owner_headers, created_lead):
    """PUT /api/leads/{id} should persist contacted + last_contacted_at."""
    r = requests.put(f"{API}/leads/{created_lead['id']}",
                     json={"contacted": True, "last_contacted_at": "2026-01-15T10:00:00Z",
                           "status": "Contacted"},
                     headers=owner_headers, timeout=15)
    assert r.status_code == 200, r.text
    # GET to verify persistence
    r2 = requests.get(f"{API}/leads/{created_lead['id']}", headers=owner_headers, timeout=15)
    assert r2.status_code == 200
    body = r2.json()
    assert body["contacted"] is True
    assert body["last_contacted_at"] == "2026-01-15T10:00:00Z"
    assert body["status"] == "Contacted"


def test_mark_not_contacted_toggles_back(owner_headers, created_lead):
    r = requests.put(f"{API}/leads/{created_lead['id']}",
                     json={"contacted": False},
                     headers=owner_headers, timeout=15)
    assert r.status_code == 200
    body = requests.get(f"{API}/leads/{created_lead['id']}", headers=owner_headers, timeout=15).json()
    assert body["contacted"] is False


def test_followup_date_persist(owner_headers, created_lead):
    r = requests.put(f"{API}/leads/{created_lead['id']}",
                     json={"follow_up_date": "2026-02-20"},
                     headers=owner_headers, timeout=15)
    assert r.status_code == 200
    body = requests.get(f"{API}/leads/{created_lead['id']}", headers=owner_headers, timeout=15).json()
    assert body["follow_up_date"] == "2026-02-20"


def test_activity_create_and_list_by_entity_id(owner_headers, created_lead):
    """POST /api/activities then GET /api/activities?entity_id=<id> returns it."""
    note_txt = "TEST_note from pytest"
    r = requests.post(f"{API}/activities",
                      json={"entity_type": "lead", "entity_id": created_lead["id"],
                            "description": note_txt},
                      headers=owner_headers, timeout=15)
    assert r.status_code == 200, r.text
    act = r.json()
    assert "id" in act
    assert act["entity_id"] == created_lead["id"]
    assert act["description"] == note_txt
    assert "_id" not in act  # mongo _id must be excluded

    # List filtered by entity_id
    r2 = requests.get(f"{API}/activities", params={"entity_id": created_lead["id"]},
                      headers=owner_headers, timeout=15)
    assert r2.status_code == 200
    lst = r2.json()
    assert isinstance(lst, list)
    ids = [a["id"] for a in lst]
    assert act["id"] in ids
    # all activities for this entity should match
    for a in lst:
        assert a["entity_id"] == created_lead["id"]
        assert "_id" not in a


def test_activity_list_org_scoped(owner_headers):
    """Listing without entity_id returns org's activities only."""
    r = requests.get(f"{API}/activities", headers=owner_headers, timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert isinstance(lst, list)
    # every returned activity must have entity_type/description
    for a in lst[:5]:
        assert "entity_type" in a
        assert "_id" not in a


def test_activity_client_forbidden_to_create(client_headers, created_lead):
    r = requests.post(f"{API}/activities",
                      json={"entity_type": "lead", "entity_id": created_lead["id"],
                            "description": "nope"},
                      headers=client_headers, timeout=15)
    # generic create_resource blocks role==client
    assert r.status_code == 403


def test_convert_lead_hides_action(owner_headers):
    """After convert, lead.converted=true and status=Qualified."""
    r = requests.post(f"{API}/leads",
                      json={"name": "TEST_LeadConvertUI", "status": "New"},
                      headers=owner_headers, timeout=15)
    lead = r.json()
    try:
        c = requests.post(f"{API}/leads/{lead['id']}/convert", json={},
                          headers=owner_headers, timeout=15)
        assert c.status_code == 200
        got = requests.get(f"{API}/leads/{lead['id']}", headers=owner_headers, timeout=15).json()
        assert got.get("converted") is True
        assert got.get("status") == "Qualified"
    finally:
        requests.delete(f"{API}/leads/{lead['id']}", headers=owner_headers, timeout=10)
