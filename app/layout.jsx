import "./globals.css";

export const metadata = {
  title: "Slack Sent Messages",
  description: "Search messages sent by your Slack user."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
