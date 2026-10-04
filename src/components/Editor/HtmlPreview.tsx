import React, { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';

export default function HtmlPreview({ content, filePath }: { content: string; filePath?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const workspace = useWorkspaceStore((state) => state.workspace);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        let baseInject = '';
        if (filePath && workspace?.path) {
          const wp = workspace.path.replace(/\\/g, '/');
          const fp = filePath.replace(/\\/g, '/');
          if (fp.startsWith(wp)) {
            const relativePath = fp.slice(wp.length).replace(/^\//, '');
            const parts = relativePath.split('/');
            parts.pop(); 
            const dir = parts.join('/');
            const baseUrl = dir ? `/preview/${dir}/` : `/preview/`;
            baseInject = `<base href="${baseUrl}" />`;
          }
        } else {
          baseInject = `<base href="/preview/" />`;
        }

        let finalContent = content;
        if (baseInject) {
          if (finalContent.toLowerCase().includes('<head>')) {
            finalContent = finalContent.replace(/<head>/i, `<head>\n    ${baseInject}`);
          } else if (finalContent.toLowerCase().includes('<html')) {
            finalContent = finalContent.replace(/(<html[^>]*>)/i, `$1\n  <head>\n    ${baseInject}\n  </head>`);
          } else {
            finalContent = `${baseInject}\n${finalContent}`;
          }
        }

        doc.open();
        doc.write(finalContent);
        doc.close();
      }
    }
  }, [content, filePath, workspace]);

  return (
    <div className="h-full w-full bg-white relative">
      <div className="absolute top-0 right-0 bg-black/50 text-white text-xs px-2 py-1 rounded-bl-md z-10 font-mono">
        Live Preview
      </div>
      <iframe
        ref={iframeRef}
        className="h-full w-full border-0 bg-white"
        title="Live HTML Preview"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
