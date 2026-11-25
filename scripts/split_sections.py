"""Split each official PDF into sections (triple check, step 2: completeness).

The act's own table of contents is the map: every listed section must be found,
once and in order, in the body. Page-bottom footnotes (amendment notes) are moved
out of the section text into a separate `notes` field, and inline footnote markers
such as "1[" are removed so quotes can be matched exactly.

Writes data/sections.jsonl and data/checks/split_report.json.
"""
import bisect
import json
import statistics
import re
import sys
from pathlib import Path

import pymupdf
from rapidfuzz import fuzz

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

NUM = r"\d{1,3}[A-Z]{0,3}(?:-[A-Z]{1,2})?"
PAGE_HDR = re.compile(r"^\s*Page \d+ of \d+\s*$", re.M)
UPDATED = re.compile(r"(?:Updated|updated|UPDATED)\s+(?:till|upto|up to)\s*:?\s*([0-9][0-9.\-/ ]{5,12}[0-9])")
FOOTNOTE_START = re.compile(
    r"^\s*\d{1,3}(?:Subs|Ins|Add|Omit|Rep|Renumber|Substitut|Insert|The |Now|See|Vide|For |Prov|Clause|Section|"
    r"Sec\.|Article|Art\.|Sub|Word|Orig|Amend|Delet|Declared|Ord|Act|P\.O|w\.e\.f|Struck|Re-|Modified|Cl\.|Para|Mod|Inserted|Shall)"
    r"|^\s*\*+\s?[A-Z][a-z]"  # "*For declaration of Urban Areas please see S.R.O ..."
)
PAGE_NUMBER = re.compile(r"^\s*\d{1,4}\s*$")
TOC_ENTRY = re.compile(rf"(?m)^\s*({NUM})\.\s*(?:\n\s*)?([^\n]{{2,240}})")
INLINE_MARK = re.compile(r"(?<![\w(])\d{1,3}(?=\[)|(?<=[\w\].,;:])\d{1,3}(?=\s*\[)")


# list markers: "(a)", "(ii)", "a)", "ii.", "12", "12A." - but not bare words like "in" or "of"
ENUMERATOR = re.compile(r"^\s*(\(\s*[0-9ivxlcA-Za-z]{1,6}\s*\)|\[\s*[0-9A-Za-z]{1,6}\s*\]|\d{1,3}[A-Z]{0,2}[.)]?|[ivxlcA-Za-z]{1,6}[.)])\s*$")
SECTION_START = re.compile(r"^\s*\W{0,3}\d{1,3}[A-Z-]{0,3}[.,]\s")  # "72. Power of ..." is a heading, not a margin note
MARGIN = "⁣"  # invisible marker on margin-title lines


def layout_pages(doc) -> tuple[list[list[str]], list[str]]:
    """Use the PDF layout: footnotes are printed in small type at the bottom of the page,
    and margin titles sit entirely outside the main text column."""
    sizes = []
    raw = []
    for page in doc:
        d = page.get_text("dict")
        w, h = d["width"], d["height"]
        rows = []
        for b in d["blocks"]:
            for l in b.get("lines", []):
                spans = [(s["text"], s["size"]) for s in l["spans"]]
                if not "".join(t for t, _ in spans).strip():
                    continue
                # whitespace-only spans don't count: a trailing body-size space made footnotes look like body text
                size = max((sz for st, sz in spans if st.strip()), default=max(sz for _, sz in spans))
                x0, y0, x1, _ = l["bbox"]
                rows.append((spans, size, x0 / w, x1 / w, y0 / h))
                sizes.append(round(size, 1))
        raw.append(rows)
    body_size = statistics.median(sizes) if sizes else 11.0
    pages, notes = [], []
    for rows in raw:
        wide = [r for r in rows if r[3] - r[2] > 0.4]
        # the text column runs from its leftmost to its rightmost wide line; the median would
        # misread an unindented short line as "margin" on pages where most text is indented
        left = min(r[2] for r in wide) if len(wide) >= 3 else None
        right = max(r[3] for r in wide) if len(wide) >= 3 else None
        kept, foot = [], []
        for spans, size, x0, x1, y in rows:
            # Superscript footnote marks are small number-only spans inside a normal line
            # ("Police Order, 2002" + superscript "1" would otherwise read "20021").
            if size > body_size - 2.5:
                t = "".join(st for st, sz in spans if not (sz <= body_size - 2.5 and re.fullmatch(r"[\d\s,*]+", st)))
            else:
                t = "".join(st for st, _ in spans)
            if not t.strip():
                continue
            if size <= body_size - 2.5 and y >= 0.55:
                foot.append(t)
                continue
            outside = left is not None and (x1 <= left - 0.005 or x0 >= right + 0.005)
            if (outside and len(t.strip()) < 45 and not ENUMERATOR.match(t) and not SECTION_START.match(t)
                    and re.search(r"[A-Za-z]{2}", t)):
                kept.append(MARGIN + t)  # margin title: visible for locating the body, removed from section text
                continue
            kept.append(t)
        pages.append(kept)
        if foot:
            notes.append("\n".join(foot))
    return pages, notes


