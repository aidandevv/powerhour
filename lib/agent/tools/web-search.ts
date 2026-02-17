/**
 * Custom web search tool for budget planner travel mode.
 * Uses DuckDuckGo HTML search as a simple, API-key-free solution.
 * For production, consider using Brave Search API or Google Custom Search.
 */

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface WebSearchParams {
  query: string;
}

interface WebSearchResult {
  query: string;
  results: SearchResult[];
  summary: string;
}

/**
 * Performs a web search using DuckDuckGo HTML endpoint.
 * Returns up to 10 results with titles, links, and snippets.
 */
export async function performWebSearch(params: WebSearchParams): Promise<WebSearchResult> {
  const { query } = params;

  try {
    // Use DuckDuckGo HTML search (no API key required)
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FinanceBudgetBot/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const html = await response.text();
    const results = parseSearchResults(html);

    return {
      query,
      results: results.slice(0, 10),
      summary: `Found ${results.length} results for "${query}". Top results: ${results
        .slice(0, 3)
        .map((r) => r.title)
        .join(", ")}`,
    };
  } catch (error) {
    console.error("[web-search] Error:", error);
    return {
      query,
      results: [],
      summary: `Web search failed for "${query}". Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Parse search results from DuckDuckGo HTML response.
 * This is a simple parser - for production use a proper HTML parser like cheerio.
 */
function parseSearchResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Simple regex-based parsing (fragile but works for basic cases)
  // In production, use cheerio or similar HTML parser
  const resultBlocks = html.split('class="result ');

  for (let i = 1; i < resultBlocks.length && i <= 10; i++) {
    const block = resultBlocks[i];

    // Extract title
    const titleMatch = block.match(/class="result__title"[^>]*><a[^>]*>([^<]+)</);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Extract URL
    const urlMatch = block.match(/class="result__url"[^>]*>([^<]+)</);
    const link = urlMatch ? urlMatch[1].trim() : "";

    // Extract snippet
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([^<]+)</);
    const snippet = snippetMatch ? snippetMatch[1].trim() : "";

    if (title && link) {
      results.push({
        title: cleanHtmlEntities(title),
        link: link.startsWith("http") ? link : `https://${link}`,
        snippet: cleanHtmlEntities(snippet),
      });
    }
  }

  return results;
}

/**
 * Clean HTML entities from extracted text
 */
function cleanHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}
