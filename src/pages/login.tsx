import { useSession, signIn, signOut } from "next-auth/react"
import Image from "next/image";

export default function Login() {
  const { data: session } = useSession();

  console.log(session)
  if (session) {
    return (
      <>
        Signed in as {session.user?.email} <br />
        <Image src={session.user?.image || ''} alt="" />
        <button onClick={() => signOut()}>Sign out</button>
      </>
    )
  }
  return (
    <>
      Not signed in <br />
      <button onClick={() => signIn('google')}>Google</button>
    </>
  )
}