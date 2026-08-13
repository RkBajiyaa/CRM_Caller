# Call Summary Contract — Conbun pet-care consultation calls

**Status:** specification for the pipeline that *produces* summaries. Today
that is Conbun Call's own on-device OpenAI provider (`ConbunCall_V4`), not
this backend.

**The CRM does not generate summaries and does not check them.** It stores
what `POST /api/calls/{id}/summary` is given and displays it (see
`API_DOCUMENTATION.md` § "AI summaries"). Nothing in this repository
fabricates summary text, and nothing here validates the rules below — they
cannot be enforced by an endpoint that only sees the finished output. This
document exists so both projects are working from one written contract
instead of two implicit ones.

> **Why this is a document and not code.** Every rule here is about
> *generation*: grounding, omission, language. A validator on the CRM side
> could only guess at whether a sentence was supported by the transcript, and
> a wrong guess would either reject good summaries or silently bless
> fabricated ones. Rejecting a submitted summary would also break the
> independence the pipeline depends on — a summary must be able to arrive,
> or fail, without endangering the call, the recording or the transcript. So
> the CRM's job is to persist faithfully and display honestly; the grounding
> guarantee has to live where the text is written.

---

## 1. The transcript is the only source of truth

The summary must be **strictly grounded in the transcript of that one call**.

Never invent, infer, extrapolate or "complete":

- symptoms, diagnoses, or clinical detail
- pet species, breed, name, age, or count
- appointment dates, times, bookings, or confirmations
- charges, fees, discounts, or payment status
- prescriptions, medicines, dosages, or delivery status
- outcomes, agreements, commitments, or next steps
- anything the customer or the agent did not actually say

If something was not said, it does not appear in the summary. A caller who
never mentioned their pet's species has no species in the summary — not a
guess, not "likely a dog", not a blank filled from context.

Prior calls, CRM notes, and customer records are **not** inputs. Each summary
describes exactly one conversation.

## 2. Structure

Use these sections. **Omit any section that the conversation did not cover**,
or state plainly that it was not discussed — never pad one with a guess.

```
CALL SUMMARY

Reason for Contact
Pet Information
Main Concern
Customer's Response / Intent
Consultation or Appointment Status
Discussion / Information Shared
Charges Discussed
Prescription / Medicine Status
Follow-up Requested
Next Steps
Unresolved Issues
```

A short summary of a short call is correct output. A call where the customer
said "call me later" and hung up should produce roughly three lines, not a
filled-in template.

### Mapping onto the API fields

`POST /api/calls/{id}/summary` takes these; the structure above goes in
`summaryText`.

| Field | What goes in it |
|---|---|
| `summaryText` | The structured summary above, as text. |
| `keyPoints` | A few short factual bullets, each traceable to something said. |
| `customerIntent` | What the customer wanted, in their terms — e.g. "wants a doctor consultation", "will book later", "asked for a callback". Null if never expressed. |
| `sentiment` | Only if genuinely evident. Null is a valid, honest answer. |
| `recommendedAction` | What the *agent* should do next, grounded in what was said. Not clinical advice. |
| `followUpRequired` | `true` only when a follow-up was actually asked for or agreed. |
| `modelProvider` / `modelName` | Which model produced this, for traceability. |

## 3. Language

- **Output is always English.** Always, including when the call was entirely
  in Hindi.
- Transcripts routinely mix Hindi and English. **Translate Hindi speech into
  English** rather than transliterating it.
- **Never produce Urdu, Spanish, Arabic, or any other language.** If the model
  drifts, the output is wrong and should be regenerated, not stored.
- Keep proper nouns as spoken — names of people, pets, places, clinics and
  medicines are not translated.
- **Unclear audio stays unclear.** Mark it (e.g. "[unclear]") rather than
  guessing at what was probably said. A guess in a transcript becomes a
  fabricated fact in the summary.

## 4. Typical conversations this covers

These are the real shapes of Conbun's outbound consultation calls. They are
listed to calibrate what a grounded summary looks like — not as templates to
match, and not as content to assume.

- Introduction — "Hi, I'm calling from Conbun."
- Asking which pet the customer has.
- Asking what issue or problem the pet is facing.
- Asking whether they want to consult a doctor.
- The customer agreeing to consult.
- The customer asking about booking an appointment.
- The customer saying they will book later.
- The customer asking for a callback later.
- The customer saying they have already booked.
- A post-appointment call asking about the appointment experience.
- Asking whether the prescription/medicines were received.
- A call about a pet concern identified on an earlier call.
- Offering to connect the customer with a doctor.
- The customer asking about consultation charges.

## 5. Failure is allowed; fabrication is not

If a summary cannot be produced — the transcript is empty, unusable, or the
model fails — submit
`POST /api/calls/{id}/summary` with `{"processingStatus": "FAILED"}` and no
text. That is a first-class outcome:

- it never touches the call, the recording, or the transcript;
- it never erases a summary that had previously succeeded;
- a later successful submission clears the `FAILED` state (see
  `API_DOCUMENTATION.md` § transcripts, "Retry semantics").

An empty or failed summary is always better than an invented one. The CRM
displays "no summary has been submitted" honestly, which is a true statement;
a fabricated summary in a pet-care record is not recoverable by anything
downstream.
