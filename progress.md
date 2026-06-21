Original prompt: Restore "The Engagement Button", remove the displayed follower-chance percentage, enlarge tap reactions, and move the first Creator Studio unlock from 400 Followers to about 25.

- Implemented: three-line "THE / ENGAGEMENT / BUTTON" label; removed percentage display; enlarged and lengthened tap reactions.
- Implemented: Creator Studio now unlocks at 25 total Followers; catalog, dev preset, economy spec, UI spec, and onboarding pacing spec updated together.
- Fixed the onboarding simulator to consume the shared Studio threshold/rewards instead of retaining a hard-coded 400-Follower gate.
- Verified: rhythm/onboarding tests pass through the direct Node loader fallback; typecheck and production build pass.
- Verified at 390x844: fresh-player button visibly reads THE / ENGAGEMENT / BUTTON, enlarged reaction is legible, the post-teach goal reads REACH 25 FOLLOWERS, and browser console has no warnings/errors.
- Onboarding simulation: Studio reveal is 0.6m at 3 taps/sec; rhythm remains inside its 22–32m median target.
- Remaining: commit, push, production deploy, and live alias verification.
