import { getServerSession } from 'next-auth'
import { GetServerSideProps } from 'next'
import { signIn } from 'next-auth/react'
import Head from 'next/head'
import { Button, Heading, Text } from '@writeme-ui/react'

import { authOptions } from '../api/auth/[...nextauth].api'
import { authErrorMessages } from '@/constants'
import { Container, Hero, ErrorText } from './styles'
import { useRouter } from 'next/router'

export default function Login() {
  const { error } = useRouter().query

  const errorMessage = (error: string | string[]) => {
    return (
      error &&
      (authErrorMessages[error as keyof typeof authErrorMessages] ??
        authErrorMessages.default)
    )
  }

  return (
    <>
      <Head>
        <title>Login | WriteMe</title>
      </Head>
      <Container>
        <Hero>
          <Heading as="h1" size="2xl">
            Write Me
          </Heading>
          <Heading as="h2" size="lg">
            Write your stories
          </Heading>
          <Text size="md">Connect your google account</Text>
          <Button size={'sm'} onClick={() => signIn('google')}>
            Google
          </Button>
          {error && <ErrorText size={'sm'}>{errorMessage(error)}</ErrorText>}
        </Hero>
      </Container>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions)

  if (session) {
    return {
      redirect: {
        destination: '/dashboard',
        permanent: false,
      },
    }
  }

  return {
    props: {},
  }
}
