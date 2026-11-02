#!/usr/bin/env python3
"""Toy column and expert routing for the Nestor demo.

This is a random-weight illustration of the routing arithmetic, not the
trained model from Chu, Pai, and Ma (arXiv:2610.31818). The PRNG, top-k
rule, and gate normalization match demos/2026-11-02-nestor-nested-sparsity/index.html.

Standard library only, so the floats stay aligned with the page.
"""

from __future__ import annotations

import argparse
import json
import math

TOKENS = ["Nested", "sparsity", "routes", "each", "token", "into", "few", "columns"]
DIM = 8
MASK = 0xFFFFFFFF
ES_ON = 2
KS_ON = 1


def imul(a: int, b: int) -> int:
    """Low 32 bits of a signed 32-bit multiply, matching Math.imul."""
    a &= MASK
    b &= MASK
    if a >= 0x80000000:
        a -= 0x100000000
    if b >= 0x80000000:
        b -= 0x100000000
    return (a * b) & MASK


def mix(seed: int, parts: list[int]) -> int:
    h = seed & MASK
    for part in parts:
        h = imul(h ^ (part & MASK), 0x9E3779B1)
    return h


def mulberry32(seed: int):
    state = seed & MASK

    def rng() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & MASK
        t = imul(state ^ (state >> 15), state | 1)
        mixed = imul(t ^ (t >> 7), t | 61)
        t = (t ^ ((t + mixed) & MASK)) & MASK
        return ((t ^ (t >> 14)) & MASK) / 4294967296

    return rng


def unit_vector(seed: int) -> list[float]:
    rng = mulberry32(seed)
    values = [rng() * 2 - 1 for _ in range(DIM)]
    norm = math.sqrt(sum(v * v for v in values))
    return [v / norm for v in values]


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def topk(scores: list[float], k: int) -> list[int]:
    order = sorted(range(len(scores)), key=lambda i: (-scores[i], i))
    return order[:k]


def softmax(values: list[float]) -> list[float]:
    peak = max(values)
    exps = [math.exp(v - peak) for v in values]
    total = sum(exps)
    return [e / total for e in exps]


def route(seed: int, columns: int, k_columns: int, experts: int, k_experts: int, layers: int, shared: bool) -> dict:
    """Route every token. Column choices do not depend on the layer index."""
    es = ES_ON if shared else 0
    ks = KS_ON if shared else 0
    tokens = []
    members = [[] for _ in range(columns)]
    for token_index in range(len(TOKENS)):
        embed = unit_vector(mix(seed, [1, token_index]))
        column_scores = [
            dot(embed, unit_vector(mix(seed, [2, column]))) for column in range(columns)
        ]
        chosen = topk(column_scores, k_columns)
        column_gates = softmax([column_scores[i] for i in chosen])
        assignment = [
            {"index": index, "score": column_scores[index], "gate": gate}
            for index, gate in zip(chosen, column_gates)
        ]
        for column in assignment:
            members[column["index"]].append(token_index)
        layer_rows = []
        for layer in range(layers):
            expert_rows = []
            for column in sorted(assignment, key=lambda item: item["index"]):
                scores = [
                    dot(embed, unit_vector(mix(seed, [3, layer, column["index"], expert])))
                    for expert in range(experts)
                ]
                picked = topk(scores, k_experts)
                all_gates = softmax(scores)
                expert_rows.append(
                    {
                        "column": column["index"],
                        "chosen": [
                            {"index": expert, "score": scores[expert], "gate": all_gates[expert]}
                            for expert in picked
                        ],
                    }
                )
            shared_rows = []
            if ks:
                scores = [
                    dot(embed, unit_vector(mix(seed, [4, layer, expert]))) for expert in range(es)
                ]
                picked = topk(scores, ks)
                gates = softmax([scores[expert] for expert in picked])
                shared_rows = [
                    {"index": expert, "score": scores[expert], "gate": gate}
                    for expert, gate in zip(picked, gates)
                ]
            layer_rows.append({"experts": expert_rows, "shared": shared_rows})
        tokens.append(
            {
                "index": token_index,
                "text": TOKENS[token_index],
                "columns": sorted(assignment, key=lambda item: item["index"]),
                "layers": layer_rows,
            }
        )
    return {"tokens": tokens, "members": members, "Es": es, "Ks": ks}


def causal_pairs(count: int) -> int:
    return count * (count + 1) // 2


def metrics(columns: int, k_columns: int, experts: int, k_experts: int, layers: int, shared: bool, routed: dict) -> dict:
    """Schematic parameter counts and attention-map density for one block."""
    es = ES_ON if shared else 0
    ks = KS_ON if shared else 0
    sequence = len(TOKENS)
    dense_pairs = causal_pairs(sequence)
    per_column = [causal_pairs(len(members)) for members in routed["members"]]
    scored = sum(per_column)
    attn_stored = layers * columns
    attn_used = layers * k_columns
    expert_stored = layers * (columns * experts + es)
    expert_used = layers * (k_columns * k_experts + ks)
    if shared:
        width_attn_stored = columns / k_columns
        width_expert_stored = (columns * experts) / (2 * k_columns * k_experts) + es / (2 * ks)
        width_used = 2.0
    else:
        width_attn_stored = columns / k_columns
        width_expert_stored = (columns * experts) / (k_columns * k_experts)
        width_used = 2.0
    return {
        "storedModules": attn_stored + expert_stored,
        "usedModules": attn_used + expert_used,
        "attnStored": attn_stored,
        "attnUsed": attn_used,
        "expertStored": expert_stored,
        "expertUsed": expert_used,
        "storedWeights": layers * (width_attn_stored + width_expert_stored),
        "usedWeights": layers * width_used,
        "scoredPairs": scored,
        "densePairs": dense_pairs,
        "perColumnPairs": per_column,
        "headAdjusted": scored / (k_columns * dense_pairs),
        "balancedEstimate": k_columns / columns,
    }


