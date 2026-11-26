# The hosted Claude proxy

GitHub Pages serves the game; this Cloudflare Worker holds the Anthropic key and calls Claude for it,
just as `server.js` does locally. It only accepts the game's own prompts, and it caps spending per
visitor and for the whole site per day (see `wrangler.toml`). When a budget is spent the game simply
plays offline.

## Deploy (once)

```sh
cd worker
npx wrangler login                          # opens Cloudflare in your browser
npx wrangler kv namespace create BUDGET     # paste the id into wrangler.toml
npx wrangler secret put ANTHROPIC_API_KEY   # paste your key when asked
npx wrangler secret put OWNER_TOKEN         # any secret phrase: ?owner=<it> skips the budgets
npx wrangler deploy                         # prints https://spymaster-api.<you>.workers.dev
```

Then put that URL in `index.html` (`<meta name="mr-api" content="...">`), commit and push. GitHub
Pages picks it up in a minute or two.

## Update

`npx wrangler deploy` again after changing `worker/`, `api/models.js` or `js/prompts.js` (the
Worker only accepts the prompts it was deployed with).
