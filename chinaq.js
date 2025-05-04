// cSpell:words chinaq qplays
const chinaqBaseUrl = "https://chinaq.fun";

const REGEX = {
  detailsAirDate: /<div class="description[\s\S]*?【首播】(\d{4}-\d{2}-\d{2})/,
  detailsDesc: /<div id="summary">([\s\S]*?)<br/,
  episodeNum: /第(\d+)集/,
  episodePage: /<h2><a href="([^"]+)">([\s\S]*?)<\/a>/g,
  episodePageSource: /<small>([^<]*?)<\/small>[\s\S]*?play_data="([^"]+)"/g,
  episodeSources: /id="all-ep"([\s\S]*?)<\/ul>/,
  searchItemImg: /<div class="description[\s\S]*?img src="([^"]+)"/,
  searchItemTitle: /<h1>([\s\S]*?) ChinaQ線上看/,
};

async function fetchHtml(url) {
  try {
    console.log(`Debug: trying to fetch ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    console.log(`Failed to fetch ${url}`);
    throw error;
  }
}

function extractMatches(html, regex, matchAll = false) {
  if (matchAll) {
    return html.matchAll(regex)
  }

  const result = html.match(regex)
  // console.log(`regex: ${regex}, result: ${result[1]}`)
  return result ? result[1]?.trim() : null;
}

async function searchResults(keyword) {
  const results = [];
  try {
    const html = await fetchHtml(keyword);

    const href = keyword;
    const title = extractMatches(html, REGEX.searchItemTitle);
    const image = extractMatches(html, REGEX.searchItemImg);

    if (href && title && image) {
      results.push({ title, image: chinaqBaseUrl + image, href });
    }
    // console.log(JSON.stringify(results));
    return JSON.stringify(results);
  } catch (error) {
    console.log('Search error:', error);
    return JSON.stringify([{ title: 'Error', image: null, href: null }]);
  }
}

async function extractDetails(url) {
  try {
    const html = await fetchHtml(url);
    const description = extractMatches(html, REGEX.detailsDesc) || 'Error loading description';
    const airdate = extractMatches(html, REGEX.detailsAirDate) || 'Aired: Unknown';
    const details = [{ description, alias: 'N/A', airdate }];
    // console.log(JSON.stringify(details));
    return JSON.stringify(details);
  } catch (error) {
    console.log('Details error:', error);
    return JSON.stringify([{ description: 'Error loading description', aliases: 'Aliases: N/A', airdate: 'Aired: Unknown' }]);
  }
}

async function extractEpisodes(url) {
  let episodes = [];
  let episodeSource;

  try {
    const html = await fetchHtml(url);
    const sourcesMatch = html.match(REGEX.episodeSources);
    if (!sourcesMatch) throw new Error('Failed to extract source');

    const sourcesHtml = sourcesMatch[1];
    episodeSource = extractMatches(sourcesHtml, REGEX.episodePage, matchAll = true);
  } catch (error) {
    console.log('Episode error [1]:', error);
    return JSON.stringify([]);
  }

  try {
    for (const episodePage of episodeSource) {
      const { href: pageUrl, title } = episodePage.groups || {};
      const episodeNumMatch = title.match(REGEX.episodeNum);
      const episodeNum = episodeNumMatch?.groups?.episodeNum?.trim();

      if (!episodeNum || episodeNum === '0') {
        console.log(`Skipped episode: [${title}]`);
        continue;
      }

      // https://chinaq.fun/tv-cn/202557998/ep1.html ==> https://chinaq.fun/qplays/202557998/ep1
      const episodeUrl = pageUrl.replace(/^\/[^/]+/,'/qplays').replace('.html','');

      episodes.unshift({
        href: chinaqBaseUrl + episodeUrl,
        number: parseInt(episodeNum, 10),
        title
      })
    }

    console.log(episodes);
    return JSON.stringify(episodes);
  } catch (error) {
    console.log('Episode error [2]:', error);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  console.log(`Stream URL: [${url}]`);

  try {
    const html = await fetchHtml(`${url}`);
    const sources = JSON.parse(html)?.video_plays;
    const streams = sources.map(source => source.play_data);
    const result = { streams };

    console.log("Result:", result);
    return JSON.stringify(result);
  } catch (error) {
    console.log('Fetch error in extractStreamUrl:', error);
    return null;
  }
}
