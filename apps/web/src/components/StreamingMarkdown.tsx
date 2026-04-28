import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import type { Components, Options } from 'react-markdown';

type MarkdownPlugin = NonNullable<Options['remarkPlugins']>[number];

interface LoadedMarkdownRenderer {
  ReactMarkdown: ComponentType<Options>;
  rehypeKatex: MarkdownPlugin;
  remarkGfm: MarkdownPlugin;
  remarkMath: MarkdownPlugin;
}

let rendererPromise: Promise<LoadedMarkdownRenderer> | null = null;

function loadMarkdownRenderer(): Promise<LoadedMarkdownRenderer> {
  if (rendererPromise) {
    return rendererPromise;
  }

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
  const components: Components = {
    a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
  };

  return (
    <div className={className || 'markdown-body'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
