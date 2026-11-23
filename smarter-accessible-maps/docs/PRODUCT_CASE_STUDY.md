# Wayfinder: Smarter & More Accessible Navigation
## Product Management Case Study

**Project type:** Independent product concept and interactive prototype  
**Product inspiration:** Google Maps  
**Role demonstrated:** Product thinking, problem framing, MVP definition, prioritization, prototyping and measurement planning  
**Status:** Concept prototype — not affiliated with Google

---

## 1. Executive summary

Wayfinder explores a focused improvement to route planning: help travelers compare routes not only by estimated time, but also by transfers, walking distance and accessibility information confidence. The concept gives users preference controls and makes uncertainty visible rather than labeling a route “accessible” when important attributes are unknown.

The prototype includes editable trip inputs, preference toggles, route comparison cards, a route-detail view, journey preview, saved journeys and an accessibility issue-reporting flow. Place lookup and driving estimates use Photon and the public OSRM demo service; safety, traffic and accessibility attributes remain unverified.

## 2. Problem framing

### Problem statement

People with mobility needs, temporary injuries, caregivers and other travelers may need to evaluate more than the fastest route. A route can look optimal by time while containing stairs, long walks, uncertain lifts or difficult transfers. If those trade-offs are hidden or difficult to compare, people may be forced to leave the app, call operators or discover barriers after starting the trip.

### Target users to investigate

- Wheelchair users and people who need step-free routes.
- People with temporary mobility constraints, luggage or strollers.
- Older adults and caregivers planning journeys for someone else.
- Public-transport commuters who value predictable transfers and shorter walks.

These are research segments to validate, not claims about completed interviews.

### Jobs to be done

“When I plan a journey, help me understand which route best fits my mobility and comfort needs, so I can make an informed choice before I leave.”

## 3. Research foundation and evidence

This concept is grounded in public Google Maps accessibility guidance and Google Research work. It is not based on private Google materials.

1. **Google Maps accessibility help:** Google documents wheelchair-accessible transit route options and accessibility attributes for places in supported regions. It also documents screen-reader support and detailed voice guidance. This indicates that accessibility capabilities already exist; the product opportunity should be framed around discoverability, comparison, freshness and confidence, not pretending these features do not exist.
   - https://support.google.com/maps/answer/6396990?hl=en
   - https://support.google.com/accessibility/answer/6396990?co=GENIE.Platform%3DAndroid&hl=en-IN
2. **Google Research — Behind the Scenes of Google Maps Navigation: Enabling actionable user feedback at scale (CHI 2010):** Describes a structured feedback mechanism for real-world navigation prototypes, feedback triage and learning from field use. This informs the issue-reporting and feedback-loop concept.
   - https://research.google/pubs/behind-the-scenes-of-google-maps-navigation-enabling-actionable-user-feedback-at-scale/
3. **Google Design — People, Products, and Epiphanies:** Describes field research in different environments, including India, and involving product managers, engineers and designers in observing real navigation contexts. This informs the recommendation to conduct field research rather than relying only on desk research.
   - https://medium.com/google-design/people-products-and-epiphanies-bfed0f3fbb2d
4. **Existing independent Google Maps portfolio examples:** Useful as examples of case-study storytelling and feature framing, but not evidence that Google endorsed or selected the work.
   - https://www.raveena-dhegaskar.com/google-maps
   - https://www.olivianelson.design/googlemaps-case-study

### Important source limitation

The user supplied a GitHub case-study folder as a reference. Automated access to that GitHub page was blocked in this environment, so this prototype does not claim to have read or reproduced that folder's contents. The supplied link is retained here for manual comparison:
https://github.com/gaurav-product/product-management-case-studies/tree/main/Case%20Studies/Day-11-Google-Maps

### Research gaps before making product claims

- Conduct interviews and contextual observations with target users.
- Audit existing Google Maps accessibility flows in the actual target market.
- Check coverage and freshness of station, stop, lift, ramp, sidewalk and crossing data.
- Review competing navigation products and local transit operator information.
- Validate the language people use to describe “step-free”, “accessible” and “verified”.

No interviews, usability tests, live data audits or impact measurements are claimed as completed in this project.

## 4. Product opportunity and hypothesis

**How might we help travelers choose routes that fit their mobility and comfort needs by making accessibility attributes and uncertainty easier to compare?**

**Hypothesis:** If route options expose user-selected preferences, walking distance, transfers and confidence in accessibility attributes, then users will be better able to select a route that fits their needs and feel more prepared before departure.

This is a hypothesis to test, not a proven result.

## 5. Product principles

