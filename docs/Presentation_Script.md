# Haq Assist: presentation script

What to say on each slide; the same text is in each slide's speaker notes. Main deck: 10 slides, 1,291 words, about 9 minutes at a calm pace, then the live demo (steps in Demo_Script.md).

One story runs through the talk: a stolen phone and a police clerk who won't register the FIR. Plain words first; the technical terms (RAG, embeddings, reranker, HyDE, hallucination, abstention, ablation) are explained the first time they appear.

## 1. Haq Assist

Assalam-o-alaikum. We are Muhammad Ammar and Hayyan Faisal, and this is Haq Assist. Haq means “right”, as in your rights. It is an AI assistant that helps ordinary people in Pakistan understand what the law says about their everyday problems. Let’s start with one of those problems.

## 2. Most people don’t know what the law says about their own problem

Imagine your brother’s phone is stolen. You go to the police station, and the clerk says: go and find it yourself first, then we’ll register the FIR. Is that allowed? Who can make them register it? Most of us have no idea. Pakistan’s courts already have more than two million cases waiting, our laws are written in formal legal English, and yet many everyday problems never need a court: the first step is often a complaint or a written notice, if you know which law to use. So the gap is simple: people don’t know what the law says about their own situation. We’ll follow this stolen phone through the whole talk.

## 3. Every option today is missing something

Where could you go today with that question? A lawyer explains well, but costs money and time. The government law websites are free and have the exact text, but you must find the right section yourself, in legal English. ChatGPT is free, instant and speaks Urdu, but it answers from memory and can quote laws that don’t exist. We wanted all four at once: plain Urdu, free and instant, the exact words of the law, and honesty when it doesn’t know.

## 4. Ask about your problem in your own words. Get the law that applies, in plain Urdu, with its exact text.

That’s what Haq Assist does, in one sentence: ask about your problem in your own words, and get the law that applies, in plain Urdu, with its exact text. So you type, or say, exactly what the clerk told you, in Roman Urdu. The app tells you that the police must record a report of a crime like theft, under section 154 of the Criminal Procedure Code, and that if they refuse, a Justice of the Peace can order them to, under section 22-A. Every step quotes the law word for word and links to the page of the government PDF, so you can check it yourself. And it knows its limits. Ask whether you must unlock your phone for the police, and it can’t verify an answer from its library, so instead of guessing it says “Not found, please ask a lawyer.”

## 5. Why not just ChatGPT? It makes up laws.

Why not just use ChatGPT? Because an AI answering from memory makes up laws: one model we tested, asked only to reword a question, invented a “Consumer Protection Act 2012”. We could fine-tune a model on our laws, but that needs thousands of checked examples we don’t have, and it still can’t show where an answer came from. So we used RAG, retrieval-augmented generation. It works like an open-book exam: retrieve the relevant law first, then generate the answer only from it. When a law changes, we update the library, not the model. Our addition is a third step that checks every quote. The hard part of RAG is retrieval, finding the right page, so we compared 69 search setups on 49 test questions. A hit means the right section is among the first five results. Keyword search scored 31 percent, because people don’t use the law’s words. Letting the AI rewrite the question in legal words: 71. Searching by meaning with embeddings: 88. Two embedding models plus a reranker, a second model that re-reads the top results and re-orders them: 98 percent. That’s what we built.

## 6. The data is the law, tested on unseen questions

For a RAG system, the data is the law itself. We downloaded 54 laws, 4,716 sections, only from the five official government law websites: the bar shows 31 federal laws and 23 from the four provinces. Every section keeps its PDF page, which is how each quote links back to its source. We train nothing, so what we needed was a fair test: 57 questions with known answers, including 8 the app should refuse, and 40 long, messy real-life stories written by another AI, Codex, which we didn’t read until the final test. Here is the key result, an ablation test: the same AI, Gemma 4, with and without our system. Grey is Gemma alone, green is Haq Assist. Alone, it gave 77 citations, and not one quote was in the actual law. With Haq Assist, 121 of 121 quotes are real, the answer cites the right law in 41 of 49 questions, and it refuses all 8 it should. The unseen stories are harder: right law in 19 of 32, and all 8 refusals correct.

## 7. Our requirements, and how we did

