# Agent skills, progressive disclosure

**[Live demo](https://iorekforges.mattsheehan.dev/demos/2026-11-06-agent-skills-progressive-disclosure/)**

Northwind Platform's coding agent has twelve skills installed, and a dump would paste every body on every turn. Progressive disclosure keeps the name and description in context, and opens a SKILL.md only when the request matches.

## The idea in plain words

An Agent Skill is a folder. `SKILL.md` starts with YAML frontmatter: a `name` and a `description`. The folder name matches `name`. The rest of the file is the procedure. Optional `scripts/` and `references/` sit beside it for the steps that have to be exact.

Progressive disclosure is how that folder meets a context window.

Level 1 is startup. The agent reads the name and the description of every installed skill, on the order of a hundred tokens each, and leaves the body on disk. Twelve skills cost about twelve hundred tokens of catalog, not twelve full procedures.

Level 2 is the match. When a request shares a phrase with a description, the agent opens that `SKILL.md` body. The body holds the judgment: when to roll back, what an apology may admit, the order expand then backfill then contract.

Level 3 is the file the body names. A script or a reference opens only if this request needs it. A review of a migration reads the order and leaves `scripts/expand_contract.sql` closed. Cutting a release opens `scripts/preflight.sh`, because the flags are the precise step and the markdown is the decision.

That split is the line from the day's notes on the format: judgment in markdown, precision in code. A skill that needs a byte-exact action points at a script. The agent runs the file instead of paraphrasing it into new SQL, new shell, or new PDF coordinates. A skill whose work is a judgment, such as the wording of an apology, has no script. A template would pretend the apology is a form.

The same idea is why a team can keep one coding agent and install many SOPs. Invoices, SQL, postmortems, and the release checklist are skills on that agent. A new subagent for each procedure would multiply prompts and handoffs for work that is usually one folder.

Anthropic donated the format to the Agentic AI Foundation, next to MCP. The folder is portable across agents that read the spec. The disclosure tiers are in the spec and in the Claude docs: metadata at startup, instructions when the skill triggers, resources as needed.

## A business use

Northwind Platform is fictional. The engineering team keeps one coding agent in the platform repo and twelve skills under `skills/`. The skills are the repeated jobs: cutting a release, writing release notes, a customer apology, yesterday's revenue from the warehouse, a quarterly invoice PDF, an outage postmortem, pull request review, an accessibility audit, the on-call handoff, a schema migration, paid ads in the brand voice, and the agent eval harness.

The failure mode this page is about is ordinary. Someone adds a skill for every runbook, and the agent prompt grows by the whole file each time. The next request, including one that matches nothing, pays for all of them. The catalog was the part the agent needed in order to choose. The bodies were not.

A real skill is often longer than these stubs. The shape is the same. The description is the trigger. The body is the judgment. The script is the part you do not want the model to retype.

## How a team would adopt it

1. Write one `SKILL.md` for one repeated workflow. Start with the job people already ask the agent to do twice a week. The folder name is the YAML `name`. Lowercase, hyphens, no extra prose in the name.
2. Write the description as the trigger. Say what the skill does and when to use it, in the words a teammate would type: "cut a release", "write notes", "yesterday's revenue", "customer apology". That line is what startup loads. A vague "helps with releases" matches everything or nothing.
3. Keep judgment in the markdown and precision in `scripts/` or `references/`. Stop rules, tone, and order of operations stay in the body. The preflight flags, the read-only SQL guard, the PDF field map, and the postmortem headings are files the body names. Open a file when the request needs it. Leave it closed on a review or a question the body already answers.
4. Version the skill folder in git, next to the repo it serves. Review a description change the way you review code, because the description is now part of routing. Point the agent at that directory. The same folder is the SOP for any agent that reads the Agent Skills spec.

The page's toy version of the load is:

```javascript
function contextFor(skills, request) {
  var catalog = skills.map(function (skill) {
    return skill.name + ": " + skill.description;
  });
  var matched = skills.filter(function (skill) {
    return matches(skill, request);
  });
  return catalog.concat(matched.map(function (skill) {
    return skill.body;
  }));
}
```

A production loader also has to decide Level 3. This page opens a bundled file only when the request is the kind the body describes as the exact step. Running a script and keeping the stdout, rather than the source, is a further saving. The meter charges the source so you can see the file move into context.

## What the page shows

Open `index.html`. Nothing calls a model. The matcher looks for phrases that are written in each skill's name or description. It does not read a body until that skill is already open, which is the startup rule the format is built on.

The two bars share one scale, the monolithic dump.

- **Startup catalog** clears the request. Progressive disclosure holds the twelve frontmatters, about a hundred tokens each on this page's estimate (characters divided by four, rounded). The dump already includes every body and every bundled file.
- **Cut a release and write notes** opens `deploy-checklist` and `release-notes`. The preflight script opens, because the request is a ship. The sample release notes stay closed, because nobody asked for an example.
- **Who owns rollback?** opens the deploy body and leaves `scripts/preflight.sh` on disk. The answer is a judgment.
- **Review the migration PR** opens the review checklist and the migration runbook. `scripts/expand_contract.sql` stays closed. **Backfill**, if you type it, opens that file.
- **Yesterday's revenue**, **Q3 invoice**, **outage postmortem**, **accessibility audit**, and **paid ad** each open one skill and the file that skill treats as the exact step.
- **Customer apology** and **on-call handoff** open a body and no file.
- **Add an eval** opens the harness body and leaves `scripts/run_eval.py` closed. **Run the eval harness** opens the runner.
- **Cafeteria menu** matches nothing. Progressive disclosure stays on the catalog. The dump does not get cheaper.

The installed-skill list is the library. Opening a folder there is for you. It does not change the meter.

The counts are a page estimate, not a model tokenizer. The skills, the cluster name, the revenue query, and the invoice coordinates are fictional.

## How to run

Open `index.html` in a browser. No build step, no network call, no API key. The shared stylesheet is a relative path, so the page also works on the project site.

From this folder, or from the repo root:

```bash
python3 -m http.server
```

Then open the printed local URL and follow the path to `index.html`. Either way works. The page does not need a server.

## Sources

Northwind Platform and the twelve skills are made up for this demo. The disclosure tiers, the folder-name rule, and the donation are the sources below.

- [@codeswithroh](https://x.com/codeswithroh/status/2118603229533819246) — The agent reads only the name and description until a request matches. Judgment stays in the markdown. Precision goes in code.
- [@prayag_dalal](https://x.com/prayag_dalal/status/2116016261729583538) — Agent Skills are leveled. Progressive disclosure keeps a long SOP out of the prompt until it is needed.
- [@Android_user00](https://x.com/Android_user00/status/2114570550261563515) — Disclosure happens in stages, and the folder name has to match the name in the YAML.
- [@RestrainedDepth](https://x.com/RestrainedDepth/status/2116545376912286152) — Anthropic donated Agent Skills to the Agentic AI Foundation. The folder is a portable SOP.
- [@Arindam_1729](https://x.com/Arindam_1729/status/2114696945772249550) — One agent plus skills, loaded as the request needs them, rather than a subagent for every procedure.
- [Agent Skills specification](https://agentskills.io/specification) — The open spec. Metadata, then instructions, then resources, are the disclosure tiers.
- [agentskills/agentskills](https://github.com/agentskills/agentskills) — The open format repository.
- [Anthropic, donating Agent Skills](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation) — The format moves to the Agentic AI Foundation, next to MCP.
- [Claude, Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — Level 1 metadata at startup, Level 2 instructions when a skill triggers, Level 3 resources as needed.
- [Building agents with skills](https://claude.com/resources/articles/building-agents-with-skills-equipping-agents-for-specialized-work) — Progressive disclosure so many skills can be installed without filling the window.
