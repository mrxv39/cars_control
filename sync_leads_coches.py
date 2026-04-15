"""
Sync leads from coches.net email notifications to Supabase.

This script:
1. Connects to Gmail via IMAP
2. Reads unread emails from coches.net (noreply@coches.net or similar)
3. Parses contact info (name, phone, vehicle interest)
4. Creates leads in Supabase
5. Parses follow-up conversation messages and stores them in lead_messages
6. Marks emails as read

Run periodically (e.g. every 5 minutes via cron/task scheduler)

Setup:
  1. Enable IMAP in Gmail: Settings > See all settings > Forwarding and POP/IMAP > Enable IMAP
  2. Create App Password: Google Account > Security > 2-Step Verification > App passwords
  3. Set environment variables:
     GMAIL_USER=codinacars@gmail.com
     GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
"""
import imaplib
import email
from email.header import decode_header
import re
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
from supabase import create_client

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://kpgkcersrfvzncqupkxa.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
if not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_ANON_KEY env var is required. Set it in .env")

GMAIL_USER = os.environ.get('GMAIL_USER', 'codinacars@gmail.com')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')

COMPANY_ID = 1  # CodinaCars
DEALER_NAME = 'Codina Cars'

# Known coches.net sender patterns
COCHES_NET_SENDERS = ['coches.net', 'adevinta', 'noreply']

# Spanish month names for timestamp parsing
MONTH_MAP = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
}


def decode_mime_header(header):
    """Decode a MIME-encoded email header."""
    parts = decode_header(header)
    decoded = []
    for part, encoding in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(encoding or 'utf-8', errors='replace'))
        else:
            decoded.append(part)
    return ''.join(decoded)


def get_email_body(msg):
    """Extract text body from email message."""
    body = ''
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type == 'text/plain':
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or 'utf-8'
                    body += payload.decode(charset, errors='replace')
            elif content_type == 'text/html' and not body:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or 'utf-8'
                    html = payload.decode(charset, errors='replace')
                    body = re.sub(r'<[^>]+>', ' ', html)
                    body = re.sub(r'\s+', ' ', body)
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or 'utf-8'
            body = payload.decode(charset, errors='replace')
    return body


def is_followup_email(subject, body):
    """Detect if this is a follow-up conversation email (not a new lead)."""
    has_new_message = bool(re.search(r'nuevo mensaje|nuevo De ', body, re.I))
    has_mensajes_anteriores = 'Mensajes anteriores' in body
    return has_new_message or has_mensajes_anteriores


def parse_spanish_timestamp(date_str):
    """Parse timestamps like '22 marzo, 23:49' or '23 marzo, 07:36'."""
    m = re.match(r'(\d{1,2})\s+(\w+),?\s+(\d{1,2}):(\d{2})', date_str.strip())
    if not m:
        return None
    day, month_name, hour, minute = m.groups()
    month = MONTH_MAP.get(month_name.lower())
    if not month:
        return None
    year = datetime.now().year
    try:
        return datetime(year, month, int(day), int(hour), int(minute))
    except ValueError:
        return None


def parse_conversation_messages(body):
    """Parse all messages from a follow-up email conversation.

    Returns list of dicts: {sender, sender_name, content, timestamp}
    """
    messages = []

    # 1. Parse the NEW message (appears after "nuevo De NAME")
    new_msg_match = re.search(r'nuevo\s+De\s+(.+?)\s*\n(.+?)(?=Mensajes anteriores|Responde|$)', body, re.I | re.DOTALL)
    if new_msg_match:
        sender_name = new_msg_match.group(1).strip()
        content = new_msg_match.group(2).strip()
        # Clean up content
        content = re.sub(r'\s*Responde a este email.*', '', content, flags=re.I | re.DOTALL).strip()
        if content:
            is_dealer = sender_name.lower() in [DEALER_NAME.lower(), 'codina cars', 'codinacars']
            messages.append({
                'sender': 'dealer' if is_dealer else 'lead',
                'sender_name': sender_name,
                'content': content,
                'timestamp': datetime.now(),
            })

    # 2. Parse "Mensajes anteriores" section
    anteriores = re.split(r'Mensajes anteriores', body, flags=re.I)
    if len(anteriores) > 1:
        history = anteriores[1]
        # Pattern: NAME\nDATE\nCONTENT (repeated)
        # Split by name+date pattern
        blocks = re.split(r'\n\s*([A-ZÀ-Ú][a-záéíóúñ]*(?:\s+[A-ZÀ-Ú][a-záéíóúñ]*)*|Codina Cars)\s*\n\s*(\d{1,2}\s+\w+,?\s+\d{1,2}:\d{2})\s*\n', history)

        # blocks[0] is before first match, then groups of 3: name, date, content
        i = 1
        while i + 2 < len(blocks):
            sender_name = blocks[i].strip()
            date_str = blocks[i + 1].strip()
            content = blocks[i + 2].strip()
            i += 3

            # Clean content
            content = re.sub(r'\s*Responde a este email.*', '', content, flags=re.I | re.DOTALL).strip()
            content = re.sub(r'\s*Ver anuncio.*', '', content, flags=re.I | re.DOTALL).strip()
            if not content:
                continue

            ts = parse_spanish_timestamp(date_str)
            if not ts:
                continue

            is_dealer = sender_name.lower() in [DEALER_NAME.lower(), 'codina cars', 'codinacars']
            messages.append({
                'sender': 'dealer' if is_dealer else 'lead',
                'sender_name': sender_name,
                'content': content,
                'timestamp': ts,
            })

    return messages


