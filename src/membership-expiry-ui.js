export const membershipExpiryUi = String.raw`(() => {
  if (window.__yvMembershipExpiryLoaded) return;
  window.__yvMembershipExpiryLoaded = true;

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
  const dateText = value => {
    const seconds = Number(value || 0);
    return seconds > 0 ? new Date(seconds * 1000).toLocaleDateString('tr-TR') : 'tarih bilgisi yok';
  };
  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'same-origin', cache: 'no-store', ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || data.message || 'İstek tamamlanamadı.');
    return data;
  };
  const style = document.createElement('style');
  style.textContent = '.membership-expired-tab .membership-expired-count{display:inline-flex;align-items:center;justify-content:center;min-width:1.35rem;height:1.35rem;margin-left:.4rem;padding:0 .35rem;border-radius:999px;background:#b42318;color:#fff;font-size:.75rem;font-weight:800}.membership-expired-tab.has-expired{border-color:#b42318;color:#8e1f16}.membership-expired-list{display:grid;gap:12px;margin-top:16px}.membership-expired-card,.membership-renewal-card{border:1px solid #d8e1e9;border-radius:14px;padding:16px;background:#fff}.membership-expired-card h3,.membership-renewal-card h3{margin:0 0 6px}.membership-expired-card .fine,.membership-renewal-card .fine{margin:4px 0}.membership-extension-form,.membership-payment-form{display:flex;flex-wrap:wrap;align-items:end;gap:10px;margin-top:12px}.membership-extension-form label,.membership-payment-form label{display:grid;gap:5px}.membership-extension-form input,.membership-extension-form select,.membership-payment-form select{min-height:42px;padding:8px;border:1px solid #b8c5d1;border-radius:8px}.membership-admin-extension{flex:1 1 100%;padding:8px 10px;border:1px solid #d8e1e9;border-radius:10px;background:#f7fafc}.membership-admin-extension summary{cursor:pointer;font-weight:700}.membership-admin-extension[open]{background:#fff}.membership-renewal-panel{margin:18px 0;padding:18px;border:1px solid #d8e1e9;border-radius:16px;background:#fff}.membership-plan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:14px 0}.membership-plan-card{padding:12px;border:1px solid #d8e1e9;border-radius:12px;background:#f7fafc}.membership-plan-card strong{display:block;margin-bottom:4px}.membership-payment-status{min-height:1.4em}.membership-iban{overflow-wrap:anywhere;font-weight:800;letter-spacing:.03em}.membership-expired-warning{color:#9b1c1c;font-weight:700}@media(max-width:600px){.membership-expired-card,.membership-renewal-card{padding:13px}.membership-extension-form>*{flex:1 1 120px}}';
  document.head.append(style);

  async function initAdmin() {
    const panel = document.querySelector('#panel-listing-checks');
    if (!panel || panel.dataset.membershipUiReady) return;
    const tabs = panel.querySelector('.listing-status-tabs[aria-label="İlan kontrol durumu"]') || panel.querySelector('.listing-status-tabs');
    const currentList = panel.querySelector('#listing-check-list');
    if (!tabs || !currentList) return;
    panel.dataset.membershipUiReady = '1';
    const attachListingControls = () => {
      document.querySelectorAll('#listing-admin-list .listing-admin-row, #listing-check-list .listing-admin-row').forEach(row => {
        if (row.dataset.membershipExtensionReady) return;
        const packageControl = row.querySelector('[data-package-tier]');
        const id = packageControl?.dataset.packageTier;
        const ownerRole = row.dataset.membershipOwner;
        const category = row.dataset.membershipCategory;
        if (!id || ownerRole === 'admin' || category === 'operator') return;
        row.dataset.membershipExtensionReady = '1';
        const expiry = Math.max(Number(row.dataset.membershipPaidUntil || 0), Number(row.dataset.membershipTrialExpires || 0));
        const details = document.createElement('details');
        details.className = 'membership-admin-extension';
        details.innerHTML = '<summary>Üyelik süresini yönet</summary><form class="membership-extension-form" data-membership-extension="' + esc(id) + '"><small>Mevcut bitiş: ' + esc(dateText(expiry)) + '</small><label>Uzatılacak gün<input name="days" type="number" min="1" max="365" value="30" required></label><label>Uzatma paketi<select name="package_tier"><option value="standard">Standart · 599 TL</option><option value="featured">Öne Çıkan · 2.899 TL</option><option value="premium">Premium · 3.000 TL</option></select></label><button type="submit">Seçimi uygula</button><span class="membership-payment-status" role="status"></span></form>';
        packageControl.closest('label')?.insertAdjacentElement('afterend', details);
        const form = details.querySelector('form');
        form.elements.package_tier.value = ['standard', 'featured', 'premium'].includes(packageControl.value) ? packageControl.value : 'standard';
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const button = form.querySelector('button[type="submit"]');
          const status = form.querySelector('.membership-payment-status');
          button.disabled = true;
          status.textContent = 'Süre güncelleniyor…';
          try {
            const result = await requestJson('/api/admin-listings', { method: 'PATCH', body: JSON.stringify({ id, action: 'extend_days', days: Number(form.elements.days.value), package_tier: form.elements.package_tier.value }) });
            row.dataset.membershipPaidUntil = String(result.paid_until || 0);
            row.dataset.membershipTrialExpires = '0';
            details.querySelector('small').textContent = 'Yeni bitiş: ' + dateText(result.paid_until);
            status.textContent = 'İlan süresi ' + result.days + ' gün uzatıldı.';
            await updateBadge();
            if (active) await loadExpired();
          } catch (error) {
            status.textContent = error.message;
            button.disabled = false;
          }
        });
      });
    };
    attachListingControls();
    const listObserver = typeof MutationObserver === 'function' ? new MutationObserver(attachListingControls) : null;
    if (listObserver) {
      ['#listing-admin-list', '#listing-check-list'].forEach(selector => {
        const list = document.querySelector(selector);
        if (list) listObserver.observe(list, { childList: true, subtree: true });
      });
    }
    const expiredList = document.createElement('div');
    expiredList.id = 'membership-expired-list';
    expiredList.className = 'membership-expired-list';
    expiredList.hidden = true;
    currentList.insertAdjacentElement('afterend', expiredList);
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'membership-expired-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.innerHTML = 'Üyelik süresi dolanlar <span class="membership-expired-count" id="membership-expired-count" hidden></span>';
    tabs.append(tab);
    const badge = tab.querySelector('#membership-expired-count');
    let active = false;
    let loading = false;
    const updateBadge = async () => {
      try {
        const data = await requestJson('/api/admin-listings?status=expired');
        const count = Number(data.expired_count || 0);
        badge.textContent = String(count);
        badge.hidden = count === 0;
        tab.classList.toggle('has-expired', count > 0);
      } catch {}
    };
    const loadExpired = async () => {
      if (loading) return;
      loading = true;
      expiredList.innerHTML = '<p class="fine">Süresi dolan ilanlar yükleniyor…</p>';
      try {
        const data = await requestJson('/api/admin-listings?status=expired');
        const rows = Array.isArray(data.items) ? data.items : [];
        const count = Number(data.expired_count || rows.length);
        badge.textContent = String(count);
        badge.hidden = count === 0;
        tab.classList.toggle('has-expired', count > 0);
        expiredList.innerHTML = rows.length ? rows.map(item => {
          const id = esc(item.id);
          const tier = ['standard', 'featured', 'premium'].includes(item.package_tier) ? item.package_tier : 'standard';
          return '<article class="membership-expired-card"><div><h3>' + esc(item.title) + '</h3><p class="fine">' + esc(item.city) + ' / ' + esc(item.district) + ' · ' + esc(item.owner_email || 'Üye') + '</p><p class="fine membership-expired-warning">Üyelik süresi doldu · Son bitiş: ' + esc(dateText(Math.max(Number(item.paid_until || 0), Number(item.trial_expires_at || 0)))) + '</p></div><form class="membership-extension-form" data-membership-extension="' + id + '"><label>Uzatılacak gün<input name="days" type="number" min="1" max="365" value="30" required></label><label>Yeni paket<select name="package_tier"><option value="standard"' + (tier === 'standard' ? ' selected' : '') + '>Standart</option><option value="featured"' + (tier === 'featured' ? ' selected' : '') + '>Öne Çıkan</option><option value="premium"' + (tier === 'premium' ? ' selected' : '') + '>Premium</option></select></label><button type="submit">Süreyi uzat</button></form><p class="membership-payment-status" role="status"></p></article>';
        }).join('') : '<p class="fine">Süresi dolan üyelik bulunmuyor.</p>';
        expiredList.querySelectorAll('[data-membership-extension]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          const submit = form.querySelector('button[type="submit"]');
          const status = form.closest('article').querySelector('.membership-payment-status');
          submit.disabled = true;
          status.textContent = 'Süre güncelleniyor…';
          try {
            const data = await requestJson('/api/admin-listings', { method: 'PATCH', body: JSON.stringify({ id: form.dataset.membershipExtension, action: 'extend_days', days: Number(form.elements.days.value), package_tier: form.elements.package_tier.value }) });
            status.textContent = data.ok ? 'İlan süresi ' + data.days + ' gün uzatıldı.' : 'Süre güncellenemedi.';
            await loadExpired();
          } catch (error) {
            status.textContent = error.message;
            submit.disabled = false;
          }
        }));
      } catch (error) {
        expiredList.innerHTML = '<p class="fine" role="alert">' + esc(error.message) + '</p>';
      } finally {
        loading = false;
      }
    };
    tab.addEventListener('click', async () => {
      active = true;
      tabs.querySelectorAll('[role="tab"]').forEach(button => {
        const selected = button === tab;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-selected', String(selected));
      });
      currentList.hidden = true;
      expiredList.hidden = false;
      await loadExpired();
    });
    tabs.querySelectorAll('[data-check-status]').forEach(button => button.addEventListener('click', () => {
      active = false;
      expiredList.hidden = true;
      currentList.hidden = false;
    }));
    updateBadge();
    const dashboard = document.querySelector('#dashboard');
    if (dashboard && typeof MutationObserver === 'function') {
      new MutationObserver(() => { if (!dashboard.hidden) updateBadge(); }).observe(dashboard, { attributes: true, attributeFilter: ['hidden'] });
    }
    window.setInterval(() => { if (!document.hidden && !panel.hidden) updateBadge(); }, 60000);
  }

  async function initAccount() {
    const account = document.querySelector('#account-view');
    if (!account || account.dataset.membershipUiReady) return;
    account.dataset.membershipUiReady = '1';
    const panel = document.createElement('section');
    panel.id = 'membership-renewal-panel';
    panel.className = 'membership-renewal-panel account-card';
    panel.innerHTML = '<h2>Üyelik süresi ve yenileme</h2><p class="fine">Süreli ilanlarınızın bitiş tarihini buradan görebilir, süresi dolan ilan için havale ile yenileme talebi gönderebilirsiniz.</p><div class="membership-plan-grid"><div class="membership-plan-card"><strong>Standart · 599 TL / 30 gün</strong>İlan yalnızca YükVinç sitesinde yayında kalır.</div><div class="membership-plan-card"><strong>Öne Çıkan · 2.899 TL / 30 gün</strong>Ara sıra Google reklamlarında tanıtım yapılır; gösterim sıklığı ve sonuç garanti edilmez.</div><div class="membership-plan-card"><strong>Premium · 3.000 TL / 30 gün</strong>Sitede Premium etiketi ve site içi aramalarda öncelik; ilanınıza özel reklam çalışması. Google sıralaması garanti edilmez.</div></div><p>Havale alıcısı: <strong>Osman Serhat Karakaya</strong></p><p>IBAN: <span class="membership-iban">TR92 0006 2000 7700 0000 6997 451</span></p><div id="membership-account-list" aria-live="polite"><p class="fine">İlan süreleri yükleniyor…</p></div></section>';
    const anchor = account.querySelector('.account-top') || account.querySelector('#my-listings');
    if (anchor) anchor.insertAdjacentElement(anchor.id === 'my-listings' ? 'beforebegin' : 'afterend', panel);
    else account.append(panel);
    const list = panel.querySelector('#membership-account-list');
    try {
      const data = await requestJson('/api/listings/mine');
      const rows = (Array.isArray(data.items) ? data.items : []).filter(item => item.category !== 'operator');
      if (!rows.length) {
        list.innerHTML = '<p class="fine">Süreli ilanınız bulunmuyor.</p>';
        return;
      }
      list.innerHTML = rows.map(item => {
        const id = esc(item.id);
        const expiry = Math.max(Number(item.paid_until || 0), Number(item.trial_expires_at || 0));
        const expired = Boolean(item.trial_expired) || (expiry > 0 && expiry <= Date.now() / 1000);
        const approved = item.status === 'approved';
        let body = '<p class="fine">' + (approved ? (expired ? '<span class="membership-expired-warning">Yayın süreniz doldu.</span>' : 'Yayın süresi: ' + esc(dateText(expiry)) + ' tarihine kadar.') : 'İlanınız yayın onayı bekliyor; onaylanmadan önce yenileme talebi açılamaz.') + '</p>';
        if (approved && expired) {
          body += '<form class="membership-payment-form" data-membership-payment="' + id + '"><label>Yenileme paketi<select name="package_tier"><option value="standard">Standart · 599 TL</option><option value="featured">Öne Çıkan · 2.899 TL</option><option value="premium">Premium · 3.000 TL</option></select></label><label><span><input name="payment_declared" type="checkbox" required> Havale tutarını gönderdim</span></label><button type="submit">Ödeme kontrol talebi gönder</button></form><p class="fine">Talep yöneticiye iletilir. İlan süresi, havale doğrulandıktan sonra uzatılır.</p><p class="membership-payment-status" role="status"></p>';
        }
        return '<article class="membership-renewal-card"><h3>' + esc(item.title) + '</h3><p class="fine">' + esc(item.city) + ' / ' + esc(item.district) + '</p>' + body + '</article>';
      }).join('');
      list.querySelectorAll('[data-membership-payment]').forEach(form => form.addEventListener('submit', async event => {
        event.preventDefault();
        const submit = form.querySelector('button[type="submit"]');
        const status = form.closest('article').querySelector('.membership-payment-status');
        submit.disabled = true;
        status.textContent = 'Talep gönderiliyor…';
        try {
          const result = await requestJson('/api/ai/support', { method: 'POST', body: JSON.stringify({ action: 'renewal_payment_request', listing_id: form.dataset.membershipPayment, package_tier: form.elements.package_tier.value, payment_declared: form.elements.payment_declared.checked }) });
          status.textContent = result.message || 'Ödeme kontrol talebiniz kaydedildi.';
          form.remove();
        } catch (error) {
          status.textContent = error.message;
          submit.disabled = false;
        }
      }));
    } catch (error) {
      list.innerHTML = '<p class="fine" role="alert">' + esc(error.message) + '</p>';
    }
  }

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const boot = () => {
    if (path === '/admin') initAdmin();
    if (path === '/hesabim') initAccount();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(boot);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 15000);
  }
})();`;
