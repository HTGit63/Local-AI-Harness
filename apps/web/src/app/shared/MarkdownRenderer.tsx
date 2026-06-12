import { StreamingMarkdown } from '../../components/StreamingMarkdown';

export function MarkdownRenderer({
  content,
  isStreaming,
  className,
}: {
  content: string;
  isStreaming?: boolean;
  className?: string;
}) {
  return (
    <StreamingMarkdown
      content={content}
      isStreaming={Boolean(isStreaming)}
      className={className}
    />
  );
}
