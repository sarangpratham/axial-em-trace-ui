import { useState } from 'react';
import { Braces, Check, ChevronsDownUp, ChevronsUpDown, Copy, WrapText } from 'lucide-react';
import { JsonView } from 'react-json-view-lite';
import { cn } from '@/lib/utils';

type ExpansionMode = 'smart' | 'all' | 'collapsed';
type ViewMode = 'tree' | 'raw';

const jsonTreeStyles = {
  container: 'json-tree',
  childFieldsContainer: 'json-tree-children',
  basicChildStyle: 'json-tree-row',
  collapseIcon: 'json-tree-toggle json-tree-toggle--open',
  expandIcon: 'json-tree-toggle',
  collapsedContent: 'json-tree-collapsed',
  label: 'json-tree-key',
  clickableLabel: 'json-tree-key json-tree-key--clickable',
  nullValue: 'json-tree-literal',
  undefinedValue: 'json-tree-literal',
  numberValue: 'json-tree-number',
  stringValue: 'json-tree-string',
  booleanValue: 'json-tree-boolean',
  otherValue: 'json-tree-value',
  punctuation: 'json-tree-punctuation',
  quotesForFieldNames: true,
  stringifyStringValues: true,
  ariaLables: {
    collapseJson: 'Collapse JSON branch',
    expandJson: 'Expand JSON branch',
  },
};

const expandSmart = (level: number) => level < 2;
const expandAll = () => true;
const collapseNested = (level: number) => level === 0;

function serializeJson(data: unknown) {
  const seen = new WeakSet<object>();
  const serialized = JSON.stringify(data, (_key, value: unknown) => {
    if (typeof value === 'bigint') return `${value.toString()}n`;
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  }, 2);
  return serialized ?? String(data ?? null);
}

function payloadSummary(data: unknown) {
  if (Array.isArray(data)) return `${data.length} item${data.length === 1 ? '' : 's'}`;
  if (data && typeof data === 'object') {
    const count = Object.keys(data).length;
    return `${count} field${count === 1 ? '' : 's'}`;
  }
  return typeof data;
}

export function JsonHighlight({ data, className }: { data: unknown; className?: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [expansionMode, setExpansionMode] = useState<ExpansionMode>('smart');
  const [wrap, setWrap] = useState(true);
  const [copied, setCopied] = useState(false);
  const source = serializeJson(data);
  const treeData = data && typeof data === 'object' ? data as object : { value: data };
  const shouldExpandNode = expansionMode === 'all'
    ? expandAll
    : expansionMode === 'collapsed'
      ? collapseNested
      : expandSmart;

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={cn('json-viewer', className)}>
      <div className="json-viewer-toolbar">
        <div className="json-viewer-identity">
          <Braces aria-hidden="true" />
          <span>JSON</span>
          <span className="json-viewer-summary">{payloadSummary(data)}</span>
        </div>
        <div className="json-viewer-actions">
          <div className="json-viewer-segment" aria-label="JSON display mode">
            <button type="button" className={viewMode === 'tree' ? 'is-active' : ''} onClick={() => setViewMode('tree')}>Tree</button>
            <button type="button" className={viewMode === 'raw' ? 'is-active' : ''} onClick={() => setViewMode('raw')}>Raw</button>
          </div>
          {viewMode === 'tree' && (
            <>
              <button type="button" className="json-viewer-action" onClick={() => setExpansionMode('all')} title="Expand all branches" aria-label="Expand all JSON branches"><ChevronsUpDown /></button>
              <button type="button" className="json-viewer-action" onClick={() => setExpansionMode('collapsed')} title="Collapse nested branches" aria-label="Collapse nested JSON branches"><ChevronsDownUp /></button>
            </>
          )}
          <button type="button" className={cn('json-viewer-action', wrap && 'is-active')} onClick={() => setWrap((value) => !value)} title="Toggle line wrapping" aria-label="Toggle JSON line wrapping"><WrapText /></button>
          <button type="button" className="json-viewer-action" onClick={() => void copyPayload()} title="Copy JSON" aria-label="Copy JSON payload">{copied ? <Check /> : <Copy />}</button>
        </div>
      </div>
      <div className={cn('json-viewer-content', wrap ? 'json-viewer-content--wrap' : 'json-viewer-content--nowrap')}>
        {viewMode === 'tree' ? (
          <JsonView
            data={treeData}
            style={jsonTreeStyles}
            shouldExpandNode={shouldExpandNode}
            clickToExpandNode
            compactTopLevel
            aria-label="JSON tree"
          />
        ) : (
          <pre className="json-viewer-raw">{source}</pre>
        )}
      </div>
    </section>
  );
}
