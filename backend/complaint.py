"""Consumer complaint drafts (ICT and Punjab).

The LLM only extracts facts from the user's story into a form the user edits. The legal text of
each draft comes from fixed templates whose legal basis is quoted verbatim (verified) from the
official sections, with links to the PDF page. Drafts are labelled for review before filing.
"""
from __future__ import annotations

import json
from datetime import date

from . import llm
from .verify import exact_quote

FIELDS = ["complainant_name", "complainant_address", "seller_name", "seller_address", "product_or_service",
          "purchase_date", "amount_paid", "problem", "steps_taken", "relief_wanted"]
EXTRACT_SCHEMA = {"type": "object", "properties": {f: {"type": "string"} for f in FIELDS}, "required": FIELDS}
SYS_EXTRACT = ("Extract the facts of a consumer complaint from the user's story (English, Urdu or Roman Urdu) into the "
               "fields, in English. Use an empty string for anything not stated; never invent names, dates or amounts. "
               "relief_wanted: refund, replacement, repair and/or compensation, as the user wants.")

BASIS = {
    "ict": [
        ("ict_consumer:8", "A complainant may in respect of any goods sold or delivered or any service provided or supplied or against any unfair trade practice file a complaint with the Authority.",
         "You can file a complaint about defective goods or services with the Authority."),
        ("ict_consumer:2", "“Authority” means the Court of Sessions, Islamabad",
         "In Islamabad the Authority is the Court of Sessions."),
        ("ict_consumer:8", "it shall cause the notice of the complaint to be served on the respondent who shall be required to give his reply within a period of seven days.",
         "If the court finds your rights may have been infringed, it serves notice and the seller must reply within seven days."),
    ],
    "punjab": [
        ("punjab_consumer:28", "shall, by written notice, call upon a manufacturer or provider of services that a product or service is defective or faulty",
         "Before going to court you must send the seller a written notice (this draft)."),
        ("punjab_consumer:28", "The manufacturer or service provider shall, within fifteen days of the receipt of the notice, reply thereto.",
         "The seller must reply within fifteen days of receiving the notice."),
        ("punjab_consumer:28", "No claim shall be entertained by a Consumer Court unless the consumer or the Authority has given notice under sub-section (1)",
         "The Consumer Court will not hear your claim unless you gave this notice and can prove it was delivered."),
        ("punjab_consumer:28", "A claim by the consumer or the Authority shall be filed within thirty days of the arising of the cause of action",
         "File the claim within thirty days of the cause of action (the court may allow more time for sufficient cause)."),
        ("punjab_consumer:31", "to return to the claimant the price or, as the case may be, the charges paid by the claimant",
         "The Consumer Court can order repair, replacement, a refund or compensation."),
    ],
}


def extract(story: str) -> dict:
    out = llm.chat([{"role": "system", "content": SYS_EXTRACT}, {"role": "user", "content": story}], EXTRACT_SCHEMA, 500, 0.0)
    return json.loads(out)


def legal_basis(region: str, sections: dict) -> list[dict]:
    items = []
    for sid, quote, plain in BASIS[region]:
        s = sections[sid]
        q = exact_quote(quote, s["text"])
        if q:  # only verified quotes are shown
            items.append({"section_id": sid, "act": s["act"], "section": s["section"], "title": s["title"], "quote": q,
                          "plain": plain, "link": s["source_link"], "page": s["page"]})
    return items


def _f(fields: dict, k: str, placeholder: str) -> str:
    v = (fields.get(k) or "").strip()
    return v if v else f"[{placeholder}]"


