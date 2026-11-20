const previous = document.referrer ? new URL(document.referrer) : null;

if (previous?.origin === location.origin && previous.pathname === '/') {
  const benchmark = previous.searchParams.get('beat');
  if (/^(?:100|(?:0|[1-9][0-9]?)(?:\.[0-9])?)$/.test(benchmark ?? '')) {
    for (const link of document.querySelectorAll('a[href="../"]')) {
      link.href = `../?beat=${benchmark}`;
    }
  }
}
