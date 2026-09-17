export type UndoCommandKind = 'document-edit' | 'property-edit' | 'kanban-move'

export interface UndoCommand {
  kind: UndoCommandKind
  label: string
  undo(): Promise<void>
}
