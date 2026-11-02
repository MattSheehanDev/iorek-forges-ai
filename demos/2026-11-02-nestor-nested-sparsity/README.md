# Nestor: nested sparsity

A one-block toy of [Nestor](https://ma-lab-berkeley.github.io/Nestor/) (Chu, Pai, and Ma, arXiv:2610.31818). The page uses random routers so you can see the wiring. It is not the trained model.

## The idea in plain words

A mixture-of-experts (MoE) transformer lets each token use a few expert MLPs and leaves attention dense: every token still attends to the whole causal context, with one shared attention operator.

Nestor applies that same idea to attention, then nests the experts inside it.

- A block holds **C attention columns**. In the paper's models, C is 8.
- A **column router**, computed once from the block input, sends each token to **Kc** of those columns. The token stays in that same set for all **M** layers of the block.
- Inside a column, a token attends only to the other tokens that were routed there, and only causally (no looking ahead).
- Each column has its own **E experts** and its own expert router, which picks **Ke** of them. An expert is a pair `(column, expert)`.
- A few **shared experts** are tied across columns, so every column uses the same copies.
- The columns of a token are mixed back together with the router's gates.

Two special cases fall out of the same wiring. **C = 1** is an ordinary MoE transformer: one attention operator, a dense causal mask, and a single pool of experts. **C = 1 and E = 1** is a dense transformer: that one expert is the MLP, and every stored weight is used.

In the trained models, Kc grows with depth: 3 in the first block, then 4, 5, 6, 6, 7, and all 8 in the last block. The last block therefore computes full attention. The paper also makes each column's experts narrower as Kc grows, so a token's active MLP width stays matched to the dense baseline (about 4D), and gives each column about `H / Kc` heads so the attention projections stay matched too. What shrinks is the attention map: under balanced routing, the quadratic term is about `Kc / C` of a dense map.

On language-model pretraining from 100M to 1B active parameters, the project page reports that Nestor stores about as many parameters as the MoE baseline and uses no more training compute, with a lower held-out loss at every scale. Fitting a scaling law, they estimate the MoE needs **1.13–1.29×** as much compute as Nestor to reach the same loss, and a dense transformer **3.1–4.1×**. Neither factor shrinks as the scale grows. For continual pretraining, Nestor adapts to longer contexts (4k extended as far as 64k) more effectively than the MoE, and on books, mathematics, code, and German it gains about as much as the MoE while forgetting less of the pretraining data (about 3% less than the MoE on average; the dense model forgets about 21% more).

## What the page shows

Open `index.html`. The sentence is eight tokens: Nested, sparsity, routes, each, token, into, few, columns.

- Drag **C, Kc, E, Ke, M**, and the **seed**. Kc cannot pass C, and Ke cannot pass E.
- The pills and the column lanes are the column router. Click a token to follow it. Click a column to feature that column's mask.
- Each small grid is one column's causal mask. The dense grid next to them is the ordinary causal triangle. Hollow cells are causal pairs that column skips, because the query or the key was routed elsewhere. Hatched cells are the future.
- The expert table is the second router: lit cells are the `(column, expert)` pairs that token uses on the selected layer. Change the layer and the columns stay put; the experts can move. The tied bank is listed under the table.
- The counters are live. **Modules** count attention blocks and experts as equal boxes, times M layers. **The bars** rescale widths the way the paper does, so one dense layer is 2 units and a token's active width matches dense and plain MoE. **Attention pairs** compare the masks with a dense map and with plain MoE, whose attention stays dense. The head-adjusted factor divides the scored pairs by Kc; the paper's balanced-routing estimate of that factor is `Kc / C`.

Presets:

| Preset | What it sets |
| --- | --- |
| Nestor, early block | C = 8, Kc = 3, E = 8, Ke = 2, tied bank on. The paper's first block uses this Kc. |
| Nestor, last block | Kc = C = 8, so every mask is the full causal triangle. |
| Plain MoE | C = 1, Kc = 1, tied bank off. One dense mask, Ke of E experts. |
| Dense | C = 1, E = 1, Ke = 1, tied bank off. Stored modules and used modules match. |

The schedule buttons set C = 8 and the paper's per-block Kc (3, 4, 5, 6, 6, 7, 8). They do not rebuild the rest of a trained depth.

`routing.py` is the same router, top-k rule, and gate normalization as the page, in the standard library:

```bash
python3 routing.py
python3 routing.py --seed 154 --C 8 --Kc 3 --E 8 --Ke 2 --M 2 --json
```

## How this toy differs from the paper

- Routers are fixed random vectors, not trained, and there is no load-balancing bias.
- One block and eight tokens, not a stack trained at context 4096.
- Column gates, and the tied-bank gates, are a softmax over the selected top-k. Column-expert gates are a softmax over all E experts in that column, which is the paper's normalization. The masks are membership, not dot products of queries and keys.
- The tied bank here is Es = 2, Ks = 1. The experiments use Es = 8, Ks = 2.
- Width-matched counts use an exact `1 / Kc` head split. The paper uses `round(16 / Kc)` heads and rounds expert widths to a multiple of 8.
- The counters omit routers, attention residuals, and the output head. They are not the parameter totals in the paper's tables.

## How to run

Open `index.html` in a browser. It has no build step and does not load anything from the network.

From this folder, or from the repo root:

```bash
python3 -m http.server
```

Then open the printed local URL and follow the path to `index.html`. Either way works; the page does not need a server.

## Sources

Nestor is by Tianzhe Chu, Druv Pai, and Yi Ma, equal contribution, ordered alphabetically. On the project page, Chu is at the University of Hong Kong, Pai is at UC Berkeley, and Ma is at both. The project site is the Ma Lab, Berkeley page.

- X post that prompted this demo, Tianzhe Chu ([@TianzheC](https://x.com/TianzheC)), 27 Oct 2026: [Introducing Nestor](https://x.com/TianzheC/status/2114987088538145099). The post asks what happens if tokens choose their attention modules as well as their FFN experts.
- Project page: [https://ma-lab-berkeley.github.io/Nestor/](https://ma-lab-berkeley.github.io/Nestor/)
- Paper: [https://arxiv.org/abs/2610.31818](https://arxiv.org/abs/2610.31818) (submitted 22 Oct 2026)
- Code: [https://github.com/Ma-Lab-Berkeley/Nestor](https://github.com/Ma-Lab-Berkeley/Nestor)
