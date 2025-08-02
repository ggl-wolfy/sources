// cSpell:words myui gimy
const gimyBaseUrl = "https://gimy.tv";

const REGEX = {
  detailsAirDate: /<span class[\s\S]*?年份：[\s\S]*?<a[^>]*>([^<]+)<\/a>/,
  detailsDesc: / content">[\s]+?<p>(?:<span[^>]+?>)?([\s\S]*?)<\//,
  episodeData: /<a[^>]*href="([^"]*)">([\s\S]*?)<\/a>/g,
  episodeNum: /第(\d+)集/,
  episodeSource: /ul class="myui-content__list([\s\S]*?)<\/ul/g,
  searchItem: /href="([^"]+)" title="([^"]+)" data-original="([^"]+)"/,
  searchList: /class="clearfix"([\s\S]*?)<\/li/g,
  streamData: /player_data=[\s\S]*?"url":"([^"]*)index.m3u8"/,
  streamResolution: /#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)[\r\n]+([^\r\n]+)/
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
    return html.matchAll(regex);
  } else {
    const result = html.match(regex);
    return result ? result[1]?.trim() : null;
  }
}

async function searchResults(keyword) {
  const results = [];
  try {
    const url = `${gimyBaseUrl}/search/-------------.html?wd=${keyword}`;
    const html = await fetchHtml(url);
    const items = extractMatches(html, REGEX.searchList, matchAll = true);

    for (const item of items) {
      const itemHtml = item[1];
      const [_, href, title, image] = itemHtml.match(REGEX.searchItem);

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
    const description = extractMatches(html, REGEX.detailsDesc) || 'No description available';
    const airdate = extractMatches(html, REGEX.detailsAirDate) || 'Aired/Released: Unknown';
    const details = [{ description, alias: 'N/A', airdate }];

    // console.log(JSON.stringify(details));
    return JSON.stringify(details);
  } catch (error) {
    console.log('Details error:', error);
    return JSON.stringify([{ description: 'Error loading description', aliases: 'Aliases: N/A', airdate: 'Aired/Released: Unknown' }]);
  }
}

async function extractEpisodes(url) {
  const episodes = [];
  try {
    const html = await fetchHtml(url);
    const sourceMatch = extractMatches(html, REGEX.episodeSource, matchAll = true);

    let count = 100;
    for (const source of sourceMatch) {
      const sourceHtml = source[1];
      const sourceName = count;
      const episodesMatch = extractMatches(sourceHtml, REGEX.episodeData, matchAll = true);

      if (!episodesMatch) {
        console.log(`Failed to extract episodes from source [${sourceName}]`);
        continue;
      }

      let previousEpisodeCount = 0;

      for (const episodeMatch of episodesMatch) {
        const href = gimyBaseUrl + episodeMatch[1].trim();
        const episodeNumText = episodeMatch[2];
        const episodeNum = episodeNumText.match(REGEX.episodeNum)?.[1]?.trim() || '0';
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

    // console.log(episodes);
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
      return `${streamBase}index.m3u8`;
    }

    const result = urlConstructor(streamBase, streamMatch[2]);
    // console.log(`Result: [${result}]`);
    return result;
  } catch (error) {
    console.log('Fetch error:', error);
    return url;
  }
}
