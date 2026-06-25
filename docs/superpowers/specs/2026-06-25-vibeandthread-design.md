# Vibe&Thread — Design Spec
**Date:** 2026-06-25
**Status:** Approved

## Overview

Vibe&Thread is a React Native (Expo Go) mobile app for Qatar users. Users describe clothing in natural language and get matched results from Qatar online stores and physical store recommendations in Doha. AI (Gemini) interprets the description, extracts structured attributes, and queries a Firebase product catalog to return ranked results.

---

## Approach

AI-first, manual seed data for v1. Build the search UX and AI matching first with a hand-curated Firebase dataset across 20 stores. Automated nightly scraping deferred to v2.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo Go |
| Navigation | Expo Router |
| Backend | Firebase (Firestore + Cloud Functions) |
| AI | Google Gemini |
| Store locations | Google Places API |
| Language | English only |
| Distribution | Expo Go (QR code), TestFlight in v2 |

---

## Screens

### Screen 1 — Search (Home)
- App name "Vibe&Thread" at top
- Large text input: *"Describe what you're looking for..."*
- Search button
- Recent searches shown below (stored locally on device)

### Screen 2 — Results
- Back button + editable search query at top
- Two tabs: **Online** | **In-Store**

**Online tab** — scrollable product cards:
- Product image (thumbnail)
- Product name
- Price in QAR
- Store name + logo
- "View" button → opens store website in browser

**In-Store tab** — store cards:
- Store name + logo
- Mall location (e.g. "Villaggio Mall")
- "Get Directions" button → opens Google Maps
- AI-generated match reason (e.g. "Carries modest evening wear")

### Screen 3 — No Results
- Friendly message: *"We couldn't find an exact match — try describing it differently"*
- Suggested search tweaks

---

## Data Flow

```
User types description
  → Firebase Cloud Function
    → Gemini extracts attributes (category, color, fabric, style, fit, occasion)
      → Firestore query + ranking
        → Results returned to app
          → Displayed in Online / In-Store tabs
```

---

## Firebase Structure

**Firestore collections:**

```
/products/{productId}
  - store: string
  - name: string
  - price: number (QAR)
  - currency: "QAR"
  - imageUrl: string
  - productUrl: string
  - category: string
  - color: string[]
  - fabric: string
  - style: string[]
  - fit: string
  - occasion: string[]
  - isOnline: boolean
  - inStoreLocation: string | null  (mall name)
  - mapsUrl: string | null

/stores/{storeId}
  - name: string
  - logoUrl: string
  - website: string
  - mallLocation: string | null
  - mapsUrl: string | null
  - isOnline: boolean
  - isPhysical: boolean
```

**Firebase Cloud Function:**
- Accepts: raw text description from user
- Calls Gemini API to extract structured attributes
- Queries Firestore, ranks by attribute match count
- Returns: sorted array of product + store results

---

## AI Matching (Gemini)

Gemini receives the user's raw description and returns structured JSON:

```json
{
  "category": "dress",
  "color": ["beige"],
  "fabric": "linen",
  "style": ["flowy", "modest"],
  "fit": "loose",
  "occasion": ["casual", "everyday"]
}
```

These attributes are matched against Firestore product documents. Products are ranked by how many attributes match.

---

## Store List (v1 — 20 stores)

**Online-only (Qatar delivery):**
1. Namshi — namshi.com/qatar-en
2. Noon Fashion — noon.com/qatar-en
3. Ounass — ounass.com
4. 6th Street — en-qa.6thstreet.com
5. VogaCloset — vogacloset.com/qatar
6. bfab — bfab.com/qa

**International brands with Qatar online store:**
7. Zara Qatar — zara.com/qa
8. Massimo Dutti Qatar — massimodutti.com/qa
9. H&M Qatar — hm.com/qa
10. Mango Qatar — shop.mango.com/qa
11. Marks & Spencer Qatar — marksandspencerme.com/en-qa
12. Pull&Bear Qatar — pullandbear.com/qa
13. Bershka Qatar — bershka.com/qa
14. Stradivarius Qatar — stradivarius.com/qa

**Physical stores in Doha malls (also online):**
15. Galeries Lafayette Doha — galerieslafayette.qa
16. Max Fashion Qatar — maxfashion.com/qa
17. Splash Qatar — Landmark Group
18. LC Waikiki Qatar — lcwaikiki.com

**Local Qatar brands:**
19. Wadha — local luxury brand, Doha-based
20. Elisabietta — Qatar-based, dresses + sustainable focus

---

## Data Seeding (v1)

- Manually populate Firestore with ~20-50 products per store
- Products sourced by browsing each store's Qatar website and copy-pasting key details
- Google Places API used to pull store address + maps link for physical stores
- Automated scraping deferred to v2

---

## v1 Scope

**In:**
- Search screen with text input
- AI-powered matching via Gemini
- Firebase product database (20 stores, manually seeded)
- Online results tab + In-Store results tab
- Google Maps link for physical stores
- No-results screen with suggestions
- Expo Go delivery (QR code)

**Out (v2+):**
- Automated nightly scraping
- User accounts / saved searches
- Price + size filters
- Push notifications for new arrivals
- Arabic language support
- TestFlight / App Store release
