package com.kelimesavasi.app;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Random;

public class WordManager {

    // EĞER VERİTABANINDAN KELİME YÜKLENMEZSE VEYA BOŞ GELİRSE OYUN ÇÖKMESİN DİYE YEDEK HAVUZ (FALLBACK)
    private static final Map<Integer, List<String>> fallbackWords = new HashMap<>();
    private static final Random random = new Random();

    static {
        fallbackWords.put(3, Arrays.asList("ÜTÜ", "YAZ", "TEK", "GÜZ", "KAS", "SAZ"));
        fallbackWords.put(4, Arrays.asList("KALE", "MASA", "KUTU", "YAZI", "KART", "SARI"));
        fallbackWords.put(5, Arrays.asList("TEMEL", "ARABA", "KALEM", "SABAH", "SEHPA", "KAŞIK"));
        fallbackWords.put(6, Arrays.asList("ANKARA", "TÜRKÇE", "BARDAK", "SÖZCÜK", "YAZICI", "AŞAMA"));
        fallbackWords.put(7, Arrays.asList("TELEFON", "ELBİSE", "KAYISI", "MERHABA", "ÇİKOLTA"));
        fallbackWords.put(8, Arrays.asList("BİLGİSAY", "KÜTÜPHAN", "SÖZLEŞME", "YUMURTAK"));
    }

    /**
     * Güvenli Kelime Seçici:
     * Bu fonksiyon verilen listeden sadece ve sadece istenen harf uzunluğundaki kelimeleri filtreler.
     * Türkçe karakter uyumluluğunu denetler ve tüm harfleri büyük harfe çevirir.
     * 
     * @param allWords Veritabanından veya yerelden gelen tüm kelimelerin listesi (Null gelebilir)
     * @param selectedLength Oyuncunun seçtiği harf sayısı (3, 4, 5, 6, 7, 8)
     * @return Kesinlikle seçilen harf uzunluğunda ve Türkçe büyük harflerle yazılmış kelime.
     */
    public static String getRandomWord(List<String> allWords, int selectedLength) {
        Locale turkishLocale = new Locale("tr", "TR"); // Türkçe büyük/küçük harf uyuşmazlığını (I-İ-ı-i) çözer
        
        // Sınır kontrolü (Kullanıcı saçma bir harf sayısı seçerse koruma)
        int safeLength = (selectedLength >= 3 && selectedLength <= 8) ? selectedLength : 5;

        // 1. KONTROL: Ana liste boş mu geliyor? Boşsa hemen yedek listeden kelime ver.
        if (allWords == null || allWords.isEmpty()) {
            return getFallbackWord(safeLength, turkishLocale);
        }

        // 2. KONTROL: Listeyi temizle, Türkçe karakterlere göre büyüt ve Sadece seçilen harf sayısında olanları al.
        java.util.ArrayList<String> filteredWords = new java.util.ArrayList<>();
        for (String word : allWords) {
            if (word != null) {
                String cleanWord = word.trim().toUpperCase(turkishLocale);
                if (cleanWord.length() == safeLength) {
                    filteredWords.add(cleanWord);
                }
            }
        }

        // 3. KONTROL: Filtreleme sonucunda elimizde kelime kaldı mı?
        if (!filteredWords.isEmpty()) {
            String selectedWord = filteredWords.get(random.nextInt(filteredWords.size()));
            
            // Son Güvenlik Duvarı: Seçilen kelimenin uzunluğu gerçekten doğru mu?
            if (selectedWord.length() == safeLength) {
                return selectedWord;
            }
        }

        // 4. KONTROL: Eğer veritabanındaki listede o harf uzunluğunda hiç kelime yoksa yine yerel yedek listeyi kullan.
        return getFallbackWord(safeLength, turkishLocale);
    }

    // Yedek listeden rastgele güvenli kelime getiren yardımcı metod
    private static String getFallbackWord(int length, Locale locale) {
        List<String> words = fallbackWords.get(length);
        if (words == null || words.isEmpty()) {
            words = Arrays.asList("TEMEL");
        }
        return words.get(random.nextInt(words.size())).toUpperCase(locale);
    }
}
