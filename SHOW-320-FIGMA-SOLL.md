# Figma-SOLL-Referenz — B2B New Showcase (`TYdPJprCUxuqn564qa9urk`)

> Extrahiert am 2026-07-20 über den Figma-MCP (`get_metadata`, `get_variable_defs`,
> `get_design_context`). **Die MCP-Quota ist damit erschöpft** — dieses Dokument ersetzt eine
> erneute Extraktion. Werte sind gemessene Frame-Geometrie bzw. Variablendefinitionen,
> keine Schätzungen. Unsicherheiten sind als solche markiert.

## 1. Breakpoints — was die Datei kennt

Designt sind **360 · 768 · ~991/992/1023 · 1024 · 1920**.

**Es existiert kein einziger 1280er-Seiten-Frame.** Unabhängig geprüft auf PDP, Cart,
Checkout, Dashboard und Order History — null Treffer (auch nicht 1200/1366/1440/1512).
Der Code arbeitet mit `lg = 1280`; für diesen Breakpoint gibt es kein Design.

Die Grid-Spec-Seite (`416:8805`) hat einen 1280er-Frame, aber keine Seite folgt ihm.

## 2. Der ungeklärte Punkt: Seitenrand bei 1024

| Quelle | Rand @1024 | Content |
|---|---|---|
| Grid-Spec Geometrie (`420:10335`) | 36 | 952 |
| Grid-Spec **Fließtext** | 16 | „Maximum 992px total width" |
| PLP (`12185:48039`) | 36 | 952 |
| Order History (`6354:68196`) | 36 | 952 |
| Cart (`1224:34270`) | **16** | 992 |
| Checkout (`1868:13374`) | **16** | 992 |
| PDP 992er-Frame (`2358:77506`) | **16** | 960 |
| Account Dashboard (`3436:114206`) | 36 links / **16 rechts** | in sich widersprüchlich |
| PDP 1024er-Frame (`12823:72709`) | 0 / 16 / 32 / 36 im selben Frame | unbrauchbar |

**Header und Content sind in Figma innerhalb jedes Frames bündig** — der 20px-Versatz
existiert im Design nicht, nur im Code (Header schaltet bei 1024, Content bei 1280).

Zwei mit Figma belegbare Auflösungen:
1. Beide bei 1024 auf **36** → `content-container` auf `64rem` (aktuell im Working Tree).
2. Beide bei 1024 auf **16**, Wechsel später → dann ist der *Header* falsch (`md:px-9` → `lg:px-9`).

**Braucht eine Designentscheidung (Vitalii). Bis dahin nichts committen.**

## 3. Grid-Spec (Seite „Grid", `416:8805`)

| Frame | Node-ID | Breite | Margin | Content | Gutter |
|---|---|---|---|---|---|
| Default Mobile max-width-767 | `483:76` | 360 | 16 | 328 | 16 |
| sm \| Tablet min-width-768 | `483:2` | 768 | 16 | 736 | 16 |
| md \| Desktop min-width-1024 | `420:10335` | 1024 | 36 | 952 | 24 |
| lg \| Desktop min-width-1280 | `5261:65035` | 1280 | 36 | 1208 | 24 |
| Atoms / Grid-Desktop-max (lg) | `463:11124` | 1920 | 36 | 1848 | 24 |

12 Spalten. Full-Bleed-Elemente skalieren bis **2560px**.

## 4. Seiten-Layouts

### Cart / Checkout (identisch)

| Breite | Rand | Content | links | rechts | Gutter |
|---|---|---|---|---|---|
| 360 | 16 | 328 | einspaltig | | |
| 768 | 16 | 736 | einspaltig | | |
| 1023 | 16 | 991 | einspaltig | | |
| 1024 | 16 | 992 | 628 | **340** | 24 |
| 1920 | 36 | 1848 | 1380 | **444** | 24 |

Umbruch zweispaltig → einspaltig exakt bei **1023 → 1024**. Footer immer full-bleed.
Die Code-Werte 340px/444px sind damit bestätigt — der Übergang dazwischen aber nicht designt.

### PDP

| Breite | Frame | Rand | Content | Galerie | Info | Gutter |
|---|---|---|---|---|---|---|
| 1920 | `690:7172` | 36 | 1848 | 820 @36 | 756 @972 | 116 |
| 1024 | `12823:72709` | 36 (nur Top Area) | 952 | 452 @36 | 452 @536 | 48 |
| 992 | `2358:77506` | 16 | 960 | 456 @16 | 456 @520 | 48 |
| 991 | `2539:75370` | ~16 | ~959 | einspaltig | | |
| 768 | `2383:60209` | 16 | 736 | einspaltig | | |
| 360 | `2418:36582` | 16 | 328 | einspaltig | | |

