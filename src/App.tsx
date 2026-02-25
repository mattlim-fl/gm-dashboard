
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { VenueProvider } from "@/contexts/VenueContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { HomeRoute } from "@/components/auth/HomeRoute";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Bookings from "./pages/Bookings";
import CreateBooking from "./pages/CreateBooking";
import NotFound from "./pages/NotFound";
import RunSheet from "./pages/RunSheet";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";

import Revenue from "./pages/Revenue";
import BoothManagement from "./pages/BoothManagement";
import ProfitAndLoss from "./pages/ProfitAndLoss";
import Team from "./pages/Team";
import Photos from "./pages/Photos";
import MemberCheckin from "./pages/MemberCheckin";
import Guests from "./pages/Guests";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh
      gcTime: 1000 * 60 * 30,   // 30 minutes - keep in cache
      refetchOnWindowFocus: false, // Don't refetch when switching tabs
      refetchOnReconnect: true,    // Do refetch after network reconnect
      retry: 1,                    // Retry failed requests once
    },
  },
});

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <VenueProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<HomeRoute />} />
              <Route path="/dashboard" element={
                <AdminRoute>
                  <Dashboard />
                </AdminRoute>
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
              <Route path="/guests" element={
                <ProtectedRoute>
                  <Guests />
                </ProtectedRoute>
              } />
              {/* Redirects for old URLs */}
              <Route path="/customers" element={<Navigate to="/guests?tab=customers" replace />} />
              <Route path="/members" element={<Navigate to="/guests?tab=members" replace />} />
              <Route path="/occasions" element={<Navigate to="/bookings?tab=occasions" replace />} />
              <Route path="/revenue" element={
                <AdminRoute>
                  <Revenue />
                </AdminRoute>
              } />
              <Route path="/pnl" element={
                <AdminRoute>
                  <ProfitAndLoss />
                </AdminRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/booth-management" element={
                <ProtectedRoute>
                  <BoothManagement />
                </ProtectedRoute>
              } />
              <Route path="/team" element={
                <AdminRoute>
                  <Team />
                </AdminRoute>
              } />
              <Route path="/photos" element={
                <ProtectedRoute>
                  <Photos />
                </ProtectedRoute>
              } />
              <Route path="/members/checkin" element={
                <ProtectedRoute>
                  <MemberCheckin />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </VenueProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
