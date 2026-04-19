import { Html, Head, Main, NextScript } from "next/document";

const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#185FA5" />
        <meta name="description" content="eSocial SST Transmissor — plataforma SaaS para transmissão de eventos SST ao eSocial. Importe ASO, LTCAT e PCMSO via IA e transmita S-2220, S-2240 e S-2221 com facilidade." />
        <meta name="keywords" content="eSocial SST, transmissão eSocial, S-2220, S-2240, S-2221, ASO eSocial, LTCAT, PCMSO, saúde segurança trabalho" />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="eSocial SST Transmissor" />
        <meta property="og:title" content="eSocial SST Transmissor — Transmita eventos SST com facilidade" />
        <meta property="og:description" content="Plataforma SaaS para transmissão de eventos SST ao eSocial. Importe documentos via IA e transmita S-2220, S-2240 e S-2221." />
        <meta property="og:url" content="https://dsegconsultoria.com.br" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="eSocial SST Transmissor" />
        <meta name="twitter:description" content="Transmita eventos SST ao eSocial com facilidade. Importe ASO, LTCAT e PCMSO via IA." />
        <link rel="canonical" href="https://dsegconsultoria.com.br" />

        {GOOGLE_ADS_ID && (
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          />
        )}
        {GOOGLE_ADS_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GOOGLE_ADS_ID}');
              `,
            }}
          />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