PAGE_STARTS: list[int] = []  # char offset of each PDF page in the text page_texts() last returned


def page_texts(pdf: Path) -> tuple[str, list[str]]:
    """Return (body text without footnotes, list of footnote blocks). Also records where each
    PDF page starts in that text (PAGE_STARTS), so every section can link to its exact page."""
    doc = pymupdf.open(pdf)
    layout, layout_notes = layout_pages(doc)
    pages = [PAGE_HDR.sub("", "\n".join(p)).split("\n") for p in layout]
    # Running headers (e.g. "WEST PAKISTAN MOTOR VEHICLES ORDINANCE, 1965.") repeat on many pages.
    counts: dict[str, int] = {}
    for lines in pages:
        for k in {re.sub(r"\s+", " ", l).strip() for l in lines}:
            if len(k) >= 12:
                counts[k] = counts.get(k, 0) + 1
    furniture = {k for k, c in counts.items() if c >= 3 and c >= 0.25 * len(pages)}
    bodies, notes = [], []
    for lines in pages:
        lines = [l for l in lines if not PAGE_NUMBER.match(l) and re.sub(r"\s+", " ", l).strip() not in furniture]
        cut = None
        for i, line in enumerate(lines):
            if FOOTNOTE_START.match(line) and i > 3:
                cut = i
                break
        if cut is not None:
            notes.append("\n".join(lines[cut:]).strip())
            lines = lines[:cut]
        bodies.append("\n".join(lines))
    PAGE_STARTS.clear()
    pos = 0
    for b in bodies:
        PAGE_STARTS.append(pos)
        pos += len(b) + 1
    return "\n".join(bodies), layout_notes + notes


def page_of(offset: int) -> int:
    """1-based PDF page number for a character offset in the last page_texts() result."""
    return max(1, bisect.bisect_right(PAGE_STARTS, offset))


FIRST = re.compile(r"(?m)^\s*(?:\d{1,2}\[?)?\s*1\.\s*(?:\n\s*)?([^\n]{3,200})")
TITLE_END = re.compile(r"(\.?\s*(__|—|―|–|-{2})|\.\s|:\s*$)")


def find_body_start(text: str) -> tuple[int, bool]:
    """Return (body start, has_toc).

    The first "1." in the file is either the contents list or the body. Its title
    (e.g. "The Republic and its territories") appears a second time where the body
    starts; if it never reappears the act has no contents list.
    """
    m1 = FIRST.search(text)
    if not m1:
        return -1, False
    title1 = TITLE_END.split(m1.group(1).strip())[0]
    all_words = re.findall(r"[A-Za-z]+", title1)
    if not all_words:
        return m1.start(), False
    m2 = None
    for k in (4, 3, 2):  # "Short title, and commencement" vs "Short title and commencement"
        words = all_words[:k]
        if len(words) < 2 and k > 1:
            continue
        m2 = re.compile(r"\W+".join(map(re.escape, words)), re.I).search(text, m1.end())
        if m2:
            break
    if not m2:
        return m1.start(), False
    line_start = text.rfind("\n", 0, m2.start()) + 1
    prev_line = text.rfind("\n", 0, max(line_start - 1, 0)) + 1
    head = text[prev_line:m2.start()]
    if re.search(r"(?m)^\s*(?:\d{1,2}\[?)?\s*1\.\s*$", head):  # number on its own line above
        return prev_line, True
    return line_start, True


