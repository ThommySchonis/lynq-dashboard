'use client'

import { toast } from 'sonner'
import { MessageSquare, AlertCircle, CheckCircle } from 'lucide-react'
import { useInquiries, useMarkInquiryRead } from '@/hooks/admin'
import { MetricCard } from '@/components/features/admin/dashboard/metric-card'
import { InquiryCard } from './inquiry-card'
import { Card } from '@/components/ui/card'

export function InquiriesView() {
  const { data: inquiries = [] } = useInquiries()
  const markReadMutation = useMarkInquiryRead()

  const newCount = inquiries.filter((i) => i.status === 'new').length
  const readCount = inquiries.filter((i) => i.status === 'read').length

  const handleMarkRead = async (id: string) => {
    try {
      await markReadMutation.mutateAsync(id)
      toast.success('Inquiry marked as read')
    } catch {
      toast.error('Failed to mark inquiry as read')
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 max-w-[420px] mb-5">
        <MetricCard icon={MessageSquare} value={inquiries.length} label="Total" />
        <MetricCard icon={AlertCircle} value={newCount} label="New" />
        <MetricCard icon={CheckCircle} value={readCount} label="Read" />
      </div>

      {inquiries.length === 0 ? (
        <Card>
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No inquiries yet.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {inquiries.map((inq) => (
            <InquiryCard
              key={inq.id}
              inquiry={inq}
              onMarkRead={() => handleMarkRead(inq.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
