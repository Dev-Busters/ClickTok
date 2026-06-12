<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. PostHog's `posthog-node` SDK has been installed in the `party` workspace and wired into both PartyKit server files (`party/src/stream.ts` and `party/src/lobby.ts`). Each server class initialises a PostHog client from `POSTHOG_API_KEY` / `POSTHOG_HOST` environment variables (read via `party.env`). User identity is tied to the Supabase-verified JWT user ID where available, and falls back to the PartyKit connection ID for guest players. `posthog.identify()` is called on first lobby connect for authenticated users, setting `handle` and `creator_level` person properties. `captureException` is wired into the `onConnect` error handlers in both files so infrastructure failures (e.g. Supabase JWT verification errors) are surfaced in PostHog's error tracking. Environment variables were written to `.env`.

| Event | Description | File |
|---|---|---|
| `stream started` | Streamer opens a new live stream room | `party/src/stream.ts` |
| `stream ended` | Streamer ends their stream; includes `grade` and `peak_viewers` | `party/src/stream.ts` |
| `viewer joined` | Spectator joins a live stream room | `party/src/stream.ts` |
| `gift sent` | Viewer sends a real gift; includes `gift_tier` and `run_sec` | `party/src/stream.ts` |
| `quick chat sent` | Viewer sends a quick-chat reaction; includes `preset` | `party/src/stream.ts` |
| `poll vote cast` | Viewer casts a vote in a live poll; includes `poll_id` and `choice_index` | `party/src/stream.ts` |
| `player connected` | Player says hello to the lobby; includes `handle`, `creator_level`, `authenticated` | `party/src/lobby.ts` |
| `lobby stream started` | Player goes live in the lobby directory; includes `topic`, `creator_level` | `party/src/lobby.ts` |
| `lobby stream ended` | Player's stream is removed from the lobby directory | `party/src/lobby.ts` |
| `score updated` | Player reports updated follower/like counts to the leaderboard | `party/src/lobby.ts` |
| `algorithm fed` | Player feeds The Algorithm; includes `kind` and `amount` | `party/src/lobby.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard:** [Analytics basics (wizard)](https://us.posthog.com/project/466966/dashboard/1703292)
- **Insight:** [Daily active players](https://us.posthog.com/project/466966/insights/xLuDl4Qg)
- **Insight:** [Streams started vs ended](https://us.posthog.com/project/466966/insights/3TpPgWnu)
- **Insight:** [Stream grades breakdown](https://us.posthog.com/project/466966/insights/VYoqqS9A)
- **Insight:** [Gifts sent by tier](https://us.posthog.com/project/466966/insights/KDyJI16V)
- **Insight:** [Algorithm engagement](https://us.posthog.com/project/466966/insights/tE6RFk87)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
