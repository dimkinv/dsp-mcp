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

  const cardSections = extractBlueprintCardSections(html);
  console.debug(
    "[blueprint-scraper:searchBlueprints] card sections found",
    cardSections.length,
  );

  const blueprints = cardSections
    .map(parseBlueprintCard)
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

  const blueprint = includeBlueprint
    ? extractBlueprintText(html)
    : "";
  const requirements = extractBlueprintRequirements(html);
  const tags = extractBlueprintTagNames(html);
  const description = extractBlueprintDescription(html);

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
    author: params.author ?? '',
    max_structures: "",
    color: "",
    color_similarity: "80",
    order: "recent",
    commit: "Search",
  });

  return `${BASE_URL}?${searchParams.toString()}`;
}

function extractBlueprintCardSections(html: string): string[] {
  const marker = '<li class="o-blueprint-card factory"';
  const sections: string[] = [];
  let cursor = html.indexOf(marker);

  while (cursor !== -1) {
    const nextCursor = html.indexOf(marker, cursor + marker.length);
    const end = nextCursor === -1 ? html.length : nextCursor;
    sections.push(html.slice(cursor, end));
    cursor = nextCursor;
  }

  if (sections.length === 0) {
    console.warn(
      "[blueprint-scraper:extractBlueprintCardSections] no cards found",
    );
  }

  return sections;
}

function parseBlueprintCard(cardHtml: string): Blueprint | null {
  const idMatch = cardHtml.match(/data-blueprint-id="(\d+)"/);
  if (!idMatch?.[1]) {
    console.warn(
      "[blueprint-scraper:parseBlueprintCard] missing blueprint id",
    );
    return null;
  }

  const nameMatch = cardHtml.match(
    /<h2>[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>/,
  );
  const authorMatch = cardHtml.match(
    /by\s*<a [^>]*>([\s\S]*?)<\/a>/,
  );
  const urlMatch = cardHtml.match(
    /<div class="o-blueprint-card__cover">[\s\S]*?<a href="([^"]+)"/,
  );
  const tagsMatch = cardHtml.match(
    /<ul class="o-blueprint-card__tags">([\s\S]*?)<\/ul>/,
  );

  const tags = tagsMatch?.[1]
    ? extractTags(tagsMatch[1])
    : [];
  const url = urlMatch?.[1]
    ? decodeHtmlEntities(urlMatch[1]).trim()
    : "";

  if (!url) {
    console.warn(
      "[blueprint-scraper:parseBlueprintCard] missing blueprint url",
      idMatch[1],
    );
  }

  return {
    id: idMatch[1],
    name: normalizeText(nameMatch?.[1] ?? ""),
    author: normalizeText(authorMatch?.[1] ?? ""),
    tags,
    url,
  };
}

function extractBlueprintText(html: string): string {
  const blueprintMatch = html.match(
    /<textarea[^>]*data-clipboard-target="true"[^>]*>([\s\S]*?)<\/textarea>/,
  );

  if (!blueprintMatch?.[1]) {
    console.warn(
      "[blueprint-scraper:extractBlueprintText] missing blueprint textarea",
    );
    return "";
  }

  return decodeHtmlEntities(blueprintMatch[1]).trim();
}

function extractBlueprintRequirements(html: string): BlueprintRequirement[] {
  const listHtml = extractRequirementsListHtml(html);
  if (!listHtml) {
    console.warn(
      "[blueprint-scraper:extractBlueprintRequirements] missing requirements list",
    );
    return [];
  }

  const entitySections = extractRequirementEntitySections(
    listHtml,
  );

  const requirements = entitySections
    .map(parseRequirementEntity)
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

function extractBlueprintTagNames(html: string): string[] {
  const tagSection = extractBlueprintTagSection(html);
  if (!tagSection) {
    console.warn(
      "[blueprint-scraper:extractBlueprintTagNames] missing tag section",
    );
    return [];
  }

  const tagMatches = tagSection.matchAll(
    /data-tippy-content="([^"]+)"/g,
  );
  const tags: string[] = [];

  for (const match of tagMatches) {
    const tag = normalizeText(match[1] ?? "");
    if (tag.length > 0) {
      tags.push(tag);
    }
  }

  if (tags.length === 0) {
    console.warn(
      "[blueprint-scraper:extractBlueprintTagNames] no tags found",
    );
  }

  return tags;
}

function extractBlueprintDescription(html: string): string {
  const descriptionMatch = html.match(
    /<div class="trix-content">[\s\S]*?<div>([\s\S]*?)<\/div>/,
  );

  if (!descriptionMatch?.[1]) {
    console.warn(
      "[blueprint-scraper:extractBlueprintDescription] missing description",
    );
    return "";
  }

  return normalizeText(descriptionMatch[1].replace(/<[^>]+>/g, " "));
}

