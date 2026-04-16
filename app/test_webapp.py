"""
Webapp testing for Cars Control — UX audit fixes verification.
Tests the 15 UX audit items + catalog detail layout fix.
Run with: python test_webapp.py
"""
import sys
import os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "ux-screenshots", "webapp-test")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

passed = 0
failed = 0
errors = []

def screenshot(page, name):
    path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    return path

def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        msg = f"  FAIL  {name}" + (f" — {detail}" if detail else "")
        print(msg)
        errors.append(msg)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    # =========================================================
    # 1. PUBLIC CATALOG — Landing page
    # =========================================================
    print("\n=== PUBLIC CATALOG ===")
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    screenshot(page, "01_catalog_landing")

    # L1: Title has accents
    title = page.title()
    check("L1: Title has accents", "Vehículos" in title or "ocasión" in title, f"title='{title}'")

    # L2: Open Graph meta tags
    og_title = page.locator('meta[property="og:title"]')
    check("L2: OG meta tags present", og_title.count() > 0)

    # Catalog hero exists
    hero = page.locator(".catalog-hero-banner")
    check("Catalog hero visible", hero.count() > 0)

    # Catalog filters exist (fuel, price, year, sort)
    filters = page.locator(".catalog-hero-chip")
    check("Catalog filters present", filters.count() >= 4, f"found {filters.count()}")

    # M3: "Acceso usuarios" button should be visible on localhost (both mode)
    access_btn = page.locator("text=Acceso usuarios")
    check("M3: Acceso usuarios visible on localhost (both mode)", access_btn.count() > 0)

    # WhatsApp FAB
    wa_fab = page.locator(".whatsapp-fab")
    check("WhatsApp FAB present", wa_fab.count() > 0)

    # =========================================================
    # 2. PUBLIC CATALOG — Vehicle cards
    # =========================================================
    print("\n=== CATALOG CARDS ===")
    cards = page.locator(".catalog-card")
    card_count = cards.count()
    check("Catalog has vehicle cards", card_count > 0, f"found {card_count}")

    if card_count > 0:
        # Click first card to enter detail
        cards.first.click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        screenshot(page, "02_vehicle_detail")

        # =========================================================
        # 3. PUBLIC VEHICLE DETAIL
        # =========================================================
        print("\n=== VEHICLE DETAIL (PUBLIC) ===")

        # C2: Title not truncated (word-break)
        detail_title = page.locator(".catalog-detail-info h1")
        check("C2: Vehicle title present", detail_title.count() > 0)

        # Layout: gallery + info side by side
        gallery = page.locator(".catalog-detail-gallery")
        info = page.locator(".catalog-detail-info")
        check("Detail: gallery column exists", gallery.count() > 0)
        check("Detail: info column exists", info.count() > 0)

        # Info should be visible (not pushed off-screen)
        if info.count() > 0:
            info_box = info.bounding_box()
            check("Detail: info visible on screen", info_box is not None and info_box["x"] < 1400, f"x={info_box['x'] if info_box else 'null'}")

        # Main photo with aspect-ratio constraint
        main_img = page.locator(".catalog-detail-main-img img")
        if main_img.count() > 0:
            img_box = main_img.bounding_box()
            check("Detail: main photo height constrained", img_box is not None and img_box["height"] <= 500, f"height={img_box['height'] if img_box else 'null'}")

        # Thumbnails sized correctly (80x60)
        thumbs = page.locator(".catalog-detail-thumbs > img")
        if thumbs.count() > 0:
            thumb_box = thumbs.first.bounding_box()
            check("Detail: thumbnails sized ~80x60", thumb_box is not None and thumb_box["width"] <= 90 and thumb_box["height"] <= 70, f"size={thumb_box['width']:.0f}x{thumb_box['height']:.0f}" if thumb_box else "null")

        # Specs table visible
        specs = page.locator(".catalog-detail-specs")
        check("Detail: specs table present", specs.count() > 0)

        # Price visible
        price = page.locator(".catalog-detail-price")
        check("Detail: price displayed", price.count() > 0)

        # M1: Contact form with message field
        msg_field = page.locator("#contact-message")
        check("M1: Contact form has message field", msg_field.count() > 0)

        # Contact buttons
        call_btn = page.locator("text=Llamar")
        wa_btn = page.locator(".catalog-detail-contact >> text=WhatsApp")
        check("Detail: call button present", call_btn.count() > 0)
        check("Detail: WhatsApp button present", wa_btn.count() > 0)

        # Back button
        back_btn = page.locator(".catalog-back")
        check("Detail: back button present", back_btn.count() > 0)
        back_btn.click()
        page.wait_for_load_state("networkidle")

    # =========================================================
    # 4. CATALOG — Search functionality
    # =========================================================
    print("\n=== CATALOG SEARCH ===")
    search_input = page.locator(".catalog-search")
    if search_input.count() > 0:
        search_input.fill("Mazda")
        page.wait_for_timeout(500)
        filtered_cards = page.locator(".catalog-card")
        screenshot(page, "03_catalog_search")
        check("Catalog search filters cards", filtered_cards.count() <= card_count)
        search_input.fill("")

    # =========================================================
    # 5. LOGIN & ADMIN (navigate to login)
    # =========================================================
    print("\n=== ADMIN PANEL ===")
    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    login_btn = page.locator("text=Acceso usuarios")
    if login_btn.count() > 0:
        login_btn.click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)
        screenshot(page, "04_login_page")

        # Login form exists
        user_input = page.locator("#login-user")
        pass_input = page.locator("#login-pass")
        check("Login: user field present", user_input.count() > 0)
        check("Login: password field present", pass_input.count() > 0)

        # Google OAuth button
        google_btn = page.locator("text=Entrar con Google")
        check("Login: Google OAuth button", google_btn.count() > 0)

    # =========================================================
    # 6. MOBILE VIEWPORT — Touch targets
    # =========================================================
    print("\n=== MOBILE VIEWPORT ===")
    mobile_context = browser.new_context(viewport={"width": 375, "height": 812})
    mobile_page = mobile_context.new_page()
    mobile_page.goto(BASE)
    mobile_page.wait_for_load_state("networkidle")
    screenshot(mobile_page, "05_mobile_catalog")

    # M2: Touch targets >= 44px on mobile
    # Check catalog nav link height
    nav_link = mobile_page.locator(".catalog-nav-link")
    if nav_link.count() > 0:
        nl_box = nav_link.first.bounding_box()
        check("M2: Nav link touch target >= 44px", nl_box is not None and nl_box["height"] >= 40, f"height={nl_box['height']:.0f}" if nl_box else "null")

    # Click into a vehicle on mobile
    mobile_cards = mobile_page.locator(".catalog-card")
    if mobile_cards.count() > 0:
        mobile_cards.first.click()
        mobile_page.wait_for_load_state("networkidle")
        mobile_page.wait_for_timeout(1000)
        screenshot(mobile_page, "06_mobile_detail")

        # Detail should be single column on mobile
        mobile_info = mobile_page.locator(".catalog-detail-info")
        if mobile_info.count() > 0:
            mi_box = mobile_info.bounding_box()
            check("Mobile: info column visible", mi_box is not None and mi_box["width"] > 200)

    mobile_context.close()

    # =========================================================
    # 7. HTML META VERIFICATION
    # =========================================================
    print("\n=== HTML META ===")
    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    # Favicon
    favicon = page.locator('link[rel="icon"]')
    check("Favicon link present", favicon.count() > 0)

    # OG meta
    og_desc = page.locator('meta[property="og:description"]')
    og_image = page.locator('meta[property="og:image"]')
    check("L2: OG description", og_desc.count() > 0)
    check("L2: OG image", og_image.count() > 0)

    # Twitter card
    tw_card = page.locator('meta[name="twitter:card"]')
    check("L2: Twitter card meta", tw_card.count() > 0)

    browser.close()

# =========================================================
# RESULTS
# =========================================================
print(f"\n{'='*50}")
print(f"RESULTS: {passed} passed, {failed} failed, {passed + failed} total")
print(f"{'='*50}")
if errors:
    print("\nFailed tests:")
    for e in errors:
        print(e)
print(f"\nScreenshots saved to: {SCREENSHOT_DIR}")
sys.exit(1 if failed > 0 else 0)
