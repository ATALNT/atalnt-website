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
import Portal from "./pages/Portal";
import PortalDashboard from "./pages/PortalDashboard";
import PortalCandidate from "./pages/PortalCandidate";
import PortalAdmin from "./pages/PortalAdmin";
import PortalAdminNewCandidate from "./pages/PortalAdminNewCandidate";

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
          <Route path="/db" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/portal/dashboard" element={<PortalDashboard />} />
          <Route path="/portal/candidate/:id" element={<PortalCandidate />} />
          <Route path="/portal/admin" element={<PortalAdmin />} />
          <Route path="/portal/admin/new" element={<PortalAdminNewCandidate />} />
          <Route path="/portal/admin/candidate/:id" element={<PortalCandidate />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
