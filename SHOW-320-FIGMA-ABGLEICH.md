# SHOW-320 — Figma-Abgleich `feature/SHOW-320-breakpoints`

> Erhoben am 2026-07-20 gegen Figma `TYdPJprCUxuqn564qa9urk` (B2B New Showcase) und die
> lokal laufende App (`next dev`, localhost:3000).
> Messmethode: App in same-origin-iframes mit fester Breite gerendert (echter Viewport für
> Media Queries), Container per `getComputedStyle`/`getBoundingClientRect` vermessen.
> Figma-SOLL aus `get_metadata` (Grid-Seite + PLP-Seite), nicht aus Screenshots geschätzt.

## 1. Grid-SOLL aus Figma (Seite „Grid", `416:8805`)

Fünf Frames, benannt exakt nach den CSS-Breakpoints:

| Figma-Frame | Node-ID | Frame-Breite | Margin | Content | Gutter |
|---|---|---|---|---|---|
| `Default Mobile max-width-767` | `483:76` | 360 | 16 | 328 | 16 |
| `sm \| Tablet min-width-768` | `483:2` | 768 | 16 | 736 | 16 |
| `md \| Desktop min-width-1024` | `420:10335` | 1024 | **36** | **952** | 24 |
| `lg \| Desktop min-width-1280` | `5261:65035` | 1280 | 36 | 1208 | 24 |
| `Atoms / Grid-Desktop-max (lg)` | `463:11124` | 1920 | 36 | 1848 | 24 |

Full-Bleed-Elemente skalieren bis **2560px**. Die Breakpoint-Stufen decken sich damit **1:1**
mit `globals.css` (`sm 48rem/768`, `md 64rem/1024`, `lg 80rem/1280`) — es gibt keinen
zusätzlichen Breakpoint und keinen 992-Cap. Die im Plan vermutete „992–1024"-Stufe existiert nicht.

> Hinweis: Der Beschreibungstext im md-Frame sagt „Maximum 992px total width", die tatsächliche
> Frame-Geometrie zeigt aber durchgängig 36/952. Die Geometrie ist maßgeblich (siehe §2).

## 2. Gegenprobe am echten Seiten-Frame (PLP)

Damit die Grid-Spec nicht allein steht, im PLP-md-Frame `Desktop_PLP Categories_min 1025`
(`12185:48039`, 1024 breit) nachgemessen — identisch in `10060:115116`:

| Layer | x | width |
|---|---|---|
| `header` | **36** | 952 |
| `Frame 1000005182` (Filter & Rows) | **36** | 952 |
| `Breadcrumbs & Headline` | **36** | 960 |
| `Reco`, `footer` (full-bleed) | 0 | 1024 |

**Content und Header liegen bei md beide auf 36px.** Es gibt im Design keinen Versatz zwischen
beiden.

## 3. IST-Messung der App

`content-container` (`globals.css:307`):

```css
@utility content-container {
  margin-inline: auto;
  max-width: var(--theme-container-6xl);   /* 1920 */
  padding-inline: calc(var(--spacing) * 4); /* 16 */
  @media (width >= 80rem) {                 /* 1280 ← schaltet zu spät */
    padding-inline: calc(var(--spacing) * 9); /* 36 */
  }
}
```

Gemessen auf `/de/browse` (Werte = `padding-inline` links):

| Viewport | `content-container` | Header | Figma-SOLL | Befund |
|---|---|---|---|---|
| 360 | 16 | – | 16 | ok |
| 768 | 16 | 16 | 16 | ok |
| 900 | 16 | 16 | 16 | ok |
| **1024** | **16** | **36** | **36** | **Content 20px zu schmal, 20px Versatz zum Header** |
| **1100** | **16** | **36** | **36** | **dito** |
| **1279** | **16** | **36** | **36** | **dito** |
| 1280 | 36 | 36 | 36 | ok |
| 1440 | 36 | 36 | 36 | ok |
| 1920 | 36 | 36 | 36 | ok (Content 1848) |

## 3a. Status nach Umsetzung (2026-07-20)

B1 und B3 sind umgesetzt und nachgemessen. Die Schwelle sitzt jetzt exakt auf md:

| Viewport | `content-container` | Figma-SOLL | |
|---|---|---|---|
| 1023 | 16 | 16 | ok |
| 1024 | 36 | 36 | ok |
| 1100 | 36 | 36 | ok |
| 1279 | 36 | 36 | ok |

Gegengemessen auf `/de/cart`, `/de/quick-order`, `/de/register`: alle bei 1100 auf 36px
(vorher 16). Header- und Content-Kante liegen jetzt auf demselben Wert.

Geändert: `globals.css` (`80rem`→`64rem` + Begründung), alle `lg:mx-9`/`lg:px-9` →
`md:mx-9`/`md:px-9` in quick-order, footer, checkout, registration, cart-overview,
cart-empty, account-layout, hero, quick-entry. Tests `content-container.test.ts` und
`figma-alignment.test.ts` auf die md-Schwelle nachgezogen (28 grün), plus neuer Regressions-
Lock `no container still uses the pre-SHOW-320 lg step`.

Offen geblieben: **B2** (Konsolidierung auf `content-container`) — nach dem Fix rein
struktureller Natur, kein Design-Delta mehr, siehe §6.

## 4. Befunde

### B1 — `content-container` schaltet bei 1280 statt 1024 *(Hauptbefund)*

Über den gesamten md-Bereich (1024–1279) hat der Seiteninhalt 16px statt 36px Seitenrand,
während der Header bereits auf 36px steht. Ergebnis: **sichtbarer 20px-Versatz zwischen
Header-Kante und Content-Kante** auf jeder Seite, die `content-container` nutzt.

