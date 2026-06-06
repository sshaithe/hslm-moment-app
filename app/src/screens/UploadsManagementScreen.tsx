import { useState } from 'react';
import { Search, EyeOff, Trash2, CheckCircle, Star, MessageSquare, Filter } from 'lucide-react';
import { getUploads, updateUpload } from '@/lib/localStore';
import { useLanguage } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/LanguageContext';
import type { Upload } from '@/lib/types';

type StatusFilter = 'all' | 'visible' | 'hidden' | 'pending' | 'reported' | 'featured';
type TypeFilter = 'all' | 'photo' | 'video' | 'message';

export default function UploadsManagementScreen() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [, setRefreshKey] = useState(0);

  const uploads = getUploads();

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredUploads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUploads.map((u) => u.id)));
    }
  };

  const bulkAction = (action: string) => {
    selectedIds.forEach((id) => {
      switch (action) {
        case 'hide':
          updateUpload(id, { is_hidden: true });
          break;
        case 'delete':
          {
            const all = uploads.filter((u) => u.id !== id);
            localStorage.setItem('vv_uploads', JSON.stringify(all));
          }
          break;
        case 'approve':
          updateUpload(id, { is_approved: true });
          break;
        case 'feature':
          updateUpload(id, { is_featured: true });
          break;
      }
    });
    setSelectedIds(new Set());
    setRefreshKey((k) => k + 1);
  };

  const getStatusBadge = (upload: Upload) => {
    if (upload.is_hidden) return <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px]">{t('hidden')}</span>;
    if (!upload.is_approved) return <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px]">{t('pending')}</span>;
    if (upload.is_featured) return <span className="px-2 py-0.5 rounded-full bg-gold/10 text-gold text-[10px]">{t('featured')}</span>;
    return <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px]">{t('visible')}</span>;
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl text-charcoal">{t('uploadsManagement')}</h1>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl p-4 shadow-card space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-warm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchUploads')}
            className="w-full bg-blush/30 rounded-xl pl-9 pr-4 py-2.5 text-sm text-charcoal placeholder:text-muted-warm/50 focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-muted-warm">
            <Filter size={12} />
            <span>{t('filterByType')}:</span>
          </div>
          {(['all', 'photo', 'video', 'message'] as TypeFilter[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTypeFilter(tf)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                typeFilter === tf ? 'bg-charcoal text-ivory' : 'bg-blush/50 text-muted-warm hover:bg-blush'
              }`}
            >
              {tf === 'all' ? t('all') : tf === 'photo' ? t('photos') : tf === 'video' ? t('videosTab') : t('messagesTab')}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'visible', 'hidden', 'pending', 'reported', 'featured'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
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
                    checked={filteredUploads.length > 0 && selectedIds.size === filteredUploads.length}
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
              {filteredUploads.map((upload) => (
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
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-blush">
                      {upload.type === 'photo' || upload.type === 'video' ? (
                        <img src={upload.local_url || upload.public_url} alt="" className="w-full h-full object-cover" />
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
                        <button onClick={() => { updateUpload(upload.id, { is_approved: true }); setRefreshKey((k) => k + 1); }} className="p-1 rounded hover:bg-green-50 text-green-600">
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button onClick={() => { updateUpload(upload.id, { is_hidden: true }); setRefreshKey((k) => k + 1); }} className="p-1 rounded hover:bg-red-50 text-red-400">
                        <EyeOff size={14} />
                      </button>
                      <button onClick={() => { updateUpload(upload.id, { is_featured: true }); setRefreshKey((k) => k + 1); }} className="p-1 rounded hover:bg-gold/10 text-gold">
                        <Star size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
