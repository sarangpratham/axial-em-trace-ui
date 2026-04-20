import { createLibrary, defineComponent } from '@openuidev/react-lang';
import { z } from 'zod';

const metricSchema = z.object({
  label: z.string(),
  value: z.string(),
  tone: z.enum(['default', 'cyan', 'green', 'amber', 'red', 'purple']).optional(),
});

const citationSchema = z.object({
  label: z.string(),
  value: z.string(),
  kind: z.string().optional(),
});

const anomalyItemSchema = z.object({
  anomalyType: z.string(),
  severity: z.string().optional(),
  reason: z.string().optional(),
  count: z.number().optional(),
});

const anomalyMetricItemSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  tone: z.enum(['default', 'cyan', 'green', 'amber', 'red', 'purple']).optional(),
});

const traceRowSchema = z.object({
  sourceModule: z.string(),
  sourceUniqueId: z.string(),
  sourceEntityName: z.string(),
  resolutionStatus: z.string().optional(),
  assignedEntityName: z.string().optional(),
  anomalyCount: z.number().optional(),
  decisionStory: z.string().optional(),
});

const relatedEntitySchema = z.object({
  entityId: z.string(),
  name: z.string(),
  relationship: z.string().optional(),
});

const utilityRowSchema = z.object({
  label: z.string(),
  value: z.string(),
});

