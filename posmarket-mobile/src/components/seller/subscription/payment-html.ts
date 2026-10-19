/**
 * Page de paiement embarquée (WebView) — pendant mobile des widgets du web
 * (`useKkiapay`, `useFedapay`, `useFeexpay`).
 *
 * Les SDK des opérateurs sont des scripts navigateur (`k.js`, `checkout.js`,
 * `feexpay-javascript-sdk`) : ils sont chargés dans une page HTML locale,
 * ouverte dans une WebView React Native. Le guichet s'affiche donc à
 * l'identique, et chaque évènement est renvoyé à l'app via
 * `window.ReactNativeWebView.postMessage` :
 *
 * - `{ type: 'success', reference }`   → confirmation serveur puis modale ;
 * - `{ type: 'cancelled', message }`   → guichet fermé sans paiement ;
 * - `{ type: 'failed', message }`      → échec opérateur ;
 * - `{ type: 'module-missing' }`       → script non chargé.
 */

import type { PaymentProvider, SubscriptionDuration } from '@/api/seller-subscription';

export interface PaymentHtmlParams {
  provider: PaymentProvider;
  amount: number;
  transactionId: string;
  tier: string;
  duration: SubscriptionDuration;
  userName: string;
  userEmail: string;
  userPhone: string;
  kkiapayPublicKey: string;
  kkiapayEnv: 'sandbox' | 'live';
  fedapayPublicKey: string;
  fedapayEnv: 'sandbox' | 'live';
  feexpayShopId: string;
  feexpayApiKey: string;
  feexpayEnv: 'sandbox' | 'live';
}

const SCRIPT_URLS: Record<PaymentProvider, string> = {
  kkiapay: 'https://cdn.kkiapay.me/k.js',
  fedapay: 'https://cdn.fedapay.com/checkout.js?v=1.1.7',
  feexpay: 'https://api-v2.feexpay.me/feexpay-javascript-sdk/index.js',
};

