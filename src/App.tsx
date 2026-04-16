import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Contact from "./pages/Contact";
import ROICalculator from "./pages/ROICalculator";
import Jobs from "./pages/Jobs";
import Apply from "./pages/Apply";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import ActiveCandidates from "./pages/ActiveCandidates";
import InstantlyDashboard from "./pages/InstantlyDashboard";
import ClientPortal from "./pages/ClientPortal";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/roi-calculator" element={<ROICalculator />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/about" element={<About />} />
          <Route path="/activetalent" element={<ActiveCandidates />} />
          <Route path="/db" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/instantly" element={<InstantlyDashboard />} />
          <Route path="/balfour" element={<ClientPortal clientSlug="balfour" clientDisplayName="Balfour & Co" />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
