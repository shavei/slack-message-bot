import "./globals.css";

export const metadata = {
  title: "מרכז באגים מסלאק",
  description: "מרכז קל לניהול, סיווג ותיקון באגים שמגיעים מסלאק."
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}