Fix ist eine Zeile — `globals.css:311`:

```diff
-  @media (width >= 80rem) {
+  @media (width >= 64rem) {
```

⚠️ **Achtung, das widerspricht einer bestehenden Annahme im Repo.**
`src/lib/figma-alignment.test.ts:18` hält als Figma-Aussage fest:
*„header — 36px side padding from md (Figma: header switches at 1024, content at 1280)"*.
Nach obiger Messung (§1 + §2) trifft der Klammerzusatz nicht zu: Der Content wechselt in
Figma ebenfalls bei 1024. Der Test selbst prüft nur den Header und schlägt durch den Fix
nicht fehl — der Kommentar müsste aber mitkorrigiert werden. **Diesen Punkt vor der Umsetzung
mit Vitalii bestätigen**, da er einer dokumentierten Review-Entscheidung widerspricht.

### B2 — `content-container` ist kaum ausgerollt

Von den geprüften Templates nutzt bei 1100px Viewport nur **`/de/browse`** einen
`.content-container`. Ohne Container (nur `max-w-6xl`, Padding 0 bzw. 16):

- `/` (Startpage) · `/de/cart` · `/de/quick-order` · `/de/login` · `/de/register`

`max-w-6xl` steht noch an 13 Stellen im Produktivcode:
`quick-order/page.tsx:27`, `footer.tsx:206,227`, `product-add-to-cart-bar.tsx:41`,
`checkout.tsx:125`, `hero.tsx:105`, `media-text.tsx:65`, `cart-empty.tsx:13`,
`cart-overview.tsx:43,63`, `account-layout.tsx:195`, `header.tsx:28`,
`header-checkout.tsx:12` (die beiden Header bewusst, siehe B1).

Solange diese nicht auf `content-container` laufen, wirkt der Fix aus B1 nur auf der PLP.

### B3 — `lg:px-9` in `footer.tsx:227`

`sm:px-4 lg:px-9` reproduziert denselben zu späten Wechsel wie B1, hier lokal im Footer.
Gehört auf `md:px-9` bzw. auf `content-container`.

## 5. Figma-Seitenliste (47 Seiten, mit Node-IDs)

Atoms / Komponenten:

| # | Seite | Node-ID | | # | Seite | Node-ID |
|---|---|---|---|---|---|---|
| 1 | Grid | `416:8805` | | 13 | Tooltip Info | `619:899` |
| 2 | Badge Counter | `3394:75112` | | 14 | Tier Prices | `3377:24406` |
| 3 | Buttons | `483:25520` | | 15 | Header | `416:9823` |
| 4 | Breadcrumb | `539:21044` | | 16 | Search | `604:8765` |
| 5 | Links | `511:34186` | | 17 | Footer | `416:9828` |
| 6 | Form Fields | `511:47967` | | 18 | Product Cards | `420:10962` |
| 7 | Pills | `3402:82714` | | 19 | Recomendations | `3501:92911` |
| 8 | Pagination | `610:21251` | | 20 | Login / Registration Dialog | `635:23305` |
| 9 | Slider Controls | `612:134` | | 21 | Tables | `3425:162705` |
| 10 | Tab Bar | `2248:21096` | | 22 | Review & Rating *(not impl.)* | `2575:92080` |
| 11 | Notification | `612:12054` | | 23 | Card: Add accessories *(not impl.)* | `3075:55250` |
| 12 | Toast Notification | `619:218` | | 24 | Pop-up: add accessories *(not impl.)* | `3045:83707` |

CMS-/Teil-Komponenten (`--`-Präfix):

| # | Seite | Node-ID | | # | Seite | Node-ID |
|---|---|---|---|---|---|---|
| 25 | -- Request Quote | `3997:99796` | | 31 | -- Order Overview | `4002:65478` |
| 26 | -- Shipping | `3999:56331` | | 32 | -- Page Hero | `416:9826` |
| 27 | -- Payment | `4002:57100` | | 33 | -- Quick Entry | `715:1945` |
| 28 | -- Billing Address | `4002:59820` | | 34 | -- Media+Text | `416:9825` |
| 29 | -- Contact | `4002:62573` | | | | |
| 30 | -- Notes | `4002:64147` | | | | |

Seiten-Templates:

| # | Seite | Node-ID | App-Route |
|---|---|---|---|
| 35 | Startpage | `663:31123` | `/` |
| 36 | PLP Page | `635:19791` | `/de/browse` |
| 37 | Guided Selling | `12837:2` | — |
| 38 | PDP Page | `635:23879` | `/de/product/[id]` |
| 39 | Search Results Page | `2200:26587` | `/de/browse?q=` |
| 40 | Login & Register | `635:21894` | `/de/login`, `/de/register` |
| 41 | Reset Password | `3725:29962` | `/de/password-reset` |
| 42 | Chatbot Onboarding | `2274:28039` | — |
| 43 | Cart | `1224:34108` | `/de/cart` |
| 44 | Checkout | `1868:12063` | `/de/checkout` |
| 45 | Quick Order | `2499:118849` | `/de/quick-order` |
| 46 | My Account / Dashboard | `926:8901` | `/de/account` |
| 47 | My Account / Order History | `6354:68080` | `/de/account/orders` |

## 6. Noch offen

Nicht abgeglichen, weil pro Template ein eigener Frame-Vergleich nötig ist:
PDP-Sub-Grids, Checkout-Spalten, Account-Sidebar-Schwelle, Guided Selling, Chatbot Onboarding.
Die Grid-Ebene (§1–§4) ist die Voraussetzung dafür — solange B1/B2 offen sind, verschieben
sich alle Template-Messungen im md-Bereich um 20px.
