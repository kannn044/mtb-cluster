
import { Navbar } from "@/components/Navbar/Navbar";

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
