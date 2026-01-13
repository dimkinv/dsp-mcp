export type Blueprint = {
  id: string;
  name: string;
  author: string;
  tags: string[];
};

type BlueprintSearchParams = {
  search: string;
  tags: string[];
  author: string;
};

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

function buildSearchUrl(params: BlueprintSearchParams): string {
  const searchParams = new URLSearchParams({
    search: params.search,
    tags: params.tags.join(" "),
    author: params.author,
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
  const tagsMatch = cardHtml.match(
    /<ul class="o-blueprint-card__tags">([\s\S]*?)<\/ul>/,
  );

  const tags = tagsMatch?.[1]
    ? extractTags(tagsMatch[1])
    : [];

  return {
    id: idMatch[1],
    name: normalizeText(nameMatch?.[1] ?? ""),
    author: normalizeText(authorMatch?.[1] ?? ""),
    tags,
  };
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

searchBlueprints