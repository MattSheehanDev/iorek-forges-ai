/* Northwind Platform
   Toy Agent Skills loader. Phrase match on name + description.
   Token counts are characters / 4, rounded. Not a tokenizer.
   No network. */

const CHARS_PER_TOKEN = 4;

function doc(lines) {
  return lines.join("\n");
}

function estimateTokens(text) {
  const chars = String(text || "").length;
  if (!chars) return 0;
  return Math.max(1, Math.round(chars / CHARS_PER_TOKEN));
}

function frontmatter(skill) {
  return "---\nname: " + skill.name + "\ndescription: " + skill.description + "\n---\n";
}

const SKILLS = [
  {
    name: "deploy-checklist",
    folder: "deploy-checklist",
    description: "Use when Northwind Platform is about to cut a release or deploy to production. Covers the freeze on main, how much traffic the canary takes, who owns rollback, and the rule that a failed preflight stops the ship. Cluster flags and timeouts stay in the script. This description only says when that script should run. A push after the freeze is a new candidate, not a quiet commit.",
    triggers: ["cut a release", "deploy", "canary", "rollback", "preflight"],
    judgment: "When to freeze main, how long the canary stays narrow, who owns rollback, and the rule that a failed check stops the ship.",
    body: doc([
      "# Production deploy",
      "",
      "## When this applies",
      "The request is to cut a release, deploy Northwind Platform, or run the preflight before a production push. A question about who owns rollback, with no ship in progress, can be answered from this file alone.",
      "",
      "## Judgment",
      "- Freeze merges to main once the release candidate is tagged. A late fix is a new candidate. Do not land it as a quiet commit on the tag.",
      "- Canary is 5 percent of production traffic for 20 minutes. Watch checkout failures, the API error rate, and the billing queue depth.",
      "- Roll back if checkout failures rise above the trailing hour, or if the billing queue depth triples. The rollback owner is the on-call engineer named on the release ticket.",
      "- Widen the canary only after those 20 minutes are clean. The preflight script checks the current weight. It does not widen it.",
      "- Customer wording for the ship belongs to the release notes skill. This file decides whether the ship is safe, not how to describe it.",
      "- A skipped CI check or an unowned migration in the diff stops the ship even when the preflight command is green.",
      "",
      "## Stop",
      "- Stop if the preflight exits non-zero. Do not override it from the chat because someone is waiting in the release channel.",
      "- Stop if the rollback owner is unnamed. A ship with no person to roll it back is not ready.",
      "",
      "## Precision",
      "Cluster context, namespace, and the checks themselves are in scripts/preflight.sh. Run that script. Do not retype the commands from memory or from this paragraph. This file says when a failure is a stop. The script is the check."
    ]),
    resources: [
      {
        path: "scripts/preflight.sh",
        kind: "script",
        openIf: ["cut a release", "deploy", "preflight"],
        reasonOpen: "The request is a ship, so the agent opens the preflight and is supposed to run it. The markdown still holds the rollback rule.",
        reasonClosed: "The request asks for a judgment about the ship. The preflight stays on disk until someone is cutting a release, deploying, or running that script.",
        content: doc([
          "#!/bin/sh",
          "# Northwind Platform preflight. Run this file. Do not retype it.",
          "set -eu",
          "CONTEXT=prod-iad",
          "NAMESPACE=platform",
          "echo \"context $CONTEXT namespace $NAMESPACE\"",
          "git fetch --quiet origin main",
          "git rev-parse HEAD",
          "git merge-base --is-ancestor HEAD origin/main",
          "kubectl --context \"$CONTEXT\" -n \"$NAMESPACE\" get deploy platform-api",
          "kubectl --context \"$CONTEXT\" -n \"$NAMESPACE\" rollout status deploy/platform-api --timeout=180s",
          "kubectl --context \"$CONTEXT\" -n \"$NAMESPACE\" get canary platform-api",
          "echo \"canary must stay at 5 until the on-call widens it\"",
          "echo \"preflight ok\""
        ])
      }
    ]
  },
  {
    name: "release-notes",
    folder: "release-notes",
    description: "Use when a teammate asks to write notes, update the changelog, or publish the customer release notes for a Northwind Platform ship. Group what shipped by what a person can do now, and leave ticket ids and author names out. These notes are a judgment about wording. They do not decide whether the ship is safe. Partial fixes say what still fails.",
    triggers: ["release notes", "write notes", "changelog", "what shipped"],
    judgment: "What a customer can do now, which internal work stays out, and how a partial fix has to be described.",
    body: doc([
      "# Release notes",
      "",
      "## When this applies",
      "The request is to write notes, update the changelog, or publish the customer-facing release notes for a Northwind Platform ship.",
      "",
      "## Judgment",
      "- Lead with what a customer can do now. One change, then the detail. Do not open with the internal project name.",
      "- Group the notes as Added, Fixed, and Changed. A refactor goes under Changed only when a customer would notice the behavior.",
      "- Leave out ticket ids, author names, cluster names, and infrastructure work that does not change the product.",
      "- If a fix is partial, say what still fails. Do not call a mitigation a fix.",
      "- The deploy checklist decides whether the release is safe to ship. These notes do not. If the ship is held, do not publish the notes.",
      "- Use plain verbs. Prefer \"You can export a quarter of invoices\" over \"users now have the ability to export.\"",
      "- No \"excited to announce,\" no \"unlock,\" and no promise of a date that is not already on the release ticket.",
      "",
      "## Stop",
      "- Stop if the only source is a memory of the diff. Read the merged changes, then write.",
      "- Stop before naming a customer who found a bug. Thank the report in the ticket, not in the public notes.",
      "",
      "## Precision",
      "This skill is a judgment about what to say. There is no script. A sample of the shape lives in references/shipped-example.md. Leave that file closed until someone asks for an example."
    ]),
    resources: [
      {
        path: "references/shipped-example.md",
        kind: "reference",
        openIf: ["example"],
        reasonOpen: "The request asks for an example, so the agent opens the sample notes instead of inventing a format.",
        reasonClosed: "Nobody asked for an example. The sample notes stay on disk. The judgment in the body is enough to draft the real notes.",
        content: doc([
          "# Sample release notes",
          "",
          "These lines show the shape. Replace them with the ship you are writing. Do not publish this sample.",
          "",
          "## Added",
          "- You can export a quarter of invoices as a PDF from the billing page. The file name includes the tenant and the quarter.",
          "",
          "## Fixed",
          "- Checkout no longer drops the purchase order when the cart is edited after the PO is entered. Orders placed during the Monday incident still need the repair noted in the status page.",
          "",
          "## Changed",
          "- The canary for the billing API now stays at 5 percent until the on-call widens it. You should not notice a change unless a ship is in progress.",
          "",
          "Leave ticket ids and author names out. A partial fix says what still fails."
        ])
      }
    ]
  },
  {
    name: "customer-email-tone",
    folder: "customer-email-tone",
    description: "Use when drafting a customer apology email for Northwind Platform, including a note that should apologize or say sorry. Says what we admit, which promises we never make in mail, and who signs the customer email. Tone and the boundary of a promise are the skill. It is not a form, and it does not invent a refund. Sign with a named role, not The Team.",
    triggers: ["apology", "apologize", "sorry", "customer email"],
    judgment: "What we admit, which promises stay out of the mail, and who is allowed to sign.",
    body: doc([
      "# Customer email",
      "",
      "## When this applies",
      "A teammate asks for a customer apology email, or for the wording of a sorry note about a Northwind Platform mistake.",
      "",
      "## Judgment",
      "- Say what happened in one sentence, then who was affected, then what we are doing next. The first sentence has a fact, not a mood.",
      "- Admit the specific failure. \"Sorry for any inconvenience\" with no fact attached is not an apology.",
      "- Never promise a refund, a credit, a ship date, or a root cause that finance or the incident owner has not already written down. Offer to follow up with the person who can make that promise.",
      "- Do not blame the customer, a vendor, or traffic. If a vendor failed, say we failed to deliver the thing the customer bought.",
      "- Sign with a named Northwind role, such as Support lead, not \"The Team\" and not a personal mobile number.",
      "- Do not ask the customer to delete a previous email, and do not paste a legal hold into the note.",
      "- If the facts are a timeline of an incident, do not invent that timeline here. Ask for the postmortem, or wait until it exists.",
      "",
      "## Stop",
      "- Stop if the only instruction is \"make them feel better.\" Ask what happened.",
      "- Stop before mentioning another customer's name, contract, or invoice.",
      "",
      "## Precision",
      "Tone and the boundary of a promise are the skill. Do not turn this into a template script. A script would pretend the apology is a form, and a form is how a specific promise sneaks into every send."
    ]),
    resources: []
  },
  {
    name: "sql-readonly",
    folder: "sql-readonly",
    description: "Use when a Northwind question needs warehouse SQL for revenue, usage, or billing, including a request to run the SQL for yesterday's revenue. The agent may execute only the read-only script, which has a row cap and a timeout. This description is the trigger. The SELECT guard itself lives in the script, not in this line. Yesterday follows the warehouse calendar.",
    triggers: ["sql", "revenue", "warehouse", "read-only"],
    judgment: "Which table counts as revenue, which calendar \"yesterday\" uses, and the refusal to write.",
    body: doc([
      "# Read-only warehouse SQL",
      "",
      "## When this applies",
      "The request needs a number from the warehouse: revenue, usage, or billing. People often say to run the SQL for yesterday or for a named day.",
      "",
      "## Judgment",
      "- Answer with the script's result. Do not compose a new query in the chat and paste it into a shell.",
      "- Yesterday means the previous full day in America/Chicago, the warehouse calendar. Do not use the server's UTC date. A partial day is not yesterday.",
      "- Revenue is recognized invoices less credits. Do not sum the payments table. Payments include failed captures and double counts.",
      "- Usage questions read the daily rollup, not the raw event stream. The stream is for debugging a single hour, and only when the question says so.",
      "- If the question names a customer, stop and ask for the tenant id. Do not guess a name match. Two tenants share a legal name more often than people expect.",
      "- A write, a DDL statement, or \"just this once update a row\" is out of scope. Refuse it. Schema work belongs to the migration runbook, not here.",
      "",
      "## Stop",
      "- Stop if the script exits non-zero or hits the row cap. Report the cap. Do not widen it in the chat.",
      "- Stop before joining a table that is not in the script. Add the join in review, not in a live answer.",
      "",
      "## Precision",
      "scripts/run_readonly.py is the procedure: a SELECT whitelist, a 15 second timeout, and a 500 row cap. Run the script. Do not paste a new query into the shell. The paragraphs above are the judgment. The file is the guard."
    ]),
    resources: [
      {
        path: "scripts/run_readonly.py",
        kind: "script",
        openIf: ["*"],
        reasonOpen: "Any request that matches this skill needs the guard. The agent runs the file. It does not invent a SELECT in prose.",
        reasonClosed: "The script stays closed only when the skill itself did not match.",
        content: doc([
          "#!/usr/bin/env python3",
          "\"\"\"Northwind warehouse read. Execute this file. Do not invent a query.\"\"\"",
          "",
          "import sys",
          "",
          "TIMEOUT_SECONDS = 15",
          "ROW_CAP = 500",
          "CALENDAR = \"America/Chicago\"",
          "",
          "REVENUE = \"\"\"",
          "SELECT date(recognized_at, 'America/Chicago') AS day,",
          "       sum(amount_cents - credit_cents) AS revenue_cents",
          "FROM invoices",
          "WHERE recognized_at >= :start",
          "  AND recognized_at < :end",
          "  AND status = 'recognized'",
          "GROUP BY 1",
          "\"\"\"",
          "",
          "def main():",
          "    if \"--write\" in sys.argv or \"--ddl\" in sys.argv:",
          "        sys.exit(\"writes are refused\")",
          "    # Bind :start and :end in CALENDAR. Yesterday is the previous full day.",
          "    print(\"timeout\", TIMEOUT_SECONDS)",
          "    print(\"row_cap\", ROW_CAP)",
          "    print(\"calendar\", CALENDAR)",
          "    print(REVENUE.strip())",
          "",
          "if __name__ == \"__main__\":",
          "    main()"
        ])
      }
    ]
  },
  {
    name: "invoice-pdf",
    folder: "invoice-pdf",
    description: "Use when filling a Northwind customer invoice PDF, including a Q3 invoice or any other quarterly invoice. Someone may say invoice, pdf, or q3. Amounts come from the billing ledger. Field positions, tax rounding, and the filename pattern belong in the script, so this line does not try to restate them. A missing purchase order blocks sending.",
    triggers: ["invoice", "pdf", "quarterly", "q3"],
    judgment: "Where amounts come from, when a draft may be sent, and the rule that a missing purchase order blocks sending.",
    body: doc([
      "# Invoice PDF",
      "",
      "## When this applies",
      "Someone asks to fill an invoice PDF for a Northwind customer, including a Q3 invoice or another quarterly invoice.",
      "",
      "## Judgment",
      "- Amounts come from the billing ledger for that tenant and quarter. Do not type numbers from a spreadsheet pasted into the chat.",
      "- Tax is rounded half-up to the cent on each line, then summed. Do not round only the total. The script owns the rounding. This file only says that the total follows the lines.",
      "- A missing purchase order does not block a draft. It does block sending. Say which of the two you produced.",
      "- Do not invent a logo, a bank account, a footer address, or a tax rate. If the ledger has no tax rate, stop and ask finance.",
      "- The filename includes the tenant id and the quarter. Do not put the customer's legal name in the file name.",
      "- A credit memo is not an invoice. If the ledger balance is negative, stop and ask for the credit path.",
      "",
      "## Stop",
      "- Stop if the tenant id is missing. A company name is not a tenant id.",
      "- Stop before emailing the file. This skill fills a PDF. Sending it is a separate decision.",
      "",
      "## Precision",
      "Field positions, the font, and the rounding helper are in scripts/fill_invoice.py. Run that script with the tenant id and the quarter. Do not place fields by describing them in English. This file says when a draft may be sent. The script places the ink."
    ]),
    resources: [
      {
        path: "scripts/fill_invoice.py",
        kind: "script",
        openIf: ["*"],
        reasonOpen: "Filling the PDF is the exact step. The agent runs the script so the field map and the rounding do not get paraphrased.",
        reasonClosed: "The filler stays closed only when this skill did not match.",
        content: doc([
          "#!/usr/bin/env python3",
          "\"\"\"Place ink on the Northwind invoice PDF. Run with tenant id and quarter.\"\"\"",
          "",
          "PAGE_WIDTH = 612",
          "PAGE_HEIGHT = 792",
          "FONT = \"SourceSerif\"",
          "ROUNDING = \"HALF_UP\"",
          "",
          "FIELDS = {",
          "    \"tenant\": (72, 700),",
          "    \"quarter\": (72, 676),",
          "    \"bill_to\": (72, 640),",
          "    \"line_items\": (72, 560),",
          "    \"tax\": (400, 180),",
          "    \"total\": (400, 156),",
          "    \"purchase_order\": (72, 120),",
          "}",
          "",
          "def filename(tenant, quarter):",
          "    return \"northwind-invoice-%s-%s.pdf\" % (tenant, quarter)",
          "",
          "def main():",
          "    print(\"page\", PAGE_WIDTH, PAGE_HEIGHT)",
          "    print(\"font\", FONT)",
          "    print(\"rounding\", ROUNDING)",
          "    print(\"fields\", len(FIELDS))",
          "    # Half-up to the cent is applied per line inside the ledger helper.",
          "    # This file does not accept amounts on the command line.",
          "",
          "if __name__ == \"__main__\":",
          "    main()"
        ])
      }
    ]
  },
  {
    name: "incident-postmortem",
    folder: "incident-postmortem",
    description: "Use when writing the postmortem for a Northwind production outage, or when someone asks for an incident review after a bad night. Sets the timeline, the customer impact, and the action items with owners. The section headings live in a template file so later reviews stay searchable. The narrative of what happened stays a judgment. Guesswork is labeled as a hypothesis.",
    triggers: ["postmortem", "outage", "incident review"],
    judgment: "How to separate facts from guesses, how to count customer impact, and the rule that an action item needs an owner.",
    body: doc([
      "# Incident postmortem",
      "",
      "## When this applies",
      "The request is a postmortem for a Northwind production outage, or an incident review after a severe night.",
      "",
      "## Judgment",
      "- Write the timeline in America/Chicago, and state the UTC offset once at the top. Do not mix \"last night\" with UTC timestamps without saying which is which.",
      "- Separate what we know from what we guess. A guess is labeled as a hypothesis. A hypothesis does not go in the summary.",
      "- Customer impact is a count of tenants and a duration, or the word unknown. Do not invent a percentage of revenue.",
      "- Action items have an owner and a date. An item with neither is a wish, and wishes do not go in the list.",
      "- Blame stays on systems and decisions. A person's name can be the owner of a fix. A person's name is not the cause.",
      "- The customer email, if one was sent, is linked. Do not rewrite the apology inside the postmortem.",
      "",
      "## Stop",
      "- Stop if the timeline contradicts the status page. Reconcile the two before publishing.",
      "- Stop before naming a customer tenant in a doc that will be shared outside the incident channel.",
      "",
      "## Precision",
      "The section headings are fixed so the review archive stays searchable. Copy them from references/template.md. Do not rename Customer impact, and do not merge sections. The narrative is a judgment. The headings are the file."
    ]),
    resources: [
      {
        path: "references/template.md",
        kind: "reference",
        openIf: ["*"],
        reasonOpen: "Writing the postmortem means opening the template. The headings are exact so the archive stays searchable. The story stays in the agent's own words.",
        reasonClosed: "The template stays closed only when this skill did not match.",
        content: doc([
          "# Postmortem template",
          "",
          "Copy these headings in this order. Do not rename them.",
          "",
          "## Summary",
          "Three sentences: what broke, who was affected, current state. Facts only.",
          "",
          "## Timeline",
          "America/Chicago, with the UTC offset stated once. One event per line.",
          "",
          "## Customer impact",
          "Tenant count and duration, or unknown. No invented revenue percentage.",
          "",
          "## What we know",
          "Observations with a source: dashboard, log, ticket, or status page.",
          "",
          "## Hypotheses",
          "Labeled as hypotheses. Kept out of the summary.",
          "",
          "## Action items",
          "Each line has an owner and a date. No owner, no line.",
          "",
          "## Customer email",
          "Link the note if one was sent. Do not paste a new apology here."
        ])
      }
    ]
  },
  {
    name: "pr-review-checklist",
    folder: "pr-review-checklist",
    description: "Use when reviewing a pull request on a Northwind platform repo, or when a teammate asks for a code review. Checks tests against the claimed behavior, feature-flag defaults, and tenant scope. A database diff is still only a review until someone applies it. Style nits are not a reason to block the change. Secrets and a skipped check are blocks.",
    triggers: ["pull request", "code review"],
    judgment: "What blocks a review: tests that miss the claim, a tenant leak, a secret, a skipped check. Style nits do not block.",
    body: doc([
      "# Pull request review",
      "",
      "## When this applies",
      "A teammate asks for a pull request review or a code review on a Northwind platform repo.",
      "",
      "## Judgment",
      "- Tests cover the behavior the description claims, not only the line that changed. A snapshot with no assertion about the bug is not coverage.",
      "- Read the description before the diff. If the description and the diff disagree, that disagreement is the first comment.",
      "- Feature flags default off. A flag that defaults on needs a sentence saying who turns it off if the ship goes badly.",
      "- Tenant scope is a block when a query or a cache key can see another tenant's rows. Say the key, not \"be careful with tenants.\"",
      "- A database diff is a review of the statements, not permission to apply them. Point at the schema skill for the expand, backfill, then contract order. Do not run those statements from the review.",
      "- Secrets, new production credentials, and a skipped CI check are blocks. Formatting nits are not.",
      "",
      "## Stop",
      "- Stop if you cannot see the CI result. A review that guesses the tests passed is not a review.",
      "- Stop before rewriting the change for the author. Comment the risk. Let them change the diff.",
      "",
      "## Precision",
      "This skill is a list of judgments. There is no script. The author runs the tests. You read the diff and the description, and you say what would block the merge."
    ]),
    resources: []
  },
  {
    name: "accessibility-audit",
    folder: "accessibility-audit",
    description: "Use for an accessibility audit of a Northwind UI change, including a request that says a11y, WCAG, or screen reader. Judge the keyboard path, the accessible name, and contrast on the surface the change actually ships. The criterion ids Northwind treats as in scope live in a reference file, not in memory. Placeholder text is not the accessible name.",
    triggers: ["accessibility", "a11y", "wcag", "screen reader"],
    judgment: "Whether the keyboard path, the accessible name, and the contrast pass on the surface this diff actually ships.",
    body: doc([
      "# Accessibility audit",
      "",
      "## When this applies",
      "An accessibility audit of a Northwind UI change, including a pass that mentions a screen reader.",
      "",
      "## Judgment",
      "- Keyboard: every new control is reachable in order, and focus is visible. A mouse-only path is a failure even when the click handler works.",
      "- Name: buttons and inputs expose a name a screen reader would speak. Placeholder text is not the name. An icon button needs a name that says the action.",
      "- Contrast: body text at least 4.5 to 1 against the surface behind it. Large text at least 3 to 1. Check the surface the change ships, including the hover and the error state.",
      "- A visual restyle that does not change roles can still break contrast. Audit the color change. Do not skip it because the DOM nodes look the same.",
      "- File the failures with the element and the expected name or ratio. Do not file a wave of preferences that are not in the map.",
      "",
      "## Stop",
      "- Stop if the build you are looking at is not the one in the diff. Say which build you audited.",
      "- Stop before citing a criterion id from memory.",
      "",
      "## Precision",
      "The checks Northwind treats as in scope are listed in references/wcag-map.md. Use those ids. Do not cite a criterion that is not on the map. The pass or fail for this diff is a judgment. The ids are the file."
    ]),
    resources: [
      {
        path: "references/wcag-map.md",
        kind: "reference",
        openIf: ["*"],
        reasonOpen: "The audit cites criterion ids from the map. Opening the file keeps the agent from inventing an id.",
        reasonClosed: "The map stays closed only when this skill did not match.",
        content: doc([
          "# Northwind UI checks",
          "",
          "Cite these ids only. A failure names the element and the expected value.",
          "",
          "- 1.1.1 Non-text content. Icon buttons have a text name.",
          "- 1.3.1 Info and relationships. Headings and labels are in the accessibility tree, not only in color.",
          "- 1.4.3 Contrast (minimum). Body text 4.5 to 1. Large text 3 to 1.",
          "- 2.1.1 Keyboard. Every action that uses a click also runs from the keyboard.",
          "- 2.4.3 Focus order. New controls follow the visual order.",
          "- 2.4.7 Focus visible. The focused control has a visible ring on the shipped surface.",
          "- 3.3.2 Labels or instructions. Placeholder text is not the label.",
          "- 4.1.2 Name, role, value. The role matches the control the person thinks they are using.",
          "",
          "Out of scope for this map: cognitive preferences, reading level, and animation timing. Note them separately if asked. Do not file them as failures against the ids above."
        ])
      }
    ]
  },
  {
    name: "oncall-handoff",
    folder: "oncall-handoff",
    description: "Use when writing the Northwind on-call handoff at shift change, including who holds the pager next. Lead with pages that are still open, then alerts that were noise, then work the next person should not start. A handoff is a judgment about what they must know before they accept the rotation. Name the person who accepts the pager.",
    triggers: ["on-call", "handoff", "shift change", "pager"],
    judgment: "What the next person must know: open pages, noise, changes already made, and who accepts the pager.",
    body: doc([
      "# On-call handoff",
      "",
      "## When this applies",
      "The on-call handoff at shift change, including a pager note for the next Northwind engineer.",
      "",
      "## Judgment",
      "- Lead with pages that are still open, then alerts that fired and were noise, then work the next person should not start.",
      "- Each open incident has a link, the current best guess, and the next check. \"It is bad\" is not a handoff.",
      "- Name the person who accepts the pager. A note with no receiver is a note to yourself. Do not end the shift until they confirm.",
      "- If you changed production during the shift, say what you changed so the next person does not undo it. Include the time and the cluster context.",
      "- Do not include customer secrets, raw payment data, or a production password. Say where the secret lives, not the secret.",
      "- Noise matters. An alert that paged and meant nothing should be named, so the next person does not treat it as new.",
      "",
      "## Stop",
      "- Stop if you are mid-mitigation and the receiver has not answered. Stay until they have.",
      "- Stop before copying a customer email thread into the handoff channel.",
      "",
      "## Precision",
      "This is a judgment about what the next person needs. There is no script. Write the note in the handoff channel, in the order above."
    ]),
    resources: []
  },
  {
    name: "migration-runbook",
    folder: "migration-runbook",
    description: "Use when planning a Northwind schema migration, a backfill, or a schema change. The order is expand, then backfill, then contract, and the old code has to keep working after the expand. The apply file is for running the change. A review of the diff leaves that file closed. Never contract in the same release that expands.",
    triggers: ["migration", "backfill", "schema change"],
    judgment: "The order is expand, then backfill, then contract. Old code keeps working after the expand. A review does not apply the change.",
    body: doc([
      "# Schema migration",
      "",
      "## When this applies",
      "Planning or reviewing a Northwind schema change, a backfill, or a migration. Applying it is a separate step, and only when the request says so.",
      "",
      "## Judgment",
      "- Expand, then backfill, then contract. Never contract in the same release that expands. Readers on the old version have to keep working after the expand ships.",
      "- Read the diff for a write to a column the previous version does not know about. That write is a block until the old version is gone.",
      "- A backfill has a batch size and a stop condition. An unbounded update is a block even when the statement is correct.",
      "- A pull request review reads this judgment. It does not run the statements. Tell the author the order. Leave the apply file closed.",
      "- Lock timeout stays short. A migration that waits on a lock until the app stalls is a failed plan, not a thorough one.",
      "- The rollback of an expand is a follow-up change, not a drop of a column that new code already reads.",
      "",
      "## Stop",
      "- Stop if the request is only a review and you were about to open a shell.",
      "- Stop if the backfill has no batch size. Do not invent one in the chat and call it the plan.",
      "",
      "## Precision",
      "scripts/expand_contract.sql is the procedure for applying the change: the lock timeout, the batch, and the order of statements. Open and run it only when the request is to apply the migration, to run the migration, or to backfill. A review leaves the file on disk. Do not paraphrase those statements into a new script in the chat."
    ]),
    resources: [
      {
        path: "scripts/expand_contract.sql",
        kind: "script",
        openIf: ["apply the migration", "run the migration", "backfill"],
        reasonOpen: "The request is applying a change or backfilling, so the SQL file is the procedure. The agent runs it instead of writing a new update in the chat.",
        reasonClosed: "This request is a plan or a review. The body already has the order. The SQL stays on disk and adds no tokens.",
        content: doc([
          "-- Apply a Northwind schema change.",
          "-- Expand, backfill, and contract are separate releases.",
          "-- Do not paraphrase this file into a new script.",
          "",
          "SET lock_timeout = '2s';",
          "SET statement_timeout = '30s';",
          "",
          "-- Expand. Old code must still run after this statement.",
          "ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_book_id bigint;",
          "",
          "-- Backfill in batches of 500. Stop if a batch hits the timeout.",
          "-- Bind :cursor from the last id that committed.",
          "-- UPDATE orders",
          "--   SET price_book_id = 1",
          "--   WHERE price_book_id IS NULL",
          "--     AND id > :cursor",
          "--     AND id <= :cursor + 500;",
          "",
          "-- Contract is a later release, after readers no longer need the old column.",
          "-- ALTER TABLE orders DROP COLUMN legacy_price_code;"
        ])
      }
    ]
  },
  {
    name: "brand-voice-ads",
    folder: "brand-voice-ads",
    description: "Use when drafting a paid ad, ad copy, or other campaign copy that has to stay in the Northwind brand voice. One claim a customer can check, addressed as you, with no competitor names and no guaranteed savings. Banned strings are copied from a file so a softer paraphrase cannot let one through. Do not invent a discount in the chat.",
    triggers: ["brand voice", "paid ad", "ad copy"],
    judgment: "One checkable claim, addressed as you, with no invented discount and no competitor name.",
    body: doc([
      "# Brand voice for ads",
      "",
      "## When this applies",
      "Drafting a paid ad or other campaign copy that should stay in the Northwind brand voice.",
      "",
      "## Judgment",
      "- One claim per ad. The claim is something a customer can check in the product this week, not a mood.",
      "- Speak to the buyer as \"you.\" Do not say \"users,\" and do not say \"leverage.\"",
      "- No competitor names. No \"best,\" no \"only,\" no guaranteed savings. If the claim needs a number, the number comes from a published page, not from this chat.",
      "- A seasonal line can mention winter, the fiscal quarter, or a shipping cutoff. It cannot invent a discount, a coupon, or a deadline that sales has not published.",
      "- The apology skill is for a customer who was harmed. An ad is not an apology, and an apology is not an ad.",
      "",
      "## Stop",
      "- Stop if the brief says \"make it punchier\" and does not say the claim. Ask for the claim.",
      "- Stop before naming a customer logo we do not have permission to use.",
      "",
      "## Precision",
      "The strings we do not say are copied from references/banned-claims.txt. Compare the draft to that list. Do not rely on a paraphrase of the ban, because a paraphrase lets a softened superlative through when the file bans the root word. The judgment of what the ad should promise is this file. The banned strings are the other file."
    ]),
    resources: [
      {
        path: "references/banned-claims.txt",
        kind: "reference",
        openIf: ["*"],
        reasonOpen: "The banned strings are exact. The agent copies them from the file instead of remembering a softer version of the ban.",
        reasonClosed: "The list stays closed only when this skill did not match.",
        content: doc([
          "# Banned in Northwind ads",
          "# Match these as substrings, case insensitive. A paraphrase is not a pass.",
          "best",
          "best-in-class",
          "only platform",
          "only tool",
          "guarantee",
          "guaranteed",
          "guaranteed savings",
          "10x",
          "unlock",
          "leverage",
          "synergy",
          "users will love",
          "Contoso",
          "Fabrikam",
          "AdventureWorks",
          "# Competitor names stay banned even when the brief names them.",
          "# Discounts belong on a published pricing page, not in this file."
        ])
      }
    ]
  },
  {
    name: "eval-harness",
    folder: "eval-harness",
    description: "Use when adding a Northwind agent eval, naming a grader, or talking about the eval harness and its evals. A new eval needs a fixture, the field that matters, and a reason a wrong answer is wrong. The runner script is for an eval run. A design note about a fixture leaves the runner closed. Do not lower the pass bar to go green.",
    triggers: ["eval", "eval harness", "grader", "evals"],
    judgment: "What a new eval must contain, and the rule that the pass bar does not move to make a change look green.",
    body: doc([
      "# Eval harness",
      "",
      "## When this applies",
      "Adding a Northwind agent eval, naming a grader, or asking how the eval harness scores a change. Running the harness is the script, and only when the request says to run it.",
      "",
      "## Judgment",
      "- A new eval needs a fixture with the input, the field that matters, and a reason a wrong answer is wrong. A single happy-path string is not an eval.",
      "- Grade the behavior the change claims. Do not grade a lucky phrase in the output if a wrong answer could contain the same phrase.",
      "- The pass bar is the one already in the harness. Do not lower it to make a change go green. If the bar is wrong, that is a separate change with its own review.",
      "- Keep fixtures free of real customer data. Use the fictional Northwind tenants already in the suite.",
      "- A failing eval blocks the skill or the prompt change it covers. Do not delete the fixture to clear the board.",
      "",
      "## Stop",
      "- Stop if the fixture contains a real tenant name, a real email, or a production id. Replace it before the file is saved.",
      "- Stop before reporting a pass rate you did not get from the runner.",
      "",
      "## Precision",
      "scripts/run_eval.py runs the suite and writes the pass line. Run it when the request is to run the eval or the harness. A request to add a fixture leaves the script closed until there is something to execute. Do not describe a fictional pass rate."
    ]),
    resources: [
      {
        path: "scripts/run_eval.py",
        kind: "script",
        openIf: ["run"],
        reasonOpen: "The request says to run the harness, so the agent opens the runner instead of describing a pass rate from memory.",
        reasonClosed: "This request adds or discusses an eval. The runner stays closed until there is something to execute.",
        content: doc([
          "#!/usr/bin/env python3",
          "\"\"\"Run the Northwind agent eval suite. Do not invent a pass rate.\"\"\"",
          "",
          "from pathlib import Path",
          "",
          "PASS_BAR = 0.90",
          "SUITE = Path(\"evals/platform\")",
          "",
          "def main():",
          "    fixtures = sorted(SUITE.glob(\"*.json\"))",
          "    if not fixtures:",
          "        raise SystemExit(\"no fixtures\")",
          "    # The grader reads the expected field on each fixture.",
          "    # This stub prints the bar. It does not lower it.",
          "    print(\"fixtures\", len(fixtures))",
          "    print(\"pass_bar\", PASS_BAR)",
          "    print(\"result\", \"not-run-in-this-demo\")",
          "",
          "if __name__ == \"__main__\":",
          "    main()"
        ])
      }
    ]
  }
];