def find_existing_lead(sb, body, subject):
    """Find existing lead for a follow-up conversation."""
    # Extract lead name from body
    name_match = re.search(r'nuevo\s+De\s+(.+)', body, re.I)
    lead_name = name_match.group(1).strip() if name_match else None

    # Extract vehicle from URL in body (follow-up emails contain the ad URL)
    vehicle_match = re.search(r'coches\.net/[^\s]*?/([a-z0-9-]+)-\d+\.htm', body, re.I)
    vehicle_hint = vehicle_match.group(1).replace('-', ' ') if vehicle_match else None

    if lead_name:
        result = sb.table('leads').select('id').eq('company_id', COMPANY_ID).eq('canal', 'coches.net').ilike('name', f'%{lead_name}%').execute()
        if result.data:
            return result.data[0]['id']

    if vehicle_hint:
        result = sb.table('leads').select('id').eq('company_id', COMPANY_ID).eq('canal', 'coches.net').ilike('vehicle_interest', f'%{vehicle_hint[:20]}%').execute()
        if result.data:
            return result.data[0]['id']

    return None


def insert_messages(sb, lead_id, messages, gmail_message_id):
    """Insert messages into lead_messages, deduplicating."""
    if not messages:
        return 0

    # Get existing messages for this lead to deduplicare
    existing = sb.table('lead_messages').select('timestamp, sender, content').eq('lead_id', lead_id).execute()
    existing_keys = set()
    for e in (existing.data or []):
        key = (e['timestamp'][:16], e['sender'], e['content'][:50])
        existing_keys.add(key)

    inserted = 0
    for msg in messages:
        ts_str = msg['timestamp'].isoformat() if isinstance(msg['timestamp'], datetime) else msg['timestamp']
        key = (ts_str[:16], msg['sender'], msg['content'][:50])
        if key in existing_keys:
            continue

        sb.table('lead_messages').insert({
            'lead_id': lead_id,
            'company_id': COMPANY_ID,
            'sender': msg['sender'],
            'sender_name': msg['sender_name'],
            'content': msg['content'],
            'timestamp': ts_str,
            'source': 'coches.net',
            'gmail_message_id': gmail_message_id,
        }).execute()
        inserted += 1

    return inserted


def parse_coches_net_lead(subject, body):
    """Parse a coches.net notification email to extract lead info.

    Only extracts: name, phone, email, message, and vehicle brand+model.
    """
    lead = {
        'name': '',
        'phone': '',
        'email_contact': '',
        'vehicle_interest': '',
        'notes': '',
        'canal': 'coches.net',
    }

    # --- Extract name ---
    m = re.search(r'nuevo contacto\s*\*+\s*\n\s*(.+)', body, re.I)
    if m:
        candidate = m.group(1).strip()
        if '@' not in candidate and not re.match(r'^[\d\s+()-]+$', candidate):
            lead['name'] = candidate

    # --- Extract phone ---
    phones = re.findall(r'\b(\d{3}[\s.-]?\d{3}[\s.-]?\d{3})\b', body)
    if phones:
        lead['phone'] = phones[0].replace(' ', '').replace('.', '').replace('-', '')

    # --- Extract email ---
    emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', body)
    contact_emails = [e for e in emails if not any(s in e.lower() for s in ['coches.net', 'adevinta', 'noreply'])]
    if contact_emails:
        lead['email_contact'] = contact_emails[0]

    # --- Extract message ---
    m = re.search(r'\d{1,2}\s+\w+,\s+\d{1,2}:\d{2}\s*\n\s*(.+?)\s*\n\s*Responde', body, re.I | re.DOTALL)
    if m:
        msg = m.group(1).strip()
        if msg:
            lead['notes'] = msg

    # --- Extract vehicle brand + model ---
    m = re.search(r'Contactado desde\s*\n\s*\n?\s*([A-Z][A-Z\s]+?)\s*\n\s*\n?\s*(.+?)(?:\n\s*\n|\n.*?€)', body)
    if m:
        brand = m.group(1).strip()
        model = m.group(2).strip()
        lead['vehicle_interest'] = f"{brand} {model}"
    else:
        m = re.search(r'(?:anuncio|interesado en tu)\s+(.+?)(?:\s*$)', subject, re.I)
        if m:
            lead['vehicle_interest'] = m.group(1).strip()

    # --- Fallback name ---
    if not lead['name'] and lead['email_contact']:
        lead['name'] = lead['email_contact'].split('@')[0].replace('.', ' ').replace('_', ' ').title()
    if not lead['name']:
        lead['name'] = f"Lead coches.net ({datetime.now().strftime('%d/%m %H:%M')})"

    return lead


