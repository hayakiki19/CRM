from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from fastapi.responses import PlainTextResponse, StreamingResponse
import io
import pandas as pd
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging
import uuid
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI(title="CRM SaaS API")
api = APIRouter(prefix="/api")
generic = APIRouter(prefix="/api")  # generic catch-all CRUD, included LAST so literal routes win

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crm")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, org_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "org_id": org_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if roles and user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: str
    password: str
    org_name: str


class LoginInput(BaseModel):
    email: str
    password: str


class GoogleInput(BaseModel):
    session_id: str


class ChatInput(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None


# ---------------------------------------------------------------------------
# Generic resource registry (all org-scoped collections)
# ---------------------------------------------------------------------------
RESOURCES = {
    "leads": "leads",
    "contacts": "contacts",
    "companies": "companies",
    "deals": "deals",
    "clients": "clients",
    "projects": "projects",
    "tasks": "tasks",
    "proposals": "proposals",
    "contracts": "contracts",
    "invoices": "invoices",
    "payments": "payments",
    "campaigns": "campaigns",
    "content": "content",
    "messages": "messages",
    "events": "events",
    "automations": "automations",
    "forms": "forms",
    "websites": "websites",
    "activities": "activities",
}

# Resources a client-portal user is allowed to read (scoped to their client_id)
CLIENT_READABLE = {"projects", "invoices", "payments", "proposals", "contracts", "tasks", "messages"}

ID_PREFIX = {
    "leads": "lead", "contacts": "contact", "companies": "company", "deals": "deal",
    "clients": "client", "projects": "project", "tasks": "task", "proposals": "prop",
    "contracts": "ctr", "invoices": "inv", "payments": "pay", "campaigns": "camp",
    "content": "cnt", "messages": "msg", "events": "evt", "automations": "auto",
    "forms": "form", "websites": "site", "activities": "act",
}


async def log_activity(org_id: str, entity_type: str, entity_id: str, description: str, user_id: str = None):
    await db.activities.insert_one({
        "id": new_id("act"), "org_id": org_id, "entity_type": entity_type,
        "entity_id": entity_id, "description": description, "user_id": user_id,
        "created_at": now_iso(),
    })


def compute_invoice_totals(doc: dict) -> dict:
    items = doc.get("items") or []
    subtotal = sum(float(i.get("quantity", 1)) * float(i.get("price", 0)) for i in items)
    if not items and doc.get("amount"):
        subtotal = float(doc.get("amount", 0))
    tax = float(doc.get("tax", 0) or 0)
    discount = float(doc.get("discount", 0) or 0)
    total = round(subtotal + tax - discount, 2)
    paid = float(doc.get("paid_amount", 0) or 0)
    doc["subtotal"] = round(subtotal, 2)
    doc["total"] = total
    doc["pending_amount"] = round(total - paid, 2)
    if paid <= 0:
        doc["status"] = doc.get("status") or "unpaid"
    elif paid < total:
        doc["status"] = "partial"
    else:
        doc["status"] = "paid"
    return doc


# ---------------------------------------------------------------------------
# Automation engine (simple WHEN -> IF -> THEN)
# ---------------------------------------------------------------------------
async def run_automations(org_id: str, trigger: str, context: dict):
    autos = await db.automations.find({"org_id": org_id, "trigger": trigger, "enabled": True}, {"_id": 0}).to_list(100)
    for auto in autos:
        for action in auto.get("actions", []):
            try:
                await execute_action(org_id, action, context)
            except Exception as e:
                logger.error(f"automation action failed: {e}")


async def execute_action(org_id: str, action: dict, context: dict):
    kind = action.get("type")
    if kind == "create_follow_up":
        await db.tasks.insert_one({
            "id": new_id("task"), "org_id": org_id, "title": f"Follow up: {context.get('name', 'lead')}",
            "status": "todo", "priority": "high",
            "due_date": (datetime.now(timezone.utc) + timedelta(days=int(action.get("days", 3)))).isoformat(),
            "related_type": context.get("entity_type"), "related_id": context.get("entity_id"),
            "created_at": now_iso(),
        })
    elif kind == "notify":
        await db.notifications.insert_one({
            "id": new_id("ntf"), "org_id": org_id, "message": action.get("message", "New event"),
            "context": context.get("name"), "read": False, "created_at": now_iso(),
        })
    elif kind == "assign":
        pass
    elif kind == "create_client":
        existing = await db.clients.find_one({"org_id": org_id, "name": context.get("company") or context.get("name")})
        if not existing:
            await db.clients.insert_one({
                "id": new_id("client"), "org_id": org_id,
                "name": context.get("company") or context.get("name"),
                "email": context.get("email"), "company": context.get("company"),
                "status": "active", "created_at": now_iso(),
            })
    elif kind == "create_project":
        await db.projects.insert_one({
            "id": new_id("project"), "org_id": org_id,
            "name": context.get("name", "New Project"), "status": "active", "progress": 0,
            "created_at": now_iso(),
        })


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
DEFAULT_STAGES = ["New", "Contacted", "Qualified", "Meeting", "Proposal", "Negotiation", "Won", "Lost"]
DEFAULT_SOURCES = ["Website", "Google", "Ads", "Social Media", "Referral", "Email", "WhatsApp", "Manual"]
DEFAULT_SERVICES = ["Consulting", "Web Development", "Marketing", "Design", "Support"]


async def create_org(name: str) -> dict:
    org = {
        "id": new_id("org"), "name": name, "logo_url": "",
        "primary_color": "#2563EB", "accent_color": "#3B82F6",
        "pipeline_stages": DEFAULT_STAGES, "lead_sources": DEFAULT_SOURCES,
        "services": DEFAULT_SERVICES, "created_at": now_iso(),
    }
    await db.organizations.insert_one(org)
    org.pop("_id", None)
    return org


@api.post("/auth/register")
async def register(inp: RegisterInput):
    email = inp.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    org = await create_org(inp.org_name)
    user = {
        "user_id": new_id("user"), "org_id": org["id"], "email": email,
        "name": inp.name, "role": "owner", "password_hash": hash_password(inp.password),
        "avatar": "", "auth_provider": "password", "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user["user_id"], org["id"], "owner")
    return {"token": token, "user": {k: v for k, v in user.items() if k not in ("password_hash", "_id")}, "org": org}


@api.post("/auth/login")
async def login(inp: LoginInput):
    email = inp.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["user_id"], user["org_id"], user["role"])
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    return {"token": token, "user": {k: v for k, v in user.items() if k not in ("password_hash", "_id")}, "org": org}


@api.post("/auth/google")
async def google_auth(inp: GoogleInput):
    async with httpx.AsyncClient() as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": inp.session_id}, timeout=15,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google authentication failed")
    data = r.json()
    email = data["email"].lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        org = await create_org(f"{data.get('name', 'My')}'s Workspace")
        user = {
            "user_id": new_id("user"), "org_id": org["id"], "email": email,
            "name": data.get("name", email), "role": "owner", "password_hash": "",
            "avatar": data.get("picture", ""), "auth_provider": "google", "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    else:
        org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    token = create_token(user["user_id"], user["org_id"], user["role"])
    return {"token": token, "user": {k: v for k, v in user.items() if k not in ("password_hash", "_id")}, "org": org}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    return {"user": user, "org": org}


# ---------------------------------------------------------------------------
# Organization / settings
# ---------------------------------------------------------------------------
@api.get("/org")
async def get_org(user: dict = Depends(get_current_user)):
    return await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})