export function buildPaymentHtml(params: PaymentHtmlParams): string {
  const scriptUrl = SCRIPT_URLS[params.provider];
  const config = JSON.stringify({
    provider: params.provider,
    amount: params.amount,
    transactionId: params.transactionId,
    tier: params.tier,
    duration: params.duration,
    userName: params.userName,
    userEmail: params.userEmail,
    userPhone: params.userPhone,
    kkiapayPublicKey: params.kkiapayPublicKey,
    kkiapayEnv: params.kkiapayEnv,
    fedapayPublicKey: params.fedapayPublicKey,
    fedapayEnv: params.fedapayEnv,
    feexpayShopId: params.feexpayShopId,
    feexpayApiKey: params.feexpayApiKey,
    feexpayEnv: params.feexpayEnv,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>Paiement</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #F8FAFC; }
  body { font-family: -apple-system, Roboto, "Segoe UI", sans-serif; }
  #status { position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; color: #475569; text-align: center; padding: 24px; }
  .spinner { width: 34px; height: 34px; border-radius: 50%;
    border: 3px solid #FFE3D3; border-top-color: #F56B2A;
    animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  #status p { font-size: 13px; font-weight: 600; margin: 0; }
</style>
</head>
<body>
<div id="status"><div class="spinner"></div><p>Ouverture du guichet de paiement...</p></div>
<script src="${scriptUrl}"></script>
<script>
(function () {
  var CFG = ${config};

  function post(payload) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch (e) {}
  }

  function hideStatus() {
    var el = document.getElementById('status');
    if (el) el.style.display = 'none';
  }

  function waitFor(check, timeoutMs, onReady, onTimeout) {
    var startedAt = Date.now();
    (function poll() {
      var value;
      try { value = check(); } catch (e) { value = null; }
      if (value) { onReady(value); return; }
      if (Date.now() - startedAt > timeoutMs) { onTimeout(); return; }
      setTimeout(poll, 100);
    })();
  }

  function startKkiapay() {
    waitFor(
      function () { return typeof window.openKkiapayWidget === 'function' ? window.openKkiapayWidget : null; },
      8000,
      function (open) {
        try {
          if (typeof window.addSuccessListener === 'function') {
            window.addSuccessListener(function (res) {
              var id = '';
              if (typeof res === 'string') id = res;
              else if (res && typeof res === 'object') {
                id = String(res.transactionId || res.id || res.token || '');
              }
              post({ type: 'success', reference: String(id || '') });
            });
          }
          if (typeof window.addFailedListener === 'function') {
            window.addFailedListener(function (err) {
              var message = '';
              if (err && typeof err === 'object') message = String(err.message || err.reason || '');
              post({ type: 'failed', message: message });
            });
          }
          hideStatus();
          open({
            amount: String(CFG.amount),
            key: CFG.kkiapayPublicKey,
            sandbox: CFG.kkiapayEnv === 'sandbox',
            position: 'center',
            theme: '#f56b2a',
            paymentmethod: ['momo'],
            countries: ['BJ'],
            partnerId: CFG.transactionId,
            data: JSON.stringify({ tier: CFG.tier, duration: CFG.duration }),
            name: CFG.userName || '',
            email: CFG.userEmail || '',
            phone: CFG.userPhone || '',
            callback: ''
          });
        } catch (e) {
          post({ type: 'failed', message: String((e && e.message) || e) });
        }
      },
      function () { post({ type: 'module-missing' }); }
    );
  }

  function startFedapay() {
    waitFor(
      function () { return window.FedaPay || null; },
      8000,
      function (FedaPay) {
        try {
          var pubKey = String(CFG.fedapayPublicKey || '').trim();
          var env = pubKey.indexOf('pk_live') === 0 ? 'live' : (CFG.fedapayEnv || 'sandbox');
          var nameParts = String(CFG.userName || '').trim().split(' ');
          var config = {
            public_key: pubKey,
            environment: env,
            transaction: {
              amount: Math.round(Number(CFG.amount) || 0),
              description: 'Abonnement ' + CFG.tier + ' - ' + CFG.duration + ' (ref: ' + CFG.transactionId + ')',
              custom_metadata: { partnerId: CFG.transactionId }
            },
            currency: { iso: 'XOF' },
            customer: {
              email: (CFG.userEmail || '').trim() || 'client@posmarket.com',
              firstname: nameParts[0] || 'Client',
              lastname: nameParts.slice(1).join(' ') || 'PosMarket'
            },
            onComplete: function (res) {
              var reasonStr = String((res && res.reason) || '').trim().toUpperCase();
              var txObj = (res && res.transaction) || res || {};
              var txStatus = String(txObj.status || '').trim().toLowerCase();
              var isApproved = reasonStr === 'CHECKOUT COMPLETE' || reasonStr === 'CHECKOUT_COMPLETE' ||
                reasonStr === 'CHECKOUT_COMPLETED' || reasonStr === 'COMPLETE' ||
                res && res.reason === 1 ||
                txStatus === 'approved' || txStatus === 'success' ||
                txStatus === 'transferred' || txStatus === 'completed';
              if (isApproved) {
                var id = String(txObj.id || txObj.reference || '').trim();
                post({ type: 'success', reference: id });
              } else if (reasonStr === 'DIALOG DISMISSED' || reasonStr === 'DIALOG_DISMISSED' || reasonStr === 'DISMISSED') {
                if (txStatus === 'approved' || txStatus === 'success') {
                  post({ type: 'success', reference: String(txObj.id || txObj.reference || '').trim() });
                } else {
                  post({ type: 'cancelled' });
                }
              } else {
                post({ type: 'failed', message: reasonStr || '' });
              }
            }
          };
          hideStatus();
          var widget;
          if (typeof FedaPay.init === 'function') {
            var res = FedaPay.init(config);
            widget = Array.isArray(res) ? res[0] : res;
          } else if (typeof FedaPay === 'function') {
            widget = FedaPay(config);
          }
          if (widget && typeof widget.open === 'function') widget.open();
          else post({ type: 'failed', message: "Impossible d'ouvrir le widget FedaPay" });
        } catch (e) {
          post({ type: 'failed', message: String((e && e.message) || e) });
        }
      },
      function () { post({ type: 'module-missing' }); }
    );
  }

  function startFeexpay() {
    waitFor(
      function () {
        return window.FeexPayButton && typeof window.FeexPayButton.init === 'function'
          ? window.FeexPayButton
          : null;
      },
      8000,
      function (api) {
        try {
          var settled = false;
          function settle(payload) {
            if (settled) return;
            settled = true;
            post(payload);
          }

          var mount = document.getElementById('feexpay-posmarket-mount');
          if (!mount) {
            mount = document.createElement('div');
            mount.id = 'feexpay-posmarket-mount';
            mount.style.display = 'none';
            document.body.appendChild(mount);
          }

          api.init('feexpay-posmarket-mount', {
            id: String(CFG.feexpayShopId || '').trim(),
            amount: Math.round(Number(CFG.amount) || 0),
            token: CFG.feexpayApiKey,
            mode: CFG.feexpayEnv === 'live' ? 'LIVE' : 'SANDBOX',
            currency: 'XOF',
            description: 'Abonnement ' + CFG.tier + ' - ' + CFG.duration,
            callback_info: CFG.transactionId,
            callback: function (res) {
              var status = String((res && res.status) || '').toUpperCase();
              if (status === 'SUCCESSFUL' || status === 'SUCCESS') {
                var ref = String((res && (res.reference || res.transaction_id)) || '').trim();
                settle({ type: 'success', reference: ref });
              } else {
                settle({ type: 'failed', message: String((res && res.message) || '') });
              }
            }
          });

          hideStatus();

          var attempts = 0;
          var shown = false;
          var timer = setInterval(function () {
            if (settled) { clearInterval(timer); return; }
            var overlay = document.querySelector('.feexpay-modal-overlay');
            if (!overlay) {
              clearInterval(timer);
              settle({ type: 'failed', message: 'Guichet FeexPay indisponible.' });
              return;
            }
            if (overlay.classList.contains('active')) { shown = true; return; }
            if (shown) {
              clearInterval(timer);
              settle({ type: 'cancelled' });
              return;
            }
            api.showPaymentModal();
            attempts += 1;
            if (attempts > 60) {
              clearInterval(timer);
              settle({ type: 'failed', message: "Impossible d'ouvrir le guichet FeexPay (shop ID ou clé API invalide)." });
            }
          }, 50);
        } catch (e) {
          post({ type: 'failed', message: String((e && e.message) || e) });
        }
      },
      function () { post({ type: 'module-missing' }); }
    );
  }

  if (CFG.provider === 'fedapay') startFedapay();
  else if (CFG.provider === 'feexpay') startFeexpay();
  else startKkiapay();
})();
</script>
</body>
</html>`;
}
