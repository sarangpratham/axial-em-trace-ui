function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function JsonHighlight({ data, className }: { data: unknown; className?: string }) {
  const source = escapeHtml(JSON.stringify(data, null, 2));
  const highlighted = source
    .replace(/"([^"]+)":/g, '<span class="json-token json-token--key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="json-token json-token--string">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="json-token json-token--number">$1</span>')
    .replace(/: (true|false|null)/g, ': <span class="json-token json-token--literal">$1</span>');

  return <pre className={className} dangerouslySetInnerHTML={{ __html: highlighted }} />;
}