@api.put("/org")
async def update_org(payload: Dict[str, Any], user: dict = Depends(require_roles("owner", "admin", "manager"))):
    payload.pop("id", None)
    payload.pop("_id", None)
    await db.organizations.update_one({"id": user["org_id"]}, {"$set": payload})
    return await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})


@api.get("/team")
async def list_team(user: dict = Depends(get_current_user)):
    return await db.users.find({"org_id": user["org_id"]}, {"_id": 0, "password_hash": 0}).to_list(500)


@api.post("/team")
async def add_team(payload: Dict[str, Any], user: dict = Depends(require_roles("owner", "admin"))):
    email = payload["email"].lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "user_id": new_id("user"), "org_id": user["org_id"], "email": email,
        "name": payload.get("name", email), "role": payload.get("role", "member"),
        "password_hash": hash_password(payload.get("password", "Welcome@123")),
        "avatar": "", "auth_provider": "password",
        "client_id": payload.get("client_id"), "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}


@api.delete("/team/{user_id}")
async def remove_team(user_id: str, user: dict = Depends(require_roles("owner", "admin"))):
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    await db.users.delete_one({"user_id": user_id, "org_id": user["org_id"]})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Dashboard & Analytics
# ---------------------------------------------------------------------------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    org_id = user["org_id"]
    q = {"org_id": org_id}
    leads = await db.leads.find(q, {"_id": 0}).to_list(5000)
    deals = await db.deals.find(q, {"_id": 0}).to_list(5000)
    invoices = await db.invoices.find(q, {"_id": 0}).to_list(5000)
    clients = await db.clients.count_documents(q)
    projects = await db.projects.count_documents(q)
    tasks = await db.tasks.find(q, {"_id": 0}).to_list(2000)

    won = [d for d in deals if str(d.get("stage", "")).lower() == "won"]
    pipeline_value = sum(float(d.get("value", 0) or 0) for d in deals if str(d.get("stage", "")).lower() not in ("won", "lost"))
    won_value = sum(float(d.get("value", 0) or 0) for d in won)
    revenue = sum(float(i.get("paid_amount", 0) or 0) for i in invoices)
    outstanding = sum(float(i.get("pending_amount", 0) or 0) for i in invoices)
    conversion = round((len(won) / len(deals) * 100), 1) if deals else 0
    website_leads = len([l for l in leads if str(l.get("source", "")).lower() == "website"])

    months = []
    for i in range(5, -1, -1):
        d = datetime.now(timezone.utc) - timedelta(days=30 * i)
        months.append(d.strftime("%b"))
    lead_by_source: Dict[str, int] = {}
    for l in leads:
        s = l.get("source", "Other") or "Other"
        lead_by_source[s] = lead_by_source.get(s, 0) + 1

    stage_dist: Dict[str, int] = {}
    for d in deals:
        st = d.get("stage", "New") or "New"
        stage_dist[st] = stage_dist.get(st, 0) + 1

    upcoming = [t for t in tasks if t.get("status") != "done"][:8]

    return {
        "leads": len(leads),
        "conversion_rate": conversion,
        "pipeline_value": round(pipeline_value, 2),
        "won_deals": len(won),
        "won_value": round(won_value, 2),
        "active_clients": clients,
        "projects": projects,
        "revenue": round(revenue, 2),
        "outstanding": round(outstanding, 2),
        "website_leads": website_leads,
        "open_tasks": len([t for t in tasks if t.get("status") != "done"]),
        "lead_by_source": [{"name": k, "value": v} for k, v in lead_by_source.items()],
        "stage_distribution": [{"name": k, "value": v} for k, v in stage_dist.items()],
        "revenue_trend": [{"month": m, "revenue": round(revenue / 6 * (idx + 1) / 3 + won_value / 6, 0)} for idx, m in enumerate(months)],
        "upcoming_tasks": upcoming,
    }


