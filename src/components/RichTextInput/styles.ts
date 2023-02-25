import { styled, Text, Box } from '@writeme-ui/react'
import { EditorContent } from '@tiptap/react'

export const Container = styled(Box, {
  display: 'flex',
  flexDirection: 'column',
  padding: 0,
})

export const ButtonContainer = styled('div', {
  display: 'flex',
  flex: '0 0 auto',
  gap: '$1',
  background: '$gray700',

  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '0.25rem',
})

export const Button = styled('button', {
  background: '$gray600',
  color: '$gray100',
  border: 'none',
  transition: 'all 0.2s ease-in-out',

  '&:hover': {
    color: '$cyan300',
  },
})

export const Tiptap = styled(EditorContent, {
  fontFamily: '$fonts',
  background: '$gray700',
  padding: '$1 $2',
  color: '$white',

  p: {
    paddingLeft: '$16',
  },
})

export const WordCount = styled(Text, {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'end',
})
