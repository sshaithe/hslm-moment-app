import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Film, MessageSquare, X, UploadCloud, Shield, ArrowLeft, RefreshCw, Video, Library, Square } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { UploadType } from '@/lib/types';
import Sparkle from '@/components/shared/Sparkle';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/shared/Toast';
import EmojiPicker from '@/components/shared/EmojiPicker';

export default function UploadScreen() {
  const navigate = useNavigate();
  const { wedding, currentGuest: guest, createUpload, uploads } = useDatabase();
  const { t, language } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();
  const [uploadType, setUploadType] = useState<UploadType>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [messageText, setMessageText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sparklePos, setSparklePos] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Error State
  const [uploadError, setUploadError] = useState(false);

  // Restore drafts on mount
  useEffect(() => {
    const savedType = localStorage.getItem('vv_upload_type') as UploadType | null;
    const savedCaption = localStorage.getItem('vv_upload_caption');
    const savedMsg = localStorage.getItem('vv_upload_message_text');
    if (savedType) setUploadType(savedType);
    if (savedCaption) setCaption(savedCaption);
    if (savedMsg) setMessageText(savedMsg);
  }, []);

  const handleTypeChange = (type: UploadType) => {
    setUploadType(type);
    localStorage.setItem('vv_upload_type', type);
  };

  const handleCaptionChange = (val: string) => {
    setCaption(val);
    localStorage.setItem('vv_upload_caption', val);
  };

  const handleMessageChange = (val: string) => {
    setMessageText(val);
    localStorage.setItem('vv_upload_message_text', val);
  };

  // Live Camera states
  const [sourceMode, setSourceMode] = useState<'library' | 'camera'>('library');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isPaused = wedding.uploads_paused;

  // ─── 1. REGISTRATION WORKFLOW CHECK ───
  useEffect(() => {
    if (!guest && wedding.require_guest_name) {
      // Force registration first, returning them here once done
      navigate('/join?redirect=/upload');
    }
  }, [guest, wedding.require_guest_name, navigate]);

  // ─── 2. LIVE CAMERA OPERATIONS ───
  const startCamera = async (mode = facingMode) => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: uploadType === 'video'
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Failed to access camera stream:', err);
      addToast(t('cameraAccessError'), 'error');
      setSourceMode('library');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setIsRecording(false);
  };

  const flipCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const fileObj = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        validateAndSetFile(fileObj);
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];

    let options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/mp4' };
        }
      }
    }

    try {
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const videoBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/mp4' });
        
        const extension = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const fileObj = new File([videoBlob], `capture_${Date.now()}.${extension}`, { type: videoBlob.type });
        await validateAndSetFile(fileObj);
        stopCamera();
      };

      recorder.start(100);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to initiate MediaRecorder:', err);
      addToast(t('videoRecordingError'), 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Turn off/on camera on tab switch or preview resets
  useEffect(() => {
    if (sourceMode === 'camera' && !preview && !isCameraActive && (uploadType === 'photo' || uploadType === 'video')) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [sourceMode, uploadType, preview]);

  // Clean up streams on final unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Helper to resolve video duration
  const checkVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(0);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  // Centralized validator for file type, size, and duration
  const validateAndSetFile = async (f: File) => {
    // 1. File Size Validation (150MB cap)
    const MAX_SIZE = 150 * 1024 * 1024;
    if (f.size > MAX_SIZE) {
      addToast(
        language === 'tr'
          ? 'Lütfen 150MB\'tan küçük bir dosya seçin.'
          : 'Please choose a file smaller than 150MB.',
        'error'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. MIME Type / Extension Validation
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');

    if (uploadType === 'photo') {
      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!isImage || !allowedImageTypes.includes(f.type)) {
        addToast(
          language === 'tr'
            ? 'Desteklenmeyen görsel türü. Sadece JPG, JPEG, PNG, WEBP desteklenir.'
            : 'Unsupported image type. Only JPG, JPEG, PNG, WEBP are allowed.',
          'error'
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    } else if (uploadType === 'video') {
      const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
      if (!isVideo || !allowedVideoTypes.includes(f.type)) {
        addToast(
          language === 'tr'
            ? 'Desteklenmeyen video türü. Sadece MP4, MOV, WEBM desteklenir.'
            : 'Unsupported video type. Only MP4, MOV, WEBM are allowed.',
          'error'
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // 3. Video Duration Validation (under 3 minutes / 180s)
      const duration = await checkVideoDuration(f);
      if (duration > 180) {
        addToast(
          language === 'tr'
            ? 'Lütfen 3 dakikadan kısa bir video seçin.'
            : 'Please choose a video shorter than 3 minutes.',
          'error'
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    // Revoke previous preview URL to prevent memory leaks
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    
    setFile(f);
    const objectUrl = URL.createObjectURL(f);
    setPreview(objectUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await validateAndSetFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    validateAndSetFile(f);
  }, [preview, uploadType, language]);

  const handleSubmit = async () => {
    if (!guest && wedding.require_guest_name) {
      navigate('/join?redirect=/upload');
      return;
    }

    setUploadError(false);

    const guestName = guest ? `${guest.first_name} ${guest.last_name}` : 'Anonymous';
    const guestId = guest?.guest_id || 'anonymous';

    let localUploadUrl = preview || undefined;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const upload = {
        id: uuidv4(),
        wedding_id: wedding.id,
        guest_id: guestId,
        guest_name: guestName,
        type: uploadType,
        local_url: localUploadUrl,
        caption: caption.trim() || undefined,
        message_text: uploadType === 'message' ? messageText.trim() : undefined,
        is_approved: !wedding.approve_before_display,
        is_hidden: false,
        is_featured: false,
        report_count: 0,
        file_size: file ? file.size : undefined,
      };

      await createUpload(upload, (progress) => {
        setUploadProgress(progress);
      });

      // Track upload ID on this device (for anonymous upload limits)
      const myUploadedIds = JSON.parse(localStorage.getItem('vv_my_uploaded_ids') || '[]');
      myUploadedIds.push(upload.id);
      localStorage.setItem('vv_my_uploaded_ids', JSON.stringify(myUploadedIds));

      // Clear drafts on success
      localStorage.removeItem('vv_upload_caption');
      localStorage.removeItem('vv_upload_message_text');
      localStorage.removeItem('vv_upload_type');

      setShowSuccess(true);
      addToast(t('uploadSuccessToast'), 'success');

      setTimeout(() => {
        navigate('/gallery');
      }, 1200);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(true);
      addToast(t('uploadFailed'), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Video count check (10 videos limit)
  const myUploadedIds: string[] = JSON.parse(localStorage.getItem('vv_my_uploaded_ids') || '[]');
  const myVideos = uploads.filter((u) => {
    if (u.type !== 'video') return false;
    // Match registered guests
    if (guest && u.guest_id === guest.guest_id) return true;
    // Match device uploads for anonymous guest fallback
    return myUploadedIds.includes(u.id);
  });
  const videoLimitReached = myVideos.length >= 10;

  const canSubmit = !isUploading && (
    uploadType === 'message'
      ? messageText.trim().length > 0
      : (uploadType === 'video' ? (file !== null && !videoLimitReached) : file !== null)
  );

  const typeOptions: { type: UploadType; icon: typeof Camera; label: string }[] = [
    { type: 'photo', icon: Camera, label: t('photo') },
    { type: 'video', icon: Film, label: t('video') },
    { type: 'message', icon: MessageSquare, label: t('message') },
  ];

  if (isPaused) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-blush flex items-center justify-center mb-4">
          <Shield size={28} className="text-gold" />
        </div>
        <h3 className="font-heading text-lg text-charcoal mb-2">{t('uploadsPaused')}</h3>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-6 py-2.5 rounded-full gradient-gold text-white text-sm font-medium"
        >
          {t('liveGallery')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent-border/30 bg-white/50">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center">
          <ArrowLeft size={20} className="text-charcoal" />
        </button>
        <h2 className="font-heading text-lg text-charcoal">{t('newMemory')}</h2>
        <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center">
          <X size={20} className="text-charcoal" />
        </button>
      </div>

      {isUploading ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 animate-fade-in">
          <div className="w-full max-w-xs text-center">
            <div className="w-20 h-20 rounded-full bg-blush flex items-center justify-center mx-auto mb-6 relative">
              <UploadCloud size={32} className="text-gold animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-gold/20 border-t-gold animate-spin" />
            </div>
            
            <h3 className="font-heading text-xl text-charcoal mb-2">
              {uploadProgress < 100 ? 'Uploading your memory...' : 'Processing...'}
            </h3>
            
            <div className="w-full h-2.5 bg-blush rounded-full overflow-hidden mb-3 border border-accent-border/40 shadow-inner">
              <div
                className="h-full gradient-gold rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center text-xs text-muted-warm font-medium px-1">
              <span>{uploadProgress < 100 ? `${uploadProgress}% completed` : 'Writing to database...'}</span>
              <span>{uploadProgress < 100 ? 'Please wait' : 'Almost ready'}</span>
            </div>
          </div>
        </div>
      ) : showSuccess ? (
        <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
          {sparklePos && <Sparkle x={sparklePos.x} y={sparklePos.y} />}
          <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="font-heading text-xl text-charcoal mb-1">{t('uploadSuccess')}</h3>
          <p className="text-sm text-muted-warm">Redirecting to gallery...</p>
        </div>
      ) : (
        <>
          {/* Greeting */}
          <div className="px-5 pt-5 pb-3">
            <h3 className="font-heading text-xl text-charcoal">
              {guest ? t('hiName', { name: guest.first_name }) : t('welcome')}
            </h3>
            <p className="text-sm text-muted-warm mt-0.5">{t('whatToShare')}</p>
          </div>

          {/* Type Selector */}
          <div className="px-5 mb-4">
            <div className="flex gap-2">
              {typeOptions.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => { 
                    handleTypeChange(opt.type); 
                    setFile(null); 
                    setPreview(null); 
                    setSourceMode('library');
                    stopCamera();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-medium transition-all ${
                    uploadType === opt.type
                      ? 'bg-charcoal text-ivory'
                      : 'bg-blush text-muted-warm border border-accent-border'
                  }`}
                >
                  <opt.icon size={16} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Source Selector (Library vs. Live Camera) */}
          {uploadType !== 'message' && !(uploadType === 'video' && videoLimitReached) && !preview && (
            <div className="px-5 mb-3 animate-fade-in">
              <div className="flex bg-blush/40 p-1 rounded-full border border-accent-border/30">
                <button
                  type="button"
                  onClick={() => { setSourceMode('library'); stopCamera(); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    sourceMode === 'library'
                      ? 'bg-white text-gold shadow-sm'
                      : 'text-muted-warm hover:text-charcoal'
                  }`}
                >
                  <Library size={13} />
                  <span>{t('uploadFromLibrary')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setSourceMode('camera'); startCamera(); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    sourceMode === 'camera'
                      ? 'bg-white text-gold shadow-sm'
                      : 'text-muted-warm hover:text-charcoal'
                  }`}
                >
                  <Camera size={13} />
                  <span>{t('liveCamera')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Upload Zone */}
          <div className="px-5 flex-1">
            {uploadType === 'message' ? (
              <div className="relative">
                <textarea
                  value={messageText}
                  onChange={(e) => handleMessageChange(e.target.value)}
                  placeholder={t('writeWishes')}
                  rows={6}
                  className="w-full bg-blush rounded-xl p-4 text-charcoal placeholder:text-muted-warm/60 focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none text-sm leading-relaxed pb-10"
                />
                <div className="absolute bottom-3 right-3">
                  <EmojiPicker onSelect={(emoji) => handleMessageChange(messageText + emoji)} />
                </div>
              </div>
            ) : uploadType === 'video' && videoLimitReached ? (
              <div className="w-full rounded-xl border border-gold/40 bg-blush/20 p-6 flex flex-col items-center justify-center text-center gap-4 animate-fade-in" style={{ aspectRatio: '4/3' }}>
                <div className="w-12 h-12 rounded-full bg-blush flex items-center justify-center text-gold">
                  <Film size={22} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="font-heading text-base text-charcoal font-semibold mb-1">
                    {language === 'tr' ? 'Video Sınırına Ulaşıldı' : 'Video Limit Reached'}
                  </h4>
                  <p className="text-xs text-muted-warm px-4 leading-relaxed">
                    {language === 'tr'
                      ? 'Paylaşım başına en fazla 10 video yükleyebilirsiniz. Yeni video eklemek için galeriden eski videolarınızı silebilirsiniz.'
                      : 'You can upload a maximum of 10 videos. You can delete previous videos from the gallery to upload new ones.'}
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-gold bg-white px-3 py-1 rounded-full border border-gold/20 shadow-sm">
                  {language === 'tr' ? 'Yüklenen: 10 / 10 Video' : 'Uploaded: 10 / 10 Videos'}
                </div>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => {
                  if (sourceMode === 'library' && !preview) {
                    fileInputRef.current?.click();
                  }
                }}
                className={`w-full rounded-xl border-2 border-dashed transition-colors overflow-hidden ${
                  preview
                    ? 'border-gold/30'
                    : sourceMode === 'camera'
                    ? 'border-gold/30 bg-black'
                    : 'border-gold/40 hover:border-gold/70 bg-blush/30 cursor-pointer'
                }`}
                style={{ aspectRatio: '4/3' }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadType === 'photo' ? 'image/*' : 'video/*'}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {preview ? (
                  <div className="relative w-full h-full">
                    {uploadType === 'photo' ? (
                      <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <video 
                        key={preview}
                        src={preview} 
                        className="w-full h-full object-cover rounded-xl" 
                        controls 
                        playsInline
                        preload="auto"
                      />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-charcoal/60 flex items-center justify-center"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                ) : sourceMode === 'camera' ? (
                  <div className="relative w-full h-full bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                    />
                    
                    {/* Camera Controls Overlay */}
                    <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-6 z-20">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); flipCamera(); }}
                        className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95"
                      >
                        <RefreshCw size={18} />
                      </button>

                      {uploadType === 'photo' ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); capturePhoto(); }}
                          className="w-14 h-14 rounded-full border-4 border-white bg-gold/90 hover:bg-gold flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); isRecording ? stopRecording() : startRecording(); }}
                          className={`w-14 h-14 rounded-full border-4 border-white flex items-center justify-center shadow-lg active:scale-90 transition-all ${
                            isRecording ? 'bg-red-600 animate-pulse' : 'bg-red-500'
                          }`}
                        >
                          {isRecording ? <Square size={16} className="text-white fill-white" /> : <Video size={20} className="text-white fill-white" />}
                        </button>
                      )}

                      <div className="w-10" /> {/* Spacer for visual centering */}
                    </div>

                    {isRecording && (
                      <div className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse z-20">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        <span>REC</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 gap-1">
                    <UploadCloud size={36} className="text-gold mb-2" strokeWidth={1.5} />
                    <p className="text-sm text-muted-warm font-medium">{t('tapToChoose')}</p>
                    {uploadType === 'video' && (
                      <p className="text-[11px] text-muted-warm/60">
                        {language === 'tr' 
                          ? `Yüklenen Video: ${myVideos.length} / 10`
                          : `Videos Uploaded: ${myVideos.length} / 10`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Caption */}
            <div className="mt-4 flex items-center bg-blush/50 rounded-xl px-4 py-3 gap-1">
              <input
                type="text"
                value={caption}
                onChange={(e) => handleCaptionChange(e.target.value)}
                placeholder={t('addCaption')}
                className="flex-1 bg-transparent text-sm text-charcoal placeholder:text-muted-warm/60 focus:outline-none"
              />
              <EmojiPicker onSelect={(emoji) => handleCaptionChange(caption + emoji)} />
            </div>
          </div>

          {/* Submit */}
          <div className="px-5 py-4">
            {uploadError && (
              <div className="bg-red-50 text-red-600 rounded-xl p-3 text-xs mb-4 text-center border border-red-100 font-medium">
                Upload failed. Please check your connection and try again.
              </div>
            )}
            <button
              onClick={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setSparklePos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                handleSubmit();
              }}
              disabled={!canSubmit || isCameraActive}
              className={`w-full py-3.5 rounded-full font-medium text-sm transition-all ${
                canSubmit && !isCameraActive
                  ? 'gradient-gold text-white shadow-elevated hover:opacity-90 active:scale-[0.98]'
                  : 'bg-charcoal/10 text-muted-warm/40 cursor-not-allowed'
              }`}
            >
              {uploadError ? 'Retry Upload' : t('shareNow')}
            </button>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <Shield size={12} className="text-muted-warm/50" />
              <span className="text-[11px] text-muted-warm/50 text-center">{t('securityNote')}</span>
            </div>
          </div>
        </>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