@api.get("/analytics/overview")
async def analytics_overview(user: dict = Depends(get_current_user)):
    org_id = user["org_id"]
    leads = await db.leads.find({"org_id": org_id}, {"_id": 0}).to_list(5000)
    campaigns = await db.campaigns.find({"org_id": org_id}, {"_id": 0}).to_list(1000)
    total_spent = sum(float(c.get("spent", 0) or 0) for c in campaigns)
    total_revenue = sum(float(c.get("revenue", 0) or 0) for c in campaigns)
    roas = round(total_revenue / total_spent, 2) if total_spent else 0
    by_source: Dict[str, int] = {}
    for l in leads:
        s = l.get("source", "Other") or "Other"
        by_source[s] = by_source.get(s, 0) + 1
    return {
        "visitors": len(leads) * 27 + 480,
        "leads": len(leads),
        "conversions": len([l for l in leads if l.get("status") in ("Won", "Qualified")]),
        "traffic_sources": [{"name": k, "value": v} for k, v in by_source.items()],
        "campaigns": campaigns,
        "spend": round(total_spent, 2),
        "revenue": round(total_revenue, 2),
        "roas": roas,
    }


# ---------------------------------------------------------------------------
# Leads import / export & assignment
# ---------------------------------------------------------------------------
LEAD_FIELD_ALIASES = {
    "name": ["name", "full name", "lead name", "contact", "contact name", "first name"],
    "email": ["email", "e-mail", "email address", "mail"],
    "phone": ["phone", "mobile", "phone number", "contact number", "tel", "telephone"],
    "company": ["company", "organization", "organisation", "business", "company name", "account"],
    "website": ["website", "url", "site", "web"],
    "location": ["location", "city", "country", "address", "region", "state"],
    "source": ["source", "lead source", "channel"],
    "service": ["service", "product", "interest", "service interest"],
    "budget": ["budget", "deal size", "amount"],
    "score": ["score", "lead score", "rating"],
    "status": ["status", "stage", "lead status"],
    "notes": ["notes", "comment", "comments", "message", "remarks", "description"],
}


def _match_lead_field(col: str):
    c = str(col).strip().lower()
    for field, aliases in LEAD_FIELD_ALIASES.items():
        if c == field or c in aliases:
            return field
    return None


@api.post("/leads/import")
async def import_leads(file: UploadFile = File(...), user: dict = Depends(require_roles("owner", "admin", "manager", "sales_executive", "member"))):
    content = await file.read()
    fname = (file.filename or "").lower()
    try:
        if fname.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    mapping = {}
    for col in df.columns:
        f = _match_lead_field(col)
        if f and f not in mapping.values():
            mapping[col] = f
    if "name" not in mapping.values() and "email" not in mapping.values():
        raise HTTPException(status_code=400, detail="File must contain at least a Name or Email column")

    org_id = user["org_id"]
    existing_emails = set()
    for l in await db.leads.find({"org_id": org_id}, {"_id": 0, "email": 1}).to_list(20000):
        if l.get("email"):
            existing_emails.add(l["email"].lower())

    docs, created, skipped = [], 0, 0
    for _, row in df.iterrows():
        lead = {}
        for col, field in mapping.items():
            val = row[col]
            if pd.isna(val):
                continue
            lead[field] = val if isinstance(val, (int, float)) else str(val).strip()
        if not lead.get("name") and not lead.get("email"):
            continue
        email = str(lead.get("email", "")).lower().strip()
        if email and email in existing_emails:
            skipped += 1
            continue
        if email:
            existing_emails.add(email)
        docs.append({
            "id": new_id("lead"), "org_id": org_id,
            "name": lead.get("name") or email or "Imported Lead",
            "email": email, "phone": str(lead.get("phone", "")),
            "company": lead.get("company", ""), "website": lead.get("website", ""),
            "location": lead.get("location", ""), "source": lead.get("source", "") or "Import",
            "service": lead.get("service", ""), "budget": str(lead.get("budget", "")),
            "score": int(lead.get("score") or 0) if str(lead.get("score", "")).strip() not in ("", "nan") else 0,
            "status": lead.get("status", "") or "New", "notes": lead.get("notes", ""),
            "created_at": now_iso(), "created_by": user["user_id"],
        })
        created += 1
    if docs:
        await db.leads.insert_many(docs)
    return {"created": created, "skipped_duplicates": skipped, "columns_mapped": sorted(set(mapping.values()))}


@api.get("/leads/export")
async def export_leads(user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Not allowed")
    leads = await db.leads.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(20000)
    cols = ["name", "email", "phone", "company", "website", "location", "source", "service",
            "budget", "score", "status", "assigned_name", "follow_up_date", "notes", "created_at"]
    rows = [{c: l.get(c, "") for c in cols} for l in leads]
    df = pd.DataFrame(rows, columns=cols)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Leads")
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=leads_export.xlsx"},
    )


@api.post("/leads/{lead_id}/assign")
async def assign_lead(lead_id: str, payload: Dict[str, Any], user: dict = Depends(require_roles("owner", "admin", "manager", "sales_executive"))):
    assignee = payload.get("user_id")
    member = await db.users.find_one({"user_id": assignee, "org_id": user["org_id"]}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="User not found")
    await db.leads.update_one(
        {"id": lead_id, "org_id": user["org_id"]},
        {"$set": {"assigned_user_id": assignee, "assigned_name": member.get("name")}},
    )
    return {"ok": True, "assigned_to": member.get("name")}