def round_gate(value: float) -> float:
    return round(value, 6)


def snapshot(seed: int, columns: int, k_columns: int, experts: int, k_experts: int, layers: int, shared: bool) -> dict:
    routed = route(seed, columns, k_columns, experts, k_experts, layers, shared)
    counts = metrics(columns, k_columns, experts, k_experts, layers, shared, routed)
    return {
        "columns": [[column["index"] for column in token["columns"]] for token in routed["tokens"]],
        "columnGates": [
            [round_gate(column["gate"]) for column in token["columns"]] for token in routed["tokens"]
        ],
        "experts": [
            [
                [[item["index"] for item in row["chosen"]] for row in layer["experts"]]
                for layer in token["layers"]
            ]
            for token in routed["tokens"]
        ],
        "expertColumns": [
            [[row["column"] for row in layer["experts"]] for layer in token["layers"]]
            for token in routed["tokens"]
        ],
        "shared": [
            [[item["index"] for item in layer["shared"]] for layer in token["layers"]]
            for token in routed["tokens"]
        ],
        "metrics": {
            "storedModules": counts["storedModules"],
            "usedModules": counts["usedModules"],
            "storedWeights": round(counts["storedWeights"], 6),
            "usedWeights": round(counts["usedWeights"], 6),
            "scoredPairs": counts["scoredPairs"],
            "densePairs": counts["densePairs"],
            "headAdjusted": round(counts["headAdjusted"], 6),
        },
    }


def print_report(args: argparse.Namespace) -> None:
    routed = route(args.seed, args.C, args.Kc, args.E, args.Ke, args.M, args.shared)
    counts = metrics(args.C, args.Kc, args.E, args.Ke, args.M, args.shared, routed)
    print("Toy Nestor routing. Random routers, not the trained model.")
    print(
        f"seed={args.seed}  C={args.C}  Kc={args.Kc}  E={args.E}  Ke={args.Ke}  "
        f"M={args.M}  shared={'on' if args.shared else 'off'}"
    )
    print("tokens:", " ".join(TOKENS))
    print()
    for token in routed["tokens"]:
        columns = ", ".join(
            f"c{column['index'] + 1} ({column['gate']:.2f})" for column in token["columns"]
        )
        print(f"token {token['index'] + 1} {token['text']}: columns {columns}")
        for layer_index, layer in enumerate(token["layers"], start=1):
            parts = []
            for row in layer["experts"]:
                experts = ",".join(
                    f"e{item['index'] + 1}:{item['gate']:.2f}" for item in row["chosen"]
                )
                parts.append(f"c{row['column'] + 1}[{experts}]")
            shared = ",".join(f"s{item['index'] + 1}:{item['gate']:.2f}" for item in layer["shared"])
            suffix = f"  shared[{shared}]" if shared else ""
            print(f"  layer {layer_index}: {' '.join(parts)}{suffix}")
    print()
    print(
        f"modules stored {counts['storedModules']}  used/token {counts['usedModules']}  "
        f"(attention {counts['attnUsed']}/{counts['attnStored']}, "
        f"experts {counts['expertUsed']}/{counts['expertStored']})"
    )
    print(
        f"width-matched weights stored {counts['storedWeights']:.2f}  "
        f"used/token {counts['usedWeights']:.2f}"
    )
    print(
        f"attention pairs scored {counts['scoredPairs']}  "
        f"dense causal {counts['densePairs']}  "
        f"head-adjusted {counts['headAdjusted']:.3f}  "
        f"Kc/C {counts['balancedEstimate']:.3f}"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Mirror the Nestor demo's toy routers.")
    parser.add_argument("--seed", type=int, default=154)
    parser.add_argument("--C", type=int, default=8)
    parser.add_argument("--Kc", type=int, default=3)
    parser.add_argument("--E", type=int, default=8)
    parser.add_argument("--Ke", type=int, default=2)
    parser.add_argument("--M", type=int, default=2)
    parser.add_argument("--shared", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--json", action="store_true", help="Print a snapshot comparable to the page.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.C < 1 or args.Kc < 1 or args.Kc > args.C or args.E < 1 or args.Ke < 1 or args.Ke > args.E or args.M < 1:
        raise SystemExit("Need C>=Kc>=1, E>=Ke>=1, and M>=1.")
    if args.json:
        print(json.dumps(snapshot(args.seed, args.C, args.Kc, args.E, args.Ke, args.M, args.shared), indent=2))
    else:
        print_report(args)


if __name__ == "__main__":
    main()
