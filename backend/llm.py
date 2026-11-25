"""Client for the local LLM (Gemma 4 12B on llama.cpp, GPU 1, OpenAI-compatible API)."""
from __future__ import annotations

import json
import os

import httpx

URL = os.environ.get("HAQ_LLM_URL", "http://127.0.0.1:8091/v1/chat/completions")

UNDERSTAND_SCHEMA = {
    "type": "object",
    "properties": {
        "english_query": {"type": "string"},
        "region": {"type": "string", "enum": ["ict", "punjab", "sindh", "kp", "balochistan", "unknown"]},
        "topic": {"type": "string", "enum": ["police_arrest", "police_stop_search", "fir", "traffic", "consumer", "tenancy",
                                              "workplace_harassment", "online_harm", "family", "domestic_violence",
                                              "property", "contract", "criminal", "government", "other"]},
        "issues": {"type": "array", "maxItems": 3, "items": {"type": "string"}},
        "missing_facts": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["english_query", "issues", "region", "topic", "missing_facts"],
}

SYS_UNDERSTAND = (
    "You turn a Pakistani user's legal question (English, Urdu script or Roman Urdu) into JSON for a search engine.\n"
    "english_query: the legal issue restated in plain English legal terms, INCLUDING what the user wants to know "
    "(where or how to complain, time limit, penalty, rights), e.g. 'police detention without warrant time limit "
    "before production before magistrate' or 'where to file consumer complaint defective goods refund'. Do NOT name "
    "any act, ordinance, code or section number - "
    "you may misremember them; the search engine finds the law.\n"
    "issues: people often tell a story instead of asking a question. For each separate legal angle a lawyer would "
    "check (at most 3) - the person's rights in that situation (including constitutional rights such as liberty, "
    "dignity, privacy and being dealt with in accordance with law), the remedy (which court, authority, ombudsperson "
    "or official can order relief, and how), and any offence or misconduct by the other side or by officials - write "
    "ONE sentence phrased the way a statute would state the rule, in formal legal English, e.g. 'Every person shall "
    "be entitled to ...', 'A person aggrieved by ... may file a complaint before the ...', 'Whoever ... shall be "
    "punished with ...'. These sentences are only used to search the law, so you may name the kind of court, "
    "authority or official, but never an act, ordinance, code or section number. Say who the person affected is "
    "when it matters (e.g. a woman, a child or juvenile, an elderly person, a domestic worker, a tenant, a consumer, "
    "an employee), because some laws protect specific groups. A simple one-issue question needs only one sentence.\n"
    "Everyday words: FIR / parcha = information about a cognizable offence recorded at the police station; thana = "
    "police station; SHO = officer in charge of the police station; zamanat = bail; kiraya = rent; malik makan = "
    "landlord; talaq = divorce; khula = dissolution of marriage at the wife's request; nafqa / kharcha = maintenance; "
    "jahez = dowry; haq mehr = dower; wirasat / hissa = inheritance share; zameen / jaidad / plot = immovable property; "
    "intiqal = transfer or mutation of land; qabza = possession; dhoka / fraud = cheating; jaali kaghaz = forged "
    "document; rishwat = bribe (gratification to a public servant); tashaddud / maar peet = hurt or violence; "
    "sasural = in-laws.\n"
    "region: where the user is (Islamabad, Isb, ICT = ict; Lahore, Lhr, Rawalpindi, Pindi, Faisalabad, Multan = punjab; "
    "Karachi, Khi, Hyderabad, Sukkur = sindh; Peshawar, Mardan, Abbottabad = kp; Quetta = balochistan); "
    "'unknown' if not stated.\n"
    "topic: fir = the police refuse or delay registering an FIR or case; police_arrest = arrest, detention, bail; "
    "police_stop_search = being stopped, questioned or searched; consumer = a faulty product or poor service from a "
    "shop, seller or company (even if the product is a phone); online_harm = harm done through the internet, social "
    "media or messages (blackmail, harassment, fake profiles, online fraud).\n"
    "missing_facts: at most 3 short facts that would change the answer and were not given."
)


def chat(messages: list[dict], schema: dict | None = None, max_tokens: int = 900, temperature: float = 0.2) -> str:
    body = {"messages": messages, "temperature": temperature, "max_tokens": max_tokens,
            "chat_template_kwargs": {"enable_thinking": False}}
    if schema:
        body["response_format"] = {"type": "json_schema", "json_schema": {"name": "out", "schema": schema}}
    r = httpx.post(URL, json=body, timeout=180)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def understand(question: str) -> dict:
    out = chat([{"role": "system", "content": SYS_UNDERSTAND}, {"role": "user", "content": question}], UNDERSTAND_SCHEMA, 500,
               temperature=0.0)  # deterministic rewrite: the same question always searches the same way
    und = json.loads(out)
    und["issues"] = [str(i).strip() for i in und.get("issues") or [] if str(i).strip()][:3]
    return und
