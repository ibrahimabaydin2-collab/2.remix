import { turkishLower } from './turkish';

/**
 * Validates a username based on the game's strict criteria.
 * Returns a string with the Turkish error message if invalid, or null if valid.
 */
export function validateUsername(
  name: string,
  lobbyPlayers: { id: string; name: string }[] = [],
  currentUserId?: string
): string | null {
  if (!name) {
    return 'Kullanıcı adı boş olamaz.';
  }

  // 1. Boşluk (space) kuralı: başında, sonunda veya içinde boşluk olamaz.
  if (/\s/.test(name)) {
    return 'Kullanıcı adının başında, sonunda veya içinde boşluk (space) bırakılamaz.';
  }

  // 2. Karakter ve Uzunluk Sınırları: en az 5, en fazla 27 karakter
  if (name.length < 5 || name.length > 27) {
    return 'Kullanıcı adı en az 5, en fazla 27 karakterden oluşabilir.';
  }

  // İsim içerisinde en fazla 20 adet sayı (rakam) kullanılabilir
  const digitCount = (name.match(/\d/g) || []).length;
  if (digitCount > 20) {
    return 'Kullanıcı adı içerisinde en fazla 20 adet sayı (rakam) kullanılabilir.';
  }

  // İzin verilen karakterler: harf, sayı, alt tire (_) ve nokta (.)
  const allowedRegex = /^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ_.]+$/;
  if (!allowedRegex.test(name)) {
    return 'Kullanıcı adı sadece harf, sayı, alt tire (_) ve nokta (.) içerebilir.';
  }

  // 3. Biçimlendirme ve Güvenlik: Yan yana 4 tane aynı harfin (Örn: "aaaa") gelmesi yasaklansın.
  const lowerName = turkishLower(name);
  for (let i = 0; i < lowerName.length - 3; i++) {
    if (lowerName[i] === lowerName[i + 1] && 
        lowerName[i] === lowerName[i + 2] && 
        lowerName[i] === lowerName[i + 3]) {
      return 'Kullanıcı adında yan yana 4 tane aynı harf (örn: aaaa) bulunamaz.';
    }
  }

  // İçinde "Admin", "Mod", "Developer" gibi kelimeler geçen yönetici taklitçi isimler engellensin.
  if (lowerName.includes('admin') || lowerName.includes('mod') || lowerName.includes('developer')) {
    return "Yönetici taklitçiliğini önlemek amacıyla 'Admin', 'Mod' veya 'Developer' içeren isimler kullanılamaz.";
  }

  // 5. Benzersizlik ve Harf Kuralı:
  // Sistemde aynı kullanıcı adı kesinlikle iki kez kullanılamaz.
  // Sistem büyük/küçük harfe duyarsız olmalıdır.
  if (lobbyPlayers && lobbyPlayers.length > 0) {
    const isTaken = lobbyPlayers.some(p => {
      // Don't check against ourselves if we are editing our own profile
      if (currentUserId && p.id === currentUserId) return false;
      return turkishLower(p.name) === lowerName;
    });

    if (isTaken) {
      return 'Bu kullanıcı adı zaten başka bir kullanıcı tarafından alınmış.';
    }
  }

  return null;
}

/**
 * Validates a password based on security criteria:
 * - At least 6 characters
 * - Contains at least one letter and one number
 */
export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Şifre boş olamaz.';
  }
  if (password.length < 6) {
    return 'Şifre en az 6 karakterden oluşmalıdır.';
  }
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(password)) {
    return 'Şifre güvenlik için en az bir harf içermelidir.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Şifre güvenlik için en az bir sayı (rakam) içermelidir.';
  }
  return null;
}

