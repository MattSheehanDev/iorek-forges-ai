# Rules after compaction

**[Live demo](https://mattsheehandev.github.io/iorek-forges-ai/demos/2026-11-04-compaction-rule-compliance/)**

Northwind Logistics lets an ops agent send email and open tickets, and the handbook allows only `@northwind.example`. After a scripted compact, the agent CCs an outside vendor unless the rule is pinned again or the tool wrapper blocks the domain.

## The idea in plain words

A long agent session fills the context window. The harness then compacts the older turns into a short summary and keeps going. The pending task usually survives that summary. The operating rule is less settled: sometimes the words stay, sometimes they soften, and the agent can break the rule either way.

ARCBench (Zha, Meng, Bos, and Chen, arXiv 2611.03223, 2 Nov 2026) measures that break from the tool call, inside a real agent harness, with the same tasks run on the full history and again after compaction. On their main study, violation@3 rises from 9.6% with the full history to 37.8% after compaction. Of those 37.8 points, 8.9 are cases the agent also fails before compaction, and 28.9 appear only after. The summary usually still has the rule: 70.1% of compacted runs retain it, 26.9% keep it only in part, and 3.0% lose it.

Keeping the sentence is a different event from obeying it. Among compacted runs that still contain the rule, 21.1% violate, against 8.1% of full-history runs. That is the paper's 2.6×. When the rule is only partial, 29.4% of those runs violate. When it is absent, 83.3% do.

The reason the agent gives changes too. ARCBench's labels are approval (the later request counts as permission), scope (the agent decides the action is outside the rule), unregistered (the reasoning never mentions the rule), and acknowledged (it states the rule and proceeds). Among violations that appear only after compaction, Table 4 reports approval 45.9%, unregistered 27.0%, and acknowledged 21.6%. Approval is also the main reason on violations the agent already commits with the full history (72.4%).

How the rule arrives matters before any compact. With the full history still in view, no organizational case violated: neither document-embedded rules nor rules fetched from a policy tool. Personal instructions did. Direct instructions hit 25.0% violation@3, and persistence instructions 16.1%, on that full history (Table 5, studies S2–S4). A later user message can be read as lifting a rule the user wrote. It is a weaker excuse for a rule the company wrote.

The compactor matters for whether the words survive. Seven generative strategies, which write a new summary, retain the rule in 91.2% of runs and reach 21.8% violation@3. Three selective strategies, which drop turns and keep the rest verbatim, lose the rule in 84.1% of runs and reach 50.2% violation@3. FIFO loses it in every run. So a generative summary is the safer place to look for the sentence, and it is still a poor guarantee of the call. The violations generative compactors add are mostly runs where the rule is still in context. Approval is the reason given for 62.3% of those added violations (Table 6).

A tight budget can delete the rule when a looser one does not. From 2,500 tokens down to 750, violation@3 stays between 24.2% and 28.1%, and at least 97.1% of runs retain the rule. At 300 and 200 tokens, at least 95.1% of runs lose it, and violation@3 rises to 47.1% and 50.0%.

An attack aimed at the compactor can rewrite the sentence the agent will trust. Volume stuffing barely moves the rate (37.8% to 34.3% violation@3). Compactor-targeted injection in that same study raises it from 37.8% to 46.3%, and the share of runs that retain the rule falls from 70.1% to 42.5%. The strongest of those attacks, escape, more than doubles violations on the later study: violation@6 goes from 23.5% with no attack to 58.8%. Retention falls from 96.1% to 66.7%, and runs that still retain the rule violate more often too (26.5% against 13.3%).

Rule preservation is the strongest of the four defenses they tried. It tells the compactor to keep operating rules, and under the escape attack it retains the rule in 99.0% of runs. Violation@6 falls from 58.8% to 29.4%. The no-attack level in that study is 23.5%, so the sentence comes back more reliably than the behavior. The other defenses retain the rule in 82.4–87.3% of runs and leave violation@6 at 41.2–52.9%. Pi with a rule-preservation instruction is the only strategy in that study under the full-context baseline (9.0% against 11.9% violation@3). That is a compaction prompt. The tool wrapper is a separate check.

Some teams skip the summary and search the original history when a later step needs a rule or a fact. That is the Mainplane argument, and it is a different design from the one ARCBench measures. This page stays on the compaction path.

## A business use

Northwind Logistics is fictional. The shift is a dock delay, a reefer temperature, a customer who must not be emailed, and a vendor who wants the dock window. The agent may call `send_email` and `open_ticket`. Mail Policy NW-MAIL-04 says every address on to, cc, and bcc must be `@northwind.example`. Mid-shift, nobody waives it. After the window fills, the operator asks for `dispatch@northwind.example` plus a CC to `vendor@acme-freight.com`, "just this once."

That shape shows up anywhere an internal agent can send, file, pay, or grant: a law firm that may write only to client domains, a clinic portal that may message staff addresses, a broker that may release a document only to the desk that owns it. The dangerous turn is often polite, specific, and late. The early policy is exactly what compaction is tempted to shorten.

The paper's introduction is this scene in one paragraph: an email agent told to stay inside the company, a compact, then an external delivery. ARCBench's finding is sharper than "the summary forgot." Most of the time the summary still has the rule, and the agent treats the new request as permission, ignores the rule, or names the rule and continues.

## How a team would adopt it

1. Pin hard rules outside the transcript the compactor is allowed to rewrite. A system slot, a handbook file the summary cannot replace, or a policy tool the agent must read again. Organizational wording holds up better than a personal "remember to…" while the full history is still visible. It does not, by itself, survive contact with a later user request after compact.
2. Re-inject the rule after every compact, in the original words. Do this in the harness, including after a manual `/compact`, a threshold compact, and a compact the user never sees. ARCBench's rule preservation restored the text in 99.0% of runs under the strongest attack they tried, and violations stayed above the no-attack runs. Treat the re-injection as necessary and incomplete.
3. Enforce the rule in the tool wrapper. For this mail rule, read to, cc, and bcc, and refuse the call when any domain is not the allowlist. Return the error to the model if you want a retry. Send nothing on the failed call. The page's check is the whole function:

```javascript
function isInternal(email) {
  const value = String(email).trim();
  const at = value.lastIndexOf("@");
  if (at < 1) return false;
  return value.slice(at + 1).toLowerCase() === "northwind.example";
}
```

4. Grade compliance from the tool call. A summary that still quotes the rule can sit next to a `send_email` that breaks it. Log the arguments the wrapper actually saw. Count a violation when the call matches the forbidden pattern, including when a later gate blocks it. The block is a save. The attempt is still the failure you want on a dashboard.
5. If you need the old detail back, retrieve the original turns instead of trusting a shorter paraphrase. Compaction is a lossy write. Search is a read of the record you already had.

## What the page shows

Open `index.html`. The shift is 21 scripted turns. The rule is the first one, as handbook policy. The buttons are the whole experiment. Nothing calls a model.

- **Run with full history** keeps every turn. This script refuses the vendor CC, opens a ticket noting the refusal, and emails `dispatch@northwind.example` only.
- **Compact then continue** replaces the shift with a scripted summary. By default the summary weakens the rule to "prefer internal recipients," and the script treats "just this once" as permission. The log shows `send_email` with `vendor@acme-freight.com` on cc.
- **Compact + preserve rule** uses that same summary, then pins NW-MAIL-04 again, verbatim, outside the summary. This script refuses. The paper's models recover only part of the way. The page says so under the columns.
- **Run all three** plays the three paths together.
- **Summary keeps the exact rule** puts the handbook sentence inside the summary. The compact path states the rule and sends anyway. That is the retained-rule failure, scripted on purpose. Generative summaries in the paper retain the rule in 91.2% of runs.
- **Attack: injection** rewrites the rule line the agent will read, as if the compactor had been told to allow a just-this-once vendor. The agent never sees the attack instruction. Preserve still pins the original sentence.
- **Tool gate** runs the domain check on every `send_email` this page emits. Off, the bad call is delivered and the badge says VIOLATE. On, the same arguments come back blocked and the badge says GATE HELD. Paths that never name the vendor still pass. The gate did not have to fire.

The percentages in the strip are ARCBench's. The badges are this script, so they are not those rates. A real model will mix the four behaviors. This one is deterministic so the log is readable.

## How to run

Open `index.html` in a browser. No build step, no network call, no API key. The shared stylesheet is a relative path, so the page also works on the project site.

From this folder, or from the repo root:

```bash
python3 -m http.server
```

Then open the printed local URL and follow the path to `index.html`. Either way works. The page does not need a server.

## Sources

The company, the shift, the summary wording, and the scripted pass/fail badges are made up for this demo. The rates below are ARCBench's, from the HTML version of the paper. violation@3 and violation@6 are different metrics, and the studies (S1 against S6–S7) use different setups. They are cited next to the number they belong to.

- Yiwei Zha, Qingyu Meng, Herbert Bos, and Min Chen, [Do Agents Still Follow the Rules? Benchmarking Rule Compliance under Agent Context Compaction](https://arxiv.org/abs/2611.03223) (ARCBench, 2 Nov 2026). [HTML](https://arxiv.org/html/2611.03223v1). Code: [VUAISec/ARCBench](https://github.com/VUAISec/ARCBench).
- Posts that pointed at the topic: [ARCBench explainer](https://x.com/arkyyang/status/2117630330190635476) (3 Nov 2026), [Alexander Yue on Mainplane](https://x.com/Alezander9/status/2115842962521509968) (compaction is lossy; prefer full-history retrieval), [retained-rule runs still violate more than 2×](https://x.com/pryzmat_tech/status/2117556532682375356), and [the task survives while boundaries wander](https://x.com/HeyDravon/status/2116923386311983344).
- On searching the original history instead of trusting a summary: [AlphaSignal on Mainplane](https://alphasignal.ai/news/mainplane-gives-coding-agents-searchable-memory-to-beat-context-limits/) and [context compaction vs retrieval](https://www.maximem.ai/blog/context-compaction-vs-retrieval).
