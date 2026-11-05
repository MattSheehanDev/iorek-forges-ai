/* Northwind Support Gateway
   Toy semantic cache: hashed bag-of-words, word bigrams, and character
   trigrams in 64 bins, L2-normalized, compared with cosine.
   Teaching stand-in. Not an embedding model. No network. */

const DIM = 64;
const W_WORD = 1;
const W_BIGRAM = 0.35;
const W_TRIGRAM = 0.55;
const HIT_MS = 18;
const MISS_MS = 840;
const MISS_USD = 0.0042;

const TENANTS = {
  acme: {
    id: "acme",
    company: "Acme Corp",
    tier: "Enterprise",
    sso: "acme.example",
    caller: "Alice Chen",
    manager: "Dana Cho"
  },
  globex: {
    id: "globex",
    company: "Globex Inc",
    tier: "Growth",
    sso: "globex.io",
    caller: "Bob Okonkwo",
    manager: "Samir Patel"
  }
};

const INTENT_LABEL = {
  password: "Password reset",
  cancel: "Cancel",
  upgrade: "Upgrade",
  refund: "Refund",
  manager: "Account manager",
  seats: "Add a teammate",
  invoice: "Invoice"
};

const ENTRIES = [
  {
    id: "globex-password",
    tenant: "globex",
    intent: "password",
    who: "Globex FAQ",
    question: "How do I reset my password?",
    answer: "Reset a Globex Growth password at https://login.globex.io/forgot. The SSO domain is globex.io. Repeated resets notify Samir Patel, samir.patel@northwind.example."
  },
  {
    id: "acme-password",
    tenant: "acme",
    intent: "password",
    who: "Acme FAQ",
    question: "How do I reset my password?",
    answer: "Reset an Acme Enterprise password in Okta at https://sso.acme.example/reset. The SSO domain is acme.example. Lockouts go to Dana Cho, dana.cho@northwind.example."
  },
  {
    id: "acme-cancel",
    tenant: "acme",
    intent: "cancel",
    who: "Acme FAQ",
    question: "How do I cancel my subscription?",
    answer: "Cancel Acme Enterprise with 30 days notice at billing@acme.example. The unused term is refunded prorata. Dana Cho confirms the date."
  },
  {
    id: "acme-upgrade",
    tenant: "acme",
    intent: "upgrade",
    who: "Acme FAQ",
    question: "How do I upgrade my subscription?",
    answer: "Upgrade Acme seats in the admin console. Enterprise rates start the same day. Dana Cho can add seats without a ticket."
  },
  {
    id: "globex-upgrade",
    tenant: "globex",
    intent: "upgrade",
    who: "Globex FAQ",
    question: "How do I upgrade my subscription?",
    answer: "Move Globex from Growth to Enterprise in the billing tab. Samir Patel provisions the SSO change. The current term is not refunded."
  },
  {
    id: "acme-refund",
    tenant: "acme",
    intent: "refund",
    who: "Acme FAQ",
    question: "What is our refund policy?",
    answer: "Acme Enterprise refunds in full within 30 days, then prorates. Dana Cho approves anything outside that window."
  },
  {
    id: "globex-refund",
    tenant: "globex",
    intent: "refund",
    who: "Globex FAQ",
    question: "What is our refund policy?",
    answer: "Globex Growth refunds within 14 days. Annual plans are not prorated. Samir Patel approves exceptions."
  },
  {
    id: "acme-manager",
    tenant: "acme",
    intent: "manager",
    who: "Acme FAQ",
    question: "Who is my account manager?",
    answer: "Dana Cho is the Acme Enterprise account manager, dana.cho@northwind.example."
  },
  {
    id: "globex-manager",
    tenant: "globex",
    intent: "manager",
    who: "Globex FAQ",
    question: "Who is my account manager?",
    answer: "Samir Patel is the Globex Growth account manager, samir.patel@northwind.example."
  },
  {
    id: "acme-seats",
    tenant: "acme",
    intent: "seats",
    who: "Acme FAQ",
    question: "How do I add a teammate to the workspace?",
    answer: "Invite teammates from the Acme admin console. The address has to be @acme.example so SSO matches."
  },
  {
    id: "globex-invoice",
    tenant: "globex",
    intent: "invoice",
    who: "Globex FAQ",
    question: "Where do I download the invoice for last quarter?",
    answer: "Globex Growth invoices live in the billing portal. If a purchase order is required, Samir Patel adds it."
  }
];

