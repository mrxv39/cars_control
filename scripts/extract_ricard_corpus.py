"""
Extrae pares (mensaje del lead -> respuesta de Ricard) desde un mbox de
Google Takeout de codinacars@gmail.com.

Uso:
    python scripts/extract_ricard_corpus.py \\
        --mbox "docs/takeout-20260407T135234Z-3-001.zip" \\
        --out  "data/ricard_corpus.jsonl"

Acepta tanto un .mbox directo como un .zip de Takeout (extrae el mbox a un
temporal). Idempotente: re-ejecutarlo sobre el mismo --out no duplica filas
(clave = sha1 del Message-ID de la respuesta de Ricard).

Privacidad: la salida contiene datos personales de leads. NUNCA commitear el
jsonl. data/ ya esta en .gitignore.
"""

from __future__ import annotations

import argparse
import email
import email.policy
import hashlib
import json
import mailbox
import random
import re
import sys
import zipfile
from email.message import Message
from pathlib import Path
from typing import Iterator

RICARD_ADDR = "richithp@gmail.com"  # email real de Ricard en el Takeout
LEAD_DOMAINS = (
    "contactos.coches.net",
    "coches.net",
    "adevinta",
    "milanuncios",
    "vehiculosocasion",
)

QUOTE_LINE_RE = re.compile(r"^\s*>")
ON_WROTE_RE = re.compile(
    r"^\s*El\s.+escribi[oó]:\s*$|^\s*On\s.+wrote:\s*$",
    re.IGNORECASE,
)
SIGNATURE_MARKERS = (
    "-- ",
    "Enviado desde mi",
    "Sent from my",
    "Get Outlook for",
)


def strip_html(html: str) -> str:
    try:
        from bs4 import BeautifulSoup  # type: ignore
    except ImportError:
        # Fallback bobo: quita tags con regex
        return re.sub(r"<[^>]+>", " ", html)
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    return soup.get_text("\n")


def get_body_text(msg: Message) -> str:
    """Devuelve el cuerpo en texto plano, prefiriendo text/plain."""
    plain_parts: list[str] = []
    html_parts: list[str] = []
    for part in msg.walk():
        if part.is_multipart():
            continue
        ctype = part.get_content_type()
        if ctype not in ("text/plain", "text/html"):
            continue
        try:
            raw = part.get_payload(decode=True) or b""
            charset = part.get_content_charset() or "utf-8"
            payload = raw.decode(charset, errors="replace")
        except Exception:
            continue
        if ctype == "text/plain":
            plain_parts.append(payload)
        else:
            html_parts.append(payload)
    if plain_parts:
        return "\n".join(plain_parts)
    if html_parts:
        return strip_html("\n".join(html_parts))
    return ""


def clean_reply(text: str) -> str:
    """Quita citas, firmas y huecos del cuerpo de una respuesta."""
    lines = text.replace("\r\n", "\n").split("\n")
    cleaned: list[str] = []
    for line in lines:
        if QUOTE_LINE_RE.match(line):
            break
        if ON_WROTE_RE.match(line):
            break
        if line.strip().startswith(SIGNATURE_MARKERS):
            break
        cleaned.append(line)
    out = "\n".join(cleaned).strip()
    # colapsa lineas en blanco multiples
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out


def hget(msg: Message, header: str) -> str:
    """Lee un header como str sin reventar con headers RFC2047 o malformados."""
    try:
        v = msg.get(header)
    except Exception:
        return ""
    if v is None:
        return ""
    try:
        return str(v)
    except Exception:
        return ""


def header_addresses(msg: Message, header: str) -> list[str]:
    raw = hget(msg, header)
    if not raw:
        return []
    return [m.group(0).lower() for m in re.finditer(r"[\w.+-]+@[\w-]+\.[\w.-]+", raw)]


def is_from_ricard(msg: Message) -> bool:
    return any(RICARD_ADDR in a for a in header_addresses(msg, "From"))


