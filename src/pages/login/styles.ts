import { styled, Heading, Text } from '@writeme-ui/react'

export const Container = styled('div', {
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

export const Hero = styled('div', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: '$10',
  padding: '$10',
  background: '$gray700',
  borderRadius: '$sm',

  [`> ${Heading}`]: {
    '@media(max-width: 600px)': {
      fontSize: '$4xl',
    },
  },

  [`> ${Text}`]: {
    maskType: '$2',
    color: '$gray200',
  },
})

export const ErrorText = styled(Text, {
  color: '$red500 !important',
})