const ALICE = {
  id: "alice-reset",
  tenant: "acme",
  intent: "password",
  personal: true,
  who: "Alice Chen, yesterday",
  question: "I forgot my password, how do I reset it?",
  answer: "Written for Alice Chen (alice.chen@acme.example), Acme Enterprise. Reset at https://sso.acme.example/reset. If Okta rejects the link, Dana Cho (dana.cho@northwind.example) can issue a break-glass code for her user."
};

let entries = ENTRIES.slice();

function fnv32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function embed(text) {
  const norm = normalize(text);
  const vec = new Float64Array(DIM);
  const words = norm ? norm.split(" ") : [];
  for (let i = 0; i < words.length; i++) {
    vec[fnv32("w:" + words[i]) % DIM] += W_WORD;
  }
  for (let i = 0; i < words.length - 1; i++) {
    vec[fnv32("b:" + words[i] + "_" + words[i + 1]) % DIM] += W_BIGRAM;
  }
  const padded = " " + norm + " ";
  for (let i = 0; i < padded.length - 2; i++) {
    vec[fnv32("c:" + padded.slice(i, i + 3)) % DIM] += W_TRIGRAM;
  }
  let sum = 0;
  for (let i = 0; i < DIM; i++) sum += vec[i] * vec[i];
  const scale = 1 / (Math.sqrt(sum) || 1);
  for (let i = 0; i < DIM; i++) vec[i] *= scale;
  return vec;
}

