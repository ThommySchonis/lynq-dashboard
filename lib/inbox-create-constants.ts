export interface ComposeMacro {
  id: string
  name: string
  body?: string
  tags?: string[]
  archived?: boolean
}

export const DEMO_RECENT = [
  { id: 'r1', from: 'Sophie de Vries', subject: 'Where is my package?', time: '2h ago', status: 'open' as const },
  { id: 'r2', from: 'Mark Jansen', subject: 'Received wrong product', time: '5h ago', status: 'open' as const },
  { id: 'r3', from: 'Lisa Bakker', subject: 'Refund request #1042', time: '1d ago', status: 'pending' as const },
  { id: 'r4', from: 'Tom Hendricks', subject: 'Re: Delivery time question', time: '2d ago', status: 'resolved' as const },
  { id: 'r5', from: 'Anna Smit', subject: 'Exchange size — order #1045', time: '3d ago', status: 'resolved' as const },
]

export const STATUS_COLOR: Record<string, string> = {
  open: 'bg-[#7C5CFC]',
  pending: 'bg-amber-500',
  resolved: 'bg-emerald-500',
}

export const PRIORITY_OPTS = ['low', 'normal', 'high', 'urgent'] as const

export const FALLBACK_MACROS: ComposeMacro[] = [
  { id: 'greeting', name: 'Greeting', tags: ['support'], archived: false, body: 'Hi {{name}},\n\nThank you for reaching out! I\'m happy to help you.\n\n' },
  { id: 'tracking', name: 'Tracking Update', tags: ['shipping'], archived: false, body: 'Hi {{name}},\n\nYour order is on its way! You can track it using the link in your shipping confirmation email.\n\nBest regards,\nCustomer Support' },
  { id: 'refund', name: 'Refund', tags: ['refund'], archived: false, body: 'Hi {{name}},\n\nYour refund has been processed. The amount is typically back in your account within 5\u20137 business days.\n\nBest regards,\nCustomer Support' },
  { id: 'delay', name: 'Delay', tags: ['shipping'], archived: false, body: 'Hi {{name}},\n\nUnfortunately your order is experiencing a delay. We\'ll keep you updated!\n\nBest regards,\nCustomer Support' },
  { id: 'quality', name: 'Quality Issue', tags: ['complaint'], archived: false, body: 'Hi {{name}},\n\nWe\'re sorry to hear that! Could you send us a photo? We\'ll arrange a solution right away.\n\nBest regards,\nCustomer Support' },
  { id: 'closing', name: 'Closing', tags: ['support'], archived: false, body: 'Hi {{name}},\n\nGreat to hear! Have a wonderful day!\n\nBest regards,\nCustomer Support' },
  { id: 'notfound', name: 'Order Not Found', tags: ['order'], archived: false, body: 'Hi {{name}},\n\nI\'m unable to find an order linked to this email address. Could you share your order number?\n\nBest regards,\nCustomer Support' },
  { id: 'wrongitem', name: 'Wrong Item', tags: ['complaint'], archived: false, body: 'Hi {{name}},\n\nWe\'re sorry about that! Please send us a photo and we\'ll sort it out right away.\n\nBest regards,\nCustomer Support' },
]