function extractBlueprintTagSection(html: string): string | null {
  const marker = '<div class="t-blueprint__tags">';
  const start = html.indexOf(marker);
  if (start === -1) {
    return null;
  }

  let cursor = start + marker.length;
  let depth = 1;

  while (cursor < html.length) {
    const nextOpen = html.indexOf("<div", cursor);
    const nextClose = html.indexOf("</div>", cursor);

    if (nextClose === -1) {
      console.warn(
        "[blueprint-scraper:extractBlueprintTagSection] closing div not found",
      );
      return null;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + 4;
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return html.slice(start + marker.length, nextClose);
    }

    cursor = nextClose + 6;
  }

  console.warn(
    "[blueprint-scraper:extractBlueprintTagSection] tag section not closed",
  );
  return null;
}

function extractRequirementsListHtml(html: string): string | null {
  const listMarker = '<ul class="t-blueprint__requirements-data">';
  const start = html.indexOf(listMarker);
  if (start === -1) {
    console.warn(
      "[blueprint-scraper:extractRequirementsListHtml] requirements list marker not found",
    );
    return null;
  }

  let cursor = start + listMarker.length;
  let depth = 1;

  while (cursor < html.length) {
    const nextOpen = html.indexOf("<ul", cursor);
    const nextClose = html.indexOf("</ul>", cursor);

    if (nextClose === -1) {
      console.warn(
        "[blueprint-scraper:extractRequirementsListHtml] closing list tag not found",
      );
      return null;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + 3;
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return html.slice(start + listMarker.length, nextClose);
    }

    cursor = nextClose + 5;
  }

  console.warn(
    "[blueprint-scraper:extractRequirementsListHtml] requirements list not closed",
  );
  return null;
}

function extractRequirementEntitySections(listHtml: string): string[] {
  const marker = '<li class="t-blueprint__requirements-entity">';
  const sections: string[] = [];
  let cursor = listHtml.indexOf(marker);

  while (cursor !== -1) {
    const nextCursor = listHtml.indexOf(marker, cursor + marker.length);
    const end = nextCursor === -1 ? listHtml.length : nextCursor;
    sections.push(listHtml.slice(cursor, end));
    cursor = nextCursor;
  }

  if (sections.length === 0) {
    console.warn(
      "[blueprint-scraper:extractRequirementEntitySections] no entity sections found",
    );
  }

  return sections;
}

function parseRequirementEntity(
  entityHtml: string,
): BlueprintRequirement | null {
  const tallyMatch = entityHtml.match(
    /<div class="t-blueprint__requirements-entity__tally">([\s\S]*?)<\/div>/,
  );
  const nameMatch = entityHtml.match(
    /t-blueprint__requirements-entity__tally[\s\S]*?data-tippy-content="([^"]+)"/,
  );

  const name = nameMatch?.[1]
    ? decodeHtmlEntities(nameMatch[1]).trim()
    : "";
  const count = tallyMatch?.[1]
    ? parseCountFromHtml(tallyMatch[1])
    : 0;

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

  const recipesMatch = entityHtml.match(
    /<ul class="t-blueprint__requirements-entity__recipes">([\s\S]*?)<\/ul>/,
  );
  const recipes = recipesMatch?.[1]
    ? extractRecipeEntries(recipesMatch[1])
    : [];

  return {
    name,
    count,
    recipes,
  };
}

function extractRecipeEntries(recipesHtml: string): BlueprintRequirementRecipe[] {
  const recipeMatches = recipesHtml.matchAll(
    /<li[^>]*class="t-blueprint__requirements-entity__recipe[^"]*"[^>]*>([\s\S]*?)<\/li>/g,
  );

  const recipes: BlueprintRequirementRecipe[] = [];
  for (const match of recipeMatches) {
    const entryHtml = match[0];
    const nameMatch = entryHtml.match(/data-tippy-content="([^"]+)"/);
    const count = parseCountFromHtml(match[1] ?? "");
    const name = nameMatch?.[1]
      ? decodeHtmlEntities(nameMatch[1]).trim()
      : "";

    if (!name || count === 0) {
      console.warn(
        "[blueprint-scraper:extractRecipeEntries] missing recipe data",
        name,
        count,
      );
      continue;
    }

    recipes.push({
      name,
      count,
    });
  }

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

function extractTags(tagsHtml: string): string[] {
  const tagMatches = tagsHtml.matchAll(
    /<li class="o-blueprint-card__tags-tag[^"]*">([\s\S]*?)<\/li>/g,
  );

  const tags: string[] = [];
  for (const match of tagMatches) {
    const tag = normalizeText(match[1] ?? "");
    if (tag.length > 0) {
      tags.push(tag);
    }
  }

  if (tags.length === 0) {
    console.warn("[blueprint-scraper:extractTags] no tags found");
  }

  return tags;
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

async function foo(){
  // const res = await searchBlueprints({
  //   search: "factory",
  
  // });
  
  // console.log("Search results:", res);
  const res = await fetchBlueprintDetails('/blueprints/factory-3-second-universe-matrix-factory-proliferated-defenses', {includeBlueprint: false});
  console.log("Blueprint details:", res);
}

foo();
