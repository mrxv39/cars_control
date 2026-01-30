import json
import os
import re

from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction

from companies.models import Company
from leads.models import Lead, Activity


PHONE_RE = re.compile(r"(\+?\d[\d\s\-().]{6,}\d)")
EMAIL_RE = re.compile(r"([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})", re.IGNORECASE)


def _get_inbound_token():
    # Token desde variable de entorno para no tocar settings.py
    return (os.getenv("INBOUND_LEADS_TOKEN") or "").strip()


def _unauthorized(msg="Unauthorized"):
    return JsonResponse({"ok": False, "error": msg}, status=401)


def _bad_request(msg="Bad request"):
    return JsonResponse({"ok": False, "error": msg}, status=400)


def _extract_email_fallback(text: str) -> str:
    m = EMAIL_RE.search(text or "")
    return m.group(1) if m else ""


def _extract_phone_fallback(text: str) -> str:
    m = PHONE_RE.search(text or "")
    return m.group(1).strip() if m else ""


@csrf_exempt
def inbound_lead_from_gmail(request):
    """
    Endpoint para que Google Apps Script cree leads.
    Seguridad: header X-Inbound-Token debe coincidir con env INBOUND_LEADS_TOKEN.

    Payload JSON esperado (mínimo):
    {
      "company_slug": "ricars",
      "name": "Juan",
      "email": "juan@email.com",
      "phone": "600...",
      "vehicle_id": 123,          (opcional)
      "vehicle_text": "dacia..."  (opcional)
      "gmail": {
         "messageId": "...",
         "threadId": "...",
         "from": "...",
         "subject": "...",
         "date": "..."
      }
    }
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    token = _get_inbound_token()
    if not token:
        return _unauthorized("Server missing INBOUND_LEADS_TOKEN env var.")

    provided = (request.headers.get("X-Inbound-Token") or "").strip()
    if provided != token:
        return _unauthorized("Invalid token.")

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return _bad_request("Invalid JSON.")

    company_slug = (payload.get("company_slug") or "").strip()
    if not company_slug:
        return _bad_request("company_slug is required.")

    try:
        company = Company.objects.get(slug=company_slug)
    except Company.DoesNotExist:
        return _bad_request(f"Company not found: {company_slug}")

    name = (payload.get("name") or "").strip() or "Lead (Gmail)"
    email_addr = (payload.get("email") or "").strip()
    phone = (payload.get("phone") or "").strip()

    # Fallbacks (por si el script no encuentra algo)
    raw_text = (payload.get("raw_text") or "").strip()
    if not email_addr:
        email_addr = _extract_email_fallback(raw_text)
    if not phone:
        phone = _extract_phone_fallback(raw_text)

    vehicle = None
    vehicle_id = payload.get("vehicle_id", None)
    vehicle_text = (payload.get("vehicle_text") or "").strip()

    if vehicle_id is not None:
        try:
            from inventory.models import Vehicle
            vehicle = Vehicle.objects.filter(company=company, pk=int(vehicle_id)).first()
        except Exception:
            vehicle = None

    gmail_meta = payload.get("gmail") or {}
    subject = (gmail_meta.get("subject") or "").strip()
    from_addr = (gmail_meta.get("from") or "").strip()
    msg_id = (gmail_meta.get("messageId") or "").strip()
    thread_id = (gmail_meta.get("threadId") or "").strip()
    date_str = (gmail_meta.get("date") or "").strip()

    # Evitar duplicados: si ya procesamos este messageId, no crear otra vez
    if msg_id:
        exists = Activity.objects.filter(
            text__icontains=f"gmail_message_id={msg_id}"
        ).exists()
        if exists:
            return JsonResponse({"ok": True, "skipped": True, "reason": "duplicate_messageId"})

    with transaction.atomic():
        lead = Lead.objects.create(
            company=company,
            name=name[:120],
            email=email_addr[:254],
            phone=phone[:50],
            source=Lead.Source.WEB if "WEB" in Lead.Source.values else Lead.Source.OTHER,
            stage=Lead.Stage.NEW,
            vehicle=vehicle,
        )

        extra = []
        if vehicle_text:
            extra.append(f"vehicle_text={vehicle_text}")
        if vehicle_id is not None:
            extra.append(f"vehicle_id={vehicle_id}")

        meta_lines = [
            "Lead importado desde Gmail (Apps Script).",
            f"gmail_message_id={msg_id}" if msg_id else "gmail_message_id=",
            f"gmail_thread_id={thread_id}" if thread_id else "gmail_thread_id=",
            f"from={from_addr}",
            f"subject={subject}",
            f"date={date_str}",
        ]
        if extra:
            meta_lines.append(" ".join(extra))

        if raw_text:
            meta_lines.append("")
            meta_lines.append("RAW:")
            meta_lines.append(raw_text[:4000])  # evitar notas enormes

        Activity.objects.create(
            lead=lead,
            type=Activity.Type.NOTE,
            text="\n".join(meta_lines),
        )

    return JsonResponse({"ok": True, "lead_id": lead.id})
