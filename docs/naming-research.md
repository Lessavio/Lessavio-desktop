# International naming shortlist

Research date: 23 October 2026. This is a preliminary naming screen, not confirmation of domain availability or trademark clearance.

## Criteria

- A Latin-script name without dependence on Russian or Ukrainian vocabulary.
- A name that can be pronounced reasonably easily by English-, Ukrainian-, and Russian-speaking users.
- Associations with lessons, mentoring, or a calm teaching workspace.
- Avoid exact matches with existing educational products.
- Keep the existing app's local data accessible during any eventual rename.

Pronunciation, tone, and associations below are editorial judgments rather than verified linguistic claims across all languages.

## Shortlist

| Name | Intended pronunciation | Intended association | Search findings |
| --- | --- | --- | --- |
| **Lessavio** | leh-SAH-vee-oh / лессавио | Lesson; friendly personal workspace | No exact-match product surfaced in quoted web searches or web searches scoped to App Store, Google Play, and GitHub. GitHub's repository API returned one partial name match, `wole-abraham/lessaviors`, rather than an exact repository named Lessavio. |
| **Lernavie** | ler-nah-VEE / лернави | Learn; a softer brand sound | No results surfaced in the quoted web searches and scoped catalog searches. GitHub repository name search returned zero matches. |
| **Mentivela** | men-tee-VEH-lah / ментивела | Mentor; guidance | No educational/software product surfaced in quoted searches or scoped catalog searches. The broad query surfaced an unrelated historical newspaper result. GitHub repository name search returned zero matches. |

**Selected by the owner: Lessavio.** Domain and trademark availability remain unverified.

## Rejected names

- **Tutorly:** already used by multiple education products, including [Tutorly.ai](https://tutorly.ai/), a [Google Play tutoring marketplace](https://play.google.com/store/apps/details?id=com.tutorlyqa.app), and [Tutorly Labs](https://tutorlylabs.com/).
- **Mentivra:** an existing [exam preparation platform](https://www.mentivra.site/).
- **Tutavio:** an existing [tutoring and learning business](https://tutavio.ch/jobs).
- **Tenvora:** an existing [hospitality management product](https://tenvora.dev/) and other technology businesses.
- **Lernavo:** an existing [education website template](https://www.templatemonster.com/landing-page-templates/lernavo-online-course-amp-education-next-js-template-568222.html).
- **Urokita / Urokivo:** rejected by the owner because the name should be international rather than based on the Slavic word for lesson.

## Method and limits

For each finalist, searched the quoted exact name and searched that name within `github.com`, `apps.apple.com`, and `play.google.com`. Also queried GitHub's public repository search API with `<name> in:name`. GitHub name search can return partial matches; these were checked separately from exact matches.

Search engines do not index all apps, organizations, domains, or marks. An empty result is not proof that a name is unused. Domain registration availability, handles, trademark registers, and similarity to other brands have not been comprehensively checked. International pronunciation and unintended meanings have not been tested with native speakers across markets.

## Implementation considerations after selection

- Update the interface, window title, application display name, installers, backup filename, and documentation together.
- Keep the existing `com.tutorly.desktop` identifier and `tutorly.sqlite` storage path for compatibility, unless an explicit, tested migration is implemented. Merely changing these identifiers would make existing data appear missing.
- Keep existing published download links working. Introduce new installer names in a new release before changing README buttons.
- Renaming the GitHub repository is a separate decision from renaming the application.
