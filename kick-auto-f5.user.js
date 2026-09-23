// ==UserScript==
// @name         Kick Auto F5 Pro 
// @namespace    http://tampermonkey.net/
// @version      15.5.2
// @description  Admin Onay/Red + Beyaz Liste + AI Oto-Onay + Özel Kelime + Timeout (Admin + Açıklama) + Reactions + Last Seen + Profanity Filter + Daily Streak + Read Receipts + Timeout Autocomplete + Call Volume Ducking + Emoji Sistemi KALDIRILDI
// @author       Sen
// @match        https://kick.com/*
// @match        https://dashboard.kick.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/bilekicardi/kick-auto-f5/main/kick-auto-f5.user.js
// @downloadURL  https://raw.githubusercontent.com/bilekicardi/kick-auto-f5/main/kick-auto-f5.user.js
// @require      https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js
// @require      https://www.gstatic.com/firebasejs/10.13.0/firebase-database-compat.js
// ==/UserScript==

(function() {
    'use strict';

    // ==================== MASAÜSTÜ BİLDİRİM SİSTEMİ ====================
    let masaustuBildirimAcik = false;
    function masaustuBildirimGoster(baslik, icerik, ikonUrl) {
        return;
    }
    // ==================== PLUGIN ROOT GÜVENLİK KATMANI ====================
    const F5_PLUGIN_ROOT_ID = 'f5-modern-container';
    const F5_MAIN_MODAL_ID = 'f5-modal';

    const F5_ALT_MODAL_IDLERI = [
        'f5-acil-secim-modal',
        'f5-acil-neden-modal',
        'f5-acil-bekleme-modal',
        'f5-acil-sonuc-modal',
        'f5-image-modal',
        'f5-confirm-modal',
        'f5-beyaz-liste-sec-modal',
        'f5-grup-kur-modal',
        'f5-dm-sec-modal',
        'f5-grup-duzenle-modal',
        'f5-mute-modal',
        'f5-read-details-modal',
        'f5-gif-modal'
    ];

    function f5AltModalAcikMi() {
        return F5_ALT_MODAL_IDLERI.some(id => {
            const el = document.getElementById(id);
            if (!el) return false;
            if (el.style.display === 'none') return false;
            if (el.classList.contains('f5-submodal') && el.style.display !== 'flex') return false;
            return el.style.display === 'flex' || el.style.display === 'block' || el.classList.contains('show') || el.classList.contains('f5-confirm-show');
        });
    }

    function f5PluginRootGaranti() {
        let root = document.getElementById(F5_PLUGIN_ROOT_ID);
        if (!root) {
            console.warn('[Kick F5] Ana container silinmiş, sayfa yenileniyor...');
            location.reload();
            return null;
        }
        return root;
    }

    window.f5GuvenliModalKapat = function(modalId) {
        if (modalId === F5_PLUGIN_ROOT_ID || modalId === F5_MAIN_MODAL_ID) {
            console.warn('[Kick F5] Ana container kapatma reddedildi:', modalId);
            return;
        }
        const el = document.getElementById(modalId);
        if (!el) return;
        try {
            if (el.classList.contains('f5-submodal') || el.classList.contains('f5-confirm-overlay')) {
                el.style.display = 'none';
            } else {
                el.remove();
            }
        } catch (err) {
            console.warn('[Kick F5] Modal kapatma hatası:', modalId, err);
        }
    };

    // ==================== ADMIN AYARI ====================
    const ADMIN_KULLANICI_ADI = "Blacklcardi";
    const ACIL_ARAMA_YOLU = "acilAramalar";
    const ACIL_OKUNDU_ANAHTARI = "kick_f5_admin_acil_okundu";
    const BEYAZ_LISTE_YOLU = "beyazListe";
    const GLOBAL_TIMEOUT_YOLU = "globalTimeouts";
    // ====================================================

    let zamanlayiciKontrol = null;
    let aktifMod = 'saat';
    let durdurmaTusu = (localStorage.getItem('kick_f5_stop_tus') || 'f').toLowerCase();
    let aktifDil = (localStorage.getItem('kick_f5_dil') || 'tr').toLowerCase() === 'en' ? 'en' : 'tr';

    let f5BekleyenAcilArama = null;
    let beyazListeCache = {};
    let globalTimeoutCache = {};

    const F5_SAYFA_ACILIS_ZAMANI = Date.now();
    const F5_BILDIRIM_SESSIZ_SURESI = 6000;
    const F5_BILDIRIM_TEKRAR_ENGELI = 5000;
    const f5SonBildirimler = new Map();
    let odaAcilisZamani = 0;

    const EMERGENCY_SOUND_URL = "";
    let acilDurumModu = false;
    let acilDurumSesElementi = null;
    let acilDurumSesCalıyor = false;
    let acilDurumAutoplayEngellendi = false;
    let acilDurumSirenTimer = null;

    let acilDurumNedeni = '';
    let aktifAcilNeden = '';
    let acilNedenSesTimer = null;
    let acilNedenTekrarSayisi = 0;
    const ACIL_TTS_TEKRAR = 4;
    const ACIL_TTS_ARALIK = 9000;

    const AI_MOD_ANAHTARI = 'kick_f5_ai_mod';
    const AI_OZEL_KELIME_ANAHTARI = 'kick_f5_ai_ozel_kelimeler';
    let aiModAktif = localStorage.getItem(AI_MOD_ANAHTARI) === 'acik';

    // ==================== KÜFÜR FİLTRESİ ====================
    const PROFANITY_LISTESI_ANAHTAR = 'kick_f5_profanity_list';
    const PROFANITY_AKTIF_ANAHTAR = 'kick_f5_profanity_aktif';
    const VARSAYILAN_KUFURLER = [
        'amk', 'aq', 'orospu', 'oç', 'oc', 'piç', 'pic', 'sik', 'sikik', 'sikeyim',
        'yavşak', 'yavsak', 'göt', 'got', 'amcık', 'amcik', 'yarrak', 'yarak',
        'pezevenk', 'kahpe', 'şerefsiz', 'serefsiz', 'puşt', 'pust', 'ibne',
        'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'whore'
    ];
    let profanityAktif = localStorage.getItem(PROFANITY_AKTIF_ANAHTAR) !== 'kapali';
    function profanityListesiGetir() {
        try {
            const ham = localStorage.getItem(PROFANITY_LISTESI_ANAHTAR);
            return ham ? JSON.parse(ham) : [...VARSAYILAN_KUFURLER];
        } catch(e) { return [...VARSAYILAN_KUFURLER]; }
    }
    function profanityListesiKaydet(liste) {
        localStorage.setItem(PROFANITY_LISTESI_ANAHTAR, JSON.stringify(liste));
    }
    function kufurFiltrele(metin) {
        if (!profanityAktif || !metin || typeof metin !== 'string') return metin;
        const liste = profanityListesiGetir();
        let sonuc = metin;
        liste.forEach(kelime => {
            if (!kelime) return;
            const kacisli = kelime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(kacisli, 'gi');
            sonuc = sonuc.replace(re, '*'.repeat(kelime.length));
        });
        return sonuc;
    }

    // ==================== GÜNLÜK SERİ ====================
    const STREAK_ANAHTAR = 'kick_f5_streak_data';
    function streakVerisiGetir() {
        try {
            const ham = localStorage.getItem(STREAK_ANAHTAR);
            return ham ? JSON.parse(ham) : { sonTarih: null, seri: 0, enYuksek: 0, toplam: 0 };
        } catch(e) { return { sonTarih: null, seri: 0, enYuksek: 0, toplam: 0 }; }
    }
    function streakVerisiKaydet(v) { localStorage.setItem(STREAK_ANAHTAR, JSON.stringify(v)); }
    function gunFarkiHesapla(tarihStr1, tarihStr2) {
        if (!tarihStr1 || !tarihStr2) return Infinity;
        const d1 = new Date(tarihStr1 + 'T00:00:00');
        const d2 = new Date(tarihStr2 + 'T00:00:00');
        return Math.round((d2 - d1) / 86400000);
    }
    function streakGuncelle() {
        const bugun = new Date().toISOString().slice(0, 10);
        const veri = streakVerisiGetir();
        if (veri.sonTarih === bugun) {
            veri.toplam = (veri.toplam || 0) + 1;
            streakVerisiKaydet(veri);
            return veri;
        }
        const fark = gunFarkiHesapla(veri.sonTarih, bugun);
        if (fark === 1) veri.seri = (veri.seri || 0) + 1;
        else veri.seri = 1;
        if (veri.seri > (veri.enYuksek || 0)) veri.enYuksek = veri.seri;
        veri.sonTarih = bugun;
        veri.toplam = (veri.toplam || 0) + 1;
        streakVerisiKaydet(veri);
        return veri;
    }
    function streakHtmlUret() {
        const veri = streakVerisiGetir();
        const seri = veri.seri || 0;
        const ates = seri >= 7 ? '🔥🔥🔥' : (seri >= 3 ? '🔥🔥' : (seri >= 1 ? '🔥' : '💤'));
        return `<div style="display:flex; align-items:center; justify-content:space-between; background: linear-gradient(135deg, rgba(255,183,0,0.15), rgba(255,76,76,0.15)); border: 1px solid rgba(255,183,0,0.4); border-radius: 10px; padding: 10px 12px; margin-bottom: 14px;">
            <div style="display:flex; flex-direction:column; gap:2px;">
                <span style="font-size:11px; color:#ffb700; font-weight:800;">${ates} Günlük F5 Serisi</span>
                <span style="font-size:10px; color:#888;">En yüksek: ${veri.enYuksek || 0} gün · Toplam: ${veri.toplam || 0} F5</span>
            </div>
            <div style="font-size:22px; font-weight:900; color:#ffb700; text-shadow: 0 0 10px rgba(255,183,0,0.5);">${seri}</div>
        </div>`;
    }

    const AI_GECERLI_ANAHTARLAR = [
        'yangın', 'yangin', 'kaza', 'ambulans', 'hastane', 'acil', 'yardım', 'yardim',
        'saldırı', 'saldiri', 'silah', 'silahli', 'bıçak', 'bicak',
        'kalp krizi', 'nefes alamıyorum', 'kanama', 'kan', 'bayıldı', 'bayildi',
        'deprem', 'sel', 'su baskını', 'su baskini', 'boğulma', 'bogulma',
        'tehdit', 'tehdit ediliyorum', 'kacirildim', 'kaçırıldım', 'rehin',
        'intihar', 'kendime zarar', 'kendimi asacağım', 'kendimi olduru',
        'polis', '112', 'itfaiye', 'acil yardım', 'acil yardim',
        'yangın var', 'yangin var', 'kaza oldu', 'kaza yaptım', 'kaza yaptim',
        'kan kaybediyorum', 'kanamam var', 'yaralandım', 'yaralandim',
        'kavga', 'saldırı altındayım', 'saldiri altindayim',
        'evde kilitli', 'mahsur', 'mahsur kaldım', 'mahsur kaldim',
        'fire', 'accident', 'emergency', 'help', 'attack', 'weapon', 'knife', 'gun',
        'heart attack', 'bleeding', 'blood', 'fainted', 'earthquake', 'flood',
        'drowning', 'threat', 'kidnapped', 'hostage', 'suicide', 'self harm',
        'police', '911', 'ambulance', 'trapped', 'injured', 'hurt', 'danger',
        'dangerous', 'urgent', 'critical', 'dying', 'save me', 'help me'
    ];

    const AI_GECERSIZ_ANAHTARLAR = [
        'şaka', 'saka', 'joke', 'test', 'deneme', 'asdf', 'qwerty',
        'sevgilim', 'canım', 'canim',
        'sıkıldım', 'sikildim', 'bored', 'eğlence', 'eglence', 'fun',
        'oyun', 'game', 'troll', 'gıcık', 'gicik'
    ];

    function aiOzelKelimeleriGetir() {
        try {
            const ham = localStorage.getItem(AI_OZEL_KELIME_ANAHTARI);
            return ham ? JSON.parse(ham) : [];
        } catch(e) { return []; }
    }
    function aiOzelKelimeleriKaydet(liste) {
        localStorage.setItem(AI_OZEL_KELIME_ANAHTARI, JSON.stringify(liste));
    }
    function aiOzelKelimeListesiRenderla() {
        const listeEl = document.getElementById('f5-ai-kelime-liste');
        if (!listeEl) return;
        const kelimeler = aiOzelKelimeleriGetir();
        if (kelimeler.length === 0) {
            listeEl.innerHTML = '<span style="font-size:10px; color:#666; font-style:italic;">Henüz özel kelime eklenmedi.</span>';
            return;
        }
        listeEl.innerHTML = '';
        kelimeler.forEach((kelime) => {
            const chip = document.createElement('span');
            chip.style.cssText = 'display:inline-flex; align-items:center; gap:6px; background: rgba(83,252,24,0.15); border: 1px solid rgba(83,252,24,0.4); color: #53fc18; font-size: 10px; font-weight: 700; padding: 4px 8px; border-radius: 12px;';
            chip.innerHTML = `${kelime} <span style="cursor:pointer; color:#ff6b6b; font-size:12px; line-height:1;">✕</span>`;
            const silBtn = chip.querySelector('span');
            if (silBtn) {
                silBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        const guncel = aiOzelKelimeleriGetir();
                        const yeniListe = guncel.filter(k => k !== kelime);
                        aiOzelKelimeleriKaydet(yeniListe);
                        aiOzelKelimeListesiRenderla();
                        if (typeof aiModDurumunuGuncelle === 'function') aiModDurumunuGuncelle();
                    } catch (err) {
                        console.error('[Kick F5] Kelime silme hatası:', err);
                    }
                });
            }
            listeEl.appendChild(chip);
        });
    }
    function aiOzelKelimeEkle(kelime) {
        const temiz = (kelime || '').trim().toLowerCase();
        if (!temiz) return;
        const guncel = aiOzelKelimeleriGetir();
        if (guncel.includes(temiz)) return;
        guncel.push(temiz);
        aiOzelKelimeleriKaydet(guncel);
        aiOzelKelimeListesiRenderla();
        if (typeof aiModDurumunuGuncelle === 'function') aiModDurumunuGuncelle();
    }
    function aiKelimeAlaniniGuncelle() {
        const alan = document.getElementById('f5-ai-kelime-alani');
        if (alan) alan.style.display = aiModAktif ? 'block' : 'none';
    }
    function aiAciliDegerlendir(neden, gonderen) {
        if (!neden || typeof neden !== 'string') {
            return { gecerli: false, sebep: 'Sebep boş bırakılamaz', ozelKelime: false };
        }
        const temiz = neden.trim().toLowerCase();
        if (temiz.length < 3) {
            return { gecerli: false, sebep: 'Sebep çok kısa', ozelKelime: false };
        }
        const ozelKelimeler = aiOzelKelimeleriGetir();
        for (const kelime of ozelKelimeler) {
            if (kelime && temiz.includes(kelime)) {
                return { gecerli: true, sebep: `Özel onay kelimesi: "${kelime}"`, ozelKelime: true };
            }
        }
        for (const kelime of AI_GECERSIZ_ANAHTARLAR) {
            if (temiz === kelime || temiz.startsWith(kelime + ' ') || temiz.endsWith(' ' + kelime) || temiz.includes(' ' + kelime + ' ')) {
                return { gecerli: false, sebep: `Şüpheli kelime: "${kelime}"`, ozelKelime: false };
            }
        }
        let eslesmeSayisi = 0;
        let eslesenKelime = '';
        for (const kelime of AI_GECERLI_ANAHTARLAR) {
            if (temiz.includes(kelime.toLowerCase())) {
                eslesmeSayisi++;
                if (!eslesenKelime) eslesenKelime = kelime;
            }
        }
        if (eslesmeSayisi > 0) {
            return { gecerli: true, sebep: `Acil anahtar kelime: "${eslesenKelime}" (${eslesmeSayisi} eşleşme)`, ozelKelime: false };
        }
        const kelimeler = temiz.split(/\s+/).filter(k => k.length > 0);
        const harfSayisi = (temiz.match(/[a-zçğıöşü]/g) || []).length;
        if (temiz.length > 15 && kelimeler.length >= 3 && harfSayisi > 10) {
            return { gecerli: false, sebep: 'Acil kelime yok (yetersiz açıklama)', ozelKelime: false };
        }
        return { gecerli: false, sebep: 'Geçersiz sebep', ozelKelime: false };
    }
    function aiModDurumunuGuncelle() {
        const durumEl = document.getElementById('f5-ai-mod-durum');
        if (!durumEl) return;
        if (aiModAktif) {
            const ozelSayi = aiOzelKelimeleriGetir().length;
            durumEl.innerHTML = `<span style="color:#53fc18; font-weight:700;">AI Modu Aktif</span> — ${ozelSayi > 0 ? `${ozelSayi} özel kelime + ` : ''}otomatik değerlendirme`;
        } else {
            durumEl.innerHTML = '<span style="color:#888;">AI Modu Kapalı</span> — Tüm acil aramalar manuel onay bekler';
        }
    }

    const CEVIRILER = {
        tr: {
            panel_baslik: 'Oto F5 Ultimate', mod_saat: 'Saat', mod_aralik: 'Aralık', mod_seri: 'Seri (Spam)',
            hedef_zaman_label: 'Hedef Zaman', aralik_label: 'Süre Periyodu (Dakika)', aralik_placeholder: 'Örn: 5',
            seri_label: 'Seri Yenileme Hızı (Saniye)', seri_placeholder: 'Örn: 0.5',
            seri_uyari_on: '⚠️ İstediğin an durdurmak için', seri_uyari_son: 'kısayoluna basabilirsin!',
            btn_baslat: 'Başlat', btn_durdur: 'Durdur', btn_sifirla: 'Sıfırla',
            hata_metni: 'Lütfen geçerli değerler girin!', durum_label: 'Durum:', durum_aktif: 'Aktif', durum_kapali: 'Kapalı',
            hedef_label: 'Hedef:', kalan_sure_label: 'Kalan Süre',
            konum_label: 'Sabit Konum', konum_sag_alt: 'Sağ Alt (Standart)', konum_sol_alt: 'Sol Alt',
            konum_sag_ust: 'Sağ Üst', konum_sol_ust: 'Sol Üst', konum_serbest: 'Serbest Sürükleme',
            panel_tema_label: 'Panel Teması', tema_klasik_gri: 'Klasik Gri', tema_gece_yarisi: 'Gece Yarısı',
            tema_kor_atesi: 'Kor Ateşi', tema_matrix: 'Matrix Yeşili', tema_mor_buyu: 'Mor Büyü',
            tema_altin_cag: 'Altın Çağ', tema_buz_kristali: 'Buz Kristali', tema_pembe_bulut: 'Pembe Bulut',
            tema_rengi_label: 'Tema Rengi', ozel_renk_metin: 'Özel Renk Seç',
            renk_kick_yesili: 'Kick Yeşili', renk_cyber_mavi: 'Cyber Mavi', renk_neon_pembe: 'Neon Pembe', renk_altin: 'Altın',
            renk_mor_ruya: 'Purple Rüya', renk_ates_kirmizi: 'Ateş Kırmızı', renk_okyanus: 'Okyanus', renk_zumrut: 'Zümrüt',
            renk_gun_batimi: 'Gün Batımı', renk_buz_mavisi: 'Buz Mavisi', renk_lavanta: 'Lavanta', renk_limon: 'Limon',
            renk_mercan: 'Mercan', renk_turkuaz: 'Turkuaz',
            renk_beyaz: 'Beyaz', renk_lacivert: 'Lacivert', renk_bordo: 'Bordo', renk_haki: 'Haki',
            buton_tarzi_label: 'Buton Tarzı', stil_glass: 'Cam (Varsayılan)', stil_solid: 'Dolu Neon',
            stil_minimal: 'Minimal', stil_gradient: 'Degrade', stil_squircle: 'Squircle',
            boyut_label: 'Boyut', panel_seffaflik_label: 'Panel Şeffaflığı', glow_label: 'Parlama (Glow) Yoğunluğu',
            anim_baslik: 'Simge Dönme Animasyonu', anim_aciklama: 'Zamanlayıcı aktifken ikon dönsün',
            badge_baslik: 'Rozeti Her Zaman Göster', badge_aciklama: 'Zamanlayıcı kapalıyken de rozet görünsün',
            tension_baslik: 'Gerilim (Tension) Efekti', tension_aciklama: 'Son 10 saniyede kırmızı nabız efekti',
            kenarlik_baslik: 'Dönen Kenarlık Işığı', kenarlik_aciklama: 'Panelin kenarında dönen parlama efekti',
            gurultu_engelleyici_baslik: 'Gürültü Engelleyici', gurultu_engelleyici_aciklama: 'Sesli sohbette arka plan gürültüsünü azalt',
            mikrofon_ayarlari_baslik: 'Mikrofon Ayarları',
            tus_baslik: 'Acil Fren Kısayolu', tus_aciklama: 'Seri modu durduran tuş kombinasyonu (Alt + tuş)',
            tus_dinleniyor: 'Bir tuşa basın...',
            dil_baslik: 'Panel Dili', dil_aciklama: 'Arayüz dilini değiştirin (TR / EN)',
            ayarlar_yonet_label: 'Ayarları Yönet', disa_aktar_btn: 'Dışa Aktar', ice_aktar_btn: 'İçe Aktar',
            sifirla_varsayilan_btn: 'Varsayılana Sıfırla',
            baglanti_label: 'Bağlantı:', baglaniyor: 'Bağlanıyor...', bagli: 'Bağlı', baglanti_yok: 'Bağlantı Yok',
            yapilandirilmadi: 'Yapılandırılmadı', hata_durum: 'Hata', kullanici_bulunamadi: 'Kullanıcı bulunamadı',
            aktif_sayi_label: 'Aktif:', kimse_aktif_degil: 'Kimse aktif değil.', sen_etiketi: 'Sen',
            sifirlanmaya_label: 'Sıfırlanmaya:', henuz_puan_yok: 'Henüz puan yok.',
            tab_zamanlayici: 'Zamanlayıcı', tab_gorunum: 'Ayarlar', tab_ayarlar: 'Ayarlar', tab_aktif: 'Kişiler', tab_istatistik: 'İstatistik', tab_sohbet: 'Sohbet / DM', tab_arama: 'Arama Ayarları', tab_admin: 'Admin',
            confirm_baslik: 'Emin misiniz?', confirm_sifirla_mesaj: 'Tüm görünüm ve ayarlar varsayılana sıfırlanacak. Emin misiniz?',
            confirm_vazgec: 'Vazgeç', confirm_evet: 'Onayla',
            io_disa_ok: 'Ayarlar dosyaya kaydedildi.', io_disa_err: 'Dışa aktarma başarısız oldu.',
            io_ice_ok: '{sayac} ayar içe aktarıldı, yenileniyor...', io_ice_err: 'Geçersiz veya bozuk ayar dosyası.',
            io_dosya_okunamadi: 'Dosya okunamadı.', io_sifirlandi: 'Tüm ayarlar varsayılana sıfırlandı!',
            tooltip_varsayilan: 'F5 Zamanlayıcı', tooltip_surukle: 'Sürükle veya Tıkla',
            acil_fren_mesaj: 'Spam Modu / F5 Döngüsü Güvenle Durduruldu!', dk_kisa: 'dk',
            ozel_tema_baslik: 'Özel Tema Oluştur', ozel_tema_renk1: 'Renk 1', ozel_tema_renk2: 'Renk 2', ozel_tema_renk3: 'Renk 3',
            ozel_tema_renk3_opsiyonel: '(opsiyonel)', ozel_tema_isim_placeholder: 'Tema adı ver...',
            ozel_tema_kaydet_btn: '+ Kaydet', ozel_tema_isim_bos: 'Lütfen temaya bir isim verin!',
            ozel_tema_isim_var: 'Bu isimde bir tema zaten var!', ozel_tema_limit: 'En fazla 12 özel tema kaydedebilirsin!',
            ozel_temalarim_baslik: 'Temalarım', ozel_tema_yok: 'Henüz özel tema kaydetmedin.',
            ozel_tema_sil_baslik: 'Temayı sil', ozel_tema_sil_confirm: '"{isim}" temasını silmek istediğine emin misin?',
            sohbet_secin: 'Sohbet etmek için soldan bir konuşma seçin veya yeni oluşturun.',
            mesaj_yaz: 'Bir mesaj yaz...', yeni_grup_btn: '+ Grup Kur', yeni_dm_btn: '+ DM Başlat',
            grup_adi_gir: 'Grup Adı...', grup_olustur: 'Oluştur', gonder: 'Gönder',
            dm_baslat_etiket: 'Mesaj At', ayarlar: 'Ayarlar', sessize_al: 'Sessize Al', sesi_ac: 'Sesi Aç', engel_kaldir: 'Engeli Kaldır', engelle: 'Engelle',
            bu_kisi_engellendi_metni: 'Bu kişiyi engellediniz.', beni_engelledi_metni: 'Bu kullanıcı sizi engellediği için mesaj gönderemezsiniz.',
            engellendi_gonderim_hata: 'Mesaj gönderilemedi: Bu kullanıcı sizi engellemiş.',
            kisileri_yonet: 'Kişileri Yönet', grup_profili_degistir: 'Grup Profilini Değiştir', sohbet_sil: 'Sohbeti Sil', sohbet_sil_onay: 'Bu sohbeti silmek istediğinize emin misiniz? (Karşı tarafta silinmez)',
            gruptan_ayril: 'Gruptan Ayrıl', ayril_onay: 'Bu gruptan ayrılmak istediğine emin misin?', ayril_btn: 'Ayrıl',
            gif_gonder: 'GIF Gönder', gif_ara_placeholder: 'GIF ara (GIPHY)...', gif_bulunamadi: 'Sonuç bulunamadı.', gif_araniyor: 'Aranıyor...',
            mute_1h: '1 Saat', mute_8h: '8 Saat', mute_24h: '24 Saat', mute_forever: 'Sonsuza Kadar',
            yanitla_baslik: 'Yanıtla', duzenle_baslik: 'Düzenle', sil_baslik: 'Sil',
            yaniti_iptal_baslik: 'İptal', mesaj_silindi_metni: 'Bu mesaj silindi',
            duzenlendi_etiketi: '(düzenlendi)', yanitlaniyor_etiketi: 'Yanıtlanıyor:',
            duzenleniyor_etiketi: 'Mesaj düzenleniyor', mesaj_sil_onay: 'Bu mesajı silmek istediğinize emin misiniz?',
            sohbet_temizlendi_bilgi: 'Sohbet görünümü temizlendi (yalnızca sende).',
            daha_fazla_yukle: 'Daha fazla yükle', yukleniyor: 'Yükleniyor...',
            admin_yap_btn: 'Admin Yap', admin_kaldir_btn: 'Admin Kaldır',
            admin_gerekli_uyari: 'Bu işlem için grup admini olmanız gerekir.',
            sesli_arama_btn: 'Sesli Ara', cagri_ariyor: 'Arıyor...', cagri_gelen_dm: 'Gelen arama',
            cagri_gelen_grup: 'Grup sesli araması', cagri_kisi_gorusmede: 'kişi görüşmede',
            cagri_kabul_btn: 'Kabul', cagri_reddet_btn: 'Reddet', cagri_katil_btn: 'Katıl',
            cagri_kapat_btn: 'Kapat', cagri_iptal_btn: 'İptal', cagri_sesi_kapat: 'Sesi Kapat',
            cagri_sesi_ac: 'Sesi Aç', cagri_mikrofon_hata: 'Mikrofona erişilemedi. Tarayıcı izinlerini kontrol edin.',
            cagri_zaten_aramada: 'Zaten bir görüşmedesiniz.',
            cagri_reddedildi: 'Arama reddedildi', cagri_cevap_yok: 'Yanıt yok, arama sonlandırıldı',
            tab_zil_sesi: 'Zil Sesi', zil_baslik: 'Arama Zil Sesi', zil_aciklama: 'Gelen arama bildiriminde çalacak sesi seç.',
            zil_ad_klasik: 'Klasik Tını', zil_ad_dijital: 'Dijital Çağrı', zil_ad_yumusak: 'Yumuşak Çan',
            zil_ad_retro: 'Retro Telefon', zil_ad_marimba: 'Marimba', zil_varsayilan_etiket: 'Varsayılan',
            zil_ozel_baslik: 'Özel Zil Sesi', zil_ozel_bos_aciklama: 'MP3 yükle · en fazla 20 saniye',
            zil_ozel_yukle_btn: 'Yükle', zil_ozel_degistir_btn: 'Değiştir', zil_ozel_sil_btn: 'Kaldır',
            zil_dinle_baslik: 'Dinle', zil_sec_etiketi: 'Seçili', zil_hata_format: 'Sadece MP3 dosyası yükleyebilirsin!',
            zil_hata_sure: 'Ses dosyası en fazla 20 saniye olmalı!', zil_yukleniyor: 'Yükleniyor...',
            admin_panel_baslik: 'ACİL ARAMA PANELİ', admin_bos: 'Henüz acil arama yok.',
            admin_tumunu_temizle: 'Tümünü Temizle', admin_ara_btn: 'ARA', admin_okundu: 'Okundu',
            admin_okundu_isaretle: 'Okundu İşaretle', admin_yeni: 'YENİ',
            admin_neden_yok: '(neden yok)', admin_sil_onay: 'Bu acil arama kaydını silmek istiyor musun?',
            admin_tumunu_sil_onay: 'TÜM acil arama kayıtlarını silmek istediğine emin misin?',
            admin_yeni_bildirim: 'Yeni acil arama',
            acil_neden_baslik: 'ACİL DURUM ARAMASI', acil_neden_aciklama: 'Lütfen acil durum nedeninizi kısaca yazın',
            acil_neden_placeholder: 'Örn: Yangın var, yardım edin!', acil_neden_iptal: 'İptal', acil_neden_gonder: 'ACİL ARA',
            acil_neden_hata: 'Lütfen geçerli bir neden yazın (en az 3 karakter)',
            admin_onayla_ara: 'ONAYLA & ARA', admin_reddet: 'REDDET',
            admin_onaylandi: 'Onaylandı', admin_reddedildi: 'Reddedildi',
            admin_iptal_edildi: 'İptal Edildi', admin_zamanasimi: 'Zaman Aşımı',
            admin_islendi: 'İşlendi', admin_bekliyor: 'Bekliyor',
            onay_bekle_baslik: 'Admin Onayı Bekleniyor',
            onay_bekle_aciklama: 'Acil arama talebiniz yöneticiye iletildi.',
            onay_bekle_alt: 'için onay bekleniyor...', onay_bekle_iptal: 'İptal Et',
            onay_bekle_zamanasimi_baslik: 'Zaman Aşımı',
            onay_bekle_zamanasimi_metin: 'Yönetici 30 saniye içinde cevap vermedi.',
            onay_onaylandi_baslik: 'Onaylandı!', onay_onaylandi_metin: 'Arama başlatılıyor...',
            onay_reddedildi_baslik: 'Arama Reddedildi', onay_reddedildi_metin: 'Yönetici acil arama talebinizi reddetti.',
            yeni_mesajlar_btn: 'Yeni Mesaj', yeni_mesaj_var: 'Yeni mesaj',
            beyaz_liste_baslik: 'Beyaz Liste',
            beyaz_liste_aciklama: 'Beyaz listedeki kullanıcılar acil arama sebebi yazmadan direkt arayabilir',
            beyaz_liste_bos: 'Beyaz listede kimse yok.',
            beyaz_liste_ekle_btn: '+ Kullanıcı Ekle',
            beyaz_liste_ekle_baslik: 'Beyaz Listeye Ekle',
            beyaz_liste_cikar_btn: 'Çıkar',
            beyaz_liste_eklendi: 'Beyaz listeye eklendi',
            beyaz_liste_cikarildi: 'Beyaz listeden çıkarıldı',
            beyaz_liste_ekle_onay: '{isim} beyaz listeye eklensin mi?',
            beyaz_liste_cikar_onay: '{isim} beyaz listeden çıkarılsın mı?',
            beyaz_liste_direkt_ara: 'Beyaz Liste',
            beyaz_liste_uyari_baslik: 'Hızlı Arama',
            beyaz_liste_uyari_metin: 'Beyaz listede olduğunuz için direkt aranıyorsunuz...',
            nick_degistir_btn: 'Nick\'i Değiştir',
            timeout_baslik: 'Kullanıcı Susturma (Timeout)',
            timeout_aciklama: 'Kullanıcı adı yazıp süre seçerek tüm sohbetlerde susturabilirsiniz.',
            timeout_kullanici_placeholder: 'Kullanıcı adı...',
            timeout_sustur_btn: 'Sustur',
            timeout_1saat: '1 Saat', timeout_1gun: '1 Gün', timeout_1hafta: '1 Hafta', timeout_kalici: 'Kalıcı',
            timeout_kaldir: 'Susturmayı Kaldır',
            timeout_aktif_liste: 'Aktif Timeout\'lar',
            timeout_yok: 'Aktif timeout yok.',
            timeout_uygulandi: '{isim} susturuldu!',
            timeout_kaldirildi: '{isim} susturması kaldırıldı!',
            timeout_kalan: 'Kalan', timeout_dakika: 'dk', timeout_saat: 'sa', timeout_gun: 'gün', timeout_suresiz: 'Süresiz',
            timeout_susturulmus: 'Susturulmuş',
            timeout_locked_title: 'Sohbet Sizden Askıya Alındı',
            timeout_locked_desc: 'Bir yönetici tarafından geçici olarak susturuldunuz.',
            timeout_locked_by: 'Susturan Yetkili:', timeout_locked_remaining: 'Kalan Süre:',
            timeout_locked_reason: 'Sebep:', timeout_locked_no_reason: 'Sebep belirtilmedi.',
            timeout_locked_permanent: 'Kalıcı Olarak Susturuldu',
            ozel_sure: 'Özel Süre', ozel_sure_dk: 'Dakika olarak süre girin',
            ozel_sure_uygula: 'Süreyi Uygula', ozel_sure_gecersiz: 'Lütfen geçerli bir dakika değeri girin!',
            ozel_sure_birim: 'Birim', ozel_sure_dakika: 'Dakika', ozel_sure_saat: 'Saat', ozel_sure_gun: 'Gün',
            timeout_1dk: '1 Dakika', timeout_5dk: '5 Dakika', timeout_10dk: '10 Dakika', timeout_15dk: '15 Dakika',
            timeout_30dk: '30 Dakika', timeout_1s: '1 Saat', timeout_3s: '3 Saat', timeout_6s: '6 Saat',
            timeout_12s: '12 Saat', timeout_24s: '24 Saat',
            timeout_aciklama_placeholder: 'Açıklama (isteğe bağlı)...',
            timeout_aciklama_baslik: 'Açıklama Ekle',
        },
        en: {
            panel_baslik: 'Auto F5 Ultimate', mod_saat: 'Time', mod_aralik: 'Interval', mod_seri: 'Rapid (Spam)',
            hedef_zaman_label: 'Target Time', aralik_label: 'Interval Period (Minutes)', aralik_placeholder: 'e.g. 5',
            seri_label: 'Rapid Refresh Speed (Seconds)', seri_placeholder: 'e.g. 0.5',
            seri_uyari_on: 'Press', seri_uyari_son: 'anytime to stop safely!',
            btn_baslat: 'Start', btn_durdur: 'Stop', btn_sifirla: 'Reset',
            hata_metni: 'Please enter valid values!', durum_label: 'Status:', durum_aktif: 'Active', durum_kapali: 'Off',
            hedef_label: 'Target:', kalan_sure_label: 'Time Remaining',
            konum_label: 'Fixed Position', konum_sag_alt: 'Bottom Right (Default)', konum_sol_alt: 'Bottom Left',
            konum_sag_ust: 'Top Right', konum_sol_ust: 'Top Left', konum_serbest: 'Free Drag',
            panel_tema_label: 'Panel Theme', tema_klasik_gri: 'Classic Gray', tema_gece_yarisi: 'Midnight',
            tema_kor_atesi: 'Ember', tema_matrix: 'Matrix Green', tema_mor_buyu: 'Purple Magic',
            tema_altin_cag: 'Golden Age', tema_buz_kristali: 'Ice Crystal', tema_pembe_bulut: 'Pink Cloud',
            tema_rengi_label: 'Theme Color', ozel_renk_metin: 'Pick Custom Color',
            renk_kick_yesili: 'Kick Green', renk_cyber_mavi: 'Cyber Blue', renk_neon_pembe: 'Neon Pink', renk_altin: 'Gold',
            renk_mor_ruya: 'Purple Dream', renk_ates_kirmizi: 'Fire Red', renk_okyanus: 'Ocean', renk_zumrut: 'Emerald',
            renk_gun_batimi: 'Sunset', renk_buz_mavisi: 'Ice Blue', renk_lavanta: 'Lavender', renk_limon: 'Lemon',
            renk_mercan: 'Coral', renk_turkuaz: 'Turquoise',
            renk_beyaz: 'White', renk_lacivert: 'Navy', renk_bordo: 'Maroon', renk_haki: 'Khaki',
            buton_tarzi_label: 'Button Style', stil_glass: 'Glass (Default)', stil_solid: 'Solid Neon',
            stil_minimal: 'Minimal', stil_gradient: 'Gradient', stil_squircle: 'Squircle',
            boyut_label: 'Size', panel_seffaflik_label: 'Panel Transparency', glow_label: 'Glow Intensity',
            anim_baslik: 'Icon Spin Animation', anim_aciklama: 'Spin the icon while the timer is active',
            badge_baslik: 'Always Show Badge', badge_aciklama: 'Show the badge even when the timer is off',
            tension_baslik: 'Tension Effect', tension_aciklama: 'Red pulse effect in the last 10 seconds',
            kenarlik_baslik: 'Rotating Border Light', kenarlik_aciklama: 'Glowing effect rotating around the panel edge',
            gurultu_engelleyici_baslik: 'Noise Suppression', gurultu_engelleyici_aciklama: 'Reduce background noise in voice chat',
            mikrofon_ayarlari_baslik: 'Microphone Settings',
            tus_baslik: 'Emergency Stop Shortcut', tus_aciklama: 'Key combo that stops rapid mode (Alt + key)',
            tus_dinleniyor: 'Press a key...',
            dil_baslik: 'Panel Language', dil_aciklama: 'Change the interface language (TR / EN)',
            ayarlar_yonet_label: 'Manage Settings', disa_aktar_btn: 'Export', ice_aktar_btn: 'Import',
            sifirla_varsayilan_btn: 'Reset to Default',
            baglanti_label: 'Connection:', baglaniyor: 'Connecting...', bagli: 'Connected', baglanti_yok: 'No Connection',
            yapilandirilmadi: 'Not Configured', hata_durum: 'Error', kullanici_bulunamadi: 'User not found',
            aktif_sayi_label: 'Active:', kimse_aktif_degil: 'No one is active.', sen_etiketi: 'You',
            sifirlanmaya_label: 'Resets in:', henuz_puan_yok: 'No scores yet.',
            tab_zamanlayici: 'Timer', tab_gorunum: 'Settings', tab_ayarlar: 'Settings', tab_aktif: 'Users', tab_istatistik: 'Stats', tab_sohbet: 'Chat / DM', tab_arama: 'Call Settings', tab_admin: 'Admin',
            confirm_baslik: 'Are you sure?', confirm_sifirla_mesaj: 'All appearance and settings will be reset to default. Are you sure?',
            confirm_vazgec: 'Cancel', confirm_evet: 'Confirm',
            io_disa_ok: 'Settings saved to file.', io_disa_err: 'Export failed.',
            io_ice_ok: '{sayac} setting(s) imported, reloading...', io_ice_err: 'Invalid or corrupted settings file.',
            io_dosya_okunamadi: 'File could not be read.', io_sifirlandi: 'All settings reset to default!',
            tooltip_varsayilan: 'F5 Timer', tooltip_surukle: 'Drag or Click',
            acil_fren_mesaj: 'Spam Mode / F5 Loop Safely Stopped!', dk_kisa: 'min',
            ozel_tema_baslik: 'Create Custom Theme', ozel_tema_renk1: 'Color 1', ozel_tema_renk2: 'Color 2', ozel_tema_renk3: 'Color 3',
            ozel_tema_renk3_opsiyonel: '(optional)', ozel_tema_isim_placeholder: 'Name your theme...',
            ozel_tema_kaydet_btn: '+ Save', ozel_tema_isim_bos: 'Please give the theme a name!',
            ozel_tema_isim_var: 'A theme with this name already exists!', ozel_tema_limit: 'You can save up to 12 custom themes!',
            ozel_temalarim_baslik: 'My Themes', ozel_tema_yok: 'You haven\'t saved any custom themes yet.',
            ozel_tema_sil_baslik: 'Delete theme', ozel_tema_sil_confirm: 'Are you sure you want to delete "{isim}"?',
            sohbet_secin: 'Select a conversation from the left or create a new one.',
            mesaj_yaz: 'Type a message...', yeni_grup_btn: '+ New Group', yeni_dm_btn: '+ New DM',
            grup_adi_gir: 'Group Name...', grup_olustur: 'Create', gonder: 'Send',
            dm_baslat_etiket: 'DM', ayarlar: 'Settings', sessize_al: 'Mute', sesi_ac: 'Unmute', engel_kaldir: 'Unblock', engelle: 'Block',
            bu_kisi_engellendi_metni: 'You have blocked this person.', beni_engelledi_metni: 'You cannot send messages because this user has blocked you.',
            engellendi_gonderim_hata: 'Message not sent: this user has blocked you.',
            kisileri_yonet: 'Manage Members', grup_profili_degistir: 'Change Group Profile', sohbet_sil: 'Delete Chat', sohbet_sil_onay: 'Are you sure you want to delete this chat? (It won\'t be deleted for the other person)',
            gruptan_ayril: 'Leave Group', ayril_onay: 'Are you sure you want to leave this group?', ayril_btn: 'Leave',
            gif_gonder: 'Send GIF', gif_ara_placeholder: 'Search GIFs (GIPHY)...', gif_bulunamadi: 'No results found.', gif_araniyor: 'Searching...',
            mute_1h: '1 Hour', mute_8h: '8 Hours', mute_24h: '24 Hours', mute_forever: 'Forever',
            yanitla_baslik: 'Reply', duzenle_baslik: 'Edit', sil_baslik: 'Delete',
            yaniti_iptal_baslik: 'Cancel', mesaj_silindi_metni: 'This message was deleted',
            duzenlendi_etiketi: '(edited)', yanitlaniyor_etiketi: 'Replying to:',
            duzenleniyor_etiketi: 'Editing message', mesaj_sil_onay: 'Are you sure you want to delete this message?',
            sohbet_temizlendi_bilgi: 'Chat view cleared (only for you).',
            daha_fazla_yukle: 'Load more', yukleniyor: 'Loading...',
            admin_yap_btn: 'Make Admin', admin_kaldir_btn: 'Remove Admin',
            admin_gerekli_uyari: 'You need to be a group admin to do this.',
            sesli_arama_btn: 'Voice Call', cagri_ariyor: 'Calling...', cagri_gelen_dm: 'Incoming call',
            cagri_gelen_grup: 'Incoming group call', cagri_kisi_gorusmede: 'in call',
            cagri_kabul_btn: 'Accept', cagri_reddet_btn: 'Decline', cagri_katil_btn: 'Join',
            cagri_kapat_btn: 'End', cagri_iptal_btn: 'Cancel', cagri_sesi_kapat: 'Mute',
            cagri_sesi_ac: 'Unmute', cagri_mikrofon_hata: 'Could not access microphone. Check browser permissions.',
            cagri_zaten_aramada: 'You are already in a call.',
            cagri_reddedildi: 'Call declined', cagri_cevap_yok: 'No answer, call ended',
            tab_zil_sesi: 'Ringtone', zil_baslik: 'Call Ringtone', zil_aciklama: 'Choose the sound that plays for incoming calls.',
            zil_ad_klasik: 'Classic Tone', zil_ad_dijital: 'Digital Call', zil_ad_yumusak: 'Soft Bell',
            zil_ad_retro: 'Retro Phone', zil_ad_marimba: 'Marimba', zil_varsayilan_etiket: 'Default',
            zil_ozel_baslik: 'Custom Ringtone', zil_ozel_bos_aciklama: 'Upload MP3 · max 20 seconds',
            zil_ozel_yukle_btn: 'Upload', zil_ozel_degistir_btn: 'Replace', zil_ozel_sil_btn: 'Remove',
            zil_dinle_baslik: 'Preview', zil_sec_etiketi: 'Selected', zil_hata_format: 'You can only upload an MP3 file!',
            zil_hata_sure: 'Audio file must be 20 seconds or less!', zil_yukleniyor: 'Uploading...',
            admin_panel_baslik: 'EMERGENCY CALL PANEL', admin_bos: 'No emergency calls yet.',
            admin_tumunu_temizle: 'Clear All', admin_ara_btn: 'CALL', admin_okundu: 'Read',
            admin_okundu_isaretle: 'Mark as Read', admin_yeni: 'NEW',
            admin_neden_yok: '(no reason)', admin_sil_onay: 'Delete this emergency call record?',
            admin_tumunu_sil_onay: 'Are you sure you want to delete ALL emergency call records?',
            admin_yeni_bildirim: 'New emergency call',
            acil_neden_baslik: 'EMERGENCY CALL', acil_neden_aciklama: 'Please briefly write your emergency reason',
            acil_neden_placeholder: 'E.g.: Fire, help me!', acil_neden_iptal: 'Cancel', acil_neden_gonder: 'CALL NOW',
            acil_neden_hata: 'Please write a valid reason (at least 3 characters)',
            admin_onayla_ara: 'APPROVE & CALL', admin_reddet: 'REJECT',
            admin_onaylandi: 'Approved', admin_reddedildi: 'Rejected',
            admin_iptal_edildi: 'Cancelled', admin_zamanasimi: 'Timeout',
            admin_islendi: 'Processed', admin_bekliyor: 'Pending',
            onay_bekle_baslik: 'Waiting for Admin Approval',
            onay_bekle_aciklama: 'Your emergency call request was sent to admin.',
            onay_bekle_alt: 'approval pending...', onay_bekle_iptal: 'Cancel',
            onay_bekle_zamanasimi_baslik: 'Timeout',
            onay_bekle_zamanasimi_metin: 'Admin did not respond within 30 seconds.',
            onay_onaylandi_baslik: 'Approved!', onay_onaylandi_metin: 'Call is starting...',
            onay_reddedildi_baslik: 'Call Rejected', onay_reddedildi_metin: 'Admin rejected your emergency call request.',
            yeni_mesajlar_btn: 'New Messages', yeni_mesaj_var: 'New message',
            beyaz_liste_baslik: 'Whitelist',
            beyaz_liste_aciklama: 'Users in whitelist can call directly without typing emergency reason',
            beyaz_liste_bos: 'No one in whitelist.',
            beyaz_liste_ekle_btn: '+ Add User',
            beyaz_liste_ekle_baslik: 'Add to Whitelist',
            beyaz_liste_cikar_btn: 'Remove',
            beyaz_liste_eklendi: 'Added to whitelist',
            beyaz_liste_cikarildi: 'Removed from whitelist',
            beyaz_liste_ekle_onay: 'Add {isim} to whitelist?',
            beyaz_liste_cikar_onay: 'Remove {isim} from whitelist?',
            beyaz_liste_direkt_ara: 'Whitelist',
            beyaz_liste_uyari_baslik: 'Quick Call',
            beyaz_liste_uyari_metin: 'You are in whitelist, calling directly...',
            nick_degistir_btn: 'Change Nick',
            timeout_baslik: 'User Timeout',
            timeout_aciklama: 'Type a username and select duration to mute them across all chats.',
            timeout_kullanici_placeholder: 'Username...',
            timeout_sustur_btn: 'Mute',
            timeout_1saat: '1 Hour', timeout_1gun: '1 Day', timeout_1hafta: '1 Week', timeout_kalici: 'Permanent',
            timeout_kaldir: 'Remove Timeout',
            timeout_aktif_liste: 'Active Timeouts',
            timeout_yok: 'No active timeouts.',
            timeout_uygulandi: '{isim} muted!',
            timeout_kaldirildi: '{isim} timeout removed!',
            timeout_kalan: 'Remaining', timeout_dakika: 'min', timeout_saat: 'h', timeout_gun: 'd', timeout_suresiz: 'Permanent',
            timeout_susturulmus: 'Muted',
            timeout_locked_title: 'Chat Suspended for You',
            timeout_locked_desc: 'You have been temporarily muted by an administrator.',
            timeout_locked_by: 'Muted By:', timeout_locked_remaining: 'Time Remaining:',
            timeout_locked_reason: 'Reason:', timeout_locked_no_reason: 'No reason provided.',
            timeout_locked_permanent: 'Permanently Muted',
            ozel_sure: 'Custom Duration', ozel_sure_dk: 'Enter duration in minutes',
            ozel_sure_uygula: 'Apply Duration', ozel_sure_gecersiz: 'Please enter a valid minute value!',
            ozel_sure_birim: 'Unit', ozel_sure_dakika: 'Minutes', ozel_sure_saat: 'Hours', ozel_sure_gun: 'Days',
            timeout_1dk: '1 Minute', timeout_5dk: '5 Minutes', timeout_10dk: '10 Minutes', timeout_15dk: '15 Minutes',
            timeout_30dk: '30 Minutes', timeout_1s: '1 Hour', timeout_3s: '3 Hours', timeout_6s: '6 Hours',
            timeout_12s: '12 Hours', timeout_24s: '24 Hours',
            timeout_aciklama_placeholder: 'Reason (optional)...',
            timeout_aciklama_baslik: 'Add Reason',
        }
    };
    function t(anahtar) { return (CEVIRILER[aktifDil] && CEVIRILER[aktifDil][anahtar]) || CEVIRILER.tr[anahtar] || anahtar; }

    let audioCtx = null;
    function sesMotorunuBaslat() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }
    document.addEventListener('click', sesMotorunuBaslat, { once: true });
    document.addEventListener('keydown', sesMotorunuBaslat, { once: true });

    function bildirimSesiCal() {
        try {
            sesMotorunuBaslat();
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 0.25);
        } catch (e) {}
    }

    // ==================== TOAST SİSTEMİ ====================
    function toastGoster(mesaj, tip = 'bilgi', sure = 3000) {
        let container = document.getElementById('f5-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'f5-toast-container';
            container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000000; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        const renkler = {
            basarili: { bg: 'rgba(83,252,24,0.15)', border: '#53fc18', text: '#53fc18', icon: '✅' },
            hata: { bg: 'rgba(255,76,76,0.15)', border: '#ff4c4c', text: '#ff4c4c', icon: '❌' },
            uyari: { bg: 'rgba(255,183,0,0.15)', border: '#ffb700', text: '#ffb700', icon: '⚠️' },
            bilgi: { bg: 'rgba(59,130,246,0.15)', border: '#3b82f6', text: '#3b82f6', icon: 'ℹ️' }
        };
        const r = renkler[tip] || renkler.bilgi;
        toast.style.cssText = `
            background: rgba(22,23,27,0.95);
            backdrop-filter: blur(12px);
            border: 1px solid ${r.border};
            border-radius: 12px;
            padding: 14px 18px;
            color: #fff;
            font-size: 13px;
            font-weight: 600;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 10px;
            pointer-events: auto;
            animation: f5-toast-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            max-width: 360px;
            min-width: 200px;
            word-break: break-word;
        `;
        toast.innerHTML = `<span style="font-size:16px;">${r.icon}</span><span style="flex:1;">${mesaj}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'f5-toast-out 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, sure);
    }

    const toastStil = document.createElement('style');
    toastStil.textContent = `
        @keyframes f5-toast-in { from { opacity: 0; transform: translateX(60px) scale(0.9); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes f5-toast-out { from { opacity: 1; transform: translateX(0) scale(1); } to { opacity: 0; transform: translateX(60px) scale(0.9); } }
    `;
    document.head.appendChild(toastStil);

    // ==================== ÖZEL ONAY MODALI ====================
    const confirmHtml = `
        <div id="f5-confirm-modal" class="f5-confirm-overlay">
            <div class="f5-confirm-box">
                <div class="f5-confirm-title" data-i18n="confirm_baslik">${t('confirm_baslik')}</div>
                <div class="f5-confirm-metin" id="f5-confirm-metin"></div>
                <div class="f5-buttons">
                    <button id="f5-confirm-iptal" class="f5-btn f5-btn-secondary f5-ripple-btn" data-i18n="confirm_vazgec">${t('confirm_vazgec')}</button>
                    <button id="f5-confirm-tamam" class="f5-btn f5-btn-primary f5-ripple-btn" style="background-color:#ff4c4c; color:#fff; box-shadow:0 4px 12px rgba(255,76,76,0.4);" data-i18n="confirm_evet">${t('confirm_evet')}</button>
                </div>
            </div>
        </div>
    `;
    const confirmSarmalayici = document.createElement('div');
    confirmSarmalayici.innerHTML = confirmHtml;
    document.body.appendChild(confirmSarmalayici.firstElementChild);

    const confirmOverlay = document.getElementById('f5-confirm-modal');
    const confirmMetinEl = document.getElementById('f5-confirm-metin');
    const confirmTamamBtn = document.getElementById('f5-confirm-tamam');
    const confirmIptalBtn = document.getElementById('f5-confirm-iptal');

    function ozelOnayGoster(mesaj, butonMetni = null) {
        return new Promise((resolve) => {
            confirmMetinEl.textContent = mesaj;
            confirmTamamBtn.textContent = butonMetni || t('confirm_evet');
            confirmOverlay.classList.add('f5-confirm-show');
            function temizle(sonuc) {
                confirmOverlay.classList.remove('f5-confirm-show');
                confirmTamamBtn.removeEventListener('click', onTamam);
                confirmIptalBtn.removeEventListener('click', onIptal);
                confirmOverlay.removeEventListener('click', onOverlay);
                resolve(sonuc);
            }
            function onTamam() { temizle(true); }
            function onIptal() { temizle(false); }
            function onOverlay(e) { if (e.target === confirmOverlay) temizle(false); }
            confirmTamamBtn.addEventListener('click', onTamam);
            confirmIptalBtn.addEventListener('click', onIptal);
            confirmOverlay.addEventListener('click', onOverlay);
        });
    }

    // ==================== ZİL SİSTEMİ ====================
    const ZIL_VARSAYILAN_LISTE = [
        { id: 'klasik', anahtar: 'zil_ad_klasik', sure: 1600 },
        { id: 'dijital', anahtar: 'zil_ad_dijital', sure: 1100 },
        { id: 'yumusak', anahtar: 'zil_ad_yumusak', sure: 1800 },
        { id: 'retro', anahtar: 'zil_ad_retro', sure: 1300 },
        { id: 'marimba', anahtar: 'zil_ad_marimba', sure: 1700 }
    ];

    function zilTonCal(id) {
        try {
            sesMotorunuBaslat();
            if (!audioCtx) return;
            const t0 = audioCtx.currentTime;
            const notaCal = (offset, freq, sureSn, tip, tepe) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = tip;
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.0001, t0 + offset);
                gain.gain.linearRampToValueAtTime(tepe, t0 + offset + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + sureSn);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(t0 + offset); osc.stop(t0 + offset + sureSn + 0.02);
            };
            if (id === 'klasik') { notaCal(0, 950, 0.36, 'sine', 0.26); notaCal(0.42, 1400, 0.36, 'sine', 0.26); }
            else if (id === 'dijital') { [0, 0.15, 0.3].forEach((off, i) => notaCal(off, 600 + i * 220, 0.12, 'square', 0.16)); }
            else if (id === 'yumusak') { notaCal(0, 784, 1.05, 'sine', 0.22); notaCal(0, 1175, 1.05, 'sine', 0.12); }
            else if (id === 'retro') { for (let i = 0; i < 4; i++) notaCal(i * 0.1, 520, 0.08, 'sawtooth', 0.12); }
            else if (id === 'marimba') { [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => notaCal(i * 0.13, freq, 0.34, 'triangle', 0.2)); }
        } catch (e) {}
    }
    function ozelZilVeriGetir() {
        try { const ham = localStorage.getItem('kick_f5_ozel_zil'); return ham ? JSON.parse(ham) : null; } catch (e) { return null; }
    }
    function ozelZilVeriKaydet(ad, dataUrl, sureSn) {
        try { localStorage.setItem('kick_f5_ozel_zil', JSON.stringify({ ad, dataUrl, sure: sureSn })); return true; } catch (e) { return false; }
    }
    function ozelZilSil() { localStorage.removeItem('kick_f5_ozel_zil'); }
    function ozelZilDosyaYukle(file) {
        return new Promise((resolve, reject) => {
            if (!file) { reject('dosya-yok'); return; }
            const adKucuk = (file.name || '').toLowerCase();
            const mp3Mi = file.type === 'audio/mpeg' || file.type === 'audio/mp3' || adKucuk.endsWith('.mp3');
            if (!mp3Mi) { reject('format'); return; }
            const gecId = URL.createObjectURL(file);
            const prob = new Audio();
            prob.preload = 'metadata';
            prob.onloadedmetadata = () => {
                const sureSn = prob.duration;
                URL.revokeObjectURL(gecId);
                if (!isFinite(sureSn) || sureSn > 20.5) { reject('sure'); return; }
                const okuyucu = new FileReader();
                okuyucu.onload = () => {
                    if (!ozelZilVeriKaydet(file.name, okuyucu.result, sureSn)) { reject('kayit'); return; }
                    resolve({ ad: file.name, sure: sureSn });
                };
                okuyucu.onerror = () => reject('okuma');
                okuyucu.readAsDataURL(file);
            };
            prob.onerror = () => { URL.revokeObjectURL(gecId); reject('format'); };
            prob.src = gecId;
        });
    }
    function seciliZilId() { return localStorage.getItem('kick_f5_zil_secim') || 'klasik'; }
    function seciliZilAyarla(id) { localStorage.setItem('kick_f5_zil_secim', id); }

    let zilOnizlemeAudio = null;
    function zilOnizlemeCal(id) {
        if (zilOnizlemeAudio) { zilOnizlemeAudio.pause(); zilOnizlemeAudio = null; }
        if (id === 'custom') {
            const veri = ozelZilVeriGetir();
            if (!veri) return;
            zilOnizlemeAudio = new Audio(veri.dataUrl);
            zilOnizlemeAudio.playsInline = true;
            zilOnizlemeAudio.play().catch(() => {});
        } else {
            zilTonCal(id);
        }
    }
    let zilLoopTimer = null;
    let zilCalanOzelAudio = null;
    function zilCalmayaBasla() {
        zilCalmayiDurdur();
        sesMotorunuBaslat();
        const id = seciliZilId();
        if (id === 'custom') {
            const veri = ozelZilVeriGetir();
            if (veri) {
                zilCalanOzelAudio = new Audio(veri.dataUrl);
                zilCalanOzelAudio.playsInline = true;
                zilCalanOzelAudio.loop = true;
                zilCalanOzelAudio.play().catch(() => {});
                return;
            }
        }
        const meta = ZIL_VARSAYILAN_LISTE.find(z => z.id === id) || ZIL_VARSAYILAN_LISTE[0];
        zilTonCal(meta.id);
        zilLoopTimer = setInterval(() => zilTonCal(meta.id), meta.sure);
    }
    function zilCalmayiDurdur() {
        if (zilLoopTimer) { clearInterval(zilLoopTimer); zilLoopTimer = null; }
        if (zilCalanOzelAudio) { zilCalanOzelAudio.pause(); zilCalanOzelAudio.currentTime = 0; zilCalanOzelAudio = null; }
    }

    function acilDurumSesiniBaslat() {
        if (mevcutKullaniciAdi === ADMIN_KULLANICI_ADI) return;
        acilDurumSesiniDurdur();
        if (acilDurumSesCalıyor) return;
        if (!EMERGENCY_SOUND_URL) { acilDurumSirenSesiCal(); return; }
        try {
            acilDurumSesElementi = new Audio(EMERGENCY_SOUND_URL);
            acilDurumSesElementi.loop = true;
            acilDurumSesElementi.volume = 0.8;
            acilDurumSesElementi.playsInline = true;
            const playPromise = acilDurumSesElementi.play();
            if (playPromise !== undefined) {
                playPromise.then(() => { acilDurumSesCalıyor = true; acilDurumAutoplayEngellendi = false; })
                .catch(() => { acilDurumAutoplayEngellendi = true; acilDurumSesCalıyor = false; acilDurumSirenSesiCal(); });
            } else { acilDurumSesCalıyor = true; }
        } catch (e) { acilDurumSirenSesiCal(); }
    }
    function acilDurumSesiniDurdur() {
        if (acilDurumSesElementi) {
            try { acilDurumSesElementi.pause(); acilDurumSesElementi.currentTime = 0; acilDurumSesElementi.src = ''; } catch (e) {}
            acilDurumSesElementi = null;
        }
        acilDurumSesCalıyor = false;
        acilDurumAutoplayEngellendi = false;
        if (acilDurumSirenTimer) { clearInterval(acilDurumSirenTimer); acilDurumSirenTimer = null; }
    }
    function acilDurumSirenSesiCal() {
        if (mevcutKullaniciAdi === ADMIN_KULLANICI_ADI) return;
        if (acilDurumSirenTimer) return;
        sesMotorunuBaslat();
        if (!audioCtx) return;
        const sirenCal = () => {
            if (!audioCtx) return;
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                const t0 = audioCtx.currentTime;
                osc.frequency.setValueAtTime(600, t0);
                osc.frequency.linearRampToValueAtTime(1200, t0 + 0.5);
                osc.frequency.linearRampToValueAtTime(600, t0 + 1.0);
                gain.gain.setValueAtTime(0.15, t0);
                gain.gain.linearRampToValueAtTime(0.001, t0 + 1.0);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(t0); osc.stop(t0 + 1.0);
            } catch (e) {}
        };
        sirenCal();
        acilDurumSirenTimer = setInterval(sirenCal, 1100);
    }
    function acilDurumSesiKullaniciEtkilesimiyleBaslat() {
        acilDurumSesiniBaslat();
        const btn = document.getElementById('f5-acil-ses-baslat-btn');
        if (btn) btn.style.display = 'none';
    }
    function seslendirmeDesteiVarMi() {
        return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
    }
    function acilNedenSesiniDurdur() {
        if (acilNedenSesTimer) { clearTimeout(acilNedenSesTimer); acilNedenSesTimer = null; }
        acilNedenTekrarSayisi = 0;
        try { if (seslendirmeDesteiVarMi()) window.speechSynthesis.cancel(); } catch (e) {}
    }
    function uygunSesiSec(dilKodu) {
        try {
            const sesler = window.speechSynthesis.getVoices() || [];
            const on = dilKodu.slice(0, 2).toLowerCase();
            return sesler.find(v => v.lang && v.lang.toLowerCase().startsWith(dilKodu.toLowerCase()))
                || sesler.find(v => v.lang && v.lang.toLowerCase().startsWith(on))
                || null;
        } catch (e) { return null; }
    }
    function metniSeslendir(metin) {
        if (!seslendirmeDesteiVarMi() || !metin) return;
        try {
            const dilKodu = aktifDil === 'en' ? 'en-US' : 'tr-TR';
            const soz = new SpeechSynthesisUtterance(String(metin));
            soz.lang = dilKodu;
            soz.rate = 0.95;
            soz.pitch = 1;
            soz.volume = 1;
            const ses = uygunSesiSec(dilKodu);
            if (ses) soz.voice = ses;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(soz);
        } catch (e) {}
    }
    function acilNedeniSesliOku(neden, arayanAd) {
        if (!seslendirmeDesteiVarMi()) return;
        acilNedenSesiniDurdur();
        const temizNeden = (neden || '').toString().trim();
        const ad = arayanAd || '';
        let cumle;
        if (aktifDil === 'en') {
            cumle = temizNeden ? `Emergency call. ${ad ? ad + ' says: ' : ''}${temizNeden}` : `Emergency call. ${ad ? ad + ' is calling you.' : 'Someone is calling you.'}`;
        } else {
            cumle = temizNeden ? `Acil durum araması. ${ad ? ad + ' diyor ki: ' : ''}${temizNeden}` : `Acil durum araması. ${ad ? ad + ' sizi arıyor.' : 'Biri sizi arıyor.'}`;
        }
        const tekrarEt = () => {
            metniSeslendir(cumle);
            acilNedenTekrarSayisi++;
            if (acilNedenTekrarSayisi < ACIL_TTS_TEKRAR) {
                acilNedenSesTimer = setTimeout(tekrarEt, ACIL_TTS_ARALIK);
            } else {
                acilNedenSesTimer = null;
            }
        };
        let sesListesi = [];
        try { sesListesi = window.speechSynthesis.getVoices() || []; } catch (e) {}
        if (sesListesi.length === 0) {
            try { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; }; } catch (e) {}
            acilNedenSesTimer = setTimeout(tekrarEt, 700);
        } else { tekrarEt(); }
    }

    function anahtarGuvenliYap(ad) { return (ad || '').replace(/[.#$/\[\]]/g, '_'); }

    // ==================== BEYAZ LİSTE ====================
    function beyazListedeMi(username) {
        if (!username) return false;
        const temizAd = String(username).trim();
        if (!temizAd) return false;
        const guvenliAd = anahtarGuvenliYap(temizAd);
        if (beyazListeCache[guvenliAd] && beyazListeCache[guvenliAd].username) {
            if (beyazListeCache[guvenliAd].username.toLowerCase() === temizAd.toLowerCase()) return true;
        }
        if (beyazListeCache[temizAd] && beyazListeCache[temizAd].username) {
            if (beyazListeCache[temizAd].username.toLowerCase() === temizAd.toLowerCase()) return true;
        }
        const hedefKucuk = temizAd.toLowerCase();
        return Object.values(beyazListeCache || {}).some(v => v && v.username && v.username.toLowerCase() === hedefKucuk);
    }
    function beyazListeyeEkle(username, avatarUrl) {
        if (!db || !username || !username.trim()) return;
        const temizAd = username.trim();
        const guvenliAd = anahtarGuvenliYap(temizAd);
        db.ref(`${BEYAZ_LISTE_YOLU}/${guvenliAd}`).set({
            username: temizAd,
            avatar: avatarUrl || null,
            eklenmeTarihi: firebase.database.ServerValue.TIMESTAMP,
            ekleyen: mevcutKullaniciAdi || 'Admin'
        }).catch(err => {
            console.error('[Kick F5] Beyaz listeye ekleme hatası:', err);
            toastGoster('Beyaz listeye eklenemedi: ' + (err.message || err), 'hata');
        });
    }
    function beyazListedenCikar(username) {
        if (!db || !username) return;
        const temizAd = String(username).trim();
        const guvenliAd = anahtarGuvenliYap(temizAd);
        db.ref(`${BEYAZ_LISTE_YOLU}/${guvenliAd}`).remove().catch(err => {
            console.warn('[Kick F5] Güvenli anahtar ile silme başarısız:', err);
        });
        Object.entries(beyazListeCache || {}).forEach(([key, val]) => {
            if (val && val.username && val.username.toLowerCase() === temizAd.toLowerCase()) {
                if (key !== guvenliAd) db.ref(`${BEYAZ_LISTE_YOLU}/${key}`).remove();
            }
        });
    }
    function beyazListeRenderla() {
        const liste = document.getElementById('f5-admin-beyaz-liste');
        if (!liste) return;
        const anahtarlar = Object.keys(beyazListeCache || {});
        if (anahtarlar.length === 0) {
            liste.innerHTML = `<div class="f5-aktif-bos" data-i18n="beyaz_liste_bos">${t('beyaz_liste_bos')}</div>`;
            return;
        }
        liste.innerHTML = '';
        const eklenenler = new Set();
        anahtarlar.forEach(k => {
            const veri = beyazListeCache[k];
            if (!veri || !veri.username) return;
            const kullaniciLower = veri.username.toLowerCase();
            if (eklenenler.has(kullaniciLower)) return;
            eklenenler.add(kullaniciLower);
            const satir = document.createElement('div');
            satir.className = 'f5-beyaz-liste-item';
            const avatarIc = veri.avatar ? `<img src="${veri.avatar}">` : (veri.username || '?').charAt(0).toUpperCase();
            const tarih = veri.eklenmeTarihi ? new Date(veri.eklenmeTarihi).toLocaleString('tr-TR') : '-';
            satir.innerHTML = `
                <div class="f5-beyaz-liste-avatar">${avatarIc}</div>
                <div class="f5-beyaz-liste-info">
                    <div class="f5-beyaz-liste-isim">${veri.username}</div>
                    <div class="f5-beyaz-liste-tarih">${tarih}</div>
                </div>
                <button class="f5-beyaz-liste-cikar-btn" data-username="${veri.username}" data-i18n="beyaz_liste_cikar_btn">${t('beyaz_liste_cikar_btn')}</button>
            `;
            liste.appendChild(satir);
        });
        liste.querySelectorAll('.f5-beyaz-liste-cikar-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const username = btn.getAttribute('data-username');
                const onay = await ozelOnayGoster(t('beyaz_liste_cikar_onay').replace('{isim}', username), t('beyaz_liste_cikar_btn'));
                if (!onay) return;
                beyazListedenCikar(username);
            });
        });
    }
    function beyazListeYukle() {
        if (!db) return;
        try {
            db.ref(BEYAZ_LISTE_YOLU).on('value', snap => {
                beyazListeCache = snap.val() || {};
                const liste = document.getElementById('f5-admin-beyaz-liste');
                if (liste) beyazListeRenderla();
            }, (error) => {
                console.warn('[Kick F5] Beyaz liste okuma hatası:', error?.code || error?.message);
            });
        } catch (e) {
            console.warn('[Kick F5] Beyaz liste başlatma hatası:', e);
        }
    }

    // ==================== GLOBAL TIMEOUT ====================
    function globalTimeoutYukle() {
        if (!db) return;
        try {
            db.ref(GLOBAL_TIMEOUT_YOLU).on('value', snap => {
                globalTimeoutCache = snap.val() || {};
                const simdi = Date.now();
                Object.keys(globalTimeoutCache).forEach(key => {
                    const tData = globalTimeoutCache[key];
                    if (tData && tData.bitis && tData.bitis !== -1 && tData.bitis <= simdi) {
                        db.ref(`${GLOBAL_TIMEOUT_YOLU}/${key}`).remove();
                    }
                });
                const liste = document.getElementById('f5-timeout-aktif-liste');
                if (liste) globalTimeoutListesiRenderla();
                timeoutKilitEkraniniGuncelle();
            }, (error) => {
                console.warn('[Kick F5] Global timeout okuma hatası:', error?.code || error?.message);
            });
        } catch (e) {
            console.warn('[Kick F5] Global timeout başlatma hatası:', e);
        }
    }
    function kullaniciGlobalSusturulmusMu(username) {
        if (!username) return false;
        const guvenliAd = anahtarGuvenliYap(username);
        const tData = globalTimeoutCache[guvenliAd];
        if (!tData) return false;
        if (tData.bitis === -1) return true;
        if (tData.bitis > Date.now()) return true;
        return false;
    }
    function globalTimeoutUygula(username, sureMs, sebep = '') {
        if (!db || !username) return;
        const guvenliAd = anahtarGuvenliYap(username);
        if (sureMs === 0) {
            db.ref(`${GLOBAL_TIMEOUT_YOLU}/${guvenliAd}`).remove();
        } else {
            db.ref(`${GLOBAL_TIMEOUT_YOLU}/${guvenliAd}`).set({
                username: username,
                bitis: sureMs === -1 ? -1 : Date.now() + sureMs,
                uygulayan: mevcutKullaniciAdi,
                baslangic: Date.now(),
                sebep: sebep || null
            });
        }
    }
    function globalTimeoutListesiRenderla() {
        const liste = document.getElementById('f5-timeout-aktif-liste');
        if (!liste) return;
        const simdi = Date.now();
        const anahtarlar = Object.keys(globalTimeoutCache || {});
        if (anahtarlar.length === 0) {
            liste.innerHTML = `<div style="font-size:10px; color:#666; font-style:italic; padding:4px;">${t('timeout_yok')}</div>`;
            return;
        }
        liste.innerHTML = '';
        anahtarlar.forEach(key => {
            const tData = globalTimeoutCache[key];
            if (!tData || !tData.username) return;
            if (tData.bitis !== -1 && tData.bitis <= simdi) return;
            let kalanStr = '';
            if (tData.bitis === -1) { kalanStr = t('timeout_suresiz'); }
            else {
                const kalan = tData.bitis - simdi;
                const dk = Math.floor(kalan / 60000);
                const sa = Math.floor(dk / 60);
                const gun = Math.floor(sa / 24);
                if (gun > 0) kalanStr = `${gun} ${t('timeout_gun')}`;
                else if (sa > 0) kalanStr = `${sa} ${t('timeout_saat')}`;
                else kalanStr = `${dk} ${t('timeout_dakika')}`;
            }
            const satir = document.createElement('div');
            satir.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; background: rgba(255,76,76,0.08); border: 1px solid rgba(255,76,76,0.2); border-radius: 6px; padding: 6px 8px;';
            satir.innerHTML = `
                <div style="flex:1; min-width:0;">
                    <div style="font-size:11px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">⏱️ ${tData.username}</div>
                    <div style="font-size:9px; color:#ff8a8a;">${t('timeout_kalan')}: ${kalanStr}</div>
                </div>
                <button class="f5-timeout-kaldir-btn" data-user="${tData.username}" style="background: rgba(255,255,255,0.08); color:#ccc; border:1px solid rgba(255,255,255,0.15); border-radius:5px; padding:4px 8px; font-size:9px; font-weight:700; cursor:pointer; white-space:nowrap;">${t('timeout_kaldir')}</button>
            `;
            liste.appendChild(satir);
        });
        liste.querySelectorAll('.f5-timeout-kaldir-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const username = btn.getAttribute('data-user');
                globalTimeoutUygula(username, 0);
            });
        });
    }
    setInterval(() => {
        const liste = document.getElementById('f5-timeout-aktif-liste');
        if (liste && liste.offsetParent !== null) globalTimeoutListesiRenderla();
    }, 30000);

    // ==================== TIMEOUT KİLİT EKRANI ====================
    let timeoutKilitInterval = null;
    let timeoutKilitCountdownInterval = null;
    function timeoutKilitEkraniniGuncelle() {
        const overlay = document.getElementById('f5-timeout-overlay');
        const details = document.getElementById('f5-timeout-details');
        if (!overlay || !details) return;
        const benimTimeoutum = kullaniciGlobalSusturulmusMu(mevcutKullaniciAdi);
        const guvenliBen = anahtarGuvenliYap(mevcutKullaniciAdi);
        const tData = globalTimeoutCache[guvenliBen];
        if (benimTimeoutum && tData) {
            overlay.style.display = 'flex';
            const uygulayan = tData.uygulayan || 'Yönetici';
            let kalanMetni = '';
            if (tData.bitis === -1) { kalanMetni = t('timeout_locked_permanent'); }
            else {
                const kalan = tData.bitis - Date.now();
                if (kalan > 0) {
                    const dk = Math.floor(kalan / 60000);
                    const sn = Math.floor((kalan % 60000) / 1000);
                    kalanMetni = `${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}`;
                } else { kalanMetni = '00:00'; }
            }
            details.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <span style="font-size:12px; color:#888; font-weight:600;">${t('timeout_locked_by')}</span>
                    <span style="font-size:14px; font-weight:800; color:#ffb700; text-shadow:0 0 8px rgba(255,183,0,0.3);">${uygulayan}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <span style="font-size:12px; color:#888; font-weight:600;">${t('timeout_locked_remaining')}</span>
                    <span id="f5-timeout-countdown" style="font-size:28px; font-weight:900; color:#ff4c4c; font-variant-numeric: tabular-nums; text-shadow: 0 0 16px rgba(255,76,76,0.5); letter-spacing:2px;">${kalanMetni}</span>
                </div>
                ${tData.sebep ? `
                <div style="margin-top:12px; padding:14px; background:rgba(255,255,255,0.05); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="font-size:11px; color:#888; margin-bottom:6px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">${t('timeout_locked_reason')}</div>
                    <div style="font-size:13px; color:#e0e0e0; word-break:break-word; line-height:1.5;">${tData.sebep}</div>
                </div>
                ` : `
                <div style="margin-top:12px; padding:14px; background:rgba(255,255,255,0.05); border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="font-size:12px; color:#888; font-style:italic;">${t('timeout_locked_no_reason')}</div>
                </div>
                `}
            `;
            if (timeoutKilitCountdownInterval) clearInterval(timeoutKilitCountdownInterval);
            if (tData.bitis !== -1) {
                timeoutKilitCountdownInterval = setInterval(() => {
                    const el = document.getElementById('f5-timeout-countdown');
                    if (el) {
                        const kalan = tData.bitis - Date.now();
                        if (kalan > 0) {
                            const dk = Math.floor(kalan / 60000);
                            const sn = Math.floor((kalan % 60000) / 1000);
                            el.textContent = `${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}`;
                        } else {
                            el.textContent = '00:00';
                            clearInterval(timeoutKilitCountdownInterval);
                            timeoutKilitCountdownInterval = null;
                            timeoutKilitEkraniniGuncelle();
                        }
                    }
                }, 1000);
            }
            const chatInputBoxEl = document.getElementById('f5-chat-input-box');
            if (chatInputBoxEl) chatInputBoxEl.style.display = 'none';
        } else {
            overlay.style.display = 'none';
            if (timeoutKilitCountdownInterval) { clearInterval(timeoutKilitCountdownInterval); timeoutKilitCountdownInterval = null; }
            const chatInputBoxEl = document.getElementById('f5-chat-input-box');
            if (chatInputBoxEl && typeof aktifOdaId !== 'undefined' && aktifOdaId) chatInputBoxEl.style.display = 'flex';
        }
    }

    // ==================== ACİL ARAMA ONAY AKIŞI ====================
    let acilOnayDinleyici = null;
    let acilOnayBeklemeTimer = null;
    function acilOnayBekleniyorEkraniGoster(kayitKey, baslik) {
        const eski = document.getElementById('f5-acil-bekleme-modal');
        if (eski) eski.remove();
        const modal = document.createElement('div');
        modal.id = 'f5-acil-bekleme-modal';
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 10000003; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px);';
        modal.innerHTML = `
            <div style="width: 340px; background: rgba(22,23,27,0.98); border: 2px solid #ffb700; border-radius: 18px; padding: 26px 22px; color: #fff; box-shadow: 0 0 40px rgba(255,183,0,0.45); text-align: center;">
                <div style="font-size: 40px; margin-bottom: 10px; animation: f5-acil-bekle-pulse 1.5s ease-in-out infinite;">⏳</div>
                <div style="font-size: 16px; font-weight: 800; color: #ffb700; margin-bottom: 8px;">${t('onay_bekle_baslik')}</div>
                <div style="font-size: 12px; color: #aaa; line-height: 1.5; margin-bottom: 16px;">
                    ${t('onay_bekle_aciklama')}<br>
                    <b style="color:#fff;">${baslik}</b> ${t('onay_bekle_alt')}
                </div>
                <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-bottom: 16px;">
                    <div id="f5-acil-bekleme-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg,#ffb700,#ff4c4c); transition: width 30s linear;"></div>
                </div>
                <button id="f5-acil-bekleme-iptal" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.08); color: #ccc; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;">${t('onay_bekle_iptal')}</button>
            </div>
        `;
        document.body.appendChild(modal);
        requestAnimationFrame(() => {
            const bar = document.getElementById('f5-acil-bekleme-bar');
            if (bar) bar.style.width = '100%';
        });
        document.getElementById('f5-acil-bekleme-iptal').addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            acilOnayBeklemesiniTemizle();
            f5BekleyenAcilArama = null;
            acilDurumNedeni = '';
            aktifAcilNeden = '';
            if (db && kayitKey) db.ref(`${ACIL_ARAMA_YOLU}/${kayitKey}/durum`).set('iptal');
            const m = document.getElementById('f5-acil-bekleme-modal');
            if (m) m.remove();
        });
        if (db && kayitKey) {
            if (acilOnayDinleyici) { acilOnayDinleyici.ref.off('value', acilOnayDinleyici.fn); }
            const ref = db.ref(`${ACIL_ARAMA_YOLU}/${kayitKey}/durum`);
            const fn = (snap) => {
                const durum = snap.val();
                if (durum === 'onaylandi') {
                    acilOnayBeklemesiniTemizle();
                    const m = document.getElementById('f5-acil-bekleme-modal');
                    if (m) m.remove();
                    acilOnayBilgisiGoster(t('onay_onaylandi_baslik'), t('onay_onaylandi_metin'), 'onaylandi');
                    setTimeout(() => {
                        if (f5BekleyenAcilArama) {
                            const bilgi = f5BekleyenAcilArama;
                            f5BekleyenAcilArama = null;
                            acilDurumModu = true;
                            if (bilgi.tip === 'grup' && bilgi.odaId) grupAramaBaslat(bilgi.odaId, bilgi.baslik);
                            else if (bilgi.hedefAd) dmAramaBaslat(bilgi.hedefAd);
                        }
                    }, 800);
                } else if (durum === 'reddedildi') {
                    acilOnayBeklemesiniTemizle();
                    f5BekleyenAcilArama = null;
                    const m = document.getElementById('f5-acil-bekleme-modal');
                    if (m) m.remove();
                    acilOnayBilgisiGoster(t('onay_reddedildi_baslik'), t('onay_reddedildi_metin'), 'reddedildi');
                } else if (durum === 'iptal') {
                    acilOnayBeklemesiniTemizle();
                    f5BekleyenAcilArama = null;
                    const m = document.getElementById('f5-acil-bekleme-modal');
                    if (m) m.remove();
                }
            };
            ref.on('value', fn);
            acilOnayDinleyici = { ref, fn };
            if (acilOnayBeklemeTimer) clearTimeout(acilOnayBeklemeTimer);
            acilOnayBeklemeTimer = setTimeout(() => {
                if (document.getElementById('f5-acil-bekleme-modal')) {
                    acilOnayBeklemesiniTemizle();
                    f5BekleyenAcilArama = null;
                    const m = document.getElementById('f5-acil-bekleme-modal');
                    if (m) m.remove();
                    acilOnayBilgisiGoster(t('onay_bekle_zamanasimi_baslik'), t('onay_bekle_zamanasimi_metin'), 'zamanasimi');
                    if (db && kayitKey) db.ref(`${ACIL_ARAMA_YOLU}/${kayitKey}/durum`).set('zamanasimi');
                }
            }, 30000);
        }
    }
    function acilOnayBeklemesiniTemizle() {
        if (acilOnayDinleyici) {
            acilOnayDinleyici.ref.off('value', acilOnayDinleyici.fn);
            acilOnayDinleyici = null;
        }
        if (acilOnayBeklemeTimer) {
            clearTimeout(acilOnayBeklemeTimer);
            acilOnayBeklemeTimer = null;
        }
    }
    function acilOnayBilgisiGoster(baslik, altMetin, tur) {
        const modal = document.createElement('div');
        modal.id = 'f5-acil-sonuc-modal';
        const renk = tur === 'onaylandi' ? '#53fc18' : (tur === 'reddedildi' ? '#ff4c4c' : '#ffb700');
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 10000004; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px);';
        modal.innerHTML = `
            <div style="width: 320px; background: rgba(22,23,27,0.98); border: 2px solid ${renk}; border-radius: 18px; padding: 26px 22px; color: #fff; box-shadow: 0 0 40px ${renk}66; text-align: center;">
                <div style="font-size: 42px; margin-bottom: 12px;">${tur === 'onaylandi' ? '✅' : (tur === 'reddedildi' ? '❌' : '⏱️')}</div>
                <div style="font-size: 17px; font-weight: 800; color: ${renk}; margin-bottom: 8px;">${baslik}</div>
                <div style="font-size: 12px; color: #aaa; line-height: 1.5;">${altMetin}</div>
            </div>
        `;
        document.body.appendChild(modal);
        const kapatmaSuresi = tur === 'reddedildi' ? 3000 : 1500;
        setTimeout(() => modal.remove(), kapatmaSuresi);
    }
function acilAramayiDirektBaslat(odaId, baslik, grupMu, digerUye) {
    acilOnayBeklemesiniTemizle();
    f5BekleyenAcilArama = null;
    acilDurumNedeni = '';
    const adminMi = mevcutKullaniciAdi === ADMIN_KULLANICI_ADI;
    const beyazMi = beyazListedeMi(mevcutKullaniciAdi);
    if (db) {
        try {
            db.ref(ACIL_ARAMA_YOLU).push().set({
                gonderen: mevcutKullaniciAdi,
                gonderenAvatar: mevcutAvatarUrl || null,
                hedef: grupMu ? `Grup: ${baslik}` : digerUye,
                hedefTip: grupMu ? 'grup' : 'dm',
                hedefAd: grupMu ? null : digerUye,
                odaId: odaId || null,
                neden: adminMi ? 'Admin - direkt acil arama' : 'Beyaz liste - otomatik onay',
                beyazListe: beyazMi,
                adminAcil: adminMi,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                durum: 'onaylandi'
            });
        } catch (e) { console.warn('[Kick F5] Acil kayıt yazılamadı:', e); }
    }
    acilDurumModu = true;
    setTimeout(() => {
        if (grupMu && odaId) grupAramaBaslat(odaId, baslik);
        else if (digerUye) dmAramaBaslat(digerUye);
    }, 100);
}
    function acilDurumSecimModaliniAc(odaId, baslik, grupMu, digerUye) {
        const eskiModal = document.getElementById('f5-acil-secim-modal');
        if (eskiModal) eskiModal.remove();
        const modalEl = document.createElement('div');
        modalEl.id = 'f5-acil-secim-modal';
        modalEl.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 10000001; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(6px);';
        modalEl.innerHTML = `
            <div style="width: 320px; background: var(--f5-panel-bg, rgba(22,23,27,0.95)); border: 1px solid var(--f5-panel-border, rgba(255,255,255,0.1)); border-radius: 18px; padding: 24px; color: #fff; box-shadow: 0 24px 48px rgba(0,0,0,0.7);">
                <div style="font-size: 16px; font-weight: 700; margin-bottom: 6px; text-align: center;">${t('sesli_arama_btn')}</div>
                <div style="font-size: 12px; color: #888; text-align: center; margin-bottom: 16px;">${baslik}</div>
                <div style="display: flex; justify-content: center; margin-bottom: 20px;">
                    <div id="f5-acil-secim-avatar" class="f5-cagri-avatar" style="width: 72px; height: 72px; margin-bottom: 0;"></div>
                </div>
                <button id="f5-normal-arama-btn" style="width: 100%; padding: 12px; margin-bottom: 10px; background: linear-gradient(145deg, #6bff2f, #3ed10f); color: #0a0f07; border: none; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span style="width: 16px; height: 16px; flex-shrink: 0; display: inline-flex;">${SVG_TELEFON}</span><span>${t('sesli_arama_btn')}</span>
                </button>
                <button id="f5-acil-arama-btn" style="width: 100%; padding: 12px; background: linear-gradient(145deg, #ff4c4c, #c41e1e); color: #fff; border: none; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span style="width: 16px; height: 16px; flex-shrink: 0; display: inline-flex;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></span>
                    <span>ACİL DURUM ARAMASI</span>
                </button>
                <button id="f5-acil-secim-iptal" style="width: 100%; padding: 10px; margin-top: 12px; background: rgba(255,255,255,0.08); color: #ccc; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer;">${t('confirm_vazgec')}</button>
            </div>`;
        document.body.appendChild(modalEl);
        const secimAvatarEl = document.getElementById('f5-acil-secim-avatar');
        const secimAvatarCiz = (url) => {
            if (!secimAvatarEl) return;
            secimAvatarEl.innerHTML = url
                ? `<img src="${url}" class="f5-call-avatar-img">`
                : `<span class="f5-call-avatar-harf" style="font-size: 26px;">${(baslik || '?').charAt(0).toUpperCase()}</span>`;
        };
        if (grupMu) {
            secimAvatarCiz(null);
            if (db && odaId) {
                db.ref(`sohbetOdasi/${odaId}/avatar`).once('value').then(snap => secimAvatarCiz(snap.val() || null)).catch(() => {});
            }
        } else {
            secimAvatarCiz(canliKullaniciAvatarBul(digerUye));
        }
        document.getElementById('f5-normal-arama-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            modalEl.remove();
            if (grupMu) grupAramaBaslat(odaId, baslik);
            else if (digerUye) dmAramaBaslat(digerUye);
        });
        document.getElementById('f5-acil-arama-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            modalEl.remove();
            if (mevcutKullaniciAdi === ADMIN_KULLANICI_ADI) { acilAramayiDirektBaslat(odaId, baslik, grupMu, digerUye); return; }
            if (beyazListedeMi(mevcutKullaniciAdi)) { acilAramayiDirektBaslat(odaId, baslik, grupMu, digerUye); return; }
            const nedenModal = document.createElement('div');
            nedenModal.id = 'f5-acil-neden-modal';
            nedenModal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 10000002; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(6px);';
            nedenModal.innerHTML = `
                <div style="width: 340px; background: rgba(22,23,27,0.98); border: 2px solid #ff4c4c; border-radius: 18px; padding: 22px; color: #fff; box-shadow: 0 0 40px rgba(255,76,76,0.5);">
                    <div style="font-size: 15px; font-weight: 800; color: #ff4c4c; margin-bottom: 6px; text-align: center;">${t('acil_neden_baslik')}</div>
                    <div style="font-size: 12px; color: #aaa; text-align: center; margin-bottom: 14px;">${t('acil_neden_aciklama')}</div>
                    <textarea id="f5-acil-neden-input" maxlength="200" placeholder="${t('acil_neden_placeholder')}" style="width: 100%; height: 80px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: #fff; font-size: 13px; padding: 10px; outline: none; resize: none; font-family: inherit; box-sizing: border-box;"></textarea>
                    <div id="f5-acil-neden-hata" style="color: #ff4c4c; font-size: 11px; margin-top: 4px; min-height: 14px;"></div>
                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <button id="f5-acil-neden-iptal" style="flex: 1; padding: 10px; background: rgba(255,255,255,0.08); color: #ccc; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;">${t('acil_neden_iptal')}</button>
                        <button id="f5-acil-neden-gonder" style="flex: 1; padding: 10px; background: linear-gradient(145deg, #ff4c4c, #c41e1e); color: #fff; border: none; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer;">${t('acil_neden_gonder')}</button>
                    </div>
                </div>`;
            document.body.appendChild(nedenModal);
            const nedenInput = document.getElementById('f5-acil-neden-input');
            const nedenHata = document.getElementById('f5-acil-neden-hata');
            nedenInput.focus();
            document.getElementById('f5-acil-neden-iptal').addEventListener('click', (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                nedenModal.remove();
            });
            document.getElementById('f5-acil-neden-gonder').addEventListener('click', (ev) => {
                ev.stopPropagation();
                const neden = nedenInput.value.trim();
                if (neden.length < 3) { nedenHata.textContent = t('acil_neden_hata'); return; }
                nedenModal.remove();
                acilDurumNedeni = neden;
                f5BekleyenAcilArama = { tip: grupMu ? 'grup' : 'dm', odaId: odaId || null, baslik: baslik, hedefAd: grupMu ? null : digerUye };
                let yeniKayitKey = null;
                if (db) {
                    const yeniRef = db.ref(ACIL_ARAMA_YOLU).push();
                    yeniKayitKey = yeniRef.key;
                    yeniRef.set({
                        gonderen: mevcutKullaniciAdi,
                        gonderenAvatar: mevcutAvatarUrl || null,
                        hedef: grupMu ? `Grup: ${baslik}` : digerUye,
                        hedefTip: grupMu ? 'grup' : 'dm',
                        hedefAd: grupMu ? null : digerUye,
                        odaId: odaId || null,
                        neden: neden,
                        timestamp: firebase.database.ServerValue.TIMESTAMP,
                        durum: 'bekliyor'
                    });
                }
                acilOnayBekleniyorEkraniGoster(yeniKayitKey, baslik);
            });
            nedenInput.addEventListener('keydown', (e2) => {
                if (e2.key === 'Enter' && !e2.shiftKey) {
                    e2.preventDefault();
                    document.getElementById('f5-acil-neden-gonder').click();
                }
            });
        });
        document.getElementById('f5-acil-secim-iptal').addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            modalEl.remove();
        });
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) {
                e.stopPropagation();
                modalEl.remove();
            }
        });
    }

    // ==================== ZİL LİSTESİ ====================
    function zilListesiRenderla() {
        const kapsayici = document.getElementById('f5-zil-liste');
        if (!kapsayici) return;
        const secili = seciliZilId();
        const ozelVeri = ozelZilVeriGetir();
        let html = '';
        ZIL_VARSAYILAN_LISTE.forEach(z => {
            const aktifMi = secili === z.id;
            html += `
                <div class="f5-zil-item ${aktifMi ? 'active' : ''}" data-zil-id="${z.id}">
                    <button type="button" class="f5-zil-play-btn" data-zil-play="${z.id}" title="${t('zil_dinle_baslik')}">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                    </button>
                    <div class="f5-zil-info">
                        <div class="f5-zil-isim">${t(z.anahtar)}</div>
                        <div class="f5-zil-alt">${aktifMi ? t('zil_sec_etiketi') : t('zil_varsayilan_etiket')}</div>
                    </div>
                    <div class="f5-zil-check"></div>
                </div>`;
        });
        if (ozelVeri) {
            const aktifMi = secili === 'custom';
            html += `
                <div class="f5-zil-item ${aktifMi ? 'active' : ''}" data-zil-id="custom">
                    <button type="button" class="f5-zil-play-btn" data-zil-play="custom" title="${t('zil_dinle_baslik')}">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                    </button>
                    <div class="f5-zil-info">
                        <div class="f5-zil-isim">${ozelVeri.ad}</div>
                        <div class="f5-zil-alt">${aktifMi ? t('zil_sec_etiketi') : t('zil_ozel_baslik')}</div>
                    </div>
                    <div class="f5-zil-check"></div>
                    <div class="f5-zil-custom-actions">
                        <button type="button" class="f5-zil-mini-btn" id="f5-zil-ozel-degistir">${t('zil_ozel_degistir_btn')}</button>
                        <button type="button" class="f5-zil-mini-btn danger" id="f5-zil-ozel-sil">${t('zil_ozel_sil_btn')}</button>
                    </div>
                </div>`;
        } else {
            html += `
                <div class="f5-zil-custom-empty" id="f5-zil-ozel-bos">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V8"></path><path d="m8.5 11.5 3.5-3.5 3.5 3.5"></path><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>
                    <div class="f5-zil-isim">${t('zil_ozel_baslik')}</div>
                    <div class="f5-zil-custom-hint">${t('zil_ozel_bos_aciklama')}</div>
                    <button type="button" class="f5-zil-mini-btn" id="f5-zil-ozel-yukle-btn" style="margin-top:4px;">${t('zil_ozel_yukle_btn')}</button>
                </div>`;
        }
        kapsayici.innerHTML = html;
        kapsayici.querySelectorAll('.f5-zil-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target.closest('[data-zil-play]') || e.target.closest('.f5-zil-custom-actions')) return;
                seciliZilAyarla(el.getAttribute('data-zil-id'));
                zilListesiRenderla();
            });
        });
        kapsayici.querySelectorAll('[data-zil-play]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                zilOnizlemeCal(btn.getAttribute('data-zil-play'));
            });
        });
        const ozelYukleBtn = document.getElementById('f5-zil-ozel-yukle-btn');
        const ozelDegistirBtn = document.getElementById('f5-zil-ozel-degistir');
        const ozelSilBtn = document.getElementById('f5-zil-ozel-sil');
        const zilDosyaInput = document.getElementById('f5-zil-dosya-input');
        const dosyaSecDiyalogAc = () => { if (zilDosyaInput) zilDosyaInput.click(); };
        if (ozelYukleBtn) ozelYukleBtn.addEventListener('click', (e) => { e.stopPropagation(); dosyaSecDiyalogAc(); });
        if (ozelDegistirBtn) ozelDegistirBtn.addEventListener('click', (e) => { e.stopPropagation(); dosyaSecDiyalogAc(); });
        if (ozelSilBtn) ozelSilBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            ozelZilSil();
            if (seciliZilId() === 'custom') seciliZilAyarla('klasik');
            zilListesiRenderla();
        });
    }

    const SVG_TELEFON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
    const SVG_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>';

    // ==================== STİL ====================
    const stil = document.createElement('style');
    stil.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        :root {
            --f5-main-color: #53fc18;
            --f5-glow-color: rgba(83, 252, 24, 0.4);
            --f5-panel-bg: rgba(22, 23, 27, 0.9);
            --f5-panel-border: rgba(255, 255, 255, 0.08);
            --f5-value-text: #fff;
        }
        #f5-modern-container * { box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        #f5-fab-btn { position: fixed; background-color: rgba(20, 21, 24, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.6); border: 2px solid rgba(255, 255, 255, 0.05); z-index: 999998; user-select: none; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), left 0.3s ease-out, top 0.3s ease-out, border-color 0.3s; }
        .f5-unread-badge { position: absolute; top: -4px; right: -4px; background: #ff4c4c; color: #fff; font-size: 10px; font-weight: bold; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(255,76,76,0.8); z-index: 10; pointer-events: none; opacity: 0; transform: scale(0); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .f5-unread-badge.show { opacity: 1; transform: scale(1); }
        #f5-fab-btn .f5-icon { color: var(--f5-main-color); transition: transform 0.5s ease, color 0.3s; z-index: 2; }
        #f5-fab-btn:hover { transform: scale(1.08); }
        #f5-fab-btn:hover .f5-icon { transform: rotate(180deg); }
        #f5-fab-btn.f5-draggable { cursor: grab; }
        #f5-fab-btn.f5-draggable:active { cursor: grabbing; transform: scale(0.95); transition: none; }
        #f5-fab-btn.f5-tension { border-color: rgba(255, 76, 76, 0.6); animation: f5-heartbeat 0.8s infinite; }
        #f5-fab-btn.f5-tension .f5-icon { color: #ff4c4c !important; }
        #f5-fab-btn.f5-tension .f5-progress-circle { stroke: #ff4c4c !important; filter: drop-shadow(0 0 8px rgba(255,76,76,0.8)); }
        @keyframes f5-heartbeat { 0% { transform: scale(1); } 15% { transform: scale(1.15); } 30% { transform: scale(1); } 45% { transform: scale(1.15); } 100% { transform: scale(1); } }
        #f5-fab-btn.f5-fab-solid { background-color: var(--f5-main-color); border: 2px solid rgba(255,255,255,0.25); backdrop-filter: none; -webkit-backdrop-filter: none; }
        #f5-fab-btn.f5-fab-solid .f5-icon { color: #000; }
        #f5-fab-btn.f5-fab-solid .f5-progress-bg { stroke: rgba(0,0,0,0.15); }
        #f5-fab-btn.f5-fab-solid .f5-progress-circle { stroke: #000; filter: none; }
        #f5-fab-btn.f5-fab-solid.f5-tension { background-color: #ff4c4c; }
        #f5-fab-btn.f5-fab-solid.f5-tension .f5-icon { color: #fff !important; }
        #f5-fab-btn.f5-fab-minimal { background-color: #15161a; border: 1px solid var(--f5-main-color); box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
        #f5-fab-btn.f5-fab-minimal .f5-progress-bg { stroke: rgba(255,255,255,0.03); }
        #f5-fab-btn.f5-fab-gradient { background: linear-gradient(135deg, var(--f5-main-color) 0%, rgba(10,10,12,0.85) 100%); border: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
        #f5-fab-btn.f5-fab-gradient .f5-icon { color: #fff; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }
        #f5-fab-btn.f5-fab-squircle { border-radius: 28% !important; }
        #f5-fab-btn.f5-fab-squircle #f5-fab-badge { border-radius: 10px; }
        .f5-progress-ring { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: rotate(-90deg); pointer-events: none; z-index: 1; }
        .f5-progress-bg { fill: transparent; stroke: rgba(255,255,255,0.05); stroke-width: 4; }
        .f5-progress-circle { fill: transparent; stroke: var(--f5-main-color); stroke-width: 4; stroke-dasharray: 289.026; stroke-dashoffset: 289.026; stroke-linecap: round; filter: drop-shadow(0 0 4px var(--f5-glow-color)); transition: stroke-dashoffset 1s linear, stroke 0.3s; }
        #f5-fab-badge { position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); background: rgba(15, 16, 18, 0.9); backdrop-filter: blur(4px); color: var(--f5-main-color); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.6); display: none; pointer-events: none; font-variant-numeric: tabular-nums; transition: color 0.3s; }
        #f5-fab-btn.f5-tension #f5-fab-badge { color: #ff4c4c; border-color: rgba(255,76,76,0.3); }
        @keyframes f5-spin { 100% { transform: rotate(360deg); } }
        .f5-animasyon-aktif .f5-icon { animation: f5-spin 4s linear infinite !important; }
        html.f5-anim-kapali .f5-animasyon-aktif .f5-icon { animation: none !important; }
        #f5-custom-tooltip { position: fixed; background: rgba(15, 16, 18, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: #fff; padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 20px rgba(0,0,0,0.6); pointer-events: none; opacity: 0; transition: opacity 0.2s, transform 0.1s; z-index: 9999999; transform: translate(15px, 15px); }
        #f5-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 380px; background: rgba(20, 20, 20, 0.9); border-radius: 16px; padding: 2px; box-shadow: 0 24px 48px rgba(0,0,0,0.8); z-index: 999999; display: none; overflow: hidden; transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        #f5-modal.f5-genis-modal { width: 680px; }
        #f5-modal::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: conic-gradient(transparent, transparent, transparent, var(--f5-main-color)); animation: f5-border-spin 3s linear infinite; z-index: 0; opacity: 0.8; }
        @keyframes f5-border-spin { 100% { transform: rotate(360deg); } }
        #f5-modal.f5-kenarlik-kapali::before { animation: none; opacity: 0; }
        .f5-modal-content { background: var(--f5-panel-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--f5-panel-border); border-radius: 14px; padding: 22px; position: relative; z-index: 1; height: 100%; color: #fff; transition: background 0.3s, border-color 0.3s; }
        .f5-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .f5-title { font-size: 16px; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
        .f5-close { cursor: pointer; font-size: 22px; line-height: 1; color: #777; transition: color 0.2s; }
        .f5-close:hover { color: #fff; }
        .f5-ripple-btn { position: relative; overflow: hidden; }
        .f5-ripple { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.4); transform: scale(0); animation: f5-ripple-anim 0.6s linear; pointer-events: none; }
        @keyframes f5-ripple-anim { to { transform: scale(4); opacity: 0; } }
        .f5-mode-selector, .f5-tabs { display: flex; background: rgba(0,0,0,0.4); border-radius: 10px; padding: 4px; gap: 2px; margin-bottom: 16px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }
        .f5-tabs { margin-top: 14px; margin-bottom: 0; padding: 4px; border-radius: 9px; }
        .f5-mode-btn, .f5-tab-btn { flex: 1; padding: 8px 2px; background: transparent; border: none; color: #888; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.3s; line-height: 1.35; }
        .f5-tabs .f5-tab-btn { font-size: 10.5px; padding: 7px 2px; border-radius: 7px; letter-spacing: -0.05px; }
        .f5-mode-btn:hover, .f5-tab-btn:hover { color: #ddd; }
        .f5-mode-btn.active, .f5-tab-btn.active { background: rgba(255, 255, 255, 0.1); color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        .f5-tab-btn.active { background: var(--f5-main-color); color: #000; box-shadow: 0 4px 12px var(--f5-glow-color); }
        .f5-tab-btn.f5-tab-kayan { overflow: hidden; }
        .f5-tab-btn.f5-tab-kayan .f5-tab-btn-metin { display: inline-block; white-space: nowrap; }
        .f5-tab-btn.f5-tab-kayan.active .f5-tab-btn-metin { animation: f5-tab-kayma 3.4s ease-in-out infinite; }
        @keyframes f5-tab-kayma { 0%, 15% { transform: translateX(0); } 50%, 62% { transform: translateX(var(--f5-kayma-mesafe, 0px)); } 97%, 100% { transform: translateX(0); } }
        .f5-tab-content { display: none; }
        .f5-tab-content.active { display: block; animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); max-height: 60vh; overflow-y: auto; overflow-x: hidden; padding-right: 4px; }
        .f5-tab-content.active::-webkit-scrollbar { width: 5px; }
        .f5-tab-content.active::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        .f5-tab-content.active::-webkit-scrollbar-track { background: transparent; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .f5-label { font-size: 12px; font-weight: 600; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; color: #aaa; }
        .f5-input-group { display: flex; gap: 8px; margin-bottom: 20px; }
        .f5-input { width: 100%; padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 14px; color: #fff; text-align: center; outline: none; background: rgba(0,0,0,0.3); transition: all 0.2s; font-variant-numeric: tabular-nums; }
        .f5-input:focus { border-color: var(--f5-main-color); background: rgba(0,0,0,0.5); box-shadow: 0 0 0 2px var(--f5-glow-color); }
        .f5-input::-webkit-outer-spin-button, .f5-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .f5-select-wrapper { position: relative; margin-bottom: 20px; }
        .f5-select { width: 100%; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 13px; color: #fff; background: rgba(0,0,0,0.3); outline: none; cursor: pointer; transition: all 0.2s; appearance: none; font-weight: 500; }
        .f5-select:focus { border-color: var(--f5-main-color); box-shadow: 0 0 0 2px var(--f5-glow-color); }
        .f5-select-wrapper::after { content: "▼"; font-size: 9px; color: #888; position: absolute; right: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }
        .f5-slider { width: 100%; margin-bottom: 24px; accent-color: var(--f5-main-color); cursor: pointer; }
        .f5-color-picker-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .f5-color-picker { width: 36px; height: 36px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: none; overflow: hidden; }
        .f5-color-picker::-webkit-color-swatch-wrapper { padding: 0; }
        .f5-color-picker::-webkit-color-swatch { border: 2px solid rgba(255,255,255,0.2); border-radius: 50%; }
        .f5-tema-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
        .f5-tema-btn { display: flex; flex-direction: column; align-items: center; gap: 5px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 8px 2px; cursor: pointer; transition: all 0.2s; }
        .f5-tema-btn:hover { border-color: rgba(255,255,255,0.2); background: rgba(0,0,0,0.35); }
        .f5-tema-btn.active { border-color: var(--f5-main-color); box-shadow: 0 0 8px var(--f5-glow-color); background: rgba(0,0,0,0.4); }
        .f5-tema-dot { width: 20px; height: 20px; min-width: 20px; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.5); }
        .f5-tema-ad { font-size: 9px; color: #999; text-align: center; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .f5-tema-btn.active .f5-tema-ad { color: #fff; font-weight: 700; }
        .f5-panel-tema-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; padding: 4px; }
        .f5-panel-tema-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; background: transparent; border: none; padding: 0; cursor: pointer; }
        .f5-panel-onizleme { position: relative; width: 100%; aspect-ratio: 16/9; border-radius: 8px; border-width: 2px; border-style: solid; display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 0 10px; transition: transform 0.2s, box-shadow 0.2s; }
        .f5-panel-tema-btn:hover .f5-panel-onizleme { transform: translateY(-2px); }
        .f5-panel-tema-btn.active .f5-panel-onizleme { transform: translateY(-2px); box-shadow: inset 0 0 0 2px #fff; }
        .f5-panel-tema-btn.active .f5-panel-onizleme::after { content: '✓'; position: absolute; top: 4px; right: 4px; width: 15px; height: 15px; border-radius: 50%; background: #fff; color: #000; font-size: 9px; font-weight: 900; line-height: 1; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.6); }
        .f5-panel-bar { height: 5px; border-radius: 3px; display: block; }
        .f5-panel-ad { font-size: 10px; color: #999; font-weight: 600; text-align: center; }
        .f5-panel-tema-btn.active .f5-panel-ad { color: #fff; }
        .f5-ozel-tema-kutu { background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px; padding: 12px; margin-bottom: 16px; }
        .f5-ozel-tema-baslik { font-size: 11px; font-weight: 700; color: #ccc; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .f5-ozel-tema-renkler { display: flex; align-items: flex-end; gap: 10px; margin-bottom: 10px; }
        .f5-ozel-tema-renk-grubu { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; position: relative; }
        .f5-ozel-tema-renk-grubu label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.3px; min-height: 18px; display: flex; align-items: flex-end; justify-content: center; text-align: center; line-height: 1.15; white-space: nowrap; }
        .f5-ozel-tema-renk-grubu input[type="color"] { width: 30px; height: 30px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: none; display: block; }
        .f5-ozel-tema-renk-grubu input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        .f5-ozel-tema-renk-grubu input[type="color"]::-webkit-color-swatch { border: 2px solid rgba(255,255,255,0.25); border-radius: 50%; }
        .f5-ozel-tema-renk3-wrap { position: relative; width: 30px; height: 30px; }
        .f5-ozel-tema-renk3-temizle { position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%; background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.25); color: #ddd; font-size: 10px; font-weight: 700; line-height: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2; box-shadow: 0 1px 3px rgba(0,0,0,0.5); }
        .f5-ozel-tema-onizleme { flex: 1; height: 30px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); }
        .f5-ozel-tema-form-alt { display: flex; gap: 8px; }
        .f5-ozel-tema-isim-input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #eee; font-size: 11px; padding: 0 10px; height: 30px; outline: none; }
        .f5-ozel-tema-isim-input:focus { border-color: var(--f5-main-color); }
        .f5-ozel-tema-kaydet-btn { background: var(--f5-main-color); color: #000; border: none; border-radius: 8px; font-size: 11px; font-weight: 700; padding: 0 12px; height: 30px; cursor: pointer; white-space: nowrap; transition: filter 0.2s; }
        .f5-ozel-tema-kaydet-btn:hover { filter: brightness(1.1); }
        .f5-ozel-tema-hata { font-size: 10px; color: #f87171; margin-top: 6px; min-height: 12px; }
        .f5-ozel-temalarim-baslik { font-size: 10px; font-weight: 700; color: #999; margin: 4px 0 8px; }
        .f5-ozel-temalarim-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
        .f5-ozel-temalarim-bos { font-size: 10px; color: #666; font-style: italic; padding: 6px 2px 12px; }
        .f5-ozel-tema-sil { position: absolute; top: 4px; left: 4px; width: 17px; height: 17px; border-radius: 50%; background: #ef4444; color: #fff; font-size: 10px; line-height: 1; display: none; align-items: center; justify-content: center; cursor: pointer; z-index: 2; box-shadow: 0 1px 3px rgba(0,0,0,0.6); }
        .f5-panel-tema-btn.f5-ozel-tema-btn { position: relative; }
        .f5-panel-tema-btn.f5-ozel-tema-btn:hover .f5-ozel-tema-sil { display: flex; }
        .f5-stil-secici { display: flex; gap: 8px; margin-bottom: 20px; }
        .f5-stil-btn { flex: 1; aspect-ratio: 1; background: rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.08); border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; padding: 0; }
        .f5-stil-btn:hover { border-color: rgba(255,255,255,0.25); }
        .f5-stil-btn.active { border-color: var(--f5-main-color); box-shadow: 0 0 10px var(--f5-glow-color); }
        .f5-stil-onizleme { width: 20px; height: 20px; border-radius: 50%; }
        .f5-stil-onizleme-glass { background: rgba(255,255,255,0.08); border: 2px solid var(--f5-main-color); box-shadow: 0 0 6px var(--f5-glow-color); }
        .f5-stil-onizleme-solid { background: var(--f5-main-color); box-shadow: 0 0 8px var(--f5-glow-color); }
        .f5-stil-onizleme-minimal { background: #1a1b1e; border: 1px solid var(--f5-main-color); }
        .f5-stil-onizleme-gradient { background: linear-gradient(135deg, var(--f5-main-color) 0%, rgba(0,0,0,0.7) 100%); }
        .f5-stil-onizleme-squircle { border-radius: 30%; background: rgba(255,255,255,0.08); border: 2px solid var(--f5-main-color); box-shadow: 0 0 6px var(--f5-glow-color); }
        .f5-buttons { display: flex; gap: 10px; margin-bottom: 16px; }
        .f5-btn { flex: 1; padding: 12px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; transition: all 0.2s; }
        .f5-btn-primary { background-color: var(--f5-main-color); color: #000; box-shadow: 0 4px 12px var(--f5-glow-color); }
        .f5-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 16px var(--f5-glow-color); filter: brightness(1.1); }
        .f5-btn-secondary { background-color: rgba(255,255,255,0.1); color: #fff; }
        .f5-btn-secondary:hover { background-color: rgba(255,255,255,0.15); }
        .f5-error-msg { color: #ff4c4c; font-size: 12px; font-weight: 600; text-align: center; margin-top: -6px; margin-bottom: 12px; display: none; }
        .f5-alert-msg { color: #ffb700; font-size: 11px; font-weight: 600; text-align: center; margin-top: -10px; margin-bottom: 12px; }
        .f5-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); margin: 16px 0; }
        .f5-status-area { font-size: 12px; color: #888; display: flex; justify-content: space-between; }
        .f5-status-val { font-weight: 700; color: #ff4c4c; }
        #f5-hedef-zaman { color: #fff; font-weight: 600; font-variant-numeric: tabular-nums; }
        .f5-countdown-box { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; text-align: center; margin-top: 16px; display: none; box-shadow: inset 0 4px 12px rgba(0,0,0,0.2); }
        .f5-countdown-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; font-weight: 700; }
        .f5-countdown-time { font-size: 32px; font-weight: 700; letter-spacing: 2px; color: var(--f5-main-color); text-shadow: 0 0 16px var(--f5-glow-color); font-variant-numeric: tabular-nums; transition: color 0.3s; }
        #f5-modal.f5-tension-active .f5-countdown-time { color: #ff4c4c; text-shadow: 0 0 16px rgba(255,76,76,0.6); }
        .f5-aktif-liste { max-height: 260px; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 8px; padding: 4px 4px 4px 2px; }
        .f5-aktif-liste::-webkit-scrollbar { width: 5px; }
        .f5-aktif-liste::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        .f5-aktif-satir { display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 8px 10px; overflow: visible; }
        .f5-aktif-avatar { position: relative; width: 32px; height: 32px; min-width: 32px; border-radius: 50%; background: rgba(255,255,255,0.1); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; overflow: visible; flex-shrink: 0; }
        .f5-aktif-avatar-img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; border-radius: 50%; }
        .f5-aktif-nokta { position: absolute; bottom: 0; right: 0; width: 11px; height: 11px; box-sizing: border-box; border-radius: 50%; background: var(--f5-main-color); border: 2px solid rgba(22,23,27,1); box-shadow: 0 0 6px var(--f5-glow-color); z-index: 5; pointer-events: none; transform: translate(10%, 10%); }
        .f5-aktif-bilgi { overflow: hidden; flex: 1; }
        .f5-aktif-ad { font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .f5-aktif-sayfa { font-size: 11px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .f5-aktif-bos { text-align: center; color: #666; font-size: 12px; padding: 20px 0; }
        .f5-dm-baslat-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 10px; font-weight: 700; padding: 5px 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .f5-dm-baslat-btn:hover { background: var(--f5-main-color); color: #000; border-color: var(--f5-main-color); }
        .f5-puan-satir { display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 8px 10px; }
        .f5-puan-sira { width: 20px; text-align: center; font-weight: 700; color: #888; font-size: 13px; }
        .f5-puan-sayi { font-weight: 800; color: var(--f5-main-color); font-size: 15px; text-shadow: 0 0 8px var(--f5-glow-color); }
        .f5-toggle-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 10px; }
        .f5-toggle-row .f5-toggle-metin { display: flex; flex-direction: column; }
        .f5-toggle-row .f5-toggle-baslik { font-size: 12px; font-weight: 600; color: #ddd; }
        .f5-toggle-row .f5-toggle-aciklama { font-size: 10px; color: #777; margin-top: 2px; }
        .f5-dil-secici { position: relative; flex: 0 0 auto; }
        .f5-dil-menu { position: absolute; top: calc(100% + 8px); right: 0; min-width: 140px; background: var(--f5-panel-bg); border: 1px solid var(--f5-panel-border); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 6px; display: none; flex-direction: column; gap: 2px; z-index: 30; backdrop-filter: blur(12px); }
        .f5-dil-menu.f5-dil-menu-show { display: flex; animation: fadeIn 0.18s ease; }
        .f5-dil-secenek { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; background: transparent; border: none; border-radius: 7px; color: #ccc; font-size: 12px; font-weight: 600; cursor: pointer; text-align: left; transition: background 0.2s, color 0.2s; }
        .f5-dil-secenek:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .f5-dil-secenek.active { background: var(--f5-glow-color); color: #fff; }
        .f5-dil-kod { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; padding: 2px 5px; border-radius: 5px; background: rgba(255,255,255,0.1); color: #aaa; font-size: 10px; font-weight: 800; letter-spacing: 0.3px; }
        .f5-dil-secenek.active .f5-dil-kod { background: rgba(0,0,0,0.25); color: #fff; }
        .f5-toggle { position: relative; width: 40px; height: 22px; min-width: 40px; }
        .f5-toggle input { opacity: 0; width: 0; height: 0; }
        .f5-toggle-slider { position: absolute; inset: 0; background-color: rgba(255,255,255,0.15); transition: 0.25s; border-radius: 24px; cursor: pointer; }
        .f5-toggle-slider::before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: #fff; transition: 0.25s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
        .f5-toggle input:checked + .f5-toggle-slider { background-color: var(--f5-main-color); box-shadow: 0 0 8px var(--f5-glow-color); }
        .f5-toggle input:checked + .f5-toggle-slider::before { transform: translateX(18px); }
        .f5-io-buttons { display: flex; gap: 10px; margin-bottom: 10px; }
        .f5-btn-io { flex: 1; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 12px; transition: all 0.2s; background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; gap: 8px; }
        .f5-btn-io:hover { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.25); transform: translateY(-1px); }
        .f5-btn-io:active { transform: translateY(0); }
        .f5-btn-io-icon { width: 22px; height: 22px; min-width: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .f5-btn-io-icon svg { width: 12px; height: 12px; }
        .f5-btn-io-export .f5-btn-io-icon { background: rgba(83,252,24,0.16); color: #53fc18; }
        .f5-btn-io-export:hover .f5-btn-io-icon { background: rgba(83,252,24,0.28); }
        .f5-btn-io-import .f5-btn-io-icon { background: rgba(74,168,255,0.16); color: #4aa8ff; }
        .f5-btn-io-import:hover .f5-btn-io-icon { background: rgba(74,168,255,0.28); }
        .f5-btn-io.f5-btn-reset { color: #ff8a8a; }
        .f5-btn-io.f5-btn-reset .f5-btn-io-icon { background: rgba(255,76,76,0.16); color: #ff6b6b; }
        .f5-btn-io.f5-btn-reset:hover { background: rgba(255,76,76,0.12); border-color: rgba(255,76,76,0.4); }
        .f5-btn-io.f5-btn-reset:hover .f5-btn-io-icon { background: rgba(255,76,76,0.28); }
        .f5-zil-baslik-alani { display: flex; flex-direction: column; gap: 2px; margin-bottom: 14px; }
        .f5-zil-baslik-metin { font-size: 13px; font-weight: 700; color: var(--f5-value-text); }
        .f5-zil-aciklama-metin { font-size: 11px; color: #888; }
        .f5-zil-grid { display: flex; flex-direction: column; gap: 8px; }
        .f5-zil-item { position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: 0.15s; }
        .f5-zil-item:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.16); }
        .f5-zil-item.active { border-color: var(--f5-main-color, #53fc18); background: rgba(83,252,24,0.08); }
        .f5-zil-play-btn { width: 34px; height: 34px; min-width: 34px; border-radius: 50%; background: rgba(255,255,255,0.1); border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.15s; }
        .f5-zil-play-btn:hover { background: var(--f5-main-color, #53fc18); color: #0a0f07; transform: scale(1.08); }
        .f5-zil-play-btn svg { width: 14px; height: 14px; }
        .f5-zil-info { flex: 1; min-width: 0; }
        .f5-zil-isim { font-size: 12.5px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .f5-zil-alt { font-size: 10.5px; color: #888; margin-top: 1px; }
        .f5-zil-item.active .f5-zil-alt { color: var(--f5-main-color, #53fc18); }
        .f5-zil-check { width: 20px; height: 20px; min-width: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; transition: 0.15s; }
        .f5-zil-item.active .f5-zil-check { border-color: var(--f5-main-color, #53fc18); background: var(--f5-main-color, #53fc18); }
        .f5-zil-item.active .f5-zil-check::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #0a0f07; }
        .f5-zil-custom-actions { display: flex; gap: 6px; }
        .f5-zil-mini-btn { background: rgba(255,255,255,0.08); border: none; color: #ccc; border-radius: 6px; padding: 5px 9px; font-size: 10.5px; font-weight: 600; cursor: pointer; transition: 0.15s; white-space: nowrap; }
        .f5-zil-mini-btn:hover { background: rgba(255,255,255,0.18); color: #fff; }
        .f5-zil-mini-btn.danger { color: #ff8a8a; }
        .f5-zil-mini-btn.danger:hover { background: rgba(255,76,76,0.16); }
        .f5-zil-custom-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 20px 14px; border: 1.5px dashed rgba(255,255,255,0.18); border-radius: 12px; text-align: center; }
        .f5-zil-custom-empty svg { width: 22px; height: 22px; color: #777; }
        .f5-zil-custom-empty .f5-zil-isim { color: #ccc; }
        .f5-zil-custom-hint { font-size: 10.5px; color: #777; }
        .f5-io-msg { font-size: 11px; font-weight: 600; text-align: center; margin-top: -2px; margin-bottom: 12px; min-height: 14px; transition: color 0.2s, opacity 0.2s; opacity: 0; }
        .f5-io-msg.f5-io-msg-show { opacity: 1; }
        .f5-io-msg.f5-io-ok { color: var(--f5-main-color); }
        .f5-io-msg.f5-io-err { color: #ff4c4c; }
        .f5-confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 10000020; display: none; align-items: center; justify-content: center; }
        .f5-confirm-overlay.f5-confirm-show { display: flex; }
        .f5-confirm-box { width: 290px; background: var(--f5-panel-bg); border: 1px solid var(--f5-panel-border); border-radius: 14px; padding: 22px; box-shadow: 0 24px 48px rgba(0,0,0,0.8); animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .f5-confirm-title { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        .f5-confirm-metin { font-size: 13px; color: #bbb; line-height: 1.45; margin-bottom: 18px; }
        .f5-confirm-box .f5-buttons { margin-bottom: 0; }
        .f5-image-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 10000000; display: none; align-items: center; justify-content: center; backdrop-filter: blur(8px); }
        .f5-image-modal.show { display: flex; animation: fadeIn 0.2s; }
        .f5-image-modal img { max-width: 90vw; max-height: 90vh; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); object-fit: contain; }
        .f5-image-modal-close { position: absolute; top: 20px; right: 30px; color: #fff; font-size: 36px; cursor: pointer; line-height: 1; font-weight: 200; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        .f5-image-modal-close:hover { color: #ff4c4c; }
        .f5-chat-layout { display: flex; height: 350px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }
        .f5-chat-sidebar { width: 200px; min-width: 200px; border-right: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; background: rgba(0,0,0,0.2); }
        .f5-chat-sidebar-header { padding: 10px; display: flex; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .f5-chat-btn-mini { flex: 1; padding: 6px 4px; font-size: 10px; font-weight: 700; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .f5-chat-btn-mini:hover { background: var(--f5-main-color); color: #000; border-color: var(--f5-main-color); }
        .f5-chat-rooms-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
        .f5-chat-rooms-list::-webkit-scrollbar { width: 4px; }
        .f5-chat-rooms-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        .f5-chat-room-item { display: flex; align-items: center; gap: 8px; padding: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); transition: all 0.3s; position: relative;}
        .f5-chat-room-item:hover { background: rgba(255,255,255,0.05); }
        .f5-chat-room-item.active { background: rgba(255,255,255,0.1); border-left: 3px solid var(--f5-main-color); }
        .f5-chat-room-item.has-new { background: rgba(83, 252, 24, 0.15); border-left: 3px solid var(--f5-main-color); box-shadow: inset 0 0 10px var(--f5-glow-color); }
        .f5-chat-room-avatar { width: 28px; height: 28px; min-width: 28px; border-radius: 50%; background: rgba(255,255,255,0.1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; overflow: hidden; }
        .f5-chat-room-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .f5-chat-room-info { overflow: hidden; flex: 1; }
        .f5-chat-room-name { font-size: 12px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .f5-chat-room-sub { font-size: 10px; color: #777; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .f5-chat-room-unread { position: absolute; right: 10px; background: #ff4c4c; color: white; font-size: 10px; font-weight: bold; border-radius: 50%; width: 18px; height: 18px; display: none; align-items: center; justify-content: center; box-shadow: 0 0 6px rgba(255,76,76,0.6); }
        .f5-chat-main { flex: 1; display: flex; flex-direction: column; background: rgba(0,0,0,0.15); position: relative; }
        .f5-chat-main-header { padding: 10px 82px 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 8px; position: relative; z-index: 15; background: rgba(0,0,0,0.2); }
        .f5-chat-main-title { font-size: 13px; font-weight: 700; color: #fff; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .f5-chat-main-desc { font-size: 10px; color: #888; display: flex; align-items: center; gap: 6px; }
        .f5-dm-online-dot { display: inline-block; width: 8px; height: 8px; min-width: 8px; border-radius: 50%; background: #666; box-shadow: 0 0 4px rgba(0,0,0,0.4); transition: background 0.3s, box-shadow 0.3s; }
        .f5-dm-online-dot.online { background: var(--f5-main-color); box-shadow: 0 0 6px var(--f5-glow-color); animation: f5-dm-dot-pulse 2s ease-in-out infinite; }
        @keyframes f5-dm-dot-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        .f5-chat-header-actions { position: absolute; right: 10px; top: 0; bottom: 0; display: flex; align-items: center; gap: 8px; z-index: 22; }
        .f5-chat-call-icon-btn { display: none; align-items: center; justify-content: center; width: 30px; height: 30px; min-width: 30px; border-radius: 50%; border: none; cursor: pointer; padding: 0; background: linear-gradient(145deg, #6bff2f, #3ed10f); color: #0a0f07; box-shadow: 0 2px 8px rgba(83,252,24,0.35); transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease; animation: f5-call-btn-pulse 2.6s ease-in-out infinite; }
        .f5-chat-call-icon-btn svg { width: 15px; height: 15px; display: block; }
        .f5-chat-call-icon-btn:hover { transform: scale(1.12); filter: brightness(1.1); box-shadow: 0 3px 14px rgba(83,252,24,0.6); }
        .f5-chat-call-icon-btn:active { transform: scale(0.92); }
        @keyframes f5-call-btn-pulse { 0%, 100% { box-shadow: 0 2px 8px rgba(83,252,24,0.35), 0 0 0 0 rgba(83,252,24,0.35); } 50% { box-shadow: 0 2px 8px rgba(83,252,24,0.35), 0 0 0 7px rgba(83,252,24,0); } }
        .f5-chat-options-btn { background: rgba(255,255,255,0.06); border: none; color: #999; font-size: 16px; cursor: pointer; width: 30px; height: 30px; min-width: 30px; border-radius: 50%; display: none; align-items: center; justify-content: center; line-height: 1; transition: background 0.16s, color 0.16s; }
        .f5-chat-options-btn:hover { color: #fff; background: rgba(255,255,255,0.16); }
        .f5-chat-options-menu { position: absolute; right: 8px; top: 38px; background: var(--f5-panel-bg); border: 1px solid var(--f5-panel-border); border-radius: 8px; padding: 6px; display: none; flex-direction: column; gap: 2px; z-index: 20; box-shadow: 0 4px 12px rgba(0,0,0,0.5); backdrop-filter: blur(10px); }
        .f5-chat-options-menu.show { display: flex; }
        .f5-chat-option-item { background: transparent; border: none; color: #ccc; font-size: 11px; padding: 6px 10px; text-align: left; cursor: pointer; border-radius: 4px; transition: 0.2s; white-space: nowrap; }
        .f5-chat-option-item:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .f5-chat-option-item.danger { color: #ff4c4c; }
        .f5-chat-option-item.danger:hover { background: rgba(255,76,76,0.1); }
        .f5-chat-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 6px; position: relative; }
        .f5-chat-messages::-webkit-scrollbar { width: 5px; }
        .f5-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        .f5-yeni-mesaj-btn { position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%) scale(0); background: var(--f5-main-color, #53fc18); color: #000; border: none; border-radius: 20px; padding: 8px 16px; font-size: 11px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 16px rgba(83,252,24,0.6); z-index: 100; display: flex; align-items: center; gap: 6px; opacity: 0; pointer-events: none; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s; font-family: 'Inter', sans-serif; }
        .f5-yeni-mesaj-btn.show { transform: translateX(-50%) scale(1); opacity: 1; pointer-events: auto; }
        .f5-yeni-mesaj-btn:hover { filter: brightness(1.1); transform: translateX(-50%) scale(1.05); }
        .f5-yeni-mesaj-btn .f5-yeni-mesaj-arrow { width: 14px; height: 14px; display: inline-flex; animation: f5-arrow-bounce 1.2s ease-in-out infinite; }
        @keyframes f5-arrow-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
        .f5-chat-msg-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 2px; }
        .f5-chat-msg-row.me { justify-content: flex-end; }
        .f5-chat-msg-avatar { width: 24px; height: 24px; min-width: 24px; border-radius: 50%; background: rgba(255,255,255,0.1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; overflow: hidden; flex-shrink: 0; }
        .f5-chat-msg-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .f5-chat-bubble { max-width: 75%; padding: 8px 12px; border-radius: 12px; font-size: 12px; line-height: 1.4; word-break: break-word; position: relative; }
        .f5-chat-bubble-me { background: var(--f5-main-color); color: #000; font-weight: 500; border-bottom-right-radius: 2px; box-shadow: 0 2px 8px var(--f5-glow-color); }
        .f5-chat-bubble-other { background: rgba(255,255,255,0.1); color: #fff; border-bottom-left-radius: 2px; border: 1px solid rgba(255,255,255,0.05); }
        .f5-chat-bubble-sender { font-size: 9px; font-weight: 700; margin-bottom: 3px; opacity: 0.85; display: flex; align-items: center; gap: 3px; }
        .f5-chat-bubble-sender-me { color: rgba(0,0,0,0.65); justify-content: flex-start; }
        .f5-chat-bubble-sender-other { color: var(--f5-main-color); }
        .f5-chat-bubble-time { font-size: 8px; opacity: 0.6; margin-top: 4px; text-align: right; display: flex; justify-content: flex-end; align-items: center; gap: 4px; }
        .f5-chat-tick { font-size: 9px; font-weight: 900; }
        .f5-chat-tick.read { color: #1e3a8a; }
        .f5-chat-bubble-other .f5-chat-tick { display: none; }
        .f5-chat-read-count { font-size: 9px; font-weight: 700; color: #888; cursor: pointer; transition: color 0.2s; display: inline-block; padding: 2px 4px; border-radius: 4px; background: rgba(0,0,0,0.1); }
        .f5-chat-read-count.read { color: #1e3a8a; background: rgba(255,255,255,0.2); }
        .f5-chat-read-count:hover { color: #fff; text-decoration: underline; background: rgba(0,0,0,0.3); }
        .f5-chat-msg-actions { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
        .f5-chat-msg-row:hover .f5-chat-msg-actions { opacity: 1; }
        .f5-chat-msg-action-btn { width: 20px; height: 20px; border-radius: 50%; border: none; background: rgba(255,255,255,0.08); color: #ccc; font-size: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; transition: 0.15s; }
        .f5-chat-msg-action-btn:hover { background: var(--f5-main-color); color: #000; }
        .f5-chat-msg-action-btn.f5-chat-delete-btn:hover { background: #ff4c4c; color: #fff; }
        .f5-chat-reply-quote { display: block; border-left: 2px solid var(--f5-main-color); background: rgba(255,255,255,0.08); border-radius: 4px; padding: 4px 6px; margin-bottom: 4px; cursor: pointer; opacity: 0.9; }
        .f5-chat-bubble-me .f5-chat-reply-quote { background: rgba(0,0,0,0.12); }
        .f5-chat-reply-quote-sender { font-size: 9px; font-weight: 800; opacity: 0.85; }
        .f5-chat-reply-quote-text { font-size: 10px; opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
        .f5-chat-msg-deleted { font-size: 11px; font-style: italic; opacity: 0.6; }
        .f5-chat-edited-tag { font-size: 8px; opacity: 0.6; margin-right: 3px; }
        .f5-chat-system-msg { align-self: center; background: rgba(255,255,255,0.06); color: #999; font-size: 10px; padding: 4px 10px; border-radius: 10px; margin: 4px 0; text-align: center; }
        @keyframes f5ChatHighlight { 0% { background: rgba(255,255,255,0.25); } 100% { background: transparent; } }
        .f5-chat-msg-highlight .f5-chat-bubble { animation: f5ChatHighlight 1.1s ease; }
        .f5-chat-typing-bubble { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; border-bottom-left-radius: 2px; padding: 10px 14px; display: flex; align-items: center; gap: 4px; }
        .f5-chat-typing-dot { width: 6px; height: 6px; border-radius: 50%; background: #ccc; opacity: 0.4; animation: f5TypingBlink 1.3s infinite ease-in-out; }
        .f5-chat-typing-dot:nth-child(2) { animation-delay: 0.15s; }
        .f5-chat-typing-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes f5TypingBlink { 0%, 60%, 100% { opacity: 0.35; transform: scale(0.85); } 30% { opacity: 1; transform: scale(1); } }
        .f5-chat-reply-edit-preview { display: none; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(255,255,255,0.06); border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; }
        .f5-chat-reply-edit-preview.show { display: flex; }
        .f5-chat-reply-edit-preview-bar { width: 2px; align-self: stretch; background: var(--f5-main-color); border-radius: 2px; }
        .f5-chat-reply-edit-preview-body { flex: 1; min-width: 0; }
        .f5-chat-reply-edit-preview-label { font-weight: 800; color: var(--f5-main-color); font-size: 10px; }
        .f5-chat-reply-edit-preview-text { opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .f5-chat-reply-edit-preview-close { background: transparent; border: none; color: #999; font-size: 16px; cursor: pointer; line-height: 1; padding: 2px 4px; }
        .f5-chat-reply-edit-preview-close:hover { color: #fff; }
        .f5-chat-clear-hint { display: none; align-items: center; gap: 6px; padding: 6px 10px; background: rgba(255,255,255,0.06); border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; }
        .f5-chat-clear-hint.show { display: flex; }
        .f5-chat-clear-hint-cmd { font-weight: 800; color: var(--f5-main-color); }
        .f5-chat-clear-hint-desc { opacity: 0.75; }
        .f5-chat-image { max-width: 100%; border-radius: 8px; margin-top: 4px; cursor: pointer; }
        .f5-chat-gif-img { border: 1px solid var(--f5-main-color); }
        .f5-chat-gif-open-btn { font-size: 10px; font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center; min-width: 32px; height: 26px; padding: 0 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); }
        .f5-gif-durum { font-size: 11px; color: #999; text-align: center; padding: 4px 0; min-height: 14px; flex: none; }
        .f5-gif-grid { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; align-content: start; }
        .f5-gif-grid::-webkit-scrollbar { width: 4px; }
        .f5-gif-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        .f5-gif-item { width: 100%; height: 70px; object-fit: cover; border-radius: 6px; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; background: rgba(255,255,255,0.05); }
        .f5-gif-item:hover { transform: scale(1.04); box-shadow: 0 0 0 2px var(--f5-main-color); }
        .f5-chat-input-row { padding: 8px 10px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 8px; background: rgba(0,0,0,0.2); align-items: center; }
        .f5-chat-input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff; font-size: 12px; padding: 0 10px; height: 34px; outline: none; }
        .f5-chat-input:focus { border-color: var(--f5-main-color); }
        .f5-chat-upload-btn { background: transparent; border: none; color: #aaa; cursor: pointer; padding: 4px; transition: color 0.2s; }
        .f5-chat-upload-btn:hover { color: var(--f5-main-color); }
        .f5-chat-send-btn { background: var(--f5-main-color); color: #000; border: none; border-radius: 8px; font-size: 11px; font-weight: 700; padding: 0 14px; height: 34px; cursor: pointer; transition: filter 0.2s; }
        .f5-chat-send-btn:hover { filter: brightness(1.1); }
        .f5-chat-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 12px; text-align: center; padding: 20px; }
        .f5-chat-load-more { background: rgba(255,255,255,0.05); color: var(--f5-main-color); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 12px; font-size: 10px; font-weight: 700; cursor: pointer; text-align: center; margin: 0 auto 8px; display: none; transition: background 0.2s; flex-shrink: 0; }
        .f5-chat-load-more:hover { background: rgba(255,255,255,0.1); }
        .f5-submodal { position: absolute; inset: 0; background: rgba(15,16,19,0.95); backdrop-filter: blur(8px); z-index: 30; border-radius: 12px; padding: 14px; display: none; flex-direction: column; }
        .f5-submodal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex: none; }
        .f5-submodal-title { font-size: 13px !important; font-weight: 700; color: #fff; }
        .f5-submodal-close { cursor: pointer; font-size: 18px; color: #888; }
        .f5-submodal-close:hover { color: #fff; }
        .f5-submodal-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
        .f5-submodal-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: rgba(255,255,255,0.04); border-radius: 6px; cursor: pointer; }
        .f5-submodal-item:hover { background: rgba(255,255,255,0.08); }
        .f5-submodal-item input[type="checkbox"] { accent-color: var(--f5-main-color); }
        #f5-grup-ad-input { flex: none !important; height: 36px !important; min-height: 36px !important; max-height: 36px !important; margin-bottom: 12px; }
        .f5-blocked-overlay { position: absolute; left: 0; right: 0; bottom: 0; top: 54px; background: rgba(0,0,0,0.85); z-index: 10; display: none; align-items: center; justify-content: center; color: #ff4c4c; font-weight: bold; font-size: 15px; backdrop-filter: blur(3px);}
        @keyframes f5-acil-bekle-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.75; } }
        .f5-beyaz-liste-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; }
        .f5-beyaz-liste-item:hover { background: rgba(255,255,255,0.08); }
        .f5-beyaz-liste-avatar { width: 36px; height: 36px; min-width: 36px; border-radius: 50%; background: rgba(255,255,255,0.1); overflow: hidden; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: #fff; flex-shrink: 0; }
        .f5-beyaz-liste-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; border-radius: 50%; }
        .f5-beyaz-liste-info { flex: 1; min-width: 0; }
        .f5-beyaz-liste-isim { font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .f5-beyaz-liste-tarih { font-size: 10px; color: #888; margin-top: 2px; }
        .f5-beyaz-liste-cikar-btn { background: rgba(255,76,76,0.15); color: #ff6b6b; border: 1px solid rgba(255,76,76,0.4); border-radius: 6px; padding: 5px 10px; font-size: 10px; font-weight: 700; cursor: pointer; transition: 0.15s; white-space: nowrap; }
        .f5-beyaz-liste-cikar-btn:hover { background: rgba(255,76,76,0.3); color: #fff; }
        .f5-beyaz-liste-ekle-btn { width: 100%; padding: 10px; background: linear-gradient(145deg, #53fc18, #3ed10f); color: #0a0f07; border: none; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; transition: filter 0.15s; }
        .f5-beyaz-liste-ekle-btn:hover { filter: brightness(1.1); }
        .f5-bildirim-durum { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 6px; display: inline-block; margin-top: 4px; }
        .f5-bildirim-durum.acik { background: rgba(83,252,24,0.15); color: #53fc18; }
        .f5-bildirim-durum.kapali { background: rgba(255,76,76,0.15); color: #ff6b6b; }
        .f5-bildirim-durum.bekliyor { background: rgba(255,183,0,0.15); color: #ffb700; }
        .f5-timeout-badge { display: inline-block; background: #ffb700; color: #000; font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 6px; margin-left: 4px; }
        #f5-timeout-overlay { position: absolute; inset: 0; z-index: 50; background: rgba(15, 10, 10, 0.92); backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center; text-align: center; padding: 20px; border-radius: 12px; }
        #f5-timeout-overlay .f5-timeout-lock-icon { font-size: 48px; margin-bottom: 16px; display: block; animation: f5-lock-pulse 2s ease-in-out infinite; }
        @keyframes f5-lock-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }
        #f5-timeout-overlay .f5-timeout-lock-title { font-size: 18px; font-weight: 800; color: #ff4c4c; margin-bottom: 8px; }
        #f5-timeout-overlay .f5-timeout-lock-desc { font-size: 12px; color: #aaa; margin-bottom: 20px; line-height: 1.5; max-width: 300px; }
        #f5-timeout-overlay .f5-timeout-details { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; width: 100%; max-width: 320px; }
        .f5-reaction-bar { display: flex; gap: 2px; margin-top: 4px; flex-wrap: wrap; }
        .f5-reaction-chip { display: inline-flex; align-items: center; gap: 3px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 1px 6px; font-size: 10px; cursor: pointer; transition: 0.15s; color: #ddd; }
        .f5-reaction-chip:hover { background: rgba(255,255,255,0.18); transform: scale(1.05); }
        .f5-reaction-chip.mine { background: rgba(83,252,24,0.25); border-color: var(--f5-main-color); color: var(--f5-main-color); font-weight: 700; }
        .f5-reaction-picker { position: fixed; background: var(--f5-panel-bg); border: 1px solid var(--f5-panel-border); border-radius: 20px; padding: 4px 6px; display: flex; gap: 4px; z-index: 10000050; box-shadow: 0 4px 16px rgba(0,0,0,0.6); backdrop-filter: blur(12px); }
        .f5-reaction-emoji { font-size: 18px; cursor: pointer; padding: 2px 4px; border-radius: 50%; transition: 0.15s; line-height: 1; }
        .f5-reaction-emoji:hover { transform: scale(1.25); background: rgba(255,255,255,0.1); }
        .f5-last-seen { font-size: 10px; color: #888; }
        .f5-prof-list { display: flex; flex-direction: column; gap: 4px; max-height: 140px; overflow-y: auto; }
        .f5-prof-item { display: flex; align-items: center; justify-content: space-between; background: rgba(255,76,76,0.08); border: 1px solid rgba(255,76,76,0.2); border-radius: 6px; padding: 4px 8px; font-size: 11px; color: #ff8a8a; }
        .f5-prof-del { cursor: pointer; color: #ff6b6b; font-weight: 700; font-size: 12px; padding: 0 4px; }
        .f5-prof-del:hover { color: #fff; }
        .f5-timeout-autocomplete { position: absolute; left: 0; right: 0; top: 100%; background: var(--f5-panel-bg); border: 1px solid var(--f5-panel-border); border-radius: 8px; max-height: 180px; overflow-y: auto; z-index: 1000; box-shadow: 0 8px 24px rgba(0,0,0,0.6); backdrop-filter: blur(12px); margin-top: 4px; }
        .f5-timeout-autocomplete-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .f5-timeout-autocomplete-item:last-child { border-bottom: none; }
        .f5-timeout-autocomplete-item:hover { background: rgba(255,255,255,0.08); }
        .f5-timeout-autocomplete-avatar { width: 24px; height: 24px; min-width: 24px; border-radius: 50%; background: rgba(255,255,255,0.1); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #fff; }
        .f5-timeout-autocomplete-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .f5-timeout-autocomplete-name { font-size: 12px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .f5-timeout-autocomplete-empty { padding: 10px; text-align: center; font-size: 11px; color: #666; }
        .f5-ozel-sure-row { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
        .f5-ozel-sure-birim { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 11px; padding: 7px 8px; outline: none; cursor: pointer; }
        .f5-timeout-secili-goster { font-size: 11px; color: #53fc18; font-weight: 700; padding: 6px 10px; background: rgba(83,252,24,0.1); border: 1px solid rgba(83,252,24,0.3); border-radius: 6px; margin-bottom: 8px; text-align: center; }
        .f5-timeout-custom-row { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
        .f5-timeout-custom-row input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 11px; padding: 7px 10px; outline: none; min-width: 0; }
        .f5-timeout-custom-row select { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 11px; padding: 7px 8px; outline: none; cursor: pointer; flex-shrink: 0; }
        .f5-timeout-custom-row button { background: linear-gradient(145deg,#ffb700,#e09400); color:#000; border:none; border-radius:6px; font-size:11px; font-weight:800; padding:0 14px; cursor:pointer; white-space:nowrap; height:33px; flex-shrink: 0; }
        .f5-timeout-aciklama-input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 11px; padding: 7px 10px; outline: none; margin-bottom: 8px; box-sizing: border-box; }
    `;
    document.head.appendChild(stil);

    const tooltip = document.createElement('div');
    tooltip.id = 'f5-custom-tooltip';
    document.body.appendChild(tooltip);

    const PANEL_TEMALARI = [
        { bg: 'rgba(22,23,27,0.92)', border: 'rgba(255,255,255,0.18)', accent: '#e2e2e2', ad: 'tema_klasik_gri' },
        { bg: 'rgba(14,19,34,0.92)', border: 'rgba(59,130,246,0.5)', accent: '#3b82f6', ad: 'tema_gece_yarisi' },
        { bg: 'rgba(33,14,14,0.92)', border: 'rgba(248,113,113,0.5)', accent: '#f87171', ad: 'tema_kor_atesi' },
        { bg: 'rgba(9,22,12,0.92)', border: 'rgba(34,197,94,0.5)', accent: '#22c55e', ad: 'tema_matrix' },
        { bg: 'rgba(29,14,40,0.92)', border: 'rgba(168,85,247,0.5)', accent: '#a855f7', ad: 'tema_mor_buyu' },
        { bg: 'rgba(34,27,10,0.92)', border: 'rgba(234,179,8,0.5)', accent: '#eab308', ad: 'tema_altin_cag' },
        { bg: 'rgba(11,27,31,0.92)', border: 'rgba(45,212,191,0.5)', accent: '#2dd4bf', ad: 'tema_buz_kristali' },
        { bg: 'rgba(37,14,30,0.92)', border: 'rgba(244,114,182,0.5)', accent: '#f472b6', ad: 'tema_pembe_bulut' }
    ];
    function panelTemaBtnHtml(tema) {
        return `<button class="f5-panel-tema-btn f5-ripple-btn" data-panel-bg="${tema.bg}" data-panel-border="${tema.border}" data-accent="${tema.accent}">
                    <div class="f5-panel-onizleme" style="background:${tema.bg}; border-color:${tema.border};">
                        <span class="f5-panel-bar" style="background:${tema.accent}; width:55%;"></span>
                        <span class="f5-panel-bar" style="background:rgba(255,255,255,0.3); width:80%;"></span>
                    </div>
                    <span class="f5-panel-ad" data-i18n="${tema.ad}">${t(tema.ad)}</span>
                </button>`;
    }
    const panelTemaButonlariHTML = PANEL_TEMALARI.map(panelTemaBtnHtml).join('\n');

    const RENK_TEMALARI = [
        { renk: '#53fc18', ad: 'renk_kick_yesili' }, { renk: '#00f3ff', ad: 'renk_cyber_mavi' },
        { renk: '#ff00e5', ad: 'renk_neon_pembe' }, { renk: '#ffb700', ad: 'renk_altin' },
        { renk: '#a855f7', ad: 'renk_mor_ruya' }, { renk: '#ff3b30', ad: 'renk_ates_kirmizi' },
        { renk: '#0ea5e9', ad: 'renk_okyanus' }, { renk: '#10b981', ad: 'renk_zumrut' },
        { renk: '#f97316', ad: 'renk_gun_batimi' }, { renk: '#38bdf8', ad: 'renk_buz_mavisi' },
        { renk: '#c084fc', ad: 'renk_lavanta' }, { renk: '#eab308', ad: 'renk_limon' },
        { renk: '#fb7185', ad: 'renk_mercan' }, { renk: '#2dd4bf', ad: 'renk_turkuaz' },
        { renk: '#ffffff', ad: 'renk_beyaz' }, { renk: '#1e3a8a', ad: 'renk_lacivert' },
        { renk: '#7f1d1d', ad: 'renk_bordo' }, { renk: '#808000', ad: 'renk_haki' }
    ];
    function renkTemaBtnHtml(tema) {
        return `<button class="f5-tema-btn f5-ripple-btn" data-color="${tema.renk}"><span class="f5-tema-dot" style="background:${tema.renk}"></span><span class="f5-tema-ad" data-i18n="${tema.ad}">${t(tema.ad)}</span></button>`;
    }
    const renkTemaButonlariHTML = RENK_TEMALARI.map(renkTemaBtnHtml).join('\n');

    // ==================== HTML İÇERİK ====================
    const htmlIcerik = `
        <div id="f5-fab-btn">
            <svg class="f5-progress-ring" viewBox="0 0 100 100"><circle class="f5-progress-bg" cx="50" cy="50" r="46"></circle><circle class="f5-progress-circle" cx="50" cy="50" r="46" id="f5-ring"></circle></svg>
            <svg class="f5-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            <div id="f5-fab-badge">00:00:00</div>
            <div id="f5-unread-badge" class="f5-unread-badge">0</div>
        </div>
        <div id="f5-modal">
            <div class="f5-modal-content">
                <div class="f5-header">
                    <h2 class="f5-title" data-i18n="panel_baslik">${t('panel_baslik')}</h2>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="f5-close f5-ripple-btn" id="f5-kapat">&times;</div>
                    </div>
                </div>
                <div id="sekme-zaman" class="f5-tab-content active">
                    <div class="f5-mode-selector">
                        <button class="f5-mode-btn f5-ripple-btn active" id="btn-mod-saat" data-i18n="mod_saat">${t('mod_saat')}</button>
                        <button class="f5-mode-btn f5-ripple-btn" id="btn-mod-aralik" data-i18n="mod_aralik">${t('mod_aralik')}</button>
                        <button class="f5-mode-btn f5-ripple-btn" id="btn-mod-seri" style="color:#ffb700;" data-i18n="mod_seri">${t('mod_seri')}</button>
                    </div>
                    <div id="kutu-mod-saat">
                        <label class="f5-label" data-i18n="hedef_zaman_label">${t('hedef_zaman_label')}</label>
                        <div class="f5-input-group">
                            <input type="number" id="f5-saat" class="f5-input" placeholder="00" min="0" max="23">
                            <input type="number" id="f5-dakika" class="f5-input" placeholder="00" min="0" max="59">
                            <input type="number" id="f5-saniye" class="f5-input" placeholder="00" min="0" max="59" value="0">
                        </div>
                    </div>
                    <div id="kutu-mod-aralik" style="display:none;">
                        <label class="f5-label" data-i18n="aralik_label">${t('aralik_label')}</label>
                        <div class="f5-input-group"><input type="number" id="f5-aralik-dakika" class="f5-input" placeholder="${t('aralik_placeholder')}" data-i18n-placeholder="aralik_placeholder" min="1" max="1440" value="5"></div>
                    </div>
                    <div id="kutu-mod-seri" style="display:none;">
                        <label class="f5-label" data-i18n="seri_label">${t('seri_label')}</label>
                        <div class="f5-input-group"><input type="number" id="f5-seri-saniye" class="f5-input" placeholder="${t('seri_placeholder')}" data-i18n-placeholder="seri_placeholder" min="0.1" step="0.1" value="0.5"></div>
                        <div class="f5-alert-msg"><span data-i18n="seri_uyari_on">${t('seri_uyari_on')}</span> <b style="color:var(--f5-value-text);" id="f5-seri-tus-span">ALT + ${durdurmaTusu.toUpperCase()}</b> <span data-i18n="seri_uyari_son">${t('seri_uyari_son')}</span></div>
                    </div>
                    <div class="f5-buttons">
                        <button id="f5-baslat" class="f5-btn f5-btn-primary f5-ripple-btn" data-i18n="btn_baslat">${t('btn_baslat')}</button>
                        <button id="f5-sifirla" class="f5-btn f5-btn-secondary f5-ripple-btn" data-i18n="btn_sifirla">${t('btn_sifirla')}</button>
                    </div>
                    <div id="f5-hata-metni" class="f5-error-msg" data-i18n="hata_metni">${t('hata_metni')}</div>
                    <div class="f5-divider"></div>
                    <div class="f5-status-area"><span><span data-i18n="durum_label">${t('durum_label')}</span> <span id="f5-durum" class="f5-status-val" data-i18n="durum_kapali">${t('durum_kapali')}</span></span><span><span data-i18n="hedef_label">${t('hedef_label')}</span> <span id="f5-hedef-zaman">-</span></span></div>
                    <div id="f5-countdown-container" class="f5-countdown-box">
                        <div class="f5-countdown-label" data-i18n="kalan_sure_label">${t('kalan_sure_label')}</div>
                        <div id="f5-countdown-timer" class="f5-countdown-time">00:00:00</div>
                    </div>
                    <div id="f5-streak-alani" style="margin-top:14px;">${streakHtmlUret()}</div>
                </div>
                <div id="sekme-ayarlar" class="f5-tab-content">
                    <label class="f5-label"><span data-i18n="konum_label">${t('konum_label')}</span></label>
                    <div class="f5-select-wrapper">
                        <select id="f5-konum-secici" class="f5-select">
                            <option value="br" data-i18n="konum_sag_alt">${t('konum_sag_alt')}</option><option value="bl" data-i18n="konum_sol_alt">${t('konum_sol_alt')}</option><option value="tr" data-i18n="konum_sag_ust">${t('konum_sag_ust')}</option><option value="tl" data-i18n="konum_sol_ust">${t('konum_sol_ust')}</option><option value="custom" data-i18n="konum_serbest">${t('konum_serbest')}</option>
                        </select>
                    </div>
                    <label class="f5-label"><span data-i18n="panel_tema_label">${t('panel_tema_label')}</span></label>
                    <div class="f5-panel-tema-grid">${panelTemaButonlariHTML}</div>
                    <div class="f5-ozel-tema-kutu">
                        <div class="f5-ozel-tema-baslik">🎨 <span data-i18n="ozel_tema_baslik">${t('ozel_tema_baslik')}</span></div>
                        <div class="f5-ozel-tema-renkler">
                            <div class="f5-ozel-tema-renk-grubu">
                                <label data-i18n="ozel_tema_renk1">${t('ozel_tema_renk1')}</label>
                                <input type="color" id="f5-ozel-renk-1" value="#53fc18">
                            </div>
                            <div class="f5-ozel-tema-renk-grubu">
                                <label data-i18n="ozel_tema_renk2">${t('ozel_tema_renk2')}</label>
                                <input type="color" id="f5-ozel-renk-2" value="#00f3ff">
                            </div>
                            <div class="f5-ozel-tema-renk-grubu">
                                <label data-i18n="ozel_tema_renk3">${t('ozel_tema_renk3')}</label>
                                <div class="f5-ozel-tema-renk3-wrap">
                                    <input type="color" id="f5-ozel-renk-3" value="#a855f7">
                                    <span class="f5-ozel-tema-renk3-temizle" id="f5-ozel-renk-3-temizle" title="-">✕</span>
                                </div>
                            </div>
                            <div class="f5-ozel-tema-onizleme" id="f5-ozel-tema-onizleme"></div>
                        </div>
                        <div class="f5-ozel-tema-form-alt">
                            <input type="text" id="f5-ozel-tema-isim" class="f5-ozel-tema-isim-input" placeholder="${t('ozel_tema_isim_placeholder')}" data-i18n-placeholder="ozel_tema_isim_placeholder" maxlength="18">
                            <button id="f5-ozel-tema-kaydet" class="f5-ozel-tema-kaydet-btn f5-ripple-btn" data-i18n="ozel_tema_kaydet_btn">${t('ozel_tema_kaydet_btn')}</button>
                        </div>
                        <div class="f5-ozel-tema-hata" id="f5-ozel-tema-hata"></div>
                    </div>
                    <div class="f5-ozel-temalarim-baslik" data-i18n="ozel_temalarim_baslik">${t('ozel_temalarim_baslik')}</div>
                    <div class="f5-ozel-temalarim-grid" id="f5-ozel-temalarim-grid"></div>
                    <div class="f5-ozel-temalarim-bos" id="f5-ozel-temalarim-bos" style="display:none;" data-i18n="ozel_tema_yok">${t('ozel_tema_yok')}</div>
                    <label class="f5-label"><span data-i18n="tema_rengi_label">${t('tema_rengi_label')}</span></label>
                    <div class="f5-color-picker-row"><input type="color" id="f5-renk-secici" class="f5-color-picker" value="#53fc18"></div>
                    <div class="f5-tema-grid">${renkTemaButonlariHTML}</div>
                    <label class="f5-label"><span data-i18n="buton_tarzi_label">${t('buton_tarzi_label')}</span></label>
                    <div class="f5-stil-secici">
                        <button class="f5-stil-btn f5-ripple-btn active" data-stil="glass" title="${t('stil_glass')}" data-i18n-title="stil_glass"><span class="f5-stil-onizleme f5-stil-onizleme-glass"></span></button>
                        <button class="f5-stil-btn f5-ripple-btn" data-stil="solid" title="${t('stil_solid')}" data-i18n-title="stil_solid"><span class="f5-stil-onizleme f5-stil-onizleme-solid"></span></button>
                        <button class="f5-stil-btn f5-ripple-btn" data-stil="minimal" title="${t('stil_minimal')}" data-i18n-title="stil_minimal"><span class="f5-stil-onizleme f5-stil-onizleme-minimal"></span></button>
                        <button class="f5-stil-btn f5-ripple-btn" data-stil="gradient" title="${t('stil_gradient')}" data-i18n-title="stil_gradient"><span class="f5-stil-onizleme f5-stil-onizleme-gradient"></span></button>
                        <button class="f5-stil-btn f5-ripple-btn" data-stil="squircle" title="${t('stil_squircle')}" data-i18n-title="stil_squircle"><span class="f5-stil-onizleme f5-stil-onizleme-squircle"></span></button>
                    </div>
                    <label class="f5-label"><span data-i18n="boyut_label">${t('boyut_label')}</span><span id="f5-boyut-deger" style="color:var(--f5-value-text);">52px</span></label>
                    <input type="range" id="f5-boyut-slider" class="f5-slider" min="40" max="80" value="52">
                    <div class="f5-divider"></div>
                    <label class="f5-label"><span data-i18n="panel_seffaflik_label">${t('panel_seffaflik_label')}</span><span id="f5-panel-opaklik-deger" style="color:var(--f5-value-text);">92%</span></label>
                    <input type="range" id="f5-panel-opaklik-slider" class="f5-slider" min="40" max="100" value="92">
                    <label class="f5-label"><span data-i18n="glow_label">${t('glow_label')}</span><span id="f5-glow-deger" style="color:var(--f5-value-text);">40%</span></label>
                    <input type="range" id="f5-glow-slider" class="f5-slider" min="0" max="100" value="40">
                    <div class="f5-toggle-row">
                        <div class="f5-toggle-metin">
                            <span class="f5-toggle-baslik" data-i18n="anim_baslik">${t('anim_baslik')}</span>
                            <span class="f5-toggle-aciklama" data-i18n="anim_aciklama">${t('anim_aciklama')}</span>
                        </div>
                        <label class="f5-toggle"><input type="checkbox" id="f5-toggle-anim" checked><span class="f5-toggle-slider"></span></label>
                    </div>
                    <div class="f5-toggle-row">
                        <div class="f5-toggle-metin">
                            <span class="f5-toggle-baslik" data-i18n="badge_baslik">${t('badge_baslik')}</span>
                            <span class="f5-toggle-aciklama" data-i18n="badge_aciklama">${t('badge_aciklama')}</span>
                        </div>
                        <label class="f5-toggle"><input type="checkbox" id="f5-toggle-badge"><span class="f5-toggle-slider"></span></label>
                    </div>
                    <div class="f5-toggle-row">
                        <div class="f5-toggle-metin">
                            <span class="f5-toggle-baslik" data-i18n="tension_baslik">${t('tension_baslik')}</span>
                            <span class="f5-toggle-aciklama" data-i18n="tension_aciklama">${t('tension_aciklama')}</span>
                        </div>
                        <label class="f5-toggle"><input type="checkbox" id="f5-toggle-tension" checked><span class="f5-toggle-slider"></span></label>
                    </div>
                    <div class="f5-toggle-row">
                        <div class="f5-toggle-metin">
                            <span class="f5-toggle-baslik" data-i18n="kenarlik_baslik">${t('kenarlik_baslik')}</span>
                            <span class="f5-toggle-aciklama" data-i18n="kenarlik_aciklama">${t('kenarlik_aciklama')}</span>
                        </div>
                        <label class="f5-toggle"><input type="checkbox" id="f5-toggle-kenarlik" checked><span class="f5-toggle-slider"></span></label>
                    </div>
                    <div class="f5-divider"></div>
                    <label class="f5-label"><span data-i18n="tab_ayarlar">${t('tab_ayarlar')}</span></label>
                    <div class="f5-toggle-row">
                        <div class="f5-toggle-metin">
                            <span class="f5-toggle-baslik" data-i18n="dil_baslik">${t('dil_baslik')}</span>
                            <span class="f5-toggle-aciklama" data-i18n="dil_aciklama">${t('dil_aciklama')}</span>
                        </div>
                        <div class="f5-dil-secici">
                            <button id="f5-dil-buton" class="f5-btn-io f5-ripple-btn" type="button" style="flex:0 0 auto; min-width:60px; padding:8px 10px; font-weight:800;">
                                <span id="f5-dil-buton-metin">${aktifDil.toUpperCase()}</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:11px; height:11px; margin-left:4px;"><path d="m6 9 6 6 6-6"></path></svg>
                            </button>
                            <div id="f5-dil-menu" class="f5-dil-menu">
                                <button class="f5-dil-secenek f5-ripple-btn${aktifDil === 'tr' ? ' active' : ''}" type="button" data-dil="tr"><span class="f5-dil-kod">TR</span> <span>Türkçe</span></button>
                                <button class="f5-dil-secenek f5-ripple-btn${aktifDil === 'en' ? ' active' : ''}" type="button" data-dil="en"><span class="f5-dil-kod">EN</span> <span>English</span></button>
                            </div>
                        </div>
                    </div>
                    <div class="f5-toggle-row">
                        <div class="f5-toggle-metin">
                            <span class="f5-toggle-baslik" data-i18n="tus_baslik">${t('tus_baslik')}</span>
                            <span class="f5-toggle-aciklama" data-i18n="tus_aciklama">${t('tus_aciklama')}</span>
                        </div>
                        <button id="f5-tus-atama-btn" class="f5-btn-io f5-ripple-btn" type="button" style="flex:0 0 auto; min-width:92px; padding:8px 10px;">ALT + ${durdurmaTusu.toUpperCase()}</button>
                    </div>
                    <div class="f5-divider"></div>
                    <label class="f5-label"><span>🚫</span> Küfür Filtresi</label>
                    <div class="f5-toggle-row">
                        <div class="f5-toggle-metin">
                            <span class="f5-toggle-baslik">Küfür Filtresi Aktif</span>
                            <span class="f5-toggle-aciklama">Yasaklı kelimeleri *** ile maskele</span>
                        </div>
                        <label class="f5-toggle"><input type="checkbox" id="f5-toggle-profanity"><span class="f5-toggle-slider"></span></label>
                    </div>
                    <div id="f5-prof-list" class="f5-prof-list" style="margin-bottom:10px;"></div>
                    <div style="display:flex; gap:6px; margin-bottom:16px;">
                        <input type="text" id="f5-prof-input" placeholder="Yasaklı kelime ekle..." style="flex:1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 11px; padding: 6px 8px; outline: none;">
                        <button id="f5-prof-ekle-btn" style="background: #53fc18; color: #000; border: none; border-radius: 6px; font-size: 11px; font-weight: 800; padding: 0 12px; cursor: pointer;">+ Ekle</button>
                    </div>
                    <div class="f5-divider"></div>
                    <label class="f5-label"><span data-i18n="zil_baslik">${t('zil_baslik')}</span></label>
                    <div class="f5-zil-aciklama-metin" style="margin-top:-6px; margin-bottom:10px;" data-i18n="zil_aciklama">${t('zil_aciklama')}</div>
                    <div id="f5-zil-liste" class="f5-zil-grid"></div>
                    <input type="file" id="f5-zil-dosya-input" accept="audio/mpeg,.mp3" style="display:none;">
                    <div id="f5-zil-mesaj" class="f5-io-msg"></div>
                    <div class="f5-divider"></div>
                    <label class="f5-label"><span data-i18n="mikrofon_ayarlari_baslik">${t('mikrofon_ayarlari_baslik')}</span></label>
                    <div class="f5-toggle-row">
                        <div class="f5-toggle-metin">
                            <span class="f5-toggle-baslik" data-i18n="gurultu_engelleyici_baslik">${t('gurultu_engelleyici_baslik')}</span>
                            <span class="f5-toggle-aciklama" data-i18n="gurultu_engelleyici_aciklama">${t('gurultu_engelleyici_aciklama')}</span>
                        </div>
                        <label class="f5-toggle"><input type="checkbox" id="f5-toggle-gurultu" checked><span class="f5-toggle-slider"></span></label>
                    </div>
                    <div class="f5-divider"></div>
                    <label class="f5-label"><span data-i18n="ayarlar_yonet_label">${t('ayarlar_yonet_label')}</span></label>
                    <div class="f5-io-buttons">
                        <button id="f5-disa-aktar" class="f5-btn-io f5-btn-io-export f5-ripple-btn" type="button">
                            <span class="f5-btn-io-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg></span>
                            <span data-i18n="disa_aktar_btn">${t('disa_aktar_btn')}</span>
                        </button>
                        <button id="f5-ice-aktar" class="f5-btn-io f5-btn-io-import f5-ripple-btn" type="button">
                            <span class="f5-btn-io-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"></path><path d="m7 8 5-5 5 5"></path><path d="M5 21h14"></path></svg></span>
                            <span data-i18n="ice_aktar_btn">${t('ice_aktar_btn')}</span>
                        </button>
                        <input type="file" id="f5-ice-aktar-dosya" accept="application/json,.json" style="display:none;">
                    </div>
                    <div class="f5-io-buttons" style="margin-bottom:6px;">
                        <button id="f5-ayar-sifirla" class="f5-btn-io f5-btn-reset f5-ripple-btn" type="button">
                            <span class="f5-btn-io-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg></span>
                            <span data-i18n="sifirla_varsayilan_btn">${t('sifirla_varsayilan_btn')}</span>
                        </button>
                    </div>
                    <div id="f5-io-mesaj" class="f5-io-msg"></div>
                    <div id="f5-nick-alani" style="display:none;">
                        <div class="f5-divider"></div>
                        <label class="f5-label"><span>👤 Nick</span></label>
                        <button id="f5-nick-degistir-btn" class="f5-btn-io f5-ripple-btn" type="button" style="width:100%; margin-bottom:16px;">
                            <span class="f5-btn-io-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>
                            <span data-i18n="nick_degistir_btn">${t('nick_degistir_btn')}</span>
                        </button>
                    </div>
                </div>
                <div id="sekme-aktif" class="f5-tab-content">
                    <div class="f5-status-area" style="margin-bottom:14px;">
                        <span><span data-i18n="baglanti_label">${t('baglanti_label')}</span> <span id="f5-fb-durum" class="f5-status-val" style="color:#ffb700;">-</span></span>
                        <span><span data-i18n="aktif_sayi_label">${t('aktif_sayi_label')}</span> <span id="f5-aktif-sayi" style="color:var(--f5-value-text); font-weight:700;">0</span></span>
                    </div>
                    <div id="f5-aktif-liste" class="f5-aktif-liste">
                        <div class="f5-aktif-bos" data-i18n="kimse_aktif_degil">${t('kimse_aktif_degil')}</div>
                    </div>
                </div>
                <div id="sekme-istatistik" class="f5-tab-content">
                    <div class="f5-status-area" style="margin-bottom:14px;">
                        <span><span data-i18n="sifirlanmaya_label">${t('sifirlanmaya_label')}</span> <span id="f5-sifir-sayac" style="color:var(--f5-value-text); font-weight:700;">--:--:--</span></span>
                    </div>
                    <div id="f5-puan-liste" class="f5-aktif-liste">
                        <div class="f5-aktif-bos" data-i18n="henuz_puan_yok">${t('henuz_puan_yok')}</div>
                    </div>
                </div>
                <div id="sekme-sohbet" class="f5-tab-content">
                    <div class="f5-chat-layout">
                        <div class="f5-chat-sidebar">
                            <div class="f5-chat-sidebar-header">
                                <button id="f5-chat-yeni-dm-btn" class="f5-chat-btn-mini f5-ripple-btn" data-i18n="yeni_dm_btn">${t('yeni_dm_btn')}</button>
                                <button id="f5-chat-yeni-grup-btn" class="f5-chat-btn-mini f5-ripple-btn" data-i18n="yeni_grup_btn">${t('yeni_grup_btn')}</button>
                            </div>
                            <div id="f5-chat-rooms" class="f5-chat-rooms-list"></div>
                        </div>
                        <div class="f5-chat-main">
                            <div class="f5-chat-main-header">
                                <div id="f5-chat-active-avatar" class="f5-chat-room-avatar" style="display:none;"></div>
                                <div>
                                    <div id="f5-chat-active-title" class="f5-chat-main-title">-</div>
                                    <div id="f5-chat-active-desc" class="f5-chat-main-desc"></div>
                                </div>
                                <div class="f5-chat-header-actions">
                                    <button id="f5-chat-call-btn" class="f5-chat-call-icon-btn" style="display:none;" title="${t('sesli_arama_btn')}">${SVG_TELEFON}</button>
                                    <button id="f5-chat-options-toggle" class="f5-chat-options-btn">⋮</button>
                                </div>
                                <div id="f5-chat-options-menu" class="f5-chat-options-menu">
                                    <button class="f5-chat-option-item" id="f5-chat-opt-mute" data-i18n="sessize_al">${t('sessize_al')}</button>
                                    <button class="f5-chat-option-item" id="f5-chat-opt-manage" style="display:none;" data-i18n="kisileri_yonet">${t('kisileri_yonet')}</button>
                                    <button class="f5-chat-option-item" id="f5-chat-opt-profile" style="display:none;" data-i18n="grup_profili_degistir">${t('grup_profili_degistir')}</button>
                                    <button class="f5-chat-option-item danger" id="f5-chat-opt-delete" data-i18n="sohbet_sil">${t('sohbet_sil')}</button>
                                    <button class="f5-chat-option-item danger" id="f5-chat-opt-leave" style="display:none;" data-i18n="gruptan_ayril">${t('gruptan_ayril')}</button>
                                    <button class="f5-chat-option-item danger" id="f5-chat-opt-block" style="display:none;" data-i18n="engelle">${t('engelle')}</button>
                                </div>
                            </div>
                            <div id="f5-chat-messages" class="f5-chat-messages">
                                <div class="f5-chat-empty-state" data-i18n="sohbet_secin">${t('sohbet_secin')}</div>
                            </div>
                            <button id="f5-yeni-mesaj-btn" class="f5-yeni-mesaj-btn" type="button">
                                <span class="f5-yeni-mesaj-arrow">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path></svg>
                                </span>
                                <span id="f5-yeni-mesaj-metin">${t('yeni_mesajlar_btn')}</span>
                            </button>
                            <div id="f5-timeout-overlay">
                                <div style="display:flex; flex-direction:column; align-items:center;">
                                    <span class="f5-timeout-lock-icon">🔒</span>
                                    <div class="f5-timeout-lock-title">${t('timeout_locked_title')}</div>
                                    <div class="f5-timeout-lock-desc">${t('timeout_locked_desc')}</div>
                                    <div class="f5-timeout-details" id="f5-timeout-details"></div>
                                </div>
                            </div>
                            <div id="f5-chat-blocked-overlay" class="f5-blocked-overlay"></div>
                            <div class="f5-chat-reply-edit-preview" id="f5-chat-reply-edit-preview">
                                <div class="f5-chat-reply-edit-preview-bar"></div>
                                <div class="f5-chat-reply-edit-preview-body">
                                    <div class="f5-chat-reply-edit-preview-label" id="f5-chat-reply-edit-preview-label"></div>
                                    <div class="f5-chat-reply-edit-preview-text" id="f5-chat-reply-edit-preview-text"></div>
                                </div>
                                <button type="button" class="f5-chat-reply-edit-preview-close" id="f5-chat-reply-edit-preview-close">&times;</button>
                            </div>
                            <div class="f5-chat-clear-hint" id="f5-chat-clear-hint">
                                <span class="f5-chat-clear-hint-cmd">/clear</span>
                                <span class="f5-chat-clear-hint-desc">${t('sohbet_temizlendi_bilgi')}</span>
                            </div>
                            <div class="f5-chat-input-row" id="f5-chat-input-box" style="display:none;">
                                <label class="f5-chat-upload-btn">
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    <input type="file" id="f5-chat-img-input" accept="image/*" style="display:none;">
                                </label>
                                <button type="button" id="f5-chat-gif-btn" class="f5-chat-upload-btn f5-chat-gif-open-btn" title="GIF">GIF</button>
                                <input type="text" id="f5-chat-input" class="f5-chat-input" placeholder="${t('mesaj_yaz')}" data-i18n-placeholder="mesaj_yaz" maxlength="400">
                                <button id="f5-chat-send" class="f5-chat-send-btn f5-ripple-btn" data-i18n="gonder">${t('gonder')}</button>
                            </div>
                            <div id="f5-grup-kur-modal" class="f5-submodal">
                                <div class="f5-submodal-header">
                                    <span class="f5-submodal-title" data-i18n="yeni_grup_btn">${t('yeni_grup_btn')}</span>
                                    <span class="f5-submodal-close" id="f5-grup-kur-kapat">&times;</span>
                                </div>
                                <input type="text" id="f5-grup-ad-input" class="f5-chat-input" placeholder="${t('grup_adi_gir')}" data-i18n-placeholder="grup_adi_gir">
                                <div id="f5-grup-kullanici-secimi" class="f5-submodal-list"></div>
                                <button id="f5-grup-onayla-btn" class="f5-chat-send-btn f5-ripple-btn" data-i18n="grup_olustur">${t('grup_olustur')}</button>
                            </div>
                            <div id="f5-dm-sec-modal" class="f5-submodal">
                                <div class="f5-submodal-header">
                                    <span class="f5-submodal-title" data-i18n="yeni_dm_btn">${t('yeni_dm_btn')}</span>
                                    <span class="f5-submodal-close" id="f5-dm-sec-kapat">&times;</span>
                                </div>
                                <div id="f5-dm-kullanici-secimi" class="f5-submodal-list"></div>
                            </div>
                            <div id="f5-grup-duzenle-modal" class="f5-submodal">
                                <div class="f5-submodal-header">
                                    <span class="f5-submodal-title" data-i18n="kisileri_yonet">${t('kisileri_yonet')}</span>
                                    <span class="f5-submodal-close" id="f5-grup-duzenle-kapat">&times;</span>
                                </div>
                                <div id="f5-grup-duzenle-liste" class="f5-submodal-list"></div>
                                <button id="f5-grup-duzenle-onayla-btn" class="f5-chat-send-btn f5-ripple-btn">Kaydet</button>
                            </div>
                            <div id="f5-mute-modal" class="f5-submodal" style="z-index: 25;">
                                <div class="f5-submodal-header">
                                    <span class="f5-submodal-title" data-i18n="sessize_al">${t('sessize_al')}</span>
                                    <span class="f5-submodal-close" id="f5-mute-kapat">&times;</span>
                                </div>
                                <div class="f5-submodal-list" style="gap: 8px;">
                                    <button class="f5-btn-io f5-ripple-btn f5-mute-opt" data-hours="1" data-i18n="mute_1h">${t('mute_1h')}</button>
                                    <button class="f5-btn-io f5-ripple-btn f5-mute-opt" data-hours="8" data-i18n="mute_8h">${t('mute_8h')}</button>
                                    <button class="f5-btn-io f5-ripple-btn f5-mute-opt" data-hours="24" data-i18n="mute_24h">${t('mute_24h')}</button>
                                    <button class="f5-btn-io f5-ripple-btn f5-mute-opt" data-hours="-1" style="color: #ff4c4c;" data-i18n="mute_forever">${t('mute_forever')}</button>
                                </div>
                            </div>
                            <div id="f5-read-details-modal" class="f5-submodal" style="z-index: 26;">
                                <div class="f5-submodal-header">
                                    <span class="f5-submodal-title">Okuyanlar Detayı</span>
                                    <span class="f5-submodal-close" id="f5-read-details-kapat">&times;</span>
                                </div>
                                <div id="f5-read-details-list" class="f5-submodal-list"></div>
                            </div>
                            <div id="f5-gif-modal" class="f5-submodal">
                                <div class="f5-submodal-header">
                                    <span class="f5-submodal-title" data-i18n="gif_gonder">${t('gif_gonder')}</span>
                                    <span class="f5-submodal-close" id="f5-gif-kapat">&times;</span>
                                </div>
                                <input type="text" id="f5-gif-arama-input" class="f5-chat-input" placeholder="${t('gif_ara_placeholder')}" data-i18n-placeholder="gif_ara_placeholder" style="width:100%; margin-bottom:10px; flex:none; height:34px;">
                                <div id="f5-gif-durum" class="f5-gif-durum"></div>
                                <div id="f5-gif-grid" class="f5-gif-grid"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="sekme-admin" class="f5-tab-content">
                    <div style="background: rgba(255,76,76,0.08); border: 1px solid rgba(255,76,76,0.3); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
                        <div style="font-size:12px; font-weight:800; color:#ff6b6b; margin-bottom:8px;" data-i18n="timeout_baslik">${t('timeout_baslik')}</div>
                        <div style="font-size:10px; color:#888; margin-bottom:10px;" data-i18n="timeout_aciklama">${t('timeout_aciklama')}</div>
                        <div style="display:flex; gap:6px; margin-bottom:10px; position: relative;">
                            <input type="text" id="f5-timeout-user-input" placeholder="${t('timeout_kullanici_placeholder')}" data-i18n-placeholder="timeout_kullanici_placeholder" style="flex:1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 11px; padding: 7px 10px; outline: none;" autocomplete="off">
                            <button id="f5-timeout-uygula-btn" style="background: linear-gradient(145deg,#ff4c4c,#c41e1e); color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:800; padding:0 14px; cursor:pointer; white-space:nowrap;" data-i18n="timeout_sustur_btn">${t('timeout_sustur_btn')}</button>
                            <div id="f5-timeout-autocomplete" class="f5-timeout-autocomplete" style="display:none;"></div>
                        </div>
                        <input type="text" id="f5-timeout-aciklama-input" class="f5-timeout-aciklama-input" placeholder="${t('timeout_aciklama_placeholder')}" data-i18n-placeholder="timeout_aciklama_placeholder" maxlength="100">
                        <div style="font-size:10px; font-weight:700; color:#ccc; margin-bottom:6px; margin-top:8px;">Hazır Süreler</div>
                        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
                            <button class="f5-timeout-preset" data-sure="60000" style="flex:1; min-width:60px; padding:6px 8px; background: rgba(255,183,0,0.15); color:#ffb700; border:1px solid rgba(255,183,0,0.4); border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;" data-i18n="timeout_1dk">${t('timeout_1dk')}</button>
                            <button class="f5-timeout-preset" data-sure="300000" style="flex:1; min-width:60px; padding:6px 8px; background: rgba(255,183,0,0.15); color:#ffb700; border:1px solid rgba(255,183,0,0.4); border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;" data-i18n="timeout_5dk">${t('timeout_5dk')}</button>
                            <button class="f5-timeout-preset" data-sure="600000" style="flex:1; min-width:60px; padding:6px 8px; background: rgba(255,183,0,0.15); color:#ffb700; border:1px solid rgba(255,183,0,0.4); border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;" data-i18n="timeout_10dk">${t('timeout_10dk')}</button>
                            <button class="f5-timeout-preset" data-sure="1800000" style="flex:1; min-width:60px; padding:6px 8px; background: rgba(255,183,0,0.15); color:#ffb700; border:1px solid rgba(255,183,0,0.4); border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;" data-i18n="timeout_30dk">${t('timeout_30dk')}</button>
                            <button class="f5-timeout-preset" data-sure="3600000" style="flex:1; min-width:60px; padding:6px 8px; background: rgba(255,183,0,0.15); color:#ffb700; border:1px solid rgba(255,183,0,0.4); border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;" data-i18n="timeout_1s">${t('timeout_1s')}</button>
                            <button class="f5-timeout-preset" data-sure="86400000" style="flex:1; min-width:60px; padding:6px 8px; background: rgba(255,183,0,0.15); color:#ffb700; border:1px solid rgba(255,183,0,0.4); border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;" data-i18n="timeout_24s">${t('timeout_24s')}</button>
                            <button class="f5-timeout-preset" data-sure="-1" style="flex:1; min-width:60px; padding:6px 8px; background: rgba(255,76,76,0.15); color:#ff6b6b; border:1px solid rgba(255,76,76,0.4); border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;" data-i18n="timeout_kalici">${t('timeout_kalici')}</button>
                        </div>
                        <div style="font-size:10px; font-weight:700; color:#ccc; margin-bottom:6px;">Özel Süre</div>
                        <div class="f5-timeout-custom-row">
                            <input type="number" id="f5-timeout-ozel-sure-input" min="1" placeholder="${t('ozel_sure_dk')}" data-i18n-placeholder="ozel_sure_dk">
                            <select id="f5-timeout-ozel-sure-birim" class="f5-ozel-sure-birim">
                                <option value="1" data-i18n="ozel_sure_dakika">${t('ozel_sure_dakika')}</option>
                                <option value="60" data-i18n="ozel_sure_saat">${t('ozel_sure_saat')}</option>
                                <option value="1440" data-i18n="ozel_sure_gun">${t('ozel_sure_gun')}</option>
                            </select>
                            <button id="f5-timeout-ozel-sure-btn" data-i18n="ozel_sure_uygula">${t('ozel_sure_uygula')}</button>
                        </div>
                        <div id="f5-timeout-secili-sure" class="f5-timeout-secili-goster" style="display:none;"></div>
                        <div style="font-size:10px; font-weight:700; color:#ccc; margin-bottom:6px; margin-top:10px;" data-i18n="timeout_aktif_liste">${t('timeout_aktif_liste')}</div>
                        <div id="f5-timeout-aktif-liste" style="max-height:180px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div>
                    </div>
                    <div class="f5-toggle-row" style="background: rgba(255,183,0,0.08); border: 1px solid rgba(255,183,0,0.3); border-radius: 10px; padding: 10px; margin-bottom: 12px;">
                        <div class="f5-toggle-metin">
                            <span class="f5-toggle-baslik" style="color:#ffb700;">Black AI Oto-Onay Modu</span>
                            <span class="f5-toggle-aciklama">Acil arama sebeplerini yapay zeka değerlendirsin</span>
                            <div id="f5-ai-mod-durum" style="font-size:10px; color:#888; margin-top:4px;"></div>
                        </div>
                        <label class="f5-toggle"><input type="checkbox" id="f5-toggle-ai-mod"><span class="f5-toggle-slider"></span></label>
                    </div>
                    <div id="f5-ai-kelime-alani" style="display:none; background: rgba(83,252,24,0.06); border: 1px solid rgba(83,252,24,0.25); border-radius: 10px; padding: 10px; margin-bottom: 12px;">
                        <div style="font-size:11px; font-weight:700; color:#53fc18; margin-bottom:8px;">🔑 Özel Onay Kelimeleri</div>
                        <div style="display:flex; gap:6px; margin-bottom:8px;">
                            <input type="text" id="f5-ai-kelime-input" placeholder="Kelime ekle..." style="flex:1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 11px; padding: 6px 8px; outline: none;">
                            <button id="f5-ai-kelime-ekle-btn" style="background: #53fc18; color: #000; border: none; border-radius: 6px; font-size: 11px; font-weight: 800; padding: 0 12px; cursor: pointer;">+ Ekle</button>
                        </div>
                        <div id="f5-ai-kelime-liste" style="display:flex; flex-wrap:wrap; gap:6px;"></div>
                    </div>
                    <div class="f5-status-area" style="margin-bottom:12px; align-items: center;">
                        <span><b style="color:#ff4c4c; font-size:13px;">${t('admin_panel_baslik')}</b></span>
                        <button id="f5-admin-tumunu-temizle" style="background: rgba(255,76,76,0.15); border: 1px solid rgba(255,76,76,0.4); color: #ff6b6b; border-radius: 6px; padding: 4px 10px; font-size: 10px; font-weight: 700; cursor: pointer;">${t('admin_tumunu_temizle')}</button>
                    </div>
                    <div id="f5-admin-acil-liste" class="f5-aktif-liste" style="max-height: 380px;">
                        <div class="f5-aktif-bos">${t('admin_bos')}</div>
                    </div>
                    <div class="f5-divider"></div>
                    <div class="f5-status-area" style="margin-bottom:10px; align-items: center;">
                        <span><b style="color:#53fc18; font-size:13px;" data-i18n="beyaz_liste_baslik">${t('beyaz_liste_baslik')}</b></span>
                    </div>
                    <div style="font-size:10.5px; color:#888; margin-bottom:10px;" data-i18n="beyaz_liste_aciklama">${t('beyaz_liste_aciklama')}</div>
                    <button id="f5-beyaz-liste-ekle-btn" class="f5-beyaz-liste-ekle-btn f5-ripple-btn" type="button" style="margin-bottom:10px;" data-i18n="beyaz_liste_ekle_btn">${t('beyaz_liste_ekle_btn')}</button>
                    <div id="f5-admin-beyaz-liste" class="f5-aktif-liste" style="max-height: 300px;">
                        <div class="f5-aktif-bos" data-i18n="beyaz_liste_bos">${t('beyaz_liste_bos')}</div>
                    </div>
                </div>
                <div class="f5-tabs">
                    <button class="f5-tab-btn f5-ripple-btn f5-tab-kayan active" data-tab="sekme-zaman"><span class="f5-tab-btn-metin" data-i18n="tab_zamanlayici">${t('tab_zamanlayici')}</span></button>
                    <button class="f5-tab-btn f5-ripple-btn" data-tab="sekme-sohbet" data-i18n="tab_sohbet">${t('tab_sohbet')}</button>
                    <button class="f5-tab-btn f5-ripple-btn" data-tab="sekme-aktif" data-i18n="tab_aktif">${t('tab_aktif')}</button>
                    <button class="f5-tab-btn f5-ripple-btn" data-tab="sekme-istatistik" data-i18n="tab_istatistik">${t('tab_istatistik')}</button>
                    <button class="f5-tab-btn f5-ripple-btn" data-tab="sekme-ayarlar" data-i18n="tab_gorunum">${t('tab_gorunum')}</button>
                    <button class="f5-tab-btn f5-ripple-btn" data-tab="sekme-admin" id="f5-tab-admin-btn" style="display:none; color:#ff6b6b;" data-i18n="tab_admin">${t('tab_admin')}</button>
                </div>
            </div>
        </div>
        <div id="f5-image-modal" class="f5-image-modal">
            <span class="f5-image-modal-close" id="f5-image-modal-close">&times;</span>
            <img id="f5-image-modal-img" src="">
        </div>
        <div id="f5-cagri-overlay" class="f5-cagri-overlay">
            <div class="f5-cagri-card">
                <div id="f5-cagri-avatar" class="f5-cagri-avatar"></div>
                <div id="f5-cagri-isim" class="f5-cagri-isim">-</div>
                <div id="f5-cagri-durum" class="f5-cagri-durum">-</div>
                <div id="f5-cagri-giden-btns" class="f5-cagri-btn-row" style="display:none;">
                    <button id="f5-cagri-iptal-btn" class="f5-cagri-btn f5-cagri-btn-red" type="button">
                        <span class="f5-cagri-btn-ikon">${SVG_TELEFON}</span>
                        <span data-i18n="cagri_iptal_btn">${t('cagri_iptal_btn')}</span>
                    </button>
                </div>
                <div id="f5-cagri-gelen-btns" class="f5-cagri-btn-row" style="display:none;">
                    <button id="f5-cagri-reddet-btn" class="f5-cagri-btn f5-cagri-btn-red" type="button">
                        <span class="f5-cagri-btn-ikon">${SVG_TELEFON}</span>
                        <span data-i18n="cagri_reddet_btn">${t('cagri_reddet_btn')}</span>
                    </button>
                    <button id="f5-cagri-kabul-btn" class="f5-cagri-btn f5-cagri-btn-green" type="button">
                        <span class="f5-cagri-btn-ikon">${SVG_TELEFON}</span>
                        <span id="f5-cagri-kabul-metin" data-i18n="cagri_kabul_btn">${t('cagri_kabul_btn')}</span>
                    </button>
                </div>
                <div id="f5-cagri-aktif-btns" class="f5-cagri-btn-row" style="display:none;">
                    <button id="f5-cagri-mute-btn" class="f5-cagri-btn f5-cagri-btn-gray" type="button">
                        <span class="f5-cagri-btn-ikon">${SVG_MIC}</span>
                        <span id="f5-cagri-mute-metin" data-i18n="cagri_sesi_kapat">${t('cagri_sesi_kapat')}</span>
                    </button>
                    <button id="f5-cagri-kapat-btn" class="f5-cagri-btn f5-cagri-btn-red" type="button">
                        <span class="f5-cagri-btn-ikon">${SVG_TELEFON}</span>
                        <span data-i18n="cagri_kapat_btn">${t('cagri_kapat_btn')}</span>
                    </button>
                </div>
            </div>
        </div>
        <div id="f5-beyaz-liste-sec-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000010; display: none; align-items: center; justify-content: center; backdrop-filter: blur(6px);">
            <div style="width: 340px; max-height: 80vh; background: rgba(22,23,27,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px; color: #fff; display: flex; flex-direction: column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <span style="font-size:14px; font-weight:800; color:#53fc18;" data-i18n="beyaz_liste_ekle_baslik">${t('beyaz_liste_ekle_baslik')}</span>
                    <span id="f5-beyaz-liste-sec-kapat" style="cursor:pointer; font-size:22px; color:#888; line-height:1;">&times;</span>
                </div>
                <input type="text" id="f5-beyaz-liste-arama" placeholder="Ara..." style="width:100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff; font-size: 12px; padding: 8px 10px; height: 34px; outline: none; margin-bottom: 10px; box-sizing: border-box;">
                <div id="f5-beyaz-liste-kullanicilar" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:6px; margin-bottom:10px; max-height: 400px;"></div>
            </div>
        </div>
    `;

    const eskiContainer = document.getElementById('f5-modern-container');
    if (eskiContainer) eskiContainer.remove();

    const container = document.createElement('div');
    container.id = 'f5-modern-container';
    container.innerHTML = htmlIcerik;
    document.body.appendChild(container);

    // Çağrı stili
    const cagriStilEl = document.createElement('style');
    cagriStilEl.id = 'f5-cagri-stil';
    cagriStilEl.textContent = `
        .f5-cagri-overlay { position: fixed; inset: 0; z-index: 999999; background: rgba(8, 8, 12, 0.86); backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center; }
        .f5-cagri-overlay.show { display: flex; animation: f5-cagri-fade-in 0.2s ease; }
        @keyframes f5-cagri-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .f5-cagri-overlay.f5-acil-arkaplan { animation: f5-acil-flash 1s ease-in-out infinite; }
        .f5-cagri-overlay.show.f5-acil-arkaplan { animation: f5-cagri-fade-in 0.2s ease, f5-acil-flash 1s ease-in-out infinite; }
        @keyframes f5-acil-flash { 0%, 100% { background: rgba(40, 5, 5, 0.92); } 50% { background: rgba(140, 10, 10, 0.96); } }
        .f5-cagri-card { width: 270px; max-width: 88vw; background: linear-gradient(180deg, rgba(30,30,38,0.97), rgba(20,20,26,0.97)); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 32px 22px 26px; display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 24px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset; animation: f5-cagri-card-in 0.25s cubic-bezier(.2,.9,.3,1.2); }
        @keyframes f5-cagri-card-in { from { opacity: 0; transform: scale(0.92) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .f5-cagri-avatar { position: relative; width: 96px; height: 96px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 16px; border: 2px solid var(--f5-main-color, #53fc18); box-shadow: 0 4px 18px rgba(0,0,0,0.4); }
        .f5-cagri-overlay.f5-cagri-ringing .f5-cagri-avatar::before, .f5-cagri-overlay.f5-cagri-ringing .f5-cagri-avatar::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; border: 2px solid var(--f5-main-color, #53fc18); animation: f5-cagri-ring 1.8s ease-out infinite; opacity: 0; }
        .f5-cagri-overlay.f5-cagri-ringing .f5-cagri-avatar::after { animation-delay: 0.6s; }
        @keyframes f5-cagri-ring { 0% { transform: scale(1); opacity: 0.65; } 100% { transform: scale(1.45); opacity: 0; } }
        .f5-call-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .f5-call-avatar-harf { font-size: 34px; font-weight: 700; color: #fff; }
        .f5-cagri-isim { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 5px; letter-spacing: 0.2px; }
        .f5-cagri-durum { font-size: 13px; color: rgba(255,255,255,0.55); margin-bottom: 26px; }
        .f5-cagri-btn-row { display: flex; gap: 22px; }
        .f5-cagri-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: none; color: rgba(255,255,255,0.85); cursor: pointer; font-size: 11px; font-family: inherit; font-weight: 600; }
        .f5-cagri-btn-ikon { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease; }
        .f5-cagri-btn-ikon svg { width: 22px; height: 22px; }
        .f5-cagri-btn:hover .f5-cagri-btn-ikon { transform: translateY(-2px) scale(1.06); filter: brightness(1.08); }
        .f5-cagri-btn:active .f5-cagri-btn-ikon { transform: scale(0.94); }
        .f5-cagri-btn-red .f5-cagri-btn-ikon { background: linear-gradient(145deg, #ff6b6b, #e63333); box-shadow: 0 4px 16px rgba(230,51,51,0.4); }
        .f5-cagri-btn-red .f5-cagri-btn-ikon svg { transform: rotate(135deg); }
        .f5-cagri-btn-green .f5-cagri-btn-ikon { background: linear-gradient(145deg, #6bff2f, #3ed10f); color: #0a0f07; box-shadow: 0 4px 16px rgba(83,252,24,0.45); animation: f5-call-btn-pulse 2.2s ease-in-out infinite; }
        .f5-cagri-btn-gray .f5-cagri-btn-ikon { background: rgba(255,255,255,0.12); }
        .f5-cagri-btn.f5-cagri-muted .f5-cagri-btn-ikon { background: var(--f5-main-color, #53fc18); color: #0a0f07; }
    `;
    document.head.appendChild(cagriStilEl);

    window.f5ResimAc = function(src) {
        document.getElementById('f5-image-modal-img').src = src;
        document.getElementById('f5-image-modal').classList.add('show');
    };
    document.getElementById('f5-image-modal-close').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('f5-image-modal').classList.remove('show');
        document.getElementById('f5-image-modal-img').src = '';
    });
    document.getElementById('f5-image-modal').addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.id === 'f5-image-modal') {
            document.getElementById('f5-image-modal').classList.remove('show');
            document.getElementById('f5-image-modal-img').src = '';
        }
    });

    function diliUygula() {
        document.querySelectorAll('[data-i18n]').forEach(el => el.innerHTML = t(el.getAttribute('data-i18n')));
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = t(el.getAttribute('data-i18n-placeholder')));
        document.querySelectorAll('[data-i18n-title]').forEach(el => el.title = t(el.getAttribute('data-i18n-title')));
        const dilBtnMetin = document.getElementById('f5-dil-buton-metin');
        if (dilBtnMetin) dilBtnMetin.textContent = aktifDil.toUpperCase();
        document.querySelectorAll('.f5-dil-secenek').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-dil') === aktifDil);
        });
        tusGosterimGuncelle();
        if (zamanlayiciKontrol) {
            const btnBaslatEl = document.getElementById('f5-baslat');
            const durumEl = document.getElementById('f5-durum');
            if (btnBaslatEl) btnBaslatEl.textContent = t('btn_durdur');
            if (durumEl) durumEl.textContent = t('durum_aktif');
        } else {
            const btnBaslatEl = document.getElementById('f5-baslat');
            const durumEl = document.getElementById('f5-durum');
            if (btnBaslatEl) btnBaslatEl.textContent = t('btn_baslat');
            if (durumEl) durumEl.textContent = t('durum_kapali');
        }
        const fabBadgeEl = document.getElementById('f5-fab-badge');
        if (fabBadgeEl && rozetHerZaman) fabBadgeEl.textContent = t('durum_kapali');
        const konumSeciciEl = document.getElementById('f5-konum-secici');
        tooltipText = (konumSeciciEl && konumSeciciEl.value === 'custom') ? t('tooltip_surukle') : t('tooltip_varsayilan');
        dmOnlineDurumuGuncelle();
        requestAnimationFrame(kayanSekmeMesafesiniHesapla);
        timeoutKilitEkraniniGuncelle();
    }

    const dilBtn = document.getElementById('f5-dil-buton');
    const dilMenu = document.getElementById('f5-dil-menu');
    if (dilBtn && dilMenu) {
        dilBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dilMenu.classList.toggle('f5-dil-menu-show');
        });
        dilMenu.querySelectorAll('.f5-dil-secenek').forEach((secenekBtn) => {
            secenekBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const seciliDil = secenekBtn.getAttribute('data-dil');
                dilMenu.classList.remove('f5-dil-menu-show');
                if (seciliDil !== aktifDil) {
                    aktifDil = seciliDil;
                    localStorage.setItem('kick_f5_dil', seciliDil);
                    diliUygula();
                }
            });
        });
        document.addEventListener('click', (e) => {
            if (!dilMenu.contains(e.target) && e.target !== dilBtn) dilMenu.classList.remove('f5-dil-menu-show');
        });
    }

    // DOM referansları
    const fabBtn = document.getElementById('f5-fab-btn');
    const fabBadge = document.getElementById('f5-fab-badge');
    const fabIcon = fabBtn.querySelector('.f5-icon');
    const progressRing = document.getElementById('f5-ring');
    const unreadBadge = document.getElementById('f5-unread-badge');
    const modal = document.getElementById('f5-modal');
    const btnBaslat = document.getElementById('f5-baslat');
    const btnSifirla = document.getElementById('f5-sifirla');
    const durumMetni = document.getElementById('f5-durum');
    const hedefZamanMetni = document.getElementById('f5-hedef-zaman');
    const boyutSlider = document.getElementById('f5-boyut-slider');
    const boyutDeger = document.getElementById('f5-boyut-deger');
    const renkSecici = document.getElementById('f5-renk-secici');
    const konumSecici = document.getElementById('f5-konum-secici');
    const geriSayimKutusu = document.getElementById('f5-countdown-container');
    const geriSayimMetni = document.getElementById('f5-countdown-timer');

    document.addEventListener('mousedown', function(e) {
        const target = e.target.closest('.f5-ripple-btn');
        if (target) {
            const rect = target.getBoundingClientRect(), ripple = document.createElement('span');
            const diameter = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = diameter + 'px';
            ripple.style.left = e.clientX - rect.left - diameter/2 + 'px';
            ripple.style.top = e.clientY - rect.top - diameter/2 + 'px';
            ripple.className = 'f5-ripple'; target.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        }
    });

    let tooltipText = t('tooltip_varsayilan');

    const tabButtons = document.querySelectorAll('.f5-tab-btn');
    const tabContents = document.querySelectorAll('.f5-tab-content');

    function kayanSekmeMesafesiniHesapla() {
        const kayanBtn = document.querySelector('.f5-tab-btn.f5-tab-kayan');
        if (!kayanBtn) return;
        const metinEl = kayanBtn.querySelector('.f5-tab-btn-metin');
        if (!metinEl) return;
        const tasanMiktar = Math.ceil(metinEl.scrollWidth - kayanBtn.clientWidth);
        metinEl.style.setProperty('--f5-kayma-mesafe', tasanMiktar > 2 ? `-${tasanMiktar + 3}px` : '0px');
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const hedefSekme = btn.getAttribute('data-tab');
            const hedefEl = document.getElementById(hedefSekme);
            if (hedefEl) hedefEl.classList.add('active');
            requestAnimationFrame(kayanSekmeMesafesiniHesapla);
            if (hedefSekme === 'sekme-sohbet') {
                modal.classList.add('f5-genis-modal');
                if (aktifOdaId && okunmayanOdalar[aktifOdaId]) {
                    okunmayanOdalar[aktifOdaId] = 0;
                    okunmayanBildirimGuncelle();
                    const oItem = document.querySelector(`.f5-chat-room-item[data-id="${aktifOdaId}"]`);
                    if (oItem) {
                        const badgeEl = oItem.querySelector('.f5-chat-room-unread');
                        if (badgeEl) badgeEl.style.display = 'none';
                        oItem.classList.remove('has-new');
                    }
                }
            } else {
                modal.classList.remove('f5-genis-modal');
            }
            if (hedefSekme === 'sekme-ayarlar') {
                zilListesiRenderla();
                profanityListesiRenderla();
            }
            if (hedefSekme === 'sekme-admin') {
                beyazListeRenderla();
                aiModDurumunuGuncelle();
                aiKelimeAlaniniGuncelle();
                aiOzelKelimeListesiRenderla();
                globalTimeoutListesiRenderla();
                const aiToggle = document.getElementById('f5-toggle-ai-mod');
                if (aiToggle) aiToggle.checked = aiModAktif;
            }
            if (hedefSekme === 'sekme-zaman') {
                const streakEl = document.getElementById('f5-streak-alani');
                if (streakEl) streakEl.innerHTML = streakHtmlUret();
            }
            timeoutKilitEkraniniGuncelle();
        });
    });
    requestAnimationFrame(kayanSekmeMesafesiniHesapla);
    window.addEventListener('resize', kayanSekmeMesafesiniHesapla);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => requestAnimationFrame(kayanSekmeMesafesiniHesapla));
    }
    window.addEventListener('load', () => requestAnimationFrame(kayanSekmeMesafesiniHesapla));
    setTimeout(() => requestAnimationFrame(kayanSekmeMesafesiniHesapla), 500);
    setTimeout(() => requestAnimationFrame(kayanSekmeMesafesiniHesapla), 1500);

    const aiToggleEl = document.getElementById('f5-toggle-ai-mod');
    if (aiToggleEl) {
        aiToggleEl.checked = aiModAktif;
        aiModDurumunuGuncelle();
        aiKelimeAlaniniGuncelle();
        aiOzelKelimeListesiRenderla();
        aiToggleEl.addEventListener('change', (e) => {
            aiModAktif = e.target.checked;
            localStorage.setItem(AI_MOD_ANAHTARI, aiModAktif ? 'acik' : 'kapali');
            aiModDurumunuGuncelle();
            aiKelimeAlaniniGuncelle();
        });
    }
    const aiKelimeEkleBtn = document.getElementById('f5-ai-kelime-ekle-btn');
    const aiKelimeInput = document.getElementById('f5-ai-kelime-input');
    if (aiKelimeEkleBtn && aiKelimeInput) {
        aiKelimeEkleBtn.addEventListener('click', () => {
            aiOzelKelimeEkle(aiKelimeInput.value);
            aiKelimeInput.value = '';
            aiModDurumunuGuncelle();
        });
        aiKelimeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                aiOzelKelimeEkle(aiKelimeInput.value);
                aiKelimeInput.value = '';
                aiModDurumunuGuncelle();
            }
        });
    }

    // ==================== TIMEOUT ARAYÜZÜ ====================
    const timeoutUserInput = document.getElementById('f5-timeout-user-input');
    const timeoutUygulaBtn = document.getElementById('f5-timeout-uygula-btn');
    const timeoutSeciliSureEl = document.getElementById('f5-timeout-secili-sure');
    const timeoutAutocomplete = document.getElementById('f5-timeout-autocomplete');
    let seciliTimeoutSure = 3600000;
    let seciliTimeoutSureMetni = '';

    function timeoutSureMetniGuncelle() {
        if (!timeoutSeciliSureEl) return;
        if (seciliTimeoutSureMetni) {
            timeoutSeciliSureEl.textContent = '✓ Uygulanacak: ' + seciliTimeoutSureMetni;
            timeoutSeciliSureEl.style.display = 'block';
        } else {
            timeoutSeciliSureEl.style.display = 'none';
        }
    }

    function timeoutAutocompleteGoster(aramaMetni) {
        if (!timeoutAutocomplete || !tumAktifKullanicilar || tumAktifKullanicilar.length === 0) {
            if (timeoutAutocomplete) timeoutAutocomplete.style.display = 'none';
            return;
        }
        const aramaKucuk = (aramaMetni || '').toLowerCase().trim();
        const filtreli = tumAktifKullanicilar.filter(k => {
            if (!k.username) return false;
            if (k.username === mevcutKullaniciAdi) return false;
            if (aramaKucuk && !k.username.toLowerCase().includes(aramaKucuk)) return false;
            return true;
        }).slice(0, 20);
        if (filtreli.length === 0) {
            timeoutAutocomplete.innerHTML = `<div class="f5-timeout-autocomplete-empty">${t('kullanici_bulunamadi')}</div>`;
            timeoutAutocomplete.style.display = 'block';
            return;
        }
        timeoutAutocomplete.innerHTML = '';
        filtreli.forEach(k => {
            const item = document.createElement('div');
            item.className = 'f5-timeout-autocomplete-item';
            const avatarIc = k.avatar ? `<img src="${k.avatar}">` : (k.username || '?').charAt(0).toUpperCase();
            item.innerHTML = `<div class="f5-timeout-autocomplete-avatar">${avatarIc}</div><div class="f5-timeout-autocomplete-name">${k.username}</div>`;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                timeoutUserInput.value = k.username;
                timeoutAutocomplete.style.display = 'none';
            });
            timeoutAutocomplete.appendChild(item);
        });
        timeoutAutocomplete.style.display = 'block';
    }

    if (timeoutUserInput) {
        timeoutUserInput.addEventListener('focus', () => timeoutAutocompleteGoster(timeoutUserInput.value));
        timeoutUserInput.addEventListener('input', () => timeoutAutocompleteGoster(timeoutUserInput.value));
        timeoutUserInput.addEventListener('blur', () => {
            setTimeout(() => { if (timeoutAutocomplete) timeoutAutocomplete.style.display = 'none'; }, 200);
        });
        timeoutUserInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (timeoutAutocomplete) timeoutAutocomplete.style.display = 'none';
                timeoutUserInput.blur();
            }
            if (e.key === 'Enter') timeoutUygulaBtn.click();
        });
    }

    document.querySelectorAll('.f5-timeout-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            seciliTimeoutSure = parseInt(btn.getAttribute('data-sure'), 10);
            document.querySelectorAll('.f5-timeout-preset').forEach(b => {
                b.style.boxShadow = 'none';
                b.style.borderColor = b.style.color.includes('255, 76, 76') ? 'rgba(255,76,76,0.4)' : 'rgba(255,183,0,0.4)';
            });
            btn.style.boxShadow = '0 0 8px currentColor';
            let sureMetin = btn.textContent.trim();
            seciliTimeoutSureMetni = sureMetin;
            const ozelInput = document.getElementById('f5-timeout-ozel-sure-input');
            if (ozelInput) ozelInput.value = '';
            timeoutSureMetniGuncelle();
        });
    });

    const timeoutOzelSureInput = document.getElementById('f5-timeout-ozel-sure-input');
    const timeoutOzelSureBtn = document.getElementById('f5-timeout-ozel-sure-btn');
    const timeoutOzelSureBirim = document.getElementById('f5-timeout-ozel-sure-birim');
    if (timeoutOzelSureBtn && timeoutOzelSureInput) {
        timeoutOzelSureBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const deger = parseInt(timeoutOzelSureInput.value, 10);
            if (isNaN(deger) || deger < 1) {
                toastGoster(t('ozel_sure_gecersiz'), 'hata');
                return;
            }
            const carpanDk = timeoutOzelSureBirim ? parseInt(timeoutOzelSureBirim.value, 10) : 1;
            seciliTimeoutSure = deger * carpanDk * 60000;
            const birimMetni = timeoutOzelSureBirim && timeoutOzelSureBirim.options[timeoutOzelSureBirim.selectedIndex] ? timeoutOzelSureBirim.options[timeoutOzelSureBirim.selectedIndex].textContent : t('ozel_sure_dakika');
            seciliTimeoutSureMetni = `${deger} ${birimMetni}`;
            document.querySelectorAll('.f5-timeout-preset').forEach(b => {
                b.style.boxShadow = 'none';
                b.style.borderColor = b.style.color.includes('255, 76, 76') ? 'rgba(255,76,76,0.4)' : 'rgba(255,183,0,0.4)';
            });
            timeoutSureMetniGuncelle();
            timeoutOzelSureInput.value = '';
        });
        timeoutOzelSureInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') timeoutOzelSureBtn.click();
        });
    }

    if (timeoutUygulaBtn) {
        timeoutUygulaBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const username = (timeoutUserInput && timeoutUserInput.value.trim()) || '';
            if (!username) {
                toastGoster('Lütfen bir kullanıcı adı girin!', 'uyari');
                return;
            }
            const aciklamaInput = document.getElementById('f5-timeout-aciklama-input');
            const aciklama = aciklamaInput ? aciklamaInput.value.trim() : '';
            globalTimeoutUygula(username, seciliTimeoutSure, aciklama);
            if (timeoutUserInput) timeoutUserInput.value = '';
            if (aciklamaInput) aciklamaInput.value = '';
            if (timeoutAutocomplete) timeoutAutocomplete.style.display = 'none';
            toastGoster(t('timeout_uygulandi').replace('{isim}', username), 'basarili');
            setTimeout(globalTimeoutListesiRenderla, 500);
        });
    }

    // ==================== KÜFÜR FİLTRESİ ARAYÜZÜ ====================
    const profToggleEl = document.getElementById('f5-toggle-profanity');
    const profListEl = document.getElementById('f5-prof-list');
    const profInput = document.getElementById('f5-prof-input');
    const profEkleBtn = document.getElementById('f5-prof-ekle-btn');

    function profanityListesiRenderla() {
        if (!profListEl) return;
        const liste = profanityListesiGetir();
        profListEl.innerHTML = '';
        if (liste.length === 0) {
            profListEl.innerHTML = '<span style="font-size:10px; color:#666; font-style:italic;">Yasaklı kelime yok.</span>';
            return;
        }
        liste.forEach(kelime => {
            const item = document.createElement('div');
            item.className = 'f5-prof-item';
            item.innerHTML = `<span>${kelime}</span><span class="f5-prof-del">✕</span>`;
            item.querySelector('.f5-prof-del').addEventListener('click', (e) => {
                e.stopPropagation();
                const yeni = profanityListesiGetir().filter(k => k !== kelime);
                profanityListesiKaydet(yeni);
                profanityListesiRenderla();
            });
            profListEl.appendChild(item);
        });
    }

    if (profToggleEl) {
        profToggleEl.checked = profanityAktif;
        profToggleEl.addEventListener('change', (e) => {
            profanityAktif = e.target.checked;
            localStorage.setItem(PROFANITY_AKTIF_ANAHTAR, profanityAktif ? 'acik' : 'kapali');
        });
    }
    if (profEkleBtn && profInput) {
        profEkleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const kelime = profInput.value.trim().toLowerCase();
            if (!kelime) return;
            const liste = profanityListesiGetir();
            if (!liste.includes(kelime)) {
                liste.push(kelime);
                profanityListesiKaydet(liste);
                profanityListesiRenderla();
            }
            profInput.value = '';
        });
        profInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); profEkleBtn.click(); }
        });
    }
    profanityListesiRenderla();

    const nickDegistirBtn = document.getElementById('f5-nick-degistir-btn');
    if (nickDegistirBtn) {
        nickDegistirBtn.addEventListener('click', () => {
            const yeni = prompt('Yeni nick girin (mevcut: ' + (mevcutKullaniciAdi || 'yok') + ')');
            if (yeni && yeni.trim()) {
                localStorage.setItem('kick_f5_manuel_nick', yeni.trim());
                location.reload();
            }
        });
    }

    const btnModSaat = document.getElementById('btn-mod-saat');
    const btnModAralik = document.getElementById('btn-mod-aralik');
    const btnModSeri = document.getElementById('btn-mod-seri');
    function moduDegistir(mod) {
        aktifMod = mod;
        ['saat', 'aralik', 'seri'].forEach(m => {
            const btn = document.getElementById(`btn-mod-${m}`);
            const kutu = document.getElementById(`kutu-mod-${m}`);
            if (btn) btn.classList.remove('active');
            if (kutu) kutu.style.display = 'none';
        });
        const aktifBtn = document.getElementById(`btn-mod-${mod}`);
        const aktifKutu = document.getElementById(`kutu-mod-${mod}`);
        if (aktifBtn) aktifBtn.classList.add('active');
        if (aktifKutu) aktifKutu.style.display = 'block';
    }
    if (btnModSaat) btnModSaat.addEventListener('click', () => moduDegistir('saat'));
    if (btnModAralik) btnModAralik.addEventListener('click', () => moduDegistir('aralik'));
    if (btnModSeri) btnModSeri.addEventListener('click', () => moduDegistir('seri'));

    const stilButonlari = document.querySelectorAll('.f5-stil-btn');
    const TUM_STILLER = ['solid', 'minimal', 'gradient', 'squircle'];
    function stiliUygula(stil) {
        fabBtn.classList.remove(...TUM_STILLER.map(s => 'f5-fab-' + s));
        if (stil !== 'glass') fabBtn.classList.add('f5-fab-' + stil);
        stilButonlari.forEach(b => b.classList.toggle('active', b.getAttribute('data-stil') === stil));
    }
    stilButonlari.forEach(btn => {
        btn.addEventListener('click', () => {
            const stil = btn.getAttribute('data-stil');
            stiliUygula(stil);
            localStorage.setItem('kick_f5_btn_stil', stil);
        });
    });
    stiliUygula(localStorage.getItem('kick_f5_btn_stil') || 'glass');

    function hexToRgba(hex, alpha) {
        let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    let glowYuzde = parseInt(localStorage.getItem('kick_f5_glow_yuzde') || '40', 10);
    function gorunumuUygula(boyut, renk) {
        document.documentElement.style.setProperty('--f5-main-color', renk);
        document.documentElement.style.setProperty('--f5-glow-color', hexToRgba(renk, (glowYuzde / 100) * 0.8));
        fabBtn.style.width = boyut + 'px'; fabBtn.style.height = boyut + 'px'; boyutDeger.textContent = boyut + 'px';
        fabIcon.style.width = Math.round(boyut * 0.4) + 'px'; fabIcon.style.height = Math.round(boyut * 0.4) + 'px';
    }
    const kayitliBoyut = localStorage.getItem('kick_f5_btn_boyut') || '52';
    const kayitliRenk = localStorage.getItem('kick_f5_btn_renk') || '#53fc18';
    const temaButonlari = document.querySelectorAll('.f5-tema-btn');
    function temaVurgusunuGuncelle(renk) {
        temaButonlari.forEach(b => b.classList.toggle('active', b.getAttribute('data-color').toLowerCase() === renk.toLowerCase()));
    }
    boyutSlider.value = kayitliBoyut; renkSecici.value = kayitliRenk; gorunumuUygula(kayitliBoyut, kayitliRenk); temaVurgusunuGuncelle(kayitliRenk);
    boyutSlider.addEventListener('input', (e) => gorunumuUygula(e.target.value, renkSecici.value));
    boyutSlider.addEventListener('change', (e) => localStorage.setItem('kick_f5_btn_boyut', e.target.value));
    renkSecici.addEventListener('input', (e) => { gorunumuUygula(boyutSlider.value, e.target.value); temaVurgusunuGuncelle(e.target.value); });
    renkSecici.addEventListener('change', (e) => localStorage.setItem('kick_f5_btn_renk', e.target.value));
    temaButonlari.forEach(btn => {
        btn.addEventListener('click', () => {
            const r = btn.getAttribute('data-color');
            renkSecici.value = r;
            gorunumuUygula(boyutSlider.value, r);
            temaVurgusunuGuncelle(r);
            localStorage.setItem('kick_f5_btn_renk', r);
        });
    });

    const panelTemaButonlari = document.querySelectorAll('.f5-panel-tema-btn');
    let aktifOzelGradyanRenkleri = null;
    function panelTemaVurgusunuGuncelle(border, renk, ozelId) {
        document.querySelectorAll('.f5-panel-tema-btn').forEach(b => {
            if (ozelId) { b.classList.toggle('active', b.getAttribute('data-ozel-id') === ozelId); }
            else { b.classList.toggle('active', !b.hasAttribute('data-ozel-id') && b.getAttribute('data-panel-border') === border && (renk ? b.getAttribute('data-accent').toLowerCase() === renk.toLowerCase() : true)); }
        });
    }
    const panelOpaklikSlider = document.getElementById('f5-panel-opaklik-slider');
    const panelOpaklikDeger = document.getElementById('f5-panel-opaklik-deger');
    function rgbBileseniniAyristir(str) {
        const m = (str || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 22, g: 23, b: 27 };
    }
    function rgbaAlfasiniAyristir(str) {
        const m = (str || '').match(/rgba\([^)]*,\s*([\d.]+)\s*\)/);
        return m ? parseFloat(m[1]) : 0.92;
    }
    function hexToRgbParcalari(hex) {
        const h = (hex || '#161719').replace('#', '');
        const tam = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
        const sayi = parseInt(tam, 16) || 0x16171b;
        return { r: (sayi >> 16) & 255, g: (sayi >> 8) & 255, b: sayi & 255 };
    }
    function ozelGradyanOlustur(renkler, alpha) {
        const duraklar = renkler.map(hex => { const { r, g, b } = hexToRgbParcalari(hex); return `rgba(${r}, ${g}, ${b}, ${alpha})`; });
        return `linear-gradient(135deg, ${duraklar.join(', ')})`;
    }
    function panelOpakligiUygula(yuzde, kaydet) {
        if (aktifOzelGradyanRenkleri) {
            const yeniBg = ozelGradyanOlustur(aktifOzelGradyanRenkleri, (yuzde / 100).toFixed(2));
            document.documentElement.style.setProperty('--f5-panel-bg', yeniBg);
            panelOpaklikDeger.textContent = yuzde + '%';
            if (kaydet) localStorage.setItem('kick_f5_panel_bg', yeniBg);
            return;
        }
        const mevcutBg = getComputedStyle(document.documentElement).getPropertyValue('--f5-panel-bg') || 'rgba(22,23,27,0.92)';
        const { r, g, b } = rgbBileseniniAyristir(mevcutBg);
        const yeniBg = `rgba(${r}, ${g}, ${b}, ${(yuzde / 100).toFixed(2)})`;
        document.documentElement.style.setProperty('--f5-panel-bg', yeniBg);
        panelOpaklikDeger.textContent = yuzde + '%';
        if (kaydet) localStorage.setItem('kick_f5_panel_opaklik', yuzde);
    }
    panelOpaklikSlider.addEventListener('input', (e) => panelOpakligiUygula(parseInt(e.target.value, 10), false));
    panelOpaklikSlider.addEventListener('change', (e) => { const y = parseInt(e.target.value, 10); panelOpakligiUygula(y, true); localStorage.setItem('kick_f5_panel_opaklik', y); });

    function panelTemasiUygula(bg, border, renk, kaydet) {
        aktifOzelGradyanRenkleri = null;
        document.documentElement.style.setProperty('--f5-panel-bg', bg);
        document.documentElement.style.setProperty('--f5-panel-border', border);
        panelOpakligiUygula(parseInt(panelOpaklikSlider.value, 10) || 92, false);
        renkSecici.value = renk;
        gorunumuUygula(boyutSlider.value, renk);
        temaVurgusunuGuncelle(renk);
        panelTemaVurgusunuGuncelle(border, renk, null);
        if (kaydet) {
            localStorage.setItem('kick_f5_panel_bg', getComputedStyle(document.documentElement).getPropertyValue('--f5-panel-bg').trim());
            localStorage.setItem('kick_f5_panel_border', border);
            localStorage.setItem('kick_f5_btn_renk', renk);
            localStorage.removeItem('kick_f5_aktif_ozel_tema');
        }
    }
    panelTemaButonlari.forEach(btn => {
        btn.addEventListener('click', () => {
            panelTemasiUygula(btn.getAttribute('data-panel-bg'), btn.getAttribute('data-panel-border'), btn.getAttribute('data-accent'), true);
        });
    });

    const OZEL_TEMA_ANAHTARI = 'kick_f5_ozel_temalar';
    function ozelTemalariGetir() { try { return JSON.parse(localStorage.getItem(OZEL_TEMA_ANAHTARI) || '[]'); } catch (e) { return []; } }
    function ozelTemalariKaydet(liste) { localStorage.setItem(OZEL_TEMA_ANAHTARI, JSON.stringify(liste)); }
    function ozelTemayiUygula(tema, kaydet) {
        aktifOzelGradyanRenkleri = tema.renkler;
        const alpha = ((parseInt(panelOpaklikSlider.value, 10) || 92) / 100).toFixed(2);
        const bg = ozelGradyanOlustur(tema.renkler, alpha);
        const { r, g, b } = hexToRgbParcalari(tema.accent);
        const border = `rgba(${r}, ${g}, ${b}, 0.5)`;
        document.documentElement.style.setProperty('--f5-panel-bg', bg);
        document.documentElement.style.setProperty('--f5-panel-border', border);
        renkSecici.value = tema.accent;
        gorunumuUygula(boyutSlider.value, tema.accent);
        temaVurgusunuGuncelle(tema.accent);
        panelTemaVurgusunuGuncelle(null, tema.accent, tema.id);
        if (kaydet) {
            localStorage.setItem('kick_f5_panel_bg', bg);
            localStorage.setItem('kick_f5_panel_border', border);
            localStorage.setItem('kick_f5_btn_renk', tema.accent);
            localStorage.setItem('kick_f5_aktif_ozel_tema', tema.id);
        }
    }
    const ozelTemalarimGrid = document.getElementById('f5-ozel-temalarim-grid');
    const ozelTemalarimBos = document.getElementById('f5-ozel-temalarim-bos');
    function ozelTemalarimGridiOlustur() {
        const liste = ozelTemalariGetir();
        ozelTemalarimGrid.innerHTML = '';
        ozelTemalarimBos.style.display = liste.length ? 'none' : 'block';
        liste.forEach(tema => {
            const btn = document.createElement('button');
            btn.className = 'f5-panel-tema-btn f5-ozel-tema-btn f5-ripple-btn';
            btn.setAttribute('data-ozel-id', tema.id);
            btn.setAttribute('data-accent', tema.accent);
            const silRozeti = document.createElement('span');
            silRozeti.className = 'f5-ozel-tema-sil';
            silRozeti.title = t('ozel_tema_sil_baslik');
            silRozeti.textContent = '✕';
            silRozeti.addEventListener('click', async (e) => {
                e.stopPropagation();
                const guncelListe = ozelTemalariGetir();
                const hedef = guncelListe.find(x => x.id === tema.id);
                if (!hedef) return;
                const onaylandi = await ozelOnayGoster(t('ozel_tema_sil_confirm').replace('{isim}', hedef.ad));
                if (!onaylandi) return;
                const yeniListe = guncelListe.filter(x => x.id !== tema.id);
                ozelTemalariKaydet(yeniListe);
                if (localStorage.getItem('kick_f5_aktif_ozel_tema') === tema.id) localStorage.removeItem('kick_f5_aktif_ozel_tema');
                if (yeniListe.length === 0) panelTemasiUygula('rgba(22,23,27,0.92)', 'rgba(255,255,255,0.18)', '#e2e2e2', true);
                ozelTemalarimGridiOlustur();
            });
            const onizleme = document.createElement('div');
            onizleme.className = 'f5-panel-onizleme';
            onizleme.style.background = `linear-gradient(135deg, ${tema.renkler.join(', ')})`;
            onizleme.style.borderColor = tema.accent;
            const adEtiketi = document.createElement('span');
            adEtiketi.className = 'f5-panel-ad';
            adEtiketi.textContent = tema.ad;
            btn.append(silRozeti, onizleme, adEtiketi);
            btn.addEventListener('click', (e) => { if (!e.target.closest('.f5-ozel-tema-sil')) ozelTemayiUygula(tema, true); });
            ozelTemalarimGrid.appendChild(btn);
        });
    }
    const renk1Input = document.getElementById('f5-ozel-renk-1');
    const renk2Input = document.getElementById('f5-ozel-renk-2');
    const renk3Input = document.getElementById('f5-ozel-renk-3');
    const renk3Temizle = document.getElementById('f5-ozel-renk-3-temizle');
    const ozelOnizleme = document.getElementById('f5-ozel-tema-onizleme');
    const ozelIsimInput = document.getElementById('f5-ozel-tema-isim');
    const ozelKaydetBtn = document.getElementById('f5-ozel-tema-kaydet');
    const ozelHataEl = document.getElementById('f5-ozel-tema-hata');
    let renk3Aktif = true;
    function ozelOnizlemeyiGuncelle() {
        const renkler = [renk1Input.value, renk2Input.value];
        if (renk3Aktif) renkler.push(renk3Input.value);
        ozelOnizleme.style.background = `linear-gradient(135deg, ${renkler.join(', ')})`;
    }
    [renk1Input, renk2Input, renk3Input].forEach(inp => inp.addEventListener('input', ozelOnizlemeyiGuncelle));
    renk3Temizle.addEventListener('click', () => {
        renk3Aktif = !renk3Aktif;
        renk3Input.style.opacity = renk3Aktif ? '1' : '0.25';
        renk3Temizle.textContent = renk3Aktif ? '✕' : '+';
        ozelOnizlemeyiGuncelle();
    });
    ozelKaydetBtn.addEventListener('click', () => {
        const isim = ozelIsimInput.value.trim();
        ozelHataEl.textContent = '';
        if (!isim) { ozelHataEl.textContent = t('ozel_tema_isim_bos'); return; }
        const mevcutListe = ozelTemalariGetir();
        if (mevcutListe.some(x => x.ad.toLowerCase() === isim.toLowerCase())) { ozelHataEl.textContent = t('ozel_tema_isim_var'); return; }
        if (mevcutListe.length >= 12) { ozelHataEl.textContent = t('ozel_tema_limit'); return; }
        const renkler = [renk1Input.value, renk2Input.value];
        if (renk3Aktif) renkler.push(renk3Input.value);
        const yeniTema = { id: 'ozel_' + Date.now().toString(36), ad: isim, renkler, accent: renkler[renkler.length - 1] };
        mevcutListe.push(yeniTema);
        ozelTemalariKaydet(mevcutListe);
        ozelIsimInput.value = '';
        ozelTemalarimGridiOlustur();
        ozelTemayiUygula(yeniTema, true);
    });
    ozelOnizlemeyiGuncelle();
    ozelTemalarimGridiOlustur();

    const kayitliPanelBg = localStorage.getItem('kick_f5_panel_bg');
    const kayitliPanelBorder = localStorage.getItem('kick_f5_panel_border');
    if (kayitliPanelBg && kayitliPanelBorder) {
        document.documentElement.style.setProperty('--f5-panel-bg', kayitliPanelBg);
        document.documentElement.style.setProperty('--f5-panel-border', kayitliPanelBorder);
        panelTemaVurgusunuGuncelle(kayitliPanelBorder, kayitliRenk, null);
    }
    const kayitliOzelTemaId = localStorage.getItem('kick_f5_aktif_ozel_tema');
    if (kayitliOzelTemaId) {
        const bulunanOzelTema = ozelTemalariGetir().find(x => x.id === kayitliOzelTemaId);
        if (bulunanOzelTema) { aktifOzelGradyanRenkleri = bulunanOzelTema.renkler; panelTemaVurgusunuGuncelle(null, bulunanOzelTema.accent, bulunanOzelTema.id); }
    }
    const kayitliOpaklik = localStorage.getItem('kick_f5_panel_opaklik');
    const baslangicOpaklik = kayitliOpaklik ? parseInt(kayitliOpaklik, 10) : Math.round(rgbaAlfasiniAyristir(kayitliPanelBg) * 100);
    panelOpaklikSlider.value = baslangicOpaklik;
    panelOpakligiUygula(baslangicOpaklik, false);

    const glowSlider = document.getElementById('f5-glow-slider');
    const glowDeger = document.getElementById('f5-glow-deger');
    glowSlider.value = glowYuzde; glowDeger.textContent = glowYuzde + '%';
    glowSlider.addEventListener('input', (e) => { glowYuzde = parseInt(e.target.value, 10); glowDeger.textContent = glowYuzde + '%'; gorunumuUygula(boyutSlider.value, renkSecici.value); });
    glowSlider.addEventListener('change', (e) => localStorage.setItem('kick_f5_glow_yuzde', e.target.value));

    const toggleAnim = document.getElementById('f5-toggle-anim');
    const toggleBadge = document.getElementById('f5-toggle-badge');
    const toggleTension = document.getElementById('f5-toggle-tension');
    const toggleKenarlik = document.getElementById('f5-toggle-kenarlik');
    const toggleGurultu = document.getElementById('f5-toggle-gurultu');
    let iconAnimAcik = localStorage.getItem('kick_f5_icon_anim') !== 'kapali';
    let rozetHerZaman = localStorage.getItem('kick_f5_badge_always') === 'acik';
    let tensionAcik = localStorage.getItem('kick_f5_tension') !== 'kapali';
    let kenarlikAcik = localStorage.getItem('kick_f5_kenarlik') !== 'kapali';
    let gurultuEngelleyiciAcik = localStorage.getItem('kick_f5_gurultu_engelleyici') !== 'kapali';
    toggleAnim.checked = iconAnimAcik; toggleBadge.checked = rozetHerZaman; toggleTension.checked = tensionAcik; toggleKenarlik.checked = kenarlikAcik; toggleGurultu.checked = gurultuEngelleyiciAcik;
    document.documentElement.classList.toggle('f5-anim-kapali', !iconAnimAcik);
    modal.classList.toggle('f5-kenarlik-kapali', !kenarlikAcik);
    if (rozetHerZaman && !zamanlayiciKontrol) { fabBadge.style.display = 'block'; fabBadge.textContent = t('durum_kapali'); }
    toggleAnim.addEventListener('change', (e) => {
        iconAnimAcik = e.target.checked; localStorage.setItem('kick_f5_icon_anim', iconAnimAcik ? 'acik' : 'kapali');
        if (!iconAnimAcik) fabBtn.classList.remove('f5-animasyon-aktif'); else if (zamanlayiciKontrol) fabBtn.classList.add('f5-animasyon-aktif');
    });
    toggleBadge.addEventListener('change', (e) => {
        rozetHerZaman = e.target.checked; localStorage.setItem('kick_f5_badge_always', rozetHerZaman ? 'acik' : 'kapali');
        if (!zamanlayiciKontrol) { fabBadge.style.display = rozetHerZaman ? 'block' : 'none'; if (rozetHerZaman) fabBadge.textContent = t('durum_kapali'); }
    });
    toggleTension.addEventListener('change', (e) => {
        tensionAcik = e.target.checked; localStorage.setItem('kick_f5_tension', tensionAcik ? 'acik' : 'kapali');
        if (!tensionAcik) { fabBtn.classList.remove('f5-tension'); modal.classList.remove('f5-tension-active'); }
    });
    toggleKenarlik.addEventListener('change', (e) => {
        kenarlikAcik = e.target.checked; localStorage.setItem('kick_f5_kenarlik', kenarlikAcik ? 'acik' : 'kapali');
        modal.classList.toggle('f5-kenarlik-kapali', !kenarlikAcik);
    });
    toggleGurultu.addEventListener('change', (e) => {
        gurultuEngelleyiciAcik = e.target.checked; localStorage.setItem('kick_f5_gurultu_engelleyici', gurultuEngelleyiciAcik ? 'acik' : 'kapali');
        if (typeof gurultuEngelleyiciDurumunuUygula === 'function') gurultuEngelleyiciDurumunuUygula();
    });

    const AYAR_ANAHTAR_ONEKI = 'kick_f5_';
    const ioMesajEl = document.getElementById('f5-io-mesaj');
    let ioMesajZamanlayici = null;
    function ioMesajGoster(metin, tip) {
        if (!ioMesajEl) return;
        ioMesajEl.textContent = metin;
        ioMesajEl.className = 'f5-io-msg f5-io-msg-show ' + (tip === 'ok' ? 'f5-io-ok' : 'f5-io-err');
        if (ioMesajZamanlayici) clearTimeout(ioMesajZamanlayici);
        ioMesajZamanlayici = setTimeout(() => { ioMesajEl.classList.remove('f5-io-msg-show'); }, 3500);
    }
    document.getElementById('f5-disa-aktar').addEventListener('click', () => {
        try {
            const ayarlar = {};
            for (let i = 0; i < localStorage.length; i++) {
                const anahtar = localStorage.key(i);
                if (anahtar && anahtar.indexOf(AYAR_ANAHTAR_ONEKI) === 0) ayarlar[anahtar] = localStorage.getItem(anahtar);
            }
            const disaAktarim = { tur: 'kick-f5-pro-ayarlar', surum: 1, tarih: new Date().toISOString(), ayarlar };
            const blob = new Blob([JSON.stringify(disaAktarim, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `kick-f5-ayarlar-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            ioMesajGoster(t('io_disa_ok'), 'ok');
        } catch (e) { ioMesajGoster(t('io_disa_err'), 'err'); }
    });
    const iceAktarDosyaInput = document.getElementById('f5-ice-aktar-dosya');
    document.getElementById('f5-ice-aktar').addEventListener('click', () => iceAktarDosyaInput.click());
    iceAktarDosyaInput.addEventListener('change', (e) => {
        const dosya = e.target.files && e.target.files[0];
        if (!dosya) return;
        const okuyucu = new FileReader();
        okuyucu.onload = () => {
            try {
                const veri = JSON.parse(okuyucu.result);
                const ayarlar = veri && veri.ayarlar && typeof veri.ayarlar === 'object' ? veri.ayarlar : veri;
                let sayac = 0;
                Object.keys(ayarlar).forEach((anahtar) => {
                    if (anahtar.indexOf(AYAR_ANAHTAR_ONEKI) === 0 && typeof ayarlar[anahtar] === 'string') {
                        localStorage.setItem(anahtar, ayarlar[anahtar]); sayac++;
                    }
                });
                if (sayac === 0) throw new Error();
                ioMesajGoster(t('io_ice_ok').replace('{sayac}', sayac), 'ok');
                setTimeout(() => location.reload(), 900);
            } catch (err) { ioMesajGoster(t('io_ice_err'), 'err'); }
            finally { iceAktarDosyaInput.value = ''; }
        };
        okuyucu.readAsText(dosya);
    });
    document.getElementById('f5-ayar-sifirla').addEventListener('click', async () => {
        const onaylandi = await ozelOnayGoster(t('confirm_sifirla_mesaj'));
        if (!onaylandi) return;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const anahtar = localStorage.key(i);
            if (anahtar && anahtar.indexOf(AYAR_ANAHTAR_ONEKI) === 0) localStorage.removeItem(anahtar);
        }
        location.reload();
    });

    const zilMesajEl = document.getElementById('f5-zil-mesaj');
    let zilMesajZamanlayici = null;
    function zilMesajGoster(metin, tip) {
        if (!zilMesajEl) return;
        zilMesajEl.textContent = metin;
        zilMesajEl.className = 'f5-io-msg f5-io-msg-show ' + (tip === 'ok' ? 'f5-io-ok' : 'f5-io-err');
        if (zilMesajZamanlayici) clearTimeout(zilMesajZamanlayici);
        zilMesajZamanlayici = setTimeout(() => { zilMesajEl.classList.remove('f5-io-msg-show'); }, 3500);
    }
    const zilDosyaInputEl = document.getElementById('f5-zil-dosya-input');
    if (zilDosyaInputEl) {
        zilDosyaInputEl.addEventListener('change', (e) => {
            const dosya = e.target.files && e.target.files[0];
            if (!dosya) return;
            ozelZilDosyaYukle(dosya).then(() => {
                seciliZilAyarla('custom');
                zilListesiRenderla();
            }).catch((hata) => {
                if (hata === 'sure') zilMesajGoster(t('zil_hata_sure'), 'err');
                else zilMesajGoster(t('zil_hata_format'), 'err');
            }).finally(() => { zilDosyaInputEl.value = ''; });
        });
    }
    zilListesiRenderla();

    let kayitliX = localStorage.getItem('kick_f5_btn_x');
    let kayitliY = localStorage.getItem('kick_f5_btn_y');
    let kayitliKonum = localStorage.getItem('kick_f5_btn_konum');
    function imlecDurumunuGuncelle(k) {
        if (k === 'custom') { fabBtn.classList.add('f5-draggable'); tooltipText = t('tooltip_surukle'); }
        else { fabBtn.classList.remove('f5-draggable'); tooltipText = t('tooltip_varsayilan'); }
    }
    function konumuAyarlaVeKoru(x, y) {
        const b = parseInt(boyutSlider.value), mx = window.innerWidth - b, my = window.innerHeight - b;
        x = Math.max(0, Math.min(x, mx)); y = Math.max(0, Math.min(y, my));
        fabBtn.style.left = x + 'px'; fabBtn.style.top = y + 'px'; fabBtn.style.bottom = 'auto'; fabBtn.style.right = 'auto';
    }
    function konumaSabitle(k) {
        const b = parseInt(boyutSlider.value), p = 20, mx = window.innerWidth - b, my = window.innerHeight - b; let x, y;
        if (k === 'br') { x = mx - p; y = my - p; } else if (k === 'bl') { x = p; y = my - p; } else if (k === 'tr') { x = mx - p; y = p; } else if (k === 'tl') { x = p; y = p; }
        if (x !== undefined) konumuAyarlaVeKoru(x, y);
    }
    konumSecici.addEventListener('change', (e) => {
        const s = e.target.value; localStorage.setItem('kick_f5_btn_konum', s); imlecDurumunuGuncelle(s);
        if (s !== 'custom') konumaSabitle(s); else if (kayitliX !== null && kayitliY !== null) konumuAyarlaVeKoru(parseInt(kayitliX), parseInt(kayitliY));
    });
    if (kayitliKonum) { konumSecici.value = kayitliKonum; imlecDurumunuGuncelle(kayitliKonum); if (kayitliKonum !== 'custom') konumaSabitle(kayitliKonum); else if (kayitliX !== null && kayitliY !== null) konumuAyarlaVeKoru(parseInt(kayitliX), parseInt(kayitliY)); }
    else { konumSecici.value = 'br'; konumaSabitle('br'); }
    window.addEventListener('resize', () => { if (konumSecici.value !== 'custom') konumaSabitle(konumSecici.value); });

    let surukleniyor = false;
    let yerDegistirdi = false;
    let baslangicX, baslangicY, btnBaslangicX, btnBaslangicY;
    fabBtn.addEventListener('mousedown', (e) => {
        if (konumSecici.value !== 'custom') return;
        surukleniyor = true; yerDegistirdi = false; baslangicX = e.clientX; baslangicY = e.clientY;
        const rect = fabBtn.getBoundingClientRect(); btnBaslangicX = rect.left; btnBaslangicY = rect.top; fabBtn.style.transition = 'none'; tooltip.style.opacity = '0';
    });
    document.addEventListener('mousemove', (e) => {
        if (!surukleniyor) return;
        const farkX = e.clientX - baslangicX, farkY = e.clientY - baslangicY;
        if (Math.abs(farkX) > 3 || Math.abs(farkY) > 3) yerDegistirdi = true;
        if (yerDegistirdi) konumuAyarlaVeKoru(btnBaslangicX + farkX, btnBaslangicY + farkY);
    });
    document.addEventListener('mouseup', () => {
        if (surukleniyor) {
            surukleniyor = false; fabBtn.style.transition = 'transform 0.3s, left 0.3s, top 0.3s';
            if (yerDegistirdi) {
                let rect = fabBtn.getBoundingClientRect();
                localStorage.setItem('kick_f5_btn_x', rect.left);
                localStorage.setItem('kick_f5_btn_y', rect.top);
            }
        }
    });

    function modalToggle() { modal.style.display = modal.style.display === 'block' ? 'none' : 'block'; tooltip.style.opacity = '0'; }
    fabBtn.addEventListener('click', () => { if (!yerDegistirdi) modalToggle(); });
    document.getElementById('f5-kapat').addEventListener('click', (e) => {
        e.stopPropagation();
        modal.style.display = 'none';
    });

    // ==================== KRİTİK: MERKEZİ DOCUMENT CLICK HANDLER ====================
    document.addEventListener('click', (e) => {
        f5PluginRootGaranti();
        if (f5AltModalAcikMi()) return;
        const imageModalEl = document.getElementById('f5-image-modal');
        if (imageModalEl && imageModalEl.classList.contains('show')) {
            if (!imageModalEl.contains(e.target)) {
                imageModalEl.classList.remove('show');
                const imgEl = document.getElementById('f5-image-modal-img');
                if (imgEl) imgEl.src = '';
            }
            return;
        }
        const confirmEl = document.getElementById('f5-confirm-modal');
        if (confirmEl && confirmEl.classList.contains('f5-confirm-show')) return;
        const blSec = document.getElementById('f5-beyaz-liste-sec-modal');
        if (blSec && blSec.style.display === 'flex') {
            if (!blSec.contains(e.target)) blSec.style.display = 'none';
            return;
        }
        const reactionPicker = document.querySelector('.f5-reaction-picker');
        if (reactionPicker && !reactionPicker.contains(e.target)) reactionPicker.remove();
        const optMenu = document.getElementById('f5-chat-options-menu');
        const optBtn = document.getElementById('f5-chat-options-toggle');
        if (optMenu && optMenu.classList.contains('show') && !optMenu.contains(e.target) && e.target !== optBtn) {
            optMenu.classList.remove('show');
        }
        if (modal.style.display === 'block') {
            if (modal.contains(e.target)) return;
            if (fabBtn.contains(e.target)) return;
            modal.style.display = 'none';
        }
    });

    const tusAtamaBtn = document.getElementById('f5-tus-atama-btn');
    const seriTusSpan = document.getElementById('f5-seri-tus-span');
    let tusAtamaBekleniyor = false;
    function tusGosterimGuncelle() {
        const g = 'ALT + ' + durdurmaTusu.toUpperCase();
        if (tusAtamaBtn) tusAtamaBtn.textContent = g;
        if (seriTusSpan) seriTusSpan.textContent = g;
    }
    if (tusAtamaBtn) {
        tusAtamaBtn.addEventListener('click', () => { tusAtamaBekleniyor = true; tusAtamaBtn.textContent = t('tus_dinleniyor'); });
    }
    document.addEventListener('keydown', (e) => {
        if (tusAtamaBekleniyor) {
            const yeniTus = e.key.toLowerCase();
            if (yeniTus === 'escape') { tusAtamaBekleniyor = false; tusGosterimGuncelle(); return; }
            if (['alt', 'control', 'shift', 'meta', 'tab'].includes(yeniTus)) return;
            e.preventDefault();
            durdurmaTusu = yeniTus;
            localStorage.setItem('kick_f5_stop_tus', durdurmaTusu);
            tusAtamaBekleniyor = false;
            tusGosterimGuncelle();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === durdurmaTusu) {
            e.preventDefault();
            if (zamanlayiciKontrol) { sayaciKapat(); toastGoster(t('acil_fren_mesaj'), 'uyari'); }
        }
    });

    function sayaciKapat() {
        if (zamanlayiciKontrol) { clearInterval(zamanlayiciKontrol); zamanlayiciKontrol = null; }
        ['kick_f5_aktif_hedef', 'kick_f5_hedef_metin', 'kick_f5_baslangic_zaman', 'kick_f5_seri_sure'].forEach(k => localStorage.removeItem(k));
        btnBaslat.textContent = t('btn_baslat'); btnBaslat.classList.remove('f5-btn-secondary'); btnBaslat.classList.add('f5-btn-primary');
        btnBaslat.style.backgroundColor = 'var(--f5-main-color)'; btnBaslat.style.color = '#000';
        durumMetni.textContent = t('durum_kapali'); durumMetni.style.color = '#ff4c4c'; hedefZamanMetni.textContent = '-';
        fabBtn.classList.remove('f5-animasyon-aktif', 'f5-tension'); modal.classList.remove('f5-tension-active');
        geriSayimKutusu.style.display = 'none'; progressRing.style.strokeDashoffset = '289.026';
        if (rozetHerZaman) { fabBadge.style.display = 'block'; fabBadge.textContent = t('durum_kapali'); } else { fabBadge.style.display = 'none'; }
    }

    function sayaciBaslat(hedefEpoch, metinGosterim, baslangicEpoch, hizliMod = false) {
        if (zamanlayiciKontrol) clearInterval(zamanlayiciKontrol);
        if (!baslangicEpoch) baslangicEpoch = Date.now();
        localStorage.setItem('kick_f5_aktif_hedef', hedefEpoch);
        localStorage.setItem('kick_f5_hedef_metin', metinGosterim);
        localStorage.setItem('kick_f5_baslangic_zaman', baslangicEpoch);
        durumMetni.textContent = t('durum_aktif'); durumMetni.style.color = 'var(--f5-main-color)'; hedefZamanMetni.textContent = metinGosterim;
        if (iconAnimAcik) fabBtn.classList.add('f5-animasyon-aktif');
        btnBaslat.textContent = t('btn_durdur'); btnBaslat.classList.remove('f5-btn-primary'); btnBaslat.style.backgroundColor = '#ff4c4c'; btnBaslat.style.color = '#fff';
        if (!hizliMod) { geriSayimKutusu.style.display = 'block'; fabBadge.style.display = 'block'; }
        const toplamSure = hedefEpoch - baslangicEpoch;
        const donguHizi = hizliMod ? 50 : 1000;
        zamanlayiciKontrol = setInterval(() => {
            const fark = hedefEpoch - Date.now();
            if (fark <= 0) {
                clearInterval(zamanlayiciKontrol);
                if (hizliMod) {
                    const sSure = parseFloat(localStorage.getItem('kick_f5_seri_sure'));
                    localStorage.setItem('kick_f5_aktif_hedef', Date.now() + (sSure * 1000));
                    localStorage.setItem('kick_f5_baslangic_zaman', Date.now());
                } else {
                    ['kick_f5_aktif_hedef', 'kick_f5_hedef_metin', 'kick_f5_baslangic_zaman'].forEach(k => localStorage.removeItem(k));
                }
                puanEkleVeYenile(); return;
            }
            if (!hizliMod) {
                if (tensionAcik && fark <= 10000) { fabBtn.classList.add('f5-tension'); modal.classList.add('f5-tension-active'); }
                else { fabBtn.classList.remove('f5-tension'); modal.classList.remove('f5-tension-active'); }
                let yuzdeKalan = Math.max(0, (fark / toplamSure) * 100);
                progressRing.style.strokeDashoffset = 289.026 - (289.026 * yuzdeKalan / 100);
                const s = Math.floor((fark / 1000) % 60), m = Math.floor((fark / 60000) % 60), h = Math.floor((fark / 3600000) % 24);
                const format = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                geriSayimMetni.textContent = format; fabBadge.textContent = format;
            }
        }, donguHizi);
    }

    btnBaslat.addEventListener('click', () => {
        if (zamanlayiciKontrol) { sayaciKapat(); return; }
        const hata = document.getElementById('f5-hata-metni'); let hedefEpoch = 0, hedefMetin = '', seriMod = false;
        if (aktifMod === 'saat') {
            const h = parseInt(document.getElementById('f5-saat').value, 10), m = parseInt(document.getElementById('f5-dakika').value, 10);
            let s = parseInt(document.getElementById('f5-saniye').value, 10);
            if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) { hata.style.display = 'block'; return; }
            hata.style.display = 'none'; if (isNaN(s) || s < 0 || s > 59) s = 0;
            const hZ = new Date(); hZ.setHours(h, m, s, 0); if (hZ.getTime() <= Date.now()) hZ.setDate(hZ.getDate() + 1);
            hedefEpoch = hZ.getTime(); hedefMetin = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        } else if (aktifMod === 'aralik') {
            const dk = parseInt(document.getElementById('f5-aralik-dakika').value, 10);
            if (isNaN(dk) || dk <= 0) { hata.style.display = 'block'; return; }
            hata.style.display = 'none'; hedefEpoch = Date.now() + (dk * 60000);
            const hT = new Date(hedefEpoch); hedefMetin = `+${dk}${t('dk_kisa')} (${String(hT.getHours()).padStart(2,'0')}:${String(hT.getMinutes()).padStart(2,'0')})`;
        } else if (aktifMod === 'seri') {
            const sn = parseFloat(document.getElementById('f5-seri-saniye').value);
            if (isNaN(sn) || sn < 0.1) { hata.style.display = 'block'; return; }
            hata.style.display = 'none'; hedefEpoch = Date.now() + (sn * 1000);
            hedefMetin = `Spam: ${sn}s`; seriMod = true; localStorage.setItem('kick_f5_seri_sure', sn);
        }
        streakGuncelle();
        const streakEl = document.getElementById('f5-streak-alani');
        if (streakEl) streakEl.innerHTML = streakHtmlUret();
        sayaciBaslat(hedefEpoch, hedefMetin, Date.now(), seriMod);
    });

    btnSifirla.addEventListener('click', () => { sayaciKapat(); document.getElementById('f5-hata-metni').style.display = 'none'; });

    const kHedef = localStorage.getItem('kick_f5_aktif_hedef');
    const kMetin = localStorage.getItem('kick_f5_hedef_metin');
    const kBaslangic = localStorage.getItem('kick_f5_baslangic_zaman');
    const kSeri = localStorage.getItem('kick_f5_seri_sure');
    if (kHedef && kMetin && kBaslangic) {
        const isSeri = kSeri !== null;
        if (parseInt(kHedef, 10) > Date.now()) sayaciBaslat(parseInt(kHedef, 10), kMetin, parseInt(kBaslangic, 10), isSeri);
        else if (isSeri) sayaciBaslat(Date.now() + (parseFloat(kSeri) * 1000), kMetin, Date.now(), true);
        else sayaciKapat();
    }

    const GIPHY_API_KEY = 'ba7FVbWFEJ2qjsc4r8gxKkpSPGQPMREv';
    const GIPHY_RATING = 'pg-13';

    const firebaseConfig = {
        apiKey: "AIzaSyDL6IqblDi-iXekfr22mX31DgxRvUOtqE0",
        authDomain: "kick-f5-araci.firebaseapp.com",
        databaseURL: "https://kick-f5-araci-default-rtdb.firebaseio.com",
        projectId: "kick-f5-araci"
    };

    let db = null;
    try {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        db = firebase.database();
    } catch (e) {
        console.error('[Kick F5] Firebase bağlantı hatası:', e);
    }

    let mevcutKullaniciAdi = localStorage.getItem('kick_f5_manuel_nick') || null;
    let mevcutAvatarUrl = null;
    let tumAktifKullanicilar = [];
    let aktifOdaId = null;
    let aktifOdaListener = null;
    let aktifYazmaListener = null;
    let yazmaTimeoutId = null;
    let sonYazmaGonderim = 0;
    let engellenenKisiler = JSON.parse(localStorage.getItem('kick_f5_engellenenler') || '[]');
    let okunmayanOdalar = {};
    let mesajCache = {};
    let yanitlananMesaj = null;
    let duzenlenenMesajKey = null;
    let aktifOdaAdminler = {};
    let aktifOdaKurucu = null;
    let aktifOdaMetaListener = null;
    let duzenlenenAdminlerGecici = {};

    function benAdminMiyim() {
        if (!mevcutKullaniciAdi) return false;
        return Object.values(aktifOdaAdminler || {}).includes(mevcutKullaniciAdi);
    }

    let enEskiMesajKey = null;
    let tumEskiMesajlarYuklendi = false;
    const SAYFA_BASI_MESAJ = 30;
    let bekleyenOkunduMesajlari = {};

    function sekmeGorunurMu() {
        return !document.hidden && document.hasFocus();
    }
    function bekleyenOkunduMesajlariniIsle() {
        if (!db || !aktifOdaId || !mevcutKullaniciAdi) return;
        const bekleyenler = bekleyenOkunduMesajlari[aktifOdaId];
        if (!bekleyenler || bekleyenler.length === 0) return;
        bekleyenler.forEach(msgKey => {
            db.ref(`mesajlar/${aktifOdaId}/${msgKey}/okunduDurumu/${mevcutKullaniciAdi}`).set(true);
        });
        bekleyenOkunduMesajlari[aktifOdaId] = [];
    }
    document.addEventListener('visibilitychange', () => { if (sekmeGorunurMu()) bekleyenOkunduMesajlariniIsle(); });
    window.addEventListener('focus', () => { if (sekmeGorunurMu()) bekleyenOkunduMesajlariniIsle(); });

    let sessizeAlinanlar = {};
    let rawSessiz = localStorage.getItem('kick_f5_sessiz_odalar');
    if (rawSessiz) {
        try {
            let parsed = JSON.parse(rawSessiz);
            if (Array.isArray(parsed)) {
                parsed.forEach(id => { sessizeAlinanlar[id] = -1; });
                localStorage.setItem('kick_f5_sessiz_odalar', JSON.stringify(sessizeAlinanlar));
            } else { sessizeAlinanlar = parsed; }
        } catch(e) { sessizeAlinanlar = {}; }
    }
    function sessizKaydet() { localStorage.setItem('kick_f5_sessiz_odalar', JSON.stringify(sessizeAlinanlar)); }
    function engelKaydet() { localStorage.setItem('kick_f5_engellenenler', JSON.stringify(engellenenKisiler)); }
    function isMuted(odaId) {
        if (!sessizeAlinanlar[odaId]) return false;
        if (sessizeAlinanlar[odaId] === -1) return true;
        if (Date.now() < sessizeAlinanlar[odaId]) return true;
        delete sessizeAlinanlar[odaId];
        sessizKaydet();
        return false;
    }
    function okunmayanBildirimGuncelle() {
        let toplam = 0;
        Object.keys(okunmayanOdalar).forEach(id => {
            if (!isMuted(id)) toplam += okunmayanOdalar[id];
            else okunmayanOdalar[id] = 0;
        });
        if (toplam > 0) {
            unreadBadge.textContent = toplam > 99 ? '99+' : toplam;
            unreadBadge.classList.add('show');
        } else {
            unreadBadge.classList.remove('show');
        }
    }

    async function aktifKullaniciAdiniAl() {
        const kayitliNick = localStorage.getItem('kick_f5_manuel_nick');
        let avatar = null;
        try {
            const yanit = await fetch('/api/v1/user', { credentials: 'include', headers: { 'Accept': 'application/json' } });
            if (yanit.ok) {
                const veri = await yanit.json();
                avatar = veri?.profile_pic || veri?.profilePic || null;
                const ad = veri?.username || veri?.user?.username || veri?.name;
                if (ad && ad.trim()) {
                    localStorage.setItem('kick_f5_manuel_nick', ad);
                    return { ad, avatar };
                }
            }
        } catch (e) {}
        const seciciler = [
            'button[aria-haspopup="menu"] img[alt]',
            'nav button img[alt]',
            '[data-testid="user-avatar"] img',
            'img[alt*="avatar" i]',
            '.user-avatar img',
            'header img[alt]'
        ];
        for (const s of seciciler) {
            const el = document.querySelector(s);
            if (el) {
                const ad = el.getAttribute('alt') || el.getAttribute('title');
                if (ad && ad.length > 1 && !ad.toLowerCase().includes('avatar') && !ad.toLowerCase().includes('profile')) {
                    localStorage.setItem('kick_f5_manuel_nick', ad);
                    return { ad, avatar: el.getAttribute('src') || avatar };
                }
            }
        }
        if (kayitliNick && kayitliNick.trim()) return { ad: kayitliNick.trim(), avatar };
        const girilen = prompt("Kick kullanıcı adınız tespit edilemedi. Lütfen kullanıcı adınızı girin:");
        if (girilen && girilen.trim()) {
            localStorage.setItem('kick_f5_manuel_nick', girilen.trim());
            return { ad: girilen.trim(), avatar };
        }
        const varsayilan = 'KickUser_' + Math.floor(Math.random() * 899 + 100);
        localStorage.setItem('kick_f5_manuel_nick', varsayilan);
        return { ad: varsayilan, avatar };
    }

    const roomsListEl = document.getElementById('f5-chat-rooms');
    const messagesEl = document.getElementById('f5-chat-messages');
    const chatInputBox = document.getElementById('f5-chat-input-box');
    const chatInput = document.getElementById('f5-chat-input');
    const chatSendBtn = document.getElementById('f5-chat-send');
    const chatClearHint = document.getElementById('f5-chat-clear-hint');
    const chatReplyEditPreview = document.getElementById('f5-chat-reply-edit-preview');
    const chatReplyEditPreviewLabel = document.getElementById('f5-chat-reply-edit-preview-label');
    const chatReplyEditPreviewText = document.getElementById('f5-chat-reply-edit-preview-text');
    const chatReplyEditPreviewClose = document.getElementById('f5-chat-reply-edit-preview-close');
    const chatImgInput = document.getElementById('f5-chat-img-input');
    const chatActiveTitle = document.getElementById('f5-chat-active-title');
    const chatActiveDesc = document.getElementById('f5-chat-active-desc');
    const chatActiveAvatar = document.getElementById('f5-chat-active-avatar');
    const chatBlockedOverlay = document.getElementById('f5-chat-blocked-overlay');
    const yeniMesajBtn = document.getElementById('f5-yeni-mesaj-btn');
    const yeniMesajMetin = document.getElementById('f5-yeni-mesaj-metin');
    let yeniMesajSayaci = 0;
    const chatGifBtn = document.getElementById('f5-chat-gif-btn');
    const gifModal = document.getElementById('f5-gif-modal');
    const gifKapatBtn = document.getElementById('f5-gif-kapat');
    const gifAramaInput = document.getElementById('f5-gif-arama-input');
    const gifGridEl = document.getElementById('f5-gif-grid');
    const gifDurumEl = document.getElementById('f5-gif-durum');

    const readDetailsModal = document.getElementById('f5-read-details-modal');
    const readDetailsList = document.getElementById('f5-read-details-list');
    const readDetailsKapat = document.getElementById('f5-read-details-kapat');
    if (readDetailsKapat) {
        readDetailsKapat.addEventListener('click', () => { readDetailsModal.style.display = 'none'; });
    }
    const chatCallBtn = document.getElementById('f5-chat-call-btn');
    const optToggleBtn = document.getElementById('f5-chat-options-toggle');
    const optMenu = document.getElementById('f5-chat-options-menu');
    const optMute = document.getElementById('f5-chat-opt-mute');
    const optManage = document.getElementById('f5-chat-opt-manage');
    const optProfile = document.getElementById('f5-chat-opt-profile');
    const optBlock = document.getElementById('f5-chat-opt-block');
    const optDelete = document.getElementById('f5-chat-opt-delete');
    const optLeave = document.getElementById('f5-chat-opt-leave');
    let guncelOdaTuru = 'dm';
    let guncelDigerUye = null;
    let aktifEngelListener = null;
    let digerTarafBeniEngelledi = false;

    function yeniMesajButonuGuncelle() {
        if (!yeniMesajBtn) return;
        if (yeniMesajSayaci > 0) {
            if (yeniMesajMetin) yeniMesajMetin.textContent = `${yeniMesajSayaci} ${t('yeni_mesaj_var')}`;
            yeniMesajBtn.classList.add('show');
        } else {
            yeniMesajBtn.classList.remove('show');
        }
    }
    function yeniMesajSayaciniSifirla() {
        yeniMesajSayaci = 0;
        yeniMesajButonuGuncelle();
    }
    function asagiKaydir() {
        if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
        yeniMesajSayaciniSifirla();
    }
    if (yeniMesajBtn) yeniMesajBtn.addEventListener('click', asagiKaydir);

    function engelDurumunuUygula() {
        if (guncelOdaTuru !== 'dm' || !guncelDigerUye) return;
        const benOnuEngellemisim = engellenenKisiler.includes(guncelDigerUye);
        if (benOnuEngellemisim) {
            optBlock.textContent = t('engel_kaldir');
            chatBlockedOverlay.textContent = t('bu_kisi_engellendi_metni');
            chatBlockedOverlay.style.display = 'flex';
            chatInputBox.style.display = 'none';
        } else if (digerTarafBeniEngelledi) {
            optBlock.textContent = t('engelle');
            chatBlockedOverlay.textContent = t('beni_engelledi_metni');
            chatBlockedOverlay.style.display = 'flex';
            chatInputBox.style.display = 'none';
        } else {
            optBlock.textContent = t('engelle');
            chatBlockedOverlay.style.display = 'none';
            if (!kullaniciGlobalSusturulmusMu(mevcutKullaniciAdi)) chatInputBox.style.display = 'flex';
            else chatInputBox.style.display = 'none';
        }
    }

    function dmOnlineDurumuGuncelle() {
        if (guncelOdaTuru !== 'dm' || !guncelDigerUye || !chatActiveDesc) return;
        const cevrimIci = tumAktifKullanicilar.some(u => u.username === guncelDigerUye);
        const dotClass = 'f5-dm-online-dot' + (cevrimIci ? ' online' : '');
        let metin;
        if (cevrimIci) {
            metin = aktifDil === 'tr' ? 'Çevrimiçi' : 'Online';
        } else {
            const kullaniciObj = tumAktifKullanicilar.find(u => u.username === guncelDigerUye);
            let sonGorulmeMs = null;
            if (kullaniciObj && kullaniciObj.sonGorulme) sonGorulmeMs = kullaniciObj.sonGorulme;
            if (!sonGorulmeMs) {
                const sonGorulmeStr = localStorage.getItem('kick_f5_last_seen_' + anahtarGuvenliYap(guncelDigerUye));
                if (sonGorulmeStr) sonGorulmeMs = parseInt(sonGorulmeStr, 10);
            }
            if (sonGorulmeMs) {
                const fark = Date.now() - sonGorulmeMs;
                const dk = Math.floor(fark / 60000);
                const saat = Math.floor(dk / 60);
                const gun = Math.floor(saat / 24);
                if (dk < 1) metin = aktifDil === 'tr' ? 'Az önce çevrimiçiydi' : 'Last seen just now';
                else if (dk < 60) metin = aktifDil === 'tr' ? `Son görülme: ${dk} dakika önce` : `Last seen: ${dk} min ago`;
                else if (saat < 24) metin = aktifDil === 'tr' ? `Son görülme: ${saat} saat önce` : `Last seen: ${saat} h ago`;
                else if (gun < 30) metin = aktifDil === 'tr' ? `Son görülme: ${gun} gün önce` : `Last seen: ${gun} days ago`;
                else metin = aktifDil === 'tr' ? 'Uzun süre önce' : 'Long time ago';
            } else {
                metin = aktifDil === 'tr' ? 'Çevrimdışı' : 'Offline';
            }
        }
        chatActiveDesc.innerHTML = `<span class="${dotClass}"></span><span>${metin}</span>`;
    }

    optToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        optMenu.classList.toggle('show');
    });

    optMute.addEventListener('click', () => {
        if (isMuted(aktifOdaId)) {
            delete sessizeAlinanlar[aktifOdaId];
            sessizKaydet();
            optMute.textContent = t('sessize_al');
            const item = document.querySelector(`.f5-chat-room-item[data-id="${aktifOdaId}"] .f5-chat-room-name`);
            if (item) item.textContent = item.textContent.replace('🔇', '').trim();
            optMenu.classList.remove('show');
        } else {
            document.getElementById('f5-mute-modal').style.display = 'flex';
            optMenu.classList.remove('show');
        }
    });
    document.getElementById('f5-mute-kapat').addEventListener('click', () => {
        document.getElementById('f5-mute-modal').style.display = 'none';
    });
    document.querySelectorAll('.f5-mute-opt').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hours = parseFloat(e.target.getAttribute('data-hours'));
            if (hours === -1) sessizeAlinanlar[aktifOdaId] = -1;
            else sessizeAlinanlar[aktifOdaId] = Date.now() + (hours * 3600000);
            sessizKaydet();
            optMute.textContent = t('sesi_ac');
            okunmayanOdalar[aktifOdaId] = 0;
            okunmayanBildirimGuncelle();
            const item = document.querySelector(`.f5-chat-room-item[data-id="${aktifOdaId}"]`);
            if (item) {
                item.querySelector('.f5-chat-room-unread').style.display = 'none';
                item.classList.remove('has-new');
                const nameEl = item.querySelector('.f5-chat-room-name');
                if (!nameEl.textContent.includes('🔇')) nameEl.textContent += ' 🔇';
            }
            document.getElementById('f5-mute-modal').style.display = 'none';
        });
    });
    optBlock.addEventListener('click', () => {
        if (guncelOdaTuru !== 'dm' || !guncelDigerUye) return;
        const guvenliBenAd = anahtarGuvenliYap(mevcutKullaniciAdi);
        if (engellenenKisiler.includes(guncelDigerUye)) {
            engellenenKisiler = engellenenKisiler.filter(k => k !== guncelDigerUye);
            if (db && aktifOdaId) db.ref(`sohbetOdasi/${aktifOdaId}/engellenenler/${guvenliBenAd}`).remove();
        } else {
            engellenenKisiler.push(guncelDigerUye);
            if (db && aktifOdaId) db.ref(`sohbetOdasi/${aktifOdaId}/engellenenler/${guvenliBenAd}`).set(true);
        }
        engelKaydet();
        optMenu.classList.remove('show');
        engelDurumunuUygula();
    });

    optDelete.addEventListener('click', async () => {
        const onay = await ozelOnayGoster(t('sohbet_sil_onay'), t('sil_baslik'));
        if (!onay) return;
        optMenu.classList.remove('show');
        const guvenliAd = mevcutKullaniciAdi.replace(/[.#$/\[\]]/g, '_');
        await db.ref(`kullaniciOdalar/${guvenliAd}/${aktifOdaId}`).remove();
        yazmaDurumunuTemizle(aktifOdaId);
        clearTimeout(yazmaTimeoutId);
        if (aktifYazmaListener) { aktifYazmaListener.off(); aktifYazmaListener = null; }
        if (aktifOdaMetaListener) { aktifOdaMetaListener.off(); aktifOdaMetaListener = null; }
        if (aktifEngelListener) { aktifEngelListener.off(); aktifEngelListener = null; }
        digerTarafBeniEngelledi = false;
        aktifOdaAdminler = {}; aktifOdaKurucu = null;
        typingGosterGuncelle(null);
        aktifOdaId = null;
        chatActiveTitle.textContent = '-';
        chatActiveDesc.textContent = '';
        chatActiveAvatar.style.display = 'none';
        messagesEl.innerHTML = `<div class="f5-chat-empty-state">${t('sohbet_secin')}</div>`;
        chatInputBox.style.display = 'none';
        optToggleBtn.style.display = 'none';
        yeniMesajSayaciniSifirla();
    });

    optLeave.addEventListener('click', async () => {
        if (!aktifOdaId || guncelOdaTuru !== 'grup') return;
        const onay = await ozelOnayGoster(t('ayril_onay'), t('ayril_btn'));
        if (!onay) return;
        optMenu.classList.remove('show');
        const oankiOda = aktifOdaId;
        const guvenliAd = anahtarGuvenliYap(mevcutKullaniciAdi);
        db.ref(`sohbetOdasi/${oankiOda}`).once('value', snap => {
            const oda = snap.val();
            if (!oda || !oda.uyeler) return;
            const yeniUyeler = oda.uyeler.filter(u => u !== mevcutKullaniciAdi);
            const guncellemeler = { uyeler: yeniUyeler };
            if (oda.adminler && oda.adminler[guvenliAd]) {
                const yeniAdminler = Object.assign({}, oda.adminler);
                delete yeniAdminler[guvenliAd];
                if (yeniUyeler.length > 0) {
                    if (oda.kurucu === mevcutKullaniciAdi) {
                        const yeniKurucu = yeniUyeler[Math.floor(Math.random() * yeniUyeler.length)];
                        guncellemeler.kurucu = yeniKurucu;
                        yeniAdminler[anahtarGuvenliYap(yeniKurucu)] = yeniKurucu;
                    } else if (Object.keys(yeniAdminler).length === 0) {
                        const rastgeleUye = yeniUyeler[Math.floor(Math.random() * yeniUyeler.length)];
                        yeniAdminler[anahtarGuvenliYap(rastgeleUye)] = rastgeleUye;
                    }
                }
                guncellemeler.adminler = yeniAdminler;
            }
            db.ref(`sohbetOdasi/${oankiOda}`).update(guncellemeler);
            db.ref(`kullaniciOdalar/${guvenliAd}/${oankiOda}`).remove();
            db.ref(`mesajlar/${oankiOda}`).push({
                tip: 'sistem',
                metin: `${mevcutKullaniciAdi} Gruptan Ayrıldı`,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        });
        yazmaDurumunuTemizle(oankiOda);
        clearTimeout(yazmaTimeoutId);
        if (aktifYazmaListener) { aktifYazmaListener.off(); aktifYazmaListener = null; }
        if (aktifOdaMetaListener) { aktifOdaMetaListener.off(); aktifOdaMetaListener = null; }
        aktifOdaAdminler = {}; aktifOdaKurucu = null;
        typingGosterGuncelle(null);
        aktifOdaId = null;
        chatActiveTitle.textContent = '-';
        chatActiveDesc.textContent = '';
        chatActiveAvatar.style.display = 'none';
        messagesEl.innerHTML = `<div class="f5-chat-empty-state">${t('sohbet_secin')}</div>`;
        chatInputBox.style.display = 'none';
        optToggleBtn.style.display = 'none';
        yeniMesajSayaciniSifirla();
    });

    function mesajIcerikOlustur(m, msgKey, benimMi, grupMu) {
        const silinmisMi = !!m.silindi;
        const saatDizesi = new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const gonderenAdminMi = grupMu && Object.values(aktifOdaAdminler || {}).includes(m.gonderen);
        const adminEtiketi = gonderenAdminMi ? ' <b style="color:var(--f5-main-color);">(Admin)</b>' : '';
        const kurucuEtiketi = (grupMu && aktifOdaKurucu === m.gonderen) ? ' <b style="color:#ffb700;">👑</b>' : '';
        let timeoutEtiketi = '';
        if (kullaniciGlobalSusturulmusMu(m.gonderen)) {
            timeoutEtiketi = ` <span class="f5-timeout-badge">⏱️ ${t('timeout_susturulmus')}</span>`;
        }
        let avatarHtml = '';
        if (!benimMi) {
            const gonderenObj = tumAktifKullanicilar.find(u => u.username === m.gonderen);
            const gAvatar = gonderenObj && gonderenObj.avatar ? gonderenObj.avatar : null;
            const avatarIcerik = gAvatar ? `<img src="${gAvatar}">` : m.gonderen.charAt(0).toUpperCase();
            avatarHtml = `<div class="f5-chat-msg-avatar">${avatarIcerik}</div>`;
        }
        let icerikHtml;
        if (silinmisMi) {
            icerikHtml = `<div class="f5-chat-msg-deleted">🚫 ${t('mesaj_silindi_metni')}</div>`;
        } else if (m.tip === 'resim') {
            icerikHtml = `<img src="${m.metin}" class="f5-chat-image" onclick="window.f5ResimAc(this.src)">`;
        } else if (m.tip === 'gif') {
            icerikHtml = `<img src="${m.metin}" class="f5-chat-image f5-chat-gif-img" onclick="window.f5ResimAc(this.src)">`;
        } else {
            const filtrelenmisMetin = kufurFiltrele(m.metin);
            icerikHtml = `<div>${filtrelenmisMetin}</div>`;
        }
        let yanitHtml = '';
        if (m.yanit && !silinmisMi) {
            const yanitMetinKisa = m.yanit.tip === 'metin'
                ? kufurFiltrele(m.yanit.metin)
                : (m.yanit.tip === 'resim' ? `📷 ${aktifDil === 'tr' ? 'Resim' : 'Photo'}` : '🎞️ GIF');
            yanitHtml = `<div class="f5-chat-reply-quote" data-goto="${m.yanit.key || ''}">
                <div class="f5-chat-reply-quote-sender">${m.yanit.gonderen}</div>
                <div class="f5-chat-reply-quote-text">${yanitMetinKisa}</div>
            </div>`;
        }
        let tickHtml = '';
        if (benimMi) {
            const okuyanlar = m.okunduDurumu ? Object.keys(m.okunduDurumu) : [];
            const isRead = okuyanlar.length > 0;
            if (grupMu) {
                const okumaMetni = isRead ? `${okuyanlar.length} kişi okudu` : 'İletildi';
                tickHtml = `<span class="f5-chat-read-count ${isRead ? 'read' : ''}" data-msg-key="${msgKey}" title="Tıkla detay gör">${okumaMetni}</span>`;
            } else {
                tickHtml = `<span class="f5-chat-tick ${isRead ? 'read' : ''}" id="tick-${msgKey}">${isRead ? '✓✓' : '✓'}</span>`;
            }
        }
        const duzenlendiEtiket = (m.duzenlendi && !silinmisMi) ? `<span class="f5-chat-edited-tag" style="font-size: 10px; color: #888; font-style: italic; margin-left: 6px;">Düzenlendi</span>` : '';
        let reactionHtml = '';
        if (!silinmisMi && m.reactions && typeof m.reactions === 'object') {
            const reactionGroups = {};
            Object.entries(m.reactions).forEach(([kullanici, emoji]) => {
                if (!emoji || typeof emoji !== 'string') return;
                if (!reactionGroups[emoji]) reactionGroups[emoji] = [];
                reactionGroups[emoji].push(kullanici);
            });
            const chips = Object.entries(reactionGroups).map(([emoji, kullanicilar]) => {
                const benimTepkimMi = kullanicilar.includes(mevcutKullaniciAdi);
                return `<span class="f5-reaction-chip ${benimTepkimMi ? 'mine' : ''}" data-reaction-emoji="${emoji}" data-msg-key="${msgKey}" title="${kullanicilar.join(', ')}">${emoji} ${kullanicilar.length}</span>`;
            }).join('');
            if (chips) reactionHtml = `<div class="f5-reaction-bar">${chips}</div>`;
        }
        let aksiyonlarHtml = '';
        if (!silinmisMi) {
            let dugmeler = `<button type="button" class="f5-chat-msg-action-btn f5-chat-reply-btn" title="${t('yanitla_baslik')}">↩</button>`;
            dugmeler += `<button type="button" class="f5-chat-msg-action-btn f5-reaction-btn" title="Tepki Ver" style="font-size:12px;">😊</button>`;
            if (benimMi) {
                if (m.tip === 'metin') dugmeler += `<button type="button" class="f5-chat-msg-action-btn f5-chat-edit-btn" title="${t('duzenle_baslik')}" style="width: auto; padding: 0 6px; font-weight: bold; border-radius: 6px;">Düzenle</button>`;
                dugmeler += `<button type="button" class="f5-chat-msg-action-btn f5-chat-delete-btn" title="${t('sil_baslik')}">🗑</button>`;
            }
            aksiyonlarHtml = `<div class="f5-chat-msg-actions">${dugmeler}</div>`;
        }
        return `
            ${!benimMi ? avatarHtml : ''}
            ${benimMi ? aksiyonlarHtml : ''}
            <div class="f5-chat-bubble ${benimMi ? 'f5-chat-bubble-me' : 'f5-chat-bubble-other'}">
                <div class="f5-chat-bubble-sender f5-chat-bubble-sender-${benimMi ? 'me' : 'other'}">${benimMi ? t('sen_etiketi') : `👤 ${m.gonderen}`}${kurucuEtiketi}${adminEtiketi}${timeoutEtiketi}</div>
                ${yanitHtml}
                <div style="display: flex; align-items: baseline;">${icerikHtml}${duzenlendiEtiket}</div>
                ${reactionHtml}
                <div class="f5-chat-bubble-time">${saatDizesi} ${tickHtml}</div>
            </div>
            ${!benimMi ? aksiyonlarHtml : ''}
        `;
    }

    function typingGosterGuncelle(kullaniciAdi) {
        let row = document.getElementById('f5-typing-row');
        if (!kullaniciAdi) { if (row) row.remove(); return; }
        const kUser = tumAktifKullanicilar.find(u => u.username === kullaniciAdi);
        const avatarIcerik = kUser && kUser.avatar ? `<img src="${kUser.avatar}">` : kullaniciAdi.charAt(0).toUpperCase();
        if (!row) {
            row = document.createElement('div');
            row.id = 'f5-typing-row';
            row.className = 'f5-chat-msg-row';
        }
        row.innerHTML = `<div class="f5-chat-msg-avatar">${avatarIcerik}</div><div class="f5-chat-typing-bubble"><span class="f5-chat-typing-dot"></span><span class="f5-chat-typing-dot"></span><span class="f5-chat-typing-dot"></span></div>`;
        messagesEl.appendChild(row);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function yazmaDurumunuTemizle(odaId) {
        if (!db || !odaId || !mevcutKullaniciAdi) return;
        const guvenliAd = mevcutKullaniciAdi.replace(/[.#$/\[\]]/g, '_');
        db.ref(`sohbetOdasi/${odaId}/yaziyor/${guvenliAd}`).remove();
    }
    function yaziyorumBildir() {
        if (!db || !aktifOdaId || !mevcutKullaniciAdi) return;
        if (kullaniciGlobalSusturulmusMu(mevcutKullaniciAdi)) return;
        const guvenliAd = mevcutKullaniciAdi.replace(/[.#$/\[\]]/g, '_');
        const yazmaRef = db.ref(`sohbetOdasi/${aktifOdaId}/yaziyor/${guvenliAd}`);
        clearTimeout(yazmaTimeoutId);
        const simdi = Date.now();
        if (simdi - sonYazmaGonderim > 1500) {
            sonYazmaGonderim = simdi;
            yazmaRef.set({ username: mevcutKullaniciAdi, ts: firebase.database.ServerValue.TIMESTAMP });
            yazmaRef.onDisconnect().remove();
        }
        yazmaTimeoutId = setTimeout(() => yazmaRef.remove(), 2500);
    }

    function odayaGec(odaId, baslik, grupMu, digerUyeAd = null, avatarUrl = null) {
        odaAcilisZamani = Date.now();
        if (aktifOdaId && aktifOdaId !== odaId) yazmaDurumunuTemizle(aktifOdaId);
        clearTimeout(yazmaTimeoutId);
        aktifOdaId = odaId;
        guncelOdaTuru = grupMu ? 'grup' : 'dm';
        guncelDigerUye = digerUyeAd;
        if (!grupMu && digerUyeAd) {
            const halaAktif = tumAktifKullanicilar.some(u => u.username === digerUyeAd);
            if (halaAktif) localStorage.removeItem('kick_f5_last_seen_' + anahtarGuvenliYap(digerUyeAd));
            else {
                const mevcutKayit = localStorage.getItem('kick_f5_last_seen_' + anahtarGuvenliYap(digerUyeAd));
                if (!mevcutKayit) localStorage.setItem('kick_f5_last_seen_' + anahtarGuvenliYap(digerUyeAd), Date.now().toString());
            }
        }
        yeniMesajSayaciniSifirla();
        chatActiveTitle.textContent = baslik;
        if (grupMu) chatActiveDesc.textContent = 'Grup Sohbeti';
        else dmOnlineDurumuGuncelle();
        if (avatarUrl) {
            chatActiveAvatar.style.display = 'flex';
            chatActiveAvatar.innerHTML = `<img src="${avatarUrl}">`;
        } else {
            chatActiveAvatar.style.display = 'none';
        }
        optToggleBtn.style.display = 'flex';
        optMute.textContent = isMuted(odaId) ? t('sesi_ac') : t('sessize_al');
        if (chatCallBtn) {
            chatCallBtn.style.display = 'flex';
            chatCallBtn.onclick = () => {
                if (aktifCagriTuru) { toastGoster(t('cagri_zaten_aramada'), 'uyari'); return; }
                acilDurumSecimModaliniAc(odaId, baslik, guncelOdaTuru === 'grup', guncelDigerUye);
            };
        }
        if (aktifEngelListener) { aktifEngelListener.off(); aktifEngelListener = null; }
        digerTarafBeniEngelledi = false;
        if (grupMu) {
            optManage.style.display = 'block';
            optProfile.style.display = 'none';
            optBlock.style.display = 'none';
            optLeave.style.display = 'block';
            chatBlockedOverlay.style.display = 'none';
            chatInputBox.style.display = 'flex';
        } else {
            optManage.style.display = 'none';
            optProfile.style.display = 'none';
            optBlock.style.display = 'block';
            optLeave.style.display = 'none';
            engelDurumunuUygula();
            if (db && digerUyeAd) {
                const guvenliDigerAd = anahtarGuvenliYap(digerUyeAd);
                aktifEngelListener = db.ref(`sohbetOdasi/${odaId}/engellenenler/${guvenliDigerAd}`);
                aktifEngelListener.on('value', snap => {
                    digerTarafBeniEngelledi = !!snap.val();
                    if (aktifOdaId === odaId) engelDurumunuUygula();
                });
            }
        }
        okunmayanOdalar[odaId] = 0;
        okunmayanBildirimGuncelle();
        bekleyenOkunduMesajlari[odaId] = [];
        if (aktifOdaMetaListener) { aktifOdaMetaListener.off(); aktifOdaMetaListener = null; }
        aktifOdaAdminler = {}; aktifOdaKurucu = null;
        if (grupMu) {
            aktifOdaMetaListener = db.ref(`sohbetOdasi/${odaId}`);
            aktifOdaMetaListener.on('value', metaSnap => {
                const meta = metaSnap.val() || {};
                aktifOdaAdminler = meta.adminler || {};
                aktifOdaKurucu = meta.kurucu || null;
                const adminMi = benAdminMiyim();
                const kurucuMuyum = (aktifOdaKurucu === mevcutKullaniciAdi);
                optManage.style.display = 'block';
                optProfile.style.display = (adminMi || kurucuMuyum) ? 'block' : 'none';
            });
        }
        enEskiMesajKey = null;
        tumEskiMesajlarYuklendi = false;
        messagesEl.innerHTML = `<button id="f5-chat-load-more-btn" class="f5-chat-load-more">${t('daha_fazla_yukle')}</button>`;
        mesajCache = {};
        replyEditPreviewGizle();
        const loadMoreBtn = document.getElementById('f5-chat-load-more-btn');
        loadMoreBtn.addEventListener('click', () => {
            if (tumEskiMesajlarYuklendi || !enEskiMesajKey) return;
            loadMoreBtn.textContent = t('yukleniyor');
            loadMoreBtn.style.opacity = '0.5';
            db.ref(`mesajlar/${aktifOdaId}`).orderByKey().endAt(enEskiMesajKey).limitToLast(SAYFA_BASI_MESAJ + 1).once('value', snap => {
                const msgs = [];
                snap.forEach(child => { msgs.push({ key: child.key, val: child.val() }); });
                if (msgs.length > 0 && msgs[msgs.length - 1].key === enEskiMesajKey) msgs.pop();
                if (msgs.length < SAYFA_BASI_MESAJ) {
                    tumEskiMesajlarYuklendi = true;
                    loadMoreBtn.style.display = 'none';
                } else {
                    loadMoreBtn.textContent = t('daha_fazla_yukle');
                    loadMoreBtn.style.opacity = '1';
                }
                if (msgs.length > 0) {
                    enEskiMesajKey = msgs[0].key;
                    const eskiScrollHeight = messagesEl.scrollHeight;
                    const fragment = document.createDocumentFragment();
                    msgs.forEach(mObj => {
                        const m = mObj.val;
                        const msgKey = mObj.key;
                        if (mesajCache[msgKey]) return;
                        if (!grupMu && m.gonderen !== mevcutKullaniciAdi && engellenenKisiler.includes(m.gonderen)) return;
                        mesajCache[msgKey] = m;
                        if (m.tip === 'sistem') {
                            const sysEl = document.createElement('div');
                            sysEl.className = 'f5-chat-system-msg';
                            sysEl.id = `msg-${msgKey}`;
                            sysEl.textContent = m.metin;
                            fragment.appendChild(sysEl);
                            return;
                        }
                        const benimMi = m.gonderen === mevcutKullaniciAdi;
                        const row = document.createElement('div');
                        row.className = `f5-chat-msg-row ${benimMi ? 'me' : ''}`;
                        row.id = `msg-${msgKey}`;
                        row.dataset.msgKey = msgKey;
                        row.innerHTML = mesajIcerikOlustur(m, msgKey, benimMi, grupMu);
                        fragment.appendChild(row);
                    });
                    messagesEl.insertBefore(fragment, loadMoreBtn.nextSibling);
                    messagesEl.scrollTop += (messagesEl.scrollHeight - eskiScrollHeight);
                }
            });
        });
        document.querySelectorAll('.f5-chat-room-item').forEach(el => {
            el.classList.toggle('active', el.getAttribute('data-id') === odaId);
            if (el.getAttribute('data-id') === odaId) {
                el.querySelector('.f5-chat-room-unread').style.display = 'none';
                el.classList.remove('has-new');
            }
        });
        if (aktifOdaListener) aktifOdaListener.off();
        aktifOdaListener = db.ref(`mesajlar/${odaId}`).limitToLast(SAYFA_BASI_MESAJ);
        if (aktifYazmaListener) aktifYazmaListener.off();
        aktifYazmaListener = db.ref(`sohbetOdasi/${odaId}/yaziyor`);
        aktifYazmaListener.on('value', snap => {
            const veri = snap.val() || {};
            const digerYazan = Object.values(veri).find(v => v && v.username && v.username !== mevcutKullaniciAdi);
            typingGosterGuncelle(digerYazan ? digerYazan.username : null);
        });
        aktifOdaListener.on('child_added', snapshot => {
            const m = snapshot.val();
            const msgKey = snapshot.key;
            if (!m) return;
            if (mesajCache[msgKey]) return;
            if (!grupMu && m.gonderen !== mevcutKullaniciAdi && engellenenKisiler.includes(m.gonderen)) return;
            mesajCache[msgKey] = m;
            if (!enEskiMesajKey || msgKey < enEskiMesajKey) enEskiMesajKey = msgKey;
            if (m.tip === 'sistem') {
                const sysEl = document.createElement('div');
                sysEl.className = 'f5-chat-system-msg';
                sysEl.id = `msg-${msgKey}`;
                sysEl.textContent = m.metin;
                messagesEl.appendChild(sysEl);
                messagesEl.scrollTop = messagesEl.scrollHeight;
                return;
            }
            const benimMi = m.gonderen === mevcutKullaniciAdi;
            if (!benimMi) typingGosterGuncelle(null);
            const row = document.createElement('div');
            row.className = `f5-chat-msg-row ${benimMi ? 'me' : ''}`;
            row.id = `msg-${msgKey}`;
            row.dataset.msgKey = msgKey;
            row.innerHTML = mesajIcerikOlustur(m, msgKey, benimMi, grupMu);
            messagesEl.appendChild(row);
            const isScrolledToBottom = messagesEl.scrollHeight - messagesEl.clientHeight <= messagesEl.scrollTop + 80;
            if (isScrolledToBottom || benimMi) {
                messagesEl.scrollTop = messagesEl.scrollHeight;
                if (!benimMi) yeniMesajSayaciniSifirla();
            } else {
                if (!benimMi) { yeniMesajSayaci++; yeniMesajButonuGuncelle(); }
            }
            const mesajZamani = m.timestamp || 0;
            const mesajTaze = mesajZamani > 0
                && (Date.now() - mesajZamani) < 15000
                && mesajZamani > F5_SAYFA_ACILIS_ZAMANI
                && mesajZamani > (odaAcilisZamani - 1500);
            if (!benimMi && mesajTaze && masaustuBildirimAcik && Notification.permission === 'granted') {
                const gonderenObj = tumAktifKullanicilar.find(u => u.username === m.gonderen);
                const ikonUrl = (gonderenObj && gonderenObj.avatar) ? gonderenObj.avatar : null;
                const baslik = grupMu ? chatActiveTitle.textContent : m.gonderen;
                let icerik = '';
                if (m.tip === 'metin') icerik = kufurFiltrele(m.metin);
                else if (m.tip === 'resim') icerik = '📷 Resim';
                else if (m.tip === 'gif') icerik = '🎞️ GIF';
                masaustuBildirimGoster(baslik, icerik, ikonUrl);
            }
            if (!benimMi && !m.silindi && !m.okunduDurumu?.[mevcutKullaniciAdi]) {
                if (sekmeGorunurMu()) {
                    db.ref(`mesajlar/${odaId}/${msgKey}/okunduDurumu/${mevcutKullaniciAdi}`).set(true);
                } else {
                    if (!bekleyenOkunduMesajlari[odaId]) bekleyenOkunduMesajlari[odaId] = [];
                    bekleyenOkunduMesajlari[odaId].push(msgKey);
                }
            }
        });
        db.ref(`mesajlar/${odaId}`).limitToLast(SAYFA_BASI_MESAJ).once('value', snap => {
            if (snap.numChildren() >= SAYFA_BASI_MESAJ) loadMoreBtn.style.display = 'block';
            setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 100);
        });
        db.ref(`mesajlar/${odaId}`).on('child_changed', snapshot => {
            const m = snapshot.val();
            const msgKey = snapshot.key;
            if (!m) return;
            mesajCache[msgKey] = m;
            const benimMi = m.gonderen === mevcutKullaniciAdi;
            const row = document.getElementById(`msg-${msgKey}`);
            if (row) row.innerHTML = mesajIcerikOlustur(m, msgKey, benimMi, grupMu);
        });
    }

    if (messagesEl) {
        messagesEl.addEventListener('scroll', () => {
            const isAtBottom = messagesEl.scrollHeight - messagesEl.clientHeight <= messagesEl.scrollTop + 80;
            if (isAtBottom && yeniMesajSayaci > 0) yeniMesajSayaciniSifirla();
        });
    }

    chatImgInput.addEventListener('change', function(e) {
        const dosya = e.target.files[0];
        if (!dosya) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; const MAX_HEIGHT = 800;
                let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                mesajGonder(dataUrl, 'resim');
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(dosya);
        chatImgInput.value = '';
    });

    let gifAramaZamanlayici = null;
    function gifDurumGoster(metin) { gifDurumEl.textContent = metin || ''; }
    async function gifGetir(sorgu) {
        if (!GIPHY_API_KEY || GIPHY_API_KEY === 'BURAYA_GIPHY_API_ANAHTARINIZI_YAZIN') {
            gifGridEl.innerHTML = '';
            gifDurumGoster('⚠️ Önce script içine bir GIPHY API anahtarı eklemelisin.');
            return;
        }
        gifDurumGoster(t('gif_araniyor'));
        gifGridEl.innerHTML = '';
        const endpoint = sorgu
            ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(sorgu)}&limit=24&rating=${GIPHY_RATING}&lang=tr`
            : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=${GIPHY_RATING}`;
        try {
            const yanit = await fetch(endpoint);
            const veri = await yanit.json();
            const sonuclar = veri.data || [];
            if (sonuclar.length === 0) {
                gifDurumGoster(t('gif_bulunamadi'));
                return;
            }
            gifDurumGoster('');
            sonuclar.forEach(sonuc => {
                const gorseller = sonuc.images || {};
                const kucukUrl = (gorseller.fixed_height_small || gorseller.fixed_width_small || {}).url;
                const tamUrl = (gorseller.fixed_height || gorseller.downsized || {}).url;
                if (!kucukUrl || !tamUrl) return;
                const img = document.createElement('img');
                img.src = kucukUrl;
                img.className = 'f5-gif-item';
                img.loading = 'lazy';
                img.addEventListener('click', () => {
                    mesajGonder(tamUrl, 'gif');
                    gifModal.style.display = 'none';
                });
                gifGridEl.appendChild(img);
            });
        } catch (hata) {
            gifDurumGoster('❌ GIF aranırken bir hata oluştu.');
        }
    }
    chatGifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!aktifOdaId) return;
        gifModal.style.display = 'flex';
        gifAramaInput.value = '';
        gifGetir('');
        gifAramaInput.focus();
    });
    gifKapatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        gifModal.style.display = 'none';
    });
    gifAramaInput.addEventListener('input', () => {
        clearTimeout(gifAramaZamanlayici);
        gifAramaZamanlayici = setTimeout(() => gifGetir(gifAramaInput.value.trim()), 450);
    });

    function replyEditPreviewGizle() {
        yanitlananMesaj = null;
        duzenlenenMesajKey = null;
        chatReplyEditPreview.classList.remove('show');
        chatReplyEditPreviewLabel.textContent = '';
        chatReplyEditPreviewText.textContent = '';
    }
    function replyEditPreviewGuncelle() {
        if (duzenlenenMesajKey) {
            chatReplyEditPreviewLabel.textContent = t('duzenleniyor_etiketi');
            chatReplyEditPreviewText.textContent = '';
            chatReplyEditPreview.classList.add('show');
        } else if (yanitlananMesaj) {
            chatReplyEditPreviewLabel.textContent = `${t('yanitlaniyor_etiketi')} ${yanitlananMesaj.gonderen}`;
            chatReplyEditPreviewText.textContent = yanitlananMesaj.tip === 'metin' ? yanitlananMesaj.metin : (yanitlananMesaj.tip === 'resim' ? '📷' : '🎞️ GIF');
            chatReplyEditPreview.classList.add('show');
        } else {
            replyEditPreviewGizle();
        }
    }
    chatReplyEditPreviewClose.addEventListener('click', () => { chatInput.value = ''; replyEditPreviewGizle(); });

    function mesajaYanitVer(msgKey) {
        const m = mesajCache[msgKey];
        if (!m || m.silindi) return;
        duzenlenenMesajKey = null;
        yanitlananMesaj = { key: msgKey, gonderen: m.gonderen, metin: m.metin, tip: m.tip };
        replyEditPreviewGuncelle();
        chatInput.focus();
    }
    function mesajDuzenlemeBaslat(msgKey) {
        const m = mesajCache[msgKey];
        if (!m || m.gonderen !== mevcutKullaniciAdi || m.tip !== 'metin' || m.silindi) return;
        yanitlananMesaj = null;
        duzenlenenMesajKey = msgKey;
        chatInput.value = m.metin;
        replyEditPreviewGuncelle();
        chatInput.focus();
    }
    async function mesajSil(msgKey) {
        const m = mesajCache[msgKey];
        if (!m || m.gonderen !== mevcutKullaniciAdi || !aktifOdaId || m.silindi) return;
        const onay = await ozelOnayGoster(t('mesaj_sil_onay'), t('sil_baslik'));
        if (!onay) return;
        db.ref(`mesajlar/${aktifOdaId}/${msgKey}`).update({ silindi: true, metin: '', tip: 'metin' })
            .catch(err => toastGoster("Mesaj silinemedi! Hata: " + err.message, 'hata'));
        if (duzenlenenMesajKey === msgKey) { chatInput.value = ''; replyEditPreviewGizle(); }
    }
    function tepkiVer(msgKey, emoji) {
        if (!db || !aktifOdaId || !mevcutKullaniciAdi) return;
        if (!msgKey || !emoji) return;
        const m = mesajCache[msgKey];
        if (!m) return;
        if (m.silindi) return;
        const guvenliKullanici = mevcutKullaniciAdi.replace(/[.#$/\[\]]/g, '_');
        const ref = db.ref(`mesajlar/${aktifOdaId}/${msgKey}/reactions/${guvenliKullanici}`);
        const mevcutTepki = m.reactions && (m.reactions[mevcutKullaniciAdi] || m.reactions[guvenliKullanici]);
        if (mevcutTepki === emoji) {
            ref.remove().catch(err => console.warn('[Kick F5] Tepki kaldırma hatası:', err));
        } else {
            ref.set(emoji).catch(err => console.warn('[Kick F5] Tepki ekleme hatası:', err));
        }
    }
    function sohbetGorunumunuTemizle() {
        messagesEl.innerHTML = `<div class="f5-chat-system-msg">${t('sohbet_temizlendi_bilgi')}</div>`;
    }
    function mesajGonder(icerik = null, tip = 'metin') {
        if (!db || !aktifOdaId || !mevcutKullaniciAdi) return;
        if (guncelOdaTuru === 'dm' && guncelDigerUye && engellenenKisiler.includes(guncelDigerUye)) return;
        if (guncelOdaTuru === 'dm' && digerTarafBeniEngelledi) {
            toastGoster(t('engellendi_gonderim_hata'), 'hata');
            engelDurumunuUygula();
            return;
        }
        if (kullaniciGlobalSusturulmusMu(mevcutKullaniciAdi)) {
            const tData = globalTimeoutCache[anahtarGuvenliYap(mevcutKullaniciAdi)];
            let sureMetin = '';
            if (tData) {
                if (tData.bitis === -1) sureMetin = t('timeout_suresiz');
                else {
                    const kalan = tData.bitis - Date.now();
                    const dk = Math.ceil(kalan / 60000);
                    sureMetin = `${dk} ${t('timeout_dakika')}`;
                }
            }
            toastGoster(`Susturuldunuz! Mesaj gönderemezsiniz. (${sureMetin})`, 'uyari');
            return;
        }
        clearTimeout(yazmaTimeoutId);
        yazmaDurumunuTemizle(aktifOdaId);
        const metin = icerik || chatInput.value.trim();
        if (!metin) return;
        if (tip === 'metin' && /^\/clear$/i.test(metin)) {
            chatInput.value = '';
            replyEditPreviewGizle();
            if (chatClearHint) chatClearHint.classList.remove('show');
            sohbetGorunumunuTemizle();
            return;
        }
        if (duzenlenenMesajKey && tip === 'metin') {
            const key = duzenlenenMesajKey;
            chatInput.value = '';
            replyEditPreviewGizle();
            db.ref(`mesajlar/${aktifOdaId}/${key}`).update({ metin: metin, duzenlendi: true })
                .catch(err => toastGoster("Mesaj düzenlenemedi! Hata: " + err.message, 'hata'));
            return;
        }
        if (tip === 'metin') chatInput.value = '';
        const yeniMesaj = {
            gonderen: mevcutKullaniciAdi,
            metin: metin,
            tip: tip,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        if (yanitlananMesaj) {
            yeniMesaj.yanit = {
                key: yanitlananMesaj.key,
                gonderen: yanitlananMesaj.gonderen,
                metin: yanitlananMesaj.metin,
                tip: yanitlananMesaj.tip
            };
        }
        replyEditPreviewGizle();
        db.ref(`mesajlar/${aktifOdaId}`).push(yeniMesaj)
            .then(() => db.ref(`sohbetOdasi/${aktifOdaId}/sonGuncelleme`).set(firebase.database.ServerValue.TIMESTAMP))
            .catch(err => toastGoster("Mesaj iletilemedi! Hata: " + err.message, 'hata'));
    }
    chatInput.addEventListener('input', () => {
        if (chatInput.value.trim()) yaziyorumBildir();
        else { clearTimeout(yazmaTimeoutId); yazmaDurumunuTemizle(aktifOdaId); }
        if (chatClearHint) chatClearHint.classList.toggle('show', /^\/clear$/i.test(chatInput.value.trim()));
    });
    chatSendBtn.addEventListener('click', () => mesajGonder());
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') mesajGonder();
        else if (e.key === 'Escape' && (yanitlananMesaj || duzenlenenMesajKey)) { chatInput.value = ''; replyEditPreviewGizle(); }
    });

    messagesEl.addEventListener('click', (e) => {
        const replyBtn = e.target.closest('.f5-chat-reply-btn');
        const editBtn = e.target.closest('.f5-chat-edit-btn');
        const deleteBtn = e.target.closest('.f5-chat-delete-btn');
        const replyQuote = e.target.closest('.f5-chat-reply-quote');
        const readCountBtn = e.target.closest('.f5-chat-read-count');
        const reactionBtn = e.target.closest('.f5-reaction-btn');
        const reactionChip = e.target.closest('.f5-reaction-chip');
        if (replyBtn) {
            const row = replyBtn.closest('.f5-chat-msg-row');
            if (row) mesajaYanitVer(row.dataset.msgKey);
        } else if (editBtn) {
            const row = editBtn.closest('.f5-chat-msg-row');
            if (row) mesajDuzenlemeBaslat(row.dataset.msgKey);
        } else if (deleteBtn) {
            const row = deleteBtn.closest('.f5-chat-msg-row');
            if (row) mesajSil(row.dataset.msgKey);
        } else if (replyQuote) {
            const hedefKey = replyQuote.getAttribute('data-goto');
            const hedefEl = hedefKey ? document.getElementById(`msg-${hedefKey}`) : null;
            if (hedefEl) {
                hedefEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                hedefEl.classList.add('f5-chat-msg-highlight');
                setTimeout(() => hedefEl.classList.remove('f5-chat-msg-highlight'), 1200);
            }
        } else if (readCountBtn) {
            const msgKey = readCountBtn.getAttribute('data-msg-key');
            const m = mesajCache[msgKey];
            if (m && m.okunduDurumu) {
                const okuyanlar = Object.keys(m.okunduDurumu);
                if (okuyanlar.length > 0) {
                    readDetailsList.innerHTML = '';
                    okuyanlar.forEach(kisi => {
                        const row = document.createElement('div');
                        row.className = 'f5-submodal-item';
                        row.innerHTML = `<span style="color:#fff; font-size:12px;">👤 ${kisi}</span><span style="font-size:10px; color:var(--f5-main-color);">Okundu ✓</span>`;
                        row.style.justifyContent = 'space-between';
                        readDetailsList.appendChild(row);
                    });
                    readDetailsModal.style.display = 'flex';
                }
            }
        } else if (reactionBtn) {
            const row = reactionBtn.closest('.f5-chat-msg-row');
            if (row) {
                const msgKey = row.dataset.msgKey;
                const eskiPicker = document.querySelector('.f5-reaction-picker');
                if (eskiPicker) eskiPicker.remove();
                const picker = document.createElement('div');
                picker.className = 'f5-reaction-picker';
                const hizliEmojiler = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
                hizliEmojiler.forEach(emoji => {
                    const span = document.createElement('span');
                    span.className = 'f5-reaction-emoji';
                    span.textContent = emoji;
                    span.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        tepkiVer(msgKey, emoji);
                        picker.remove();
                    });
                    picker.appendChild(span);
                });
                const rect = reactionBtn.getBoundingClientRect();
                picker.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - 200)) + 'px';
                picker.style.top = Math.max(10, rect.top - 50) + 'px';
                picker.style.position = 'fixed';
                document.body.appendChild(picker);
            }
        } else if (reactionChip) {
            const msgKey = reactionChip.getAttribute('data-msg-key');
            const emoji = reactionChip.getAttribute('data-reaction-emoji');
            if (msgKey && emoji) tepkiVer(msgKey, emoji);
        }
    });

    function dmSohbetBaslat(hedefKullanici) {
        if (!mevcutKullaniciAdi) return;
        const odaId = 'dm_' + [mevcutKullaniciAdi, hedefKullanici].sort().join('_').replace(/[.#$/\[\]]/g, '_');
        const odaVerisi = {
            id: odaId, tur: 'dm', isim: hedefKullanici, uyeler: [mevcutKullaniciAdi, hedefKullanici],
            sonGuncelleme: firebase.database.ServerValue.TIMESTAMP
        };
        db.ref(`sohbetOdasi/${odaId}`).update(odaVerisi);
        db.ref(`kullaniciOdalar/${mevcutKullaniciAdi.replace(/[.#$/\[\]]/g, '_')}/${odaId}`).set(true);
        db.ref(`kullaniciOdalar/${hedefKullanici.replace(/[.#$/\[\]]/g, '_')}/${odaId}`).set(true);
        tabButtons.forEach(b => { if (b.getAttribute('data-tab') === 'sekme-sohbet') b.click(); });
        odayaGec(odaId, hedefKullanici, false, hedefKullanici);
    }
    function grupOlustur(grupAdi, secilenUyeler) {
        if (!mevcutKullaniciAdi || secilenUyeler.length < 2) return;
        const tumUyeler = Array.from(new Set([mevcutKullaniciAdi, ...secilenUyeler]));
        const odaId = 'grup_' + Date.now().toString(36);
        const odaVerisi = {
            id: odaId, tur: 'grup', isim: grupAdi || `Grup (${tumUyeler.length})`, uyeler: tumUyeler,
            kurucu: mevcutKullaniciAdi,
            adminler: { [anahtarGuvenliYap(mevcutKullaniciAdi)]: mevcutKullaniciAdi },
            sonGuncelleme: firebase.database.ServerValue.TIMESTAMP
        };
        db.ref(`sohbetOdasi/${odaId}`).set(odaVerisi);
        tumUyeler.forEach(uye => db.ref(`kullaniciOdalar/${uye.replace(/[.#$/\[\]]/g, '_')}/${odaId}`).set(true));
        odayaGec(odaId, odaVerisi.isim, true);
    }

    function odalariDinle() {
        if (!db || !mevcutKullaniciAdi) return;
        const guvenliAd = mevcutKullaniciAdi.replace(/[.#$/\[\]]/g, '_');
        const dinlenenOdalar = new Set();
        db.ref(`kullaniciOdalar/${guvenliAd}`).on('value', snap => {
            const odalar = snap.val() || {};
            roomsListEl.innerHTML = '';
            Object.keys(odalar).forEach(odaId => {
                if (!dinlenenOdalar.has(odaId)) {
                    dinlenenOdalar.add(odaId);
                    db.ref(`mesajlar/${odaId}`).limitToLast(30).once('value', msgsSnap => {
                        const msgs = msgsSnap.val() || {};
                        const simdi = Date.now();
                        let unreadCount = 0;
                        Object.entries(msgs).forEach(([msgKey, msg]) => {
                            if (msg.gonderen === mevcutKullaniciAdi) return;
                            if (msg.okunduDurumu && msg.okunduDurumu[mevcutKullaniciAdi]) return;
                            if (msg.tip === 'sistem') return;
                            const mesajYasi = simdi - (msg.timestamp || 0);
                            if (mesajYasi > 30000) {
                                if (db && mevcutKullaniciAdi) {
                                    db.ref(`mesajlar/${odaId}/${msgKey}/okunduDurumu/${mevcutKullaniciAdi}`).set(true);
                                }
                                return;
                            }
                            unreadCount++;
                        });
                        if (aktifOdaId !== odaId) {
                            okunmayanOdalar[odaId] = unreadCount;
                            okunmayanBildirimGuncelle();
                            const item = document.querySelector(`.f5-chat-room-item[data-id="${odaId}"]`);
                            if (item && unreadCount > 0 && !isMuted(odaId)) {
                                const badge = item.querySelector('.f5-chat-room-unread');
                                if (badge) {
                                    badge.textContent = unreadCount;
                                    badge.style.display = 'flex';
                                }
                                item.classList.add('has-new');
                            }
                        }
                    });
                    db.ref(`mesajlar/${odaId}`).orderByChild('timestamp').limitToLast(1).once('value', ilkSnap => {
                        let bilinenSonMesajAnahtari = null;
                        ilkSnap.forEach(cs => { bilinenSonMesajAnahtari = cs.key; });
                        let ilkYuklemeGecti = false;
                        setTimeout(() => { ilkYuklemeGecti = true; }, 2500);
                        db.ref(`mesajlar/${odaId}`).orderByChild('timestamp').limitToLast(1).on('child_added', (mSnap) => {
                            if (bilinenSonMesajAnahtari !== null && mSnap.key === bilinenSonMesajAnahtari) {
                                bilinenSonMesajAnahtari = null;
                                return;
                            }
                            bilinenSonMesajAnahtari = null;
                            if (!ilkYuklemeGecti) return;
                            const m = mSnap.val();
                            if (m && m.gonderen !== mevcutKullaniciAdi) {
                                if (engellenenKisiler.includes(m.gonderen)) return;
                                const mesajYasi = Date.now() - (m.timestamp || 0);
                                if (mesajYasi > 10000) return;
                                const sohbetSessizMi = isMuted(odaId);
                                if (odaId !== aktifOdaId) {
                                    const oItem = document.querySelector(`.f5-chat-room-item[data-id="${odaId}"]`);
                                    if (!sohbetSessizMi) {
                                        okunmayanOdalar[odaId] = (okunmayanOdalar[odaId] || 0) + 1;
                                        okunmayanBildirimGuncelle();
                                        if (oItem) {
                                            const badge = oItem.querySelector('.f5-chat-room-unread');
                                            if (badge) {
                                                badge.textContent = okunmayanOdalar[odaId];
                                                badge.style.display = 'flex';
                                            }
                                            oItem.classList.add('has-new');
                                            roomsListEl.prepend(oItem);
                                        }
                                    } else {
                                        if (oItem) roomsListEl.prepend(oItem);
                                    }
                                }
                                const onSaniyeIcinde = (Date.now() - m.timestamp < 10000);
                                const sekmeArkaPlanda = document.hidden || !document.hasFocus();
                                if (onSaniyeIcinde && !sohbetSessizMi && (odaId !== aktifOdaId || sekmeArkaPlanda)) {
                                    bildirimSesiCal();
                                }
                            }
                        });
                    });
                }
                db.ref(`sohbetOdasi/${odaId}`).on('value', odaSnap => {
                    const oda = odaSnap.val();
                    if (!oda || !oda.uyeler || !oda.uyeler.includes(mevcutKullaniciAdi)) {
                        const silinecek = document.querySelector(`.f5-chat-room-item[data-id="${odaId}"]`);
                        if (silinecek) silinecek.remove();
                        return;
                    }
                    let item = document.querySelector(`.f5-chat-room-item[data-id="${odaId}"]`);
                    if (!item) {
                        item = document.createElement('div');
                        item.className = `f5-chat-room-item ${aktifOdaId === odaId ? 'active' : ''}`;
                        item.setAttribute('data-id', odaId);
                        roomsListEl.appendChild(item);
                    }
                    let gosterimAdi = oda.isim;
                    let avatarUrl = oda.avatar || null;
                    let digerUyeAd = null;
                    if (oda.tur === 'dm') {
                        digerUyeAd = (oda.uyeler || []).find(u => u !== mevcutKullaniciAdi) || oda.isim;
                        gosterimAdi = digerUyeAd;
                        const digerUyeObj = tumAktifKullanicilar.find(u => u.username === digerUyeAd);
                        if (digerUyeObj && digerUyeObj.avatar) avatarUrl = digerUyeObj.avatar;
                    }
                    const avatarIcerik = avatarUrl ? `<img src="${avatarUrl}">` : gosterimAdi.charAt(0).toUpperCase();
                    const currentUnread = okunmayanOdalar[odaId] || 0;
                    const isChatMuted = isMuted(odaId);
                    const badgeDisplay = (!isChatMuted && currentUnread > 0) ? 'flex' : 'none';
                    const hasNewClass = (!isChatMuted && currentUnread > 0) ? 'has-new' : '';
                    item.className = `f5-chat-room-item ${aktifOdaId === odaId ? 'active' : ''} ${hasNewClass}`;
                    item.innerHTML = `
                        <div class="f5-chat-room-avatar">${avatarIcerik}</div>
                        <div class="f5-chat-room-info">
                            <div class="f5-chat-room-name">${gosterimAdi} ${isChatMuted ? '🔇' : ''}</div>
                            <div class="f5-chat-room-sub">${oda.tur === 'grup' ? `Grup (${oda.uyeler.length})` : 'DM'}</div>
                        </div>
                        <div class="f5-chat-room-unread" style="display:${badgeDisplay};">${currentUnread}</div>
                    `;
                    const yeniItem = item.cloneNode(true);
                    item.parentNode.replaceChild(yeniItem, item);
                    yeniItem.addEventListener('click', () => {
                        odayaGec(odaId, gosterimAdi, oda.tur === 'grup', digerUyeAd, avatarUrl);
                    });
                });
            });
        });
    }

    const grupDuzenleModal = document.getElementById('f5-grup-duzenle-modal');
    const grupDuzenleListe = document.getElementById('f5-grup-duzenle-liste');
    let duzenlenenOdaUyeler = [];
    optProfile.addEventListener('click', () => {
        if (aktifOdaKurucu !== mevcutKullaniciAdi && !benAdminMiyim()) { toastGoster(t('admin_gerekli_uyari'), 'uyari'); return; }
        const link = prompt("Grubun yeni profil fotoğrafı için resim linki girin:");
        if (link !== null) {
            db.ref(`sohbetOdasi/${aktifOdaId}/avatar`).set(link || null);
            optMenu.classList.remove('show');
        }
    });
    function grupYonetimPaneliniAc() {
        if (!benAdminMiyim()) { toastGoster(t('admin_gerekli_uyari'), 'uyari'); return; }
        const kurucuMuyum = (aktifOdaKurucu === mevcutKullaniciAdi);
        grupDuzenleModal.style.display = 'flex';
        grupDuzenleListe.innerHTML = '';
        optMenu.classList.remove('show');
        db.ref(`sohbetOdasi/${aktifOdaId}`).once('value', snap => {
            const oda = snap.val() || {};
            duzenlenenOdaUyeler = oda.uyeler || [];
            duzenlenenAdminlerGecici = Object.assign({}, oda.adminler || {});
            duzenlenenOdaUyeler.forEach(uyeAdi => {
                const isAdminUye = Object.values(duzenlenenAdminlerGecici).includes(uyeAdi);
                const row = document.createElement('div');
                row.className = 'f5-submodal-item';
                row.style.justifyContent = 'space-between';
                const kurucuMu = (uyeAdi === aktifOdaKurucu);
                const toggleBtn = (kurucuMuyum && uyeAdi !== mevcutKullaniciAdi && !kurucuMu)
                    ? `<button type="button" class="f5-chat-btn-mini f5-admin-toggle-btn" data-user="${uyeAdi}" style="flex:0 0 auto; white-space:nowrap;">${isAdminUye ? t('admin_kaldir_btn') : t('admin_yap_btn')}</button>`
                    : (kurucuMu ? `<span style="font-size:10px; color:#ffb700; font-weight:700;">👑 Kurucu</span>` : '');
                row.innerHTML = `
                    <label style="display:flex; align-items:center; gap:6px; flex:1; cursor:pointer; min-width:0;">
                        <input type="checkbox" class="f5-uye-checkbox" value="${uyeAdi}" ${kurucuMu ? 'disabled checked' : 'checked'}>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${uyeAdi}${isAdminUye ? ' <b style="color:var(--f5-main-color);">(Admin)</b>' : ''}</span>
                    </label>
                    ${toggleBtn}
                `;
                grupDuzenleListe.appendChild(row);
            });
            const eklenebilecekler = tumAktifKullanicilar.filter(k => !duzenlenenOdaUyeler.includes(k.username));
            if (eklenebilecekler.length && kurucuMuyum) {
                const ayrac = document.createElement('div');
                ayrac.style.cssText = 'font-size:10px;color:#777;margin:8px 0 4px;font-weight:700;';
                ayrac.textContent = aktifDil === 'tr' ? 'Yeni Üye Ekle' : 'Add New Member';
                grupDuzenleListe.appendChild(ayrac);
                eklenebilecekler.forEach(k => {
                    const row = document.createElement('label');
                    row.className = 'f5-submodal-item';
                    row.innerHTML = `<input type="checkbox" class="f5-yeni-uye-checkbox" value="${k.username}"> <span>${k.username}</span>`;
                    grupDuzenleListe.appendChild(row);
                });
            }
        });
    }
    optManage.addEventListener('click', grupYonetimPaneliniAc);
    grupDuzenleListe.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.f5-admin-toggle-btn');
        if (!toggleBtn) return;
        if (aktifOdaKurucu !== mevcutKullaniciAdi) {
            toastGoster(aktifDil === 'tr' ? 'Sadece grup kurucusu admin atayabilir!' : 'Only group founder can assign admins!', 'uyari');
            return;
        }
        const hedefUye = toggleBtn.getAttribute('data-user');
        if (hedefUye === aktifOdaKurucu) return;
        const suAnAdminMi = Object.values(duzenlenenAdminlerGecici).includes(hedefUye);
        if (suAnAdminMi) {
            const anahtar = Object.keys(duzenlenenAdminlerGecici).find(k => duzenlenenAdminlerGecici[k] === hedefUye);
            if (anahtar) delete duzenlenenAdminlerGecici[anahtar];
            toggleBtn.textContent = t('admin_yap_btn');
        } else {
            duzenlenenAdminlerGecici[anahtarGuvenliYap(hedefUye)] = hedefUye;
            toggleBtn.textContent = t('admin_kaldir_btn');
        }
        const label = toggleBtn.parentElement.querySelector('span');
        if (label) label.innerHTML = `${hedefUye}${!suAnAdminMi ? ' <b style="color:var(--f5-main-color);">(Admin)</b>' : ''}`;
    });
    document.getElementById('f5-grup-duzenle-kapat').addEventListener('click', () => { grupDuzenleModal.style.display = 'none'; });
    document.getElementById('f5-grup-duzenle-onayla-btn').addEventListener('click', () => {
        if (aktifOdaKurucu !== mevcutKullaniciAdi) {
            toastGoster(aktifDil === 'tr' ? 'Sadece grup kurucusu üye/admin yönetebilir!' : 'Only group founder can manage members/admins!', 'uyari');
            return;
        }
        const secilenler = [];
        grupDuzenleListe.querySelectorAll('.f5-uye-checkbox:checked, .f5-yeni-uye-checkbox:checked').forEach(c => secilenler.push(c.value));
        if (secilenler.length === 0) { toastGoster(aktifDil === 'tr' ? 'Grupta en az bir üye kalmalı!' : 'Group must have at least one member!', 'uyari'); return; }
        if (!secilenler.includes(aktifOdaKurucu)) {
            toastGoster(aktifDil === 'tr' ? 'Grup kurucusu gruptan çıkarılamaz!' : 'Group founder cannot be removed!', 'uyari');
            return;
        }
        let yeniAdminler = {};
        Object.keys(duzenlenenAdminlerGecici).forEach(anahtar => {
            const ad = duzenlenenAdminlerGecici[anahtar];
            if (secilenler.includes(ad)) yeniAdminler[anahtar] = ad;
        });
        yeniAdminler[anahtarGuvenliYap(aktifOdaKurucu)] = aktifOdaKurucu;
        if (Object.keys(yeniAdminler).length === 0) {
            yeniAdminler[anahtarGuvenliYap(aktifOdaKurucu)] = aktifOdaKurucu;
        }
        db.ref(`sohbetOdasi/${aktifOdaId}`).update({ uyeler: secilenler, adminler: yeniAdminler });
        const eklenenler = secilenler.filter(u => !duzenlenenOdaUyeler.includes(u));
        const cikanlar = duzenlenenOdaUyeler.filter(u => !secilenler.includes(u));
        duzenlenenOdaUyeler.forEach(eskiUye => {
            if (!secilenler.includes(eskiUye)) db.ref(`kullaniciOdalar/${eskiUye.replace(/[.#$/\[\]]/g, '_')}/${aktifOdaId}`).remove();
        });
        secilenler.forEach(yeniUye => {
            db.ref(`kullaniciOdalar/${yeniUye.replace(/[.#$/\[\]]/g, '_')}/${aktifOdaId}`).set(true);
        });
        cikanlar.forEach(kisi => {
            db.ref(`mesajlar/${aktifOdaId}`).push({
                tip: 'sistem',
                metin: `${kisi} Gruptan Ayrıldı`,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        });
        eklenenler.forEach(kisi => {
            db.ref(`mesajlar/${aktifOdaId}`).push({
                tip: 'sistem',
                metin: `${kisi} gruba katıldı`,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        });
        grupDuzenleModal.style.display = 'none';
        toastGoster(aktifDil === 'tr' ? 'Grup üyeleri güncellendi!' : 'Group members updated!', 'basarili');
    });

    const grupKurModal = document.getElementById('f5-grup-kur-modal');
    const dmSecModal = document.getElementById('f5-dm-sec-modal');
    const grupKullaniciSecimi = document.getElementById('f5-grup-kullanici-secimi');
    const dmKullaniciSecimi = document.getElementById('f5-dm-kullanici-secimi');
    const grupAdInput = document.getElementById('f5-grup-ad-input');
    document.getElementById('f5-chat-yeni-grup-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        grupKurModal.style.display = 'flex';
        grupKullaniciSecimi.innerHTML = '';
        tumAktifKullanicilar.filter(k => k.username !== mevcutKullaniciAdi).forEach(k => {
            const row = document.createElement('label');
            row.className = 'f5-submodal-item';
            row.innerHTML = `<input type="checkbox" value="${k.username}"> <span>${k.username}</span>`;
            grupKullaniciSecimi.appendChild(row);
        });
    });
    document.getElementById('f5-grup-kur-kapat').addEventListener('click', (e) => {
        e.stopPropagation();
        grupKurModal.style.display = 'none';
    });
    document.getElementById('f5-grup-onayla-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const secilenler = [];
        grupKullaniciSecimi.querySelectorAll('input:checked').forEach(c => secilenler.push(c.value));
        if (secilenler.length < 2) {
            toastGoster('En az 2 kişi seçmelisiniz!', 'uyari');
            return;
        }
        grupOlustur(grupAdInput.value.trim(), secilenler);
        grupKurModal.style.display = 'none';
        grupAdInput.value = '';
    });
    document.getElementById('f5-chat-yeni-dm-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        dmSecModal.style.display = 'flex';
        dmKullaniciSecimi.innerHTML = '';
        tumAktifKullanicilar.filter(k => k.username !== mevcutKullaniciAdi).forEach(k => {
            const row = document.createElement('div');
            row.className = 'f5-submodal-item';
            row.textContent = k.username;
            row.addEventListener('click', () => {
                dmSecModal.style.display = 'none';
                dmSohbetBaslat(k.username);
            });
            dmKullaniciSecimi.appendChild(row);
        });
    });
    document.getElementById('f5-dm-sec-kapat').addEventListener('click', (e) => {
        e.stopPropagation();
        dmSecModal.style.display = 'none';
    });

    const sifirSayacEl = document.getElementById('f5-sifir-sayac');
    const puanListeEl = document.getElementById('f5-puan-liste');
    let guncelSayacHedefi = null;
    function puanListesiniCiz(kullanicilar) {
        if (!puanListeEl) return;
        puanListeEl.innerHTML = '';
        if (kullanicilar.length === 0) {
            puanListeEl.innerHTML = `<div class="f5-aktif-bos" data-i18n="henuz_puan_yok">${t('henuz_puan_yok')}</div>`;
            return;
        }
        const madalyalar = ['🥇', '🥈', '🥉'];
        kullanicilar
            .sort((a, b) => (b.puan || 0) - (a.puan || 0))
            .forEach((k, i) => {
                const satir = document.createElement('div');
                satir.className = 'f5-puan-satir';
                const harf = (k.username || '?').charAt(0).toUpperCase();
                const avatarIc = k.avatar ? `<img src="${k.avatar}" class="f5-aktif-avatar-img">` : harf;
                const siraHtml = madalyalar[i] || (i + 1);
                satir.innerHTML = `
                    <div class="f5-puan-sira">${siraHtml}</div>
                    <div class="f5-aktif-avatar" style="width:28px;height:28px;min-width:28px;font-size:12px;">${avatarIc}</div>
                    <div class="f5-aktif-ad" style="flex:1;">${k.username}</div>
                    <div class="f5-puan-sayi">${k.puan || 0}</div>`;
                puanListeEl.appendChild(satir);
            });
    }
    function istatistikBaslat() {
        if (!db) return;
        const donguRef = db.ref('istatistikler/donguBitis');
        const puanlarRef = db.ref('istatistikler/puanlar');
        function sifirlamaGerekirseYap() {
            donguRef.transaction(mevcut => {
                if (mevcut === null || Date.now() >= mevcut) return Date.now() + 24 * 60 * 60 * 1000;
                return mevcut;
            }, (hata, yapildiMi) => {
                if (!hata && yapildiMi) puanlarRef.remove();
            });
        }
        donguRef.on('value', (snap) => {
            const bitis = snap.val();
            if (bitis === null || Date.now() >= bitis) { sifirlamaGerekirseYap(); return; }
            guncelSayacHedefi = bitis;
        });
        setInterval(() => {
            if (!sifirSayacEl) return;
            if (!guncelSayacHedefi) { sifirSayacEl.textContent = '--:--:--'; return; }
            const kalan = guncelSayacHedefi - Date.now();
            if (kalan <= 0) { sifirlamaGerekirseYap(); sifirSayacEl.textContent = '00:00:00'; return; }
            const s = Math.floor((kalan / 1000) % 60), m = Math.floor((kalan / 60000) % 60), h = Math.floor(kalan / 3600000);
            sifirSayacEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }, 1000);
        puanlarRef.on('value', (snap) => {
            const veri = snap.val() || {};
            puanListesiniCiz(Object.values(veri));
        });
    }
    function puanEkleVeYenile() {
        if (!db || !mevcutKullaniciAdi) { location.reload(); return; }
        const guvenliAd = mevcutKullaniciAdi.replace(/[.#$/\[\]]/g, '_');
        const puanRef = db.ref('istatistikler/puanlar/' + guvenliAd);
        let gidildi = false;
        const yenile = () => { if (!gidildi) { gidildi = true; location.reload(); } };
        puanRef.transaction(mevcut => {
            const oncekiPuan = (mevcut && typeof mevcut === 'object') ? (mevcut.puan || 0) : (mevcut || 0);
            return { puan: oncekiPuan + 1, username: mevcutKullaniciAdi, avatar: mevcutAvatarUrl || null };
        }).then(yenile).catch(yenile);
        setTimeout(yenile, 800);
    }

    let adminPanelAktif = false;
    function adminAcilListesiRenderla(kayitlar) {
        const liste = document.getElementById('f5-admin-acil-liste');
        if (!liste) return;
        if (!kayitlar || kayitlar.length === 0) {
            liste.innerHTML = `<div class="f5-aktif-bos">${t('admin_bos')}</div>`;
            return;
        }
        let okundular = {};
        try { okundular = JSON.parse(localStorage.getItem(ACIL_OKUNDU_ANAHTARI) || '{}'); } catch(e) {}
        liste.innerHTML = '';
        kayitlar.forEach(k => {
            const okunduMu = !!okundular[k.key];
            const bekliyorMu = k.durum === 'bekliyor';
            const satir = document.createElement('div');
            satir.className = 'f5-aktif-satir';
            const solRenk = bekliyorMu ? '#ffb700' : (k.durum === 'onaylandi' ? '#53fc18' : (k.durum === 'reddedildi' ? '#ff4c4c' : '#555'));
            const arkaPlan = bekliyorMu ? 'rgba(255,183,0,0.08)' : (okunduMu ? 'rgba(0,0,0,0.2)' : 'rgba(255,76,76,0.08)');
            satir.style.cssText = `flex-direction: column; align-items: stretch; gap: 6px; padding: 10px; border-left: 3px solid ${solRenk}; background: ${arkaPlan};`;
            const avatarIc = k.gonderenAvatar ? `<img src="${k.gonderenAvatar}" class="f5-aktif-avatar-img">` : (k.gonderen || '?').charAt(0).toUpperCase();
            const tarih = k.timestamp ? new Date(k.timestamp).toLocaleString('tr-TR') : '-';
            const aiEtiketi = (k.aiKarar) ? `<span style="background:${k.aiKarar === 'onaylandi' ? '#53fc18' : '#ff4c4c'}; color:#000; font-size:9px; font-weight:800; padding:2px 6px; border-radius:8px;">AI</span>` : '';
            satir.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="f5-aktif-avatar" style="width:28px;height:28px;min-width:28px;font-size:11px;">${avatarIc}</div>
                    <div style="flex:1; overflow:hidden;">
                        <div style="font-size:12px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${k.gonderen} ${aiEtiketi}</div>
                        <div style="font-size:10px; color:#888;">→ ${k.hedef} · ${tarih}</div>
                    </div>
                    ${bekliyorMu ? `<span style="background:#ffb700; color:#000; font-size:9px; font-weight:800; padding:2px 6px; border-radius:8px;">${t('admin_bekliyor')}</span>` : ''}
                </div>
                <div style="font-size:11px; color:#ffb700; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:6px; font-style:italic;">"${k.neden || t('admin_neden_yok')}"</div>
                <div style="display:flex; gap:6px;">
                    ${bekliyorMu ? `
                        <button class="f5-admin-onayla-btn" data-key="${k.key}" style="flex:1; padding:8px; background: linear-gradient(145deg,#6bff2f,#3ed10f); color:#0a0f07; border:none; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer;">${t('admin_onayla_ara')}</button>
                        <button class="f5-admin-reddet-btn" data-key="${k.key}" style="flex:1; padding:8px; background: linear-gradient(145deg,#ff4c4c,#c41e1e); color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer;">${t('admin_reddet')}</button>
                    ` : `
                        <div style="flex:1; padding:8px; background: rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; font-size:11px; font-weight:700; text-align:center; color:${k.durum === 'onaylandi' ? '#53fc18' : (k.durum === 'reddedildi' ? '#ff4c4c' : '#888')};">
                            ${k.durum === 'onaylandi' ? t('admin_onaylandi') : (k.durum === 'reddedildi' ? t('admin_reddedildi') : (k.durum === 'iptal' ? t('admin_iptal_edildi') : (k.durum === 'zamanasimi' ? t('admin_zamanasimi') : t('admin_islendi'))))}
                        </div>
                    `}
                    <button class="f5-admin-sil-btn" data-key="${k.key}" style="padding:6px 10px; background: rgba(255,76,76,0.12); color:#ff6b6b; border:1px solid rgba(255,76,76,0.3); border-radius:6px; font-size:10px; font-weight:700; cursor:pointer;">🗑</button>
                </div>
            `;
            liste.appendChild(satir);
        });
        liste.querySelectorAll('.f5-admin-onayla-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const key = btn.getAttribute('data-key');
                if (db && key) {
                    await db.ref(`${ACIL_ARAMA_YOLU}/${key}`).update({
                        durum: 'onaylandi',
                        onaylayanAdmin: mevcutKullaniciAdi,
                        onayZamani: firebase.database.ServerValue.TIMESTAMP
                    });
                }
                try {
                    let okundular = JSON.parse(localStorage.getItem(ACIL_OKUNDU_ANAHTARI) || '{}');
                    okundular[key] = true;
                    localStorage.setItem(ACIL_OKUNDU_ANAHTARI, JSON.stringify(okundular));
                } catch(e) {}
                adminBildirimSayaciniSifirla();
            });
        });
        liste.querySelectorAll('.f5-admin-reddet-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const key = btn.getAttribute('data-key');
                if (db && key) {
                    await db.ref(`${ACIL_ARAMA_YOLU}/${key}`).update({ durum: 'reddedildi', reddedenAdmin: mevcutKullaniciAdi, redZamani: firebase.database.ServerValue.TIMESTAMP });
                }
                try {
                    let okundular = JSON.parse(localStorage.getItem(ACIL_OKUNDU_ANAHTARI) || '{}');
                    okundular[key] = true;
                    localStorage.setItem(ACIL_OKUNDU_ANAHTARI, JSON.stringify(okundular));
                } catch(e) {}
                adminBildirimSayaciniSifirla();
            });
        });
        liste.querySelectorAll('.f5-admin-sil-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const key = btn.getAttribute('data-key');
                const onay = await ozelOnayGoster(t('admin_sil_onay'), t('sil_baslik'));
                if (!onay) return;
                try {
                    let okundular = JSON.parse(localStorage.getItem(ACIL_OKUNDU_ANAHTARI) || '{}');
                    delete okundular[key];
                    localStorage.setItem(ACIL_OKUNDU_ANAHTARI, JSON.stringify(okundular));
                } catch(e) {}
                db.ref(`${ACIL_ARAMA_YOLU}/${key}`).remove();
            });
        });
    }

    let adminBildirimSayaci = 0;
    function adminBildirimSayaciniSifirla() {
        adminBildirimSayaci = 0;
        okunmayanBildirimGuncelle();
    }

    const beyazListeEkleBtn = document.getElementById('f5-beyaz-liste-ekle-btn');
    const beyazListeSecModal = document.getElementById('f5-beyaz-liste-sec-modal');
    const beyazListeKullanicilar = document.getElementById('f5-beyaz-liste-kullanicilar');
    const beyazListeArama = document.getElementById('f5-beyaz-liste-arama');
    const beyazListeSecKapat = document.getElementById('f5-beyaz-liste-sec-kapat');
    function beyazListeKullaniciSeciminiRenderla(aramaMetni) {
        if (!beyazListeKullanicilar) return;
        const eskiScrollTop = beyazListeKullanicilar.scrollTop;
        beyazListeKullanicilar.innerHTML = '';
        const aramaKucuk = (aramaMetni || '').toLowerCase();
        const filtreli = tumAktifKullanicilar.filter(k => {
            if (!k.username) return false;
            if (k.username === mevcutKullaniciAdi) return false;
            if (beyazListedeMi(k.username)) return false;
            if (aramaKucuk && !k.username.toLowerCase().includes(aramaKucuk)) return false;
            return true;
        });
        if (filtreli.length === 0) {
            beyazListeKullanicilar.innerHTML = `<div style="text-align:center; color:#666; font-size:12px; padding:20px 0;">${t('kimse_aktif_degil')}</div>`;
            return;
        }
        filtreli.forEach(k => {
            const row = document.createElement('div');
            row.className = 'f5-beyaz-liste-item';
            row.style.cursor = 'pointer';
            const avatarIc = k.avatar ? `<img src="${k.avatar}">` : (k.username || '?').charAt(0).toUpperCase();
            row.innerHTML = `
                <div class="f5-beyaz-liste-avatar">${avatarIc}</div>
                <div class="f5-beyaz-liste-info">
                    <div class="f5-beyaz-liste-isim">${k.username}</div>
                    <div class="f5-beyaz-liste-tarih">${(k.sayfa || '').split('/').filter(Boolean)[0] || ''}</div>
                </div>
                <div style="color:#53fc18; font-size:18px; font-weight:700;">+</div>
            `;
            row.addEventListener('click', async () => {
                const onay = await ozelOnayGoster(t('beyaz_liste_ekle_onay').replace('{isim}', k.username), t('beyaz_liste_ekle_btn'));
                if (!onay) return;
                beyazListeyeEkle(k.username, k.avatar || null);
                beyazListeSecModal.style.display = 'none';
            });
            beyazListeKullanicilar.appendChild(row);
        });
        beyazListeKullanicilar.scrollTop = eskiScrollTop;
    }
    if (beyazListeEkleBtn) {
        beyazListeEkleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            beyazListeSecModal.style.display = 'flex';
            if (beyazListeArama) beyazListeArama.value = '';
            beyazListeKullaniciSeciminiRenderla('');
        });
    }
    if (beyazListeSecKapat) {
        beyazListeSecKapat.addEventListener('click', (e) => {
            e.stopPropagation();
            beyazListeSecModal.style.display = 'none';
        });
    }
    if (beyazListeSecModal) {
        beyazListeSecModal.addEventListener('click', (e) => {
            if (e.target === beyazListeSecModal) {
                e.stopPropagation();
                beyazListeSecModal.style.display = 'none';
            }
        });
    }
    if (beyazListeArama) {
        beyazListeArama.addEventListener('input', (e) => {
            beyazListeKullaniciSeciminiRenderla(e.target.value.trim());
        });
    }

    function adminPaneliniAktifEt() {
        if (mevcutKullaniciAdi !== ADMIN_KULLANICI_ADI) return;
        if (adminPanelAktif) return;
        adminPanelAktif = true;
        const nickAlani = document.getElementById('f5-nick-alani');
        if (nickAlani) nickAlani.style.display = 'block';
        const adminTabBtn = document.getElementById('f5-tab-admin-btn');
        if (adminTabBtn) adminTabBtn.style.display = 'block';
        if (!db) return;
        globalTimeoutYukle();
        db.ref(ACIL_ARAMA_YOLU).orderByChild('timestamp').limitToLast(50).on('value', snap => {
            const veri = snap.val() || {};
            const kayitlar = Object.entries(veri).map(([k, v]) => ({ key: k, ...v }))
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            adminAcilListesiRenderla(kayitlar);
        });
        let bilinenAcilKeyler = new Set();
        db.ref(ACIL_ARAMA_YOLU).orderByChild('timestamp').limitToLast(1).once('value', ilkAcilSnap => {
            ilkAcilSnap.forEach(cs => { bilinenAcilKeyler.add(cs.key); });
            db.ref(ACIL_ARAMA_YOLU).orderByChild('timestamp').limitToLast(1).on('child_added', (snap) => {
                const key = snap.key;
                const veri = snap.val();
                if (!veri) return;
                if (bilinenAcilKeyler.has(key)) { bilinenAcilKeyler.delete(key); return; }
                bilinenAcilKeyler.add(key);
                const kayitZamani = veri.timestamp || 0;
                if (kayitZamani && kayitZamani < (F5_SAYFA_ACILIS_ZAMANI - 2000)) return;
                if (veri.gonderen === ADMIN_KULLANICI_ADI) return;
                if (aiModAktif && veri.durum === 'bekliyor') {
                    const degerlendirme = aiAciliDegerlendir(veri.neden, veri.gonderen);
                    if (degerlendirme.gecerli) {
                        db.ref(`${ACIL_ARAMA_YOLU}/${key}`).update({
                            durum: 'onaylandi',
                            onaylayanAdmin: degerlendirme.ozelKelime ? 'OZEL_KELIME' : 'AI_MOD',
                            aiKarar: 'onaylandi',
                            aiSebep: degerlendirme.sebep,
                            onayZamani: firebase.database.ServerValue.TIMESTAMP
                        });
                    } else {
                        db.ref(`${ACIL_ARAMA_YOLU}/${key}`).update({
                            durum: 'reddedildi',
                            reddedenAdmin: 'AI_MOD',
                            aiKarar: 'reddedildi',
                            aiSebep: degerlendirme.sebep,
                            redZamani: firebase.database.ServerValue.TIMESTAMP
                        });
                    }
                    let okundular = {};
                    try { okundular = JSON.parse(localStorage.getItem(ACIL_OKUNDU_ANAHTARI) || '{}'); } catch(e) {}
                    okundular[key] = true;
                    localStorage.setItem(ACIL_OKUNDU_ANAHTARI, JSON.stringify(okundular));
                    return;
                }
                bildirimSesiCal();
                setTimeout(bildirimSesiCal, 250);
                let okundular = {};
                try { okundular = JSON.parse(localStorage.getItem(ACIL_OKUNDU_ANAHTARI) || '{}'); } catch(e) {}
                if (veri.durum === 'bekliyor' && !okundular[key]) {
                    adminBildirimSayaci++;
                    unreadBadge.textContent = adminBildirimSayaci > 99 ? '99+' : adminBildirimSayaci;
                    unreadBadge.classList.add('show');
                    if (Notification.permission === 'granted') {
                        new Notification(t('admin_yeni_bildirim'), { body: `${veri.gonderen}: ${veri.neden || ''}`, icon: veri.gonderenAvatar || undefined });
                    }
                }
                const adminBtn = document.getElementById('f5-tab-admin-btn');
                if (adminBtn) {
                    if (modal.style.display !== 'block') {
                        modalToggle();
                        adminBtn.click();
                    } else if (!adminBtn.classList.contains('active')) {
                        adminBtn.click();
                    }
                }
            });
        });
        const temizleBtn = document.getElementById('f5-admin-tumunu-temizle');
        if (temizleBtn) {
            temizleBtn.addEventListener('click', async () => {
                const onay = await ozelOnayGoster(t('admin_tumunu_sil_onay'), t('admin_tumunu_temizle'));
                if (!onay) return;
                db.ref(ACIL_ARAMA_YOLU).remove();
                localStorage.removeItem(ACIL_OKUNDU_ANAHTARI);
                adminBildirimSayaci = 0;
                okunmayanBildirimGuncelle();
            });
        }
    }

    async function fbBaslat() {
        if (!db) {
            console.warn('[Kick F5] Firebase bağlantısı yok, sohbet özellikleri devre dışı.');
            return;
        }
        let kullaniciBilgi;
        try {
            kullaniciBilgi = await aktifKullaniciAdiniAl();
        } catch (e) {
            kullaniciBilgi = { ad: mevcutKullaniciAdi || 'Anonim', avatar: null };
        }
        const { ad: kullaniciAdi, avatar: avatarUrl } = kullaniciBilgi || {};
        if (!kullaniciAdi) return;
        mevcutKullaniciAdi = kullaniciAdi;
        mevcutAvatarUrl = avatarUrl;
        const guvenliBenTemizle = anahtarGuvenliYap(mevcutKullaniciAdi);
        const simdiTemizle = Date.now();
        try {
            const dmSnap = await db.ref(`sesliCagri/${guvenliBenTemizle}/gelen`).once('value');
            const dmVeri = dmSnap.val();
            if (dmVeri) {
                const yas = simdiTemizle - (dmVeri.ts || 0);
                if (yas > 120000) await db.ref(`sesliCagri/${guvenliBenTemizle}`).remove();
            }
        } catch(e) {}
        try {
            const grupSnap = await db.ref('grupCagri').once('value');
            const tumGrupCagrilari = grupSnap.val() || {};
            for (const odaId of Object.keys(tumGrupCagrilari)) {
                const gc = tumGrupCagrilari[odaId];
                if (!gc) continue;
                const gcYas = simdiTemizle - (gc.baslangic || 0);
                const benKatilimci = gc.katilimcilar && gc.katilimcilar[guvenliBenTemizle];
                if (gcYas > 300000 && !benKatilimci) await db.ref(`grupCagri/${odaId}`).remove();
                else if (gcYas > 300000 && benKatilimci) await db.ref(`grupCagri/${odaId}/katilimcilar/${guvenliBenTemizle}`).remove();
            }
        } catch(e) {}
        try {
            const acilSnap = await db.ref(ACIL_ARAMA_YOLU).orderByChild('gonderen').equalTo(mevcutKullaniciAdi).once('value');
            const acilVeri = acilSnap.val() || {};
            Object.keys(acilVeri).forEach(k => {
                const kayit = acilVeri[k];
                const kayitYas = simdiTemizle - (kayit.timestamp || 0);
                if (kayit.durum === 'bekliyor' && kayitYas > 60000) {
                    db.ref(`${ACIL_ARAMA_YOLU}/${k}/durum`).set('zamanasimi');
                }
            });
        } catch(e) {}
        dmGelenAramaDinle();
        beyazListeYukle();
        globalTimeoutYukle();
        timeoutKilitEkraniniGuncelle();
        const guvenliAnahtar = kullaniciAdi.replace(/[.#$/\[\]]/g, '_');
        const kullaniciRef = db.ref('aktifKullanicilar/' + guvenliAnahtar);
        db.ref('.info/connected').on('value', snap => {
            if (snap.val() === true) {
                const fbDurum = document.getElementById('f5-fb-durum');
                if (fbDurum) {
                    fbDurum.textContent = 'Bağlı';
                    fbDurum.style.color = 'var(--f5-main-color)';
                }
                kullaniciRef.onDisconnect().remove();
                kullaniciRef.set({
                    username: kullaniciAdi || mevcutKullaniciAdi || 'Bilinmeyen',
                    avatar: avatarUrl || null,
                    sonGorulme: firebase.database.ServerValue.TIMESTAMP,
                    sayfa: location.pathname
                });
            } else {
                const fbDurum = document.getElementById('f5-fb-durum');
                if (fbDurum) {
                    fbDurum.textContent = 'Koptu';
                    fbDurum.style.color = '#ff4c4c';
                }
            }
        });
        db.ref('aktifKullanicilar').on('value', snap => {
            const veri = snap.val() || {};
            tumAktifKullanicilar = Object.values(veri);
            const listeEl = document.getElementById('f5-aktif-liste');
            if (!listeEl) return;
            listeEl.innerHTML = '';
            document.getElementById('f5-aktif-sayi').textContent = tumAktifKullanicilar.length;
            tumAktifKullanicilar.forEach(k => {
                const satir = document.createElement('div');
                satir.className = 'f5-aktif-satir';
                const kullaniciAdiGoster = k.username || 'Bilinmeyen';
                const avatarIc = k.avatar ? `<img src="${k.avatar}" class="f5-aktif-avatar-img">` : kullaniciAdiGoster.charAt(0).toUpperCase();
                const dmButonHtml = (kullaniciAdiGoster !== mevcutKullaniciAdi) ? `<button class="f5-dm-baslat-btn" data-target="${kullaniciAdiGoster}">DM</button>` : '';
                satir.innerHTML = `
                    <div class="f5-aktif-avatar">${avatarIc}<span class="f5-aktif-nokta"></span></div>
                    <div class="f5-aktif-bilgi">
                        <div class="f5-aktif-ad">${kullaniciAdiGoster} ${kullaniciAdiGoster === mevcutKullaniciAdi ? '(Sen)' : ''}</div>
                        <div class="f5-aktif-sayfa">${(k.sayfa || '').split('/').filter(Boolean)[0] || ''}</div>
                    </div>
                    ${dmButonHtml}
                `;
                const btn = satir.querySelector('.f5-dm-baslat-btn');
                if (btn) btn.addEventListener('click', () => dmSohbetBaslat(kullaniciAdiGoster));
                listeEl.appendChild(satir);
            });
            dmOnlineDurumuGuncelle();
        });
        odalariDinle();
        istatistikBaslat();
        if (mevcutKullaniciAdi === ADMIN_KULLANICI_ADI) adminPaneliniAktifEt();
    }

    // ==================== SESLİ ARAMA (WebRTC) ====================
    const ICE_SUNUCULAR = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
    };
    const cagriOverlay = document.getElementById('f5-cagri-overlay');
    const cagriAvatarWrap = document.getElementById('f5-cagri-avatar');
    const cagriIsimEl = document.getElementById('f5-cagri-isim');
    const cagriDurumEl = document.getElementById('f5-cagri-durum');
    const cagriGidenBtns = document.getElementById('f5-cagri-giden-btns');
    const cagriGelenBtns = document.getElementById('f5-cagri-gelen-btns');
    const cagriAktifBtns = document.getElementById('f5-cagri-aktif-btns');
    const cagriKabulBtn = document.getElementById('f5-cagri-kabul-btn');
    const cagriKabulMetin = document.getElementById('f5-cagri-kabul-metin');
    const cagriReddetBtn = document.getElementById('f5-cagri-reddet-btn');
    const cagriIptalBtn = document.getElementById('f5-cagri-iptal-btn');
    const cagriKapatBtn = document.getElementById('f5-cagri-kapat-btn');
    const cagriMuteBtn = document.getElementById('f5-cagri-mute-btn');
    const cagriMuteMetin = document.getElementById('f5-cagri-mute-metin');
    let yerelSesStream = null;
    let gonderilenSesStream = null;
    let gurultuAudioCtx = null;
    let gurultuDryGain = null;
    let gurultuWetGain = null;
    let peerBaglantilar = {};
    let uzakSesElementleri = {};
    let aktifCagriTuru = null;
    let aktifCagriDurumu = null;
    let aktifCagriDmKok = null;
    let aktifCagriGrupOdaId = null;
    let aktifCagriKarsiAd = null;
    let aktifCagriBaslamaZamani = null;
    let cagriSureInterval = null;
    let cagriZamanAsimiTimer = null;
    let cagriKapanisSureci = false;
    let sesKapaliMi = false;
    let aktifCagriAvatarDinleyici = null;
    let aktifCagriKokDinleyici = null;
    let grupCagriDinlenenOdalar = new Set();
    let grupCagriKatilimciListeleri = {};
    let grupCagriKatilimciKaldirmaListeleri = {};
    let aramaOncesiSesSeviyeleri = [];
    let sesDuckingAktif = false;

    function yayinSesiniKis() {
        if (sesDuckingAktif) return;
        sesDuckingAktif = true;
        aramaOncesiSesSeviyeleri = [];
        document.querySelectorAll('video, audio').forEach((el) => {
            if (el.closest('#f5-modern-container')) return;
            aramaOncesiSesSeviyeleri.push({ el, volume: el.volume, muted: el.muted });
            try { el.volume = Math.min(el.volume, 0.1); } catch(e) {}
        });
    }
    function yayinSesiniGeriYukle() {
        if (!sesDuckingAktif) return;
        sesDuckingAktif = false;
        aramaOncesiSesSeviyeleri.forEach(({ el, volume, muted }) => {
            try { el.volume = volume; el.muted = muted; } catch(e) {}
        });
        aramaOncesiSesSeviyeleri = [];
    }
    function canliKullaniciAvatarBul(username) {
        const obj = (tumAktifKullanicilar || []).find(u => u.username === username);
        return (obj && obj.avatar) ? obj.avatar : null;
    }
    function cagriAvatariCiz(url, harfKaynagi) {
        if (url) cagriAvatarWrap.innerHTML = `<img src="${url}" class="f5-call-avatar-img">`;
        else cagriAvatarWrap.innerHTML = `<span class="f5-call-avatar-harf">${(harfKaynagi || '?').charAt(0).toUpperCase()}</span>`;
    }
    function dmCagriAvatarDinlemesiBaslat(username) {
        cagriAvatariCiz(canliKullaniciAvatarBul(username), username);
        if (!db) return;
        const guvenliHedef = anahtarGuvenliYap(username);
        const ref = db.ref(`aktifKullanicilar/${guvenliHedef}`);
        const fn = snap => {
            const veri = snap.val();
            cagriAvatariCiz((veri && veri.avatar) ? veri.avatar : null, username);
        };
        ref.on('value', fn);
        aktifCagriAvatarDinleyici = { ref, fn };
    }
    function grupCagriAvatarDinlemesiBaslat(odaId, grupAdi) {
        cagriAvatariCiz(null, grupAdi);
        if (!db) return;
        const ref = db.ref(`sohbetOdasi/${odaId}/avatar`);
        const fn = snap => cagriAvatariCiz(snap.val() || null, grupAdi);
        ref.on('value', fn);
        aktifCagriAvatarDinleyici = { ref, fn };
    }
    function cagriAvatarDinlemesiniDurdur() {
        if (aktifCagriAvatarDinleyici) {
            aktifCagriAvatarDinleyici.ref.off('value', aktifCagriAvatarDinleyici.fn);
            aktifCagriAvatarDinleyici = null;
        }
    }
    function gurultuEngelleyiciDurumunuUygula() {
        if (!gurultuAudioCtx || !gurultuDryGain || !gurultuWetGain) return;
        const acik = localStorage.getItem('kick_f5_gurultu_engelleyici') !== 'kapali';
        const simdi = gurultuAudioCtx.currentTime;
        gurultuDryGain.gain.setTargetAtTime(acik ? 0 : 1, simdi, 0.01);
        gurultuWetGain.gain.setTargetAtTime(acik ? 1 : 0, simdi, 0.01);
    }
    function gurultuEngelleyiciZinciriKur(stream) {
        try {
            gurultuAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const kaynak = gurultuAudioCtx.createMediaStreamSource(stream);
            gurultuDryGain = gurultuAudioCtx.createGain();
            const highpass = gurultuAudioCtx.createBiquadFilter();
            highpass.type = 'highpass'; highpass.frequency.value = 150; highpass.Q.value = 0.8;
            const lowpass = gurultuAudioCtx.createBiquadFilter();
            lowpass.type = 'lowpass'; lowpass.frequency.value = 7200;
            const compressor = gurultuAudioCtx.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-42, gurultuAudioCtx.currentTime);
            compressor.knee.setValueAtTime(18, gurultuAudioCtx.currentTime);
            compressor.ratio.setValueAtTime(14, gurultuAudioCtx.currentTime);
            compressor.attack.setValueAtTime(0.002, gurultuAudioCtx.currentTime);
            compressor.release.setValueAtTime(0.16, gurultuAudioCtx.currentTime);
            const kapiProsesoru = gurultuAudioCtx.createScriptProcessor(1024, 1, 1);
            let kapiKazanci = 1;
            kapiProsesoru.onaudioprocess = (e) => {
                const girisVeri = e.inputBuffer.getChannelData(0);
                const cikisVeri = e.outputBuffer.getChannelData(0);
                let karesiToplam = 0;
                for (let i = 0; i < girisVeri.length; i++) karesiToplam += girisVeri[i] * girisVeri[i];
                const rms = Math.sqrt(karesiToplam / girisVeri.length);
                const hedefKazanc = rms > 0.028 ? 1 : 0.02;
                const gecisKatsayisi = hedefKazanc < kapiKazanci ? 0.65 : 0.12;
                for (let i = 0; i < girisVeri.length; i++) {
                    kapiKazanci += (hedefKazanc - kapiKazanci) * gecisKatsayisi;
                    cikisVeri[i] = girisVeri[i] * kapiKazanci;
                }
            };
            gurultuWetGain = gurultuAudioCtx.createGain();
            const cikisNode = gurultuAudioCtx.createMediaStreamDestination();
            kaynak.connect(gurultuDryGain).connect(cikisNode);
            kaynak.connect(highpass).connect(lowpass).connect(compressor).connect(kapiProsesoru).connect(gurultuWetGain).connect(cikisNode);
            gurultuEngelleyiciDurumunuUygula();
            gonderilenSesStream = cikisNode.stream;
            return gonderilenSesStream;
        } catch (e) {
            gonderilenSesStream = stream;
            return stream;
        }
    }
    async function mikrofonAl() {
        if (yerelSesStream) return yerelSesStream;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const hata = new Error('Mikrofon API yok');
            hata.name = 'NotSupported';
            throw hata;
        }
        try {
            yerelSesStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, autoGainControl: true },
                video: false
            });
            gurultuEngelleyiciZinciriKur(yerelSesStream);
        } catch (e) { throw e; }
        return yerelSesStream;
    }
    function uzakSesEkle(anahtar, stream) {
        let audioEl = uzakSesElementleri[anahtar];
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
            uzakSesElementleri[anahtar] = audioEl;
        }
        audioEl.srcObject = stream;
    }
    function peerOlustur(uzakAnahtar, adayYaziYolu) {
        const pc = new RTCPeerConnection(ICE_SUNUCULAR);
        pc._adayKuyrugu = [];
        if (gonderilenSesStream) gonderilenSesStream.getTracks().forEach(tr => pc.addTrack(tr, gonderilenSesStream));
        else if (yerelSesStream) yerelSesStream.getTracks().forEach(tr => pc.addTrack(tr, yerelSesStream));
        pc.onicecandidate = (e) => {
            if (e.candidate && db) db.ref(adayYaziYolu).push(e.candidate.toJSON());
        };
        pc.ontrack = (e) => uzakSesEkle(uzakAnahtar, e.streams[0]);
        pc.addIceCandidateGuvenli = (c) => {
            if (pc.remoteDescription && pc.remoteDescription.type) {
                pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            } else pc._adayKuyrugu.push(c);
        };
        peerBaglantilar[uzakAnahtar] = pc;
        return pc;
    }
    function kuyruktakiAdaylariBosalt(pc) {
        (pc._adayKuyrugu || []).forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
        pc._adayKuyrugu = [];
    }
    function adayDinle(dinleYolu, pc) {
        if (!db) return;
        db.ref(dinleYolu).on('value', snap => {
            const adaylar = snap.val() || {};
            Object.values(adaylar).forEach(c => { if (c) pc.addIceCandidateGuvenli(c); });
        });
    }
    function peerKapat(anahtar) {
        if (peerBaglantilar[anahtar]) {
            try { peerBaglantilar[anahtar].close(); } catch (e) {}
            delete peerBaglantilar[anahtar];
        }
        if (uzakSesElementleri[anahtar]) {
            uzakSesElementleri[anahtar].srcObject = null;
            uzakSesElementleri[anahtar].remove();
            delete uzakSesElementleri[anahtar];
        }
    }
    function cagriPanelGoster(durum, isim) {
        yayinSesiniKis();
        if (acilDurumModu) {
            cagriOverlay.classList.add('f5-acil-arkaplan');
            const nedenHtml = aktifAcilNeden
                ? `<span style="color:#ffd7d7; font-size:12px; font-weight:600; display:block; margin-top:6px; line-height:1.4; max-width:260px; margin-left:auto; margin-right:auto; word-break:break-word;">💬 "${aktifAcilNeden}"</span>`
                : '';
            cagriIsimEl.innerHTML = `🚨 ${isim} <span style="color:#ff4c4c; font-size:12px; display:block;">ACİL DURUM ARAMASI</span>${nedenHtml}`;
            cagriIsimEl.style.color = '#ff6b6b';
            if (durum === 'gelen') acilNedeniSesliOku(aktifAcilNeden, isim);
            if (!acilDurumSesCalıyor && !acilDurumSirenTimer) acilDurumSesiniBaslat();
            if (acilDurumAutoplayEngellendi) {
                let uyariBtn = document.getElementById('f5-acil-ses-baslat-btn');
                if (!uyariBtn) {
                    uyariBtn = document.createElement('button');
                    uyariBtn.id = 'f5-acil-ses-baslat-btn';
                    uyariBtn.textContent = '🔊 Acil Durum Sesini Başlat';
                    uyariBtn.style.cssText = 'position: absolute; top: 14px; left: 50%; transform: translateX(-50%); background: #ff4c4c; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer; z-index: 10; box-shadow: 0 4px 12px rgba(255,76,76,0.5);';
                    uyariBtn.onclick = acilDurumSesiKullaniciEtkilesimiyleBaslat;
                    cagriOverlay.appendChild(uyariBtn);
                }
                uyariBtn.style.display = 'block';
            }
            if (masaustuBildirimAcik && Notification.permission === 'granted') {
                masaustuBildirimGoster('🚨 ACİL DURUM ARAMASI', `${isim} sizi arıyor!`, null);
            }
        } else {
            cagriOverlay.classList.remove('f5-acil-arkaplan');
            cagriOverlay.style.background = '';
            cagriIsimEl.textContent = isim;
            cagriIsimEl.style.color = '';
            const uyariBtn = document.getElementById('f5-acil-ses-baslat-btn');
            if (uyariBtn) uyariBtn.style.display = 'none';
            if (masaustuBildirimAcik && Notification.permission === 'granted' && durum === 'gelen') {
                masaustuBildirimGoster('📞 Gelen Arama', `${isim} sizi arıyor`, null);
            }
        }
        aktifCagriDurumu = durum;
        cagriOverlay.classList.add('show');
        cagriGidenBtns.style.display = durum === 'giden' ? 'flex' : 'none';
        cagriGelenBtns.style.display = durum === 'gelen' ? 'flex' : 'none';
        cagriAktifBtns.style.display = durum === 'aktif' ? 'flex' : 'none';
        cagriOverlay.classList.toggle('f5-cagri-ringing', durum === 'giden' || durum === 'gelen');
        if (durum === 'gelen' && !acilDurumModu) zilCalmayaBasla();
        else zilCalmayiDurdur();
        if (durum === 'giden') cagriDurumEl.textContent = t('cagri_ariyor');
        else if (durum === 'gelen') {
            cagriDurumEl.textContent = aktifCagriTuru === 'grup' ? t('cagri_gelen_grup') : t('cagri_gelen_dm');
            cagriKabulMetin.textContent = aktifCagriTuru === 'grup' ? t('cagri_katil_btn') : t('cagri_kabul_btn');
        }
        if (aktifCagriTuru === 'grup') grupCagriAvatarDinlemesiBaslat(aktifCagriGrupOdaId, isim);
        else dmCagriAvatarDinlemesiBaslat(isim);
    }
    function cagriBaglandi() {
        acilNedenSesiniDurdur();
        if (acilDurumModu) {
            acilDurumSesiniDurdur();
            const uyariBtn = document.getElementById('f5-acil-ses-baslat-btn');
            if (uyariBtn) uyariBtn.remove();
        }
        aktifCagriDurumu = 'aktif';
        aktifCagriBaslamaZamani = Date.now();
        cagriGidenBtns.style.display = 'none';
        cagriGelenBtns.style.display = 'none';
        cagriAktifBtns.style.display = 'flex';
        cagriOverlay.classList.remove('f5-cagri-ringing');
        zilCalmayiDurdur();
        if (aktifCagriTuru === 'grup') grupKatilimciSayisiGuncelle(aktifCagriGrupOdaId);
        else {
            cagriDurumEl.textContent = '00:00';
            if (cagriSureInterval) clearInterval(cagriSureInterval);
            cagriSureInterval = setInterval(() => {
                const s = Math.floor((Date.now() - aktifCagriBaslamaZamani) / 1000);
                const dk = String(Math.floor(s / 60)).padStart(2, '0');
                const sn = String(s % 60).padStart(2, '0');
                cagriDurumEl.textContent = `${dk}:${sn}`;
            }, 1000);
        }
    }
    function cagriReddedildiGoster(cagriKokYolu) {
        if (cagriZamanAsimiTimer) { clearTimeout(cagriZamanAsimiTimer); cagriZamanAsimiTimer = null; }
        zilCalmayiDurdur();
        cagriOverlay.classList.remove('f5-cagri-ringing');
        cagriGidenBtns.style.display = 'none';
        cagriGelenBtns.style.display = 'none';
        cagriAktifBtns.style.display = 'none';
        cagriDurumEl.textContent = t('cagri_reddedildi');
        setTimeout(() => {
            if (cagriKokYolu && db) db.ref(cagriKokYolu).remove().catch(() => {});
            cagriBitir();
        }, 1600);
    }
    function cagriZamanAsimindaKapat(cagriKokYolu) {
        zilCalmayiDurdur();
        cagriOverlay.classList.remove('f5-cagri-ringing');
        cagriGidenBtns.style.display = 'none';
        cagriGelenBtns.style.display = 'none';
        cagriAktifBtns.style.display = 'none';
        cagriDurumEl.textContent = t('cagri_cevap_yok');
        setTimeout(() => {
            if (cagriKokYolu && db) db.ref(cagriKokYolu).remove().catch(() => {});
            cagriBitir();
        }, 1400);
    }
    function cagriBitir() {
        try {
            yayinSesiniGeriYukle();
            acilDurumSesiniDurdur();
            acilNedenSesiniDurdur();
            aktifAcilNeden = '';
            acilDurumNedeni = '';
            acilDurumModu = false;
            const uyariBtnTemizle = document.getElementById('f5-acil-ses-baslat-btn');
            if (uyariBtnTemizle) uyariBtnTemizle.remove();
            cagriOverlay.classList.remove('f5-acil-arkaplan');
            cagriOverlay.style.background = '';
            cagriIsimEl.style.color = '';
            Object.keys(peerBaglantilar).forEach(peerKapat);
            peerBaglantilar = {};
            uzakSesElementleri = {};
            if (yerelSesStream) { yerelSesStream.getTracks().forEach(tr => tr.stop()); yerelSesStream = null; }
            if (gonderilenSesStream) { gonderilenSesStream.getTracks().forEach(tr => tr.stop()); gonderilenSesStream = null; }
            if (gurultuAudioCtx) {
                gurultuAudioCtx.close().catch(() => {});
                gurultuAudioCtx = null;
                gurultuDryGain = null;
                gurultuWetGain = null;
            }
            cagriAvatarDinlemesiniDurdur();
            if (cagriSureInterval) { clearInterval(cagriSureInterval); cagriSureInterval = null; }
            if (cagriZamanAsimiTimer) { clearTimeout(cagriZamanAsimiTimer); cagriZamanAsimiTimer = null; }
            cagriKapanisSureci = false;
            if (aktifCagriKokDinleyici) {
                try { aktifCagriKokDinleyici.ref.off('value', aktifCagriKokDinleyici.fn); } catch(e) {}
                aktifCagriKokDinleyici = null;
            }
            if (aktifCagriTuru === 'grup' && aktifCagriGrupOdaId && mevcutKullaniciAdi) {
                try { db.ref(`grupCagri/${aktifCagriGrupOdaId}/katilimcilar/${anahtarGuvenliYap(mevcutKullaniciAdi)}`).remove(); } catch(e) {}
            }
            sesKapaliMi = false;
            cagriMuteMetin.textContent = t('cagri_sesi_kapat');
            cagriMuteBtn.classList.remove('f5-cagri-muted');
            aktifCagriTuru = null;
            aktifCagriDurumu = null;
            aktifCagriDmKok = null;
            aktifCagriGrupOdaId = null;
            aktifCagriKarsiAd = null;
            cagriOverlay.classList.remove('show');
            cagriOverlay.classList.remove('f5-cagri-ringing');
            zilCalmayiDurdur();
        } catch(e) {}
    }
    cagriMuteBtn.addEventListener('click', () => {
        sesKapaliMi = !sesKapaliMi;
        if (yerelSesStream) yerelSesStream.getAudioTracks().forEach(tr => tr.enabled = !sesKapaliMi);
        cagriMuteMetin.textContent = sesKapaliMi ? t('cagri_sesi_ac') : t('cagri_sesi_kapat');
        cagriMuteBtn.classList.toggle('f5-cagri-muted', sesKapaliMi);
    });
    cagriKapatBtn.addEventListener('click', () => {
        try { if (aktifCagriTuru === 'dm' && aktifCagriDmKok) db.ref(aktifCagriDmKok).remove(); } catch(e) {}
        try { cagriBitir(); } catch(e) {}
    });
    cagriIptalBtn.addEventListener('click', () => {
        try { if (aktifCagriTuru === 'dm' && aktifCagriDmKok) db.ref(aktifCagriDmKok).remove(); } catch(e) {}
        try { cagriBitir(); } catch(e) {}
    });
    function dmAramaBaslat(hedefKullanici) {
        if (!db || !mevcutKullaniciAdi) return;
        if (aktifCagriTuru) { toastGoster(t('cagri_zaten_aramada'), 'uyari'); return; }
        const guvenliHedef = anahtarGuvenliYap(hedefKullanici);
        const cagriKok = `sesliCagri/${guvenliHedef}`;
        aktifCagriTuru = 'dm';
        aktifCagriDmKok = cagriKok;
        aktifCagriKarsiAd = hedefKullanici;
        aktifAcilNeden = acilDurumModu === true ? (acilDurumNedeni || '') : '';
        cagriPanelGoster('giden', hedefKullanici);
        mikrofonAl().then(async () => {
            try {
                const pc = peerOlustur(guvenliHedef, `${cagriKok}/sinyal/adaylarArayan`);
                adayDinle(`${cagriKok}/sinyal/adaylarAranan`, pc);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await db.ref(`${cagriKok}/gelen`).set({
                    arayan: mevcutKullaniciAdi,
                    ts: firebase.database.ServerValue.TIMESTAMP,
                    acil: acilDurumModu === true,
                    neden: acilDurumModu === true ? (acilDurumNedeni || null) : null
                });
                await db.ref(`${cagriKok}/sinyal/offer`).set({ sdp: offer.sdp, type: offer.type });
                if (cagriZamanAsimiTimer) clearTimeout(cagriZamanAsimiTimer);
                cagriZamanAsimiTimer = setTimeout(() => {
                    if (aktifCagriTuru === 'dm' && aktifCagriDmKok === cagriKok && aktifCagriDurumu === 'giden' && !cagriKapanisSureci) {
                        cagriKapanisSureci = true;
                        cagriZamanAsimindaKapat(cagriKok);
                    }
                }, 120000);
                db.ref(`${cagriKok}/sinyal/answer`).on('value', async snap => {
                    const cevap = snap.val();
                    if (cevap && pc.signalingState !== 'stable') {
                        if (cagriZamanAsimiTimer) { clearTimeout(cagriZamanAsimiTimer); cagriZamanAsimiTimer = null; }
                        await pc.setRemoteDescription(new RTCSessionDescription(cevap));
                        kuyruktakiAdaylariBosalt(pc);
                        cagriBaglandi();
                    }
                });
                const kokRef = db.ref(cagriKok);
                const kokFn = snap => {
                    if (aktifCagriTuru !== 'dm' || aktifCagriDmKok !== cagriKok) return;
                    const veri = snap.val();
                    if (veri === null) { cagriBitir(); return; }
                    if (veri.durum === 'reddedildi' && aktifCagriDurumu !== 'aktif' && !cagriKapanisSureci) {
                        cagriKapanisSureci = true;
                        cagriReddedildiGoster(cagriKok);
                    }
                };
                kokRef.on('value', kokFn);
                aktifCagriKokDinleyici = { ref: kokRef, fn: kokFn };
            } catch (e) {
                toastGoster('Arama başlatılamadı: ' + (e && e.message ? e.message : e), 'hata');
                aktifCagriTuru = null; aktifCagriDmKok = null; aktifCagriKarsiAd = null;
                cagriOverlay.classList.remove('show');
                cagriAvatarDinlemesiniDurdur();
                yayinSesiniGeriYukle();
            }
        }).catch((e) => {
            toastGoster(t('cagri_mikrofon_hata') + '\n(' + (e && e.name ? e.name : 'bilinmeyen') + ')', 'hata');
            aktifCagriTuru = null; aktifCagriDmKok = null; aktifCagriKarsiAd = null;
            cagriOverlay.classList.remove('show');
            cagriAvatarDinlemesiniDurdur();
            yayinSesiniGeriYukle();
        });
    }
    function dmGelenAramaDinle() {
        if (!db || !mevcutKullaniciAdi) return;
        const guvenliBen = anahtarGuvenliYap(mevcutKullaniciAdi);
        db.ref(`sesliCagri/${guvenliBen}/gelen`).on('value', snap => {
            const veri = snap.val();
            if (veri && !aktifCagriTuru) {
                const yas = Date.now() - (veri.ts || 0);
                if (yas > 120000) { db.ref(`sesliCagri/${guvenliBen}`).remove(); return; }
                const arayanBeyazListede = beyazListedeMi(veri.arayan);
                if (veri.acil === true || arayanBeyazListede) {
                    if (mevcutKullaniciAdi !== ADMIN_KULLANICI_ADI) {
                        acilDurumModu = true;
                        acilDurumSesiniBaslat();
                    } else acilDurumModu = true;
                }
                const cagriKok = `sesliCagri/${guvenliBen}`;
                aktifCagriTuru = 'dm';
                aktifCagriDmKok = cagriKok;
                aktifCagriKarsiAd = veri.arayan;
                aktifAcilNeden = (veri.acil === true || arayanBeyazListede) ? (veri.neden || '') : '';
                cagriPanelGoster('gelen', veri.arayan);
                const kokRef = db.ref(cagriKok);
                const kokFn = snap2 => {
                    if (snap2.val() === null && aktifCagriTuru === 'dm' && aktifCagriDmKok === cagriKok) cagriBitir();
                };
                kokRef.on('value', kokFn);
                aktifCagriKokDinleyici = { ref: kokRef, fn: kokFn };
            }
        });
    }
    cagriReddetBtn.addEventListener('click', () => {
        try {
            yayinSesiniGeriYukle();
            acilNedenSesiniDurdur();
            if (acilDurumModu) acilDurumSesiniDurdur();
            if (aktifCagriTuru === 'dm' && aktifCagriDmKok) {
                const kapanacakKok = aktifCagriDmKok;
                try { db.ref(`${kapanacakKok}/durum`).set('reddedildi'); } catch(e) {}
            }
        } catch(e) {}
        try { cagriBitir(); } catch(e) {}
    });
    cagriKabulBtn.addEventListener('click', async () => {
        if (aktifCagriDurumu !== 'gelen') return;
        if (aktifCagriTuru === 'grup') {
            try { await mikrofonAl(); } catch (e) {
                toastGoster(t('cagri_mikrofon_hata') + '\n(' + (e && e.name ? e.name : 'bilinmeyen') + ')', 'hata');
                cagriBitir();
                return;
            }
            const odaId = aktifCagriGrupOdaId;
            cagriPanelGoster('aktif', aktifCagriKarsiAd);
            cagriBaglandi();
            grupKatilimciNoduGirisiYap(odaId);
            grupMeshBaglantilariniKur(odaId);
            return;
        }
        if (aktifCagriTuru !== 'dm' || !aktifCagriDmKok) return;
        const cagriKok = aktifCagriDmKok;
        try { await mikrofonAl(); } catch (e) {
            toastGoster(t('cagri_mikrofon_hata') + '\n(' + (e && e.name ? e.name : 'bilinmeyen') + ')', 'hata');
            cagriBitir();
            return;
        }
        try {
            const snap = await db.ref(`${cagriKok}/gelen`).once('value');
            const veri = snap.val();
            if (!veri) { cagriBitir(); return; }
            const guvenliArayan = anahtarGuvenliYap(veri.arayan);
            const offerSnap = await db.ref(`${cagriKok}/sinyal/offer`).once('value');
            const offer = offerSnap.val();
            if (!offer) { cagriBitir(); return; }
            const pc = peerOlustur(guvenliArayan, `${cagriKok}/sinyal/adaylarAranan`);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            kuyruktakiAdaylariBosalt(pc);
            adayDinle(`${cagriKok}/sinyal/adaylarArayan`, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await db.ref(`${cagriKok}/sinyal/answer`).set({ sdp: answer.sdp, type: answer.type });
            cagriPanelGoster('aktif', aktifCagriKarsiAd);
            cagriBaglandi();
        } catch (e) {
            toastGoster('Arama kabul edilemedi: ' + (e && e.message ? e.message : e), 'hata');
            cagriBitir();
        }
    });
    async function grupAramaBaslat(odaId, grupAdi) {
        if (!db || !mevcutKullaniciAdi) return;
        if (aktifCagriTuru) { toastGoster(t('cagri_zaten_aramada'), 'uyari'); return; }
        try { await mikrofonAl(); } catch (e) {
            toastGoster(t('cagri_mikrofon_hata') + '\n(' + (e && e.name ? e.name : 'bilinmeyen') + ')', 'hata');
            return;
        }
        aktifCagriTuru = 'grup';
        aktifCagriGrupOdaId = odaId;
        aktifCagriKarsiAd = grupAdi;
        try {
            const kokRef = db.ref(`grupCagri/${odaId}`);
            const mevcutSnap = await kokRef.once('value');
            if (!mevcutSnap.val()) {
                await kokRef.set({
                    baslatan: mevcutKullaniciAdi,
                    baslangic: firebase.database.ServerValue.TIMESTAMP,
                    acil: acilDurumModu === true,
                    neden: acilDurumModu === true ? (acilDurumNedeni || null) : null
                });
            }
        } catch (e) {
            toastGoster('Grup araması başlatılamadı: ' + (e && e.message ? e.message : e), 'hata');
            aktifCagriTuru = null; aktifCagriGrupOdaId = null; aktifCagriKarsiAd = null;
            return;
        }
        aktifAcilNeden = acilDurumModu === true ? (acilDurumNedeni || '') : '';
        cagriPanelGoster('aktif', grupAdi);
        cagriBaglandi();
        grupKatilimciNoduGirisiYap(odaId);
        grupMeshBaglantilariniKur(odaId);
    }
    function grupCagriGelenDinle(odaId, grupAdi) {
        if (!db || !mevcutKullaniciAdi || grupCagriDinlenenOdalar.has(odaId)) return;
        grupCagriDinlenenOdalar.add(odaId);
        db.ref(`grupCagri/${odaId}`).on('value', snap => {
            const veri = snap.val();
            const guvenliBen = anahtarGuvenliYap(mevcutKullaniciAdi);
            const benZatenKatilimciMiyim = !!(veri && veri.katilimcilar && veri.katilimcilar[guvenliBen]);
            if (veri && !benZatenKatilimciMiyim && !aktifCagriTuru) {
                const yas = Date.now() - (veri.baslangic || 0);
                if (yas > 300000) { db.ref(`grupCagri/${odaId}`).remove().catch(() => {}); return; }
                const baslatanBeyazListede = beyazListedeMi(veri.baslatan);
                if (veri.acil === true || baslatanBeyazListede) {
                    if (mevcutKullaniciAdi !== ADMIN_KULLANICI_ADI) {
                        acilDurumModu = true;
                        acilDurumSesiniBaslat();
                    } else acilDurumModu = true;
                }
                aktifCagriTuru = 'grup';
                aktifCagriGrupOdaId = odaId;
                aktifCagriKarsiAd = grupAdi;
                aktifAcilNeden = (veri.acil === true || baslatanBeyazListede) ? (veri.neden || '') : '';
                cagriPanelGoster('gelen', grupAdi);
                const kokRef = db.ref(`grupCagri/${odaId}`);
                const kokFn = snap2 => {
                    if (snap2.val() === null && aktifCagriTuru === 'grup' && aktifCagriGrupOdaId === odaId && aktifCagriDurumu === 'gelen') cagriBitir();
                };
                kokRef.on('value', kokFn);
                aktifCagriKokDinleyici = { ref: kokRef, fn: kokFn };
            }
        });
    }
    function grupKatilimciNoduGirisiYap(odaId) {
        const guvenliBen = anahtarGuvenliYap(mevcutKullaniciAdi);
        const kendiRef = db.ref(`grupCagri/${odaId}/katilimcilar/${guvenliBen}`);
        kendiRef.set({ username: mevcutKullaniciAdi, ts: firebase.database.ServerValue.TIMESTAMP });
        kendiRef.onDisconnect().remove();
    }
    function grupMeshBaglantilariniKur(odaId) {
        const guvenliBen = anahtarGuvenliYap(mevcutKullaniciAdi);
        const katilimcilarRef = db.ref(`grupCagri/${odaId}/katilimcilar`);
        const eklenmeFn = snap => {
            const guvenliDiger = snap.key;
            const veri = snap.val();
            if (!veri || guvenliDiger === guvenliBen || peerBaglantilar[guvenliDiger]) {
                if (guvenliDiger !== guvenliBen) grupKatilimciSayisiGuncelle(odaId);
                return;
            }
            grupKatilimciSayisiGuncelle(odaId);
            const ciftAnahtar = [guvenliBen, guvenliDiger].sort().join('__');
            const sinyalYolu = `grupCagri/${odaId}/sinyal/${ciftAnahtar}`;
            const benTeklifVereyimMi = guvenliBen < guvenliDiger;
            if (benTeklifVereyimMi) {
                const pc = peerOlustur(guvenliDiger, `${sinyalYolu}/adaylarA`);
                adayDinle(`${sinyalYolu}/adaylarB`, pc);
                pc.createOffer().then(offer => pc.setLocalDescription(offer).then(() => {
                    db.ref(`${sinyalYolu}/offer`).set({ sdp: offer.sdp, type: offer.type });
                }));
                db.ref(`${sinyalYolu}/answer`).on('value', async snap2 => {
                    const cevap = snap2.val();
                    if (cevap && pc.signalingState !== 'stable') {
                        await pc.setRemoteDescription(new RTCSessionDescription(cevap));
                        kuyruktakiAdaylariBosalt(pc);
                    }
                });
            } else {
                const pc = peerOlustur(guvenliDiger, `${sinyalYolu}/adaylarB`);
                adayDinle(`${sinyalYolu}/adaylarA`, pc);
                db.ref(`${sinyalYolu}/offer`).on('value', async snap2 => {
                    const offer = snap2.val();
                    if (offer && !pc._cevapVerildi) {
                        pc._cevapVerildi = true;
                        await pc.setRemoteDescription(new RTCSessionDescription(offer));
                        kuyruktakiAdaylariBosalt(pc);
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        db.ref(`${sinyalYolu}/answer`).set({ sdp: answer.sdp, type: answer.type });
                    }
                });
            }
        };
        const cikmaFn = snap => {
            const guvenliDiger = snap.key;
            peerKapat(guvenliDiger);
            grupKatilimciSayisiGuncelle(odaId);
        };
        katilimcilarRef.on('child_added', eklenmeFn);
        katilimcilarRef.on('child_removed', cikmaFn);
        grupCagriKatilimciListeleri[odaId] = { ref: katilimcilarRef, fn: eklenmeFn };
        grupCagriKatilimciKaldirmaListeleri[odaId] = { ref: katilimcilarRef, fn: cikmaFn };
    }
    function grupKatilimciSayisiGuncelle(odaId) {
        if (!db) return;
        db.ref(`grupCagri/${odaId}/katilimcilar`).once('value', snap => {
            const n = snap.val() ? Object.keys(snap.val()).length : 0;
            if (aktifCagriTuru === 'grup' && aktifCagriGrupOdaId === odaId && aktifCagriDurumu === 'aktif') {
                cagriDurumEl.textContent = `${n} ${t('cagri_kisi_gorusmede')}`;
            }
        });
    }

    window.addEventListener('error', (e) => {
        console.error('[Kick F5] Yakalanan hata:', e.error || e.message);
    });
    window.addEventListener('unhandledrejection', (e) => {
        console.error('[Kick F5] İşlenmeyen promise hatası:', e.reason);
    });

    fbBaslat();
})();
