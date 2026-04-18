import { useEffect, useState } from 'react';

interface LoadedMarkdownRenderer {
  ReactMarkdown: any;
  rehypeKatex: any;
  remarkGfm: any;
  remarkMath: any;
}

let rendererPromise: Promise<LoadedMarkdownRenderer> | null = null;

function loadMarkdownRenderer(): Promise<LoadedMarkdownRenderer> {
  if (!rendererPromise) {
    rendererPromise = Promise.all([
      import('react-markdown'),
      import('remark-gfm'),
      import('remark-math'),
      import('rehype-katex'),
      import('katex/dist/katex.min.css'),
    ]).then(([reactMarkdown, remarkGfm, remarkMath, rehypeKatex]) => ({
      ReactMarkdown: reactMarkdown.default,
      remarkGfm: remarkGfm.default,
      remarkMath: remarkMath.default,
      rehypeKatex: rehypeKatex.default,
    }));
  }

  return rendererPromise;
}

export function StreamingMarkdown({
  content,
  isStreaming,
  className,
}: {
  content: string;
  isStreaming: boolean;
  className?: string;
}) {
  const [renderer, setRenderer] = useState<LoadedMarkdownRenderer | null>(null);

  useEffect(() => {
    if (isStreaming || renderer) {
      return;
    }

    let active = true;
    void loadMarkdownRenderer().then((loaded) => {
      if (active) {
        setRenderer(loaded);
      }
    });

    return () => {
      active = false;
    };
  }, [isStreaming, renderer]);

  if (isStreaming || !renderer) {
    return <pre className={className || 'stream-plain-text'}>{content}</pre>;
  }

  const { ReactMarkdown, remarkGfm, remarkMath, rehypeKatex } = renderer;

  return (
    <div className={className || 'markdown-body'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: (props: Record<string, unknown>) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
