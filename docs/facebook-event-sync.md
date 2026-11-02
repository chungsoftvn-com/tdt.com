# Facebook gallery: event-driven rollout

Status: implementation prepared; NOT connected to the live Page until all checks below pass. No six-hour schedule.

Pipeline: Meta Page feed webhook → loopback Node receiver behind HTTPS → repository_dispatch → Sync Facebook feed → Build & Deploy.

1. Keep Page ownership with TodayTourist. Configure a Meta app with Page feed webhook access; verify required permissions in the app dashboard (Page read permissions and pages_manage_metadata for subscriptions, subject to Meta review).
2. Store FB_PAGE_ID and FB_PAGE_TOKEN as GitHub Actions repository secrets. Never put tokens in JSON, commits, screenshots, or chat.
3. On the VPS, deploy site/scripts/facebook-webhook.mjs using Node 22+ under a dedicated non-root service account. Store FB_VERIFY_TOKEN, FB_APP_SECRET, FB_PAGE_ID and GITHUB_DISPATCH_TOKEN in a service environment file readable only by that account. The dispatch token must be restricted to this repository with Contents write access; receiver only calls the dispatch endpoint.
4. Reverse-proxy a dedicated HTTPS path /facebook-webhook to 127.0.0.1:8787. Do not expose the Node port directly. Set request-body limit 256KB and TLS. DNS/TLS and the receiver service are not configured by this commit.
5. Register the exact HTTPS callback URL and verify token in Meta. Subscribe the app to the Page feed. Do not remove existing Messenger subscriptions.
6. Run Sync Facebook feed manually on main for the initial gallery. Publish one real test Page post with an image. Verify signed delivery, successful Actions run, deployed image and permalink. A text-only post triggers a refresh but does not invent an image.
7. Repeat delivery of the same event: gallery should not generate a duplicate commit. Invalid signature, unrelated Page, and comments must not trigger a sync.

Behaviour: latest five image posts (or fewer if only fewer exist). Failed API/image requests leave committed live data unchanged; failures appear in Actions. Duplicate notifications are safe. Event arrival, GitHub queue and deployment take time; this is not a promise of zero-second updates. Monitor webhook delivery and Actions failures, and renew Page tokens when required.

References to verify at activation:
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started
- https://developers.facebook.com/docs/pages-api/webhooks-for-pages
- https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event
