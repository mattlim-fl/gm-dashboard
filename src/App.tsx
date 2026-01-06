
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { HomeRoute } from "@/components/auth/HomeRoute";
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
import Occasions from "./pages/Occasions";
import Team from "./pages/Team";

const queryClient = new QueryClient();

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
              <Route path="/customers" element={
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              } />
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
              <Route path="/occasions" element={
                <ProtectedRoute>
                  <Occasions />
                </ProtectedRoute>
              } />
              <Route path="/team" element={
                <AdminRoute>
                  <Team />
                </AdminRoute>
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
