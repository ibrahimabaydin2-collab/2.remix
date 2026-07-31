import React, { useState } from 'react';
import { Shield, X, Mail, ChevronRight, Send, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { getApiUrl } from '../utils/api';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  const [activeLang, setActiveLang] = useState<'tr' | 'en'>('tr');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<'bug' | 'suggestion' | 'deletion' | 'other'>('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!isOpen) return null;

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setSubmitSuccess(false);
    setSubmitError('');

    try {
      let username = 'Guest';
      let userId = 'unknown';
      try {
        const localSaved = window.localStorage.getItem('kelimesavasi_profile');
        if (localSaved) {
          const parsed = JSON.parse(localSaved);
          if (parsed) {
            username = parsed.name || 'Guest';
            userId = parsed.id || 'unknown';
          }
        }
      } catch (err) {}

      const response = await fetch(getApiUrl('/api/support'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          category,
          message: message.trim(),
          username,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const data = await response.json();
      if (data.success) {
        setSubmitSuccess(true);
        setMessage('');
        setEmail('');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Contact submission failed:', err);
      setSubmitError(
        activeLang === 'tr'
          ? 'Mesajınız gönderilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.'
          : 'Failed to send message. Please check your internet connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="card-theme border border-white/10 rounded-[2.2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] bg-[#161D2B] text-slate-100 transition-all duration-300">
        
        {/* Header */}
        <div className="flex-none px-6 py-5 border-b border-white/5 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
              <Shield size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-md font-black tracking-tight text-white uppercase">
                {activeLang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                {activeLang === 'tr' ? 'KELİME SAVAŞI MOBİL UYGULAMASI' : 'KELİME SAVASI MOBILE APPLICATION'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5 text-[10px]">
              <button
                type="button"
                onClick={() => setActiveLang('tr')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  activeLang === 'tr' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
                }`}
              >
                TR
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('en')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  activeLang === 'en' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-white/10">
          
          {activeLang === 'tr' ? (
            <>
              {/* Turkish Policy */}
              <div className="space-y-3.5 bg-white/5 rounded-2xl p-4 border border-white/5 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <Shield size={14} />
                  <span>Son Güncelleme: 17 Temmuz 2026</span>
                </div>
                <p>
                  Kelime Savaşı geliştirici ekibi olarak gizliliğinize büyük önem veriyoruz. Bu gizlilik politikası, mobil uygulamamızı kullanırken hangi verilerinizin işlendiğini, nasıl saklandığını ve haklarınızı şeffaf bir şekilde açıklamak amacıyla hazırlanmıştır.
                </p>
              </div>

              {/* Section 1 */}
              <div className="space-y-2.5">
                <h4 className="text-white font-black flex items-center gap-1.5 uppercase text-xs tracking-wider">
                  <ChevronRight size={14} className="text-amber-400" />
                  1. Toplanan Bilgiler ve Veriler
                </h4>
                <div className="pl-5 space-y-2 text-xs text-slate-300/90">
                  <p>
                    <strong>Hesap Bilgileri:</strong> Oyunu misafir ("Guest") olarak oynadığınızda cihazınıza özel benzersiz bir rastgele kimlik (Device ID) oluşturulur. Bu kimlik, sadece skorlarınızı, günlük ilerlemenizi ve açtığınız rozetleri bulutta güvenle saklamak için kullanılır. E-posta ile kayıt olmanız durumunda ise yalnızca e-posta adresiniz ve şifreniz (kriptolu olarak) Firebase Authentication altyapımızda tutulur.
                  </p>
                  <p>
                    <strong>Oyun İçi İlerleme:</strong> Günlük bulmaca başarılarınız, toplam skorunuz, oyun modu tercihleriniz ve kazandığınız rozetler oyun deneyiminizi iyileştirmek amacıyla Firestore veritabanımızda saklanır.
                  </p>
                </div>
              </div>

              {/* Section 2 */}
              <div className="space-y-2.5">
                <h4 className="text-white font-black flex items-center gap-1.5 uppercase text-xs tracking-wider">
                  <ChevronRight size={14} className="text-amber-400" />
                  2. Cihaz İzinleri ve Kullanım Amaçları
                </h4>
                <div className="pl-5 space-y-2 text-xs text-slate-300/90">
                  <p>
                    Uygulamamız, Google Play Store standartlarına tam uyumlu olarak yalnızca oyun içi özelliklerin çalışabilmesi için gerekli durumlarda kullanıcıdan onay alarak şu izinleri talep eder:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li><strong>İnternet ve Ağ Erişimi:</strong> Canlı multiplayer eşleşmeler, kelime doğrulaması ve reklam gösterimi için gereklidir.</li>
                    <li><strong>Kamera İzni (İhtiyaç Anında):</strong> Yalnızca profil resmi alanında 'Fotoğraf Çek' butonuna basıldığında isteğe bağlı olarak anlık onay istenir. Uygulama açılışında kesinlikle istenmez.</li>
                    <li><strong>Yerel ve Anlık Bildirimler:</strong> Günün kelimesi hazır olduğunda ve özel oyun etkinliklerinde bilgilendirmek amacıyla kullanılır. Dilediğiniz zaman Ayarlar menüsünden tamamen kapatabilirsiniz.</li>
                  </ul>
                </div>
              </div>

              {/* Section 3 */}
              <div className="space-y-2.5">
                <h4 className="text-white font-black flex items-center gap-1.5 uppercase text-xs tracking-wider">
                  <ChevronRight size={14} className="text-amber-400" />
                  3. Veri Güvenliği ve Saklama
                </h4>
                <div className="pl-5 space-y-2 text-xs text-slate-300/90">
                  <p>
                    Toplanan tüm skor ve ilerleme verileri Google Firebase Firestore bulut veritabanında, en güncel güvenlik standartları ve Firestore Güvenlik Kuralları (Security Rules) ile korunarak saklanır. Şifreleriniz sisteme ulaşmadan önce kriptolanır ve geliştirici dahil kimse tarafından okunamaz.
                  </p>
                </div>
              </div>

              {/* Section 4 */}
              <div className="space-y-2.5">
                <h4 className="text-white font-black flex items-center gap-1.5 uppercase text-xs tracking-wider">
                  <ChevronRight size={14} className="text-amber-400" />
                  4. Üçüncü Taraf Entegrasyonları
                </h4>
                <div className="pl-5 space-y-2 text-xs text-slate-300/90">
                  <p>
                    Uygulamamız güvenli altyapı ve oyuncu doğrulaması amacıyla Google Play Services ve Firebase platformlarını kullanmaktadır. Bu servislerin kendi gizlilik politikaları geçerlidir. Uygulamamızda reklam verilerini toplamak için izinsiz hiçbir casus yazılım veya veri takip mekanizması bulunmamaktadır.
                  </p>
                </div>
              </div>

              {/* Section 5 */}
              <div className="space-y-2.5">
                <h4 className="text-white font-black flex items-center gap-1.5 uppercase text-xs tracking-wider">
                  <ChevronRight size={14} className="text-amber-400" />
                  5. İletişim ve Veri Silme Talepleri
                </h4>
                <div className="pl-5 space-y-3.5 text-xs text-slate-300/90">
                  <p>
                    Kişisel verilerinizin (varsa e-posta kaydınızın veya misafir cihaz kimliğinizin) silinmesini talep etmek, gizlilik haklarınızla ilgili soru sormak veya her türlü arıza, öneri ve destek bildirimi için aşağıdaki iletişim formunu kullanabilirsiniz. Mesajınız doğrudan ve güvenli bir şekilde geliştirici ekibine iletilecektir. Talepleriniz en geç 48 saat içerisinde incelenerek gerekli işlemler yapılacaktır.
                  </p>

                  {submitSuccess ? (
                    <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex flex-col items-center text-center gap-2 animate-fade-in">
                      <CheckCircle2 size={32} className="text-emerald-400 animate-bounce" />
                      <span className="font-bold text-sm">Mesajınız Başarıyla İletildi!</span>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        İletiniz güvenli kanallarımız üzerinden geliştirici ekibimize ulaştı. Sorunuz veya talebiniz en geç 48 saat içinde incelenecektir.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSubmitSuccess(false)}
                        className="mt-2 text-[10px] text-emerald-400 font-bold hover:underline underline-offset-4 cursor-pointer"
                      >
                        Yeni Bir Mesaj Gönder
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitContact} className="space-y-3 bg-black/30 border border-white/5 p-4 rounded-2xl text-left">
                      {submitError && (
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-[10px] font-semibold flex items-center gap-2">
                          <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                          <span>{submitError}</span>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Email */}
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                            E-Posta Adresiniz (Cevap Alabilmek İçin)
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="ornek@mail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-[#151a2e] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                          />
                        </div>

                        {/* Category */}
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                            İletişim Nedeni
                          </label>
                          <select
                            value={category}
                            onChange={(e: any) => setCategory(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-[#151a2e] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all cursor-pointer"
                          >
                            <option value="bug">Arıza / Hata Bildirimi (Bug)</option>
                            <option value="suggestion">Öneri / İstek Bildirimi</option>
                            <option value="deletion">Veri Silme Talebi (Data Deletion)</option>
                            <option value="other">Diğer Destek Konuları (Other)</option>
                          </select>
                        </div>
                      </div>

                      {/* Message */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          Mesajınız
                        </label>
                        <textarea
                          required
                          rows={3}
                          placeholder="Arıza detaylarını, önerinizi veya veri silme isteğinizi buraya yazınız..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[#151a2e] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/40 disabled:text-slate-500/60 text-slate-950 font-black text-xs rounded-xl transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-[0.98]"
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Gönderiliyor...</span>
                          </>
                        ) : (
                          <>
                            <Send size={12} />
                            <span>Mesajı Gönder</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* English Policy */}
              <div className="space-y-3.5 bg-white/5 rounded-2xl p-4 border border-white/5 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <Shield size={14} />
                  <span>Last Updated: July 17, 2026</span>
                </div>
                <p>
                  As the Kelime Savaşı development team, we value your privacy. This privacy policy transparently outlines how your data is processed, stored, and your rights while using our mobile application in compliance with Google Play Store guidelines.
                </p>
              </div>

              {/* Section 1 */}
              <div className="space-y-2.5">
                <h4 className="text-white font-black flex items-center gap-1.5 uppercase text-xs tracking-wider">
                  <ChevronRight size={14} className="text-amber-400" />
                  1. Information & Data Collection
                </h4>
                <div className="pl-5 space-y-2 text-xs text-slate-300/90">
                  <p>
                    <strong>Account Info:</strong> When playing as a guest, a unique random Device ID is created to securely store your high scores, daily progress, and achievements in our cloud. If registering with an email, only your email and encrypted password are secure on Firebase Authentication.
                  </p>
                  <p>
                    <strong>In-Game Progress:</strong> Your daily puzzle scores, totals, statistics, and badges are saved securely to improve your gameplay experience.
                  </p>
                </div>
              </div>

              {/* Section 2 */}
              <div className="space-y-2.5">
                <h4 className="text-white font-black flex items-center gap-1.5 uppercase text-xs tracking-wider">
                  <ChevronRight size={14} className="text-amber-400" />
                  2. Device Permissions
                </h4>
                <div className="pl-5 space-y-2 text-xs text-slate-300/90">
                  <p>
                    Our application requests runtime permissions only when strictly necessary for core features:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li><strong>Internet & Network Access:</strong> Required for live multiplayer matchmaking, word verification, and AdMob ads.</li>
                    <li><strong>Camera Permission (On-Demand):</strong> Requested strictly at runtime when clicking 'Take Photo' for profile picture customization. Never requested at launch.</li>
                    <li><strong>Notifications:</strong> Used to notify you about daily puzzles and game events. You can disable this anytime in Settings.</li>
                  </ul>
                </div>
              </div>

              {/* Section 3 */}
              <div className="space-y-2.5">
                <h4 className="text-white font-black flex items-center gap-1.5 uppercase text-xs tracking-wider">
                  <ChevronRight size={14} className="text-amber-400" />
                  3. Security & Cloud Storage
                </h4>
                <div className="pl-5 space-y-2 text-xs text-slate-300/90">
                  <p>
                    All user metrics are securely housed in Firebase Firestore, guarded by robust security configurations (Security Rules). Passwords are encrypted before they hit the wire.
                  </p>
                </div>
              </div>

              {/* Section 4 */}
              <div className="space-y-2.5">
                <h4 className="text-white font-black flex items-center gap-1.5 uppercase text-xs tracking-wider">
                  <ChevronRight size={14} className="text-amber-400" />
                  4. Third-Party Integrations
                </h4>
                <div className="pl-5 space-y-2 text-xs text-slate-300/90">
                  <p>
                    We leverage industry-trusted services including Google Play Services and Firebase. These have their own standalone privacy terms. We do not engage in unauthorized user tracking or spy frameworks.
                  </p>
                </div>
              </div>

              {/* Section 5 */}
              <div className="space-y-2.5">
                <h4 className="text-white font-black flex items-center gap-1.5 uppercase text-xs tracking-wider">
                  <ChevronRight size={14} className="text-amber-400" />
                  5. Contact & Data Deletion
                </h4>
                <div className="pl-5 space-y-3.5 text-xs text-slate-300/90">
                  <p>
                    To request permanent deletion of your credentials, guest profiles, or ask any privacy-related, bug, or support queries, you can submit a message securely using the form below. Your ticket will be directed directly and securely to the development team without exposing email addresses in public code.
                  </p>

                  {submitSuccess ? (
                    <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex flex-col items-center text-center gap-2 animate-fade-in">
                      <CheckCircle2 size={32} className="text-emerald-400 animate-bounce" />
                      <span className="font-bold text-sm">Message Sent Successfully!</span>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        Your message has been safely delivered to our developer desk. We will review and respond to your request within 48 hours.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSubmitSuccess(false)}
                        className="mt-2 text-[10px] text-emerald-400 font-bold hover:underline underline-offset-4 cursor-pointer"
                      >
                        Send Another Message
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitContact} className="space-y-3 bg-black/30 border border-white/5 p-4 rounded-2xl text-left">
                      {submitError && (
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-[10px] font-semibold flex items-center gap-2">
                          <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                          <span>{submitError}</span>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Email */}
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                            Your Email (To receive a reply)
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-[#151a2e] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                          />
                        </div>

                        {/* Category */}
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                            Reason for Inquiry
                          </label>
                          <select
                            value={category}
                            onChange={(e: any) => setCategory(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-[#151a2e] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all cursor-pointer"
                          >
                            <option value="bug">Report an Issue (Bug)</option>
                            <option value="suggestion">Suggestion / Feedback</option>
                            <option value="deletion">Data Deletion Request</option>
                            <option value="other">Other Inquiry</option>
                          </select>
                        </div>
                      </div>

                      {/* Message */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          Your Message
                        </label>
                        <textarea
                          required
                          rows={3}
                          placeholder="Please specify bug details, suggestion, or data deletion requests here..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[#151a2e] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/40 disabled:text-slate-500/60 text-slate-950 font-black text-xs rounded-xl transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-[0.98]"
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send size={12} />
                            <span>Send Message</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="flex-none px-6 py-4 border-t border-white/5 bg-black/20 flex items-center justify-between rounded-b-[2.2rem]">
          <span className="text-[10px] text-slate-400 font-medium">
            Kelime Savaşı © 2026
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#FAF6E9] hover:bg-[#F3EFE0] text-[#2E3748] text-xs font-black rounded-xl transition active:scale-95 cursor-pointer uppercase tracking-wider"
          >
            {activeLang === 'tr' ? 'Anladım' : 'Got It'}
          </button>
        </div>

      </div>
    </div>
  );
}
