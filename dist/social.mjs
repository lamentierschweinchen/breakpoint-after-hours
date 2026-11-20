export function createSocialShare(message, url) {
  const text = `${message}\n\nvia @MoustacheDAO`;
  const intent = new URL('https://x.com/intent/tweet');
  intent.search = new URLSearchParams({ text, url });
  return { text, url, xUrl: intent.href };
}
