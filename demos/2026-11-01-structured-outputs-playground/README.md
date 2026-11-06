# Structured Outputs Playground

**[Live demo](https://iorekforges.mattsheehan.dev/demos/2026-11-01-structured-outputs-playground/)**

A simulated token-by-token decoder for a support ticket and a vendor invoice. A schema mask blocks illegal JSON as it is written, next to an unconstrained draft that breaks, with a validator on both.

## The idea in plain words

Asking a model for JSON and then calling `JSON.parse` fails in the usual ways: an unquoted word, a trailing comma, a decimal where an integer was required, an extra field. You can retry. You can also stop the bad token from being chosen.

Grammar-constrained decoding sits on the next-token distribution. At every step the grammar lists the tokens that could still lead to a valid document. Everything else is masked. The model samples from what remains, so the finished string matches the schema by construction. Outlines and llguidance are two systems that do this for real models. OpenAI's Structured Outputs is the hosted version of the same idea: you supply a JSON Schema, and the API commits to matching it.

This page is not calling a model. The logits are a scripted temptation, written so you can see the mask work. The mask itself is a real check over the schema subset the demo supports. A proposed token is allowed only when some completion of the text so far still validates: the right types, the enum, the pattern, the required keys, no extra keys, no trailing comma.

## What the page shows

Two extractions a billing desk would actually ask for.

- **Support ticket.** The schema requires `ticket_id` matching `SUP-` plus four digits, a requester, a priority enum, a category enum, a summary, and `refund_cents` as an integer. The source is an email about a $42.00 double charge.
- **Vendor invoice.** Vendor, `INV-` number, a currency enum, a line-item array, and `total_cents`.

Step, or press Play. The left tape is the masked decoder. The right tape takes the simulated model's favorite token, including tokens the mask removed. Under each tape, a validator says whether the text is an unfinished but still-legal prefix, valid JSON that fails the schema, or a prefix that can no longer be saved.

The four setups:

| Setup | What the unconstrained draft does |
| --- | --- |
| Unquoted priority | Writes `urgent` instead of `"urgent"`. The enum is a JSON string, so the bare word is masked. The draft is no longer valid JSON. |
| Dollars, plus an extra field | Prefers `42.00` for `refund_cents`. A decimal is not an integer, so the mask keeps `4200` (the charge in cents). The draft then adds `sentiment`, which `additionalProperties: false` rejects. The JSON parses; the schema does not. |
| Trailing comma | After the last required field, prefers a comma. Nothing legal can follow it, so the mask keeps `}`. The draft closes with `,}` and the JSON parser fails. |
| Invoice quantity | At `currency`, an unquoted `USD` is offered and masked, and the model happens to pick the legal token anyway. At `qty` it prefers `4.0`. The draft later leaves a comma before `]`. |

The schema on the page is the one the mask is enforcing. The bars are a softmax over the scripted logits. "After mask" is that softmax again with the illegal logits removed, which is what a sampler would see.

What the mask does not do: it will not correct a value that is the right type and the wrong fact. `42` and `4200` are both legal integers. If the model prefers `42`, the mask lets it through. Schema-valid is not the same as a correct refund.

## How a team would use this

A billing or support team that wants model output to land in a database already has a schema. It is the queue's ticket type, or the invoice row the ERP will accept. The failure mode they hit first is not a wrong total. It is a response that will not parse, so the job errors and someone pastes the model's text into a spreadsheet.

1. Write the JSON Schema the database already implies: required fields, enums for the statuses you actually store, integers for money in minor units, `additionalProperties: false` so a chatty field cannot sneak in.
2. Run the real tickets and invoices through a constrained decoder (Structured Outputs, Outlines, llguidance, or the grammar backend in your inference server). Keep the unconstrained call only as a comparison while you are deciding.
3. Treat the mask as a syntax guarantee. Keep a validator in the service anyway, and keep a set of examples where the type is right and the value is wrong, like a refund in dollars stored in a cents field. Those still need tests, or a second check that `refund_cents` is the amount in the email times 100.
4. When the schema changes, change the decoder's schema in the same pull request as the database. A mask built from yesterday's schema will faithfully produce yesterday's JSON.

The playground is how you show a teammate the difference between "the model usually returns JSON" and "this token was impossible, so it was not offered." The system you adopt is the schema plus a decoder that masks, with the validator left on.

## How to run

Open `index.html` in a browser. It has no build step, no network calls, and no API key. The shared stylesheet is a relative path, so the page also works on the project site.

From this folder, or from the repo root:

```bash
python3 -m http.server
```

Then open the printed local URL and follow the path to `index.html`. Either way works; the page does not need a server.

## Sources

The emails, the invoice, and the scripted logits are made up for this demo. The decoding idea and the schema language are not.

- OpenAI, [Structured model outputs](https://platform.openai.com/docs/guides/structured-outputs). The current guide: supply a JSON Schema and the API returns an object that matches it.
- OpenAI, [Introducing Structured Outputs in the API](https://openai.com/index/introducing-structured-outputs-in-the-api/) (6 August 2024). The announcement. It separates this from JSON mode, which only promised valid JSON, not a particular schema.
- JSON Schema, [What is JSON Schema?](https://json-schema.org/overview/what-is-jsonschema). The language this page's ticket and invoice are written in.
- JSON Schema, [JSON Schema Core, 2020-12](https://json-schema.org/draft/2020-12/json-schema-core.html). The specification for the dialect.
- [Outlines](https://github.com/dottxt-ai/outlines) (dottxt-ai). Structured generation by masking illegal tokens. The [architecture guide](https://dottxt-ai.github.io/outlines/latest/guide/architecture/) describes the logits processor: invalid tokens are removed before the model samples.
- [llguidance](https://github.com/guidance-ai/llguidance) (guidance-ai). A constrained-decoding library. Given a grammar (including a large subset of JSON Schema) and the tokens so far, it computes the mask of tokens that can still lead to a valid string.
