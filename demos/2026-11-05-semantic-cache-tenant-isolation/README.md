# Semantic cache, tenant gate

**[Live demo](https://mattsheehandev.github.io/iorek-forges-ai/demos/2026-11-05-semantic-cache-tenant-isolation/)**

Northwind's support gateway reuses a cached answer when two questions look alike. Without a hard tenant filter, Acme's password reset can be served to Globex.

## The idea in plain words

A semantic cache stores an old LLM answer and brings it back when a new question is close in embedding space. "How do I reset my password?" and "I forgot my password, how do I reset it?" can share one reply. That skips a model call, which is why the pattern shows up in cost writeups for FAQ bots, support agents, and LLM gateways.

Prompt caching and model routing save money by reusing computation. A semantic cache reuses the finished answer. A bad neighbor is then a data leak, not only a wrong paragraph. The answer text can name an SSO domain, an account manager, and a refund window that the question never contained. The cache compared questions. It served the other customer's policy.

Two soft keys fail in different ways.

A global pool has no tenant in the key at all. Identical FAQ text from Acme and Globex ties at cosine 1.0. Which row comes back is insertion order. Switch the caller and the same tie crosses the boundary.

A soft prefix mixes a tenant token into the text before the embedding, `tenant:globex` plus the question. The hope is that the vectors drift apart. For a long question the token is a small slice of the hash, so a nearer paraphrase from the other tenant still wins. [vLLM semantic-router issue 2134](https://github.com/vllm-project/semantic-router/issues/2134) records the production version of that bug. The cache prepended a namespace token, repeated three times, and a different user still received a byte-identical cached answer at similarity 0.9085 against a threshold of 0.8. The tests checked that the scoped strings differed. They did not check that the lookup stayed inside one user. The issue tracks it as CWE-524, use of a cache containing sensitive information. The repair compares the namespace exactly and drops the other user's row even when it is the nearest neighbor.

A hard namespace does that compare first. Rows with the wrong tenant id never enter the ranking. Redis documents the same split for a semantic cache: cosine for the paraphrase, and a metadata filter (tenant, locale, model version) inside the vector query, so isolation is part of the search rather than a sentence prefix. TrueFoundry's gateway hashes tenant, model, and system prompt exactly, and runs cosine only on the latest user line, with an optional namespace string for a SaaS that fronts many customers through one account. DeepInspect's gateway writeup puts tenant id, entitlement, model, and generation parameters in the key, and says to authenticate and classify before the lookup so a cached answer cannot skip a policy the live call would have hit.

The threshold is a second bug, inside one tenant. [@Kizuno18](https://x.com/Kizuno18/status/2115442044306882981) noted that "cancel my subscription" and "upgrade my subscription" can land near 0.88 cosine. At a threshold of 0.85 the cache serves the upgrade answer for a cancel question when the cancel answer was never stored. This page's toy embedder prints its own score for that pair next to the slider. It is a hashed bag of words, not a model, and it lands in the same band. DeepInspect suggests holding the threshold at 0.9 or above when one qualifier changes the meaning. TrueFoundry's bands start strict at 0.95 to 1.0, call 0.85 to 0.95 balanced for FAQ chat, and treat anything under 0.85 as broad.

## A business use

Northwind Support Gateway is fictional. It fronts the help-desk model for two customers.

Acme Corp is Enterprise. SSO domain `acme.example`, Okta, account manager Dana Cho, refunds within 30 days then prorated, 30 days notice to cancel. Alice Chen asked yesterday for a password reset, and the cached answer includes her address and a break-glass path through Dana.

Globex Inc is Growth. SSO domain `globex.io`, account manager Samir Patel, refunds within 14 days, annual plans not prorated. Bob Okonkwo asks the same kind of questions. Globex has no cached cancel answer.

The shape is any multi-tenant SaaS whose agent or help desk caches completions: a support bot that mentions the caller's plan, a gateway shared by many customer workspaces, an internal assistant that answered one account's renewal terms. FAQ wording really does repeat. The stored reply is where the tenant-specific sentence hides.

## How a team would adopt it

1. Make the tenant id an exact filter that runs before nearest-neighbor, in the query itself when the store supports it (a Redis TAG filter, a namespace compare on the cache entry). Do not rely on a prefix, even a repeated one, inside the embedded string. The page's hard mode is that filter and nothing else:

```javascript
function eligible(entry, caller, mode) {
  if (mode === "hard") return entry.tenant === caller;
  return true;
}
```

2. Keep cosine for paraphrase inside that namespace, with a high threshold tuned on shadow traffic. Log what would have hit at several cutoffs before you serve any of them. Cancel versus upgrade is the test case: if those two clear the line, the line is too low for billing actions.
3. Decide what is allowed to be stored. Documentation and generic FAQ can live in a tenant namespace. An answer that names a person, a domain, or a contract term needs every identity that may read it in the key, or it should not be cached. Alice's break-glass line fails that test even for a second Acme employee. This page's gate is the company id. A user id is the same kind of key one level down.
4. Log the caller's tenant and the winner's tenant on every hit. Alert on a mismatch. Hit rate alone will praise the leak, because the leak is a fast, cheap hit.
5. Authenticate, authorize, and classify before the cache read. A hit that skips the policy engine serves last month's decision. Record cache hits in the same audit trail as model calls.

## What the page shows

Open `index.html`. The cache starts with 11 fictional FAQ rows across Acme and Globex. Nothing calls a model. The embedder lowercases text, hashes words, word pairs, and character trigrams into 64 bins, normalizes, and takes a dot product.

- **Run lookup** uses the selected tenant, question, threshold (0.70 to 0.99), and scoping mode. The paragraph under the verdict is what that run did. The three cards are the same question under all three keys. Click a card to inspect that key.
- **None (global pool)** can tie two identical FAQ rows at 1.000. Bob's password question happens to keep Globex, because that row was stored first. Alice asking the same words gets Globex's answer. Refund policy leaks the other way: Acme's row is earlier, so Bob receives the 30-day Enterprise terms and Dana Cho.
- **Soft prefix** embeds `tenant:` plus the company id plus the question. On an exact duplicate that both tenants stored, the caller's own row scores 1.000 and wins. That is the case the prefix was meant to fix. It does not fix the next one.
- **Replay leak scenario** seeds Alice's personalized reset, sets the caller to Bob, and asks her wording at threshold 0.85 under the soft prefix. Her row wins the global pool at 1.000 and the soft prefix near 0.93. Globex's own FAQ is second. Hard namespace drops her row before the ranking and serves Globex's FAQ, around 0.86. Raise the threshold past that and the hard lookup misses instead, which is the safe model call. The global pool still leaks at 0.99, because the strings match.
- **Cancel**, as Bob, is the false positive. Globex never cached a cancel answer. The global pool returns Acme's cancel answer (Dana Cho, 30-day prorated refund). Soft prefix and hard namespace stay inside Globex and serve the upgrade answer, which clears 0.85 and misses at 0.90. Right company, wrong verb.
- **Change plan** sits between those two. At 0.85 it misses. Lower the slider and the upgrade answer comes back.
- The bars list every eligible row. Hard mode also lists the rows it removed, with the score they would have had. Alice's removed row at 1.000 is the picture of the gate.

The latency and dollars are simulated for this page: 18 ms and $0 on a hit, 840 ms and $0.0042 on a miss. They are not a vendor rate card. DeepInspect's writeup describes the same shape with a lookup around 5 ms and a model call from 500 ms to several seconds, and hit rates in the 20% to 40% range for support and docs once you leave exact string match. Those are that post's figures, not measurements from this toy.

## How to run

Open `index.html` in a browser. No build step, no network call, no API key. The shared stylesheet is a relative path, so the page also works on the project site.

From this folder, or from the repo root:

```bash
python3 -m http.server
```

Then open the printed local URL and follow the path to `index.html`. Either way works. The page does not need a server.

## Sources

Acme, Globex, Alice, Bob, Dana, Samir, and the contract terms are made up for this demo. The scores the page prints are the toy embedder's. The 0.9085 similarity, the 0.8 threshold, the 0.88 cancel-versus-upgrade note, and the gateway writeups are the sources below.

- [@PythonDvz](https://x.com/PythonDvz/status/2117383241032470551) — prompt caching and model routing cut the bill. A semantic cache is the dangerous one: a bad cosine match can serve the wrong user's answer.
- [@alexxubyte](https://x.com/alexxubyte/status/2117302471156781430) — six cost optimizations in AI systems, including a semantic cache.
- [@NainaC5](https://x.com/NainaC5/status/2116787914105593902) — GenAI system design: repeated prompts go to a semantic cache.
- [@akshay_pachaar](https://x.com/akshay_pachaar/status/2113617883456766031) — four kinds of LLM caching: KV, prefix, prompt, and semantic.
- [@Kizuno18](https://x.com/Kizuno18/status/2115442044306882981) — cancel versus upgrade can score about 0.88 cosine, a semantic false positive.
- [Redis semantic cache](https://redis.io/docs/latest/develop/use-cases/semantic-cache/) — reuse a stored LLM answer for a near-duplicate question. The doc's hard boundary is a metadata filter (tenant, locale, model) in the same search as the vector, not a prefix on the prompt.
- [vLLM semantic-router issue 2134](https://github.com/vllm-project/semantic-router/issues/2134) — soft user-scoping leaks a cached answer across users (CWE-524). Reproduced at similarity 0.9085 with threshold 0.8. The attached fix is an exact namespace compare.
- [DeepInspect, semantic caching at the LLM gateway](https://www.deepinspect.ai/blog/llm-gateway-semantic-caching) — savings, four leak paths including cross-tenant hits, and a key that includes tenant id.
- [TrueFoundry, semantic caching for an LLM gateway](https://www.truefoundry.com/blog/semantic-caching-llm-gateway) — cosine on the latest user line, exact hashes for tenant and model, and a namespace field when one account fronts many customers.