function toneClass(tone?: string) {
  return tone ? `analysis-metric-chip--${tone}` : '';
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function InlineEmptyState({ label }: { label: string }) {
  return <p className="analysis-story-block">{label}</p>;
}

const RunSummaryCardSchema = z.object({
  runId: z.string(),
  notes: z.string().optional(),
  metrics: z.array(metricSchema).optional(),
});

const RunSummaryCard = defineComponent({
  name: 'RunSummaryCard',
  description: 'Summarize one entity-matching run with a compact metric grid.',
  props: RunSummaryCardSchema,
  component: ({ props }) => {
    const metrics = asArray(props.metrics);
    return (
      <section className="analysis-card analysis-card--component">
        <div className="analysis-card-head">
          <div>
            <div className="analysis-card-kicker">Run Summary</div>
            <h3 className="analysis-card-title">{asText(props.runId, 'Pending run summary')}</h3>
          </div>
          {props.notes && <div className="analysis-card-note">{props.notes}</div>}
        </div>
        {metrics.length > 0 ? (
          <div className="analysis-metric-grid">
            {metrics.map((metric, index) => (
              <div key={`${metric.label}:${index}`} className={`analysis-metric-chip ${toneClass(metric.tone)}`}>
                <span>{asText(metric.label, 'metric')}</span>
                <strong>{asText(metric.value)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <InlineEmptyState label="Run metrics are not available yet." />
        )}
      </section>
    );
  },
});

const TraceSearchResultsSchema = z.object({
  title: z.string().optional(),
  results: z.array(traceRowSchema).optional(),
});

const TraceSearchResults = defineComponent({
  name: 'TraceSearchResults',
  description: 'Render a compact table of source-record resolution results.',
  props: TraceSearchResultsSchema,
  component: ({ props }) => {
    const results = asArray(props.results);
    return (
      <section className="analysis-card analysis-card--component">
        <div className="analysis-card-head">
          <div>
            <div className="analysis-card-kicker">Trace Search Results</div>
            <h3 className="analysis-card-title">{asText(props.title, 'Matching traces')}</h3>
          </div>
          <div className="analysis-card-note">{results.length} results</div>
        </div>
        {results.length > 0 ? (
          <div className="analysis-result-table-wrap">
            <table className="analysis-result-table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Source</th>
                  <th>Outcome</th>
                  <th>Winner</th>
                  <th>Anom.</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => (
                  <tr key={`${row.sourceModule}:${row.sourceUniqueId}:${index}`}>
                    <td>
                      <div className="analysis-table-title">{asText(row.sourceEntityName, 'Pending entity')}</div>
                      {row.decisionStory && <div className="analysis-table-sub">{row.decisionStory}</div>}
                    </td>
                    <td>{asText(row.sourceModule)} · {asText(row.sourceUniqueId)}</td>
                    <td>{asText(row.resolutionStatus)}</td>
                    <td>{asText(row.assignedEntityName)}</td>
                    <td>{row.anomalyCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <InlineEmptyState label="No trace rows matched this request." />
        )}
      </section>
    );
  },
});

const TraceEvidencePanelSchema = z.object({
  title: z.string().optional(),
  narrative: z.string(),
  traceRef: z.object({
    sourceEntityName: z.string(),
    sourceModule: z.string(),
    sourceUniqueId: z.string(),
  }),
  winningDecision: z.object({
    assignedEntityName: z.string().optional(),
    assignedEntityId: z.string().optional(),
    matchPhase: z.string().optional(),
    matchType: z.string().optional(),
  }).optional(),
  citations: z.array(citationSchema).optional(),
  anomalies: z.array(anomalyItemSchema).optional(),
});

const TraceEvidencePanel = defineComponent({
  name: 'TraceEvidencePanel',
  description: 'Show narrative evidence for one source-record resolution including citations and anomalies.',
  props: TraceEvidencePanelSchema,
  component: ({ props }) => {
    const citations = asArray(props.citations);
    const anomalies = asArray(props.anomalies);
    return (
      <section className="analysis-card analysis-card--component">
        <div className="analysis-card-head">
          <div>
            <div className="analysis-card-kicker">Trace Evidence</div>
            <h3 className="analysis-card-title">{asText(props.title, asText(props.traceRef.sourceEntityName, 'Trace evidence'))}</h3>
          </div>
          <div className="analysis-card-note">{asText(props.traceRef.sourceModule)} · {asText(props.traceRef.sourceUniqueId)}</div>
        </div>
        <p className="analysis-story-block">{asText(props.narrative, 'No narrative explanation provided.')}</p>
        {props.winningDecision && (
          <div className="analysis-inline-grid">
            <div className="analysis-inline-panel">
              <span className="analysis-inline-label">Assigned entity</span>
              <strong>{asText(props.winningDecision.assignedEntityName, 'No assigned entity')}</strong>
              <span>{asText(props.winningDecision.assignedEntityId, 'No assigned entity ID')}</span>
            </div>
            <div className="analysis-inline-panel">
              <span className="analysis-inline-label">Resolution path</span>
              <strong>{asText(props.winningDecision.matchPhase, 'Unknown phase')}</strong>
              <span>{asText(props.winningDecision.matchType, 'Unknown type')}</span>
            </div>
          </div>
        )}
        {citations.length > 0 && (
          <div className="analysis-pill-row">
            {citations.map((citation, index) => (
              <span key={`${citation.label}:${citation.value}:${index}`} className="analysis-pill">
                {citation.kind ? `${citation.kind}: ` : ''}{asText(citation.label, 'citation')} · {asText(citation.value)}
              </span>
            ))}
          </div>
        )}
        {anomalies.length > 0 && (
          <div className="analysis-mini-list">
            {anomalies.map((anomaly, index) => (
              <div key={`${anomaly.anomalyType}:${index}`} className="analysis-mini-item">
                <span className={`analysis-severity analysis-severity--${anomaly.severity ?? 'medium'}`}>{anomaly.severity ?? 'medium'}</span>
                <div>
                  <strong>{asText(anomaly.anomalyType, 'anomaly')}</strong>
                  <p>{asText(anomaly.reason, 'No additional anomaly reason provided.')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  },
});

const AnomalySummaryPanelSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.union([anomalyItemSchema, anomalyMetricItemSchema])).optional(),
});

const AnomalySummaryPanel = defineComponent({
  name: 'AnomalySummaryPanel',
  description: 'Summarize anomaly signals, counts, severities, and reasons.',
  props: AnomalySummaryPanelSchema,
  component: ({ props }) => {
    const items = asArray(props.items);
    const metricItems = items.filter((item): item is z.infer<typeof anomalyMetricItemSchema> => 'label' in item);
    const anomalyItems = items.filter((item): item is z.infer<typeof anomalyItemSchema> => 'anomalyType' in item);
    return (
      <section className="analysis-card analysis-card--component">
        <div className="analysis-card-head">
          <div>
            <div className="analysis-card-kicker">Anomaly Summary</div>
            <h3 className="analysis-card-title">{asText(props.title, 'Detected anomaly signals')}</h3>
          </div>
        </div>
        {metricItems.length > 0 ? (
          <div className="analysis-metric-grid">
            {metricItems.map((item, index) => (
              <div key={`${item.label}:${index}`} className={`analysis-metric-chip ${toneClass(item.tone)}`}>
                <span>{asText(item.label, 'metric')}</span>
                <strong>{String(item.value)}</strong>
              </div>
            ))}
          </div>
        ) : anomalyItems.length > 0 ? (
          <div className="analysis-mini-list">
            {anomalyItems.map((item, index) => (
              <div key={`${item.anomalyType}:${index}`} className="analysis-mini-item">
                <span className={`analysis-severity analysis-severity--${item.severity ?? 'medium'}`}>{item.count ?? 1}</span>
                <div>
                  <strong>{asText(item.anomalyType, 'anomaly')}</strong>
                  <p>{asText(item.reason, 'No additional reason provided.')}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <InlineEmptyState label="No anomaly signals were included in this response." />
        )}
      </section>
    );
  },
});

const MasterEntityPanelSchema = z.object({
  entityId: z.string(),
  entityName: z.string(),
  entityUrl: z.string().optional(),
  industry: z.string().optional(),
  activity: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  relatedEntities: z.array(relatedEntitySchema).optional(),
});

const MasterEntityPanel = defineComponent({
  name: 'MasterEntityPanel',
  description: 'Render a master entity snapshot with aliases and related entities.',
  props: MasterEntityPanelSchema,
  component: ({ props }) => {
    const aliases = asArray(props.aliases);
    const relatedEntities = asArray(props.relatedEntities);
    return (
      <section className="analysis-card analysis-card--component">
        <div className="analysis-card-head">
          <div>
            <div className="analysis-card-kicker">Master Entity</div>
            <h3 className="analysis-card-title">{asText(props.entityName, 'Master entity')}</h3>
          </div>
          <div className="analysis-card-note">{asText(props.entityId)}</div>
        </div>
        <div className="analysis-inline-grid">
          <div className="analysis-inline-panel">
            <span className="analysis-inline-label">URL</span>
            <strong>{asText(props.entityUrl, 'Not available')}</strong>
          </div>
          <div className="analysis-inline-panel">
            <span className="analysis-inline-label">Industry</span>
            <strong>{asText(props.industry, 'Unknown')}</strong>
            <span>{asText(props.activity, 'No activity recorded')}</span>
          </div>
        </div>
        {aliases.length > 0 && (
          <div className="analysis-pill-row">
            {aliases.map((alias, index) => <span key={`${alias}:${index}`} className="analysis-pill">alias · {alias}</span>)}
          </div>
        )}
        {relatedEntities.length > 0 && (
          <div className="analysis-mini-list">
            {relatedEntities.map((entity, index) => (
              <div key={`${entity.entityId}:${index}`} className="analysis-mini-item">
                <span className="analysis-severity analysis-severity--low">rel</span>
                <div>
                  <strong>{asText(entity.name, entity.entityId)}</strong>
                  <p>{asText(entity.relationship, 'Related entity')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  },
});

const UtilityResultCardSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  rows: z.array(utilityRowSchema).optional(),
});

const UtilityResultCard = defineComponent({
  name: 'UtilityResultCard',
  description: 'Display pure utility output like normalized URLs or standardized names.',
  props: UtilityResultCardSchema,
  component: ({ props }) => {
    const rows = asArray(props.rows);
    return (
      <section className="analysis-card analysis-card--component">
        <div className="analysis-card-head">
          <div>
            <div className="analysis-card-kicker">Utility Output</div>
            <h3 className="analysis-card-title">{asText(props.title, 'Utility result')}</h3>
          </div>
        </div>
        {props.summary && <p className="analysis-story-block">{props.summary}</p>}
        {rows.length > 0 ? (
          <div className="analysis-mini-list">
            {rows.map((row, index) => (
              <div key={`${row.label}:${index}`} className="analysis-mini-item">
                <span className="analysis-severity analysis-severity--low">val</span>
                <div>
                  <strong>{row.label}</strong>
                  <p>{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <InlineEmptyState label="No structured rows were provided for this utility response." />
        )}
      </section>
    );
  },
});

export const analysisLibrary = createLibrary({
  components: [
    RunSummaryCard,
    TraceSearchResults,
    TraceEvidencePanel,
    AnomalySummaryPanel,
    MasterEntityPanel,
    UtilityResultCard,
  ],
});

export const analysisPromptOptions = {
  preamble: 'You are Axial Analysis, a read-only postmortem assistant for entity-matching decisions, anomalies, evidence, and master-data investigation.',
  additionalRules: [
    'Never trigger entity matching or mutate data.',
    'Prefer evidence-backed summaries and cite run IDs, trace refs, anomaly IDs, or entity IDs when relevant.',
    'Use the smallest set of components needed to answer clearly.',
    'Write valid openui-lang statements, not JSX. Prefer syntax like root = AnomalySummaryPanel("Title", items).',
    'Always define a root statement and return only openui-lang code when using components.',
    'If a structured component does not fit, return concise plain text instead of malformed UI.',
  ],
  examples: [
    'root = RunSummaryCard("RUN_123", "Anomaly-heavy batch", [{label:"Total traces", value:"248", tone:"cyan"}, {label:"Anomalies", value:"19", tone:"amber"}])',
    'root = TraceEvidencePanel("Why Axial resolved Acme", "The assigned entity matched on name and standardized domain evidence.", {sourceEntityName:"Acme Holdings", sourceModule:"news", sourceUniqueId:"n_42"}, {assignedEntityName:"Acme Inc.", assignedEntityId:"EM_9", matchPhase:"url_resolution", matchType:"domain"}, [{label:"source", value:"RUN_123:news:n_42", kind:"source"}], [{anomalyType:"url_conflict", severity:"medium", reason:"Two candidate domains looked similar", count:1}])',
  ],
};

export default analysisLibrary;