def parse_toc(toc: str) -> list[tuple[str, str]]:
    """Contents entries; a title that wraps onto the next line ("... by it.") is joined back."""
    entries, seen = [], set()
    lines = [l.strip() for l in toc.split("\n")]
    i = 0
    while i < len(lines):
        m = re.match(rf"^({NUM})\.\s*(.*)$", lines[i])
        if not m:
            i += 1
            continue
        num, title = m.group(1), m.group(2).strip()
        j = i + 1
        if not title and j < len(lines):
            title, j = lines[j], j + 1
        while (j < len(lines) and lines[j] and not re.match(rf"^({NUM})\.", lines[j])
               and not re.match(r"^(PART|CHAPTER|SCHEDULE|Section|SECTIONS?)\b", lines[j], re.I)
               and not is_caps(lines[j]) and lines[j][:1].islower()):
            title, j = f"{title} {lines[j]}", j + 1  # continuation lines start lower-case
        title = title.strip().rstrip(".").strip()
        i = j
        if not title or num in seen or re.match(r"^(PART|CHAPTER|SCHEDULE)\b", title):
            continue
        seen.add(num)
        entries.append((num, title))
    return entries


def body_heading(body: str, at: int, toc_title: str, num: str) -> str:
    """Prefer the enacted heading in the body ("Police Complaints Authority") over a
    contents-list typo ("Police Complain's Authority") when the two clearly match."""
    seg = body[at: at + 400].replace("\n", " ")
    m = re.search(num_pattern(num) + r"[.,)]?\s+", seg[:40])  # plain search: no nested quantifiers
    line = seg[m.end():] if m else seg
    cand = TITLE_END.split(line.strip())[0].strip().rstrip(".")
    if 4 <= len(cand) <= 160 and fuzz.ratio(norm(cand), norm(toc_title)) >= 80:
        return cand
    return toc_title


