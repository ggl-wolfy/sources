// cSpell:words myui gimy
const gimyBaseUrl = "https://gimy.tv";

const REGEX = {
  detailsAirDate: /年份：<\/span>[\s\S]*?<a[^>]*>([^<]+)<\/a>/,
  detailsDesc: /<div[^>]*content">[\s\S]*?<p>([\s\S]*?)<\/p>/,
  episodeData: /<a class="btn[^>]*href="([^"]*)">([\s\S]*?)<\/a>/g,
  episodeNum: /第(\d+)集/,
  episodeSource: /<div class="myui-panel myui[^>]*([\s\S]*?<\/ul>)/g,
  episodeSourceName: /<h3 class="title">([\s\S]*?)<\/h3>/,
  episodeSources: /col-md-wide-7[^>]*>([\s\S]*?)id="desc"/,
  searchItemImg: /<a class="myui-vodlist__thumb[\s\S]*?data-original="([^"]+)"/,
  searchItemTitle: /<h4 class="title"><a[^>]*>([\s\S]*?)<\/a>/,
  searchItemUrl: /<a class="myui-vodlist__thumb[\s\S]*?href="([^"]+)"/,
  searchList: /<li class="clearfix">([\s\S]*?)<\/li>/g,
  streamData: /player_data=[\s\S]*?"url":"([^"]*)index.m3u8"/,
  streamResolution: /#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)[\r\n]+([^\r\n]+)/
};

async function fetchHtml(url) {
  try {
    return await fetch(url);
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
  return result ? result[1]?.trim() : null;
}

async function searchResults(keyword) {
  const results = [];
  try {
    const url = `${gimyBaseUrl}/search/-------------.html?wd=${keyword}&submit=`;
    const html = await fetchHtml(url);
    const items = extractMatches(html, REGEX.searchList, matchAll = true);

    for (const item of items) {
      const itemHtml = item[1];
      const href = extractMatches(itemHtml, REGEX.searchItemUrl);
      const title = extractMatches(itemHtml, REGEX.searchItemTitle);
      const image = extractMatches(itemHtml, REGEX.searchItemImg);

      if (href && title && image) {
        results.push({ title, image, href: gimyBaseUrl + href });
      }
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
  try {
    const html = await fetchHtml(url);
    const sourcesMatch = html.match(REGEX.episodeSources);
    if (!sourcesMatch) throw new Error('Failed to extract source');

    const sourcesHtml = sourcesMatch[1];
    const sourceMatch = extractMatches(sourcesHtml, REGEX.episodeSource, matchAll = true);

    let count = 100;
    for (const source of sourceMatch) {
      const sourceHtml = source[1];
      const sourceName = extractMatches(sourceHtml, REGEX.episodeSourceName)?.trim() || 'Unknown Source';
      const episodesMatch = extractMatches(sourceHtml, REGEX.episodeData, matchAll = true);

      if (!episodesMatch) {
        console.log(`Failed to extract episodes from source [${sourceName}]`);
        continue;
      }

      let previousEpisodeCount = 0;

      for (const episodeMatch of episodesMatch) {
        const href = gimyBaseUrl + episodeMatch[1].trim();
        const episodeNumText = episodeMatch[2].match(REGEX.episodeNum);
        const episodeNum = episodeNumText ? episodeNumText[1].trim() : '0';
        const number = count + parseInt(episodeNum, 10);

        if (number <= previousEpisodeCount) {
          console.log(`Skipped episode: [${episodeNumText}]`);
          continue;
        }

        episodes.push({ href, number, title: `[${sourceName}] ${episodeNumText}` });
        previousEpisodeCount = number;
      }
      count += 100;
    }

    // console.log(JSON.stringify(episodes));
    return JSON.stringify(episodes);
  } catch (error) {
    console.log('Episode error:', error);
    return JSON.stringify([]);
  }
}

function urlConstructor(baseUrl, relativeUrl) {
  const baseParts = baseUrl.split('/');
  const protocol = baseParts[0];

  const baseSegments = baseParts.slice(2).filter(segment => segment.length);
  const segments = relativeUrl.split('/').filter(segment => segment.length);
  const finalSegments = [...new Set([...baseSegments, ...segments])]; // Combine and deduplicate segments

  return `${protocol}//${finalSegments.join('/')}`;
}

async function extractStreamUrl(url) {
  try {
    const html = await fetchHtml(url);
    const streamHtml = html.match(REGEX.streamData);
    if (!streamHtml) {
      console.log(`Failed to extract stream from ${url}`);
      return null;
    }

    const streamBase = streamHtml[1].replace(/(?:\\(.))/g, '$1');
    const responseFile = await fetchHtml(`${streamBase}index.m3u8`);
    const streamMatch = responseFile.match(REGEX.streamResolution);
    if (!streamMatch) {
      console.log(`Failed to extract stream URL from ${streamBase}index.m3u8`);
      return url;
    }

    const result = urlConstructor(streamBase, streamMatch[2]);
    console.log(`Result: [${result}]`);
    return result;
  } catch (error) {
    console.log('Fetch error:', error);
    return url;
  }
}
