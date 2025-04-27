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
    return await fetch(url);
    // const html = await fetch(url);
    // return await html.text();
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
  const episodes = [];

  let sourceDict = {};
  let sourceNum = 1;
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
      const [_, pageUrl, episodeNumText] = episodePage;
      const episodeNum = episodeNumText.match(REGEX.episodeNum)?.[1]?.trim() || '0';

      if (!episodeNum) {
        console.log(`Skipped episode: [${episodeNumText}]`);
        continue;
      }

      // https://chinaq.fun/tv-cn/202557998/ep1.html ==> https://chinaq.fun/qplays/202557998/ep1
      const splitUrl = pageUrl.split('/');
      const splitFiltered = splitUrl.filter(item => item !== splitUrl[1]);
      const jsonUrl = splitFiltered.join('/').replace('.html', '');
      // console.log(`Accessing page ${chinaqBaseUrl + '/qplays' + jsonUrl}`);
      const pageHtml = await fetchHtml(chinaqBaseUrl + '/qplays' + jsonUrl);

      const sourcesMatch = JSON.parse(pageHtml)?.video_plays;
      for (const source of sourcesMatch) {
        const sourceName = source.src_site
        const href = source.play_data
        // console.log(`Source name: ${sourceName}, href: ${href}`)

        if (!sourceDict[sourceName]) {
          sourceDict[sourceName] = sourceNum * 100;
          sourceNum++;
        }

        const number = sourceDict[sourceName] + parseInt(episodeNum, 10);
        const title = `[${sourceName}] ${episodeNumText}`;
        episodes.push({href, number, title});
      }
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
  return url;
}

// searchResults('https://chinaq.fun/tv-cn/202557998/')
// extractDetails('https://chinaq.fun/tv-cn/202557998/')
// extractEpisodes('https://chinaq.fun/tv-cn/202557998/')
// extractStreamUrl('https://gimy.tv/ep-110414-8-1.html')
// extractStreamUrl('https://gimy.tv/ep-179316-5-5.html')
