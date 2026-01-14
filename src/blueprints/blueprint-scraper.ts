import { load } from "cheerio";
import type { Cheerio, Element } from "cheerio";

export type Blueprint = {
  id: string;
  name: string;
  author: string;
  tags: string[];
  url: string;
};

export type BlueprintRequirementRecipe = {
  name: string;
  count: number;
};

export type BlueprintRequirement = {
  name: string;
  count: number;
  recipes: BlueprintRequirementRecipe[];
};

export type BlueprintDetails = {
  blueprint: string;
  requirements: BlueprintRequirement[];
  tags: string[];
  description: string;
};

type BlueprintSearchParams = {
  search: string;
  tags?: string[];
  author?: string;
};

const ROOT_URL = "https://www.dysonsphereblueprints.com";
const BASE_URL = "https://www.dysonsphereblueprints.com/blueprints";

export async function searchBlueprints(
  params: BlueprintSearchParams,
): Promise<Blueprint[]> {
  console.log(
    "[blueprint-scraper:searchBlueprints] building search url",
  );
  const url = buildSearchUrl(params);

  console.log("[blueprint-scraper:searchBlueprints] fetching html", url);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(
      "[blueprint-scraper:searchBlueprints] request failed",
      response.status,
      response.statusText,
    );
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  const html = await response.text();
  console.debug(
    "[blueprint-scraper:searchBlueprints] html loaded",
    html.length,
  );

  const $ = load(html);
  const cardElements = $("li.o-blueprint-card.factory");
  console.debug(
    "[blueprint-scraper:searchBlueprints] card sections found",
    cardElements.length,
  );

  const blueprints = cardElements
    .toArray()
    .map((element) => parseBlueprintCard($, element))
    .filter((blueprint): blueprint is Blueprint => blueprint !== null);

  console.log(
    "[blueprint-scraper:searchBlueprints] blueprints parsed",
    blueprints.length,
  );

  return blueprints;
}

type FetchBlueprintDetailsOptions = {
  includeBlueprint?: boolean;
};

export async function fetchBlueprintDetails(
  relativePath: string,
  options: FetchBlueprintDetailsOptions = {},
): Promise<BlueprintDetails> {
  const includeBlueprint = options.includeBlueprint ?? true;

  console.log(
    "[blueprint-scraper:fetchBlueprintDetails] building blueprint url",
    relativePath,
  );
  const url = new URL(relativePath, ROOT_URL).toString();

  console.log("[blueprint-scraper:fetchBlueprintDetails] fetching html", url);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(
      "[blueprint-scraper:fetchBlueprintDetails] request failed",
      response.status,
      response.statusText,
    );
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  const html = await response.text();
  console.debug(
    "[blueprint-scraper:fetchBlueprintDetails] html loaded",
    html.length,
  );
  const $ = load(html);

  const blueprint = includeBlueprint
    ? extractBlueprintText($)
    : "";
  const requirements = extractBlueprintRequirements($);
  const tags = extractBlueprintTagNames($);
  const description = extractBlueprintDescription($);

  if (!includeBlueprint) {
    console.debug(
      "[blueprint-scraper:fetchBlueprintDetails] blueprint extraction skipped",
    );
  }

  console.log(
    "[blueprint-scraper:fetchBlueprintDetails] blueprint details parsed",
    requirements.length,
  );

  return {
    blueprint,
    requirements,
    tags,
    description,
  };
}

function buildSearchUrl(params: BlueprintSearchParams): string {
  const searchParams = new URLSearchParams({
    search: params.search,
    tags: (params.tags ?? []).join(" "),
    author: params.author ?? "",
    max_structures: "",
    color: "",
    color_similarity: "80",
    order: "recent",
    commit: "Search",
  });

  return `${BASE_URL}?${searchParams.toString()}`;
}

function parseBlueprintCard(
  $: ReturnType<typeof load>,
  element: Element,
): Blueprint | null {
  const card = $(element);
  const id = card.attr("data-blueprint-id") ?? "";
  if (!id) {
    console.warn(
      "[blueprint-scraper:parseBlueprintCard] missing blueprint id",
    );
    return null;
  }

  const name = normalizeText(card.find("h2 a").first().text());
  const author = normalizeText(
    card.find(".o-blueprint-card__summary a").first().text(),
  );
  const url = normalizeText(
    decodeHtmlEntities(
      card.find(".o-blueprint-card__cover a").attr("href") ?? "",
    ),
  );
  const tags = card
    .find(".o-blueprint-card__tags li")
    .toArray()
    .map((tagElement) => normalizeText($(tagElement).text()))
    .filter((tag) => tag.length > 0);

  if (tags.length === 0) {
    console.warn("[blueprint-scraper:parseBlueprintCard] no tags found", id);
  }

  if (!url) {
    console.warn(
      "[blueprint-scraper:parseBlueprintCard] missing blueprint url",
      id,
    );
  }

  return {
    id,
    name,
    author,
    tags,
    url,
  };
}

