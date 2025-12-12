import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <meta charSet="utf-8" />
        <meta
          name="description"
          content="A minimalist, privacy-focused personal book reader. Upload and read PDFs, EPUBs, and MOBIs with bookmarks and notes."
        />
        <meta
          name="keywords"
          content="book reader, pdf reader, epub reader, ebook, reading app"
        />
        <meta name="author" content="Bookish" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content="Bookish - Personal Book Reader" />
        <meta
          property="og:description"
          content="A minimalist, privacy-focused personal book reader."
        />
        <meta property="og:site_name" content="Bookish" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Bookish - Personal Book Reader" />
        <meta
          name="twitter:description"
          content="A minimalist, privacy-focused personal book reader."
        />

        {/* Theme colors for mobile browsers */}
        <meta
          name="theme-color"
          content="#f7f5f3"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#1a1a1a"
          media="(prefers-color-scheme: dark)"
        />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/icon-light-32x32.png"
          media="(prefers-color-scheme: light)"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/icon-dark-32x32.png"
          media="(prefers-color-scheme: dark)"
        />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
