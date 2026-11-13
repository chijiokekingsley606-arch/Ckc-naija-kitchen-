export const metadata = {
  title: 'CKC NAIJA KITCHEN | Authentic Local Meals Near You',
  description: 'Order fresh Nigerian food directly from verified local kitchens near you.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#ea580c" />
        <script src="https://tailwindcss.com"></script>
      </head>
      <body className="bg-orange-50/40 text-gray-900 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
