const baseUrl = "https://gimy.tv";


function extractMatch(regex, text) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

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
      const relHref = extractMatch(hrefRegex, itemHtml);
      const title = extractMatch(titleRegex, itemHtml);
      const image = extractMatch(imgRegex, itemHtml);

      if (!relHref || !title || !image) continue;
      results.push({ title, image, href: baseUrl + relHref });
    }

    console.log(JSON.stringify(results));
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

    const description = extractMatch(descriptionRegex, html) || 'Error loading description';
    const airdate = extractMatch(airdateRegex, html) || 'Aired/Released: Unknown';
    const details = [{ description, alias: 'N/A', airdate }];
    console.log(JSON.stringify(details));
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
      const sourceName = extractMatch(sourceNameRegex, sourceHtml);
      
      const episodesMatch = sourceHtml.matchAll(episodeRegex);

      if (!episodesMatch) {
        console.log(`Fail to extract from source ${sourceName}`);
        continue;
      }

      // Check for duplicates to prevent creating unwanted "Season 2"
      let previousEpisode = 0;

      for (const episodeMatch of episodesMatch) {
        const relHref = extractMatch(/href="([^"]*)"/, episodeMatch[0]);
        const episodeNumText = extractMatch(/">([\s\S]*?)<\/a>/, episodeMatch[0]);
        const episodeNum = extractMatch(episodeNumRegex, episodeNumText);
        const title = sourceName;

        // TODO: Discarding episodes with no numbering such as special episodes
        if (!episodeNum || !relHref) {
          console.log(`Episode [${episodeNumText}] skipped [${relHref}]`);
          continue;
        }

        const number = count * 100 + parseInt(episodeNum);

        // Skipping duplicate episodes (having the same or lower episode numbering)
        if (number <= previousEpisode) {
          console.log(`Duplicate Episode [${episodeNumText}] skipped [${relHref}]`);
          continue
        }

        episodes.push({ href: baseUrl + relHref, number, title });
        sourceEpisodeCount++;
        previousEpisode = number;
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
    
    const streamHtml = html.match(/player_data=[\s\S]*?"url":"([^"]*)index.m3u8"/);
    if (!streamHtml) {
      console.log(`Failed to extract stream from ${url}`);
      return null;
    }
    const streamBase = streamHtml[1].replace(/(?:\\(.))/g, '$1');

    const fileData = await fetch(streamBase + 'index.m3u8');

    const streamRegex = /#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)[\r\n]+([^\r\n]+)/;
    const streamMatch = fileData.match(streamRegex);
    if (!streamMatch) {
      throw new Error(`Failed to extract stream URL from ${streamBase}index.m3u8`);
    }
    
    return urlConstructor(streamMatch[2], streamBase);
  } catch (error) {
    console.log('Streaming error:', error);
    return null;
  }
}
