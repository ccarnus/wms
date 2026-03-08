import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Connectors } from "@/components/Connectors";
import { Architecture } from "@/components/Architecture";
import { Benefits } from "@/components/Benefits";
import { Pricing } from "@/components/Pricing";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="bg-white">
      <Navbar />
      <Hero />
      <Features />
      <Connectors />
      <Architecture />
      <Benefits />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}
