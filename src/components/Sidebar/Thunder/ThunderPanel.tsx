import { useMemo, useState } from 'react';
import { ChevronDown, Menu, MoreHorizontal, RefreshCw } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore';
import { useThunderStore, createThunderTabContent, defaultThunderRequest } from '../../../store/thunderStore';

type ThunderTab = 'activity' | 'collections' | 'env';

export default function ThunderPanel() {
  const [activeTab, setActiveTab] = useState<ThunderTab>('activity');
  const [filter, setFilter] = useState('');
  const { openTab } = useEditorStore();
  const { activity, collections, environments, clearActivity, addCollection, addEnvironment } = useThunderStore();

  const filteredActivity = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return activity;
    return activity.filter((item) => `${item.method} ${item.url}`.toLowerCase().includes(normalized));
  }, [activity, filter]);

  const newRequest = () => {
    openTab({
      id: `tab-thunder-${Date.now()}`,
      fileId: `thunder-${Date.now()}`,
      filePath: '/thunder/New Request',
      fileName: 'New Request',
      language: 'thunder-request',
      content: createThunderTabContent(defaultThunderRequest),
      isDirty: false,
      isPreview: false,
      cursorPosition: { line: 1, column: 1 },
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--color-sidebar)' }}>
      <div className="flex h-9 items-center justify-between px-4 no-select flex-shrink-0">
        <span
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-textMuted)', letterSpacing: '0.08em' }}
        >
          Thunder Client
        </span>
        <div className="flex items-center gap-1" style={{ color: 'var(--color-textMuted)' }}>
          <IconButton title="Refresh" onClick={() => undefined}><RefreshCw size={14} /></IconButton>
          <IconButton title="More Actions" onClick={clearActivity}><MoreHorizontal size={14} /></IconButton>
        </div>
      </div>

      <div className="px-4 mt-2">
        <button
          className="flex h-[26px] w-full items-center overflow-hidden rounded bg-[var(--button-primary)] text-[13px] text-white transition-opacity hover:opacity-90"
          onClick={newRequest}
        >
          <span className="flex-1 text-center">New Request</span>
          <span className="flex h-full w-[26px] items-center justify-center border-l border-white/20">
            <ChevronDown size={14} />
          </span>
        </button>
      </div>

      <div className="mt-3 flex px-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <ThunderNavButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')}>Activity</ThunderNavButton>
        <ThunderNavButton active={activeTab === 'collections'} onClick={() => setActiveTab('collections')}>Collections</ThunderNavButton>
        <ThunderNavButton active={activeTab === 'env'} onClick={() => setActiveTab('env')}>Env</ThunderNavButton>
      </div>

      {activeTab === 'activity' && (
        <>
          <div className="flex items-center gap-1 border-b px-4 py-2" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex h-6 flex-1 items-center rounded border bg-[var(--bg-0)] px-2" style={{ borderColor: 'var(--border-1)' }}>
              <input
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#6f6f6f]"
                style={{ color: 'var(--color-text)' }}
                placeholder="Filter activity"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
            <button title="Activity Menu" className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/10" style={{ color: 'var(--color-textMuted)' }}>
              <Menu size={14} />
            </button>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            {filteredActivity.length ? (
              filteredActivity.map((item) => (
                <button
                  key={item.id}
                  className="border-b px-4 py-2 text-left hover:bg-white/5"
                  style={{ borderColor: 'var(--color-border)' }}
                  onClick={() => newRequest()}
                >
                  <div className="text-[12px] font-semibold" style={{ color: 'var(--color-text)' }}>{item.method} {item.status || ''}</div>
                  <div className="truncate text-[11px]" style={{ color: 'var(--color-textMuted)' }}>{item.url}</div>
                  {item.time !== undefined && <div className="text-[11px]" style={{ color: 'var(--color-textMuted)' }}>{item.time}ms</div>}
                </button>
              ))
            ) : (
              <div className="flex flex-1 flex-col p-4 text-[13px] leading-[1.4]" style={{ color: 'var(--color-textMuted)' }}>
                <div>Welcome to Thunder Client.</div>
                <div className="mt-2">Your activity will appear here...</div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'collections' && (
        <ListPane
          empty="No collections yet."
          action="New Collection"
          onAction={() => addCollection(window.prompt('Collection name', 'My Collection') || 'My Collection')}
          items={collections.map((item) => `${item.name} (${item.count})`)}
        />
      )}

      {activeTab === 'env' && (
        <ListPane
          empty="No environments yet."
          action="New Environment"
          onAction={() => addEnvironment(window.prompt('Environment name', 'Local') || 'Local')}
          items={environments.map((item) => item.name)}
        />
      )}
    </div>
  );
}

function ThunderNavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="flex-1 border-b-[2px] pb-1 text-[11px] uppercase tracking-wider"
      style={{ color: active ? 'var(--color-text)' : 'var(--color-textMuted)', borderColor: active ? '#007acc' : 'transparent' }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ListPane({ empty, action, onAction, items }: { empty: string; action: string; onAction: () => void; items: string[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <button className="mb-4 flex w-full h-[26px] items-center justify-center rounded bg-[var(--button-primary)] text-[13px] text-white transition-opacity hover:opacity-90" onClick={onAction}>
        {action}
      </button>
      {items.length ? items.map((item) => (
        <div key={item} className="border-b px-2 py-1 text-[12px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>{item}</div>
      )) : (
        <div className="pt-4 text-[13px]" style={{ color: 'var(--color-textMuted)' }}>{empty}</div>
      )}
    </div>
  );
}

function IconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/10" onClick={onClick}>
      {children}
    </button>
  );
}