function haystack(skill) {
  return skill.name + "\n" + skill.description;
}

function containsTerm(text, term) {
  const raw = String(text || "");
  const needle = String(term || "").toLowerCase();
  if (!needle) return false;
  if (needle.indexOf(" ") !== -1 || needle.indexOf("-") !== -1) {
    return raw.toLowerCase().indexOf(needle) !== -1;
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("\\b" + escaped + "\\b", "i").test(raw);
}

function triggersHit(skill, query) {
  const hits = [];
  skill.triggers.forEach((term) => {
    if (containsTerm(query, term) && containsTerm(haystack(skill), term)) hits.push(term);
  });
  return hits;
}

function resourceOpens(resource, query) {
  if (resource.openIf.indexOf("*") !== -1) return true;
  return resource.openIf.some((term) => containsTerm(query, term));
}

function analyze(query) {
  const trimmed = String(query || "").trim();
  const skills = SKILLS.map((skill) => {
    const hits = trimmed ? triggersHit(skill, trimmed) : [];
    const active = hits.length > 0;
    const resources = skill.resources.map((resource) => ({
      path: resource.path,
      kind: resource.kind,
      content: resource.content,
      reasonOpen: resource.reasonOpen,
      reasonClosed: resource.reasonClosed,
      opened: active && resourceOpens(resource, trimmed),
      tokens: estimateTokens(resource.content)
    }));
    return {
      skill,
      hits,
      active,
      l1: estimateTokens(frontmatter(skill)),
      l2: estimateTokens(skill.body),
      l1Text: frontmatter(skill),
      resources
    };
  });

  const l1 = sum(skills, (row) => row.l1);
  const allL2 = sum(skills, (row) => row.l2);
  const allL3 = sum(skills, (row) => sum(row.resources, (resource) => resource.tokens));
  const openL2 = sum(skills.filter((row) => row.active), (row) => row.l2);
  const openL3 = sum(skills, (row) => sum(row.resources.filter((resource) => resource.opened), (resource) => resource.tokens));

  return {
    query: trimmed,
    skills,
    active: skills.filter((row) => row.active),
    progressive: { l1, l2: openL2, l3: openL3, total: l1 + openL2 + openL3 },
    monolithic: { l1, l2: allL2, l3: allL3, total: l1 + allL2 + allL3 }
  };
}

function sum(list, fn) {
  let total = 0;
  list.forEach((item) => {
    total += fn(item);
  });
  return total;
}

function fmt(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function plural(count, word) {
  return count + " " + word + (count === 1 ? "" : "s");
}

function joinAnd(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return items[0] + " and " + items[1];
  return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
}

function sameSet(left, right) {
  const a = left.slice().sort();
  const b = right.slice().sort();
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function openedPaths(row) {
  return row.resources.filter((resource) => resource.opened).map((resource) => resource.path);
}

function lessonsHold() {
  const fails = [];
  if (SKILLS.length !== 12) fails.push("count " + SKILLS.length);

  const names = {};
  SKILLS.forEach((skill) => {
    if (names[skill.name]) fails.push("dup " + skill.name);
    names[skill.name] = true;
    if (skill.folder !== skill.name) fails.push("folder " + skill.name);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(skill.name)) fails.push("name shape " + skill.name);
    if (/[:#]/.test(skill.description) || skill.description.indexOf("\n") !== -1) fails.push("yaml " + skill.name);
    const level1 = estimateTokens(frontmatter(skill));
    if (level1 < 85 || level1 > 120) fails.push(skill.name + " L1 " + level1);
    const level2 = estimateTokens(skill.body);
    if (level2 < 250) fails.push(skill.name + " body " + level2);
    skill.triggers.forEach((term) => {
      if (!containsTerm(haystack(skill), term)) fails.push("missing trigger " + skill.name + " " + term);
      SKILLS.forEach((other) => {
        if (other.name !== skill.name && containsTerm(haystack(other), term)) {
          fails.push("trigger " + term + " also in " + other.name);
        }
      });
    });
    skill.resources.forEach((resource) => {
      if (skill.body.indexOf(resource.path) === -1) fails.push(skill.name + " body missing " + resource.path);
      if (estimateTokens(resource.content) < 40) fails.push("tiny " + resource.path + " " + estimateTokens(resource.content));
    });
  });

  const cases = [
    ["cut a release and write notes", ["deploy-checklist", "release-notes"], { "deploy-checklist": ["scripts/preflight.sh"], "release-notes": [] }],
    ["draft a customer apology email", ["customer-email-tone"], { "customer-email-tone": [] }],
    ["run the SQL skill for yesterday's revenue", ["sql-readonly"], { "sql-readonly": ["scripts/run_readonly.py"] }],
    ["fill the Q3 invoice PDF", ["invoice-pdf"], { "invoice-pdf": ["scripts/fill_invoice.py"] }],
    ["postmortem for last night's outage", ["incident-postmortem"], { "incident-postmortem": ["references/template.md"] }],
    ["review the migration pull request", ["migration-runbook", "pr-review-checklist"], { "migration-runbook": [], "pr-review-checklist": [] }],
    ["who owns rollback?", ["deploy-checklist"], { "deploy-checklist": [] }],
    ["What's on the cafeteria menu this Friday?", [], {}],
    ["", [], {}],
    ["write the on-call handoff", ["oncall-handoff"], {}],
    ["accessibility audit the checkout form", ["accessibility-audit"], { "accessibility-audit": ["references/wcag-map.md"] }],
    ["draft a paid ad for the winter plan", ["brand-voice-ads"], { "brand-voice-ads": ["references/banned-claims.txt"] }],
    ["run the eval harness on the refund fixture", ["eval-harness"], { "eval-harness": ["scripts/run_eval.py"] }],
    ["add an eval for the refund fixture", ["eval-harness"], { "eval-harness": [] }],
    ["show an example of the release notes", ["release-notes"], { "release-notes": ["references/shipped-example.md"] }],
    ["the billing queue depth tripled", [], {}],
    ["backfill the order price book", ["migration-runbook"], { "migration-runbook": ["scripts/expand_contract.sql"] }],
    ["schema change for orders", ["migration-runbook"], { "migration-runbook": [] }]
  ];

  const idle = analyze("");
  cases.forEach((item) => {
    const result = analyze(item[0]);
    const got = result.active.map((row) => row.skill.name);
    if (!sameSet(got, item[1])) fails.push(JSON.stringify(item[0]) + " skills " + got.join("|") + " wanted " + item[1].join("|"));
    const files = item[2] || {};
    result.active.forEach((row) => {
      const want = files[row.skill.name] || [];
      const have = openedPaths(row);
      if (!sameSet(have, want)) fails.push(JSON.stringify(item[0]) + " " + row.skill.name + " files " + have.join("|"));
    });
    if (result.monolithic.total !== idle.monolithic.total) fails.push("dump moved " + item[0]);
    let expect = result.progressive.l1;
    result.skills.forEach((row) => {
      if (row.active) expect += row.l2;
      row.resources.forEach((resource) => {
        if (resource.opened) expect += resource.tokens;
      });
    });
    if (result.progressive.total !== expect) fails.push("prog sum " + item[0]);
    if (result.progressive.total >= result.monolithic.total) fails.push("no savings " + item[0]);
  });

  if (idle.progressive.total !== idle.progressive.l1) fails.push("idle not catalog");
  if (idle.progressive.l2 !== 0 || idle.progressive.l3 !== 0) fails.push("idle opened");
  if (idle.monolithic.total < idle.progressive.total * 4) {
    fails.push("ratio " + idle.monolithic.total + "/" + idle.progressive.total);
  }

  const busy = analyze("cut a release and write notes");
  if (busy.progressive.l3 <= 0) fails.push("release should open a script");
  if (busy.monolithic.l2 < busy.monolithic.l1 * 2) fails.push("bodies not the bulk");

  return fails;
}

function verdict(result) {
  if (!result.query) return "Startup. The catalog is loaded. No skill body is open.";
  if (!result.active.length) return "No skill matched. The bodies stay on disk.";
  let scripts = 0;
  let refs = 0;
  result.active.forEach((row) => {
    row.resources.forEach((resource) => {
      if (!resource.opened) return;
      if (resource.kind === "script") scripts += 1;
      else refs += 1;
    });
  });
  const bits = [plural(result.active.length, "skill")];
  if (scripts) bits.push(plural(scripts, "script"));
  if (refs) bits.push(plural(refs, "reference"));
  return "Opened " + joinAnd(bits) + ".";
}

function compareSentence(result) {
  const extra = result.monolithic.total - result.progressive.total;
  return "Progressive disclosure holds " + fmt(result.progressive.total) + " tokens on this turn. The dump holds " + fmt(result.monolithic.total) + ". The other " + fmt(extra) + " tokens are bodies and files this request did not open. The twelve bodies alone are " + fmt(result.monolithic.l2) + " tokens, against a catalog of " + fmt(result.monolithic.l1) + ".";
}

function explain(result) {
  if (!result.query) {
    return [
      "The agent has started. Twelve frontmatters are in context, one per skill. No SKILL.md body is open, and no script or reference is open.",
      "The dump has already pasted every body and every bundled file. Its token count does not wait for a request.",
      compareSentence(result)
    ];
  }
  if (!result.active.length) {
    return [
      "“" + result.query + "” does not share a trigger phrase with any skill name or description. Progressive disclosure stays on the catalog.",
      "The dump’s token count is unchanged, because that mode never looked at the request.",
      compareSentence(result)
    ];
  }
  const matched = result.active.map((row) => row.skill.name + " matched “" + row.hits.join("”, “") + "”");
  const added = result.progressive.total - result.progressive.l1;
  return [
    joinAnd(matched) + ".",
    "Those matches add " + fmt(added) + " tokens on top of the " + fmt(result.progressive.l1) + "-token catalog. Level 1 was already loaded for every skill, including the ones that stayed closed.",
    compareSentence(result)
  ];
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
    if (child == null || child === false) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

function fileCount(result) {
  return sum(result.skills, (row) => row.resources.length);
}

function bar(parts, scale) {
  const track = h("div", {
    class: "track",
    role: "img",
    "aria-label": "Level 1 " + fmt(parts.l1) + " tokens, level 2 " + fmt(parts.l2) + ", level 3 " + fmt(parts.l3) + ", out of " + fmt(scale)
  });
  [["l1", parts.l1], ["l2", parts.l2], ["l3", parts.l3]].forEach((seg) => {
    if (!seg[1] || !scale) return;
    const span = h("span", { class: "seg " + seg[0] });
    span.style.width = (seg[1] / scale) * 100 + "%";
    track.append(span);
  });
  return track;
}

function breakdown(lines) {
  return h("ul", { class: "breakdown" }, lines.map((line) => h("li", {}, [
    h("span", { text: line.label }),
    h("span", { class: "num", text: line.value })
  ])));
}

function budgetCard(kind, kicker, parts, scale, lines) {
  return h("article", { class: "budget " + kind }, [
    h("p", { class: "kicker", text: kicker }),
    h("p", { class: "value" }, [fmt(parts.total) + " ", h("span", { text: "tokens" })]),
    bar(parts, scale),
    breakdown(lines)
  ]);
}

function progressiveLines(result) {
  const lines = [{ label: "Level 1 · 12 frontmatters, standing", value: fmt(result.progressive.l1) }];
  if (!result.active.length) {
    lines.push({ label: "Level 2 · no body opened", value: "0" });
    lines.push({ label: "Level 3 · no file opened", value: "0" });
    return lines;
  }
  result.active.forEach((row) => {
    lines.push({ label: "Level 2 · " + row.skill.name, value: "+" + fmt(row.l2) });
    row.resources.forEach((resource) => {
      lines.push({
        label: "Level 3 · " + resource.path + (resource.opened ? "" : " · closed"),
        value: resource.opened ? "+" + fmt(resource.tokens) : "0"
      });
    });
    if (!row.resources.length) {
      lines.push({ label: "Level 3 · " + row.skill.name + " has no file", value: "0" });
    }
  });
  return lines;
}

function ladder(row) {
  const items = [
    h("li", { class: "rung standing" }, [
      h("span", { class: "step", text: "Level 1" }),
      h("span", { class: "what" }, [
        h("span", { class: "what-title", text: "Frontmatter already in the catalog" }),
        h("span", { class: "what-detail", text: "name and description. Counted in the standing total, not added again." })
      ]),
      h("span", { class: "delta", text: fmt(row.l1) })
    ]),
    h("li", { class: "rung opened" }, [
      h("span", { class: "step", text: "Level 2" }),
      h("span", { class: "what" }, [
        h("span", { class: "what-title", text: "SKILL.md body opened" }),
        h("span", { class: "what-detail", text: "The judgment for this request." })
      ]),
      h("span", { class: "delta", text: "+" + fmt(row.l2) })
    ])
  ];
  if (!row.resources.length) {
    items.push(h("li", { class: "rung closed" }, [
      h("span", { class: "step", text: "Level 3" }),
      h("span", { class: "what" }, [
        h("span", { class: "what-title", text: "No bundled file" }),
        h("span", { class: "what-detail", text: "This skill is a judgment. The body is the whole procedure." })
      ]),
      h("span", { class: "delta", text: "0" })
    ]));
  }
  row.resources.forEach((resource) => {
    items.push(h("li", { class: "rung " + (resource.opened ? "opened" : "closed") }, [
      h("span", { class: "step", text: "Level 3" }),
      h("span", { class: "what" }, [
        h("span", { class: "what-title", text: resource.path + (resource.opened ? " opened" : " left on disk") }),
        h("span", { class: "what-detail", text: resource.opened ? resource.reasonOpen : resource.reasonClosed })
      ]),
      h("span", { class: "delta", text: resource.opened ? "+" + fmt(resource.tokens) : "0" })
    ]));
  });
  return h("ol", { class: "ladder" }, items);
}

function skillCard(row) {
  const added = row.l2 + sum(row.resources.filter((resource) => resource.opened), (resource) => resource.tokens);
  const chips = [
    h("span", { class: "badge", text: "folder name matches" }),
    h("span", { class: "badge match", text: "matched “" + row.hits.join("”, “") + "”" })
  ];
  const blocks = [
    h("div", { class: "skill-head" }, [h("h3", { text: row.skill.name })].concat(chips)),
    h("p", { class: "path", text: row.skill.name + "/SKILL.md" }),
    ladder(row),
    h("p", { class: "hint", text: "This skill added " + fmt(added) + " tokens on top of its catalog line." }),
    h("p", { class: "file-label", text: "Judgment, in the markdown" }),
    h("pre", { class: "file", text: row.l1Text + "\n" + row.skill.body })
  ];
  row.resources.forEach((resource) => {
    const title = resource.opened
      ? "Precision, in the file · opened"
      : "Precision, in the file · not loaded";
    blocks.push(h("p", { class: "file-label", text: title }));
    if (resource.opened) {
      blocks.push(h("pre", { class: "file", text: resource.content }));
    } else {
      blocks.push(h("p", { class: "hint", text: resource.path + " stays out of context. " + resource.reasonClosed }));
    }
  });
  return h("article", { class: "skill-card opened" }, blocks);
}

function ruleBlocks(result) {
  if (!result.query) {
    return [h("p", { text: "No request yet. When one matches, a skill that needs an exact step will show the file it points at. A skill that is only a judgment will stop at the markdown." })];
  }
  if (!result.active.length) {
    return [h("p", { text: "No skill body is open, so there is no script to run. On a request that matches, decisions stay in the markdown, and an exact step is a file the body names." })];
  }
  return result.active.map((row) => {
    const pieces = [h("p", { text: row.skill.name + ". Judgment in the markdown: " + row.skill.judgment })];
    if (!row.resources.length) {
      pieces.push(h("p", { text: "There is no script. The work is the judgment, so the body is the whole skill." }));
    }
    row.resources.forEach((resource) => {
      if (resource.opened) {
        pieces.push(h("p", { text: "Precision in the file " + resource.path + " (+" + fmt(resource.tokens) + " tokens). " + resource.reasonOpen }));
      } else {
        pieces.push(h("p", { text: resource.path + " is the exact step, and this request leaves it closed. " + resource.reasonClosed }));
      }
    });
    return h("article", { class: "skill-card" }, pieces);
  });
}

function folderBlock(row) {
  const skill = row.skill;
  const tree = [skill.name + "/", "├── SKILL.md"].concat(skill.resources.map((resource, index) => {
    const last = index === skill.resources.length - 1;
    return (last ? "└── " : "├── ") + resource.path;
  }));
  if (!skill.resources.length) tree[1] = "└── SKILL.md";
  const state = row.active ? "Body open" : "Catalog only";
  const resourceState = row.resources.some((resource) => resource.opened) ? "File open" : "";
  return h("details", { class: "folder", "data-skill": skill.name }, [
    h("summary", {}, [
      h("h3", { text: skill.name }),
      h("span", { class: "badge " + (row.active ? "open" : "closed"), text: state }),
      resourceState ? h("span", { class: "badge open", text: resourceState }) : null,
      h("span", { class: "badge", text: fmt(row.l1) + " catalog tokens" })
    ]),
    h("div", { class: "inside" }, [
      h("p", { class: "blurb", text: skill.description }),
      h("pre", { class: "tree", text: tree.join("\n") }),
      h("p", { class: "hint", text: row.active ? "Loaded for this request. Body " + fmt(row.l2) + " tokens." : "You can read the body here. The agent has not loaded it." }),
      h("p", { class: "file-label", text: "SKILL.md" }),
      h("pre", { class: "file", text: row.l1Text + "\n" + skill.body })
    ].concat(skill.resources.map((resource) => {
      const live = row.resources.filter((item) => item.path === resource.path)[0];
      return h("div", {}, [
        h("p", { class: "file-label", text: resource.path + (live && live.opened ? " · in context" : " · on disk") }),
        h("pre", { class: "file", text: resource.content })
      ]);
    })))
  ]);
}

function lineList(rows) {
  return h("div", {}, rows.map((row) => h("div", { class: "catalog-line" }, [
    h("span", { text: row.label }),
    h("span", { class: "num", text: row.value })
  ])));
}

function paintOutcome(scroll) {
  const query = document.getElementById("request").value;
  const result = analyze(query);
  const scale = result.monolithic.total || 1;

  const verdictLine = document.getElementById("verdict-line");
  verdictLine.textContent = verdict(result);

  const explanation = document.getElementById("explanation");
  explanation.replaceChildren();
  explain(result).forEach((text) => explanation.append(h("p", { text })));

  const dumpLines = [
    { label: "Level 1 · 12 frontmatters", value: fmt(result.monolithic.l1) },
    { label: "Level 2 · 12 bodies", value: fmt(result.monolithic.l2) },
    { label: "Level 3 · " + plural(fileCount(result), "bundled file"), value: fmt(result.monolithic.l3) }
  ];
  document.getElementById("budgets").replaceChildren(
    budgetCard("dump", "Monolithic dump", result.monolithic, scale, dumpLines),
    budgetCard("progressive", "Progressive disclosure", result.progressive, scale, progressiveLines(result))
  );

  document.getElementById("meter-note").textContent = "The bars share one scale: the dump. Token counts are characters divided by " + CHARS_PER_TOKEN + ", rounded. A model tokenizer will land nearby, not on these integers. A runtime can execute a script and keep only its output, which is smaller than the source. This page charges the file when the agent opens it, so the Level 3 step is visible. The dump total is the same on every request, including startup.";

  const closed = result.skills.length - result.active.length;
  document.getElementById("opened-hint").textContent = result.active.length
    ? plural(closed, "skill") + " stayed at Level 1. Their bodies were not added."
    : "All 12 skills stayed at Level 1.";

  const activated = document.getElementById("activated");
  activated.replaceChildren();
  if (!result.active.length) {
    activated.append(h("p", { class: "hint", text: result.query ? "Nothing to open. The catalog is the whole skill context." : "Type a request, or pick one, to open a body." }));
  } else {
    result.active.forEach((row) => activated.append(skillCard(row)));
  }

  const still = document.getElementById("still-closed");
  still.replaceChildren();
  const closedRows = result.skills.filter((row) => !row.active);
  if (closedRows.length && result.active.length) {
    still.append(h("p", { class: "hint", text: "Still at Level 1" }));
    still.append(h("div", { class: "chips" }, closedRows.map((row) => h("span", { class: "chip", text: row.skill.name }))));
  }

  document.getElementById("catalog-lines").replaceChildren(lineList(result.skills.map((row) => ({
    label: row.skill.name + ": " + row.skill.description,
    value: fmt(row.l1) + " tokens"
  }))));

  const dumpRows = [];
  result.skills.forEach((row) => {
    dumpRows.push({ label: row.skill.name + "/SKILL.md frontmatter", value: fmt(row.l1) });
    dumpRows.push({ label: row.skill.name + "/SKILL.md body", value: fmt(row.l2) });
    row.resources.forEach((resource) => {
      dumpRows.push({ label: row.skill.name + "/" + resource.path, value: fmt(resource.tokens) });
    });
  });
  dumpRows.push({ label: "Dump total", value: fmt(result.monolithic.total) });
  document.getElementById("dump-lines").replaceChildren(lineList(dumpRows));

  document.getElementById("rule-apply").replaceChildren.apply(
    document.getElementById("rule-apply"),
    ruleBlocks(result)
  );

  const openFolders = new Set();
  document.querySelectorAll("details.folder[open]").forEach((node) => openFolders.add(node.dataset.skill));
  const catalog = document.getElementById("catalog");
  catalog.replaceChildren();
  result.skills.forEach((row) => {
    const block = folderBlock(row);
    if (openFolders.has(row.skill.name)) block.open = true;
    catalog.append(block);
  });

  if (scroll) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("outcome").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
}

function syncPresets() {
  const query = document.getElementById("request").value.trim();
  document.querySelectorAll("#presets button").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.request === query ? "true" : "false");
  });
}

function boot() {
  const fails = lessonsHold();
  const error = document.getElementById("lesson-error");
  if (fails.length) {
    error.hidden = false;
    error.textContent = "Teaching checks failed: " + fails.join("; ") + ". The counts on this page are not the ones the copy describes.";
  }

  document.getElementById("presets").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-request]");
    if (!button) return;
    document.getElementById("request").value = button.dataset.request;
    syncPresets();
    paintOutcome(true);
  });
  document.getElementById("request").addEventListener("input", () => {
    syncPresets();
    paintOutcome(false);
  });
  document.getElementById("run").addEventListener("click", () => paintOutcome(true));

  syncPresets();
  paintOutcome(false);
}

globalThis.__skillsLessons = lessonsHold;
globalThis.__skillsAnalyze = analyze;
globalThis.__skillsEstimate = estimateTokens;

if (typeof document !== "undefined") boot();
