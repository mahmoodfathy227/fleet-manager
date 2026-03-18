/**
 * Minimal _document for Next.js build compatibility.
 * This app uses the App Router (app/); this file exists so the build
 * can resolve the _document module when it looks for it internally.
 */
import Document, { Html, Head, Main, NextScript } from 'next/document'

export default class NextDocument extends Document {
  render() {
    return (
      <Html>
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
