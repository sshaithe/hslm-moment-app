import type { Language } from './types';

const translations = {
  tr: {
    // Landing
    uploadMemories: 'Anılarınızı Yükleyin',
    viewLiveGallery: 'Canlı Galeriyi Gör',
    thankYouQuote: 'En güzel günümüzün bir parçası olduğunuz için teşekkür ederiz. Anılarınızı bizimle paylaşın.',
    totalUploads: 'Toplam Yükleme',
    activeGuests: 'Aktif Misafirler',
    messages: 'Mesajlar',
    videos: 'Videolar',
    adminAccess: 'Yönetici',

    // Join
    welcome: 'Hoş Geldiniz',
    enterDetails: 'Galeriye katılmak için bilgilerinizi girin.',
    firstName: 'Ad',
    lastName: 'Soyad',
    tableNumber: 'Masa No (İsteğe Bağlı)',
    agreeShare: 'Fotoğraf ve videoları bu özel düğün galerisinde paylaşmayı kabul ediyorum.',
    enterGallery: 'Galeriye Girin',
    privacyNote: 'Sadece davetli misafirler bu galeriyi görüntüleyebilir.',

    // Upload
    newMemory: 'Yeni Anı',
    hiName: 'Merhaba, {{name}}',
    whatToShare: 'Ne paylaşmak istersiniz?',
    photo: 'Fotoğraf',
    video: 'Video',
    message: 'Mesaj',
    tapToChoose: 'Galeriden seçin veya sürükleyip bırakın',
    writeWishes: 'En içten dileklerinizi yazın...',
    addCaption: 'Bir başlık ekleyin...',
    shareNow: 'Şimdi Paylaş',
    uploadSuccess: 'Yükleme Başarılı!',
    securityNote: 'Yüklemeniz canlı galeride anında görünecek. Uygunsuz içerik çift tarafından kaldırılabilir.',

    // Gallery
    liveGallery: 'Canlı Galeri',
    live: 'CANLI',
    all: 'Tümü',
    photos: 'Fotoğraflar',
    videosTab: 'Videolar',
    messagesTab: 'Mesajlar',
    popular: 'Popüler',
    uploadMore: 'Daha Fazla Yükle',

    // Photo Detail
    download: 'İndir',
    report: 'Bildir',
    reportConfirm: 'Bu içeriği bildirmek istediğinize emin misiniz?',
    addComment: 'Yorum ekle...',
    send: 'Gönder',

    // Message Wall
    weddingWishes: 'Düğün Dilekleri',
    memoryWall: 'Anı Duvarı',
    writeMessage: 'Mesaj Yaz',
    videoWish: 'Video Dilek',

    // Admin
    adminLogin: 'Yönetici Girişi',
    password: 'Şifre',
    enterDashboard: 'Panele Giriş Yap',
    adminNote: 'Yalnızca çift veya düğün organizatörü içindir.',
    dashboard: 'Kontrol Paneli',
    uploadsManagement: 'Yüklemeler',
    gallery: 'Galeri',
    qrCode: 'QR Kod',
    slideshow: 'Slayt Gösterisi',
    settings: 'Ayarlar',
    weddingDashboard: 'Düğün Kontrol Paneli',
    totalUploadsStat: 'Toplam Yükleme',
    guestMessages: 'Misafir Mesajları',
    pendingApproval: 'Onay Bekleyen',
    activeGuestsStat: 'Aktif Misafirler',
    downloadAll: 'Tümünü İndir',
    generateQR: 'QR Kod Oluştur',
    liveSlideshow: 'Canlı Slayt',
    pauseUploads: 'Yüklemeleri Durdur',
    resumeUploads: 'Yüklemelere Devam Et',
    publicGallery: 'Herkese Açık Galeri',
    slideshowApproval: 'Slayt Onay Modu',
    guestComments: 'Misafir Yorumları',
    hide: 'Gizle',
    delete: 'Sil',
    approve: 'Onayla',
    feature: 'Öne Çıkar',
    searchUploads: 'Yükleme ara...',
    filterByType: 'Türe Göre Filtrele',
    filterByStatus: 'Duruma Göre Filtrele',
    visible: 'Görünür',
    hidden: 'Gizli',
    pending: 'Beklemede',
    reported: 'Bildirilen',
    featured: 'Öne Çıkan',
    bulkActions: 'Toplu İşlemler',
    downloadQRPoster: 'QR Posteri İndir',
    copyPrivateLink: 'Özel Bağlantıyı Kopyala',
    shareLink: 'Bağlantıyı Paylaş',
    scanToShare: 'Anılarınızı paylaşmak için tarayın',
    uploadDescription: 'Fotoğraflarınızı, videolarınızı ve dileklerinizi anında yükleyin',
    prev: 'Önceki',
    next: 'Sonraki',
    play: 'Oynat',
    pause: 'Durdur',

    // Settings
    yourGalleryPrivate: 'Galeriniz özel',
    accessSettings: 'Erişim Ayarları',
    privateLinkAccess: 'Özel Bağlantı Erişimi',
    weddingPassword: 'Düğün Şifresi',
    requireGuestName: 'Misafir Adı Gerekli',
    contentSettings: 'İçerik Ayarları',
    instantPublicGallery: 'Anında Herkese Açık Galeri',
    approveBeforeDisplay: 'Görüntülemeden Önce Onayla',
    slideshowApprovalMode: 'Slayt Onay Modu',
    allowComments: 'Yorumlara İzin Ver',
    allowVideoUploads: 'Video Yüklemelere İzin Ver',
    allowGuestDownloads: 'Misafir İndirmelerine İzin Ver',
    autoHideReported: 'Bildirilen İçeriği Otomatik Gizle',
    pauseAllUploads: 'Tüm Yüklemeleri Durdur',
    saveSettings: 'Ayarları Kaydet',
    footerNote: 'İsimler ve yüklemeler yalnızca bu özel düğün galerisi için kullanılır.',
    uploadsPaused: 'Yüklemeler çift tarafından geçici olarak durduruldu.',

    // Toast
    uploadSuccessToast: 'Yükleme başarılı!',
    welcomeToast: 'Galeriye hoş geldiniz!',
    loginSuccess: 'Giriş başarılı!',
    linkCopied: 'Bağlantı kopyalandı!',
    settingsSaved: 'Ayarlar kaydedildi!',
    actionSuccess: 'İşlem başarılı!',
    error: 'Bir hata oluştu.',
    brushStrict: 'Düz',
    brushCuted: 'Kesikli',
    brushPoint: 'Noktalı',
    messagesLimitReached: 'Maksimum {{limit}} mesaj sınırına ulaştınız.',
    maxMessagesLimitLabel: 'Maks Mesaj Sınırı',
    guestBookExplainer: 'Dijital anı defterimize en içten dileklerinizi yazın, bir çizim yapın, imzanızı bırakın veya bir fotoğraf yükleyin. Çiftimiz bu anıları ömür boyu saklayacaktır!',
    guestBookLimitReached: 'Maksimum {{limit}} misafir defteri mesajı sınırına ulaştınız.',
    maxGuestBookLimitLabel: 'Maks Defter Mesajı Sınırı',
  },
  en: {
    // Landing
    uploadMemories: 'Upload Your Memories',
    viewLiveGallery: 'View Live Gallery',
    thankYouQuote: 'Thank you for being part of our most beautiful day. Share your memories with us.',
    totalUploads: 'Total Uploads',
    activeGuests: 'Active Guests',
    messages: 'Messages',
    videos: 'Videos',
    adminAccess: 'Admin',

    // Join
    welcome: 'Welcome',
    enterDetails: 'Enter your details to join the private gallery.',
    firstName: 'First Name',
    lastName: 'Last Name',
    tableNumber: 'Table Number (Optional)',
    agreeShare: 'I agree to share photos & videos in this private wedding gallery.',
    enterGallery: 'Enter Wedding Gallery',
    privacyNote: 'Only invited guests can view this gallery.',

    // Upload
    newMemory: 'New Memory',
    hiName: 'Hi, {{name}}',
    whatToShare: 'What would you like to share?',
    photo: 'Photo',
    video: 'Video',
    message: 'Message',
    tapToChoose: 'Tap to choose from library or drag & drop',
    writeWishes: 'Write your warmest wishes...',
    addCaption: 'Add a caption...',
    shareNow: 'Share Now',
    uploadSuccess: 'Upload Successful!',
    securityNote: 'Your upload will appear instantly in the live gallery. Inappropriate content can be removed by the couple.',

    // Gallery
    liveGallery: 'Live Gallery',
    live: 'LIVE',
    all: 'All',
    photos: 'Photos',
    videosTab: 'Videos',
    messagesTab: 'Messages',
    popular: 'Popular',
    uploadMore: 'Upload More',

    // Photo Detail
    download: 'Download',
    report: 'Report',
    reportConfirm: 'Are you sure you want to report this content?',
    addComment: 'Add a comment...',
    send: 'Send',

    // Message Wall
    weddingWishes: 'Wedding Wishes',
    memoryWall: 'Memory Wall',
    writeMessage: 'Write a Message',
    videoWish: 'Video Wish',

    // Admin
    adminLogin: 'Admin Login',
    password: 'Password',
    enterDashboard: 'Enter Dashboard',
    adminNote: 'For couple or wedding organizer only.',
    dashboard: 'Dashboard',
    uploadsManagement: 'Uploads',
    gallery: 'Gallery',
    qrCode: 'QR Code',
    slideshow: 'Slideshow',
    settings: 'Settings',
    weddingDashboard: "Wedding Dashboard",
    totalUploadsStat: 'Total Uploads',
    guestMessages: 'Guest Messages',
    pendingApproval: 'Pending Approval',
    activeGuestsStat: 'Active Guests',
    downloadAll: 'Download All',
    generateQR: 'Generate QR',
    liveSlideshow: 'Live Slideshow',
    pauseUploads: 'Pause Uploads',
    resumeUploads: 'Resume Uploads',
    publicGallery: 'Public Gallery',
    slideshowApproval: 'Slideshow Approval',
    guestComments: 'Guest Comments',
    hide: 'Hide',
    delete: 'Delete',
    approve: 'Approve',
    feature: 'Feature',
    searchUploads: 'Search uploads...',
    filterByType: 'Filter by Type',
    filterByStatus: 'Filter by Status',
    visible: 'Visible',
    hidden: 'Hidden',
    pending: 'Pending',
    reported: 'Reported',
    featured: 'Featured',
    bulkActions: 'Bulk Actions',
    downloadQRPoster: 'Download QR Poster',
    copyPrivateLink: 'Copy Private Link',
    shareLink: 'Share Link',
    scanToShare: 'Scan to share your memories',
    uploadDescription: 'Upload your photos, videos, and wishes instantly',
    prev: 'Prev',
    next: 'Next',
    play: 'Play',
    pause: 'Pause',

    // Settings
    yourGalleryPrivate: 'Your gallery is private',
    accessSettings: 'Access Settings',
    privateLinkAccess: 'Private Link Access',
    weddingPassword: 'Wedding Password',
    requireGuestName: 'Require Guest Name',
    contentSettings: 'Content Settings',
    instantPublicGallery: 'Instant Public Gallery',
    approveBeforeDisplay: 'Approve Before Display',
    slideshowApprovalMode: 'Slideshow Approval Mode',
    allowComments: 'Allow Comments',
    allowVideoUploads: 'Allow Video Uploads',
    allowGuestDownloads: 'Allow Guest Downloads',
    autoHideReported: 'Auto-hide Reported Content',
    pauseAllUploads: 'Pause All Uploads',
    saveSettings: 'Save Settings',
    footerNote: 'Names and uploads are used only for this private wedding gallery.',
    uploadsPaused: 'Uploads are temporarily paused by the couple.',

    // Toast
    uploadSuccessToast: 'Upload successful!',
    welcomeToast: 'Welcome to the gallery!',
    loginSuccess: 'Login successful!',
    linkCopied: 'Link copied!',
    settingsSaved: 'Settings saved!',
    actionSuccess: 'Action successful!',
    error: 'An error occurred.',
    brushStrict: 'Strict',
    brushCuted: 'Cuted',
    brushPoint: 'Point',
    messagesLimitReached: 'You have reached the limit of {{limit}} messages.',
    maxMessagesLimitLabel: 'Max Messages Per Guest',
    guestBookExplainer: 'Write your warmest wishes, draw a sketch, sign your name, or upload a photo to our digital guest book. The couple will cherish these memories forever!',
    guestBookLimitReached: 'You have reached the limit of {{limit}} guest book entries.',
    maxGuestBookLimitLabel: 'Max Guest Book Entries',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function getLanguage(): Language {
  const saved = localStorage.getItem('vowvault_language') as Language | null;
  if (saved && (saved === 'tr' || saved === 'en')) return saved;
  
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('tr')) return 'tr';
  return 'en';
}

export function setLanguage(lang: Language): void {
  localStorage.setItem('vowvault_language', lang);
}

export function t(key: TranslationKey, lang?: Language, vars?: Record<string, string>): string {
  const language = lang || getLanguage();
  let text = (translations[language][key] || translations.en[key] || key) as string;
  
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(`{{${k}}}`, v);
    });
  }
  
  return text;
}
