import React from "react";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { Droplets } from "lucide-react";
import { ThermoraHero } from "./components/ThermoraHero";
import { DigitalTwin } from "./components/DigitalTwin";
import { Intelligence } from "./components/Intelligence";
import { LiveNode } from "./components/LiveNode";
import { Impact } from "./components/Impact";
import { Transparency } from "./components/Transparency";
import { IndiaView } from "./components/IndiaView";

function TopNavBar() {
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Home" },
    { to: "/model", label: "Engineering Model" },
    { to: "/impact", label: "Impact" },
    { to: "/prototype", label: "Prototype" },
    { to: "/india", label: "India Grid" },
  ];

  return (
    <header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav 
        id="top-pill-navigation"
        className="pointer-events-auto w-full max-w-5xl bg-[#061822]/90 border border-cyan-500/30 backdrop-blur-xl rounded-full px-5 py-2.5 flex items-center justify-between shadow-[0_10px_35px_rgba(0,0,0,0.8)] transition-all"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Brand Left */}
        <NavLink 
          to="/" 
          className="flex items-center gap-2.5 text-white font-bold hover:opacity-85 transition-opacity"
        >
          <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.3)]">
            <Droplets size={15} className="text-cyan-400" />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-white">Thermora</span>
        </NavLink>

        {/* Nav Links */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || 
              (item.to === "/model" && location.pathname === "/twin") ||
              (item.to === "/prototype" && location.pathname === "/node");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`px-3 py-1.5 sm:px-3.5 rounded-full text-xs transition-all duration-150 ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5 font-medium"
                }`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div 
      className="min-h-screen bg-[#020b12] text-slate-100 text-sm antialiased selection:bg-cyan-500/30 selection:text-cyan-200 flex flex-col"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <TopNavBar />
      <main className="flex-1 w-full pt-16">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ThermoraHero />} />
          <Route path="/model" element={<DigitalTwin />} />
          <Route path="/twin" element={<DigitalTwin />} />
          <Route path="/impact" element={<Impact />} />
          <Route path="/prototype" element={<LiveNode />} />
          <Route path="/node" element={<LiveNode />} />
          <Route path="/india" element={<IndiaView />} />
          <Route path="/transparency" element={<Transparency />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

