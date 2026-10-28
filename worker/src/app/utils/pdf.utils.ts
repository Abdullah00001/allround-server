import puppeteer from 'puppeteer';
import logger from '@/app/configs/logger.configs';

export const renderHtmlToPdf = async (
  htmlContent: string
): Promise<Uint8Array> => {
  let browser;
  try {
    // Determine executable path: if in Docker (PUPPETEER_EXECUTABLE_PATH is set), use it.
    // Otherwise fallback to Puppeteer's bundled Chromium or common local paths.
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

    browser = await puppeteer.launch({
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      headless: true,
    });

    const page = await browser.newPage();

    // Set content and wait for network to be idle (so fonts and external CSS load)
    await page.setContent(htmlContent, { waitUntil: 'load' });
    await page.waitForNetworkIdle();

    // Generate PDF with required template settings
    const pdfUint8Array = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });

    return pdfUint8Array;
  } catch (error) {
    logger.error('[renderHtmlToPdf] Failed to render HTML to PDF', error);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        logger.error('[renderHtmlToPdf] Failed to close browser', closeError);
      }
    }
  }
};
