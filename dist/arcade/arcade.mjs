import { readArcadeDraft } from '../arcade-draft.mjs';

const draft = readArcadeDraft();
const referrer = document.referrer ? new URL(document.referrer) : null;
const fromHome = referrer?.origin === location.origin && referrer.pathname === '/';
const benchmark = draft?.benchmark ?? (fromHome ? referrer.searchParams.get('beat') : null);
const receiptUrl = new URL('../', location.href);

if (/^(?:100|(?:0|[1-9][0-9]?)(?:\.[0-9])?)$/.test(benchmark ?? '')) {
  receiptUrl.searchParams.set('beat', benchmark);
}
if (draft?.fromReceipt) receiptUrl.hash = 'score-receipt';

for (const link of document.querySelectorAll('a[href="../"]')) {
  link.href = receiptUrl.href;
}
