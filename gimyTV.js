const baseUrl = "https://gimy.tv";


async function searchResults(keyword) {
  const results = [];
  const listRegex = /<li class="clearfix">([\s\S]*?)<\/li>/g;
  const hrefRegex = /<a class="myui-vodlist__thumb[\s\S]*?href="([^"]+)"/;
  const titleRegex = /<h4 class="title"><a[^>]*>([\s\S]*?)<\/a>/;
  const imgRegex = /<a class="myui-vodlist__thumb.+data-original="([^"]+)"/;

  try {
    const html = await fetch(`${baseUrl}/search/-------------.html?wd=${keyword}&submit=`);

    const items = html.matchAll(listRegex);

    for (const item of items) {
      const itemHtml = item[1];

      const hrefMatch = itemHtml.match(hrefRegex);
      const titleMatch = itemHtml.match(titleRegex);
      const imgMatch = itemHtml.match(imgRegex);

      if (hrefMatch && titleMatch && imgMatch) {
        const relHref = episodeMatch[1].trim();
        const title = titleMatch[1].trim();
        const image = imgMatch[1].trim();

        results.push({ title, image, href });
      }
    }

    return JSON.stringify(results);
  } catch (error) {
    console.log('Search error:', error);
    return JSON.stringify([{ title: 'Error', image: null, href: null }]);
  }
}


async function extractDetails(url) {
  const descriptionRegex = /<div[^>]*content">\s*<p>([\s\S]*?)<\/p>/;
  const airdateRegex = /年份：<\/span>\s*<a[^>]*>([^<]+)<\/a>/;

  try {
    const html = await fetch(url);

    const descriptionMatch = html.match(descriptionRegex);
    const description = descriptionMatch ? descriptionMatch[1].trim() : 'Error loading description';

    const airdateMatch = html.match(airdateRegex);
    const airdate = airdateMatch ? airdateMatch[1].trim() : 'Aired/Released: Unknown';

    const details = [{ description, alias: 'N/A', airdate }];

    return JSON.stringify(details);
  } catch (error) {
    console.log('Details error:', error);
    return JSON.stringify([{ description: 'Error loading description', aliases: 'Duration: Unknown', airdate: 'Aired: Unknown' }]);
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
    const html = await fetch(url);
    
    const sourcesMatch = html.match(sourcesRegex);
    if (!sourcesMatch) { throw new Error('Failed to extract source'); }
    const sourcesHtml = sourcesMatch[1];
    const sourceMatch = sourcesHtml.matchAll(sourceRegex);

    // Episode 205 -> Episode 5 from streaming source 2
    let count = 1;

    for (const source of sourceMatch) {
      // Count number of episodes from each source
      let sourceEpisodeCount = 0;

      const sourceHtml = source[1];
      const sourceNameHtml = sourceHtml.match(sourceNameRegex);
      const sourceName = sourceNameHtml[1].trim();
      
      const episodesMatch = sourceHtml.matchAll(episodeRegex);
      if (!episodesMatch) {
        console.log(`Episode error: fail to extract from source ${sourceName}`);
        continue;
      }

      // Check for duplicates to prevent creating unwanted "Season 2"
      let previousEpisode = 0;

      for (const episodeMatch of episodesMatch) {
        const href = baseUrl + episodeMatch[1].trim();
        const episodeNumText = episodeMatch[2];
        const episodeNum = episodeNumText.match(episodeNumRegex);

        if (!episodeNum || !relHref) {
          console.log(`Episode [${episodeNumText}] skipped [${relHref}]`);
          continue;
        }
        const number = count * 100 + parseInt(episodeNum[1].trim());

        // Skipping duplicate episodes (having the same or lower episode numbering)
        if (number <= previousEpisode) {
          console.log(`Duplicate Episode [${epi}] skipped [${relHref}]`);
          continue
        }

        episodes.push({ href: baseUrl + relHref, number, title });
        sourceEpisodeCount++;
      }
      count++;
    }

    return JSON.stringify(episodes);
  } catch (error) {
    console.log('Episode error:', error);
    return JSON.stringify([]);
  }
}


function urlConstructor(url, base) {
  const result = base.replace(/\/$/, '');
  const parts = url.split('/').filter(part => part !== '');
  return result + '/' + parts.join('/');
}


async function extractStreamUrl(url) {
  try {
    const html = await fetch(url);

    // Extract streamBase by removing index.m3u8 from matched URL
    const streamHtml = html.match(/player_data=[\s\S]*?"url":"([^"]*)index.m3u8"/);
    if (!streamHtml) {
      console.log(`Failed to extract stream from ${url}`);
      return null;
    }
    const streamBase = streamHtml[1].replace(/(?:\\(.))/g, '$1');

    const responseFile = await fetch(streamBase + 'index.m3u8');
    const fileData = responseFile;

    const streamRegex = /#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)[\r\n]+([^\r\n]+)/;
    const streamMatch = fileData.match(streamRegex);
    if (!streamMatch) {
      throw new Error(`Failed to extract stream URL from ${streamBase}index.m3u8`);
    }
    const result = urlConstructor(streamMatch[2], streamBase);
    console.log(`Streaming URL: ${result} [${streamMatch[2]}]`);
    return result;
  } catch (error) {
    console.log('Fetch error:', error);
    return null;
  }
}