For a generative AI system, the key requirements are about what the AI may say; the course terms are in brackets. Hallucination: never show a made-up law. Result: zero. Abstention: say “Not found” instead of guessing. It refused all 8. Retrieval: 94 percent in the final app, lower than the 98 on the earlier slide because three questions gave no province. Then two honest gaps, shown in the charts. Fairness, top chart: English got the right law every time, Roman Urdu only 12 of 17, likely because words like “parcha” or “thanedar” never appear in the law. Latency, bottom chart: Gemma alone takes 6.5 seconds, the look-up brings it to 12.3, and the check adds 1.5 more, so 13.8, just over our dashed 12-second target. We accept that cost, because the check is what removes made-up laws. Finally, privacy: everything runs on our own PC.

## 8. The pipeline: five steps from question to answer

Here is the whole pipeline, with our stolen-phone question going left to right. The question is typed, or spoken and turned into text by Whisper. One, understand: Gemma 4, on our own PC, rewrites “FIR nahi kaat rahe” as “police refusing to register a theft report” and notes the province; for long stories it also writes law-style sentences to search with, called HyDE. Two, look up: two embedding models search by meaning, a reranker re-reads the best thirty and keeps six, here including CrPC 154 and 22-A. For urgent topics like arrest, rights cards we checked in advance join the sources. Three, answer: Gemma writes simple steps, each quoting one section, in a strict format at temperature zero. Four, the step that makes it safe: check. Every quote, number and province is compared with the official text, and a second AI pass confirms the quote supports the advice. A step that fails is removed; if nothing is left, it says “Not found” and points to a lawyer. Five, show the answer with its PDF page and a Listen button.

## 9. We assume the AI will make mistakes, and plan for them

Every AI makes mistakes, so we planned for them at three points. Before: the AI may only use the law it looked up, and for urgent cases like an arrest or a refused FIR there are ready-made rights cards, checked in advance, that work without the AI at all. During: every quote, number and province is checked, and anything unproven is removed. After: every answer carries a label, Reviewed, Official law text, or Not found, and “Not found” points you to a lawyer. Two real cases. Someone tried to trick it with a fake “section 999”: it said “Not found” and cited nothing. And a mistake of our own: our checker was too strict and rejected a correct FIR quote that was missing three words, so a right answer became “Not found”. Now it replaces the AI’s wording with the official text and checks it again. Let’s see it live.

## 10. Let’s ask it

First, an arrest question by voice, with each step shown live and the answer read aloud. Then the phone-unlocking question, then our stolen-phone story, and finally a faulty-phone complaint that changes between Islamabad and Punjab. [Run the demo: docs/Demo_Script.md.] To sum up: Haq Assist explains the law, it is not a lawyer, and every answer shows exactly where it came from. When it can’t prove something, it says so. Thank you.

## Appendix: backup slides (only if asked)

### Key acts behind everyday problems

*Show it if you are asked which laws are in the library.*

What is actually in the library? These are the acts behind the problems people ask about most. For arrest, the Constitution’s Article 10. For the police and FIRs, the Criminal Procedure Code: section 154 is the FIR, and under 22-A a Justice of the Peace can order the police to register it. The Police Order covers police misconduct, and PECA covers online harassment and blackmail. For a faulty product, the Islamabad and Punjab consumer laws: in Islamabad you complain directly, while in Punjab you must send the seller a notice first. That difference is exactly why the app asks for your province. Then family law, the Islamabad rent law, and for land and inheritance the Specific Relief Act and the women’s property laws. In total there are 54 acts, deepest for Islamabad and federal law, plus each province’s consumer, rent, police, traffic and harassment laws. The full list is in our repository.

### Same verified answers on every plan; you pay for more questions

*Show it if you are asked how this would be sustained.*

How could this be sustained? Our rule is that accuracy is never a paid feature: every plan gets the same checked answers, and the rights cards are free. Free gives 8 questions a month. Haq Go is 149 rupees for 40, Haq Plus 599 for 80, and Haq Ultra 899 for 150. Organisations such as legal-aid societies, NGOs and university legal clinics could license it to run on their own server. Our proposal had a 10 to 15 percent referral fee from lawyers. We dropped it, because Bar Council rule 136 restricts sharing fees with someone who is not a lawyer, so lawyers are listed free. These prices are proposals: the prototype counts questions but takes no payment.
