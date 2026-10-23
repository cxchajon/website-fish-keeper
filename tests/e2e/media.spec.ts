import { test, expect } from '@playwright/test';

test.describe('Media hub embeds', () => {
  test('featured video, community, and Aquarium Library content render', async ({ page }, testInfo) => {
    await page.goto('/media.html');

    // Featured YouTube video: an embedded player plus an outbound title link.
    const featured = page.locator('.featured-video');
    await expect(featured.locator('.video-embed iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube\.com\/embed\//);
    await expect(featured.locator('.video-embed iframe')).toHaveAttribute('title', /\S+/);
    const ytNowPlaying = featured.locator('.now-playing-title a');
    await expect(ytNowPlaying).toHaveAttribute('target', '_blank');
    await expect(ytNowPlaying).toHaveAttribute('rel', /noopener/);
    await expect(ytNowPlaying).toHaveText(/\S+/);

    const channelLink = page.locator('.video-actions .yt-cta');
    await expect(channelLink).toHaveAttribute('href', /youtube\.com\/@FishKeepingLifeCo/);
    await expect(channelLink).toHaveAttribute('target', '_blank');
    await expect(page.locator('.community-video-cta a')).toHaveAttribute('href', /\/pages\/community-video-picks\.html$/);

    // Community: featured tank image and its calls to action.
    const community = page.locator('#community');
    const featuredTank = community.locator('.featured-tank-figure img');
    await expect(featuredTank).toHaveAttribute('alt', /.+/);
    await featuredTank.scrollIntoViewIfNeeded();
    await expect.poll(() => featuredTank.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
    await expect(community.getByRole('link', { name: 'Submit your tank' })).toHaveAttribute('href', '/submit-your-tank.html');

    // Aquarium Library: Blogs, University, Journal, and Podcast books, each with a loaded cover.
    const books = page.locator('#aquarium-library .alib-book');
    await expect(books).toHaveCount(4);
    const hrefs = await books.evaluateAll((links) => links.map((link) => new URL(link.getAttribute('href') || '', 'https://thetankguide.com').pathname));
    expect(hrefs).toEqual(['/blogs/', '/university/', '/journal.html', '/podcast/']);
    for (let i = 0; i < 4; i += 1) {
      const cover = books.nth(i).locator('img');
      await cover.scrollIntoViewIfNeeded();
      await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
    }

    await page.locator('#aquarium-library').screenshot({ path: testInfo.outputPath('media-library.png') });
  });
});
