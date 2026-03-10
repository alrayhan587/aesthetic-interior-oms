'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Note = {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    fullName: string
    email: string
  }
  lead: {
    id: string
    name: string
    email: string
  }
}

interface LeadNotesTabProps {
  notes: Note[]
  notesLoading: boolean
  newNote: string
  submittingNote: boolean
  onNoteChange: (value: string) => void
  onAddNote: () => void
}

export function LeadNotesTab({
  notes,
  notesLoading,
  newNote,
  submittingNote,
  onNoteChange,
  onAddNote,
}: LeadNotesTabProps) {
  return (
    <div className="space-y-4">
      {/* Add Note Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Add a note..."
            value={newNote}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={3}
          />
          <Button
            onClick={onAddNote}
            className="w-full"
            disabled={!newNote.trim() || submittingNote}
          >
            {submittingNote ? 'Adding...' : 'Add Note'}
          </Button>
        </CardContent>
      </Card>

      {/* Notes List */}
      <div className="space-y-3">
        {notesLoading && (
          <div className="text-muted-foreground text-sm">Loading notes...</div>
        )}
        {!notesLoading && notes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <p>No notes yet. Add your first note!</p>
          </div>
        )}
        {!notesLoading && notes.map((note) => (
          <Card key={note.id} className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                {/* User Avatar */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 flex items-center justify-center text-white text-sm font-medium">
                  {note.user.fullName.charAt(0).toUpperCase()}
                </div>

                {/* Note Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-foreground">{note.user.fullName}</p>
                      <p className="text-xs text-muted-foreground">{note.user.email}</p>
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                      {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
