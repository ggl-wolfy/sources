// cSpell:words chinaq qplays
const chinaqBaseUrl = "https://chinaq.fun";

const REGEX = {
  detailsAirDate: /【首播】(\d{4}-\d{2}-\d{2})/,
  detailsDesc: /<div id="summary">([\s\S]*?)<br/,
  episodeNum: /第(\d+)集/,
  episodePage: /<h2><a href="([^"]+)">([\s\S]*?)<\/a>/g,
  episodeSources: /id="all-ep"([\s\S]*?)<\/ul>/,
  searchItemImg: /<div class="description[\s\S]*?img src="([^"]+)"/,
  searchItemTitle: /<h1>([\s\S]*?) (?:ChinaQ)?線上看/,
};

async function getHostWithProtocol(url) {
  // Match the protocol and host part of the URL
  const match = url.match(/^(https:\/\/(?:[^\/]+\.)?chinaq[^\/]+)/i);
  if (match) return match[1]
  throw new Error(`Invalid ChinaQ URL: ${url}`)
}

async function fetchHtml(url) {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch (error) {
    console.log(`Failed to fetch ${url}`);
    throw error;
  }
}

function extractMatches(html, regex) {
  const result = html.match(regex);
  return result?.[1]?.trim() ?? null;
}

async function searchResults(keyword) {
  try {
    const html = await fetchHtml(keyword);
    const href = keyword;
    const title = extractMatches(html, REGEX.searchItemTitle);
    const image = extractMatches(html, REGEX.searchItemImg);

    const results = [];
    if (href && title && image) {
      const baseUrl = getHostWithProtocol(keyword);
      results.push({ title, image: baseUrl + image, href });
    }

    // console.log(JSON.stringify(results));
    return JSON.stringify(results);
  } catch (error) {
    console.log(`Failed to extract series from URL: ${keyword}`);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    const html = await fetchHtml(url);
    const description = extractMatches(html, REGEX.detailsDesc) || 'Error loading description';
    const airdate = extractMatches(html, REGEX.detailsAirDate) || 'Aired: Unknown';
    const details = [{ description, alias: 'N/A', airdate }];

    console.log(JSON.stringify(details));
    return JSON.stringify(details);
  } catch (error) {
    console.log('Failed to extract details:', error);
    return JSON.stringify([{ description: 'Error loading description', aliases: 'Aliases: N/A', airdate: 'Aired: Unknown' }]);
  }
}

async function extractEpisodes(url) {
  const episodes = [];

  try {
    const html = await fetchHtml(url);
    const sourcesMatch = html.match(REGEX.episodeSources);
    if (!sourcesMatch) throw new Error('Failed to extract source');

    const sourcesHtml = sourcesMatch[1];
    const episodeSource = sourcesHtml.matchAll(REGEX.episodePage);
    for (const [_, pageUrl, title] of episodeSource) {
      const episodeNum = extractMatches(title, REGEX.episodeNum) ?? '0'
      const number = parseInt(episodeNum, 10);

      if (number === 0) {
        console.log(`Skipped episode: [${title}]`);
        continue;
      }

      // https://chinaq.fun/tv-cn/202557998/ep1.html ==> https://chinaq.fun/qplays/202557998/ep1
      const href = pageUrl.replace(/^\/[^/]+/,'/qplays').replace('.html','');

      episodes.unshift({ href, number, title });
    }

    console.log(episodes);
    return JSON.stringify(episodes);
  } catch (error) {
    console.log('Failed to extract episodes:', error);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  console.log(`Stream URL: [${url}]`);

  try {
    const html = await fetchHtml(url);
    const sources = JSON.parse(html)?.video_plays;
    const result = { streams: sources.map(source => source.play_data) };

    console.log("Result:", result);
    return JSON.stringify(result);
  } catch (error) {
    console.log('Failed to extract streams:', error);
    return null;
  }
}
