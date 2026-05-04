'use client'

import { use } from 'react'
import MacroEditor from '../../../../components/macros/MacroEditor'

export default function EditMacroPage({ params }) {
  const { id } = use(params)
  return <MacroEditor mode="edit" macroId={id} />
}