1. **Do not overclaim:** Unknown or stale access information must not be presented as confirmed accessible.
2. **Make uncertainty visible:** Show last-verified time, data source and confidence when production data exists.
3. **User-defined trade-offs:** People should choose what matters; there is no single universal “best route”.
4. **Accessible by default:** Support keyboard navigation, screen readers, clear labels, sufficient contrast and reduced motion.
5. **Close the feedback loop:** Reports need moderation, verification and status updates — not just a submission button.

## 6. MVP scope

### Included in this prototype

- React/Vite frontend with origin and destination inputs, swap action and quick destinations.
- FastAPI REST endpoints for Photon place lookup, OSRM road routing, preferences, saved journeys and community reports.
- PostgreSQL persistence for preferences, journeys and unverified community reports; PostGIS is enabled with an optional report location field.
- Route selection and route detail steps, with driving estimates from OSRM.
- Map visual emphasis and zoom/layer interactions.
- Journey preview, saved journeys and delete action; previously synced journey details are cached locally for offline reference.
- Accessibility and road issue reporting; reports persist as unverified submissions.
- Product concept page explaining problem, hypothesis, MVP and principles.

### Explicitly out of scope

- Live GPS or turn-by-turn navigation.
- Live traffic, transit arrivals, service alerts or fare calculations.
- Real-time station/stop accessibility verification.
- Authentication, production-grade identity/authorization, or a production backend.
- AI-generated route recommendations.

## 7. Prioritization (illustrative RICE)

Scores below are directional planning assumptions, not research-derived estimates. Reach, impact, confidence and effort must be recalibrated after user research and engineering discovery.

| Feature | Reach (1–5) | Impact (1–3) | Confidence (1–5) | Effort (person-weeks) | RICE (R×I×C/E) | Priority |
|---|---:|---:|---:|---:|---:|---|
| Route comparison by time / walk / transfers | 5 | 3 | 4 | 2 | 30.0 | P0 |
| Step-free preference and uncertainty labels | 4 | 3 | 3 | 2 | 18.0 | P0 |
| Accessibility issue reporting | 3 | 2 | 3 | 2 | 9.0 | P1 |
| Saved journeys | 3 | 1 | 4 | 1 | 12.0 | P1 |
| Covered-walk preference | 2 | 1 | 2 | 3 | 1.3 | P2 |
| Crowd-aware routing | 3 | 2 | 1 | 8 | 0.75 | Later |

## 8. Product requirements (condensed PRD)

### User stories and acceptance criteria

**Story A — Compare routes**  
As a traveler, I want to compare route time, transfers and walking distance so that I can choose a route that suits my trip.
- Given a valid origin and destination, show multiple route options.
- Each option shows estimated duration, walking distance and transfers.
- Selecting an option updates the detail panel and selected-state treatment.

**Story B — Set mobility preferences**  
As a traveler, I want to express step-free and other preferences so that route results reflect what matters to me.
- Preference controls are keyboard-operable and clearly labeled.
- Changing preferences updates the route ordering or explanatory state.
- Unknown accessibility attributes remain explicitly unknown.

**Story C — Understand route details**  
As a traveler, I want to inspect route steps and access notes before departure.
- Selected route displays ordered journey steps.
- Each access claim includes an appropriate confidence or verification status in a production version.
- The prototype clearly warns that route data is illustrative.

**Story D — Report a barrier**  
As a traveler, I want to report an incorrect or missing accessibility attribute.
- User can choose a barrier type, place and optional notes.
- Submission confirms the report was stored in the prototype database.
- A production system must add moderation, deduplication, privacy controls and a status loop.

**Story E — Save a journey**  
As a traveler, I want to save a route for later.
- Journey preview summarizes route, time, walking distance and indicative fare.
- Save action stores a route in PostgreSQL and caches the synced details locally for offline reference.
- Saved journey can be removed.

## 9. Success metrics and guardrails

### North Star candidate

**Successful informed route selections per active route-planning user** — a selection where a user chooses a route after viewing relevant route attributes and completes the intended planning task. This requires a carefully defined event and should be validated with research.

### Supporting metrics

- Route comparison completion rate.
- Time to choose a route.
- Percentage of route planners who inspect access details.
- Task success rate in moderated usability tests.
- Self-reported confidence that the selected route fits the user's needs.
- Accessibility report verification rate and time to resolution.

### Guardrail metrics

- Rate of users encountering an accessibility mismatch after choosing a route.
- False-positive rate for step-free/accessibility claims.
- Route abandonment after seeing uncertainty information.
- Screen-reader and keyboard task completion gaps.
- Privacy complaints or inappropriate location-data retention.

Avoid optimizing clicks on accessibility labels alone; the goal is better-informed, safer decisions, not more UI interaction.