def main():
    if not GMAIL_APP_PASSWORD:
        print("ERROR: Set GMAIL_APP_PASSWORD environment variable")
        print("Get one at: Google Account > Security > 2-Step Verification > App passwords")
        return

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Connect to Gmail IMAP
    print(f"Connecting to Gmail as {GMAIL_USER}...")
    mail = imaplib.IMAP4_SSL('imap.gmail.com')
    mail.login(GMAIL_USER, GMAIL_APP_PASSWORD)
    mail.select('inbox')

    # Search for unread emails from coches.net
    all_ids = set()
    for sender in COCHES_NET_SENDERS:
        _, data = mail.search(None, f'(UNSEEN FROM "{sender}")')
        if data[0]:
            all_ids.update(data[0].split())

    if not all_ids:
        print("No new coches.net emails found.")
        mail.logout()
        return

    print(f"Found {len(all_ids)} unread coches.net emails")

    created = 0
    messages_inserted = 0
    for email_id in all_ids:
        _, data = mail.fetch(email_id, '(RFC822)')
        raw_email = data[0][1]
        msg = email.message_from_bytes(raw_email)

        subject = decode_mime_header(msg['Subject'] or '')
        from_addr = decode_mime_header(msg['From'] or '')
        gmail_msg_id = msg['Message-ID'] or ''
        body = get_email_body(msg)

        print(f"\n  Email: {subject}")
        print(f"  From: {from_addr}")

        # Check if it's actually from coches.net
        if not any(s in from_addr.lower() for s in COCHES_NET_SENDERS):
            print(f"  SKIP: not from coches.net")
            continue

        # Detect email type: follow-up or new lead
        if is_followup_email(subject, body):
            print(f"  TYPE: follow-up conversation")
            lead_id = find_existing_lead(sb, body, subject)
            if not lead_id:
                print(f"  SKIP: could not find existing lead for follow-up")
                continue

            conv_messages = parse_conversation_messages(body)
            print(f"  Parsed {len(conv_messages)} messages from conversation")
            n = insert_messages(sb, lead_id, conv_messages, gmail_msg_id)
            messages_inserted += n
            print(f"  Inserted {n} new messages (deduped)")
            continue

        # Type 1: New lead
        print(f"  TYPE: new lead")
        lead = parse_coches_net_lead(subject, body)
        print(f"  Lead: {lead['name']} | {lead['phone']} | {lead['vehicle_interest']}")

        # Check if lead already exists (by phone or same name+date)
        if lead['phone']:
            existing = sb.table('leads').select('id').eq('company_id', COMPANY_ID).eq('phone', lead['phone']).execute()
            if existing.data:
                print(f"  SKIP: lead with phone {lead['phone']} already exists")
                continue

        # Try to match vehicle in stock
        vehicle_id = None
        if lead['vehicle_interest']:
            query = sb.table('vehicles').select('id, name').eq('company_id', COMPANY_ID).eq('estado', 'disponible')
            vehicles = query.execute()
            if vehicles.data:
                interest_words = lead['vehicle_interest'].lower().split()
                best_match = None
                best_score = 0
                for v in vehicles.data:
                    v_lower = v['name'].lower()
                    score = sum(1 for w in interest_words if w in v_lower)
                    if score > best_score and score >= min(2, len(interest_words)):
                        best_score = score
                        best_match = v
                if best_match:
                    vehicle_id = best_match['id']
                    print(f"  MATCHED vehicle: {best_match['name']} (id={vehicle_id})")

        # Create lead in Supabase
        lead_data = {
            'company_id': COMPANY_ID,
            'name': lead['name'],
            'phone': lead['phone'],
            'email': lead.get('email_contact', ''),
            'notes': lead['notes'],
            'vehicle_interest': lead['vehicle_interest'],
            'vehicle_id': vehicle_id,
            'estado': 'nuevo',
            'canal': 'coches.net',
            'fecha_contacto': datetime.now().isoformat(),
        }

        result = sb.table('leads').insert(lead_data).execute()
        new_lead_id = result.data[0]['id'] if result.data else None

        print(f"  CREATED lead: {lead['name']}")
        created += 1

        # Insert first message into lead_messages
        if new_lead_id and lead['notes']:
            insert_messages(sb, new_lead_id, [{
                'sender': 'lead',
                'sender_name': lead['name'],
                'content': lead['notes'],
                'timestamp': datetime.now(),
            }], gmail_msg_id)
            messages_inserted += 1

    mail.logout()
    print(f"\nDone. Created {created} new leads, inserted {messages_inserted} messages.")


if __name__ == '__main__':
    main()
