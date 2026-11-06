# RAG Retrieval Visualizer

**[Live demo](https://iorek.mattsheehan.dev/demos/2026-10-31-rag-retrieval-visualizer/)**

A browser page over a fictional dental-group handbook. It chunks the articles, scores them with BM25 and a hashed embedding, and shows which passage a help-desk question actually retrieves.

## The idea in plain words

A retrieval-augmented bot does not answer from the whole handbook. It cuts each article into windows, scores those windows against the question, and hands the top few to the model. If the right sentence never makes that cut, the model cannot quote it, no matter how carefully you prompt.

Two scorers are doing that cut in most production stacks.

- **BM25** is a keyword score. A rare word that actually appears in the chunk counts for more than a word that is in every article, and a second occurrence counts for less than the first. Long chunks are discounted. This page uses the Lucene form: `k1 = 1.2`, `b = 0.75`, and `idf = log(1 + (N − df + 0.5) / (df + 0.5))`.
- A **dense** score embeds the question and the chunk and ranks by similarity. A trained embedder is what you would run in production. This page cannot download one, so it uses the hashing trick instead: each word adds +1 or −1 into a fixed-size vector at `hash(word) mod d`, the vector is normalized, and the score is cosine. A short synonym list (`vacation`/`pto`/`leave`, and a few others) is expanded before hashing, so the hash can find a passage that does not share the question's words. BM25 does not see those synonyms.

The blend is a convex mix after each score is scaled across the current result list: `(1 − α) · BM25 + α · cosine`. `α = 0` is keywords only. `α = 1` is the hash only. That is the same shape as a hybrid alpha, which exists because the two raw scores are not on one scale.

## What the page shows

The corpus is nine articles from **Northline Dental Group**, a fictional clinic organization: PTO, VPN, passphrases, laptops, patient-information handling, badges, benefits, expenses, and a new clinician's first week. Nothing in it is a real policy.

- The question box and the presets are questions an employee would actually send the desk.
- **Chunk size** and **overlap** are in words. Overlap is how many words the next window reuses. The strip under the ranking is every window; a number on a chip means that window is inside the top k.
- **Top k** is the cutoff. Two chunks just outside it stay on the page so you can see what the cutoff dropped.
- Blue marks are words from the question. Green marks are synonyms the hash added. The term table is the BM25 breakdown: term frequency, how many chunks contain the term, idf, and the contribution.
- The notes under the heading are computed from the current ranking. They call out a question word that is not in the handbook, a word the top chunk missed, and a pair of words that share an article but never share a window.

Presets worth clicking:

| Preset | What to look at |
| --- | --- |
| Vacation days | The question says "vacation". The handbook says "PTO". With the blend toward the hash, the PTO article leads. |
| Keywords only | Same question, α = 0. The first-week onboarding article leads, because it shares "new clinician" and the PTO article does not. |
| Split the exception | 64-word windows and no overlap. "Hygienist" and "shortage" fall in different windows of the same article. |
| Overlap bridges it | The same question with 24 words of overlap. A window now holds both. |

Drag **k1**, **b**, and the hash dimension if you want to see the score move. At 16 dimensions, unrelated words collide in the same bucket and the cosine gets noisy. That is the hashing trick's trade, not a property of a trained embedder.

## How a team would use this

Support, HR, and whoever owns the bot sit down with the questions that already show up in the ticket queue, not with questions written to match the headings.

1. Paste the real articles, or start from a corpus this size, and run the questions employees actually ask.
2. If the right paragraph is in the corpus but not in the top k, look at the notes before you change the prompt. A word that never appears needs a synonym, a richer embedder, or a rewrite of the article. A pair of words that never share a window needs a larger chunk or more overlap.
3. Write down the window size, the overlap, k, and the blend that put the right passage in the top three. Those are indexer settings, not prompt text.
4. Freeze them, then point the production index at the same settings. Re-run this kind of trace when someone edits a policy, because a one-sentence exception added at the end of an article is exactly the text a zero-overlap window will cut in half.

The page is the debugging view. It is not the index you would ship. Production still wants a real embedder, a tokenizer matched to that embedder, and a lexical engine such as Lucene. What you adopt from here is the habit: read the retrieved chunks before you blame the model, and keep a handful of real questions as the regression set.

## How to run

Open `index.html` in a browser. It has no build step and does not load anything from the network. The shared stylesheet is a relative path, so the page also works on the project site.

From this folder, or from the repo root:

```bash
python3 -m http.server
```

Then open the printed local URL and follow the path to `index.html`. Either way works; the page does not need a server.

## Sources

The handbook and the synonym list are written for this demo. The scorers follow public references.

- Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich Küttler, Mike Lewis, Wen-tau Yih, Tim Rocktäschel, Sebastian Riedel, and Douwe Kiela, [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) (arXiv:2005.11401). The paper that named RAG: a retriever returns passages, and a generator conditions on them.
- Apache Lucene, [`BM25Similarity`](https://lucene.apache.org/core/9_11_0/core/org/apache/lucene/search/similarities/BM25Similarity.html) (Lucene 9.11). Documents the defaults `k1 = 1.2` and `b = 0.75`, and the idf this page uses: `log(1 + (docCount − docFreq + 0.5) / (docFreq + 0.5))`. It points back to Robertson, Walker, Jones, Hancock-Beaulieu, and Gatford, Okapi at TREC-3 (1994).
- Shane Connelly, [Practical BM25 — Part 2: The BM25 Algorithm and its Variables](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables) (Elastic, 19 April 2018). A walk through term frequency, idf, and what `k1` and `b` change.
- Kilian Weinberger, Anirban Dasgupta, Josh Attenberg, John Langford, and Alex Smola, [Feature Hashing for Large Scale Multitask Learning](https://arxiv.org/abs/0902.2206) (arXiv:0902.2206). The hashing trick: map high-dimensional features into a fixed vector with a hash, without storing a projection matrix.
- Pinecone, [Hybrid search](https://docs.pinecone.io/guides/search/hybrid-search). Why a keyword score and a dense score are combined, and why they have to be put on a comparable scale before an alpha mix means anything.