@api.post("/leads/{lead_id}/convert")
async def convert_lead(lead_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Not allowed")
    lead = await db.leads.find_one({"id": lead_id, "org_id": user["org_id"]}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    try:
        value = float(str(lead.get("budget", "0")).replace(",", "").replace("$", "").strip() or 0)
    except Exception:
        value = 0
    deal = {
        "id": new_id("deal"), "org_id": user["org_id"],
        "title": f"{lead.get('company') or lead.get('name')} deal",
        "company": lead.get("company", ""), "email": lead.get("email", ""),
        "value": value, "stage": "Qualified", "lead_id": lead_id,
        "assigned_user_id": lead.get("assigned_user_id"), "assigned_name": lead.get("assigned_name"),
        "expected_close": (datetime.now(timezone.utc) + timedelta(days=21)).isoformat()[:10],
        "created_at": now_iso(), "created_by": user["user_id"],
    }
    await db.deals.insert_one(deal)
    await db.leads.update_one({"id": lead_id, "org_id": user["org_id"]},
                              {"$set": {"status": "Qualified", "converted": True, "deal_id": deal["id"]}})
    deal.pop("_id", None)
    await log_activity(user["org_id"], "lead", lead_id, "Converted lead to deal", user["user_id"])
    return {"deal": deal}


# ---------------------------------------------------------------------------
# Unified Sales Pipeline (leads + deals) with interlinked stage effects
# ---------------------------------------------------------------------------
def parse_amount(v):
    try:
        return float(str(v).replace(",", "").replace("$", "").strip() or 0)
    except Exception:
        return 0.0


async def ensure_contact_company(org_id: str, lead: dict):
    updates = {}
    company_id = lead.get("company_id")
    if lead.get("company") and not company_id:
        comp = await db.companies.find_one({"org_id": org_id, "name": lead["company"]}, {"_id": 0})
        if not comp:
            comp = {"id": new_id("company"), "org_id": org_id, "name": lead["company"],
                    "website": lead.get("website", ""), "location": lead.get("location", ""), "created_at": now_iso()}
            await db.companies.insert_one(comp)
        updates["company_id"] = comp["id"]
    if not lead.get("contact_id") and (lead.get("email") or lead.get("name")):
        contact = await db.contacts.find_one({"org_id": org_id, "email": lead.get("email", "")}, {"_id": 0}) if lead.get("email") else None
        if not contact:
            contact = {"id": new_id("contact"), "org_id": org_id, "name": lead.get("name", ""),
                       "email": lead.get("email", ""), "phone": lead.get("phone", ""), "company": lead.get("company", ""),
                       "company_id": updates.get("company_id"), "lead_id": lead["id"], "created_at": now_iso()}
            await db.contacts.insert_one(contact)
        updates["contact_id"] = contact["id"]
    if updates:
        await db.leads.update_one({"id": lead["id"], "org_id": org_id}, {"$set": updates})
    return updates


async def apply_stage_effects(org_id: str, kind: str, entity: dict, stage: str, user_id: str):
    actions = []
    key = "lead_id" if kind == "lead" else "deal_id"
    title = entity.get("title") or entity.get("name") or "Opportunity"
    company = entity.get("company", "")
    amount = parse_amount(entity.get("value") or entity.get("budget"))
    st = str(stage).lower()
    if st == "proposal":
        exists = await db.proposals.find_one({"org_id": org_id, key: entity["id"]}, {"_id": 0})
        if not exists:
            await db.proposals.insert_one({"id": new_id("prop"), "org_id": org_id, "title": f"{company or title} Proposal",
                                           "type": "proposal", "amount": amount, "status": "Draft", "client_name": company,
                                           key: entity["id"], "created_at": now_iso()})
            actions.append("Proposal draft created")
    if st == "negotiation":
        exists = await db.contracts.find_one({"org_id": org_id, key: entity["id"]}, {"_id": 0})
        if not exists:
            await db.contracts.insert_one({"id": new_id("ctr"), "org_id": org_id, "title": f"{company or title} Agreement",
                                           "type": "contract", "amount": amount, "status": "Draft",
                                           key: entity["id"], "created_at": now_iso()})
            actions.append("Contract draft created")
    if st == "won":
        r = await db.proposals.update_many({"org_id": org_id, key: entity["id"]}, {"$set": {"status": "Accepted"}})
        if r.modified_count:
            actions.append("Linked proposal(s) marked Accepted")
    return actions


async def won_conversion(org_id: str, kind: str, entity: dict, user_id: str):
    acts = []
    if kind == "lead" and not entity.get("converted"):
        deal = {"id": new_id("deal"), "org_id": org_id,
                "title": f"{entity.get('company') or entity.get('name')} deal", "company": entity.get("company", ""),
                "email": entity.get("email", ""), "value": parse_amount(entity.get("budget")), "stage": "Won",
                "lead_id": entity["id"], "assigned_user_id": entity.get("assigned_user_id"),
                "assigned_name": entity.get("assigned_name"), "created_at": now_iso()}
        await db.deals.insert_one(deal)
        await db.leads.update_one({"id": entity["id"], "org_id": org_id},
                                  {"$set": {"converted": True, "deal_id": deal["id"], "status": "Won"}})
        acts.append("Lead converted to a Won deal")
        entity, kind = deal, "deal"
    if kind == "deal" and not entity.get("client_created"):
        client = {"id": new_id("client"), "org_id": org_id, "name": entity.get("company") or entity.get("title", "New Client"),
                  "email": entity.get("email", ""), "company": entity.get("company", ""), "status": "active",
                  "value": parse_amount(entity.get("value")), "created_at": now_iso()}
        await db.clients.insert_one(client)
        project = {"id": new_id("project"), "org_id": org_id, "client_id": client["id"],
                   "name": entity.get("title") or entity.get("company", "New Project"), "status": "active",
                   "progress": 0, "milestones": [], "created_at": now_iso()}
        await db.projects.insert_one(project)
        await db.deals.update_one({"id": entity["id"], "org_id": org_id},
                                  {"$set": {"converted": True, "client_created": True, "client_id": client["id"], "project_id": project["id"]}})
        acts.append("Client & project created")
    return acts


@api.get("/pipeline")
async def pipeline_feed(user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Not allowed")
    org_id = user["org_id"]
    leads = await db.leads.find({"org_id": org_id, "converted": {"$ne": True}}, {"_id": 0}).to_list(5000)
    deals = await db.deals.find({"org_id": org_id}, {"_id": 0}).to_list(5000)
    items = []
    for l in leads:
        items.append({"id": l["id"], "kind": "lead", "title": l.get("name"), "company": l.get("company", ""),
                      "stage": l.get("status") or "New", "value": parse_amount(l.get("budget")), "email": l.get("email", ""),
                      "assigned_name": l.get("assigned_name"), "score": l.get("score", 0), "contacted": bool(l.get("contacted"))})
    for d in deals:
        items.append({"id": d["id"], "kind": "deal", "title": d.get("title"), "company": d.get("company", ""),
                      "stage": d.get("stage") or "New", "value": parse_amount(d.get("value")), "email": d.get("email", ""),
                      "assigned_name": d.get("assigned_name")})
    return items


@api.post("/pipeline/{kind}/{item_id}/stage")
async def pipeline_move(kind: str, item_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Not allowed")
    if kind not in ("lead", "deal"):
        raise HTTPException(status_code=400, detail="Invalid kind")
    stage = payload.get("stage")
    org_id = user["org_id"]
    coll = "leads" if kind == "lead" else "deals"
    field = "status" if kind == "lead" else "stage"
    entity = await db[coll].find_one({"id": item_id, "org_id": org_id}, {"_id": 0})
    if not entity:
        raise HTTPException(status_code=404, detail="Not found")
    await db[coll].update_one({"id": item_id, "org_id": org_id}, {"$set": {field: stage}})
    entity[field] = stage
    actions = await apply_stage_effects(org_id, kind, entity, stage, user["user_id"])
    if str(stage).lower() == "won":
        actions += await won_conversion(org_id, kind, entity, user["user_id"])
    await log_activity(org_id, kind, item_id, f"Moved to {stage}", user["user_id"])
    return {"ok": True, "stage": stage, "actions": actions}


# ---------------------------------------------------------------------------
# Generic CRUD
# ---------------------------------------------------------------------------
def build_scope(user: dict, resource: str) -> dict:
    scope = {"org_id": user["org_id"]}
    if user.get("role") == "client":
        if resource not in CLIENT_READABLE:
            raise HTTPException(status_code=403, detail="Not allowed")
        scope["client_id"] = user.get("client_id")
    return scope


@generic.get("/{resource}")
async def list_resource(resource: str, request: Request, user: dict = Depends(get_current_user)):
    if resource not in RESOURCES:
        raise HTTPException(status_code=404, detail="Unknown resource")
    scope = build_scope(user, resource)
    # optional filters from query params
    for k, v in request.query_params.items():
        if k not in ("limit", "skip"):
            scope[k] = v
    docs = await db[RESOURCES[resource]].find(scope, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@generic.post("/{resource}")
async def create_resource(resource: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    if resource not in RESOURCES:
        raise HTTPException(status_code=404, detail="Unknown resource")
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Not allowed")
    payload.pop("_id", None)
    doc = dict(payload)
    doc["id"] = new_id(ID_PREFIX.get(resource, resource))
    doc["org_id"] = user["org_id"]
    doc["created_at"] = now_iso()
    doc["created_by"] = user["user_id"]
    if resource == "invoices":
        doc = compute_invoice_totals(doc)
    await db[RESOURCES[resource]].insert_one(doc)
    doc.pop("_id", None)
    await log_activity(user["org_id"], resource, doc["id"], f"Created {resource[:-1]}", user["user_id"])
    if resource == "leads":
        await ensure_contact_company(user["org_id"], doc)
    # event hooks
    if resource == "deals" and str(doc.get("stage", "")).lower() == "won":
        await run_automations(user["org_id"], "deal_won", {**doc, "entity_type": "deal", "entity_id": doc["id"]})
    if resource == "payments" and doc.get("invoice_id"):
        await apply_payment(user["org_id"], doc)
    return doc


@generic.get("/{resource}/{item_id}")
async def get_resource(resource: str, item_id: str, user: dict = Depends(get_current_user)):
    if resource not in RESOURCES:
        raise HTTPException(status_code=404, detail="Unknown resource")
    scope = build_scope(user, resource)
    scope["id"] = item_id
    doc = await db[RESOURCES[resource]].find_one(scope, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@generic.put("/{resource}/{item_id}")
async def update_resource(resource: str, item_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    if resource not in RESOURCES:
        raise HTTPException(status_code=404, detail="Unknown resource")
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Not allowed")
    payload.pop("_id", None)
    payload.pop("id", None)
    payload.pop("org_id", None)
    existing = await db[RESOURCES[resource]].find_one({"id": item_id, "org_id": user["org_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    merged = {**existing, **payload}
    if resource == "invoices":
        merged = compute_invoice_totals(merged)
    if resource == "leads" and "assigned_user_id" in payload:
        m = await db.users.find_one({"user_id": payload["assigned_user_id"], "org_id": user["org_id"]}, {"_id": 0})
        merged["assigned_name"] = m.get("name") if m else ""
    merged["updated_at"] = now_iso()
    await db[RESOURCES[resource]].update_one({"id": item_id, "org_id": user["org_id"]}, {"$set": merged})
    merged.pop("_id", None)
    prev_stage = str(existing.get("stage", "")).lower()
    new_stage = str(merged.get("stage", "")).lower()
    if resource == "deals" and new_stage == "won" and prev_stage != "won":
        await run_automations(user["org_id"], "deal_won", {**merged, "entity_type": "deal", "entity_id": item_id})
    return merged


@generic.delete("/{resource}/{item_id}")
async def delete_resource(resource: str, item_id: str, user: dict = Depends(get_current_user)):
    if resource not in RESOURCES:
        raise HTTPException(status_code=404, detail="Unknown resource")
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Not allowed")
    await db[RESOURCES[resource]].delete_one({"id": item_id, "org_id": user["org_id"]})
    return {"ok": True}


async def apply_payment(org_id: str, payment: dict):
    inv = await db.invoices.find_one({"id": payment["invoice_id"], "org_id": org_id}, {"_id": 0})
    if not inv:
        return
    inv["paid_amount"] = float(inv.get("paid_amount", 0) or 0) + float(payment.get("amount", 0) or 0)
    inv = compute_invoice_totals(inv)
    await db.invoices.update_one({"id": inv["id"], "org_id": org_id}, {"$set": inv})


# ---------------------------------------------------------------------------
# Convert deal -> client + project
# ---------------------------------------------------------------------------
@api.post("/deals/{deal_id}/convert")
async def convert_deal(deal_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Not allowed")
    deal = await db.deals.find_one({"id": deal_id, "org_id": user["org_id"]}, {"_id": 0})
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    client_doc = {
        "id": new_id("client"), "org_id": user["org_id"],
        "name": deal.get("company") or deal.get("title", "New Client"),
        "email": deal.get("email", ""), "company": deal.get("company", ""),
        "status": "active", "value": deal.get("value", 0), "created_at": now_iso(),
    }
    await db.clients.insert_one(client_doc)
    project_doc = {
        "id": new_id("project"), "org_id": user["org_id"], "client_id": client_doc["id"],
        "name": deal.get("title", "New Project"), "status": "active", "progress": 0,
        "milestones": [], "created_at": now_iso(),
    }
    await db.projects.insert_one(project_doc)
    await db.deals.update_one({"id": deal_id, "org_id": user["org_id"]}, {"$set": {"stage": "Won", "converted": True}})
    client_doc.pop("_id", None)
    project_doc.pop("_id", None)
    return {"client": client_doc, "project": project_doc}


# ---------------------------------------------------------------------------
# Website lead capture (public, no auth)
# ---------------------------------------------------------------------------
public = APIRouter(prefix="/api/public")


@public.get("/lead-capture.js")
async def lead_capture_js(site_id: str, request: Request):
    base = str(request.base_url).rstrip("/")
    js = """(function(){
  var SITE_ID="%s";
  var API="%s/api/public/capture";
  function utm(n){var m=new RegExp('[?&]'+n+'=([^&]*)').exec(window.location.search);return m?decodeURIComponent(m[1]):'';}
  function send(data){
    data.site_id=SITE_ID;data.page_url=window.location.href;data.referrer=document.referrer;
    data.utm_source=utm('utm_source');data.utm_medium=utm('utm_medium');data.utm_campaign=utm('utm_campaign');
    fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  }
  document.addEventListener('submit',function(e){
    var f=e.target;if(!f.matches('[data-crm-form]'))return;e.preventDefault();
    var d={};Array.prototype.forEach.call(f.elements,function(el){if(el.name)d[el.name]=el.value;});
    send(d);f.reset();alert('Thank you! We will be in touch shortly.');
  });
  window.CRMCapture={submit:send};
})();""" % (site_id, base)
    return PlainTextResponse(js, media_type="application/javascript")


async def create_lead_from_capture(site: dict, data: dict) -> dict:
    org_id = site["org_id"]
    email = (data.get("email") or "").lower().strip()
    phone = data.get("phone", "")
    # duplicate detection
    dup = None
    if email:
        dup = await db.leads.find_one({"org_id": org_id, "email": email}, {"_id": 0})
    if not dup and phone:
        dup = await db.leads.find_one({"org_id": org_id, "phone": phone}, {"_id": 0})
    meta = {
        "page_url": data.get("page_url"), "referrer": data.get("referrer"),
        "utm_source": data.get("utm_source"), "utm_medium": data.get("utm_medium"),
        "utm_campaign": data.get("utm_campaign"), "message": data.get("message"),
    }
    if dup:
        await db.leads.update_one({"id": dup["id"], "org_id": org_id},
                                  {"$set": {"last_submission": now_iso(), "duplicate_count": dup.get("duplicate_count", 0) + 1, "meta": meta}})
        return {"duplicate": True, "lead_id": dup["id"]}
    lead = {
        "id": new_id("lead"), "org_id": org_id, "name": data.get("name", "Website Visitor"),
        "email": email, "phone": phone, "company": data.get("company", ""),
        "website": data.get("website", ""), "location": data.get("location", ""),
        "source": "Website", "service": data.get("service", ""), "budget": data.get("budget", ""),
        "status": "New", "score": 40, "notes": data.get("message", ""),
        "site_id": site["id"], "meta": meta, "created_at": now_iso(),
    }
    await db.leads.insert_one(lead)
    lead.pop("_id", None)
    await run_automations(org_id, "new_website_lead", {**lead, "entity_type": "lead", "entity_id": lead["id"]})
    return {"duplicate": False, "lead_id": lead["id"]}


@public.post("/capture")
async def capture(payload: Dict[str, Any]):
    site_id = payload.get("site_id")
    site = await db.websites.find_one({"id": site_id}, {"_id": 0})
    if not site:
        raise HTTPException(status_code=404, detail="Unknown site")
    return await create_lead_from_capture(site, payload)


@public.get("/forms/{form_id}")
async def public_form(form_id: str):
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return {"id": form["id"], "name": form.get("name"), "fields": form.get("fields", []), "submit_text": form.get("submit_text", "Submit")}


@public.post("/forms/{form_id}/submit")
async def submit_form(form_id: str, payload: Dict[str, Any]):
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    site = {"id": form.get("site_id", ""), "org_id": form["org_id"]}
    result = await create_lead_from_capture(site, payload)
    await db.forms.update_one({"id": form_id}, {"$inc": {"submissions": 1}})
    return result


# ---------------------------------------------------------------------------
# AI Assistant
# ---------------------------------------------------------------------------
async def build_crm_context(org_id: str) -> str:
    leads = await db.leads.find({"org_id": org_id}, {"_id": 0}).to_list(500)
    deals = await db.deals.find({"org_id": org_id}, {"_id": 0}).to_list(500)
    invoices = await db.invoices.find({"org_id": org_id}, {"_id": 0}).to_list(500)
    clients = await db.clients.find({"org_id": org_id}, {"_id": 0}).to_list(500)
    tasks = await db.tasks.find({"org_id": org_id}, {"_id": 0}).to_list(500)

    def brief(items, fields):
        out = []
        for it in items[:60]:
            out.append({f: it.get(f) for f in fields})
        return out

    import json
    ctx = {
        "leads": brief(leads, ["name", "email", "source", "status", "score", "budget", "follow_up_date", "assigned_user_id"]),
        "deals": brief(deals, ["title", "value", "stage", "company", "expected_close"]),
        "invoices": brief(invoices, ["number", "client_id", "total", "paid_amount", "pending_amount", "status", "due_date"]),
        "clients": brief(clients, ["name", "company", "status", "value"]),
        "tasks": brief(tasks, ["title", "status", "priority", "due_date"]),
    }
    return json.dumps(ctx, default=str)


@api.post("/ai/chat")
async def ai_chat(inp: ChatInput, user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI not configured")
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    context = await build_crm_context(user["org_id"])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    system = (
        "You are the AI assistant inside a CRM. Answer questions ONLY using the JSON CRM data provided below. "
        "Be concise, use bullet points and numbers. If asked to draft a message, write a short professional one. "
        f"Today is {today}. This data belongs to a single organization; never invent data for other organizations.\n\n"
        f"CRM_DATA:\n{context}"
    )
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"crm_{user['user_id']}", system_message=system).with_model("openai", "gpt-5.4")
    try:
        reply = await chat.send_message(UserMessage(text=inp.message))
    except Exception as e:
        logger.error(f"AI error: {e}")
        raise HTTPException(status_code=500, detail="AI request failed")
    return {"reply": reply}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@api.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    return await db.notifications.find({"org_id": user["org_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------
app.include_router(api)
app.include_router(public)
app.include_router(generic)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------
async def seed():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id")
    for coll in RESOURCES.values():
        await db[coll].create_index("org_id")

    admin_email = os.environ.get("ADMIN_EMAIL", "").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
    if not admin_email:
        return
    existing = await db.users.find_one({"email": admin_email})
    if existing:
        return
    org = await create_org("Acme Agency")
    org_id = org["id"]
    owner = {
        "user_id": new_id("user"), "org_id": org_id, "email": admin_email,
        "name": "Glenn Muyskens", "role": "owner", "password_hash": hash_password(admin_password),
        "avatar": "", "auth_provider": "password", "created_at": now_iso(),
    }
    await db.users.insert_one(owner)

    # client portal demo user
    demo_client = {
        "id": new_id("client"), "org_id": org_id, "name": "Nimbus Retail",
        "email": "client@demo.com", "company": "Nimbus Retail", "status": "active",
        "value": 24000, "created_at": now_iso(),
    }
    await db.clients.insert_one(demo_client)
    client_user = {
        "user_id": new_id("user"), "org_id": org_id, "email": "client@demo.com",
        "name": "Nimbus Retail", "role": "client", "password_hash": hash_password("Client@12345"),
        "avatar": "", "auth_provider": "password", "client_id": demo_client["id"], "created_at": now_iso(),
    }
    await db.users.insert_one(client_user)

    # website
    site = {"id": new_id("site"), "org_id": org_id, "name": "Main Website", "domain": "acme.com",
            "platform": "custom", "status": "connected", "created_at": now_iso()}
    await db.websites.insert_one(site)

    # form
    form = {"id": new_id("form"), "org_id": org_id, "name": "Contact Us", "site_id": site["id"],
            "submit_text": "Send enquiry", "submissions": 0,
            "fields": [
                {"name": "name", "label": "Full Name", "type": "text", "required": True},
                {"name": "email", "label": "Email", "type": "email", "required": True},
                {"name": "phone", "label": "Phone", "type": "text", "required": False},
                {"name": "service", "label": "Service Interested In", "type": "select", "options": DEFAULT_SERVICES},
                {"name": "budget", "label": "Budget", "type": "text"},
                {"name": "message", "label": "Message", "type": "textarea"},
            ], "created_at": now_iso()}
    await db.forms.insert_one(form)

    # demo leads
    sample_leads = [
        ("Sarah Chen", "sarah@brightco.com", "BrightCo", "Website", "Qualified", 68, "8000"),
        ("Marcus Reid", "marcus@finlytics.io", "Finlytics", "Google", "Contacted", 52, "15000"),
        ("Ava Thompson", "ava@meridian.com", "Meridian", "Referral", "New", 40, "5000"),
        ("Diego Santos", "diego@nimbus.com", "Nimbus Retail", "Ads", "Meeting", 74, "24000"),
        ("Lena Fischer", "lena@orbit.co", "Orbit", "Social Media", "Proposal", 80, "12000"),
        ("Tom Baker", "tom@peakhr.com", "Peak HR", "Email", "New", 33, "3000"),
    ]
    for i, (n, e, c, s, st, sc, b) in enumerate(sample_leads):
        await db.leads.insert_one({
            "id": new_id("lead"), "org_id": org_id, "name": n, "email": e, "company": c,
            "phone": f"+1 555 010{i}", "source": s, "status": st, "score": sc, "budget": b,
            "service": DEFAULT_SERVICES[i % len(DEFAULT_SERVICES)], "location": "United States",
            "notes": "", "created_at": now_iso(),
        })

    deals = [
        ("BrightCo Website Revamp", 8000, "Qualified", "BrightCo"),
        ("Finlytics Growth Retainer", 15000, "Negotiation", "Finlytics"),
        ("Nimbus Retail Platform", 24000, "Won", "Nimbus Retail"),
        ("Orbit Brand Campaign", 12000, "Proposal", "Orbit"),
        ("Meridian Consulting", 5000, "New", "Meridian"),
    ]
    for t, v, st, c in deals:
        await db.deals.insert_one({
            "id": new_id("deal"), "org_id": org_id, "title": t, "value": v, "stage": st,
            "company": c, "expected_close": (datetime.now(timezone.utc) + timedelta(days=20)).isoformat()[:10],
            "created_at": now_iso(),
        })

    proj = {"id": new_id("project"), "org_id": org_id, "client_id": demo_client["id"],
            "name": "Nimbus Retail Platform", "status": "active", "progress": 45,
            "deadline": (datetime.now(timezone.utc) + timedelta(days=40)).isoformat()[:10],
            "milestones": [
                {"title": "Discovery", "done": True}, {"title": "Design", "done": True},
                {"title": "Development", "done": False}, {"title": "Launch", "done": False},
            ], "created_at": now_iso()}
    await db.projects.insert_one(proj)

    for tt, pr, stt in [("Kickoff call with Nimbus", "high", "done"), ("Send design mockups", "high", "todo"),
                        ("Follow up BrightCo proposal", "medium", "todo"), ("Prepare Q3 report", "low", "todo")]:
        await db.tasks.insert_one({
            "id": new_id("task"), "org_id": org_id, "title": tt, "priority": pr, "status": stt,
            "project_id": proj["id"], "client_id": demo_client["id"],
            "due_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()[:10], "created_at": now_iso(),
        })

    inv = {"id": new_id("inv"), "org_id": org_id, "client_id": demo_client["id"], "number": "INV-1001",
           "items": [{"description": "Platform build - phase 1", "quantity": 1, "price": 12000}],
           "tax": 600, "discount": 0, "paid_amount": 12600, "due_date": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()[:10],
           "created_at": now_iso()}
    inv = compute_invoice_totals(inv)
    await db.invoices.insert_one(inv)
    inv2 = {"id": new_id("inv"), "org_id": org_id, "client_id": demo_client["id"], "number": "INV-1002",
            "items": [{"description": "Platform build - phase 2", "quantity": 1, "price": 12000}],
            "tax": 600, "discount": 0, "paid_amount": 0, "due_date": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()[:10],
            "created_at": now_iso()}
    inv2 = compute_invoice_totals(inv2)
    await db.invoices.insert_one(inv2)

    await db.payments.insert_one({"id": new_id("pay"), "org_id": org_id, "invoice_id": inv["id"],
                                  "client_id": demo_client["id"], "amount": 12600, "method": "Bank Transfer",
                                  "status": "completed", "date": now_iso()[:10], "created_at": now_iso()})

    await db.proposals.insert_one({"id": new_id("prop"), "org_id": org_id, "client_id": demo_client["id"],
                                   "title": "Nimbus Retail Proposal", "type": "proposal", "amount": 24000,
                                   "status": "Accepted", "created_at": now_iso()})
    await db.contracts.insert_one({"id": new_id("ctr"), "org_id": org_id, "client_id": demo_client["id"],
                                   "title": "Master Services Agreement", "type": "contract", "amount": 24000,
                                   "status": "Sent", "created_at": now_iso()})

    await db.campaigns.insert_one({"id": new_id("camp"), "org_id": org_id, "name": "Q3 Google Ads", "channel": "Google Ads",
                                   "status": "active", "budget": 5000, "spent": 3200, "leads": 42, "revenue": 18000, "created_at": now_iso()})
    await db.campaigns.insert_one({"id": new_id("camp"), "org_id": org_id, "name": "LinkedIn Outreach", "channel": "Social Media",
                                   "status": "active", "budget": 2000, "spent": 1400, "leads": 18, "revenue": 9000, "created_at": now_iso()})

    await db.automations.insert_one({"id": new_id("auto"), "org_id": org_id, "name": "New website lead follow-up",
                                     "trigger": "new_website_lead", "enabled": True,
                                     "actions": [{"type": "create_follow_up", "days": 1}, {"type": "notify", "message": "New website lead received"}],
                                     "created_at": now_iso()})
    await db.automations.insert_one({"id": new_id("auto"), "org_id": org_id, "name": "Deal won -> create client & project",
                                     "trigger": "deal_won", "enabled": True,
                                     "actions": [{"type": "create_client"}, {"type": "create_project"}, {"type": "notify", "message": "Deal won!"}],
                                     "created_at": now_iso()})
    logger.info("Seed complete")


@app.on_event("startup")
async def startup():
    try:
        await seed()
    except Exception as e:
        logger.error(f"seed failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
