import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import {
  TextHOne,
  TextHTwo,
  TextHThree,
  TextBolder,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
} from 'phosphor-react'
import { Container, ButtonContainer, Button, Tiptap, WordCount } from './styles'

export default function RichTextInput() {
  let text = { content: [] }
  if (typeof window !== 'undefined') {
    // Perform localStorage action
    text = JSON.parse(localStorage.getItem('text') || '{}')
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      CharacterCount,
    ],
    autofocus: true,
    editable: true,
    injectCSS: false,
    onUpdate: ({ editor }) => {
      const text = editor.getJSON()
      localStorage.setItem('text', JSON.stringify(text))
    },
    onCreate: ({ editor }) => {
      editor?.commands.insertContent(text.content)
    },
  })

  if (!editor) {
    return null
  }

  return (
    <Container>
      <ButtonContainer>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <TextHOne size={18} weight="bold" />
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <TextHTwo size={18} weight="bold" />
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <TextHThree size={18} weight="bold" />
        </Button>
        <Button onClick={() => editor.chain().focus().toggleBold().run()}>
          <TextBolder size={18} weight="bold" />
        </Button>
        <Button onClick={() => editor.chain().focus().toggleItalic().run()}>
          <TextItalic size={18} weight="bold" />
        </Button>
        <Button onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <TextUnderline size={18} weight="bold" />
        </Button>
        <Button onClick={() => editor.chain().focus().toggleStrike().run()}>
          <TextStrikethrough size={18} weight="bold" />
        </Button>
      </ButtonContainer>
      <Tiptap onClick={(e) => console.log(e.target)} editor={editor} />
      <WordCount size={'xs'} as={'span'}>
        Word count: {editor.storage.characterCount.words()}
      </WordCount>
    </Container>
  )
}
