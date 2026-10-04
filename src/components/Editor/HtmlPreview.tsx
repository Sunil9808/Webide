import React, { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { fileService } from '../../services/fileService';

export default function HtmlPreview({ content, filePath }: { content: string; filePath?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const workspace = useWorkspaceStore((state) => state.workspace);

  useEffect(() => {
    let isCancelled = false;

    const renderPreview = async () => {
      let finalContent = content;

      if (workspace?.type === 'local' && filePath && workspace?.path) {
        // Resolve local dependencies via DOMParser because backend cannot serve local handles
        const wp = workspace.path.replace(/\\/g, '/');
        const fp = filePath.replace(/\\/g, '/');
        const dir = fp.substring(0, fp.lastIndexOf('/'));

        const parser = new DOMParser();
        const doc = parser.parseFromString(finalContent, 'text/html');
        let modified = false;

        // Resolve CSS
        const links = doc.querySelectorAll('link[rel="stylesheet"]');
        for (const link of Array.from(links)) {
          const href = link.getAttribute('href');
          if (href && !href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('blob:') && !href.startsWith('//')) {
            const depPath = href.startsWith('/') ? `${wp}${href}` : `${dir}/${href}`;
            try {
              const { fileService } = await import('../../services/fileService');
              const fileData = await fileService.readFile(depPath);
              if (fileData?.content) {
                const blob = new Blob([fileData.content], { type: 'text/css' });
                link.setAttribute('href', URL.createObjectURL(blob));
                modified = true;
              }
            } catch (e) {
              console.warn('Could not inline CSS for preview:', depPath);
            }
          }
        }

        // Resolve JS
        const scripts = doc.querySelectorAll('script[src]');
        for (const script of Array.from(scripts)) {
          const src = script.getAttribute('src');
          if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('blob:') && !src.startsWith('//')) {
            const depPath = src.startsWith('/') ? `${wp}${src}` : `${dir}/${src}`;
            try {
              const { fileService } = await import('../../services/fileService');
              const fileData = await fileService.readFile(depPath);
              if (fileData?.content) {
                const blob = new Blob([fileData.content], { type: 'application/javascript' });
                script.setAttribute('src', URL.createObjectURL(blob));
                modified = true;
              }
            } catch (e) {
              console.warn('Could not inline JS for preview:', depPath);
            }
          }
        }

        if (modified) {
          const hasDoctype = content.trim().toLowerCase().startsWith('<!doctype');
          finalContent = (hasDoctype ? '<!DOCTYPE html>\n' : '') + doc.documentElement.outerHTML;
        }

      } else {
        // Remote workspace uses backend static server mapping
        let baseInject = '';
        if (filePath && workspace?.path) {
          const wp = workspace.path.replace(/\\/g, '/');
          const fp = filePath.replace(/\\/g, '/');
          if (fp.startsWith(wp)) {
            const relativePath = fp.slice(wp.length).replace(/^\//, '');
            const parts = relativePath.split('/');
            parts.pop(); 
            const dirParts = parts.join('/');
            const baseUrl = dirParts ? `/preview/${dirParts}/` : `/preview/`;
            baseInject = `<base href="${baseUrl}" />`;
          }
        } else {
          baseInject = `<base href="/preview/" />`;
        }

        if (baseInject) {
          if (finalContent.toLowerCase().includes('<head>')) {
            finalContent = finalContent.replace(/<head>/i, `<head>\n    ${baseInject}`);
          } else if (finalContent.toLowerCase().includes('<html')) {
            finalContent = finalContent.replace(/(<html[^>]*>)/i, `$1\n  <head>\n    ${baseInject}\n  </head>`);
          } else {
            finalContent = `${baseInject}\n${finalContent}`;
          }
        }
      }

      if (isCancelled) return;

      if (iframeRef.current) {
        const iframeDoc = iframeRef.current.contentDocument;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(finalContent);
          iframeDoc.close();
        }
      }
    };

    renderPreview();

    return () => {
      isCancelled = true;
    };
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
