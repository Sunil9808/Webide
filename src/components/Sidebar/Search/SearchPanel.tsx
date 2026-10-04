import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Files,
  ListFilter,
  MoreHorizontal,
  RefreshCw,
  Regex,
  Replace,
  WholeWord,
} from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { useUIStore } from '../../../store/uiStore';

interface SearchMatch {
  tabId: string;
  fileName: string;
  lineNumber: number;
  lineText: string;
}

export default function SearchPanel() {
  const [query, setQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [preserveCase, setPreserveCase] = useState(false);
  const [replaceVisible, setReplaceVisible] = useState(true);
  const [resultsCollapsed, setResultsCollapsed] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const { tabs, openTab, setActiveTab, updateTabContent } = useEditorStore();
  const workspace = useWorkspaceStore((state) => state.workspace);
  const addNotification = useUIStore((state) => state.addNotification);

  useEffect(() => {
    const runSearchCommand = (event: Event) => {
      const replace = Boolean((event as CustomEvent<{ replace?: boolean }>).detail?.replace);
      setReplaceVisible(replace || replaceVisible);

      window.setTimeout(() => {
        if (replace) {
          replaceInputRef.current?.focus();
          return;
        }
        searchInputRef.current?.focus();
      }, 0);
    };

    window.addEventListener('ai-web-ide:search-command', runSearchCommand);
    return () => window.removeEventListener('ai-web-ide:search-command', runSearchCommand);
  }, [replaceVisible]);

  const searchPattern = useMemo(() => buildPattern(query, { matchCase, wholeWord, useRegex }), [matchCase, query, useRegex, wholeWord]);
  const invalidRegex = Boolean(query && useRegex && !searchPattern);

  const matches = useMemo<SearchMatch[]>(() => {
    if (!query || !searchPattern) return [];

    return tabs.flatMap((tab) => {
      const lines = tab.content.split(/\r?\n/);
      return lines.flatMap((lineText, index) => {
        searchPattern.lastIndex = 0;
        return searchPattern.test(lineText)
          ? [{
              tabId: tab.id,
              fileName: tab.fileName,
              lineNumber: index + 1,
              lineText,
            }]
          : [];
      });
    });
  }, [query, refreshNonce, searchPattern, tabs]);

  const openFolder = () => {
    window.dispatchEvent(new CustomEvent('ai-web-ide:open-folder', { detail: { mode: 'open' } }));
  };

  const replaceAll = () => {
    if (!query || !searchPattern) {
      addNotification({ type: invalidRegex ? 'error' : 'info', message: invalidRegex ? 'Search uses an invalid regular expression' : 'Enter text to search before replacing' });
      return;
    }

    let changedFiles = 0;
    tabs.forEach((tab) => {
      searchPattern.lastIndex = 0;
      const nextContent = tab.content.replace(searchPattern, (match) => (
        preserveCase ? applyPreservedCase(replaceQuery, match) : replaceQuery
      ));
      if (nextContent !== tab.content) {
        changedFiles += 1;
        updateTabContent(tab.id, nextContent);
      }
    });

    addNotification({
      type: changedFiles ? 'success' : 'info',
      message: changedFiles ? `Replaced matches in ${changedFiles} file${changedFiles === 1 ? '' : 's'}` : 'No matches to replace',
    });
  };

  const clearSearch = () => {
    setQuery('');
    setReplaceQuery('');
    setResultsCollapsed(false);
    searchInputRef.current?.focus();
  };

  const refreshSearch = () => {
    setRefreshNonce((value) => value + 1);
    addNotification({ type: 'success', message: 'Search refreshed' });
  };

  const openSearchEditor = () => {
    const content = [
      `# Search: ${query || '(empty)'}`,
      '',
      matches.length
        ? `${matches.length} result${matches.length === 1 ? '' : 's'} in open files`
        : 'No results found in open files.',
      '',
      ...matches.map((match) => `${match.fileName}:${match.lineNumber}: ${match.lineText}`),
    ].join('\n');

    openTab({
      id: `tab-search-editor-${Date.now()}`,
      fileId: `search-editor-${Date.now()}`,
      filePath: `/search/Search Results.search`,
      fileName: 'Search Results.search',
      language: 'markdown',
      content,
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
          Search
        </span>
        <div className="flex items-center gap-1" style={{ color: 'var(--color-textMuted)' }}>
          <HeaderButton title="Refresh Search" onClick={refreshSearch}>
            <RefreshCw size={14} />
          </HeaderButton>
          <HeaderButton title="Clear Search Results" onClick={clearSearch}>
            <ListFilter size={14} />
          </HeaderButton>
          <HeaderButton title="Open Search Editor" onClick={openSearchEditor}>
            <Files size={14} />
          </HeaderButton>
          <HeaderButton title={resultsCollapsed ? 'Expand Search Results' : 'Collapse Search Results'} onClick={() => setResultsCollapsed((value) => !value)}>
            <MoreHorizontal size={14} />
          </HeaderButton>
        </div>
      </div>

      <div className="px-3 pt-2">
        <div className="flex items-center gap-1">
          <button
            className="flex h-6 w-5 items-center justify-center rounded hover:bg-white/10"
            style={{ color: 'var(--color-text)' }}
            title={replaceVisible ? 'Hide Replace' : 'Show Replace'}
            onClick={() => setReplaceVisible((value) => !value)}
          >
            {replaceVisible ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div
            className="flex h-6 flex-1 items-center rounded border"
            style={{ background: 'var(--bg-0)', borderColor: invalidRegex ? '#f14c4c' : 'var(--border-1)' }}
          >
            <input
              ref={searchInputRef}
              className="min-w-0 flex-1 bg-transparent px-1.5 text-[13px] outline-none placeholder:text-[#6f6f6f]"
              style={{ color: 'var(--color-text)' }}
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && matches[0]) {
                  setActiveTab(matches[0].tabId);
                }
              }}
            />
            <InputToggle active={matchCase} title="Match Case" onClick={() => setMatchCase((value) => !value)}>
              Aa
            </InputToggle>
            <InputToggle active={wholeWord} title="Match Whole Word" onClick={() => setWholeWord((value) => !value)}>
              <span className="font-bold underline decoration-[1.5px] underline-offset-[2px]">ab</span>
            </InputToggle>
            <InputToggle active={useRegex} title="Use Regular Expression" onClick={() => setUseRegex((value) => !value)}>
              .*
            </InputToggle>
          </div>
        </div>

        {replaceVisible && <div className="mt-1.5 flex items-center gap-1 pl-6">
          <div
            className="flex h-6 flex-1 items-center rounded border"
            style={{ background: 'var(--bg-0)', borderColor: 'var(--border-1)' }}
          >
            <input
              ref={replaceInputRef}
              className="min-w-0 flex-1 bg-transparent px-1.5 text-[13px] outline-none placeholder:text-[#6f6f6f]"
              style={{ color: 'var(--color-text)' }}
              placeholder="Replace"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') replaceAll();
              }}
            />
            <InputToggle active={preserveCase} title="Preserve Case" onClick={() => setPreserveCase((value) => !value)}>
              AB
            </InputToggle>
          </div>
          <button
            className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-white/10"
            style={{ color: 'var(--color-textMuted)' }}
            title="Replace All"
            onClick={replaceAll}
          >
            <Replace size={14} />
          </button>
        </div>}

        <div className="mt-1 flex justify-end">
          <HeaderButton title="More Search Actions" onClick={() => setShowMoreActions((value) => !value)}>
            <MoreHorizontal size={14} />
          </HeaderButton>
        </div>

        {showMoreActions && (
          <div className="mb-2 ml-6 rounded border p-2 text-[12px]" style={{ borderColor: 'var(--border-1)', color: 'var(--color-textMuted)' }}>
            Searching open editor tabs. Open a folder to search project files as they are opened.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-1">
        {!workspace && !query && (
          <div className="text-[13px] leading-[1.4]" style={{ color: 'var(--color-textMuted)' }}>
            <p>You have not opened or specified a folder. Only open files are currently searched.</p>
            <button className="mt-2 text-blue-400 hover:underline" onClick={openFolder}>
              Open Folder
            </button>
          </div>
        )}

        {invalidRegex && (
          <p className="mt-3 text-[13px]" style={{ color: '#f14c4c' }}>
            Invalid regular expression.
          </p>
        )}

        {query && !invalidRegex && matches.length === 0 && (
          <p className="mt-5 text-[16px]" style={{ color: 'var(--color-textMuted)' }}>
            No results found.
          </p>
        )}

        {matches.length > 0 && !resultsCollapsed && (
          <div className="mt-4 space-y-1">
            <div className="text-[13px] uppercase" style={{ color: 'var(--color-textMuted)' }}>
              {matches.length} result{matches.length === 1 ? '' : 's'} in open files
            </div>
            {matches.map((match) => (
              <button
                key={`${match.tabId}-${match.lineNumber}-${match.lineText}`}
                className="w-full rounded px-2 py-1 text-left hover:bg-white/10"
                onClick={() => setActiveTab(match.tabId)}
              >
                <div className="text-[13px]" style={{ color: 'var(--color-text)' }}>
                  {match.fileName}
                </div>
                <div className="truncate text-[12px]" style={{ color: 'var(--color-textMuted)' }}>
                  {match.lineNumber}: {match.lineText.trim() || '(empty line)'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/10"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function InputToggle({ active, children, title, onClick }: { active: boolean; children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      className="flex h-5 min-w-[20px] items-center justify-center px-1 text-[13px] rounded-sm transition-colors hover:bg-white/10 mx-0.5"
      style={{ color: active ? 'var(--color-text)' : 'var(--color-textMuted)', background: active ? 'var(--bg-2)' : 'transparent' }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function buildPattern(query: string, options: { matchCase: boolean; wholeWord: boolean; useRegex: boolean }) {
  if (!query) return null;

  try {
    const source = options.useRegex ? query : escapeRegExp(query);
    const wordWrapped = options.wholeWord ? `\\b${source}\\b` : source;
    return new RegExp(wordWrapped, options.matchCase ? 'g' : 'gi');
  } catch {
    return null;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyPreservedCase(replacement: string, matchedText: string) {
  if (!replacement) return replacement;
  if (matchedText === matchedText.toUpperCase()) return replacement.toUpperCase();
  if (matchedText === matchedText.toLowerCase()) return replacement.toLowerCase();

  const first = matchedText[0];
  if (first && first === first.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  }

  return replacement;
}
