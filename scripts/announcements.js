// Content bundled with the app; this does not track browser visits or elapsed time.
const TeaAnnouncements = (() => {
  const content = Object.freeze({
    updatedOn: "2026-08-31",
    // Newest published batch first: { id: "<release-id>", items: [...] }.
    // Prepend a batch when it ships; older batches automatically become history.
    // Editing updatedOn or planned announcements does not archive a release.
    releases: Object.freeze([]),
    // Local review copy, kept separate from published release history.
    // Move these items to a release batch only after the feedback server is ready.
    draft: Object.freeze([
      { id: "main-ui", titleKey: "announcements.mainTitle", bodyKey: "announcements.mainBody" },
      { id: "feeling-words", titleKey: "announcements.wordsTitle", bodyKey: "announcements.wordsBody" },
      { id: "chinese-locales", titleKey: "announcements.languageTitle", bodyKey: "announcements.languageBody" },
      { id: "creator-feedback", titleKey: "announcements.feedbackTitle", bodyKey: "announcements.feedbackBody" },
    ].map(Object.freeze)),
    planned: Object.freeze([]),
  });
  function getSections({ releases, planned, draft = [] } = content) {
    const published = releases.filter(release => release.items.length);
    const sections = [];
    if (draft.length) sections.push({ id: "draft", items: draft });
    if (published.length || !draft.length) sections.push({ id: "released", items: published[0]?.items || [] });
    sections.push({ id: "planned", items: planned });
    const past = published.slice(1).flatMap(release => release.items);
    if (past.length) sections.push({ id: "past", items: past });
    return sections;
  }
  return Object.freeze({ ...content, getSections });
})();
if (typeof module !== "undefined" && module.exports) module.exports = TeaAnnouncements;
