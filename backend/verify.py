"""Deterministic answer checks: exact quotes and numbers. No model involved."""
from __future__ import annotations

import re

from rapidfuzz import fuzz

NUM_WORDS = {w: n for n, w in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen "
    "eighteen nineteen twenty".split())}
NUM_WORDS.update({"thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
                  "hundred": 100, "twenty-four": 24, "forty-eight": 48, "seventy-two": 72, "forty-five": 45})


def norm_text(s: str) -> str:
    s = (s.replace("­", "").replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
         .replace("—", "-").replace("–", "-").replace("―", "-").replace("⸺", "-"))
    return re.sub(r"\s+", " ", s).strip().lower()


# Urdu number words (unambiguous ones only; e.g. "نو" also means "new", so it is left out)
UR_NUM_WORDS = {"ایک": 1, "دو": 2, "تین": 3, "چار": 4, "پانچ": 5, "چھ": 6, "سات": 7, "آٹھ": 8, "دس": 10, "گیارہ": 11,
                "بارہ": 12, "تیرہ": 13, "چودہ": 14, "پندرہ": 15, "سولہ": 16, "سترہ": 17, "اٹھارہ": 18, "انیس": 19,
                "بیس": 20, "چوبیس": 24, "تیس": 30, "چالیس": 40, "پینتالیس": 45, "اڑتالیس": 48, "پچاس": 50, "ساٹھ": 60, "نوے": 90}
DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def numbers(s: str) -> set[int]:
    """Numbers stated in a text, as digits or words, in English or Urdu ("24", "twenty-four", "۲۴", "چوبیس")."""
    s = s.lower().replace("­", "").translate(DIGITS)
    out = {int(n) for n in re.findall(r"(?<![\d,.])\d{1,6}(?![\d])", s.replace(",", ""))}
    for w, n in NUM_WORDS.items():
        if re.search(rf"\b{re.escape(w)}\b", s):
            out.add(n)
    for w, n in UR_NUM_WORDS.items():
        if re.search(rf"(?<!\w){w}(?!\w)", s):
            out.add(n)
    return out


EXACT_MIN = 96  # near-identical: spacing, curly quotes, a dropped footnote mark or word
SNAP_MIN = 85   # close paraphrase of one passage: snapped to the official wording, then re-checked


def _align(quote: str, source: str) -> tuple[float, int, int, str, str] | None:
    """Best-matching passage of the source for a quote: (score 0-100, start, end, normalized quote, normalized source)."""
    q, src = norm_text(quote), norm_text(source)
    if len(q) < 12 or len(q.split()) < 5 or len(q) > len(src):  # too short to be meaningful evidence
        return None
    if q in src:
        i = src.index(q)
        return 100.0, i, i + len(q), q, src
    # Best window of the quote's length anywhere in the section. (An earlier version scanned in steps of a
    # tenth of the quote and only refined windows that already scored >= 96, so a misaligned coarse window
    # could hide a near-identical quote.)
    a = fuzz.partial_ratio_alignment(q, src)
    # The passage may be longer or shorter than the quote (a word dropped or added), so try word-boundary
    # starts and ends around the window and keep the passage most similar to the quote as a whole.
    slack = max(20, len(q) // 4)
    bounds = lambda lo, hi: [k for k in range(max(0, lo), min(len(src), hi) + 1)  # noqa: E731
                             if k == 0 or k == len(src) or src[k - 1] == " " or src[k] == " "]
    starts = [k for k in bounds(a.dest_start - slack, a.dest_start + slack) if k == 0 or src[k - 1] == " "]
    ends = [k for k in bounds(a.dest_end - slack, a.dest_end + slack) if k == len(src) or src[k] == " "]
    def f2(i: int, j: int) -> tuple[float, float]:
        # matched characters from the Indel ratio; weight coverage of the quote over tightness of the passage,
        # so a passage that includes the quote's opening words beats a shorter one that cuts them off
        r = fuzz.ratio(q, src[i:j])
        m = r * (len(q) + j - i) / 200
        rec, prec = m / len(q), m / max(1, j - i)
        return (5 * prec * rec / (4 * prec + rec) if m else 0.0), r
    best_f, best_r = f2(a.dest_start, a.dest_end)
    best = (a.dest_start, a.dest_end)
    for i in starts:
        for j in ends:
            if j - i >= len(q) // 2:
                f, r = f2(i, j)
                if f > best_f:
                    best_f, best_r, best = f, r, (i, j)
    return max(a.score, best_r), best[0], best[1], q, src


def exact_quote(quote: str, source: str) -> str | None:
    """Return the source's own words for a quote, or None if the quote is not really in the source.
    Tiny differences are tolerated; the returned text is always taken from the source, so what the
    user sees is verbatim."""
    a = _align(quote, source)
    if not a or a[0] < EXACT_MIN:
        return None
    return _original_words(source, a[4], a[1], a[2])


def snap_quote(quote: str, source: str) -> tuple[str | None, str]:
    """Like exact_quote, but a close paraphrase of a single passage (score >= SNAP_MIN) is replaced by that
    passage's official words. Returns (verbatim text or None, "exact" | "snapped" | "missing").
    A snapped quote is only evidence if the support check later confirms it backs the claim."""
    a = _align(quote, source)
    if not a or a[0] < SNAP_MIN:
        return None, "missing"
    score, i, j, _, src = a
    # widen to whole words so the passage never starts or ends mid-word
    while i > 0 and src[i - 1] != " ":
        i -= 1
    while j < len(src) and src[j] != " ":
        j += 1
    return _original_words(source, src, i, j), ("exact" if score >= EXACT_MIN else "snapped")


def _original_words(original: str, normalized: str, i: int, j: int) -> str:
    """Map a span of the normalized text back to the original words (whitespace collapses 1:1 by words)."""
    before = len(normalized[:i].split()) if i > 0 and normalized[i - 1] == " " else max(0, len(normalized[:i].split()) - 1)
    n_words = len(normalized[i:j].split())
    words = original.replace("­", "").split()
    return " ".join(words[before: before + n_words])


_DOCS: dict = {}


def quote_page(pdf_path: str, start_page: int | None, quote: str) -> int | None:
    """1-based PDF page where the quote's opening words appear (searching from the section's
    start page), so a link opens exactly where the user can read the quote."""
    try:
        import pymupdf
        doc = _DOCS.setdefault(pdf_path, pymupdf.open(pdf_path))
    except Exception:
        return start_page
    letters = lambda t: re.sub(r"[^a-z]", "", t.lower())  # noqa: E731
    key = letters(quote)[:45]
    if len(key) < 15:
        return start_page
    first = max(0, (start_page or 1) - 2)
    for p in range(first, min(len(doc), first + 8)):
        txt = letters(doc[p].get_text())
        if key in txt:
            return p + 1
        # quote may begin at the bottom of this page and continue on the next
        if p + 1 < len(doc) and key in txt[-200:] + letters(doc[p + 1].get_text())[:200]:
            return p + 1
    return start_page
