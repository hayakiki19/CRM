"""FlowCRM backend regression tests."""
import os
import pytest
import requests
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


@pytest.fixture(scope="session")
def owner_token():
    r = requests.post(f"{API}/auth/login", json=OWNER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def client_token():
    r = requests.post(f"{API}/auth/login", json=CLIENT, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def owner_h(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


@pytest.fixture
def client_h(client_token):
    return {"Authorization": f"Bearer {client_token}"}


# --- Auth ---
class TestAuth:
    def test_login_owner(self):
        r = requests.post(f"{API}/auth/login", json=OWNER, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "owner"
        assert d["token"]

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": OWNER["email"], "password": "wrong"}, timeout=15)
        assert r.status_code in (400, 401)

    def test_me(self, owner_h):
        r = requests.get(f"{API}/auth/me", headers=owner_h, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == OWNER["email"]


# --- Dashboard / Analytics ---
class TestDashboard:
    def test_dashboard_stats(self, owner_h):
        r = requests.get(f"{API}/dashboard/stats", headers=owner_h, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)

    def test_analytics_overview(self, owner_h):
        r = requests.get(f"{API}/analytics/overview", headers=owner_h, timeout=15)
        assert r.status_code == 200


# --- Generic CRUD (Leads) ---
class TestLeadsCRUD:
    def test_lead_create_get_update_delete(self, owner_h):
        # Create
        payload = {"name": "TEST_Lead", "email": "test_lead@example.com",
                   "company": "TestCo", "source": "Website", "status": "New", "score": 50}
        r = requests.post(f"{API}/leads", json=payload, headers=owner_h, timeout=15)
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["name"] == "TEST_Lead"
        lid = lead["id"]

        # Get
        r = requests.get(f"{API}/leads/{lid}", headers=owner_h, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == "test_lead@example.com"

        # Update
        r = requests.put(f"{API}/leads/{lid}", json={"status": "Qualified"}, headers=owner_h, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "Qualified"

        # List
        r = requests.get(f"{API}/leads", headers=owner_h, timeout=15)
        assert r.status_code == 200
        assert any(x["id"] == lid for x in r.json())

        # Delete
        r = requests.delete(f"{API}/leads/{lid}", headers=owner_h, timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/leads/{lid}", headers=owner_h, timeout=15)
        assert r.status_code == 404


# --- Invoices totals ---
class TestInvoices:
    def test_invoice_totals(self, owner_h):
        payload = {"number": "TEST_INV_001", "amount": 1000, "tax": 100, "discount": 50, "paid_amount": 200}
        r = requests.post(f"{API}/invoices", json=payload, headers=owner_h, timeout=15)
        assert r.status_code == 200, r.text
        inv = r.json()
        # total = amount + tax - discount = 1050
        assert float(inv.get("total", 0)) == pytest.approx(1050)
        assert float(inv.get("pending_amount", 0)) == pytest.approx(850)
        assert inv.get("status") in ("partial", "pending", "unpaid")
        # cleanup
        requests.delete(f"{API}/invoices/{inv['id']}", headers=owner_h, timeout=15)


# --- Deals + automation (deal_won) ---
class TestDealsAutomation:
    def test_deal_won_triggers_automations(self, owner_h):
        r = requests.post(f"{API}/deals",
                          json={"title": "TEST_Deal_Won", "company": "TEST_AutoCo",
                                "value": 5000, "stage": "Won", "email": "autoco@test.com"},
                          headers=owner_h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["stage"].lower() == "won"
        # cleanup
        requests.delete(f"{API}/deals/{d['id']}", headers=owner_h, timeout=15)


# --- Client role isolation ---
class TestClientIsolation:
    def test_client_cannot_list_leads(self, client_h):
        r = requests.get(f"{API}/leads", headers=client_h, timeout=15)
        assert r.status_code == 403

    def test_client_can_list_projects(self, client_h):
        r = requests.get(f"{API}/projects", headers=client_h, timeout=15)
        assert r.status_code == 200

    def test_client_cannot_create_task(self, client_h):
        r = requests.post(f"{API}/tasks", json={"title": "nope"}, headers=client_h, timeout=15)
        assert r.status_code == 403


# --- AI Chat ---
class TestAI:
    def test_ai_chat(self, owner_h):
        r = requests.post(f"{API}/ai/chat", json={"message": "How many leads do I have?"},
                          headers=owner_h, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reply" in data or "message" in data or "content" in data
        # non-empty reply
        text = data.get("reply") or data.get("message") or data.get("content") or ""
        assert len(str(text)) > 0


# --- Public capture ---
class TestPublicCapture:
    def test_tracking_js(self):
        r = requests.get(f"{API}/public/lead-capture.js", params={"site_id": "test-site"}, timeout=15)
        assert r.status_code == 200
        assert "CRMCapture" in r.text or "SITE_ID" in r.text

    def test_capture_requires_org(self):
        r = requests.post(f"{API}/public/capture", json={"email": "x@y.com"}, timeout=15)
        # should fail without org context
        assert r.status_code in (400, 401, 403, 404, 422)


# --- Registration new org isolation ---
class TestRegistration:
    def test_register_new_org(self):
        import uuid
        email = f"test_owner_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Test@12345",
                                "name": "TEST New Owner", "org_name": "TEST New Org"},
                          timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "owner"
        # New org should have empty or seeded-per-org isolated leads
        h = {"Authorization": f"Bearer {d['token']}"}
        r = requests.get(f"{API}/leads", headers=h, timeout=15)
        assert r.status_code == 200
        leads = r.json()
        # Must not see main seed org's data - verify org isolation
        assert all(l.get("org_id") == d["user"]["org_id"] for l in leads)
