import { Download, FileText } from 'lucide-react';

interface ResumeViewerProps {
  resumeUrl: string;
  filename?: string;
}

export function ResumeViewer({ resumeUrl, filename }: ResumeViewerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-white/80">Resume</h3>
        <a
          href={resumeUrl}
          download={filename || 'resume.pdf'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-white/50 transition-colors hover:border-[#D4A853]/20 hover:text-[#D4A853]"
        >
          <Download className="h-3 w-3" />
          Download
        </a>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <iframe
          src={`${resumeUrl}#toolbar=0&navpanes=0`}
          className="h-[600px] w-full"
          title="Resume"
        />
        {/* Fallback if iframe doesn't render PDF */}
        <noscript>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <FileText className="h-8 w-8 text-white/20" />
            <a
              href={resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#D4A853] underline"
            >
              Open Resume
            </a>
          </div>
        </noscript>
      </div>
    </div>
  );
}
