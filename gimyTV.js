const baseUrl = "https://gimy.tv"


function extractMatch(regex, text) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}


async function fetchHtml(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`[${response.status}] HTTP error!`);
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}


async function searchResults(keyword) {
  const results = [];
  const listRegex = /<li class="clearfix">([\s\S]*?)<\/li>/g;
  const hrefRegex = /<a class="myui-vodlist__thumb[\s\S]*?href="([^"]+)"/;
  const titleRegex = /<h4 class="title"><a[^>]*>([\s\S]*?)<\/a>/;
  const imgRegex = /<a class="myui-vodlist__thumb.+data-original="([^"]+)"/;

  try {
    const html = await fetchHtml(`${baseUrl}/search/-------------.html?wd=${keyword}&submit=`);

    const items = html.matchAll(listRegex);
    for (const item of items) {
      const itemHtml = item[1];

      const href = baseUrl + extractMatch(hrefRegex, itemHtml);
      const title = extractMatch(titleRegex, itemHtml);
      const image = extractMatch(imgRegex, itemHtml);

      if (href && title && image) {
        results.push({ title, image, href });
      }
    }

    console.log(JSON.stringify(results));
    return JSON.stringify(results);
  } catch (error) {
    console.error('Search error:', error);
    return [{ title: 'Error', image: '', href: '' }];
  }
}


async function extractDetails(url) {
  const descriptionRegex = /<div[^>]*content">\s*<p>([\s\S]*?)<\/p>/;
  const airdateRegex = /年份：<\/span>\s*<a[^>]*>([^<]+)<\/a>/;

  try {
    const html = await fetchHtml(url);
    
    const description = extractMatch(descriptionRegex, html) || 'Error loading description';
    const airdate = extractMatch(airdateRegex, html) || 'Aired/Released: Unknown';
    const details = [{ description, alias: 'N/A', airdate }];
    return JSON.stringify(details);
  } catch (error) {
    console.error('Details error:', error);
    return [{ description: 'Error loading description', aliases: 'Duration: Unknown', airdate: 'Aired: Unknown' }];
  }
}


async function extractEpisodes(url) {
  const episodes = [];

  const sourcesRegex = /col-md-wide-7[^>]*>([\s\S]*?)id="desc"/;
  const sourceRegex = /<div class="myui-panel myui[^>]*([\s\S]*?<\/ul>)/g;
  const sourceNameRegex = /<h3 class="title">([\s\S]*?)<\/h3>/;

  const episodeRegex = /<a class="btn[^>]*href="([^"]*)">([\s\S]*?)<\/a>/g;
  const episodeNumRegex = /第(\d+)集/;

  try {
    const html = await fetchHtml(url);

    const sourcesMatch = html.match(sourcesRegex);
    if (!sourcesMatch) throw new Error('Failed to extract sources');

    const sourcesHtml = sourcesMatch[1];
    const sourceMatch = sourcesHtml.matchAll(sourceRegex);

    // Episode 205 -> Episode 5 from streaming source 2
    let count = 1;
    for (const source of sourceMatch) {
      // Count number of episodes from each source
      let debugEpCount = 0;

      const sourceHtml = source[1];
      const sourceName = extractMatch(sourceNameRegex, sourceHtml);

      // Extract episodes from source and then from <li>
      const episodesMatch = sourceHtml.matchAll(episodeRegex);
      for (const episodeMatch of episodesMatch) {
        const href = baseUrl + extractMatch(/href="([^"]*)"/, episodeMatch[0]);
        const episodeNumText = extractMatch(/">([\s\S]*?)<\/a>/, episodeMatch[0]);
        const episodeNum = extractMatch(episodeNumRegex, episodeNumText);

        // Discard episodes with no numbering (TODO:)
        if (!episodeNum) continue;
        const number = count * 100 + parseInt(episodeNum);

        if (href && number) {
          episodes.push({ href, number, title: `[${sourceName}] ${episodeNumText}` });
          debugEpCount++;
        }
      }
      console.log(`Source [${sourceName}] has a total of ${debugEpCount} episodes.`);
      count++;
    }
    return JSON.stringify(episodes);
  } catch (error) {
    console.error('Episode error:', error);
    return JSON.stringify([]);
  }
}


async function extractStreamUrl(url) {
  try {
    const html = await fetchHtml(url);

    // Extract streamBase by removing index.m3u8 from matched URL
    const streamHtml = html.match(/player_data=[\s\S]*?"url":"([^"]*)index.m3u8"/);
    if (!streamHtml) {
      console.error(`Failed to extract stream from ${url}`);
      return null;
    }
    const streamBase = streamHtml[1].replace(/(?:\\(.))/g, '$1');
    const responseFile = await fetchHtml(streamBase + "index.m3u8");
    const fileData = responseFile;

    const streamRegex = /#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)[\r\n]+([^\r\n]+)/;
    const streamMatch = fileData.match(streamRegex);
    if (!streamMatch) {
      console.error(`Failed to extract stream URL from ${streamBase}index.m3u8`);
      return null;
    }
    const result = streamBase + streamMatch[2];

    console.log(result);
    return result;
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}
