import { Suspense } from 'react'
import { ChatExperience } from '@/components/features/chat/chat-experience'

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatExperience />
    </Suspense>
  )
}
