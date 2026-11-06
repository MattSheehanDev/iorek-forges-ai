# WebMCP storefront

**[Live demo](https://iorek.mattsheehan.dev/demos/2026-11-03-webmcp-storefront/)**

Alpine Outfitters registers catalog and cart tools on the open page, and a scripted shopping agent calls them. Next to it, a DOM scraper reads CSS classes, takes more steps, and returns the wrong shoe after a layout change.

## The idea in plain words

WebMCP is a proposed web standard that lets a page register JavaScript tools with the browser. An agent co-browsing that tab discovers the tools and calls them with structured arguments, then gets structured data back. It does not have to scrape the DOM or pretend to click through the layout.

This is not server-side MCP. MCP is how an agent calls tools on a backend the company hosts, often with no shopper looking at that session. WebMCP stays in the tab. The human still sees the cart, can take over, and confirms anything that spends money. Shopify, Google, and Microsoft have been shaping the proposal. Chrome ships it as an origin trial: the page talks to `document.modelContext`. The calls the trial documents are `registerTool`, `getTools`, and `executeTool`. A storefront's real job is `registerTool`. `getTools` and `executeTool` exist for an in-page agent or a test. This demo calls them because the shopping agent is simulated in the page, so you can see the round trip with no key and no network.

Shopify already registers tools on Liquid storefronts and on Hydrogen storefronts that load the current scripts. Names in the current docs include `search_catalog`, `get_product`, `get_cart`, `add_to_cart`, `update_cart_lines`, `proceed_to_checkout`, `get_checkout`, and `complete_checkout`. Checkout registers its own set, so the list changes when the shopper leaves the storefront. The August 2026 changelog used a single `update_cart`. The demo keeps that one cart-write name so the log stays short. The description on the tool says what Shopify's docs call the split.

On this page the shelf is only a list. It has no drop filter and no price filter. `search_catalog` takes `max_price`, `max_drop_mm`, `category`, and `trail`. That is the gap Yoav Weiss points at: a shopper who wants trail shoes with a drop of 5mm or less should not have to open every product while an agent squints at the markup.

## A business use

Any site that takes an order, a booking, or a payment will get agents that try to drive the page. The screenshot path is a vision model looking at pixels, or a script walking CSS selectors and synthesizing clicks. Both are slow, and both break when someone renames a class. Cited comparisons, from Yoav Weiss's write-up of work on Shopify's tools: nekuda.ai measured WebMCP at about 2.5–7.5× faster and up to 47× cheaper than other direct page interaction, and Shopify's Checkout team measured 2.7× faster, 58% cheaper, and 60/60 successful attempts against 56/60 for browser automation.

The practical version is a store (or a bank, an airline, a clinic portal) that registers the same actions its own frontend already trusts: search, read a record, change the cart or the booking, start checkout. The shopper brings the agent they already use. The merchant does not have to host that agent's model. The merchant does have to decide which actions exist, and which of them require a human yes.

## How a team would adopt it

1. Register tools for the actions the page can already perform, with a name, a short description of when to call it, and a JSON Schema `inputSchema`. Check the arguments inside `execute`. The browser does not validate them for you, and it does not fill in defaults.
2. Return the fields the agent should decide on as structured data. Put marketing copy, reviews, and other merchant prose in the text channel, and treat that text as untrusted. A product note can tell the agent to add a different item for $0. This page includes one of those notes on the Ridgeform shoe. The WebMCP agent quotes it and does not follow it.
3. Keep the buyer in the loop for money. `proceed_to_checkout` may prepare the checkout. `complete_checkout` on this page fails until the person presses Confirm purchase. Do not give the agent a private flag that skips that press.
4. Leave the human UI in place. Tools are a second way in, not a hidden catalog. When the layout changes, the selectors move and the tools do not. The redesign toggle on this page is that regression, shrunk to one button.
5. Do not put session tokens in tool arguments. The tab's own session is the authority. If the server needs to tell a shopper's agent from a hostile bot, sign the browser traffic (Shopify points at Web Bot Auth) instead of trusting a string the model typed.
6. If the tool list changes between pages, as Shopify's does between the storefront and checkout, refresh it when the browser fires `toolchange`.

## What the page shows

The shop is Alpine Outfitters, ten fictional products, nothing for sale. The request box starts as "Trail shoes under $140 with drop ≤ 5mm". Catalog truth for that sentence is the Ridgeform Trail Runner ($128, drop 4mm, 248g) and the Summit Stride Low ($136, drop 5mm, 276g). The Moraine Racer is lighter, and it costs $142, so it is out. The Switchback Approach is $119, and its drop is 6mm, so it is out.

- **Run scrape agent** walks `.product-card`, `.js-price`, `.js-drop`, `.js-add`, and `.js-checkout`. One step per card.
- **Run WebMCP agent** calls `getTools`, then `executeTool` with those arguments. Search is one call.
- **Run both** runs the scrape agent first, then the WebMCP agent, on the same cart.
- **Redesign the layout** renames those classes. The card still shows the real drop and the real price, in a different order: the struck-through "was" price comes first, and the first "mm" in the spec line is lug depth. The scraper takes those two numbers. For the default request it keeps the Switchback and drops the two shoes that actually match. The tools still read the catalog.
- Poles under $90 still succeed after the redesign, because that card has a single price and no millimeter figure. The failure is specific to the brittle read, not a blanket outage.
- **Add the lightest match** sets the cart through `.js-add` or through `update_cart`. The lightest match inside the cap is the Ridgeform, not the poisoned instruction's shell.
- **Check out** calls `proceed_to_checkout` or clicks `.js-checkout`, then stops. Confirm purchase is the only control that calls `complete_checkout`, and only after that click arms it. An empty cart is refused.
- The metrics strip counts steps and a modeled time: 1.6s of overhead, plus 0.45s per DOM read, 0.65s per guessed read, 0.7s per missed selector, and 0.12s per tool call. On the default request that lands near 3.6×. It is a model so the step gap has a number. It is not a stopwatch on this page, and it is not the Shopify Checkout measurement.
- The registry is the live list from `getTools()`. The small form under it calls `executeTool` with whatever JSON you type, including a `complete_checkout` that should fail before you confirm.

If this browser already has `document.modelContext`, the shop registers on that object. Otherwise the page installs a polyfill with the same three methods. `executeTool` here accepts a plain object. Chrome 153 wanted a JSON string and failed on objects ("Failed to parse input arguments"); Chrome 155 takes an object. The demo retries with a string if it sees that error.

## How to run

Open `index.html` in a browser. It has no build step, no network calls, and no API key. The shared stylesheet is a relative path, so the page also works on the project site.

From this folder, or from the repo root:

```bash
python3 -m http.server
```

Then open the printed local URL and follow the path to `index.html`. Either way works; the page does not need a server.

## Sources

The shop, the products, the poisoned brand note, and the modeled step times are made up for this demo. The API shape and the published speed and cost figures are not.

- Shopify, [WebMCP tools](https://shopify.dev/docs/api/web-mcp). Storefront and checkout tools, `document.modelContext.getTools()` and `executeTool()`, and the warning to treat merchant text in tool results as data.
- Shopify changelog, [WebMCP support for Liquid and Hydrogen storefronts](https://shopify.dev/changelog/posts/webmcp-liquid-hydrogen) (5 August 2026). Tools on by default, shaped with Google and Microsoft, Chromium origin trial.
- Yoav Weiss, [Why WebMCP matters](https://blog.yoav.ws/posts/why_webmcp_matters/) (12 October 2026). Co-browsing versus backend MCP, the 2.5–7.5× and Checkout 2.7× / 58% / 60-of-60 figures, and the trail-shoe drop example this shop borrows.
- Chrome, [WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api). `registerTool`, `getTools`, `executeTool`, and the note that JSON-string arguments are deprecated from Chrome 155.
- Chrome, [WebMCP origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial). Early access in Chrome 149.
- Posts that pointed at the topic: [Idan Levin](https://x.com/0xidanlevin/status/2117335844092522580), [Lance Fang](https://x.com/lancefang7/status/2117424029598413202), [iCleanAI](https://x.com/iCleanAI/status/2115339610138300475), and the [Shopify WebMCP trend](https://x.com/i/trending/2117374170484908461).