def draft(fields: dict, region: str, sections: dict) -> dict:
    today = date.today().strftime("%d %B %Y")
    f = lambda k, p: _f(fields, k, p)  # noqa: E731
    if region == "ict":
        main = f"""BEFORE THE COURT OF SESSIONS, ISLAMABAD
(Authority under the Islamabad Consumers Protection Act, 1995)

Complaint under section 8 of the Islamabad Consumers Protection Act, 1995

{f('complainant_name', 'Your full name')}, resident of {f('complainant_address', 'your address')} ... Complainant

Versus

{f('seller_name', 'Seller / company name')}, {f('seller_address', 'seller address')} ... Respondent

Respectfully submitted:
1. On {f('purchase_date', 'date of purchase')} the Complainant bought {f('product_or_service', 'product or service')} from the Respondent for Rs. {f('amount_paid', 'amount paid')}.
2. {f('problem', 'Describe the defect or problem')}.
3. {f('steps_taken', 'What you did to resolve it (visits, calls, messages) and the response')}.
4. The Complainant's rights as a consumer have been infringed.

Prayer: The Complainant requests this Honourable Court to order the Respondent to provide {f('relief_wanted', 'refund / replacement / repair / compensation')}, and any other relief the Court deems appropriate.

Documents attached: receipt or invoice, photographs, warranty card, copies of messages.

Complainant: ____________________    Date: {today}
"""
        letter = f"""To: {f('seller_name', 'Seller / company name')}, {f('seller_address', 'seller address')}
Date: {today}

Subject: Defective {f('product_or_service', 'product or service')} - request for {f('relief_wanted', 'refund / replacement / repair')}

On {f('purchase_date', 'date of purchase')} I bought {f('product_or_service', 'product or service')} from you for Rs. {f('amount_paid', 'amount paid')}. {f('problem', 'Describe the defect')}.
Please provide {f('relief_wanted', 'a refund / replacement / repair')} within ___ days. Otherwise I will file a complaint with the Court of Sessions, Islamabad under the Islamabad Consumers Protection Act, 1995.

{f('complainant_name', 'Your name')}, {f('complainant_address', 'your address')}
"""
        docs = [{"kind": "complaint", "title": "Complaint to the Court of Sessions, Islamabad", "text": main},
                {"kind": "letter", "title": "Optional letter to the seller (not required in ICT)", "text": letter}]
        steps = ["Optional: send the letter to the seller and keep a copy.",
                 "File the complaint with the Court of Sessions, Islamabad, with your documents.",
                 "If the court finds your rights may have been infringed, the seller is given seven days to reply."]
    elif region == "punjab":
        notice = f"""LEGAL NOTICE under section 28(1) of the Punjab Consumer Protection Act, 2005

To: {f('seller_name', 'Manufacturer / service provider')}, {f('seller_address', 'address')}
(manufacturer or provider of services, as section 28(1) requires; send a copy to the seller if different)
Date: {today}

1. On {f('purchase_date', 'date of purchase')} I purchased {f('product_or_service', 'product or service')} from you for Rs. {f('amount_paid', 'amount paid')}.
2. The product / service is defective or faulty: {f('problem', 'describe the defect')}.
3. {f('steps_taken', 'What you did to resolve it and the response')}.

Under section 28(1) of the Punjab Consumer Protection Act, 2005 I call upon you to remedy the defect or {f('relief_wanted', 'refund / replace / repair / pay compensation')}. Under section 28(2) you are required to reply within fifteen days of receiving this notice. If you do not, I will file a claim before the Consumer Court.

{f('complainant_name', 'Your name')}, {f('complainant_address', 'your address')}
"""
        docs = [{"kind": "notice", "title": "Legal notice under section 28(1) (required in Punjab)", "text": notice}]
        steps = ["Send this notice to the manufacturer or service provider (section 28(1)) in a way you can prove delivery, e.g. registered post or courier with receipt.",
                 "Wait for the reply: the manufacturer or service provider must reply within fifteen days.",
                 "If there is no reply, file a claim before the Consumer Court within thirty days of the cause of action, with proof of delivery."]
    else:
        return {"supported": False, "message": "Complaint drafts are available for Islamabad and Punjab in this prototype."}
    basis = legal_basis(region, sections)
    if len(basis) < len(BASIS[region]):  # a cited basis failed verification: do not present the draft as reliable
        return {"supported": False, "message": "The legal basis for this draft could not be verified against the official text."}
    return {"supported": True, "region": region, "documents": docs, "next_steps": steps,
            "legal_basis": basis,
            "warning": "Draft for review. Check it with a lawyer or legal-aid service before filing; court fees and filing formats are not covered."}
