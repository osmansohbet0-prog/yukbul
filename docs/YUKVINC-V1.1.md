# YükVinç V1.1 — ilan yayın süresi yönetimi

- Yönetici, mevcut ilan satırından gün sayısı girerek yayın süresini artırabilir veya azaltabilir.
- Süresi dolmuş ilan, 30 günlük yeni yayın süresiyle yeniden yayına alınabilir.
- Değişiklikler mevcut `trial_expires_at` ve `paid_until` D1 alanlarına yazılır; yeni şema alanı gerekmez.
- Her işlem `admin_activity` tablosuna kaydedilir.
- İlan sahibi, ilan içeriği ve fotoğrafları değiştirilmez.
- Operatör ilanları mevcut ücretsiz/süresiz kuralını korur.
- Admin panelinin HTML/CSS tasarımı değiştirilmez; mevcut ilan satırına kontroller eklenir.

## Dağıtım güvenliği

Bu geliştirme yalnızca `feature/yukvinc-v1-1-listing-expiry` dalında hazırlanır. Depo talimatları GitHub `main` kaynağının canlı Worker V222 ile birebir olmadığını belirtiyor. Bu nedenle üretim Worker'ına deploy edilmez ve üretim D1 veritabanına işlem uygulanmaz. Önizleme ve API/görsel doğrulaması tamamlanmadan üretime alınmamalıdır.
