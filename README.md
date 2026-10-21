# cmo. — B2B inbound marketing agent

A local MVP for B2B companies without a marketing team. The customer sets a goal, confirms company context, talks to the agent, reviews deliverables, and monitors signals that inform the next decision. The website is a source of context and a potential publishing channel.

## Run locally

Requires Node.js 22+ and npm.

```bash
npm install
cp .env.example .env.local
# Set LLM_API_KEY, APP_SECRET, and CRON_SECRET in .env.local
npm run dev
```

Open `http://localhost:3740` for the marketing site. The product and onboarding are at `http://localhost:3740/app`. Set `APP_SECRET` and `CRON_SECRET` to long, random values. The app supports the official DeepSeek endpoint or a compatible gateway through `LLM_BASE_URL` and `LLM_MODEL`.

To run recurring work in a separate process:

```bash
npm run worker
```

The worker calls `/api/cron` at startup and every six hours. `npm start` runs the production server and a worker in the same service. Use a single replica. SQLite data lives in `data/` locally. On Railway, attach a persistent volume; the app writes to `RAILWAY_VOLUME_MOUNT_PATH/ai-cmo.sqlite`. Without a volume, deployments will lose the database. The app needs changes to its database and worker setup before it can run on ephemeral functions.

`railway.json` configures the build, health check, and single replica. For a public deployment, create a **separate** Railway project and attach a volume to the service. This directory is currently linked to the `kodus-beacon` Railway project, so do not run `railway up` here without explicitly selecting a new project and environment. Set `APP_SECRET`, `CRON_SECRET`, `LLM_API_KEY`, and `GITHUB_SITE_TOKEN` on the new service. Limit the GitHub token's Contents write permission to authorized customer repositories.

## Product workflow

1. **Entry:** A visitor enters a domain and gets an initial homepage analysis before creating an account. The domain carries over to the full analysis. If the company has no website, the visitor enters its name and a short description. The choice between agent-operated and managed service is outside onboarding.
2. **Discovery and plan:** The agent reads the homepage and up to three relevant internal pages. It builds an evidence-backed company profile, lists open questions, checks basic homepage SEO elements (title, description, H1, canonical, and robots), and uses DeepSeek to propose a diagnosis and priorities. The customer can correct the profile in the product. Competitors absent from the website are labeled as hypotheses.
3. **Execution:** The agent drafts pages, articles, and social posts. The customer can request changes, approve, and publish. Rejected drafts return to the queue with feedback. SEO and GEO research items produce an evidence-backed report and a verifiable next action. Technical changes that the connector cannot make remain pending.
4. **Site setup and distribution:** The team prepares a Git repository for each customer and records its preview URL and domain. The product tracks diagnosis, build, review, and ongoing operation in the site area. The repository must contain `ai-cmo.json` and render Markdown from `content/blog` and `content/pages`, or from configured paths. Once the site is reviewed and operational, the agent commits pages and articles to Git. Deployment is configured separately; the product records the commit without claiming that the page is live. LinkedIn posts are scheduled through Post Bridge.
5. **Measurement:** Google Search Console and GA4 connect through OAuth. Semrush provides domain estimates when an API key is configured. DataForSEO samples ChatGPT mentions and citations. The legacy public site area also records its own visits and leads.
6. **Recurring loop:** The periodic cycle sends approved items to Git, reviews and sends drafts in automatic mode when the repository is configured, refreshes data, produces a weekly review, revisits the plan every 30 days, and prepares new topics.

In `managed` mode, addresses listed in `OPERATOR_EMAILS` can open those customer workspaces. Billing, team invitations, and granular permissions are not implemented yet.

## Git-backed sites and optional connections

- **GitHub:** Set `GITHUB_SITE_TOKEN` on the server with Contents write permission. An operator listed in `OPERATOR_EMAILS` configures the `owner/repo`, branch, content directory, preview URL, and domain in the site area. Validation requires `ai-cmo.json` at the repository root, for example `{ "version": 1, "contentRoot": "content" }`. The customer site must render the Markdown files and deploy from the configured branch. The product does not create the customer repository or migrate the domain automatically.
- **LinkedIn:** Connect the company's own Post Bridge key and profile. The app schedules a post after manual approval or automatic review and records it as scheduled. It does not yet check the final publication status.
- **Google:** Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. Register the exact redirect URI in the OAuth client and enable the Search Console API, Analytics Admin API, and Analytics Data API. Then select the site and GA4 property in the app.
- **Semrush:** Set `SEMRUSH_API_KEY` for domain estimates. These figures are not measured visits to the customer's site.
- **ChatGPT visibility:** Set `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` to run tracked buyer questions. The results sample responses; they do not count every ChatGPT recommendation.

Connection credentials are encrypted with `APP_SECRET` before storage in SQLite. Changing this secret on an existing installation requires migrating the stored credentials.

## Verification

```bash
npm run typecheck
npm run build
python3 scripts/qa-git-site.py
```

Development was validated with a fictional company: signup, company creation, a DeepSeek-generated plan, an article, rejection with feedback, a revised draft, and agent chat. External publishing and metrics require connected accounts. Validate them with a pilot company before using live channels.

The Git publishing QA uses a simulated GitHub API on `127.0.0.1`. It checks repository configuration, the block before the site becomes operational, and commit creation after review. A real customer setup still requires checking the repository, deployment, and published page on the customer's domain.

## Current limitations

- The audit covers the homepage and basic HTML elements; it is not a full site crawl.
- Migrating an existing site is still a manual service. The app tracks milestones and commits to a configured repository; the team handles the domain, deployment, redirects, and visual QA. The legacy public area at `/sites/<company>` remains accessible for existing links but receives no new publications.
- SEO and GEO tasks that require technical changes beyond creating content files produce research and remain pending technical actions. The agent does not yet edit existing components or pages.
- A failure between a Git commit and recording its result can leave an item in `publishing`. Check the repository before retrying to avoid duplicate commits.
- ChatGPT visibility checks through DataForSEO incur a per-query cost and depend on the external account configuration.
