# June 2026 Pastor Directory — Change Report
**PDF date:** June 2, 2026  
**Compared against:** `functions/_lib/directory-data.js`

---

## ⚠️ AMA Groups — Not in PDF
The conference PDF does not include AMA group assignments. Group membership must be obtained separately (e.g., updated AMA_Groups.csv from the conference). For the departed pastors below, their group slots will need to be cleared manually.

---

## 1. New Pastors (in PDF, not in database)

| Field | Value |
|-------|-------|
| **Name** | Marcus Bates |
| **Email** | mbates@carolinasda.org |
| **Phone** | 828-244-4010 (mobile) |
| **Address** | 144 Wadmalaw Dr, Piedmont SC 29673-7783 |
| **Birthday** | Jun 10 |
| **Churches** | North Anderson SDA Church; Pickens SDA Church |
| **AMA Group** | Unknown — needs to be assigned |

> Note: North Anderson SDA Church was previously under Glen Garver (who is still active). Pickens SDA Church was under Charles Ferguson (departed). The overlap with Garver at North Anderson may reflect a transition or shared assignment.

---

## 2. Departed Pastors (in database, not in PDF)

These 6 pastors no longer appear in the conference directory:

| Pastor | Was Serving |
|--------|------------|
| **Ferguson, Charles** | Pickens SDA Church |
| **Flores, Gamaliel** | Saluda Hispanic SDA Mission Group |
| **Hill, Scott** | Goldsboro SDA Church; Wilson First SDA Church |
| **Sauza, Moises** | Hanahan Spanish SDA Church; Johns Island Spanish SDA Company; Moncks Corner Hispanic SDA Company; Summerville Spanish SDA Church |
| **Thompson, Christopher** | Beaufort SDA Church; Hilton Head SDA Church; Lowcountry SDA Mission Group |
| **Wanovich, Nicholas** | Orangeburg SDA Church; Summerville Community SDA Church |

### Open Positions (PDF "OPEN, HEAD PASTOR" placeholder)
The PDF lists these 11 churches as currently without a pastor. They align with the 4 departed pastors above (Hill, Sauza, Thompson, Wanovich):

- Beaufort SDA Church
- Goldsboro SDA Church
- Hanahan Spanish SDA Church
- Hilton Head SDA Church
- Johns Island Spanish SDA Company
- Lowcountry SDA Mission Group
- Moncks Corner Hispanic SDA Company
- Orangeburg SDA Church
- Summerville Community SDA Church
- Summerville Spanish SDA Church
- Wilson First SDA Church

> Note: **Delco SDA Church** (previously under Baute — see §5 below) is not in the OPEN list and does not appear under any pastor. It may have been closed, merged, or is missing from the PDF.

---

## 3. Address Changes

| Pastor | Old Address | New Address |
|--------|------------|------------|
| **Garver, Glen** | 770 Drexel Rd Apt D, Morganton NC 28655-5814 | 104 Sourwood Dr, Morganton NC 28655-9089 |
| **Godeau, Dante** | 420 N 1st Ave, Maiden NC 28650-1104 | 417 Hefner Ln, Taylorsville NC 28681-8636 |

> Note: The PDF shows an Asheboro NC address for Mark Kent — this is a conference data error. His address (1527 Fair Oaks Ln, Florence SC) remains unchanged in the database.

---

## 4. Phone Changes

| Pastor | Old Number | New Number |
|--------|-----------|-----------|
| **Burgess, Scott** | 662-468-8518 (landline) removed; 864-321-4504 mobile unchanged | Landline dropped — mobile only now |
| **Wait, Jeffrey** | 828-513-**3**325 | 828-513-**4**325 |

---

## 5. Email Changes

| Pastor | Old Email | New Email |
|--------|----------|----------|
| **Bowman, Bryce** | bryce@ptcmail.com | bbowman@carolinasda.org |

---

## 6. Church Assignment Changes (actual adds/removals)

| Pastor | Change |
|--------|--------|
| **Baute, Jorge** | **Removed:** Delco SDA Church (now serves only Elizabethtown and Whiteville) |
| **Reategui, Mario** | **Removed:** Liberty SDA Mission Group; **Added:** Asheboro SDA Mission Group |
| **Rodriguez, Gamaliel** | **Added:** Maranatha SDA Hispanic Mission Group |

---

## 7. Church Name Reclassifications

These appear to be official status upgrades (Mission Group → Company → Church) or minor renames. Same physical congregation, different designation:

| Pastor | Old Name | New Name |
|--------|---------|---------|
| Barrios Carrillo | Fuquay Varina Spanish SDA **Company** | Fuquay Varina Spanish SDA **Church** |
| Barrios Carrillo | Knightdale Hispanic SDA **Mission Group** | Knightdale Hispanic SDA **Company** |
| Chawngthu | Garner Connection SDA **Mission Group** | Garner Connection SDA **Company** |
| Cruz Perez | East Fayetteville Hisp SDA **Mission Group** | East Fayetteville Hisp SDA **Company** |
| Flores, Julio | Boiling Springs Hispanic SDA **Company** | Boiling Springs Hispanic SDA **Church** |
| Hodgins | Pursuit Worship-Charlotte SDA **Company** | Pursuit Worship-Charlotte SDA **Church** |
| Knight | Garner Connection SDA **Mission Group** | Garner Connection SDA **Company** |
| Omosa | Tumaini Wake Forest SDA **Mission Group** | Tumaini Wake Forest SDA **Company** |
| Rivera | Asheville Hispanic SDA **Company** | Asheville Hispanic SDA **Church** |
| Rivera | Swannanoa Sp SDA **Company** | Swannanoa Sp SDA **Church** |
| Wennerberg | Southport SDA **Mission Group** | Southport SDA **Company** |

---

## 8. Name/Display Changes

| Pastor | Old | New |
|--------|-----|-----|
| **Chawngthu, Lal** | First name: Lal | First name: Lal Pek Thara |

---

## Summary Counts

| Category | Count |
|----------|-------|
| New pastors | 1 |
| Departed pastors | 6 |
| Open positions (vacant churches) | 11 |
| Address changes | 2 |
| Phone changes | 2 |
| Email changes | 1 |
| Church assignment changes | 3 |
| Church name reclassifications | 11 |
| Name changes | 1 |

---

## AMA Group Impact (manual follow-up needed)

With 6 departed pastors, the following group memberships need to be cleared in `AMA_GROUPS`:
- **Palmetto group:** Remove Sauza, Thompson, Wanovich
- **Eastern Carolina group:** Remove Hill
- Ferguson and Flores had `null` AMA groups — no action needed

New pastor **Bates, Marcus** needs to be assigned to a group (likely Blue Ridge or Upstate based on Piedmont SC location — confirm with conference).