function cosine(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function embedText(question, tenant, mode) {
  if (mode === "soft") return "tenant:" + tenant + " " + question;
  return question;
}

function askedIntent(query) {
  const s = query.toLowerCase();
  if (/\bcancel\b/.test(s)) return "cancel";
  if (/\bupgrade\b/.test(s)) return "upgrade";
  if (/\brefund\b/.test(s)) return "refund";
  if (/\bpassword\b|\bforgot\b/.test(s)) return "password";
  if (/account manager/.test(s)) return "manager";
  if (/\binvoice\b/.test(s)) return "invoice";
  if (/\bteammate\b|\bworkspace\b/.test(s)) return "seats";
  if (/\bchange\b/.test(s) && /subscription/.test(s)) return "change";
  return null;
}

function intentsDisagree(query, intent) {
  const asked = askedIntent(query);
  if (!asked) return false;
  if (asked === "change") return intent === "cancel" || intent === "upgrade";
  return asked !== intent;
}

function byRank(a, b) {
  if (a.score !== b.score) return b.score - a.score;
  return a.index - b.index;
}

function runLookup(pool, query, tenant, mode, threshold) {
  const q = String(query || "").trim();
  const qText = embedText(q, tenant, mode);
  const qVec = embed(qText);
  const scored = pool.map((entry, index) => {
    const text = embedText(entry.question, entry.tenant, mode);
    return {
      entry,
      index,
      embedText: text,
      score: cosine(qVec, embed(text)),
      eligible: mode !== "hard" || entry.tenant === tenant
    };
  });
  const eligible = scored.filter((row) => row.eligible).sort(byRank);
  const blocked = scored.filter((row) => !row.eligible).sort(byRank);
  const best = eligible[0] || null;
  const hit = !!(q && best && best.score >= threshold - 1e-12);
  const winner = hit ? best : null;
  const tieCount = best
    ? eligible.filter((row) => Math.abs(row.score - best.score) < 1e-9).length
    : 0;
  return {
    query: q,
    tenant,
    mode,
    threshold,
    embedText: qText,
    eligible,
    blocked,
    best,
    winner,
    hit,
    leak: !!(winner && winner.entry.tenant !== tenant),
    wrongIntent: !!(winner && intentsDisagree(q, winner.entry.intent)),
    tieCount,
    searched: eligible.length,
    total: pool.length
  };
}

function verdictOf(result) {
  if (!result.query) return { key: "wait", word: "waiting", label: "Waiting" };
  if (result.hit && result.leak) return { key: "leak", word: "leaks", label: "Leak" };
  if (result.hit && result.wrongIntent) return { key: "wrong", word: "serves the wrong action", label: "Wrong intent" };
  if (result.hit) return { key: "hit", word: "hits", label: "Hit" };
  return { key: "miss", word: "misses", label: "Miss" };
}

function fmt(score) {
  return score.toFixed(3);
}

function fmtThreshold(value) {
  return value.toFixed(2);
}

function money(value) {
  return "$" + value.toFixed(4);
}

function joinAnd(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return items[0] + " and " + items[1];
  return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
}

function finish(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : trimmed + ".";
}

function modeName(mode) {
  if (mode === "soft") return "Soft prefix";
  if (mode === "hard") return "Hard namespace";
  return "Global pool";
}

function pairScore() {
  return cosine(
    embed("How do I cancel my subscription?"),
    embed("How do I upgrade my subscription?")
  );
}

function thresholdThatHits(score) {
  const stepped = Math.floor((score + 1e-12) * 100) / 100;
  return Math.max(0.7, Math.min(0.99, stepped));
}

function paragraph(parts) {
  return parts.map(finish).filter(Boolean).join(" ");
}

function explain(result, trio) {
  if (!result.query) {
    return ["Type a support question, or pick one. The lookup embeds it with the toy hasher and compares it with the cached questions."];
  }
  const who = TENANTS[result.tenant];
  const setup = [];
  const happened = [];
  const after = [];
  setup.push(who.caller + " (" + who.company + ", " + who.tier + ") asked “" + result.query + "”.");

  if (result.mode === "soft") {
    setup.push("The embedded string is “" + result.embedText + "”. Every cached row still competes.");
  } else if (result.mode === "hard") {
    setup.push("The tenant gate kept " + result.searched + " " + who.company + " row" + (result.searched === 1 ? "" : "s") + " and dropped " + result.blocked.length + " before cosine ran.");
  } else {
    setup.push("The key is cosine alone. Every cached question is eligible.");
  }

  if (result.tieCount > 1 && result.best) {
    const tied = result.eligible.filter((row) => Math.abs(row.score - result.best.score) < 1e-9);
    const names = tied.map((row) => TENANTS[row.entry.tenant].company);
    happened.push(tied.length + " rows tied at " + fmt(result.best.score) + ": " + joinAnd(names) + ". The earlier row wins, which is " + TENANTS[result.best.entry.tenant].company + ". A global pool has no tenant field to break the tie.");
    if (!result.leak) {
      const other = TENANTS[result.tenant === "acme" ? "globex" : "acme"];
      happened.push("Asked by " + other.caller + ", the same tie serves that earlier row across the company line.");
    }
  }

  if (result.hit && result.leak) {
    const owner = TENANTS[result.winner.entry.tenant];
    happened.push(who.caller + " would receive " + owner.company + "’s stored answer at " + fmt(result.winner.score) + ", over " + fmtThreshold(result.threshold) + ". That text names " + owner.manager + " and " + owner.sso + ".");
    const own = result.eligible.find((row) => row.entry.tenant === result.tenant && row !== result.winner);
    if (own && own.score < result.winner.score - 1e-9) {
      happened.push(who.company + "’s nearest row scored " + fmt(own.score) + " and lost.");
    }
  } else if (result.hit && result.wrongIntent) {
    const label = INTENT_LABEL[result.winner.entry.intent] || result.winner.entry.intent;
    happened.push("The winning row is " + TENANTS[result.winner.entry.tenant].company + "’s “" + result.winner.entry.question + "” at " + fmt(result.winner.score) + ", over " + fmtThreshold(result.threshold) + ". " + who.caller + " stays inside " + who.company + " and is told about " + label.toLowerCase() + ".");
    const asked = askedIntent(result.query);
    if (asked === "cancel" || asked === "upgrade") {
      happened.push("On this toy, cancel against upgrade scores " + fmt(pairScore()) + ". A field note put that pair near 0.88. The tenant gate still lets a wrong verb through.");
    }
  } else if (result.hit) {
    happened.push("The winning row is " + TENANTS[result.winner.entry.tenant].company + "’s “" + result.winner.entry.question + "” at " + fmt(result.winner.score) + ", over " + fmtThreshold(result.threshold) + ". The stored answer belongs to " + who.company + ".");
    if (result.winner.entry.personal) {
      happened.push("The stored text was written for " + result.winner.entry.who + ". Another person at " + who.company + " would see it too. This gate checks the tenant id. A personal line needs a user id as well, or it stays out of the cache.");
    }
  } else if (result.best) {
    const near = result.best;
    happened.push("The nearest eligible row is " + TENANTS[near.entry.tenant].company + "’s “" + near.entry.question + "” at " + fmt(near.score) + ", under " + fmtThreshold(result.threshold) + ". The gateway would call the model and could store the new answer under " + who.company + " only.");
    if (intentsDisagree(result.query, near.entry.intent) && near.score >= 0.7) {
      happened.push("That neighbor is a different action. A threshold of " + fmtThreshold(thresholdThatHits(near.score)) + " would have served it.");
    } else if (intentsDisagree(result.query, near.entry.intent)) {
      happened.push("That neighbor is a different action, and it stays under every mark on this slider.");
    }
  }

  if (result.mode === "hard" && result.blocked.length && result.best && result.blocked[0].score > result.best.score) {
    const top = result.blocked[0];
    after.push("The gate removed " + TENANTS[top.entry.tenant].company + "’s “" + top.entry.question + "” at " + fmt(top.score) + ", a closer neighbor than anything it kept.");
  }

  if (trio) {
    after.push("At this threshold: global pool " + verdictOf(trio.none).word + "; soft prefix " + verdictOf(trio.soft).word + "; hard namespace " + verdictOf(trio.hard).word + ".");
  }

  if (result.hit) {
    const savedMs = MISS_MS - HIT_MS;
    const cost = "Counted as a hit: " + HIT_MS + " ms and $0, against a simulated " + MISS_MS + " ms and " + money(MISS_USD) + ". Saved " + savedMs + " ms and " + money(MISS_USD) + ".";
    after.push(result.leak ? cost + " The cost line improves. The text is the other tenant’s." : cost);
  } else if (result.query) {
    after.push("Counted as a miss: simulated " + MISS_MS + " ms and " + money(MISS_USD) + ".");
  }

  return [paragraph(setup), paragraph(happened), paragraph(after)].filter(Boolean);
}

function headline(result) {
  if (!result.query) return "Type a question to run the lookup.";
  const who = TENANTS[result.tenant];
  if (result.hit && result.leak) {
    const owner = TENANTS[result.winner.entry.tenant];
    return "Leak. " + who.caller + " would see " + owner.company + "’s answer.";
  }
  if (result.hit && result.wrongIntent) {
    const asked = askedIntent(result.query);
    const got = INTENT_LABEL[result.winner.entry.intent] || result.winner.entry.intent;
    return "Wrong intent. " + who.caller + " asked about " + (asked || "one action") + " and would be served " + got.toLowerCase() + ".";
  }
  if (result.hit) {
    return "Hit. " + who.caller + " would see " + who.company + "’s own answer.";
  }
  return "Miss. The model would run for " + who.caller + ".";
}

function replayBanner(trio, pool) {
  const seeded = pool.some((entry) => entry.id === "alice-reset");
  const matches = normalize(trio.none.query) === normalize(ALICE.question) && trio.none.tenant === "globex";
  if (!matches) return "";
  if (!seeded) {
    return "Alice’s personalized reset is not cached yet. Bob’s wording falls through to the shared FAQ. Replay the leak scenario to store her answer, then run this question as Bob.";
  }
  const none = verdictOf(trio.none);
  const soft = verdictOf(trio.soft);
  const hard = verdictOf(trio.hard);
  if (none.key === "leak" && soft.key === "leak" && hard.key === "hit") {
    return "Alice’s answer is in the Acme rows. Bob asked her wording. The global pool and the soft prefix both serve her reset link, her Okta domain, and Dana Cho. The hard namespace serves Globex’s own FAQ instead.";
  }
  if (none.key === "leak" && soft.key === "leak" && hard.key === "miss") {
    return "Alice’s answer is in the Acme rows. Bob asked her wording. The global pool and the soft prefix both serve it. The hard namespace misses, so the model would run, and Bob would not see Dana Cho.";
  }
  if (none.key === "leak" && soft.key !== "leak" && hard.key !== "leak") {
    return "Alice’s answer is in the Acme rows. At this threshold only the global pool still serves it, because those two strings match exactly there. The soft prefix has dropped under the line. The hard namespace never considers her row.";
  }
  return "Alice’s answer is in the Acme rows, and Bob is asking her wording. Global pool " + none.word + "; soft prefix " + soft.word + "; hard namespace " + hard.word + ".";
}

function lessonsHold() {
  const fails = [];
  const base = ENTRIES.slice();
  const seeded = base.concat([ALICE]);
  const faq = "How do I reset my password?";
  const paraphrase = ALICE.question;
  const cancel = "How do I cancel my subscription?";

  const bobFaq = runLookup(base, faq, "globex", "none", 0.85);
  if (!(bobFaq.hit && !bobFaq.leak && bobFaq.tieCount >= 2)) fails.push("bob faq tie");

  const aliceFaq = runLookup(base, faq, "acme", "none", 0.85);
  if (!(aliceFaq.hit && aliceFaq.leak)) fails.push("alice faq leak via tie");

  const soft = runLookup(seeded, paraphrase, "globex", "soft", 0.85);
  if (!(soft.leak && soft.winner.entry.id === "alice-reset")) fails.push("soft leak");
  const margin = soft.winner && soft.eligible[1] ? soft.winner.score - soft.eligible[1].score : 0;
  if (margin < 0.01) fails.push("soft margin " + margin.toFixed(4));

  const none = runLookup(seeded, paraphrase, "globex", "none", 0.85);
  if (!(none.leak && none.winner.entry.id === "alice-reset")) fails.push("none leak");
  const hard = runLookup(seeded, paraphrase, "globex", "hard", 0.85);
  if (!(hard.hit && !hard.leak && hard.winner.entry.id === "globex-password")) fails.push("hard hit");
  const hardHi = runLookup(seeded, paraphrase, "globex", "hard", 0.9);
  if (hardHi.hit || hardHi.leak) fails.push("hard should miss at 0.90");
  const softHi = runLookup(seeded, paraphrase, "globex", "soft", 0.94);
  if (softHi.hit) fails.push("soft should miss at 0.94");
  const noneHi = runLookup(seeded, paraphrase, "globex", "none", 0.99);
  if (!noneHi.leak) fails.push("global still leaks at 0.99");

  const before = runLookup(base, paraphrase, "globex", "soft", 0.85);
  if (before.leak) fails.push("soft leaks before Alice is seeded");

  const cancelHard = runLookup(base, cancel, "globex", "hard", 0.85);
  if (!(cancelHard.hit && !cancelHard.leak && cancelHard.winner.entry.intent === "upgrade")) fails.push("cancel false positive");
  const cancelSoft = runLookup(base, cancel, "globex", "soft", 0.85);
  if (!(cancelSoft.hit && !cancelSoft.leak && cancelSoft.winner.entry.intent === "upgrade")) fails.push("cancel soft wrong intent");
  const cancelNone = runLookup(base, cancel, "globex", "none", 0.85);
  if (!(cancelNone.leak && cancelNone.winner.entry.id === "acme-cancel")) fails.push("cancel cross tenant");
  const cancelHardHi = runLookup(base, cancel, "globex", "hard", 0.9);
  if (cancelHardHi.hit) fails.push("cancel hard should miss at 0.90");

  const refund = runLookup(base, "What is our refund policy?", "globex", "none", 0.85);
  if (!(refund.leak && refund.tieCount >= 2)) fails.push("refund tie leak");
  const refundSoft = runLookup(base, "What is our refund policy?", "globex", "soft", 0.85);
  if (!(!refundSoft.leak && refundSoft.hit && refundSoft.winner.entry.tenant === "globex")) fails.push("refund soft");

  const pair = pairScore();
  if (pair < 0.84 || pair > 0.92) fails.push("pair " + pair.toFixed(3));
  const far = cosine(embed("Where do I download the invoice for last quarter?"), embed(faq));
  if (far >= 0.7) fails.push("far " + far.toFixed(3));

  return fails;
}

function h(tag, attrs, children) {
  const node = document.createElement(tag);
  const props = attrs || {};
  Object.keys(props).forEach((key) => {
    const value = props[key];
    if (value == null || value === false) return;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, String(value));
  });
  (children || []).forEach((child) => {
    if (child == null) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

function chip(text, className) {
  return h("span", { class: "chip" + (className ? " " + className : ""), text: text });
}

function bar(score, threshold, kind) {
  const track = h("div", { class: "track", role: "img", "aria-label": "Cosine " + fmt(score) + ", threshold " + fmtThreshold(threshold) });
  const fill = h("span", { class: "fill " + kind });
  fill.style.width = Math.max(0, Math.min(1, score)) * 100 + "%";
  const tick = h("span", { class: "tick" });
  tick.style.left = threshold * 100 + "%";
  track.append(fill, tick);
  return track;
}

function rowNode(row, result, kind) {
  const entry = row.entry;
  const owner = TENANTS[entry.tenant];
  const over = row.score >= result.threshold - 1e-12;
  const served = result.winner === row;
  const classes = ["neighbor"];
  if (served) classes.push("winner", verdictOf(result).key);
  if (kind === "blocked") classes.push("blocked");
  const meta = h("div", { class: "row-meta" }, [
    chip(owner.company, entry.tenant),
    chip(INTENT_LABEL[entry.intent] || entry.intent),
    chip(entry.who),
    served ? chip("Served", "strong") : null,
    kind === "blocked" ? chip("Filtered out") : null,
    !served && kind !== "blocked" && over ? chip("Also over the line") : null,
    !over && kind !== "blocked" ? chip("Under the line") : null
  ]);
  const topBlocked = kind === "blocked" && result.blocked[0] === row;
  const showBody = served || topBlocked || result.best === row || (kind !== "blocked" && over);
  return h("article", { class: classes.join(" ") }, [
    meta,
    h("p", { class: "q", text: entry.question }),
    bar(row.score, result.threshold, served ? verdictOf(result).key : kind === "blocked" ? "blocked" : "idle"),
    h("p", { class: "scoreline", text: fmt(row.score) + " cosine" + (kind === "blocked" ? " · scored only to show the row the gate removed" : "") }),
    showBody ? h("p", { class: "answer", text: entry.answer }) : null
  ]);
}

function paintCache() {
  const list = document.getElementById("cache-list");
  const heading = document.getElementById("cache-heading");
  list.replaceChildren();
  heading.textContent = "Cached questions (" + entries.length + ")";
  entries.forEach((entry) => {
    const owner = TENANTS[entry.tenant];
    const head = h("div", { class: "row-meta" }, [
      chip(owner.company, entry.tenant),
      chip(INTENT_LABEL[entry.intent] || entry.intent),
      chip(entry.who),
      entry.personal ? chip("Seeded", "strong") : null
    ]);
    const actions = entry.id === "alice-reset"
      ? h("button", { type: "button", class: "btn tiny", id: "drop-alice", text: "Remove seeded answer" })
      : null;
    list.append(h("article", { class: "cache-row" + (entry.personal ? " seeded" : "") }, [
      head,
      h("p", { class: "q", text: entry.question }),
      h("p", { class: "answer", text: entry.answer }),
      actions
    ]));
  });
  const drop = document.getElementById("drop-alice");
  if (drop) drop.addEventListener("click", dropAlice);
}

function paintOutcome(scroll) {
  const controls = readControls();
  const pool = entries;
  const trio = {
    none: runLookup(pool, controls.query, controls.tenant, "none", controls.threshold),
    soft: runLookup(pool, controls.query, controls.tenant, "soft", controls.threshold),
    hard: runLookup(pool, controls.query, controls.tenant, "hard", controls.threshold)
  };
  const result = trio[controls.mode];
  const who = TENANTS[controls.tenant];

  document.getElementById("caller-line").textContent = "Calling as " + who.caller + ", " + who.company + ", " + who.tier + " tier. SSO domain " + who.sso + ". Account manager on file: " + who.manager + ".";
  document.getElementById("threshold-out").textContent = fmtThreshold(controls.threshold);

  const banner = document.getElementById("replay-note");
  const bannerText = replayBanner(trio, pool);
  banner.hidden = !bannerText;
  banner.textContent = bannerText;

  const verdict = verdictOf(result);
  const verdictLine = document.getElementById("verdict-line");
  verdictLine.textContent = headline(result);
  verdictLine.className = "verdict-line " + verdict.key;

  const explanation = document.getElementById("explanation");
  explanation.replaceChildren();
  explain(result, trio).forEach((text) => explanation.append(h("p", { text })));

  const cards = document.getElementById("mode-cards");
  cards.replaceChildren();
  ["none", "soft", "hard"].forEach((mode) => {
    const item = trio[mode];
    const v = verdictOf(item);
    const top = item.winner || item.best;
    const detail = !item.query
      ? "Waiting for a question."
      : top
        ? fmt(top.score) + " · " + TENANTS[top.entry.tenant].company + " · " + (INTENT_LABEL[top.entry.intent] || top.entry.intent)
        : "No rows.";
    const button = h("button", {
      type: "button",
      class: "mode-card " + v.key + (mode === controls.mode ? " selected" : ""),
      "aria-pressed": mode === controls.mode ? "true" : "false"
    }, [
      h("p", { class: "kicker", text: modeName(mode) }),
      h("p", { class: "badge " + v.key, text: v.label }),
      h("p", { class: "card-detail", text: detail })
    ]);
    button.addEventListener("click", () => setMode(mode));
    cards.append(button);
  });

  const metrics = document.getElementById("metrics");
  const topScore = result.best ? fmt(result.best.score) : "—";
  const latency = result.hit ? HIT_MS + " ms" : result.query ? MISS_MS + " ms" : "—";
  const saved = result.hit ? (MISS_MS - HIT_MS) + " ms, " + money(MISS_USD) : result.query ? "0 ms, $0" : "—";
  metrics.replaceChildren(
    metric("Result", verdict.label, verdict.key),
    metric("Top cosine", topScore, ""),
    metric("Latency", latency, ""),
    metric("Saved vs model", saved, "")
  );
  document.getElementById("metric-note").textContent = result.query
    ? "Searched " + result.searched + " of " + result.total + (result.mode === "hard" ? ". " + result.blocked.length + " stopped at the tenant gate." : ". No tenant gate.") + " Embedded “" + result.embedText + "”. A miss is a simulated " + MISS_MS + " ms model call at " + money(MISS_USD) + ". A hit is " + HIT_MS + " ms at $0. These prices are for the page."
    : "Simulated prices: a miss is " + MISS_MS + " ms and " + money(MISS_USD) + ". A hit is " + HIT_MS + " ms and $0.";

  const served = document.getElementById("served");
  served.className = "served " + verdict.key;
  served.replaceChildren();
  if (!result.query) {
    served.append(h("p", { class: "kicker", text: "Served answer" }), h("p", { text: "The lookup has nothing to compare yet." }));
  } else if (result.winner) {
    const owner = TENANTS[result.winner.entry.tenant];
    served.append(
      h("p", { class: "kicker", text: result.leak ? "Served across tenants" : result.wrongIntent ? "Served, wrong action" : "Served from cache" }),
      h("p", { class: "who", text: owner.company + " · " + result.winner.entry.who + " · " + fmt(result.winner.score) }),
      h("blockquote", { text: result.winner.entry.answer })
    );
  } else {
    served.append(
      h("p", { class: "kicker", text: "No cached answer" }),
      h("p", { text: "The gateway would call the model for " + who.caller + " and could store the reply with tenant id " + who.id + "." })
    );
  }
  const neighbors = document.getElementById("neighbors");
  neighbors.replaceChildren();
  if (result.eligible.length) {
    result.eligible.forEach((row) => neighbors.append(rowNode(row, result, "eligible")));
  } else if (result.query) {
    neighbors.append(h("p", { class: "hint", text: "No eligible rows." }));
  }

  const blockedWrap = document.getElementById("blocked-wrap");
  const blocked = document.getElementById("blocked");
  blocked.replaceChildren();
  if (result.mode === "hard" && result.blocked.length) {
    blockedWrap.hidden = false;
    result.blocked.forEach((row) => blocked.append(rowNode(row, result, "blocked")));
  } else {
    blockedWrap.hidden = true;
  }

  paintCache();
  if (scroll) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("outcome").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
}

function metric(label, value, kind) {
  return h("article", { class: "metric" + (kind ? " " + kind : "") }, [
    h("p", { class: "value", text: value }),
    h("p", { class: "label", text: label })
  ]);
}

function readControls() {
  const tenantBtn = document.querySelector("#tenants [aria-pressed='true']");
  const modeBtn = document.querySelector("#modes [aria-pressed='true']");
  return {
    tenant: tenantBtn ? tenantBtn.dataset.tenant : "globex",
    mode: modeBtn ? modeBtn.dataset.mode : "none",
    query: document.getElementById("question").value,
    threshold: Math.round(parseFloat(document.getElementById("threshold").value) * 100) / 100
  };
}

function setPressed(scope, value) {
  document.querySelectorAll(scope).forEach((button) => {
    const match = button.dataset.tenant === value || button.dataset.mode === value || button.dataset.question === value;
    button.setAttribute("aria-pressed", match ? "true" : "false");
  });
}

function setMode(mode) {
  setPressed("#modes button", mode);
  paintOutcome(false);
}

function syncPresets() {
  const query = document.getElementById("question").value.trim();
  document.querySelectorAll("#presets button").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.question === query ? "true" : "false");
  });
}

