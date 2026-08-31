// Content bundled with the app; this does not track browser visits or elapsed time.
const TeaAnnouncements = (() => {
  const content = Object.freeze({
    updatedOn: "2026-08-31",
    // Newest published batch first: { id: "<release-id>", items: [...] }.
    // Prepend a batch when it ships; older batches automatically become history.
    // Editing updatedOn or planned announcements does not archive a release.
    releases: Object.freeze([]),
    planned: Object.freeze([]),
  });
  function getSections({ releases, planned } = content) {
    const published = releases.filter(release => release.items.length);
    const sections = [
      { id: "released", items: published[0]?.items || [] },
      { id: "planned", items: planned },
    ];
    const past = published.slice(1).flatMap(release => release.items);
    if (past.length) sections.push({ id: "past", items: past });
    return sections;
  }
  return Object.freeze({ ...content, getSections });
})();
if (typeof module !== "undefined" && module.exports) module.exports = TeaAnnouncements;