def thread_touches_lead_source(msg: Message) -> bool:
    """True si el hilo tiene aroma a coches.net (subject o destinatarios)."""
    subject = hget(msg, "Subject").lower()
    if any(d in subject for d in LEAD_DOMAINS):
        return True
    addrs: list[str] = []
    for h in ("To", "Cc", "From", "Reply-To"):
        addrs.extend(header_addresses(msg, h))
    return any(any(d in a for d in LEAD_DOMAINS) for a in addrs)


def parse_refs(msg: Message) -> list[str]:
    refs: list[str] = []
    for h in ("In-Reply-To", "References"):
        raw = hget(msg, h)
        if not raw:
            continue
        refs.extend(re.findall(r"<[^>]+>", raw))
    return refs


def normalize_msgid(value: str | None) -> str:
    if not value:
        return ""
    m = re.search(r"<[^>]+>", value)
    return m.group(0) if m else value.strip()


def extract_vehicle_hint(subject: str) -> str:
    """Heuristico: pilla la marca/modelo del subject estilo coches.net."""
    if not subject:
        return ""
    s = re.sub(r"^(re|fwd|rv|fw):\s*", "", subject.strip(), flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s)
    return s[:120]


def iter_mbox(path: Path) -> Iterator[Message]:
    """Itera mensajes de un mbox de forma streaming."""
    box = mailbox.mbox(str(path), factory=lambda f: email.message_from_binary_file(f, policy=email.policy.compat32))
    try:
        for key in box.keys():
            try:
                yield box[key]
            except Exception as exc:
                print(f"  ! mensaje {key} ilegible: {exc}", file=sys.stderr)
    finally:
        box.close()


def maybe_extract_zip(input_path: Path) -> Path:
    """Si input es un .zip, extrae el primer .mbox al cache en data/ y lo devuelve."""
    if input_path.suffix.lower() != ".zip":
        return input_path
    # Cache permanente en data/ para no re-extraer 1.85GB en cada run
    cache = Path("data") / f"{input_path.stem}.mbox"
    if cache.exists():
        print(f"-> Usando mbox cacheado en {cache}")
        return cache
    print(f"-> Detectado zip, extrayendo mbox de {input_path.name} a {cache} ...")
    cache.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(input_path) as zf:
        mbox_names = [n for n in zf.namelist() if n.lower().endswith(".mbox")]
        if not mbox_names:
            raise SystemExit("El zip no contiene ningun .mbox")
        with zf.open(mbox_names[0]) as src, open(cache, "wb") as dst:
            while True:
                chunk = src.read(1024 * 1024)
                if not chunk:
                    break
                dst.write(chunk)
        size_mb = cache.stat().st_size / (1024 * 1024)
        print(f"   extraido ({size_mb:.0f} MB)")
        return cache