function dropAlice() {
  entries = entries.filter((entry) => entry.id !== "alice-reset");
  paintOutcome(false);
}

function replayLeak() {
  if (!entries.some((entry) => entry.id === "alice-reset")) {
    entries = entries.concat([ALICE]);
  }
  document.getElementById("question").value = ALICE.question;
  document.getElementById("threshold").value = "0.85";
  setPressed("#tenants button", "globex");
  setPressed("#modes button", "soft");
  syncPresets();
  paintOutcome(true);
}

function boot() {
  const fails = lessonsHold();
  const error = document.getElementById("lesson-error");
  if (fails.length) {
    error.hidden = false;
    error.textContent = "Teaching checks failed: " + fails.join(", ") + ". The scores on this page are not the ones the copy describes.";
  }

  const pair = document.getElementById("pair-note");
  pair.textContent = "On this toy, “How do I cancel my subscription?” against “How do I upgrade my subscription?” scores " + fmt(pairScore()) + ". A field note put that pair near 0.88. The mark on each bar is the threshold. A row at or above it can be served.";

  document.getElementById("tenants").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tenant]");
    if (!button) return;
    setPressed("#tenants button", button.dataset.tenant);
    paintOutcome(false);
  });
  document.getElementById("modes").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    setMode(button.dataset.mode);
  });
  document.getElementById("presets").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-question]");
    if (!button) return;
    document.getElementById("question").value = button.dataset.question;
    syncPresets();
    paintOutcome(false);
  });
  document.getElementById("question").addEventListener("input", () => {
    syncPresets();
    paintOutcome(false);
  });
  document.getElementById("threshold").addEventListener("input", () => paintOutcome(false));
  document.getElementById("run").addEventListener("click", () => paintOutcome(true));
  document.getElementById("replay").addEventListener("click", replayLeak);

  syncPresets();
  paintOutcome(false);
}

globalThis.__semanticCacheLessons = lessonsHold;
globalThis.__semanticCacheScore = function (a, b) { return cosine(embed(a), embed(b)); };
globalThis.__semanticCacheLookup = runLookup;
globalThis.__semanticCacheEntries = ENTRIES;
globalThis.__semanticCacheAlice = ALICE;

if (typeof document !== "undefined") boot();
