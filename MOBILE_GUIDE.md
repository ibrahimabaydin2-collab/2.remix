# 📱 Kelime Savaşı - Mobil APK & Google Play (AAB) Kurulum Kılavuzu

Bu kılavuz, **Kelime Savaşı** oyununu bir Android telefona/tablete yüklemek için nasıl **APK** dosyası haline getireceğinizi ve Google Play Store'a yüklemeye hazır **AAB** paketini nasıl oluşturacağınızı adım adım açıklamaktadır.

Sizin için projenize **Capacitor** entegrasyonu yaptık ve **GitHub Actions** ile otomatik bulut derleme altyapısı kurduk. Böylece bilgisayarınızda hiçbir kodlama programı kurmanıza gerek kalmadan doğrudan GitHub üzerinden mobil uygulamanızı oluşturabileceksiniz!

---

## 🚀 1. Adım: Projeyi GitHub Hesabınıza Aktarma

Google AI Studio arayüzündeki ayarlar menüsünü kullanarak projeyi GitHub hesabınıza aktarmanız gerekmektedir:

1. Ekranın sağ üst köşesinde yer alan **Ayarlar (Settings / Gear icon)** veya **Export (Dışa Aktar)** butonuna tıklayın.
2. **Export to GitHub** (GitHub'a Aktar) seçeneğini seçin.
3. GitHub hesabınızı bağlayın ve projeniz için yeni bir repository (depo) oluşturarak dosyaları aktarın.

---

## 🛠️ 2. Adım: GitHub Actions ile Otomatik APK & AAB Derleme

Kodu GitHub'a aktardığınız anda, sizin için hazırladığımız otomatik derleme sistemi devreye girecektir. Kendi APK ve AAB dosyalarınızı indirmek için:

1. Tarayıcınızda GitHub deponuza (repository) gidin.
2. Üst menüden **Actions** (Eylemler) sekmesine tıklayın.
3. Sol menüde **"Android APK & AAB Derleyici"** isimli iş akışını göreceksiniz, ona tıklayın.
4. Eğer otomatik olarak başlamadıysa, sağ tarafta bulunan **Run workflow** (İş akışını çalıştır) butonuna basarak derlemeyi başlatın.
5. Derleme işlemi yaklaşık 2-4 dakika sürecektir. İşlem bittiğinde yeşil bir onay işareti göreceksiniz.
6. Tamamlanan derleme kaydına tıkladığınızda alt kısımda **Artifacts** (Çıktılar) bölümünde şu dosyaları göreceksiniz:
   * **`KelimeSavasi-Mobil-APK`**: Doğrudan telefonunuza indirip kurabileceğiniz dosyadır.
   * **`KelimeSavasi-PlayStore-AAB`**: Google Play Store'a yükleyebileceğiniz resmi Android App Bundle (AAB) paketidir.

---

## 📲 3. Adım: APK Dosyasını Telefonunuza Yükleme

1. GitHub Actions sayfasından indirdiğiniz **`KelimeSavasi-Mobil-APK.zip`** dosyasını çıkartın ve içindeki **`app-debug.apk`** dosyasını telefonunuza gönderin (veya doğrudan telefondan indirip açın).
2. APK dosyasını açtığınızda telefonunuz *"Bilinmeyen kaynaklardan uygulama yükleme"* izni isteyebilir. Bu izni onaylayarak yükleme işlemini tamamlayın.
3. Kelime Savaşı artık telefonunuzun ana ekranında ve menüsünde kendi özel logosuyla yer alacaktır!

---

## ⚙️ Uygulama Bilgilerini Özelleştirme

Eğer uygulamanın paket adını veya Play Store'da gözükecek adını değiştirmek isterseniz, ana dizindeki `capacitor.config.ts` dosyasını düzenleyebilirsiniz:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kelimesavasi.app', // Google Play'deki benzersiz paket kimliğiniz
  appName: 'Kelime Savaşı',      // Telefon menüsünde gözükecek uygulama adı
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

---

*Bol şanslar ve iyi oyunlar! 🎮✨*
