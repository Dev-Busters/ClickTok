Original prompt: Restore "The Engagement Button", remove the displayed follower-chance percentage, enlarge tap reactions, and move the first Creator Studio unlock from 400 Followers to about 25.

- Implemented: three-line "THE / ENGAGEMENT / BUTTON" label; removed percentage display; enlarged and lengthened tap reactions.
- Implemented: Creator Studio now unlocks at 25 total Followers; catalog, dev preset, economy spec, UI spec, and onboarding pacing spec updated together.
- Fixed the onboarding simulator to consume the shared Studio threshold/rewards instead of retaining a hard-coded 400-Follower gate.
- Verified: rhythm/onboarding tests pass through the direct Node loader fallback; typecheck and production build pass.
- Verified at 390x844: fresh-player button visibly reads THE / ENGAGEMENT / BUTTON, enlarged reaction is legible, the post-teach goal reads REACH 25 FOLLOWERS, and browser console has no warnings/errors.
- Onboarding simulation: Studio reveal is 0.6m at 3 taps/sec; rhythm remains inside its 22–32m median target.
- Release verified: GitHub `main` and the Vercel production alias were updated after gameplay QA.
- TODO: none for this request.

Follow-up prompt: Improve Creator Studio legibility, distinguish unlocking a new bonus from leveling it, show Engagement progress when Engagement Rate appears, and lower the first Studio gate to 20 Followers.

- Implemented: high-contrast 13px+ Studio copy and opaque cards; gold NEW BONUS / UNLOCK BONUS states versus cyan LEVEL N / LEVEL UP states.
- Implemented: Engagement meter appears and fills after Audience Reach Lv1 introduces Engagement Rate; TAP THREE launch remains locked to its later goal.
- Implemented: first Studio gate lowered to 20 Followers across balance, QA preset, simulation inputs, and specs.
- Verified at 390x844: both Studio card states are legible and distinct; returning Home shows 0 / 100 and one TEB tap advances it to 1 / 100; no browser warnings/errors.
- Verified: typecheck, production build, rhythm/onboarding tests, and onboarding pacing simulation pass.
- TODO: none for this follow-up.

Follow-up prompt: Show the footer navigation from the start, enable only Profile initially, and expose the reset button there for testing.

- Implemented: persistent opening footer with Profile as the sole enabled nav destination.
- Implemented: compact early Profile with available stats, account/reset controls, and Back to Engagement.
- Implemented: Profile remains visually bright before selection while all four unavailable destinations are dimmed and disabled.
- Verified at 390x844: fresh Home shows the footer; Profile opens; reset is visible; Back to Engagement returns to TEB; no browser warnings/errors.
- Verification gates: typecheck, build, rhythm tests, and onboarding tests pass.
- TODO: none for this follow-up.
