import { Upload } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

interface Props {
  message: string;
  onUpload?: () => void;
}

export function WorkspaceEmptyState({ message, onUpload }: Props) {
  const { t, lang } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-8 text-center">
      <p className="text-sm text-text-secondary max-w-md leading-relaxed">{message}</p>
      {onUpload && (
        <button
          type="button"
          onClick={onUpload}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-medium hover:from-brand-500 hover:to-brand-400 transition-all"
        >
          <Upload className="w-4 h-4" />
          {lang === 'el' ? 'Ανέβασμα Υλικού' : t('uploadMaterial')}
        </button>
      )}
    </div>
  );
}
