// cSpell:words chinaq qplays

const REGEX = {
  detailsAirDate: /【首播】(\d{4}-\d{2}-\d{2})/,
  detailsDesc: /<div id="summary">([\s\S]*?)<br/,
  episodeNum: /第(\d+)集/,
  episodePage: /<h2><a href="([^"]+)">([\s\S]*?)<\/a>/g,
  episodeSources: /id="all-ep"([\s\S]*?)<\/ul>/,
  searchItemImg: /<div class="description[\s\S]*?img src="([^"]+)"/,
  searchItemTitle: /<h1>([\s\S]*?) (?:ChinaQ)?線上看/,
};

function getHostWithProtocol(url) {
  const match = url.match(/^(https:\/\/(?:[^\/]+\.)?chinaq[^\/]+)/i);
  if (match) return match[1]
  throw new Error(`Invalid ChinaQ URL: ${url}`)
}

async function fetchHtml(url) {
  try {
    return await fetch(url);
  } catch (error) {
    console.log(`Failed to fetch ${url}`);
    throw error;
  }
}

function extractMatches(html, regex) {
  const result = html.match(regex);
  return result?.[1]?.trim() ?? null;
}

async function searchResults(url) {
  try {
    const html = await fetchHtml(url);
    const title = extractMatches(html, REGEX.searchItemTitle);
    const image = extractMatches(html, REGEX.searchItemImg);

    const results = [];
    if (url && title && image) {
      const baseUrl = getHostWithProtocol(url);
      results.push({ title, image: baseUrl + image, href: url });
    }

    return JSON.stringify(results);
  } catch (error) {
    console.log(`Failed to extract series from URL: ${url}`);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    const html = await fetchHtml(url);
    const description = extractMatches(html, REGEX.detailsDesc) || 'Error loading description';
    const airdate = extractMatches(html, REGEX.detailsAirDate) || 'Aired: Unknown';
    const details = [{ description, alias: 'N/A', airdate }];

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

    const baseUrl = getHostWithProtocol(url);

    const sourcesHtml = sourcesMatch[1];
    const episodeSource = sourcesHtml.matchAll(REGEX.episodePage);
    for (const [_, pageUrl, title] of episodeSource) {
      const episodeNum = extractMatches(title, REGEX.episodeNum) ?? '0'
      if (episodeNum === '0') {
        console.log(`Skipped episode: [${title}]`);
        continue;
      }

      const href = pageUrl.replace(/^\/[^/]+/,'/qplays').replace('.html','');

      episodes.unshift({
        href: baseUrl + href,
        number: parseInt(episodeNum, 10),
        title
      });
    }

    return JSON.stringify(episodes);
  } catch (error) {
    console.log('Failed to extract episodes:', error);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  try {
    const html = await fetchHtml(url);
    const sources = JSON.parse(html)?.video_plays;
    const result = { streams: sources.map(source => source.play_data) };

    return JSON.stringify(result);
  } catch (error) {
    console.log('Failed to extract streams:', error);
    return null;
  }
}