def load_existing_keys(out_path: Path) -> set[str]:
    if not out_path.exists():
        return set()
    keys: set[str] = set()
    with out_path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            k = row.get("key")
            if k:
                keys.add(k)
    return keys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mbox", required=True, help="Ruta al .mbox o al .zip de Takeout")
    parser.add_argument("--out", required=True, help="Ruta al jsonl de salida")
    parser.add_argument("--limit", type=int, default=0, help="Cortar tras N pares (0 = sin limite)")
    args = parser.parse_args()

    src = Path(args.mbox)
    if not src.exists():
        print(f"No existe: {src}", file=sys.stderr)
        return 1

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    mbox_path = maybe_extract_zip(src)

    # ---- pasada 1: indexar mensajes por Message-ID (solo metadata + body lazy)
    print("-> Pasada 1/2: indexando mensajes por Message-ID ...")
    by_msgid: dict[str, dict] = {}
    ricard_replies: list[str] = []
    total = 0
    for msg in iter_mbox(mbox_path):
        total += 1
        if total % 5000 == 0:
            print(f"   {total} mensajes indexados...")
        msgid = normalize_msgid(hget(msg, "Message-ID"))
        if not msgid:
            continue
        from_ricard = is_from_ricard(msg)
        from_addrs = header_addresses(msg, "From")
        from_lead = any(any(d in a for d in LEAD_DOMAINS) for a in from_addrs)
        subj_lead = any(d in hget(msg, "Subject").lower() for d in LEAD_DOMAINS)
        # Indexamos TODO para poder reconstruir cadenas de References completas
        by_msgid[msgid] = {
            "from_ricard": from_ricard,
            "from_lead": from_lead or subj_lead,
            "subject": hget(msg, "Subject"),
            "date": hget(msg, "Date"),
            "in_reply_to": normalize_msgid(hget(msg, "In-Reply-To")),
            "refs": parse_refs(msg),
            "body": None,
        }
        if from_ricard and (hget(msg, "In-Reply-To") or hget(msg, "References")):
            ricard_replies.append(msgid)

    print(f"   total mensajes: {total}")
    print(f"   indexados (Ricard o lead-domain): {len(by_msgid)}")
    print(f"   respuestas de Ricard a hilos de lead: {len(ricard_replies)}")

    if not ricard_replies:
        print("No hay respuestas de Ricard encontradas. Nada que extraer.")
        return 0

    # ---- pasada 2: rellenar body solo para los Message-IDs que necesitamos
    needed: set[str] = set()
    for rid in ricard_replies:
        needed.add(rid)
        meta = by_msgid[rid]
        for ref in [meta["in_reply_to"], *meta["refs"]]:
            if ref:
                needed.add(ref)

    print(f"-> Pasada 2/2: leyendo cuerpo de {len(needed)} mensajes necesarios ...")
    seen = 0
    for msg in iter_mbox(mbox_path):
        msgid = normalize_msgid(hget(msg, "Message-ID"))
        if msgid in needed and msgid in by_msgid and by_msgid[msgid]["body"] is None:
            by_msgid[msgid]["body"] = get_body_text(msg)
            seen += 1
            if seen % 500 == 0:
                print(f"   {seen}/{len(needed)} cuerpos leidos...")
        if seen >= len(needed):
            break

    # ---- emparejar
    print("-> Emparejando lead -> Ricard ...")
    existing = load_existing_keys(out_path)
    pairs_written = 0
    samples: list[dict] = []
    with out_path.open("a", encoding="utf-8") as f:
        for rid in ricard_replies:
            meta = by_msgid[rid]
            key = hashlib.sha1(rid.encode("utf-8")).hexdigest()
            if key in existing:
                continue
            # Buscar el padre: primero In-Reply-To, luego ultimo de References
            parent = None
            candidates = []
            if meta["in_reply_to"]:
                candidates.append(meta["in_reply_to"])
            candidates.extend(reversed(meta["refs"]))
            for cid in candidates:
                cand = by_msgid.get(cid)
                if cand and cand.get("from_lead") and not cand.get("from_ricard"):
                    parent = cand
                    break
            if not parent or not parent.get("body"):
                continue
            ricard_body = clean_reply(meta.get("body") or "")
            lead_body = clean_reply(parent.get("body") or "")
            if len(ricard_body) < 5 or len(lead_body) < 5:
                continue
            row = {
                "key": key,
                "date": meta["date"],
                "vehicle_hint": extract_vehicle_hint(meta["subject"]),
                "lead_msg": lead_body,
                "ricard_reply": ricard_body,
            }
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            pairs_written += 1
            if len(samples) < 3:
                samples.append(row)
            if args.limit and pairs_written >= args.limit:
                break

    print()
    print(f"OK -> {pairs_written} pares nuevos escritos en {out_path}")
    print(f"     (ya existian {len(existing)} en el fichero, no se han duplicado)")
    if samples:
        print()
        print("Muestras (3 al azar de los nuevos):")
        random.shuffle(samples)
        for i, s in enumerate(samples, 1):
            print(f"\n--- Muestra {i} [{s['vehicle_hint'] or '(sin asunto)'}] ---")
            safe_lead = s["lead_msg"][:400].encode("ascii", "replace").decode("ascii")
            safe_ric = s["ricard_reply"][:400].encode("ascii", "replace").decode("ascii")
            print(f"LEAD ({len(s['lead_msg'])} chars):")
            print(safe_lead)
            print(f"\nRICARD ({len(s['ricard_reply'])} chars):")
            print(safe_ric)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