def clean(s: str) -> str:
    s = re.sub(rf"(?m)^[ \t]*{MARGIN}.*$\n?", "", s)  # margin titles live in the title field
    s = INLINE_MARK.sub("", s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\s*\n\s*", "\n", s)
    return s.strip()


def num_pattern(num: str) -> str:
    """'25-A' and '25A' are the same section."""
    m = re.match(r"(\d+)-?([A-Z]*)$", num)
    return rf"{m.group(1)}-?{m.group(2)}" if m and m.group(2) else re.escape(num)


# Glued footnote marks before a heading: "1", "3[2[", "7, 8", "[". Bounded repeats only:
# nested unbounded repeats backtracked exponentially on number-heavy lines (schedule tables).
MARK_LIST = r"\d{1,2}(?:,\s*\d{1,2}){0,6}"
MARKS = rf"(?:(?:{MARK_LIST})?\[){{0,3}}(?:{MARK_LIST})?"
MARKS_STRICT = r"(?:\d{1,2}\[|\[){0,3}"  # bracketed marks only: a bare glued digit could be a real digit ("17." is not "1"+"7.")


def heading_regex(num: str, loose: bool = False, strict: bool = False) -> re.Pattern:
    """loose: the full stop may be missing or mistyped ("18 Posting", "(2E) Removal", "26A,").
    Glued bare digits are allowed only when a title check follows; strict (no title check) forbids them."""
    marks = MARKS_STRICT if strict else MARKS
    if loose:
        return re.compile(rf"(?m)^\s*{marks}\s*[\[(]?(?<![0-9]{{3}}){num_pattern(num)}[.,)]?(?=\s)")
    return re.compile(rf"(?m)^\s*{marks}\s*\[?(?<![0-9]{{3}}){num_pattern(num)}\.(?=\s|\[|$)")


def norm(s: str) -> str:
    s = re.sub(r"\d{1,3}\[|\[|\]|[\"“”‘’'`]", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()


SCHEDULE_HEAD = re.compile(r"(?m)^\s*(?:\d{1,2}\[)?\s*(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH)?\s*SCHEDULE\b")


def is_placeholder(title: str) -> bool:
    return title.startswith("[") or not re.search(r"[A-Za-z]{3}", title) or bool(re.search(r"omitted|repealed", title, re.I))


TRAILING_HEAD = re.compile(r"^\s*(PART|CHAPTER)\b|^[\s_\-—=*.]+$")
# "26-27. [Repealed]", "26 and 27. [...]", "Rep. by A.O., 1937."
REPEAL_STUB = re.compile(r"^\s*(\d{1,3}\s*(?:[-–]|and)\s*\d{1,3}\.|Rep\.\s+by\b)|\[\s*(Repealed|Omitted)\s*\.?\s*\]\s*$", re.I)
SHORT_TAIL = re.compile(r"^\s*([A-Z][a-z]+(?:\s+[a-z]+){0,3}|[a-z]{2,12}\.)\s*$")  # "Removal", "permit." margin fragments
SUBHEAD = re.compile(r"^\s*[A-Z]\.\s*_{1,3}\s*\S")  # lettered sub-chapter heading: "F.__ Suspension and Removal"


def is_caps(line: str) -> bool:
    letters = re.sub(r"[^A-Za-z]", "", line)
    return len(letters) >= 4 and sum(c.isupper() for c in letters) / len(letters) > 0.8


def remove_title_block(lines: list[str], title: str, at_end: bool, skip_first: int = 0) -> list[str]:
    """Remove a margin title printed as a block of short lines ("Landlord and / tenant to
    furnish / particulars.") - the title is kept in its own field."""
    key = norm(title).rstrip(".")
    if len(key) < 6:
        return lines
    n = len(lines)
    starts = range(n - 1, skip_first - 1, -1) if at_end else range(skip_first, n)
    for start in starts:
        for size in range(1, 9):
            end = start + size
            if end > n or len(lines[end - 1].strip()) > 45:
                break
            if at_end and end != n:
                continue
            if fuzz.ratio(norm(" ".join(lines[start:end])).rstrip("."), key) >= 88:
                return lines[:start] + lines[end:]
    return lines


def tidy(text: str, title: str, next_title: str | None) -> str:
    lines = text.split("\n")

    def strip_tail(ls: list[str]) -> list[str]:
        while len(ls) > 1 and (TRAILING_HEAD.match(ls[-1]) or is_caps(ls[-1]) or REPEAL_STUB.search(ls[-1])
                               or SUBHEAD.match(ls[-1])
                               or (SHORT_TAIL.match(ls[-1]) and ls[-2].rstrip().endswith((".", ":", ";")))):
            ls = ls[:-1]
        return ls

    lines = strip_tail(lines)
    if next_title:  # the next section's margin title stuck to this one's end
        lines = strip_tail(remove_title_block(lines, next_title, at_end=True, skip_first=1))
    lines = remove_title_block(lines, title, at_end=False, skip_first=2)
    return "\n".join(lines).strip()


GENERIC_HEAD = re.compile(r"(?m)^\s*(?:\d{1,2}\[?|\[)?\s*(\d{1,3})([A-Z]?)\.\s*(?:\n\s*)?(?=[A-Z\[“\"‘])")


def sequential_headings(body: str) -> list[tuple[str, str, int]]:
    """For acts without a contents list: accept headings whose numbers run in order."""
    found, last = [], 0
    for m in GENERIC_HEAD.finditer(body):
        n = int(m.group(1))
        if last < n <= last + 3 or (n == last and m.group(2)):
            line = body[m.end(): m.end() + 200].split("\n")[0]
            title = TITLE_END.split(line.strip())[0][:120]
            found.append((f"{n}{m.group(2)}", title, m.start()))
            last = n
    return found


def split_act(entry: dict) -> tuple[list[dict], dict]:
    pdf = ROOT / entry["file"]
    text, notes = page_texts(pdf)
    upd = UPDATED.search(text) or UPDATED.search("\n".join(notes))
    start, has_toc = find_body_start(text)
    report = {"id": entry["id"], "title": entry["title"], "updated_till": upd.group(1).strip() if upd else None}
    if start < 0:
        report["error"] = "body start not found"
        return [], report
    toc, body = text[:start], text[start:]
    toc_entries = parse_toc(toc) if has_toc else []
    report["toc_entries"] = len(toc_entries)
    report["mode"] = "contents-guided" if toc_entries else "sequential (no contents list)"

    found, missing, pos = [], [], 0
    if not toc_entries:
        found = sequential_headings(body)
    for num, title in toc_entries:
        hit = None
        key = norm(title)[:40]
        for loose in (False, True):
            for m in heading_regex(num, loose).finditer(body, pos):
                after = norm(body[m.end(): m.end() + len(key) + 40])
                if (is_placeholder(title) and not loose) or fuzz.partial_ratio(key, after[: len(key) + 25]) >= 80:
                    hit = m
                    break
            if hit:
                break
        if hit is None:
            missing.append(f"{num} {title[:50]}")
            continue
        found.append((num, title, hit.start()))
        pos = hit.end()

    # Second pass: a missing entry is accepted only if exactly one heading with its
    # number lies between the found neighbours on either side (boxed in, so safe).
    bounded = []
    if toc_entries and missing:
        order = {num: i for i, (num, _) in enumerate(toc_entries)}
        by_num = {n: (n, t, p) for n, t, p in found}
        for num, title in toc_entries:
            if num in by_num:
                continue
            i = order[num]
            prev = max((by_num[n][2] for n, _ in toc_entries[:i] if n in by_num), default=0)
            nxt = min((by_num[n][2] for n, _ in toc_entries[i + 1:] if n in by_num), default=len(body))
            cands = list(heading_regex(num, strict=True).finditer(body, prev + 1, nxt))
            if len(cands) == 1:
                by_num[num] = (num, title, cands[0].start())
                bounded.append(num)
        found = sorted(by_num.values(), key=lambda x: x[2])
        missing = [f"{n} {t[:50]}" for n, t in toc_entries if n not in by_num]
    report["accepted_by_bounds"] = bounded

    # Fallback for acts whose titles sit in the margin ("2. In this Ordinance ... Definitions."):
    # trust the contents list's numbering order instead of the title. Lower confidence, flagged.
    if toc_entries and len(found) < 0.85 * len(toc_entries):
        alt, p = [], 0
        for num, title in toc_entries:
            m = heading_regex(num, strict=True).search(body, p)
            if m:
                alt.append((num, title, m.start()))
                p = m.end()
        if len(alt) > len(found):
            found = alt
            missing = [f"{n} {t[:50]}" for n, t in toc_entries if n not in {a[0] for a in alt}]
            report["mode"] = "number-order fallback (titles in margin) - review"

    sections = []
    for i, (num, title, at) in enumerate(found):
        end = found[i + 1][2] if i + 1 < len(found) else len(body)
        raw = body[at:end]
        if i + 1 == len(found):  # schedules follow the last section: keep them separate
            sm = SCHEDULE_HEAD.search(raw, 50)
            if sm:
                sched = clean(raw[sm.start():])
                raw = raw[:sm.start()]
                sections.append({
                    "id": f"{entry['id']}:schedules", "act_id": entry["id"], "act": entry["title"],
                    "level": entry["jurisdiction"], "section": "Schedules", "title": "Schedules",
                    "text": sched, "source_url": entry["pdf_url"], "version_date": report["updated_till"],
                })
        txt = tidy(clean(raw), title, found[i + 1][1] if i + 1 < len(found) else None)
        title = body_heading(body, at, title, num)
        page = page_of(start + at)
        sections.append({
            "id": f"{entry['id']}:{num}",
            "act_id": entry["id"],
            "act": entry["title"],
            "level": entry["jurisdiction"],
            "section": num,
            "title": title,
            "text": txt,
            "page": page,
            "source_url": entry["pdf_url"],
            "source_link": f"{entry['pdf_url']}#page={page}",  # opens the official PDF at this section
            "version_date": report["updated_till"],
        })
    lengths = [len(s["text"]) for s in sections]
    report.update(
        found=len(found),
        missing=missing,
        completeness=round(len(found) / len(toc_entries), 3) if toc_entries else 0.0,
        very_short=[s["section"] for s in sections if len(s["text"]) < 25],
        very_long=[s["section"] for s in sections if len(s["text"]) > 25000],
        total_chars=sum(lengths),
        footnote_blocks=len(notes),
    )
    # section 1 can sit just before the detected body start (text printed above its margin title)
    report["extent_clause"] = extent_clause(sections[0]["text"] if sections else "", clean(text[max(0, start - 3000): start + 5000]))
    return sections, report


# "It extends to ...", "It shall apply to ...", "This Act shall be called ... and shall take effect * * * throughout ..."
# "It ..." or "This Act/Ordinance/Order/Code ..." only, and never a "shall not apply" sentence
# (the Constitution's "this Article shall not apply to ..." is not an extent clause)
EXTENT = re.compile(r"(?:\bIt|\bThis\s+(?:Act|Ordinance|Order|Code|Regulation))(?:(?!\bnot\b)[^.;]){0,80}?\b(?:extends?|apply|applies|take\s+effect)\b[^;]*?(?:\.(?=\s|$)|;|$)", re.S)


def extent_clause(first_section: str, body_start: str) -> str | None:
    """The full extent sentence from section 1, or from the start of the body when section 1
    was not parsed. Never cut mid-word; stop before the next subsection or commencement."""
    for src in (first_section, body_start):
        m = EXTENT.search(src)
        if m:
            s = re.split(r"\s\(\d\)\s|It shall come into force", m.group(0))[0]
            return re.sub(r"\s+", " ", s).strip()
    return None


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    scope = json.loads((DATA / "scope.json").read_text(encoding="utf-8"))
    only = set(sys.argv[1:])
    all_sections, reports = [], []
    for entry in manifest:
        if only and entry["id"] not in only:
            continue
        secs, rep = split_act(entry)
        sc = scope[entry["id"]]
        rep["scope"] = sc
        reports.append(rep)
        if sc["status"] == "excluded":
            print(f"EXC {entry['id']:26s} {sc['reason'][:90]}")
            continue
        overrides = scope.get("_section_overrides", {})
        extent = (rep.get("extent_clause") or "").replace("\n", " ").strip()
        for s in secs:  # level = who made the law; applies_in = where it is the operative text
            o = overrides.get(s["id"], {})
            if o.get("status") == "excluded":
                continue
            for old, new in o.get("text_replace", []):  # audited fixes (e.g. a footnote line that leaked into the body)
                if s["text"].count(old) != 1:
                    raise SystemExit(f"text_replace for {s['id']} must match exactly once: {old[:60]!r}")
                s["text"] = s["text"].replace(old, new)
            s["level"] = o.get("level", sc["level"])
            s["applies_in"] = o.get("applies_in", sc["applies_in"])
            s["scope_note"] = o.get("scope_note", sc["scope_note"]) + (f" Extent clause: \"{extent}\"" if extent else "")
            all_sections.append(s)
        flag = "OK " if rep.get("completeness", 0) >= 0.98 else "CHK"
        print(f"{flag} {entry['id']:26s} toc={rep.get('toc_entries', 0):4d} found={rep.get('found', 0):4d} "
              f"({rep.get('completeness', 0):.0%}) updated={rep.get('updated_till')} {rep.get('error', '')}")
    if not only:
        with (DATA / "sections.jsonl").open("w", encoding="utf-8") as f:
            for s in all_sections:
                f.write(json.dumps(s, ensure_ascii=False) + "\n")
        (DATA / "checks").mkdir(exist_ok=True)
        (DATA / "checks" / "split_report.json").write_text(json.dumps(reports, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"sections: {len(all_sections)}")


if __name__ == "__main__":
    main()
