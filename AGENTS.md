
# Instructions to Agent
 - use `pnpm` as package manager, if both server client are present use pnpm workspaces
 - when importing "only type" prefix with `type` keyword
 - development done only in typescript strict mode
 - when done working summarize work done in `# Summary` section in this file. Explain what you did, why you did it and note important decisions made
 - when writing code make sure to log it. use `.log` `.debug` `.warn` `.error` where applicable.
   - Logs should be of the following format: `[className:functionName] message`
   - if code executed outside of class write filename instead
 - keep the code divided into files/classes/folders to create clear logic separation
 - when naming files use kebab-case syntax
 - do not over-complicate the code, there should be a balance between spaghetti code and over-separation

# Summary
- Added `searchBlueprints` in `src/blueprints/blueprint-scraper.ts` to build the search URL, fetch HTML, parse blueprint cards, and return id/name/author/tags; kept parsing lightweight with string scanning and regex to avoid extra dependencies.
- Added small helpers for URL building, card section extraction, tag parsing, and HTML entity normalization; included structured logging for each step to aid debugging and traceability.
