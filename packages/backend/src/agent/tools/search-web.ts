interface SearchWebInput {
  query: string;
  num_results?: number;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function handleSearchWeb(input: SearchWebInput): Promise<SearchResult[] | { error: string }> {
  const { query, num_results = 5 } = input;

  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return { error: `DuckDuckGo returned status ${response.status}. Try using browse_website directly.` };
    }

    const html = await response.text();
    const results: SearchResult[] = [];

    // Parse results from DuckDuckGo HTML
    // Results are in elements with class "result__a" for links and "result__snippet" for descriptions
    const resultBlocks = html.split(/class="result\s/g).slice(1);

    for (const block of resultBlocks) {
      if (results.length >= num_results) break;

      // Extract link and title from result__a
      const linkMatch = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
      // Extract snippet from result__snippet
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/[a-z]/);

      if (linkMatch) {
        let url = linkMatch[1];
        const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();

        // DuckDuckGo wraps URLs in redirect links, extract actual URL
        const uddgMatch = url.match(/uddg=([^&]*)/);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        }

        const snippet = snippetMatch
          ? snippetMatch[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim()
          : '';

        if (url && title) {
          results.push({ title, url, snippet });
        }
      }
    }

    if (results.length === 0) {
      return { error: 'No results found. Try refining your query or use browse_website directly.' };
    }

    return results;
  } catch (err: any) {
    console.error('Search error:', err);
    return { error: `Search failed: ${err.message}. Try using browse_website to visit a search engine directly.` };
  }
}