⚠️ Zwei konkurrierende Frame-Sets: `PDP` (992/991/768/360/1920) und das neuere
`10/07/2026_Design_PDP` (1024/„990"=768/360/1920). Der 1024er ist ein unfertig migrierter
992er-Klon (1920px-Breadcrumb-Leiche `12823:84599`, vier verschiedene Ränder).
Bei 1920 ist die Info-Spalte **nicht rechtsbündig** (endet 1728 statt 1884); der
Comparison-Frame `9702:76892` macht es bei gleicher Breite anders (1008/876, Gutter 80).
Drei verschiedene Gutter auf 1920: 116 / 80 / 24.

### Account Dashboard / Order History

| Breite | Rand | Content | Sidebar | Gap |
|---|---|---|---|---|
| 1920 | 36 | 1848 | **288** | 24 |
| 1024 | 36 | 952 | **288** (Order History) / 180 (Dashboard ⚠️) | 24 / 54 |
| 768 | 16 | 736 | **180** | 24 / 55 |
| 360 | 16 | 328 | keine → Button „ACCOUNT MENU" (328×48) | — |

Die Komponente „Account nav bar" (`3445:157880`) ist in **beiden** Varianten (Desktop/Mobile)
**288px** breit. Die 180 bei 768 überschreibt die Komponentenbreite — manuelle Instanz-
Skalierung, keine saubere Variante. Order-History-Geometrie bei 1024 geht exakt auf
(36+288+24+640+36 = 1024), die Dashboard-Geometrie nicht → 288 gilt als maßgeblich.

Order-History-Tabelle überschreitet ab 1024 die Containerbreite (1407px in 608er-Container)
→ „Table Swipe Indicator", horizontal scrollbar. Bei 768/360 analog (1124px).

### Startpage (`663:31123`)

Pro Breite genau ein Frame, keine Explorationen — die sauberste Seite der Datei.

| Breite | Frame | Rand | Content | Hero | Reco-Karten | Gutter |
|---|---|---|---|---|---|---|
| 360 | `888:2322` | 16 | 328 | full-bleed 360 | 1 à 264 + Peek | 16 |
| 768 | `888:2325` | 16 | 736 | full-bleed 768 | 2 à 264 + Peek | 16 |
| 1023 | `888:2328` | 16 | 991 | full-bleed 1023 | 3 à 264 + Peek | 16 |
| 1024 | `888:2335` | **16 (Header) / 36 (Reco)** | 992 / 952 | full-bleed 1024 | 2 à 322 + Peek | 24 |
| 1920 | `888:2338` | 36 | 1848 | full-bleed 1920 | 5 à 322 + Peek | 24 |

**Hero ist auf allen Breakpoints full-bleed** (x=0, frame-breit); der Seitenrand steckt als
`px` *innerhalb* der Komponente (`px-36` @1920, `px-16` @1024/1023/768). Auf 360 strukturell
anders: Bild randlos, Textkarte darunter mit `px-16`, overlap `mb-[-56px]`.

Alle Content-Sektionen sind full-bleed; **einziges Grid-Kind ist der Header**.
Quick Entry @1920: `px-36 py-24`, 4 Items `flex-1 min-w-320 max-w-400` → Zeile 1672.
Media+Text @1920: `px-36 py-32`, `gap-24`, zwei Spalten à 912.
Sektionsabstände laut Doku-Karte `888:2341`: Desktop 80 · Tablet 64 · Mobile 40.

### Search Results (`2200:26587`)

⚠️ **Drei vollständige 5er-Sets mit identischen Frame-Namen**: Gruppe A „Search Results found"
(Produktraster + Filter), Gruppe B (lose Frames, Ergebnis-Liste ohne Filter, höhere Node-IDs),
Gruppe C „No search results found" (Leer-Zustand). A und B sind vermutlich zwei Tabs derselben
Seite — **das ist eine Interpretation, keine Figma-Aussage**.

Gruppe A (maßgeblich für Filter und Kartenraster):

| Breite | Frame | Rand | Content | Karten | Gutter |
|---|---|---|---|---|---|
| 360 | `2200:26684` | 16 | 328 | 1 à 328 | Row 40 |
| 768 | `2200:26620` | 16 | 736 | 2 à 360 | 16 |
| 1023 | `2200:26649` | 16 | 991 | 3 à 320 (Summe 992 ⚠️) | 16 |
| 1024 | `2200:26589` | 16 | 992 | 3 à 315 (Summe 993 ⚠️) | 24 |
| 1920 | `2200:26702` | 36 | 1848 | 4 à 444 (Summe 1848 ✓) | 24 |

**Der Filter ist auf jedem Breakpoint eine horizontale Leiste über dem Raster** — es gibt
weder einen Sidebar- noch einen Overlay-/Drawer-Zustand in dieser Seite (per Grep über den
ganzen Baum bestätigt). Höhe wächst zu kleinen Breiten: 48 @1920 → 168 @1024/1023 →
176 @768 → 136 @360. Filter @768 ist nur **618** breit statt 736.

### Registrierung / Login

Zentriert, **nicht** grid-ausgerichtet. Kartenbreiten:

| Frame | Viewport | Karte | x |
|---|---|---|---|
| `1459:71360` Desktop max | 1920 | 912 | 504 |
| `2440:47084` Desktop min | 1024 | 790 | 117 |
| `2440:48658` Tablet min | 768 | 485 | 141 |
| `2250:68459` Mobile | 360 | 328 | 16 |

Code nutzt `max-w-228` = 912px → deckt sich mit dem 1920er-Frame.

## 5. Design-Tokens

### Farben

**text** — headings `#1b1b1e` · body `#36373d` · placeholders `#6b6e79` · action `#0f77d9` ·
action-hover `#094782` · on-action `#ffffff` · on-disabled `#6b6e79` · success `#08891e` ·
error `#bf0d0d`

**icon** — neutral `#1b1b1e` · action `#0f77d9` · action-hover `#094782` · on-action `#ffffff` ·
on-disabled `#6b6e79` · secondary `#868998` · primary dark `#0c5fae` · success `#08891e` ·
error `#bf0d0d` · warning `#ca4e06` · information `#669acc`

**border** — primary `#cfd0d6` · secondary `#0f77d9` · action `#0f77d9` · action-hover `#094782` ·
focus `#0f77d9` · disabled `#b6b8c1` · success `#08891e` · error `#bf0d0d` ·
neutral black `#1b1b1e` · neutral white `#ffffff`

**surface** — page/primary `#ffffff` · action `#0f77d9` · action-hover `#094782` ·
action-hover 2 `#e7f1fb` · neutral `#1b1b1e` · disabled `#e7e7ea` · disabled-selected `#9ea1ad` ·
success `#cee7d2` · error `#f2cfcf` · warning `#f4dccd` · information `#e6f3ff` ·
search input `#f3f3f5` · image background `#f3f3f5` · hover grey `#cfd0d6`

**transparent** — primary-10 `#1b1b1e1a` · primary-5 `#1b1b1e0d`
**gradient** — primary/start `#0f77d9` · secondary/end `#094782`

### Typografie

Familien: **Ubuntu** (primary, Headlines/Buttons) · **Open Sans** (secondary, Body).

**Desktop** (size / line-height / letter-spacing)
h1 48/52/0 · h2 44/48/0 · h5 20/24/0 · h6 16/20/0 · overline 16/24/**2**
body lg 20/32 · body md 16/24 · body sm 12/20 · action/button 16/24/**2** bold **uppercase**

**Mobile**
h1 34/36/0 · h4 20/20/0 · h6 12/12/0 · overline 12/12/**2**
body lg 20/32 · body md 16/24 · body sm 12/20

⚠️ Lücken: Desktop h3/h4 und Mobile h2/h3/h5 in keinem abgefragten Node aufgetaucht.

### Spacing / Radius / Border

`spacing` none 0 · 0-25 1 · 0-5 2 · 1 4 · 2 8 · 3 12 · 4 16 · 6 24 · 8 32
Alt-Skala parallel: XS 8 · S 12 · M 16 · L 24

`border/radius` none 0 · **sm 4** · md 8 · lg 16 · button 4 · form field 4 · rounded-full 64
`border/width` button 1 · form field 1 · **focus 2**

### Schatten (`Drop Shadows/*`)

Basis `color/transparent/primary-10` + `primary-5`:
- shadow-default (1dp) — y1 blur3 spread1 + y1 blur12 spread1
- shadow-sm (2dp) — y2 blur8 spread2 + y1 blur12 spread1
- shadow-lg (4dp) — y4 blur8 spread4 + y1 blur12 spread0
- shadow-xl (16dp) — y16 blur16 spread8 + y1 blur12 spread0
- shadow-sm Bg-Blur-lg (2dp) — Background-Blur 16 + y2 blur8 spread2

## 6. Komponenten-Sollmaße

### Buttons (`483:25520`)

| Variante | Höhe | Padding | Gap | Radius |
|---|---|---|---|---|
| primary / secondary / tertiary | **48** | 16h / 12v | 12 | 4 |
| secondary small | **32** | 8h / 4v | 8 | 4 |
| Icon-Button (alle Typen) | 48×48 | 12 rundum | — | 4 |
| Play large | 88×88 | — | — | — |

Breite ist Hug-Content, **kein Spec-Wert**. Typo `Desktop/action/button`: Ubuntu Bold 16/24,
letter-spacing 2, uppercase. „small" existiert nur als secondary.

### Form Fields (`511:47967`)

Feld **48** hoch (12 + 24 + 12), Padding **12** rundum, Radius 4, Border 1px `border/primary`.
Breite kontextabhängig (190 in der State-Matrix, 380 im Molekül).
**Focus-Ring: 2px `border/focus`, inset −3px** (also außerhalb), Radius 4.
Label-Abstand **2px** (nicht 4/8) — Molekül 380×96 = 24 + 2 + 20 + 2 + 48 ✓
Checkbox / Radio / Rating-Item / Color-Item je **24×24**. Menu-Item 380×48. Textarea 446×249.

### Links (`511:34186`)

Kein Padding/Background/Radius. Gap **4px**, unterstrichen.
Size S 24 hoch (12/20) · M 24 hoch (16/24) · L 32 hoch (20/32).
Mobile und Desktop bei gleicher Size **identisch**.

### Pills (`3402:82714`)

Höhe **40** (8 + 24 + 8), Padding 8 rundum, Gap 8, Radius 4.
bg `surface/disabled`; Reset-Variante ohne bg, 1px `border/neutral-black`.
⚠️ Icons weichen ab: Such-/Trash-Icon **22×22**, Remove-X **16×16**.

### Badge Counter (`3394:75112`)

Fix **20×20**, Kreis, kein Padding, Text absolut zentriert. Open Sans Bold 12/20.
⚠️ Zuordnung Info/Warning/Positive → Farbe **nicht verifizierbar** (Kreis ist Bild-Asset).
Auffällig: keine eigene Warning-Fläche, müsste sich `surface/error` teilen.

### Pagination (`610:21251`)

Alle Items **40×40**, Radius 4. Padding typabhängig: **8** bei Pfeilen, **4** bei Zahlen.
Container-Gap **8**, Breite 328 bei 7 Items (7×40 + 6×8 ✓).
selected = bg `surface/page` + 1px `border/action`.

## 7. Bekannte Fehler in der Figma-Datei

1. **Defekte Frames**: PDP-1024er ist unfertig migrierter 992er-Klon · Frame
   „Tablet_max_990px" (`12823:73371`) ist 768 breit, sein Header ragt 102px aus dem Frame ·
   Dashboard-1024er: Header endet 988, Content 1008 · Cart-768 `1651:7213` ist 482 breit
   mit 736 breiten Kindern.
2. **Drei Radius-Namespaces**, davon einer mit Tippfehler (`boarder/`), Wertkonflikt bei
   2XL (32 vs. 64).
3. **Tippfehler in Farbtokens**: `colors/text/sucess`, `colors/border/sucess`.
4. **`Desktop/body/l-bold` zieht size/lineHeight aus `type/mobile/*`** — Authoring-Fehler.
5. **Fremd-Tokens** aus dem „Simple Design System"-Kit im File (`var(--sds-*)`,
   `Radius/radius-full` 400, zwei Inter-Textstile).
6. Sub-Pixel-Drift in mehreren Frames (36 → 35.9, 16 → 16.5).
7. Doppelte Variantennamen im Button-Set (`11850:69752` / `11850:83910`, beide
   „secondary small green, status=default").

## 8. Nicht extrahiert (Quota erschöpft)

- **Header-Seite komplett** (`416:9823`) — kein `get_variable_defs` durchgekommen.
  Nachzuholen: `204:5695`, `520:74538`, `1737:18624`, Flyout `1881:33824/35619/35679/35650/35714`.
- Footer Tablet/Desktop-min (`990:8629`, `990:8671`)
- Product-Card-Badges (`422:30111` Energy, `655:8688` Promotion)
- Startpage (`663:31123`) und Search Results (`2200:26587`) — Agent nicht abgeschlossen
