import express, { type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import {
  fetchBlueprintDetails,
  searchBlueprints,
  type Blueprint,
  type BlueprintDetails,
} from "./blueprints/blueprint-scraper.js";
import { createMemoryCacheStore } from "./cache/memory-cache-store.js";
import { getAppConfig } from "./config/app-config.js";

type SearchQuery = {
  search?: string | string[];
  tags?: string | string[];
  author?: string | string[];
};

type DetailsQuery = {
  path?: string | string[];
  includeBlueprint?: string | string[];
};

type ErrorResponse = {
  error: string;
};

const OPENAPI_SPEC = {
  openapi: "3.0.0",
  info: {
    title: "DSP Blueprint API",
    version: "1.0.0",
  },
  servers: [{ url: "/" }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                  },
                  required: ["status"],
                },
              },
            },
          },
        },
      },
    },
    "/blueprints/search": {
      get: {
        summary: "Search blueprints",
        parameters: [
          {
            name: "search",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "tags",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Comma-separated tag list.",
          },
          {
            name: "author",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Blueprint search results",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Blueprint" },
                },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/blueprints/details": {
      get: {
        summary: "Fetch blueprint details",
        parameters: [
          {
            name: "path",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Relative blueprint path (e.g. /blueprints/slug)",
          },
          {
            name: "includeBlueprint",
            in: "query",
            required: false,
            schema: { type: "boolean" },
          },
        ],
        responses: {
          "200": {
            description: "Blueprint details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BlueprintDetails" },
              },
            },
          },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Blueprint: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          author: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          url: { type: "string" },
        },
        required: ["id", "name", "author", "tags", "url"],
      },
      BlueprintRequirementRecipe: {
        type: "object",
        properties: {
          name: { type: "string" },
          count: { type: "number" },
        },
        required: ["name", "count"],
      },
      BlueprintRequirement: {
        type: "object",
        properties: {
          name: { type: "string" },
          count: { type: "number" },
          recipes: {
            type: "array",
            items: { $ref: "#/components/schemas/BlueprintRequirementRecipe" },
          },
        },
        required: ["name", "count", "recipes"],
      },
      BlueprintDetails: {
        type: "object",
        properties: {
          blueprint: { type: "string" },
          requirements: {
            type: "array",
            items: { $ref: "#/components/schemas/BlueprintRequirement" },
          },
          tags: { type: "array", items: { type: "string" } },
          description: { type: "string" },
        },
        required: ["blueprint", "requirements", "tags", "description"],
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
    },
  },
} as const;

function parseTags(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  const joined = Array.isArray(value) ? value.join(",") : value;
  return joined
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function parseOptionalBoolean(
  value: string | string[] | undefined,
): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const text = Array.isArray(value) ? value[0] ?? "" : value;
  if (!text) {
    return undefined;
  }
  return text.toLowerCase() === "true";
}

function sendError(res: Response<ErrorResponse>, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function createApp() {
  const app = express();
  const config = getAppConfig();
  const searchCache = createMemoryCacheStore<Blueprint[]>();
  const detailsCache = createMemoryCacheStore<BlueprintDetails>();

  app.get("/health", (_req: Request, res: Response) => {
    console.log("[express-server:health] ok");
    res.json({ status: "ok" });
  });

  app.get(
    "/blueprints/search",
    async (
      req: Request<Record<string, string>, Blueprint[] | ErrorResponse, never, SearchQuery>,
      res: Response<Blueprint[] | ErrorResponse>,
    ) => {
      const search = Array.isArray(req.query.search)
        ? req.query.search[0] ?? ""
        : req.query.search ?? "";
      const author = Array.isArray(req.query.author)
        ? req.query.author[0] ?? ""
        : req.query.author ?? "";
      const tags = parseTags(req.query.tags);

      if (!search) {
        console.warn("[express-server:search] missing search query");
        sendError(res, 400, "Query parameter 'search' is required.");
        return;
      }

      console.log(
        "[express-server:search] fetching blueprints",
        search,
        author,
        tags.length,
      );

      try {
        const cacheKey = buildSearchCacheKey(search, author, tags);
        const cachedResults = searchCache.get(cacheKey);
        if (cachedResults) {
          console.log("[express-server:search] cache hit", cacheKey);
          res.json(cachedResults);
          return;
        }

        const results = await searchBlueprints({
          search,
          tags: tags ?? [],
          author,
        });
        searchCache.set(cacheKey, results, config.cacheTtlMs);
        console.log("[express-server:search] cache set", cacheKey);
        res.json(results);
      } catch (error) {
        console.error("[express-server:search] search failed", error);
        sendError(res, 500, "Failed to fetch blueprints.");
      }
    },
  );

  app.get(
    "/blueprints/details",
    async (
      req: Request<Record<string, string>, BlueprintDetails | ErrorResponse, never, DetailsQuery>,
      res: Response<BlueprintDetails | ErrorResponse>,
    ) => {
      const path = Array.isArray(req.query.path)
        ? req.query.path[0] ?? ""
        : req.query.path ?? "";
      const includeBlueprint = parseOptionalBoolean(
        req.query.includeBlueprint,
      );

      if (!path) {
        console.warn("[express-server:details] missing path query");
        sendError(res, 400, "Query parameter 'path' is required.");
        return;
      }

      console.log(
        "[express-server:details] fetching blueprint details",
        path,
        includeBlueprint,
      );

      try {
        const cacheKey = buildDetailsCacheKey(path, includeBlueprint);
        const cachedDetails = detailsCache.get(cacheKey);
        if (cachedDetails) {
          console.log("[express-server:details] cache hit", cacheKey);
          res.json(cachedDetails);
          return;
        }

        const details = await fetchBlueprintDetails(path, {
          includeBlueprint,
        });
        detailsCache.set(cacheKey, details, config.cacheTtlMs);
        console.log("[express-server:details] cache set", cacheKey);
        res.json(details);
      } catch (error) {
        console.error("[express-server:details] details fetch failed", error);
        sendError(res, 500, "Failed to fetch blueprint details.");
      }
    },
  );

  app.get("/openapi.json", (_req: Request, res: Response) => {
    console.debug("[express-server:openapi] serving spec");
    res.json(OPENAPI_SPEC);
  });

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(OPENAPI_SPEC));

  return app;
}

function buildSearchCacheKey(
  search: string,
  author: string,
  tags: string[],
): string {
  const normalizedTags = tags.join(",");
  const cacheKey = `search:${search}|author:${author}|tags:${normalizedTags}`;
  console.debug(
    "[express-server:buildSearchCacheKey] cache key built",
    cacheKey,
  );
  return cacheKey;
}

function buildDetailsCacheKey(
  path: string,
  includeBlueprint: boolean | undefined,
): string {
  const includeBlueprintKey = includeBlueprint ?? "default";
  const cacheKey = `details:${path}|includeBlueprint:${includeBlueprintKey}`;
  console.debug(
    "[express-server:buildDetailsCacheKey] cache key built",
    cacheKey,
  );
  return cacheKey;
}

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = createApp();

app.listen(port, () => {
  console.log("[express-server:listen] server started", port);
});
