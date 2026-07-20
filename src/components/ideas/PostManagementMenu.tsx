import { useEffect, useRef } from 'react';
import { LuCheck, LuEllipsis, LuPencil, LuTrash2 } from 'react-icons/lu';

type Props = {
  title: string;
  canEdit: boolean;
  canMarkDone: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onMarkDone: () => void;
  onDelete: () => void;
};

export default function PostManagementMenu({ title, canEdit, canMarkDone, canDelete, onEdit, onMarkDone, onDelete }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;

    const closeOutside = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) details.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details.open) return;
      details.open = false;
      summaryRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  if (!canEdit && !canMarkDone && !canDelete) return null;

  function run(action: () => void) {
    if (detailsRef.current) detailsRef.current.open = false;
    action();
  }

  const actionClass = 'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-limewash/70';

  return (
    <details ref={detailsRef} className="group relative z-20 shrink-0">
      <summary
        ref={summaryRef}
        className="inline-flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full text-braga-300 transition hover:bg-white/[0.07] hover:text-white group-open:bg-white/10 group-open:text-white [&::-webkit-details-marker]:hidden"
        aria-label={`Manage ${title}`}
        title="Post options"
      >
        <LuEllipsis className="h-5 w-5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-2xl border border-white/10 bg-ink-950 p-2 shadow-2xl" aria-label="Post options">
        {canEdit && <button type="button" className={`${actionClass} text-braga-100 hover:text-limewash`} onClick={() => run(onEdit)}><LuPencil className="h-4 w-4" aria-hidden="true" />Edit post</button>}
        {canMarkDone && <button type="button" className={`${actionClass} text-braga-100 hover:text-limewash`} onClick={() => run(onMarkDone)}><LuCheck className="h-4 w-4" aria-hidden="true" />Mark as done</button>}
        {canDelete && <button type="button" className={`${actionClass} text-red-200 hover:bg-red-300/10 hover:text-red-100`} onClick={() => run(onDelete)}><LuTrash2 className="h-4 w-4" aria-hidden="true" />Delete post</button>}
      </div>
    </details>
  );
}
