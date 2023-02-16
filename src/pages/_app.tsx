import { SessionProvider } from "next-auth/react";
import { AppProps } from "next/app";
import { trpc } from "../utils/trpc";

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <SessionProvider session={pageProps.session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
};

export default trpc.withTRPC(App);
