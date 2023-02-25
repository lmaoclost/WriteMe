import { Button } from '@writeme-ui/react'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()

  const redirectToLogin = () => {
    router.push('/login')
  }

  return (
    <Button onClick={redirectToLogin} size={'sm'}>
      Login
    </Button>
  )
}
