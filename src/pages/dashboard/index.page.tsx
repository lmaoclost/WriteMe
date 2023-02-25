import { signOut } from 'next-auth/react'
import Head from 'next/head'
import Image from 'next/image'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import RichTextInput from '@/components/RichTextInput'

import { authOptions } from '../api/auth/[...nextauth].api'

interface Session {
  session: {
    user: {
      email: string
      image: string
    }
  }
}

export default function Dashboard({ session }: Session) {
  return (
    <>
      <Head>
        <title>Dashboard | WriteMe</title>
      </Head>
      Signed in as {session.user.email} <br />
      <Image
        src={session.user.image || ''}
        priority
        width={150}
        height={150}
        alt=""
      />
      <button onClick={() => signOut()}>Sign out</button>
      <RichTextInput />
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions)

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    }
  }

  return {
    props: {
      session,
    },
  }
}
