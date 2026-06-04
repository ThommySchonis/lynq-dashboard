'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface EmailPreviewProps {
  displayName: string | null
  emailAddress: string
  closingText: string | null
  logoUrl: string | null
  logoWidth: number
  logoLinkUrl: string | null
  signatureHtml: string | null
}

export function EmailPreview({
  displayName,
  emailAddress,
  closingText,
  logoUrl,
  logoWidth,
  logoLinkUrl,
  signatureHtml,
}: EmailPreviewProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-foreground-2 hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Email Preview
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-lg p-5 text-[#1a1a1a] text-sm leading-relaxed font-sans">
            {/* Email headers */}
            <div className="pb-3 mb-3 border-b border-[#e5e5e5] space-y-0.5 text-xs text-[#666]">
              <div>
                From: <strong className="text-[#333]">{displayName || emailAddress}</strong> &lt;{emailAddress}&gt;
              </div>
              <div>To: customer@example.com</div>
              <div>Subject: Re: Order #12345</div>
            </div>

            {/* Body placeholder */}
            <div className="text-[#333] mb-4">
              <p>Hi Sarah,</p>
              <br />
              <p>Your order has been shipped and should arrive within 3–5 business days.</p>
              <br />
              <p className="text-[#999] italic text-xs">(email body)</p>
            </div>

            {/* Signature */}
            {(closingText || logoUrl || signatureHtml) && (
              <div className="mt-4">
                {closingText && (
                  <p className="text-[#333] mb-3">{closingText}</p>
                )}

                <hr className="border-t border-[#e5e5e5] my-3" />

                {logoUrl && (
                  <div className="mb-2">
                    {logoLinkUrl ? (
                      <a href={logoLinkUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={logoUrl}
                          alt="Logo"
                          style={{ width: logoWidth, maxWidth: '100%', height: 'auto', display: 'block' }}
                        />
                      </a>
                    ) : (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        style={{ width: logoWidth, maxWidth: '100%', height: 'auto', display: 'block' }}
                      />
                    )}
                  </div>
                )}

                {signatureHtml && (
                  <div
                    className="text-[#333] text-sm"
                    dangerouslySetInnerHTML={{ __html: signatureHtml }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
