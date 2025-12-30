
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Bookings from "./pages/Bookings";
import CreateBooking from "./pages/CreateBooking";
import DesignSystem from "./pages/DesignSystem";
import NotFound from "./pages/NotFound";
import RunSheet from "./pages/RunSheet";
import Customers from "./pages/Customers";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";

import Revenue from "./pages/Revenue";
import BoothManagement from "./pages/BoothManagement";
import ProfitAndLoss from "./pages/ProfitAndLoss";
import Team from "./pages/Team";
import Occasions from "./pages/Occasions";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/permissions";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: 1000 * 60 * 30,   // 30 minutes - keep in cache
      refetchOnWindowFocus: false, // Don't refetch when user returns to tab
    },
  },
});

const RootRoute = () => {
  const { role } = useAuth();

  if (isAdmin(role)) {
    return <Dashboard />;
  }

  return <Navigate to="/calendar" replace />;
};

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <RootRoute />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <Dashboard />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/calendar" element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              } />
              <Route path="/bookings" element={
                <ProtectedRoute>
                  <Bookings />
                </ProtectedRoute>
              } />
              <Route path="/bookings/create" element={
                <ProtectedRoute>
                  <CreateBooking />
                </ProtectedRoute>
              } />
              <Route path="/run-sheet" element={
                <ProtectedRoute>
                  <RunSheet />
                </ProtectedRoute>
              } />
              <Route path="/customers" element={
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              } />
              <Route path="/occasions" element={
                <ProtectedRoute>
                  <Occasions />
                </ProtectedRoute>
              } />
              <Route path="/revenue" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <Revenue />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/pnl" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <ProfitAndLoss />
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/team" element={
                <ProtectedRoute>
                  <Team />
                </ProtectedRoute>
              } />
              <Route path="/design" element={
                <ProtectedRoute>
                  <DesignSystem />
                </ProtectedRoute>
              } />
              <Route path="/booth-management" element={
                <ProtectedRoute>
                  <BoothManagement />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
