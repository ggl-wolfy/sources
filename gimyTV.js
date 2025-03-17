const baseUrl = "https://gimy.tv"

async function searchResults(keyword) {
  const results = [];
  const listRegex = /<li class="clearfix">([\s\S]*?)<\/li>/g;

  try {
    const html = await fetch(`${baseUrl}/search/-------------.html?wd=${keyword}&submit=`);

    const items = html.matchAll(listRegex);

    for (const item of items) {
      const itemHtml = item[1];

      const hrefMatch = itemHtml.match(/<a class="myui-vodlist__thumb[\s\S]*?href="([^"]+)"/);

      // Extract title from <h4 class="title"><a class...>TITLE</a></h4>
      const titleMatch = itemHtml.match(/<h4 class="title"><a[^>]*>([\s\S]*?)<\/a>/);

      // Extract image URL from <img ... src="...">
      const imgMatch = itemHtml.match(/<a class="myui-vodlist__thumb.+data-original="([^"]+)"/);

      if (hrefMatch && titleMatch && imgMatch) {
        const href = baseUrl + hrefMatch[1].trim();
        const title = titleMatch[1].trim();
        const image = imgMatch[1].trim();

        results.push({ title, image, href });
      }
    }

    console.log(JSON.stringify(results));
    return JSON.stringify(results);
  } catch (error) {
    console.log('Search error:', error);
    return [{ title: 'Error', image: '', href: '' }];
  }
}


async function extractDetails(url) {
  const details = [];

  try {
    const html = await fetch(url);

    // Extract description from the <div ... class="content"><p>Desc Here</p>
    const descriptionMatch = html.match(/<div[^>]*content">\s*<p>([\s\S]*?)<\/p>/);
    let description = descriptionMatch ? descriptionMatch[1].trim() : 'N/A';

    // Extract airdate from the "Year Started" field
    const airdateMatch = html.match(/年份：<\/span>\s*<a[^>]*>([^<]+)<\/a>/);
    let airdate = airdateMatch ? airdateMatch[1].trim() : 'N/A';

    details.push({
      description: description,
      alias: 'N/A',
      airdate: airdate
    });

    console.log(JSON.stringify(details));
    return JSON.stringify(details);
  } catch (error) {
    console.log('Details error:', error);
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
    const html = await fetch(url);

    // Attempt to extract source from the <div class="col-md-wide-7"> list
    const sourcesMatch = html.match(sourcesRegex);
    const sourcesHtml = sourcesMatch[1];
    const sourceMatch = sourcesHtml.matchAll(sourceRegex);

    // Episode 205 -> Episode 5 from streaming source 2
    let count = 1;

    for (const source of sourceMatch) {
      // Count number of episodes from each source
      let debugEpCount = 0;

      const sourceHtml = source[1];
      const sourceNameHtml = sourceHtml.match(sourceNameRegex);
      const sourceName = sourceNameHtml[1].trim();

      // Extract episodes from source and then from <li>
      const episodesMatch = sourceHtml.matchAll(episodeRegex);
      if (!episodesMatch) {
        console.log(`Episode error: fail to extract from source ${sourceName}`)
      }

      for (const episodeMatch of episodesMatch) {
        const href = baseUrl + episodeMatch[1].trim();
        const episodeNumText = episodeMatch[2];
        const episodeNum = episodeNumText.match(episodeNumRegex);

        if (!episodeNum) continue;
        const number = count * 100 + parseInt(episodeNum[1].trim());

        if (href && episodeNumber) {
          episodes.push({ href, number, title: `[${sourceName}] ${episodeNumText}` });
          debugEpCount++;
        }
      }
      console.log(`Source [${sourceName}] has a total of ${debugEpCount} episodes.`);
      count++;
    }

    // console.log(episodes);
    return JSON.stringify(episodes);
  } catch (error) {
    console.log('Episode error:', error);
    return JSON.stringify([]);
  }
}


async function extractStreamUrl(url) {
  try {
    const html = await fetch(url);

    // Extract streamBase by removing index.m3u8 from matched URL
    const streamHtml = html.match(/player_data=[\s\S]*?"url":"([^"]*)index.m3u8"/);
    const streamBase = streamHtml[1].replace(/(?:\\(.))/g, '$1');

    const responseFile = await fetch(streamBase + "index.m3u8");
    const fileData = responseFile;

    const streamRegex = /#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)[\r\n]+([^\r\n]+)/;
    const streamMatch = fileData.match(streamRegex);
    if (!streamMatch) {
      console.error(`Failed to extract stream URL from ${streamBase}index.m3u8`);
      return null;
    }
    // const resolution = streamMatch[1];
    const result = streamBase + streamMatch[2];
    console.log(result);
    return result;
  } catch (error) {
    console.log('Fetch error:', error);
    return null;
  }
}
