
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
- Extended blueprint parsing to include the cover link URL by extracting the `o-blueprint-card__cover` anchor href and returning it on each result, warning when missing for traceability.
- Added `fetchBlueprintDetails` and parsers in `src/blueprints/blueprint-scraper.ts` to fetch a blueprint page by relative path, extract the blueprint text from the textarea, and parse requirement entities plus recipe subcomponents with structured logging and HTML normalization.
- Fixed requirements parsing to correctly capture the full requirements list by scanning for balanced `<ul>` tags, preventing nested recipe lists from truncating the results.
- Added an `includeBlueprint` option to `fetchBlueprintDetails` so callers can skip parsing the blueprint textarea when only requirements are needed, with logging to reflect the skip.
- Added description and tags extraction to `fetchBlueprintDetails` by parsing the `trix-content` block and `t-blueprint__tags` tooltips, returning both alongside requirements.
- Added `src/express-server.ts` with an Express API wrapper exposing health, search, and details endpoints, plus OpenAPI JSON and Swagger UI for quick inspection and testing.
- Added input parsing and error handling for query parameters, keeping optional `includeBlueprint` behavior aligned with the scraper defaults and logging each request path.
- Updated `package.json` with server dependencies/types and a `dev` script, plus `tsconfig.json` node types to keep strict TypeScript checks working with Express.

# Memories
- Decision: extracted the blueprint URL via the `o-blueprint-card__cover` anchor href and decoded entities so callers receive a clean relative path.
- Work: added a `url` field to `Blueprint` results and warned when it is missing during card parsing.
- Decision: parse blueprint requirements by splitting on the top-level requirement list item marker to avoid nested recipe list interference.
- Work: implemented blueprint detail fetching and requirement/recipe extraction helpers with count parsing and logging.
- Decision: switched to a balanced `<ul>` scan when extracting the requirements list to avoid regex truncation on nested recipe lists.
- Work: added an `includeBlueprint` option to skip blueprint textarea parsing when only requirements are needed.
- Decision: parse blueprint tags from the dedicated tags section to avoid unrelated tooltip content elsewhere on the page.
- Work: added blueprint description and tag extraction helpers and surfaced them on `BlueprintDetails`.
- Decision: expose `/openapi.json` and `/docs` with a small in-file OpenAPI spec to keep the server self-contained and easy to test without extra tooling.
- Work: implemented the Express server wrapper with search/details endpoints and query parsing plus logging in `src/express-server.ts`.
