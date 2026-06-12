import { useState, useEffect } from 'react';
import { Search, EyeOff, Eye, Trash2, CheckCircle, Star, MessageSquare, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { useDatabase } from '@/context/DatabaseContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/LanguageContext';
import type { Upload } from '@/lib/types';
import { getMediaUrl } from '@/lib/mediaHelper';
import VideoThumbnail from '@/components/shared/VideoThumbnail';

type StatusFilter = 'all' | 'visible' | 'hidden' | 'pending' | 'reported' | 'featured';
type TypeFilter = 'all' | 'photo' | 'video' | 'message' | 'guestbook';

export default function UploadsManagementScreen() {
  const { t, language } = useLanguage();
  const { wedding, uploads, modifyUpload, removeUpload, refreshUploads, isSupabase } = useDatabase();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUploads();
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Visibility-aware 5-minute polling + cleanup
  useEffect(() => {
    if (!isSupabase) return;

    handleRefresh();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshUploads();
        setLastUpdated(new Date());
      }
    }, 2 * 60 * 1000); // 2-minute polling (Plan B)

    return () => clearInterval(interval);
  }, [isSupabase]);

  const filteredUploads = uploads.filter((u) => {
    if (search && !u.guest_name.toLowerCase().includes(search.toLowerCase()) && !u.caption?.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all' && u.type !== typeFilter) return false;
    if (statusFilter === 'visible' && (u.is_hidden || !u.is_approved)) return false;
    if (statusFilter === 'hidden' && !u.is_hidden) return false;
    if (statusFilter === 'pending' && u.is_approved) return false;
    if (statusFilter === 'reported' && u.report_count === 0) return false;
    if (statusFilter === 'featured' && !u.is_featured) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUploads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageUploads = filteredUploads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 whenever filters or search change
  const setSearchAndReset = (v: string) => { setSearch(v); setCurrentPage(1); };
  const setTypeFilterAndReset = (v: TypeFilter) => { setTypeFilter(v); setCurrentPage(1); };
  const setStatusFilterAndReset = (v: StatusFilter) => { setStatusFilter(v); setCurrentPage(1); };

  // Build page number list (show max 7 pages with ellipsis)
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (safePage > 3) pages.push('...');
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === pageUploads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageUploads.map((u) => u.id)));
    }
  };

  const bulkAction = async (action: string) => {
    for (const id of selectedIds) {
      switch (action) {
        case 'hide':
          await modifyUpload(id, { is_hidden: true });
          break;
        case 'unhide':
          await modifyUpload(id, { is_hidden: false });
          break;
        case 'delete':
          await removeUpload(id);
          break;
        case 'approve':
          await modifyUpload(id, { is_approved: true });
          break;
        case 'feature':
          await modifyUpload(id, { is_featured: true });
          break;
      }
    }
    setSelectedIds(new Set());
  };

  const getStatusBadge = (upload: Upload) => {
    if (upload.is_hidden) return <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px]">{t('hidden')}</span>;
    if (!upload.is_approved) return <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px]">{t('pending')}</span>;
    if (upload.is_featured) return <span className="px-2 py-0.5 rounded-full bg-gold/10 text-gold text-[10px]">{t('featured')}</span>;
    return <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px]">{t('visible')}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-heading text-2xl text-charcoal">{t('uploadsManagement')}</h1>
        {isSupabase && (
          <div className="flex items-center gap-2 self-start sm:self-center text-xs text-muted-warm font-medium bg-white px-3 py-1.5 rounded-xl shadow-card border border-accent-border/10">
            <span>Updated: {lastUpdated.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-blush rounded transition-colors disabled:opacity-50 flex items-center justify-center"
              title="Refresh uploads"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl p-4 shadow-card space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-warm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearchAndReset(e.target.value)}
            placeholder={t('searchUploads')}
            className="w-full bg-blush/30 rounded-xl pl-9 pr-4 py-2.5 text-sm text-charcoal placeholder:text-muted-warm/50 focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-muted-warm">
            <Filter size={12} />
            <span>{t('filterByType')}:</span>
          </div>
          {(['all', 'photo', 'video', 'message', 'guestbook'] as TypeFilter[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTypeFilterAndReset(tf)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                typeFilter === tf ? 'bg-charcoal text-ivory' : 'bg-blush/50 text-muted-warm hover:bg-blush'
              }`}
            >
              {tf === 'all' ? t('all') : tf === 'photo' ? t('photos') : tf === 'video' ? t('videosTab') : tf === 'message' ? t('messagesTab') : t('guestBook')}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'visible', 'hidden', 'pending', 'reported', 'featured'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilterAndReset(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-gold text-white' : 'bg-blush/50 text-muted-warm hover:bg-blush'
              }`}
            >
              {s === 'all' ? t('all') : t(s as TranslationKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-white rounded-xl p-3 shadow-card flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-warm mr-2">{selectedIds.size} {t('selected')}</span>
          <button onClick={() => bulkAction('hide')} className="px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-medium flex items-center gap-1">
            <EyeOff size={12} /> {t('hide')}
          </button>
          <button onClick={() => bulkAction('unhide')} className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-500 text-xs font-medium flex items-center gap-1">
            <Eye size={12} /> {language === 'tr' ? 'Göster' : 'Show'}
          </button>
          <button onClick={() => bulkAction('delete')} className="px-3 py-1.5 rounded-full bg-red-100 text-red-600 text-xs font-medium flex items-center gap-1">
            <Trash2 size={12} /> {t('delete')}
          </button>
          <button onClick={() => bulkAction('approve')} className="px-3 py-1.5 rounded-full bg-green-50 text-green-600 text-xs font-medium flex items-center gap-1">
            <CheckCircle size={12} /> {t('approve')}
          </button>
          <button onClick={() => bulkAction('feature')} className="px-3 py-1.5 rounded-full bg-gold/10 text-gold text-xs font-medium flex items-center gap-1">
            <Star size={12} /> {t('feature')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-accent-border/20">
                <th className="p-3 text-left">
                  <input
                    type="checkbox"
                    checked={pageUploads.length > 0 && selectedIds.size === pageUploads.length}
                    onChange={selectAll}
                    className="rounded border-accent-border"
                  />
                </th>
                <th className="p-3 text-left text-xs font-medium text-muted-warm">{t('preview')}</th>
                <th className="p-3 text-left text-xs font-medium text-muted-warm">{t('guest')}</th>
                <th className="p-3 text-left text-xs font-medium text-muted-warm">{t('typeCol')}</th>
                <th className="p-3 text-left text-xs font-medium text-muted-warm">{t('statusCol')}</th>
                <th className="p-3 text-left text-xs font-medium text-muted-warm">{t('reports')}</th>
                <th className="p-3 text-left text-xs font-medium text-muted-warm">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent-border/10">
              {pageUploads.map((upload) => (
                <tr key={upload.id} className="hover:bg-ivory/50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(upload.id)}
                      onChange={() => toggleSelect(upload.id)}
                      className="rounded border-accent-border"
                    />
                  </td>
                  <td className="p-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-blush flex-shrink-0 relative">
                      {upload.type === 'video' ? (() => {
                        const url = getMediaUrl(upload.local_url || upload.public_url);
                        if (!url) {
                          const phUrl = wedding.upload_placeholder_image ? getMediaUrl(wedding.upload_placeholder_image) : null;
                          return phUrl ? (
                            <>
                              <img src={phUrl || undefined} alt="" className="w-full h-full object-cover opacity-70" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 size={14} className="text-gold animate-spin" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Loader2 size={14} className="text-gold animate-spin" />
                            </div>
                          );
                        }
                        return (
                          <VideoThumbnail
                            src={url}
                            thumbnailUrl={upload.thumbnail_url}
                            className="w-full h-full"
                            seekTo={0.5}
                          />
                        );
                      })() : upload.type === 'photo' ? (
                        <img src={getMediaUrl(upload.local_url || upload.public_url) || undefined} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : upload.type === 'guestbook' ? (
                        upload.drawing_data_url ? (
                          <img src={upload.drawing_data_url} alt="" className="w-full h-full object-contain bg-[#fffdf9]" loading="lazy" />
                        ) : upload.local_url || upload.public_url ? (
                          <img src={getMediaUrl(upload.local_url || upload.public_url) || undefined} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <MessageSquare size={14} className="text-gold" />
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MessageSquare size={14} className="text-gold" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-charcoal">{upload.guest_name}</td>
                  <td className="p-3">
                    <span className="capitalize text-xs text-muted-warm">{upload.type}</span>
                  </td>
                  <td className="p-3">{getStatusBadge(upload)}</td>
                  <td className="p-3">
                    {upload.report_count > 0 ? (
                      <span className="text-xs font-medium text-red-500">{upload.report_count}</span>
                    ) : (
                      <span className="text-xs text-muted-warm/40">0</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {!upload.is_approved && (
                        <button onClick={() => { modifyUpload(upload.id, { is_approved: true }); }} className="p-1 rounded hover:bg-green-50 text-green-600" title={t('approve') || 'Approve'}>
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {/* Toggle hide/show */}
                      {upload.is_hidden ? (
                        <button
                          onClick={() => { modifyUpload(upload.id, { is_hidden: false }); }}
                          className="p-1 rounded hover:bg-blue-50 text-blue-500"
                          title="Make Visible"
                        >
                          <Eye size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => { modifyUpload(upload.id, { is_hidden: true }); }}
                          className="p-1 rounded hover:bg-red-50 text-red-400"
                          title={t('hide') || 'Hide'}
                        >
                          <EyeOff size={14} />
                        </button>
                      )}
                      <button onClick={() => { modifyUpload(upload.id, { is_featured: !upload.is_featured }); }} className={`p-1 rounded hover:bg-gold/10 ${upload.is_featured ? 'text-gold' : 'text-muted-warm'}`} title={upload.is_featured ? 'Unfeature' : (t('feature') || 'Feature')}>
                        <Star size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to permanently delete this memory from the app and cloud storage?')) {
                            removeUpload(upload.id);
                          }
                        }}
                        className="p-1 rounded hover:bg-red-50 text-red-500"
                        title={t('delete') || 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Results counter + Pagination */}
        <div className="px-4 py-3 border-t border-accent-border/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Counter */}
          <p className="text-xs text-muted-warm">
            {filteredUploads.length === 0
              ? (language === 'tr' ? 'Sonuç yok' : 'No results')
              : language === 'tr'
                ? `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredUploads.length)} / ${filteredUploads.length} öğe`
                : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredUploads.length)} of ${filteredUploads.length} items`}
          </p>

          {/* Page buttons */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* Prev */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="w-8 h-8 rounded-lg text-sm font-medium flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blush text-muted-warm"
              >
                ‹
              </button>

              {getPageNumbers().map((pg, idx) =>
                pg === '...' ? (
                  <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-warm/50">…</span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => setCurrentPage(pg as number)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${
                      safePage === pg
                        ? 'bg-charcoal text-ivory'
                        : 'hover:bg-blush text-muted-warm'
                    }`}
                  >
                    {pg}
                  </button>
                )
              )}

              {/* Next */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="w-8 h-8 rounded-lg text-sm font-medium flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blush text-muted-warm"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {filteredUploads.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-warm">
            {t('noResults')}
          </div>
        )}
      </div>
    </div>
  );
}
