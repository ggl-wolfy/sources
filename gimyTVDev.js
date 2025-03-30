// cSpell:words myui gimy
const gimyBaseUrl = "https://gimy.tv";

const REGEX = {
  detailsAirDate: /年份：<\/span>\s*<a[^>]*>([^<]+)<\/a>/,
  detailsDesc: /<div[^>]*content">\s*<p>([\s\S]*?)<\/p>/,
  episodeData: /<a class="btn[^>]*href="([^"]*)">([\s\S]*?)<\/a>/g,
  episodeNum: /第(\d+)集/,
  episodeSource: /<div class="myui-panel myui[^>]*([\s\S]*?<\/ul>)/g,
  episodeSourceName: /<h3 class="title">([\s\S]*?)<\/h3>/,
  episodeSources: /col-md-wide-7[^>]*>([\s\S]*?)id="desc"/,
  searchItemImg: /<a class="myui-vodlist__thumb.+data-original="([^"]+)"/,
  searchItemTitle: /<h4 class="title"><a[^>]*>([\s\S]*?)<\/a>/,
  searchItemUrl: /<a class="myui-vodlist__thumb[\s\S]*?href="([^"]+)"/,
  searchList: /<li class="clearfix">([\s\S]*?)<\/li>/g,
  streamData: /player_data=[\s\S]*?"url":"([^"]*)index.m3u8"/,
  streamResolution: /#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)[\r\n]+([^\r\n]+)/
};

async function fetchHtml(url) {
  try {
    const response = await fetch(url);
    // if (!response.ok) { throw new Error(`Failed to fetch ${url}`) }
    return await response.text();
  } catch (error) {
    console.log('Fetch error:', error);
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
      const hrefMatch = itemHtml.match(REGEX.searchItemUrl);
      const titleMatch = itemHtml.match(REGEX.searchItemTitle);
      const imgMatch = itemHtml.match(REGEX.searchItemImg);

      if (hrefMatch && titleMatch && imgMatch) {
        const href = gimyBaseUrl + hrefMatch[1].trim();
        const title = titleMatch[1].trim();
        const image = imgMatch[1].trim();
        results.push({ title, image, href });
      }
    }
    console.log(results);

    return JSON.stringify(results);
  } catch (error) {
    console.log('Search error:', error);
    return JSON.stringify([{ title: 'Error', image: null, href: null }]);
  }
}

async function extractDetails(url) {
  try {
    const html = await fetchHtml(url);
    const descriptionMatch = html.match(REGEX.detailsDesc);
    const description = descriptionMatch ? descriptionMatch[1].trim() : 'N/A';
    const airdateMatch = html.match(REGEX.detailsAirDate);
    const airdate = airdateMatch ? airdateMatch[1].trim() : 'N/A';
    const details = [{ description, alias: 'N/A', airdate }];
    console.log(details);
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
    if (!sourcesMatch) {
      throw new Error('Failed to extract source');
    }
    const sourcesHtml = sourcesMatch[1];
    const sourceMatch = extractMatches(sourcesHtml, REGEX.episodeSource, matchAll = true);

    let count = 1;
    for (const source of sourceMatch) {
      let sourceEpisodeCount = 0;
      let previousEpisodeCount = 0;
      const sourceHtml = source[1];
      const sourceNameHtml = sourceHtml.match(REGEX.episodeSourceName);
      const sourceName = sourceNameHtml ? sourceNameHtml[1].trim() : 'Unknown Source';
      const episodesMatch = extractMatches(sourceHtml, REGEX.episodeData, matchAll = true);

      if (!episodesMatch) {
        console.log(`Episode error: fail to extract from source ${sourceName}`);
        continue;
      }

      for (const episodeMatch of episodesMatch) {
        const href = gimyBaseUrl + episodeMatch[1].trim();
        const episodeNumText = episodeMatch[2];
        const episodeNum = episodeNumText.match(REGEX.episodeNum);

        if (!episodeNum) continue;
        const number = count * 100 + parseInt(episodeNum[1].trim(), 10);
        if (number <= previousEpisodeCount) {
          console.log(`Skipped episode: [${episodeNumText}]`);
          continue;
        }

        episodes.push({ href, number, title: `[${sourceName}] ${episodeNumText}` });
        sourceEpisodeCount++;
        previousEpisodeCount = number;
      }
      count++;
    }

    console.log(episodes);
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
      throw new Error(`Failed to extract stream URL from ${streamBase}index.m3u8`);
    }
    const result = urlConstructor(streamBase, streamMatch[2]);
    console.log(`Result: [${result}]`);
    return result;
  } catch (error) {
    console.log('Fetch error:', error);
    return null;
  }
}
