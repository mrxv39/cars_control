"""
Sync leads from coches.net email notifications to Supabase.

This script:
1. Connects to Gmail via IMAP
2. Reads unread emails from coches.net (noreply@coches.net or similar)
3. Parses contact info (name, phone, vehicle interest)
4. Creates leads in Supabase
5. Marks emails as read

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

SUPABASE_URL = 'https://hyydkyhvgcekvtkrnspf.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5eWRreWh2Z2Nla3Z0a3Juc3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDU3MDQsImV4cCI6MjA4OTQ4MTcwNH0.54OcvlXRN9Bb7yhxUw2ufhWT2GypqCu3wH26fJuCuRA'

GMAIL_USER = os.environ.get('GMAIL_USER', 'codinacars@gmail.com')
GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')

COMPANY_ID = 1  # CodinaCars

# Known coches.net sender patterns
COCHES_NET_SENDERS = ['coches.net', 'adevinta', 'noreply']


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
                    # Strip HTML tags for simple text
                    body = re.sub(r'<[^>]+>', ' ', html)
                    body = re.sub(r'\s+', ' ', body)
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or 'utf-8'
            body = payload.decode(charset, errors='replace')
    return body


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
    # Pattern: name appears alone on a line after "Tienes un nuevo contacto"
    m = re.search(r'nuevo contacto\s*\*+\s*\n\s*(.+)', body, re.I)
    if m:
        candidate = m.group(1).strip()
        # Make sure it's not an email or phone
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
    # The user message appears after the date/time line, before "Responde a este email"
    m = re.search(r'\d{1,2}\s+\w+,\s+\d{1,2}:\d{2}\s*\n\s*(.+?)\s*\n\s*Responde', body, re.I | re.DOTALL)
    if m:
        msg = m.group(1).strip()
        if msg:
            lead['notes'] = msg

    # --- Extract vehicle brand + model ---
    # Pattern: "Contactado desde\n\nBRAND\n\nModel details\n\nPrice"
    m = re.search(r'Contactado desde\s*\n\s*\n?\s*([A-Z][A-Z\s]+?)\s*\n\s*\n?\s*(.+?)(?:\n\s*\n|\n.*?€)', body)
    if m:
        brand = m.group(1).strip()
        model = m.group(2).strip()
        lead['vehicle_interest'] = f"{brand} {model}"
    else:
        # Fallback: try from subject
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
    # Try multiple search patterns
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
    for email_id in all_ids:
        _, data = mail.fetch(email_id, '(RFC822)')
        raw_email = data[0][1]
        msg = email.message_from_bytes(raw_email)

        subject = decode_mime_header(msg['Subject'] or '')
        from_addr = decode_mime_header(msg['From'] or '')
        body = get_email_body(msg)

        print(f"\n  Email: {subject}")
        print(f"  From: {from_addr}")

        # Check if it's actually from coches.net
        if not any(s in from_addr.lower() for s in COCHES_NET_SENDERS):
            print(f"  SKIP: not from coches.net")
            continue

        # Parse lead info
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
                    # Count how many words from the interest match the vehicle name
                    score = sum(1 for w in interest_words if w in v_lower)
                    if score > best_score and score >= min(2, len(interest_words)):
                        best_score = score
                        best_match = v
                if best_match:
                    vehicle_id = best_match['id']
                    print(f"  MATCHED vehicle: {best_match['name']} (id={vehicle_id})")

        # Create lead in Supabase — only: name, email, phone, message, vehicle
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

        sb.table('leads').insert(lead_data).execute()

        print(f"  CREATED lead: {lead['name']}")
        created += 1

    mail.logout()
    print(f"\nDone. Created {created} new leads.")


if __name__ == '__main__':
    main()
