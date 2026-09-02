# OpenMAIC Local Project Instructions

## README ownership boundary

The root `README.md` and `README-zh.md` each contain two documentation ownership areas separated by this exact marker:

```text
<!-- LOCAL-ADDITIONS-START -->
```

Follow these rules for every later README edit:

- Treat everything above the marker as upstream-owned documentation.
- Keep the upstream area faithful to the README supplied by the current upstream OpenMAIC version.
- Put every addition, correction, operating note and troubleshooting entry specific to this customized copy below the marker.
- Never insert local documentation into the upstream area.
- Edit the upstream area only when the task explicitly applies documentation received from upstream.
- During an upstream update, update the upstream area and preserve the complete local area below the marker.
- Keep exactly one boundary marker and one local-additions section in each README.
- Before completing an edit, confirm that all local material is below the marker and that Markdown formatting passes.

These rules apply to documentation ownership and placement. They do not prohibit correcting local instructions below the boundary when the customized setup changes.
