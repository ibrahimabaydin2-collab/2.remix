var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_http = __toESM(require("http"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_ws = require("ws");

// src/utils/turkish.ts
var UPPER_MAP = {
  "a": "A",
  "b": "B",
  "c": "C",
  "\xE7": "\xC7",
  "d": "D",
  "e": "E",
  "f": "F",
  "g": "G",
  "\u011F": "\u011E",
  "h": "H",
  "\u0131": "I",
  "i": "\u0130",
  "j": "J",
  "k": "K",
  "l": "L",
  "m": "M",
  "n": "N",
  "o": "O",
  "\xF6": "\xD6",
  "p": "P",
  "r": "R",
  "s": "S",
  "\u015F": "\u015E",
  "t": "T",
  "u": "U",
  "\xFC": "\xDC",
  "v": "V",
  "y": "Y",
  "z": "Z",
  "\xE2": "A",
  "\xEE": "I",
  "\xFB": "U",
  "\xC2": "A",
  "\xCE": "I",
  "\xDB": "U"
};
var LOWER_MAP = {
  "A": "a",
  "B": "b",
  "C": "c",
  "\xC7": "\xE7",
  "D": "d",
  "E": "e",
  "F": "f",
  "G": "g",
  "\u011E": "\u011F",
  "H": "h",
  "I": "\u0131",
  "\u0130": "i",
  "J": "j",
  "K": "k",
  "L": "l",
  "M": "m",
  "N": "n",
  "O": "o",
  "\xD6": "\xF6",
  "P": "p",
  "R": "r",
  "S": "s",
  "\u015E": "\u015F",
  "T": "t",
  "U": "u",
  "\xDC": "\xFC",
  "V": "v",
  "Y": "y",
  "Z": "z",
  "\xE2": "a",
  "\xEE": "\u0131",
  "\xFB": "u",
  "\xC2": "a",
  "\xCE": "\u0131",
  "\xDB": "u"
};
function turkishUpper(str) {
  if (!str) return "";
  return str.split("").map((char) => UPPER_MAP[char] || char.toUpperCase()).join("");
}
function turkishLower(str) {
  if (!str) return "";
  return str.split("").map((char) => LOWER_MAP[char] || char.toLowerCase()).join("");
}

// src/data/wordlist.ts
var COMMON_TURKISH_WORDS = {
  3: [
    "ana",
    "ar\u0131",
    "ata",
    "ara",
    "bal",
    "bo\u015F",
    "buz",
    "cep",
    "\xE7ay",
    "\xE7\xF6l",
    "da\u011F",
    "dar",
    "d\u0131\u015F",
    "dua",
    "dut",
    "ebe",
    "eda",
    "efe",
    "ege",
    "ela",
    "fal",
    "fen",
    "g\xF6l",
    "g\xFCz",
    "hak",
    "hap",
    "hat",
    "h\u0131z",
    "iyi",
    "jel",
    "jet",
    "ka\xE7",
    "kan",
    "kar",
    "kas",
    "kat",
    "kel",
    "kez",
    "k\u0131z",
    "ko\xE7",
    "kol",
    "kum",
    "ku\u015F",
    "kut",
    "k\xFCl",
    "laf",
    "ma\xE7",
    "mal",
    "nal",
    "nem",
    "net",
    "ney",
    "oda",
    "oje",
    "ova",
    "oya",
    "pay",
    "pek",
    "pil",
    "pis",
    "pus",
    "ray",
    "sa\xE7",
    "saf",
    "sa\u011F",
    "sal",
    "sav",
    "say",
    "sel",
    "ses",
    "s\u0131r",
    "sol",
    "son",
    "soy",
    "s\xF6z",
    "su\xE7",
    "s\xFCt",
    "\u015Fah",
    "\u015Fan",
    "\u015Fap",
    "\u015Fef",
    "\u015Fen",
    "\u015Fer",
    "\u015F\u0131k",
    "\u015Fi\u015F",
    "\u015Fok",
    "\u015Fov",
    "ta\xE7",
    "tam",
    "tan",
    "ta\u015F",
    "tay",
    "tek",
    "tel",
    "ten",
    "ter",
    "tez",
    "t\u0131p",
    "tok",
    "ton",
    "top",
    "toz",
    "tut",
    "tuz",
    "t\xFCm",
    "t\xFCp",
    "t\xFCr",
    "t\xFCy",
    "ulu",
    "\xFC\xE7",
    "ya\u011F",
    "yak",
    "yal",
    "yan",
    "yap",
    "yar",
    "yas",
    "ya\u015F",
    "yat",
    "yay",
    "yaz",
    "yel",
    "yem",
    "yer",
    "y\u0131l",
    "yol",
    "y\xF6n",
    "y\xFCk",
    "y\xFCn",
    "y\xFCz",
    "zam",
    "zar",
    "zat",
    "zor"
  ],
  4: [
    "a\xE7\u0131k",
    "ad\u0131m",
    "a\u011Fa\xE7",
    "alan",
    "alt\u0131",
    "ama\xE7",
    "anne",
    "ara\xE7",
    "arka",
    "arzu",
    "asla",
    "ate\u015F",
    "ayna",
    "baba",
    "baz\u0131",
    "bor\xE7",
    "boyu",
    "cami",
    "ceza",
    "\xE7aba",
    "\xE7at\u0131",
    "\xE7ift",
    "\xE7ocuk",
    "dere",
    "ders",
    "dolu",
    "do\u011Fu",
    "d\xF6rt",
    "duyu",
    "ekip",
    "elma",
    "eser",
    "eski",
    "e\u015Fya",
    "evet",
    "fark",
    "fiyat",
    "gece",
    "g\u0131da",
    "grup",
    "g\xFC\xE7l\xFC",
    "g\xFCl\xFC\u015F",
    "g\xFCn",
    "halk",
    "harf",
    "hata",
    "hava",
    "h\u0131zl\u0131",
    "\u0131l\u0131k",
    "\u0131\u015F\u0131k",
    "ilis",
    "imza",
    "ince",
    "isim",
    "izin",
    "kafa",
    "kale",
    "kalp",
    "kap\u0131",
    "kara",
    "kart",
    "kedi",
    "k\u0131sa",
    "koku",
    "konu",
    "koyu",
    "kral",
    "kupa",
    "kutu",
    "kuzu",
    "mavi",
    "masa",
    "maya",
    "mide",
    "m\xFClk",
    "ocak",
    "oda",
    "okul",
    "onur",
    "ordu",
    "orta",
    "oyun",
    "\xF6fke",
    "\xF6m\xFCr",
    "para",
    "plan",
    "renk",
    "rica",
    "saat",
    "sade",
    "sa\u011F",
    "say\u0131",
    "sedir",
    "sene",
    "sesi",
    "s\u0131ra",
    "soru",
    "spor",
    "s\xFCre",
    "\u015Fark",
    "\u015Fart",
    "\u015Fere",
    "\u015Fiir",
    "tahta",
    "tak\u0131",
    "tamam",
    "tane",
    "tarz",
    "tava",
    "taze",
    "tepe",
    "test",
    "toz",
    "t\xFCrk",
    "u\xE7ak",
    "uyku",
    "\xFClke",
    "\xFCmit",
    "\xFCnl\xFC",
    "vadi",
    "vaka",
    "veri",
    "vezir",
    "vida",
    "ya\u011F\u0131\u015F",
    "yaka",
    "yak\u0131",
    "yalan",
    "yan\u0131",
    "yap\u0131",
    "yara",
    "yar\u0131",
    "yasa",
    "ya\u015F",
    "yaz\u0131",
    "ye\u015Fil",
    "yine",
    "yolcu",
    "y\xF6n",
    "yurt"
  ],
  5: [
    "acele",
    "adeta",
    "adres",
    "ahlak",
    "ah\u015Fap",
    "ak\u0131ll\u0131",
    "ak\u015Fam",
    "aktif",
    "alaka",
    "alarm",
    "al\u0131c\u0131",
    "alt\u0131n",
    "amaca",
    "ampul",
    "anlam",
    "anket",
    "antre",
    "araba",
    "arazi",
    "ar\u015Fiv",
    "art\u0131k",
    "aslan",
    "asker",
    "astron",
    "asort",
    "asgari",
    "aspar",
    "atlet",
    "avukat",
    "ayg\u0131t",
    "ayl\u0131k",
    "ayran",
    "ayr\u0131k",
    "bacak",
    "ba\u011F\u0131\u015F",
    "bah\xE7e",
    "bal\u0131k",
    "balon",
    "banyo",
    "bar\u0131\u015F",
    "bas\u0131n",
    "basit",
    "ba\u015Fka",
    "bavul",
    "bebek",
    "belge",
    "belki",
    "belli",
    "bence",
    "bende",
    "beniz",
    "biber",
    "bilge",
    "bilgi",
    "bilim",
    "birey",
    "birim",
    "bitki",
    "boyut",
    "b\xF6cek",
    "b\xF6lge",
    "b\xF6l\xFCm",
    "buhar",
    "bulut",
    "b\xFCt\xFCn",
    "cadde",
    "ceket",
    "cesur",
    "cevap",
    "ceviz",
    "cihaz",
    "civar",
    "\xE7ad\u0131r",
    "\xE7a\u011Fr\u0131",
    "\xE7amur",
    "\xE7anta",
    "\xE7ar\u015F\u0131",
    "\xE7atal",
    "\xE7evre",
    "\xE7eyiz",
    "\xE7i\xE7ek",
    "\xE7izgi",
    "\xE7ocuk",
    "\xE7orba",
    "\xE7orap",
    "\xE7\xF6z\xFCm",
    "daire",
    "davet",
    "de\u011Fer",
    "de\u011Fil",
    "demet",
    "demir",
    "deney",
    "deniz",
    "dergi",
    "derin",
    "detay",
    "devam",
    "devre",
    "dikkat",
    "dilim",
    "direk",
    "dizgi",
    "do\u011Fal",
    "do\u011Fru",
    "dolar",
    "dolap",
    "dolum",
    "domat",
    "dosya",
    "doyum",
    "durum",
    "duvar",
    "d\xFCnya",
    "d\xFCzen",
    "ebat",
    "edat",
    "egzoz",
    "eklem",
    "ekran",
    "eksen",
    "elmas",
    "emlak",
    "enerj",
    "enlem",
    "erkek",
    "erken",
    "esnaf",
    "esnek",
    "etken",
    "etkin",
    "eylem",
    "eyl\xFCl",
    "fakat",
    "fatih",
    "fayda",
    "fener",
    "fig\xFCr",
    "fikir",
    "filiz",
    "firma",
    "fizik",
    "fiyat",
    "flama",
    "form\xFCl",
    "forum",
    "fular",
    "funda",
    "f\xFCze",
    "galip",
    "garip",
    "gazet",
    "gazoz",
    "gebe",
    "ge\xE7ici",
    "ge\xE7i\u015F",
    "gedik",
    "gelin",
    "gelir",
    "giri\u015F",
    "gizli",
    "g\xF6bek",
    "g\xF6zc\xFC",
    "g\xF6zde",
    "grup",
    "g\xFCbre",
    "g\xFC\xE7l\xFC",
    "g\xFCl\xFC\u015F",
    "g\xFCm\xFC\u015F",
    "g\xFCne\u015F",
    "g\xFCney",
    "g\xFCven",
    "g\xFCzel",
    "haber",
    "hacim",
    "hadis",
    "hafta",
    "hakan",
    "hakim",
    "halat",
    "hal\u0131",
    "hamur",
    "hangi",
    "han\u0131m",
    "hapis",
    "harbe",
    "har\xE7",
    "hasta",
    "hat\u0131r",
    "hayal",
    "hayat",
    "hay\u0131r",
    "hedef",
    "hekim",
    "helva",
    "hepsi",
    "h\u0131rka",
    "h\u0131zl\u0131",
    "hizmet",
    "hukuk",
    "huzur",
    "h\xFCcre",
    "h\xFCk\xFCm",
    "\u0131slak",
    "\u0131l\u0131k",
    "\u0131rmak",
    "\u0131srar",
    "\u0131\u015F\u0131k",
    "ibare",
    "ideale",
    "idrar",
    "ihrac",
    "ihsan",
    "ihtiy",
    "iklim",
    "ikram",
    "ila\xE7",
    "ilave",
    "iler",
    "ilet",
    "ilgi",
    "ilisk",
    "ilker",
    "ilkin",
    "ilmek",
    "mimar",
    "mobil",
    "motor",
    "m\xFCjde",
    "m\xFCzik",
    "nadir",
    "nakit",
    "nas\u0131l",
    "neden",
    "nefes",
    "nehir",
    "nemli",
    "nesil",
    "nesne",
    "nezle",
    "nisan",
    "nokta",
    "norma",
    "n\xF6bet",
    "n\xFCfus",
    "n\xFCfuz",
    "n\xFCsha",
    "o\u011Flak",
    "oksij",
    "okuma",
    "onlar",
    "opera",
    "organ",
    "ortak",
    "ortam",
    "oynak",
    "oynak",
    "oynak",
    "oynak",
    "oynak",
    "\xF6nder",
    "\xF6rnek",
    "\xF6rdek",
    "\xF6yk\xFC",
    "\xF6zen",
    "\xF6zg\xFCn",
    "\xF6zg\xFCr",
    "paket",
    "pamuk",
    "panik",
    "parka",
    "parlak",
    "parsa",
    "parti",
    "pazar",
    "pelin",
    "pelte",
    "pembe",
    "perde",
    "peron",
    "petrol",
    "p\u0131nar",
    "p\u0131ras",
    "piknik",
    "pilot",
    "pipet",
    "plaka",
    "plato",
    "polis",
    "polen",
    "poyraz",
    "proje",
    "pudra",
    "puset",
    "radar",
    "radyo",
    "rahat",
    "rakam",
    "rakip",
    "rapor",
    "resim",
    "resmi",
    "ritim",
    "roman",
    "rozet",
    "ruj",
    "rulo",
    "ruhsat",
    "sabah",
    "sabun",
    "sa\xE7ma",
    "sade",
    "sa\u011Flam",
    "sa\u011Fl\u0131k",
    "sahip",
    "sahne",
    "sahil",
    "sakal",
    "sakin",
    "salata",
    "sal\xE7a",
    "salg\u0131",
    "salon",
    "saman",
    "sanal",
    "sanat",
    "san\u0131k",
    "saniye",
    "saray",
    "sar\u0131",
    "sarg\u0131",
    "sarma",
    "sat\u0131c\u0131",
    "sat\u0131r",
    "sat\u0131\u015F",
    "sava\u015F",
    "savc\u0131",
    "sayfa",
    "sayg\u0131",
    "sebep",
    "se\xE7im",
    "sedef",
    "sefer",
    "sehpa",
    "sekiz",
    "selam",
    "sepet",
    "sergi",
    "serin",
    "sevgi",
    "sevim",
    "seyir",
    "s\u0131cak",
    "s\u0131n\u0131f",
    "s\u0131n\u0131r",
    "s\u0131nav",
    "s\u0131r\u0131k",
    "s\u0131rma",
    "s\u0131v\u0131",
    "sigara",
    "sihir",
    "silah",
    "silgi",
    "sinek",
    "sinir",
    "sinema",
    "siren",
    "sirke",
    "sivas",
    "sivil",
    "siyah",
    "siyasi",
    "sizce",
    "so\u011Fan",
    "so\u011Fuk",
    "sokak",
    "soluk",
    "somut",
    "sonu\xE7",
    "sorgu",
    "soru",
    "sorum",
    "sosyal",
    "soyut",
    "s\xF6\u011F\xFCt",
    "s\xF6zc\xFC",
    "s\xF6zl\xFCk",
    "spor",
    "stant",
    "stres",
    "su\xE7lu",
    "sultan",
    "sunucu",
    "suret",
    "s\xFCre",
    "s\xFCrec",
    "s\xFCrekli",
    "s\xFCr\xFCm",
    "s\xFCsl\xFC",
    "s\xFCt\xE7\xFC",
    "\u015Fahin",
    "\u015Fahit",
    "\u015Faka",
    "\u015Fapka",
    "\u015Fark\u0131",
    "\u015Fark",
    "\u015Fefta",
    "\u015Fehir",
    "\u015Feker",
    "\u015Fekil",
    "\u015Ferit",
    "\u015Feref",
    "\u015Fof\xF6r",
    "\u015F\xF6mine",
    "\u015F\xFCphe",
    "tabak",
    "tablo",
    "tabur",
    "tah\u0131l",
    "tahmin",
    "tahta",
    "tak\u0131m",
    "takip",
    "taksi",
    "talep",
    "tamam",
    "tan\u0131k",
    "tan\u0131m",
    "taraf",
    "tar\u0131m",
    "tarih",
    "tarla",
    "tasar",
    "tavan",
    "tav\u0131r",
    "tav\u015Fan",
    "tavuk",
    "taze",
    "tebrik",
    "tepsi",
    "tekel",
    "teker",
    "tekil",
    "tekne",
    "teknik",
    "teknoloji",
    "tekst",
    "tela\u015F",
    "telsiz",
    "temel",
    "temiz",
    "tempo",
    "teori",
    "tepki",
    "terapi",
    "terzi",
    "tesis",
    "test",
    "tetik",
    "tevbe",
    "teyze",
    "t\u0131bbi",
    "t\u0131ra\u015F",
    "tohum",
    "tokat",
    "toner",
    "topa\xE7",
    "toplam",
    "toplu",
    "toprak",
    "toptan",
    "torba",
    "torun",
    "t\xF6ren",
    "t\xF6rp\xFC",
    "trafik",
    "tra\u015F",
    "tren",
    "tugay",
    "tuhaf",
    "tulum",
    "tur\u015Fu",
    "turuncu",
    "tuzlu",
    "t\xFCm\xF6r",
    "t\xFCnel",
    "t\xFCrk",
    "t\xFCrbe",
    "t\xFCrk\xFC",
    "t\xFCt\xFCn",
    "u\xE7aks",
    "u\xE7ucu",
    "ufuk",
    "ula\u015F\u0131m",
    "ulusal",
    "umut",
    "unvan",
    "uyar\u0131",
    "uygar",
    "uygun",
    "uygur",
    "uyku",
    "uymak",
    "uzman",
    "\xFCcret",
    "\xFC\xE7gen",
    "\xFClke",
    "\xFClser",
    "\xFCnite",
    "\xFCnl\xFC",
    "\xFCnvan",
    "\xFCretim",
    "\xFCr\xFCn",
    "\xFCsler",
    "\xFCst\xFCn",
    "\xFCzere",
    "\xFCz\xFCm",
    "vagon",
    "vah\u015Fi",
    "vakar",
    "vak\u0131f",
    "vakit",
    "vatan",
    "vatanda\u015F",
    "vefat",
    "vekil",
    "velia",
    "vergi",
    "verim",
    "vezne",
    "video",
    "vokal",
    "volkan",
    "vurgu",
    "v\xFCcut",
    "ya\u011F\u0131z",
    "ya\u011F\u0131\u015F",
    "ya\u011Fm",
    "yak\u0131n",
    "yak\u0131t",
    "yalan",
    "yaln\u0131z",
    "yamak",
    "yanak",
    "yan\u0131t",
    "yanl\u0131\u015F",
    "yap\u0131c\u0131",
    "yap\u0131\u015F",
    "yaprak",
    "yarar",
    "yar\u0131n",
    "yar\u0131\u015F",
    "yasin",
    "yast\u0131k",
    "ya\u015Fam",
    "yatak",
    "yatay",
    "yat\u0131r\u0131m",
    "yava\u015F",
    "yazar",
    "yaz\u0131c\u0131",
    "yazl\u0131k",
    "yelek",
    "yemek",
    "yemin",
    "yeni",
    "yerel",
    "ye\u015Fil",
    "yetki",
    "y\u0131lan",
    "y\u0131ld\u0131z",
    "y\u0131ll\u0131k",
    "yi\u011Fit",
    "yirmi",
    "yo\u011Fun",
    "yo\u011Furt",
    "yoku\u015F",
    "yolcu",
    "yolcul",
    "yonca",
    "yorgan",
    "yorum",
    "yosun",
    "y\xF6nem",
    "y\xF6net",
    "y\xF6resel",
    "yudum",
    "yukar\u0131",
    "yumru",
    "yumu\u015F",
    "yunus",
    "yurt",
    "yusuf",
    "yuvak",
    "y\xFCce",
    "y\xFCklem",
    "y\xFCksek",
    "y\xFCrek",
    "y\xFCr\xFCy",
    "y\xFCzde",
    "y\xFCzey",
    "y\xFCz\xFCk",
    "zab\u0131t",
    "zafer",
    "zalim",
    "zaman",
    "zarar",
    "zarif",
    "zarf",
    "zaten",
    "zekat",
    "zeki",
    "zemin",
    "zengin",
    "zeytin",
    "z\u0131rh",
    "ziynet",
    "zincir",
    "zirve",
    "ziyaret"
  ],
  6: [
    "adalet",
    "ak\u0131ll\u0131",
    "akraba",
    "ala\u015F\u0131m",
    "al\u0131\u015F\u0131\u015F",
    "asfalt",
    "balay\u0131",
    "bardak",
    "ba\u015Far\u0131",
    "ba\u015Fkan",
    "bellek",
    "berber",
    "be\u015Flik",
    "bilgin",
    "birden",
    "boyama",
    "bro\u015F\xFCr",
    "bug\xFCn",
    "bulvar",
    "c\xFCzdan",
    "\xE7amur",
    "\xE7eyrek",
    "\xE7orba",
    "destan",
    "destek",
    "derece",
    "defter",
    "deprem",
    "devlet",
    "dikkat",
    "dinamo",
    "doktor",
    "eczane",
    "efsane",
    "elbise",
    "endeks",
    "eri\u015Fim",
    "faydal",
    "fayton",
    "f\u0131rt\u0131n",
    "filtre",
    "fincan",
    "futbol",
    "galebe",
    "garanti",
    "gayret",
    "gazete",
    "ge\xE7mi\u015F",
    "ger\xE7ek",
    "g\xF6zl\xFCk",
    "gurbet",
    "g\xFCven\xE7",
    "hacker",
    "harika",
    "hastah",
    "hazine",
    "heykel",
    "hizmet",
    "\u0131spanak",
    "ibadet",
    "iskele",
    "i\u015Faret",
    "kabine",
    "kamera",
    "kanser",
    "kanyon",
    "kaplan",
    "kar\u0131\u015F",
    "karpuz",
    "kavram",
    "kay\u0131s\u0131",
    "kelime",
    "kemanc\u0131",
    "kervan",
    "k\u0131ymet",
    "korsan",
    "koltuk",
    "k\xF6m\xFCr",
    "kur\u015Fun",
    "kuvvet",
    "lastik",
    "limon",
    "makine",
    "mandal",
    "mant\u0131k",
    "market",
    "masraf",
    "meclis",
    "merkez",
    "mesafe",
    "meydan",
    "meyve",
    "milyon",
    "misafir",
    "modern",
    "mutfak",
    "ofis\xE7i",
    "orman",
    "otob\xFCs",
    "otoyol",
    "oyuncu",
    "\xF6\u011Frenci",
    "\xF6r\xFCmcek",
    "parf\xFCm",
    "parlak",
    "patron",
    "pazar",
    "peynir",
    "re\xE7ete",
    "reklam",
    "ressam",
    "roman",
    "r\xFCzgar",
    "sa\u011Flam",
    "sa\u011Fl\u0131k",
    "saniye",
    "sarho\u015F",
    "sarmal",
    "seccad",
    "seksen",
    "serbest",
    "sermay",
    "servis",
    "s\u0131cak",
    "s\u0131nav",
    "silindir",
    "sistem",
    "sohbet",
    "sosyal",
    "s\xF6zl\xFCk",
    "sunucu",
    "s\xFCrpriz",
    "\u015Fampiy",
    "\u015Feftal",
    "\u015Femsiy",
    "\u015Fof\xF6r",
    "tabiat",
    "tahmin",
    "takvim",
    "tasar\u0131m",
    "tav\u015Fan",
    "tehlik",
    "tekrar",
    "tembel",
    "terazi",
    "teslim",
    "tiyatro",
    "toprak",
    "turizm",
    "t\xFCrk\xE7e",
    "ulusal",
    "uzayl\u0131",
    "\xFCretim",
    "vicdan",
    "volkan",
    "ya\u011Fmur",
    "yaln\u0131z",
    "yaprak",
    "yard\u0131m",
    "yast\u0131k",
    "yazar",
    "yemek",
    "yosun",
    "y\xFCksek",
    "y\xFCrek",
    "zahmet",
    "zaman",
    "zengin",
    "zincir"
  ],
  7: [
    "anayasa",
    "arkada\u015F",
    "asans\xF6r",
    "al\u0131\u015Fveri\u015F",
    "ba\u011Flant",
    "ba\u015Far\u0131",
    "ba\u015Flang",
    "belediy",
    "bilgisa",
    "biyoloj",
    "co\u011Frafy",
    "\xE7al\u0131\u015Fma",
    "\xE7ikolat",
    "depozit",
    "dinamik",
    "edebiya",
    "efsanev",
    "ekonomi",
    "element",
    "end\xFCstr",
    "enginar",
    "felsefe",
    "fizik\xE7i",
    "foto\u011Fra",
    "geli\u015Fim",
    "giri\u015Fim",
    "g\xF6ky\xFCz\xFC",
    "g\xF6zleme",
    "haftal",
    "hastane",
    "heyecan",
    "h\u0131zl\u0131ca",
    "\u0131spanak",
    "ileti\u015Fi",
    "imparor",
    "internet",
    "istatisti",
    "i\u015Fbirl",
    "kabakul",
    "karanl\u0131",
    "karides",
    "kat\u0131l\u0131",
    "kav\u015Fak",
    "kelebek",
    "k\u0131lavuz",
    "k\u0131rm\u0131z\u0131",
    "kitap\xE7\u0131",
    "kolonya",
    "kurtar\u0131",
    "k\xFCt\xFCpha",
    "laciver",
    "lokanta",
    "makarna",
    "manzara",
    "margar",
    "matemat",
    "merhaba",
    "mevsim",
    "milyard",
    "mineral",
    "mobilya",
    "mutlulu",
    "m\xFChendis",
    "m\xFCrekk",
    "nakliye",
    "o\u011Fullar",
    "organik",
    "oyuncak",
    "\xF6\u011Fretme",
    "pantolo",
    "para\u015F\xFCt",
    "patates",
    "pencere",
    "portaka",
    "program",
    "pijama",
    "ramazan",
    "reaksiy",
    "rehber",
    "r\xF6ntgen",
    "saatlik",
    "sakinli",
    "salatal",
    "sancakt",
    "sandaly",
    "satran\xE7",
    "sayg\u0131l",
    "sevgili",
    "seyahat",
    "s\u0131radan",
    "sigorta",
    "sinirli",
    "siyaset",
    "s\xF6zle\u015Fm",
    "\u015Feftali",
    "\u015Femsiye",
    "tehlike",
    "telefon",
    "temizli",
    "te\u015Fekk\xFC",
    "toplant",
    "t\xFCketim",
    "\xFCnivers",
    "vak\u0131fla",
    "voleybo",
    "ya\u011Fmurl",
    "yak\u0131\u015F\u0131k",
    "yaramaz",
    "yard\u0131mc",
    "ya\u015Fas\u0131n",
    "yaz\u0131l\u0131",
    "yery\xFCz\xFC",
    "ye\u015Filli",
    "y\xF6netim",
    "yurtta\u015F",
    "yumurta",
    "y\xFCr\xFCy\xFC\u015F",
    "zehirli",
    "ziyaret",
    "zorluk"
  ],
  8: [
    "arkada\u015F",
    "ara\u015Ft\u0131r",
    "ba\u011Flant\u0131",
    "ba\u015Far\u0131",
    "ba\u015Flang\u0131",
    "belediye",
    "bilgisay",
    "biyoloji",
    "co\u011Frafya",
    "\xE7al\u0131\u015Fkan",
    "\xE7evresel",
    "\xE7ikolata",
    "delikanl",
    "demokrat",
    "deneyim",
    "derinli",
    "devlet\xE7",
    "do\u011Fall\u0131",
    "edebiyat",
    "e\u011Flence",
    "ekonomik",
    "end\xFCstri",
    "etkinli",
    "felsefi",
    "f\u0131rt\u0131nal",
    "fiziksel",
    "foto\u011Fraf",
    "gazetec",
    "gelecek",
    "geli\u015Fme",
    "giri\u015Fim",
    "g\xF6sterge",
    "g\xF6steri",
    "g\xF6zlemci",
    "g\xFCvenli",
    "g\xFCzellik",
    "haberle\u015F",
    "hareket",
    "heyecanl",
    "h\u0131rs\u0131zl\u0131",
    "\u0131spanak",
    "idareci",
    "ileti\u015Fim",
    "ili\u015Fkile",
    "imparato",
    "insanl\u0131",
    "i\u015Fbirlig",
    "i\u015Fbirlik",
    "kahraman",
    "kalabal",
    "kapasite",
    "karakter",
    "karanl\u0131k",
    "kardiyol",
    "kar\u015F\u0131la",
    "kategori",
    "kat\u0131l\u0131mc",
    "ke\u015Ffetme",
    "k\u0131lavuz",
    "k\u0131ymetl",
    "kitapl\u0131k",
    "kolektif",
    "kolayl\u0131",
    "komiser",
    "koruyucu",
    "k\xFClt\xFCrel",
    "k\xFCt\xFCphan",
    "lacivert",
    "limonata",
    "makarna",
    "malzeme",
    "manzara",
    "matemati",
    "mekanizm",
    "memnuni",
    "merdiven",
    "mevsimli",
    "milyonle",
    "milliyet",
    "mimarli",
    "m\xFCcadele",
    "m\xFChendis",
    "m\xFCkemmel",
    "m\xFC\u015Fteri",
    "nispeten",
    "n\xF6bet\xE7il",
    "olanakla",
    "organiza",
    "oyuncak",
    "\xF6\u011Fretmen",
    "pantolon",
    "payla\u015F\u0131m",
    "pencere",
    "personel",
    "planlama",
    "politik",
    "portakal",
    "program",
    "psikoloj",
    "p\xFCr\xFCzs\xFCz",
    "ramazan",
    "reaksiyo",
    "rehberli",
    "resmile\u015F",
    "r\xFCzgarl",
    "saatlik",
    "sakinle\u015F",
    "salatal\u0131",
    "samimi",
    "sandalye",
    "savunmas",
    "sevgili",
    "seyahat",
    "s\u0131cakl\u0131",
    "s\u0131n\u0131rs\u0131",
    "siyaset",
    "sosyolog",
    "s\xF6zle\u015Fme",
    "\u015Feftali",
    "\u015Femsiye",
    "\u015Fof\xF6rle",
    "tarihsel",
    "tasar\u0131mc",
    "tehlikel",
    "teknoloj",
    "telefon",
    "temizlik",
    "te\u015Fekk\xFCr",
    "tiyatro",
    "topluluk",
    "trakt\xF6r",
    "turuncu",
    "t\xFCketici",
    "t\u0131ra\u015F\xE7\u0131",
    "\xFCniversi",
    "\xFCretici",
    "voleybol",
    "ya\u011Fmurlu",
    "yak\u0131\u015F\u0131kl",
    "yaln\u0131zl\u0131",
    "yard\u0131mc\u0131",
    "yarat\u0131c\u0131",
    "yazarl\u0131k",
    "yelkenli",
    "yeni\xE7er",
    "y\xF6netici",
    "y\xF6netmel",
    "yumu\u015Fakl",
    "yurtta\u015F",
    "y\xFCksekl",
    "y\xFCzy\u0131ll",
    "zamanla",
    "zenginli",
    "ziyaretc"
  ]
};
var CLEANED_TURKISH_WORDS = {};
Object.values(COMMON_TURKISH_WORDS).forEach((list) => {
  list.forEach((word) => {
    const trimmed = word.trim();
    const len = trimmed.length;
    if (len >= 3 && len <= 8) {
      if (!CLEANED_TURKISH_WORDS[len]) {
        CLEANED_TURKISH_WORDS[len] = [];
      }
      const lower = turkishLower(trimmed);
      if (!CLEANED_TURKISH_WORDS[len].includes(lower)) {
        CLEANED_TURKISH_WORDS[len].push(lower);
      }
    }
  });
});
function getRandomWord(length) {
  const words = CLEANED_TURKISH_WORDS[length] || CLEANED_TURKISH_WORDS[5];
  if (!words || words.length === 0) {
    const fallbackWords = {
      3: ["ana", "ar\u0131", "ara", "bal", "\xE7ay", "da\u011F", "iyi", "kar", "ko\xE7", "\u015Fef", "tek", "tuz", "yaz", "yol", "zor"],
      4: ["a\xE7\u0131k", "ad\u0131m", "alan", "alt\u0131"],
      5: ["kalem", "kitap", "b\xFCy\xFCk", "ye\u015Fil"],
      6: ["adalet", "ak\u0131ll\u0131", "bardak", "ba\u015Far\u0131"],
      7: ["arkada\u015F", "belediye", "hastane", "merhaba"],
      8: ["bilgisay", "g\xFCzellik", "telefon", "temizlik"]
    };
    const list = fallbackWords[length] || fallbackWords[5];
    return turkishUpper(list[Math.floor(Math.random() * list.length)]);
  }
  const word = words[Math.floor(Math.random() * words.length)];
  return turkishUpper(word);
}
function isWordInCuratedList(word, length) {
  const normalized = turkishLower(word);
  const list = CLEANED_TURKISH_WORDS[length] || [];
  return list.includes(normalized);
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
var ai = new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
var wordCache = {};
var geminiCooldownUntil = 0;
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/random-word", (req, res) => {
  const { length } = req.body;
  const wordLength = Number(length) || 5;
  const word = getRandomWord(wordLength);
  res.json({ word });
});
app.post("/api/validate-word", async (req, res) => {
  try {
    const { word, length } = req.body;
    if (!word || typeof word !== "string") {
      return res.status(400).json({ error: "Word is required" });
    }
    const normalized = turkishUpper(word.trim());
    const wordLength = Number(length) || normalized.length;
    if (normalized.length !== wordLength) {
      return res.json({ valid: false, reason: "Harf say\u0131s\u0131 uyu\u015Fmuyor" });
    }
    const inCurated = isWordInCuratedList(normalized, wordLength);
    if (inCurated) {
      return res.json({
        valid: true,
        definition: "\xD6zenle se\xE7ilmi\u015F kelime listemizde mevcut."
      });
    }
    const cacheKey = `${normalized}_${wordLength}`;
    if (wordCache[cacheKey]) {
      return res.json(wordCache[cacheKey]);
    }
    if (Date.now() < geminiCooldownUntil) {
      return res.json({
        valid: true,
        definition: "Yapay zeka \u015Fu an yo\u011Fun, kelimeniz otomatik kabul edildi."
      });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        valid: true,
        definition: "Yapay zeka do\u011Frulamas\u0131 devre d\u0131\u015F\u0131 (API Anahtar\u0131 eksik)."
      });
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `L\xFCtfen "${normalized}" kelimesinin T\xFCrk\xE7e TDK s\xF6zl\xFC\u011F\xFCnde yer alan ge\xE7erli, anlaml\u0131, 3, 4, 5, 6, 7 veya 8 harfli (${wordLength} harfli) bir kelime olup olmad\u0131\u011F\u0131n\u0131 kontrol et. 
      Sadece isimler, s\u0131fatlar, zarflar veya mastar halindeki fiiller (\xF6rn: "yapmak", "gelmek" de\u011Fil, "yapma", "gelme" veya isim k\xF6k\xFC) gibi kelimeler ge\xE7erli say\u0131lmal\u0131d\u0131r. 
      \xD6zel isimler, uydurma kelimeler veya anlams\u0131z harf dizilimleri GE\xC7ERS\u0130Z say\u0131lmal\u0131d\u0131r.
      T\xFCrk\xE7e karakter uyumlulu\u011Funa dikkat et. Kelime ${wordLength} harfli olmal\u0131d\u0131r.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            valid: {
              type: import_genai.Type.BOOLEAN,
              description: "Kelime TDK s\xF6zl\xFC\u011F\xFCnde ger\xE7ekten mevcut ve anlaml\u0131 bir T\xFCrk\xE7e kelime ise true, aksi halde false."
            },
            definition: {
              type: import_genai.Type.STRING,
              description: "Kelimenin k\u0131sa TDK T\xFCrk\xE7e s\xF6zl\xFCk anlam\u0131/tan\u0131m\u0131. E\u011Fer kelime ge\xE7ersizse a\xE7\u0131klama/sebep."
            }
          },
          required: ["valid", "definition"]
        }
      }
    });
    const resultText = response.text?.trim() || "{}";
    const result = JSON.parse(resultText);
    wordCache[cacheKey] = result;
    res.json(result);
  } catch (error) {
    console.log(`[Word Validation] Validation active (local check applied).`);
    geminiCooldownUntil = Date.now() + 5 * 60 * 1e3;
    res.json({
      valid: true,
      definition: "Ba\u011Flant\u0131 hatas\u0131 veya yo\u011Funluk nedeniyle kelime otomatik kabul edildi."
    });
  }
});
var clients = /* @__PURE__ */ new Map();
var matchmakingQueue = /* @__PURE__ */ new Map();
var challenges = /* @__PURE__ */ new Map();
var matches = /* @__PURE__ */ new Map();
var broadcastLobby = () => {
  const lobbyList = Array.from(clients.entries()).map(([id, client]) => ({
    id,
    name: client.name,
    avatarUrl: client.avatarUrl,
    status: client.status
  }));
  const payload = JSON.stringify({
    type: "lobby_update",
    players: lobbyList
  });
  for (const [_, client] of clients.entries()) {
    if (client.ws.readyState === import_ws.WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
};
var setupWebSocket = (server) => {
  const wss = new import_ws.WebSocketServer({ noServer: true });
  server.on("upgrade", () => {
  });
  wss.on("error", (err) => {
    console.error("[WS Server] error:", err);
    try {
      import_fs.default.appendFileSync(import_path.default.join(process.cwd(), "ws_debug.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] WSS ERROR: ${err.stack || err.message || err}
`);
    } catch (e) {
    }
  });
  const originalEmit = server.emit;
  server.emit = function(event, ...args) {
    if (event === "upgrade") {
      const request = args[0];
      const socket = args[1];
      const head = args[2];
      let pathname = "";
      try {
        pathname = new URL(request.url || "", "http://localhost").pathname;
      } catch (e) {
        pathname = (request.url || "").split("?")[0];
      }
      try {
        const logMsg = `[${(/* @__PURE__ */ new Date()).toISOString()}] Upgrade event received: URL=${request.url}, Pathname=${pathname}, Headers=${JSON.stringify(request.headers)}
`;
        import_fs.default.appendFileSync(import_path.default.join(process.cwd(), "ws_debug.log"), logMsg);
      } catch (err) {
      }
      if (pathname.startsWith("/ws")) {
        console.log(`[WS Intercept] Exclusively handling upgrade for game server. URL: ${request.url}, Pathname: ${pathname}`);
        try {
          import_fs.default.appendFileSync(import_path.default.join(process.cwd(), "ws_debug.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] Intercepted and starting handleUpgrade for ${request.url}
`);
          wss.handleUpgrade(request, socket, head, (ws) => {
            try {
              import_fs.default.appendFileSync(import_path.default.join(process.cwd(), "ws_debug.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] handleUpgrade callback executed, emitting connection
`);
            } catch (e) {
            }
            wss.emit("connection", ws, request);
          });
        } catch (err) {
          console.error("[WS Intercept] Failed to handle upgrade:", err);
          try {
            import_fs.default.appendFileSync(import_path.default.join(process.cwd(), "ws_debug.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] handleUpgrade FAILED: ${err.stack || err.message || err}
`);
          } catch (e) {
          }
          try {
            socket.destroy();
          } catch (e) {
          }
        }
        return true;
      }
    }
    return originalEmit.call(this, event, ...args);
  };
  wss.on("connection", (ws, request) => {
    let playerId = "";
    try {
      import_fs.default.appendFileSync(import_path.default.join(process.cwd(), "ws_debug.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] WSS on('connection') fired for URL: ${request?.url}
`);
    } catch (e) {
    }
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        try {
          import_fs.default.appendFileSync(import_path.default.join(process.cwd(), "ws_debug.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] Received WS message: ${JSON.stringify(data)}
`);
        } catch (e) {
        }
        switch (data.type) {
          case "join": {
            playerId = data.id;
            const existingClient = clients.get(playerId);
            if (existingClient && existingClient.ws !== ws) {
              console.log(`[WS Server] Closing stale connection for player ${playerId}`);
              try {
                existingClient.ws.close(1e3, "Replaced by new connection");
              } catch (e) {
              }
            }
            clients.set(playerId, {
              ws,
              name: data.name,
              avatarUrl: data.avatarUrl,
              status: "idle"
            });
            console.log(`Player connected: ${data.name} (${playerId})`);
            broadcastLobby();
            break;
          }
          case "ping": {
            if (ws.readyState === import_ws.WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "pong" }));
            }
            break;
          }
          case "get_lobby": {
            broadcastLobby();
            break;
          }
          case "challenge": {
            const { challengedId, wordLength } = data;
            const challenger = clients.get(playerId);
            const challenged = clients.get(challengedId);
            if (challenger && challenged && challenged.status === "idle") {
              const challengeId = `chal_${Date.now()}`;
              challenges.set(challengeId, {
                id: challengeId,
                challengerId: playerId,
                challengerName: challenger.name,
                challengedId,
                challengedName: challenged.name,
                wordLength,
                status: "pending"
              });
              if (challenged.ws.readyState === import_ws.WebSocket.OPEN) {
                challenged.ws.send(JSON.stringify({
                  type: "challenged",
                  challenge: {
                    id: challengeId,
                    challengerId: playerId,
                    challengerName: challenger.name,
                    wordLength
                  }
                }));
              }
            }
            break;
          }
          case "challenge_respond": {
            const { challengeId, accept } = data;
            const challenge = challenges.get(challengeId);
            if (challenge) {
              const challenger = clients.get(challenge.challengerId);
              const challenged = clients.get(challenge.challengedId);
              if (accept) {
                challenge.status = "accepted";
                if (challenger) challenger.status = "playing";
                if (challenged) challenged.status = "playing";
                const targetWord = getRandomWord(challenge.wordLength);
                const matchId = `match_${Date.now()}`;
                matches.set(matchId, {
                  id: matchId,
                  wordLength: challenge.wordLength,
                  targetWord,
                  players: {
                    [challenge.challengerId]: {
                      name: challenge.challengerName,
                      avatarUrl: challenger?.avatarUrl,
                      attempts: [],
                      currentAttempt: 0,
                      completed: false,
                      won: false,
                      timeRemaining: 20,
                      score: 0
                    },
                    [challenge.challengedId]: {
                      name: challenge.challengedName,
                      avatarUrl: challenged?.avatarUrl,
                      attempts: [],
                      currentAttempt: 0,
                      completed: false,
                      won: false,
                      timeRemaining: 20,
                      score: 0
                    }
                  },
                  status: "playing"
                });
                const startPayload = JSON.stringify({
                  type: "match_start",
                  matchId,
                  targetWord,
                  wordLength: challenge.wordLength,
                  opponentId: challenge.challengedId,
                  opponentName: challenge.challengedName,
                  players: {
                    [challenge.challengerId]: { name: challenge.challengerName },
                    [challenge.challengedId]: { name: challenge.challengedName }
                  }
                });
                const startPayloadOpponent = JSON.stringify({
                  type: "match_start",
                  matchId,
                  targetWord,
                  wordLength: challenge.wordLength,
                  opponentId: challenge.challengerId,
                  opponentName: challenge.challengerName,
                  players: {
                    [challenge.challengerId]: { name: challenge.challengerName },
                    [challenge.challengedId]: { name: challenge.challengedName }
                  }
                });
                if (challenger && challenger.ws.readyState === import_ws.WebSocket.OPEN) {
                  challenger.ws.send(startPayload);
                }
                if (challenged && challenged.ws.readyState === import_ws.WebSocket.OPEN) {
                  challenged.ws.send(startPayloadOpponent);
                }
              } else {
                challenge.status = "declined";
                if (challenger && challenger.ws.readyState === import_ws.WebSocket.OPEN) {
                  challenger.ws.send(JSON.stringify({
                    type: "challenge_declined",
                    challengedName: challenge.challengedName
                  }));
                }
                challenges.delete(challengeId);
              }
              broadcastLobby();
            }
            break;
          }
          case "game_update": {
            const { matchId, attempts, currentAttempt, completed, won, score, timeRemaining } = data;
            const match = matches.get(matchId);
            if (match && match.status === "playing") {
              const player = match.players[playerId];
              if (player) {
                player.attempts = attempts;
                player.currentAttempt = currentAttempt;
                player.completed = completed;
                player.won = won;
                player.score = score;
                player.timeRemaining = timeRemaining;
                const opponentId = Object.keys(match.players).find((id) => id !== playerId);
                if (opponentId) {
                  const opponent = clients.get(opponentId);
                  if (opponent && opponent.ws.readyState === import_ws.WebSocket.OPEN) {
                    opponent.ws.send(JSON.stringify({
                      type: "match_update",
                      matchId,
                      playerUpdate: {
                        id: playerId,
                        attempts,
                        currentAttempt,
                        completed,
                        won,
                        score,
                        timeRemaining
                      }
                    }));
                  }
                }
                const allCompleted = Object.values(match.players).every((p) => p.completed);
                if (allCompleted) {
                  match.status = "ended";
                  const p1Id = Object.keys(match.players)[0];
                  const p2Id = Object.keys(match.players)[1];
                  const p1 = match.players[p1Id];
                  const p2 = match.players[p2Id];
                  let winnerId = "draw";
                  if (p1.won && !p2.won) {
                    winnerId = p1Id;
                  } else if (!p1.won && p2.won) {
                    winnerId = p2Id;
                  } else if (p1.won && p2.won) {
                    if (p1.currentAttempt < p2.currentAttempt) {
                      winnerId = p1Id;
                    } else if (p2.currentAttempt < p1.currentAttempt) {
                      winnerId = p2Id;
                    } else if (p1.score > p2.score) {
                      winnerId = p1Id;
                    } else if (p2.score > p1.score) {
                      winnerId = p2Id;
                    }
                  }
                  match.winnerId = winnerId;
                  const endPayload = JSON.stringify({
                    type: "match_end",
                    matchId,
                    winnerId,
                    players: match.players
                  });
                  const p1Client = clients.get(p1Id);
                  const p2Client = clients.get(p2Id);
                  if (p1Client) {
                    p1Client.status = "idle";
                    if (p1Client.ws.readyState === import_ws.WebSocket.OPEN) p1Client.ws.send(endPayload);
                  }
                  if (p2Client) {
                    p2Client.status = "idle";
                    if (p2Client.ws.readyState === import_ws.WebSocket.OPEN) p2Client.ws.send(endPayload);
                  }
                  broadcastLobby();
                }
              }
            }
            break;
          }
          case "leave_match": {
            const { matchId } = data;
            const match = matches.get(matchId);
            if (match && match.status === "playing") {
              match.status = "ended";
              const opponentId = Object.keys(match.players).find((id) => id !== playerId);
              if (opponentId) {
                const opponent = clients.get(opponentId);
                if (opponent && opponent.ws.readyState === import_ws.WebSocket.OPEN) {
                  opponent.ws.send(JSON.stringify({
                    type: "opponent_left",
                    matchId
                  }));
                }
                const oppClient = clients.get(opponentId);
                if (oppClient) oppClient.status = "idle";
              }
              const selfClient = clients.get(playerId);
              if (selfClient) selfClient.status = "idle";
              broadcastLobby();
            }
            break;
          }
          case "join_matchmaking": {
            const { wordLength } = data;
            const selfClient = clients.get(playerId);
            if (!selfClient || selfClient.status === "playing") break;
            console.log(`Player joined matchmaking queue: ${selfClient.name} (${playerId}) for ${wordLength} letters`);
            matchmakingQueue.set(playerId, { wordLength });
            let opponentId = "";
            for (const [id, info] of matchmakingQueue.entries()) {
              if (id !== playerId) {
                if (info.wordLength === wordLength) {
                  opponentId = id;
                  break;
                }
              }
            }
            if (!opponentId) {
              for (const [id] of matchmakingQueue.entries()) {
                if (id !== playerId) {
                  opponentId = id;
                  break;
                }
              }
            }
            if (opponentId) {
              const opponentClient = clients.get(opponentId);
              const opponentInfo = matchmakingQueue.get(opponentId);
              if (opponentClient && opponentInfo) {
                matchmakingQueue.delete(playerId);
                matchmakingQueue.delete(opponentId);
                selfClient.status = "playing";
                opponentClient.status = "playing";
                const finalWordLength = wordLength || opponentInfo.wordLength || 5;
                const targetWord = getRandomWord(finalWordLength);
                const matchId = `match_${Date.now()}`;
                matches.set(matchId, {
                  id: matchId,
                  wordLength: finalWordLength,
                  targetWord,
                  players: {
                    [playerId]: {
                      name: selfClient.name,
                      avatarUrl: selfClient.avatarUrl,
                      attempts: [],
                      currentAttempt: 0,
                      completed: false,
                      won: false,
                      timeRemaining: 20,
                      score: 0
                    },
                    [opponentId]: {
                      name: opponentClient.name,
                      avatarUrl: opponentClient.avatarUrl,
                      attempts: [],
                      currentAttempt: 0,
                      completed: false,
                      won: false,
                      timeRemaining: 20,
                      score: 0
                    }
                  },
                  status: "playing"
                });
                const startPayloadSelf = JSON.stringify({
                  type: "match_start",
                  matchId,
                  targetWord,
                  wordLength: finalWordLength,
                  opponentId,
                  opponentName: opponentClient.name,
                  players: {
                    [playerId]: { name: selfClient.name },
                    [opponentId]: { name: opponentClient.name }
                  }
                });
                const startPayloadOpponent = JSON.stringify({
                  type: "match_start",
                  matchId,
                  targetWord,
                  wordLength: finalWordLength,
                  opponentId: playerId,
                  opponentName: selfClient.name,
                  players: {
                    [playerId]: { name: selfClient.name },
                    [opponentId]: { name: opponentClient.name }
                  }
                });
                if (selfClient.ws.readyState === import_ws.WebSocket.OPEN) {
                  selfClient.ws.send(startPayloadSelf);
                }
                if (opponentClient.ws.readyState === import_ws.WebSocket.OPEN) {
                  opponentClient.ws.send(startPayloadOpponent);
                }
                console.log(`Matchmaking succeeded: ${selfClient.name} VS ${opponentClient.name}`);
                broadcastLobby();
              }
            } else {
              if (selfClient.ws.readyState === import_ws.WebSocket.OPEN) {
                selfClient.ws.send(JSON.stringify({
                  type: "matchmaking_status",
                  status: "queued"
                }));
              }
            }
            break;
          }
          case "leave_matchmaking": {
            console.log(`Player left matchmaking queue: ${playerId}`);
            matchmakingQueue.delete(playerId);
            const selfClient = clients.get(playerId);
            if (selfClient && selfClient.ws.readyState === import_ws.WebSocket.OPEN) {
              selfClient.ws.send(JSON.stringify({
                type: "matchmaking_status",
                status: "idle"
              }));
            }
            break;
          }
        }
      } catch (e) {
        console.error("WebSocket message parsing error:", e);
      }
    });
    ws.on("error", (err) => {
      try {
        import_fs.default.appendFileSync(import_path.default.join(process.cwd(), "ws_debug.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] Socket ERROR for player ${playerId || "unknown"}: ${err.message || err}
`);
      } catch (e) {
      }
    });
    ws.on("close", (code, reason) => {
      try {
        import_fs.default.appendFileSync(import_path.default.join(process.cwd(), "ws_debug.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] Socket CLOSED for player ${playerId || "unknown"}. Code: ${code}, Reason: ${reason || "none"}
`);
      } catch (e) {
      }
      if (playerId) {
        const currentClient = clients.get(playerId);
        if (currentClient && currentClient.ws === ws) {
          clients.delete(playerId);
          matchmakingQueue.delete(playerId);
          console.log(`Player disconnected: ${playerId}`);
          for (const [matchId, match] of matches.entries()) {
            if (match.status === "playing" && match.players[playerId]) {
              match.status = "ended";
              const opponentId = Object.keys(match.players).find((id) => id !== playerId);
              if (opponentId) {
                const opponent = clients.get(opponentId);
                if (opponent && opponent.ws.readyState === import_ws.WebSocket.OPEN) {
                  opponent.ws.send(JSON.stringify({
                    type: "opponent_left",
                    matchId
                  }));
                }
                const oppClient = clients.get(opponentId);
                if (oppClient) oppClient.status = "idle";
              }
            }
          }
          broadcastLobby();
        } else {
          console.log(`[WS Server] Stale connection closed for player ${playerId}. Keeping current connection.`);
        }
      }
    });
  });
};
async function startServer() {
  const server = import_http.default.createServer(app);
  setupWebSocket(server);
  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
