# Write Up

## Decisions and trade-offs
I used FastAPI and aiohttp on the backend, React/Vite on the frontend, and flat files under backend/snapshots.
- I crawled only the same host to avoid unbounded crawls.
- I used depth-limited BFS with a max_pages cap to keep runtime low and avoid crashing. The max_pages could be adjusted for larger websites if necessary.
- I rewrote anchors, images, scripts, and styles to local paths so snapshots load the same offline, and I skipped JS because it is heavy and slow.
- I mounted and archived the saved files so the viewer can load them directly, which is simpler, faster, and more reliable.
- I generated a crawl graph using BFS to visualize how the pages link together.

## What I would do with more time

### Differences Page:
- I would build a differences page that shows changes in structure, images, and text with inline highlights for snapshots made at different times.
- I would add a URL map diff that shows added, removed, and changed pages.

### Graph Improvement:
- I would improve the graph with hover focus to highlight direct parent and child connections and dim others.
- I would add the ability to collapse or expand by directory segment (for example, /docs/*).
- I would add search and jump to paths, zoom and pan, pin nodes, and render top-N nodes with a “show more” control.

# Completeness:
- I would add tests (Playwright?) to increase confidence in the crawler and UI.
- I would add a scheduler for automatic weekly or cron-style recaptures, using cronjobs with Helm and Kubernetes for hands-off operation. Note: Infrastructure background is required to set this up.

## How I would scale this for production use
- I would move crawls to background workers with a queue (Redis with RQ, Celery, or a simple asyncio queue) so a worker writes files and updates status while the API enqueues and returns a job, which allows parallel crawls.
- I would enforce a timeout limit and a maximum file size, especially for images and videos, to maintain speed.
- I would store assets in S3 instead of local storage because it is cheap and easy. Also, for cost and space efficiency, I would set a storage lifecycle to expire websites after a period or transition them to a colder S3 tier.
- I would add structured logs, metrics, tracing, and dashboards to monitor storage growth and failure rates.
- I would review data ownership and privacy boundaries to ensure compliance and portability.
- I would add safeguards to avoid crawling malicious websites.
- I would restrict destructive actions so only authorized users can remove all snapshots, using IAM or another admin control.