## 10. Experiment plan

**Prototype usability test:** Recruit 8–12 participants across the target segments. Ask them to plan a journey with a step-free preference, compare two alternatives and explain their choice. Observe task completion, confusion, trust calibration and whether uncertainty is understood.

**A/B test (only after data correctness and accessibility review):** Compare the existing route presentation with a preference-led comparison treatment. Primary outcome: successful informed route selection. Guardrails: accessibility mismatch reports, abandonment and task time. Segment results carefully; do not pool different access needs in a way that hides harm.

## 11. Roadmap

| Phase | Focus | Exit criteria |
|---|---|---|
| 0 — Discover (1–2 weeks) | Interviews, field observation, competitor audit, current-flow review | Validated problem, prioritized segments and baseline task insights |
| 1 — Prototype (1–2 weeks) | Test route comparison, preference language and confidence cues | Usability issues resolved; users understand unknown vs verified data |
| 2 — Data pilot (4–6 weeks) | One city / transit corridor, operator data partnerships, verification pipeline | Audited coverage and freshness; safe escalation and correction process |
| 3 — Controlled launch (4–8 weeks) | Limited rollout, analytics and support operations | Guardrails within thresholds; measurable improvement in informed selection |
| 4 — Scale | More cities, route modes and localized access attributes | Reliable coverage, operations capacity and evidence of sustained user value |

## 12. Risks and mitigations

- **Incorrect accessibility information:** Use provenance, timestamps, confidence states and human verification; never equate missing data with accessible.
- **Uneven geographic coverage:** Launch narrowly, communicate coverage boundaries and avoid ranking regions unfairly due to missing data.
- **Privacy in issue reports:** Collect the minimum needed, offer optional detail, redact personal information and define retention.
- **Route complexity:** Progressive disclosure; show the most decision-useful attributes first.
- **Stale crowd / lift status:** Separate static infrastructure attributes from live operational status and label each appropriately.
- **Overfitting to one persona:** Include diverse users and allow preferences to be customized.

## 13. What is unique in this concept

- Treats accessibility as a route-comparison dimension rather than a hidden filter.
- Makes trade-offs between time, walking distance, transfers and access information explicit.
- Treats uncertainty as a product design requirement: unknown is not the same as accessible.
- Includes a feedback-reporting loop as part of the experience.
- Adds a portfolio-ready product narrative, MVP, PRD, prioritization, metrics, experiments and roadmap alongside the clickable prototype.

## 14. What would make it materially better

1. Conduct and document real user interviews; include anonymized quotes only with consent.
2. Test the prototype with assistive technologies and participants with lived experience.
3. Build a small, verified local dataset for one transit corridor before connecting a live routing API.
4. Add source, last-verified timestamp and confidence on every accessibility attribute.
5. Integrate actual Google Maps Platform or another licensed routing API only after reviewing pricing, terms, coverage and technical constraints.
6. Add route alternatives for stairs, curb cuts, lift outages, sidewalk quality and crossing complexity where reliable data exists.
7. Create a report moderation dashboard and contributor feedback loop.
8. Add localization, low-bandwidth mode, multilingual place names and voice guidance.
9. Run usability and accessibility audits, publish methodology and report honest results.
10. Replace illustrative metrics and sample routes with observed research and measured prototype results.

## 15. Resume positioning (use only after verifying the work)

**Wayfinder — Accessible Route Planning | Independent Product Case Study**
- Framed a route-planning problem around the trade-offs travelers make across travel time, walking distance, transfers and accessibility confidence.
- Designed a preference-led route comparison experience and interactive prototype with journey details, saved routes and an accessibility feedback flow.
- Defined an MVP, directional RICE prioritization, product requirements, success metrics, guardrails and phased validation roadmap.

Do not claim user research, user testing, adoption, time savings or business impact until those activities have actually been completed and results can be substantiated.

---

## References

- Google Maps Help — Accessibility in Google Maps: https://support.google.com/maps/answer/6396990?hl=en
- Google Accessibility Help — Maps accessibility on Android: https://support.google.com/accessibility/answer/6396990?co=GENIE.Platform%3DAndroid&hl=en-IN
- Google Research — Behind the Scenes of Google Maps Navigation: https://research.google/pubs/behind-the-scenes-of-google-maps-navigation-enabling-actionable-user-feedback-at-scale/
- Google Design — People, Products, and Epiphanies: https://medium.com/google-design/people-products-and-epiphanies-bfed0f3fbb2d
- User-provided example case study folder: https://github.com/gaurav-product/product-management-case-studies/tree/main/Case%20Studies/Day-11-Google-Maps