function extractBlueprintText(
  $: ReturnType<typeof load>,
): string {
  const blueprintText = $("textarea[data-clipboard-target='true']")
    .first()
    .text();
  if (!blueprintText) {
    console.warn(
      "[blueprint-scraper:extractBlueprintText] missing blueprint textarea",
    );
    return "";
  }

  return decodeHtmlEntities(blueprintText).trim();
}

function extractBlueprintRequirements(
  $: ReturnType<typeof load>,
): BlueprintRequirement[] {
  const listElement = $("ul.t-blueprint__requirements-data").first();
  if (listElement.length === 0) {
    console.warn(
      "[blueprint-scraper:extractBlueprintRequirements] missing requirements list",
    );
    return [];
  }

  const requirements = listElement
    .find("li.t-blueprint__requirements-entity")
    .toArray()
    .map((element) => parseRequirementEntity($, element))
    .filter(
      (requirement): requirement is BlueprintRequirement =>
        requirement !== null,
    );

  console.debug(
    "[blueprint-scraper:extractBlueprintRequirements] requirements parsed",
    requirements.length,
  );

  return requirements;
}

function extractBlueprintTagNames(
  $: ReturnType<typeof load>,
): string[] {
  const tagSection = $("div.t-blueprint__tags").first();
  if (tagSection.length === 0) {
    console.warn(
      "[blueprint-scraper:extractBlueprintTagNames] missing tag section",
    );
    return [];
  }

  const tags = tagSection
    .find("[data-tippy-content]")
    .toArray()
    .map((element) =>
      normalizeText(
        decodeHtmlEntities(
          $(element).attr("data-tippy-content") ?? "",
        ),
      ),
    )
    .filter((tag) => tag.length > 0);

  if (tags.length === 0) {
    console.warn(
      "[blueprint-scraper:extractBlueprintTagNames] no tags found",
    );
  }

  return tags;
}

function extractBlueprintDescription(
  $: ReturnType<typeof load>,
): string {
  const descriptionText = $("div.trix-content")
    .find("div")
    .first()
    .text();

  if (!descriptionText) {
    console.warn(
      "[blueprint-scraper:extractBlueprintDescription] missing description",
    );
    return "";
  }

  return normalizeText(descriptionText);
}

function parseRequirementEntity(
  $: ReturnType<typeof load>,
  element: Element,
): BlueprintRequirement | null {
  const entity = $(element);
  const name = normalizeText(
    decodeHtmlEntities(
      entity
        .find("[data-tippy-content]")
        .first()
        .attr("data-tippy-content") ?? "",
    ),
  );
  const count = parseCountFromHtml(
    entity.find(".t-blueprint__requirements-entity__tally").first().text(),
  );

  if (!name || count === 0) {
    console.warn(
      "[blueprint-scraper:parseRequirementEntity] missing entity data",
      name,
      count,
    );
  }
  if (!name) {
    return null;
  }

  const recipes = extractRecipeEntries(
    entity.find("ul.t-blueprint__requirements-entity__recipes").first(),
  );

  return {
    name,
    count,
    recipes,
  };
}

function extractRecipeEntries(
  recipesElement: Cheerio<Element>,
): BlueprintRequirementRecipe[] {
  if (recipesElement.length === 0) {
    console.debug(
      "[blueprint-scraper:extractRecipeEntries] no recipes found",
    );
    return [];
  }

  const recipes = recipesElement
    .find("li.t-blueprint__requirements-entity__recipe")
    .toArray()
    .map((element) => {
      const entry = recipesElement.find(element);
      const name = normalizeText(
        decodeHtmlEntities(entry.attr("data-tippy-content") ?? ""),
      );
      const count = parseCountFromHtml(entry.text());

      if (!name || count === 0) {
        console.warn(
          "[blueprint-scraper:extractRecipeEntries] missing recipe data",
          name,
          count,
        );
        return null;
      }

      return {
        name,
        count,
      };
    })
    .filter(
      (
        recipe,
      ): recipe is BlueprintRequirementRecipe =>
        recipe !== null,
    );

  if (recipes.length === 0) {
    console.debug(
      "[blueprint-scraper:extractRecipeEntries] no recipes found",
    );
  }

  return recipes;
}

function parseCountFromHtml(value: string): number {
  const text = normalizeText(value.replace(/<[^>]+>/g, " "));
  const match = text.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
