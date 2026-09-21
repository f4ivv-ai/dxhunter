import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./contexts/I18nContext";
import { LocatorPromptModal } from "./components/LocatorPromptModal";
import { lazy, Suspense } from "react";

// Lazy-load pages for better code splitting
const Landing = lazy(() => import("./pages/Landing"));
const Home = lazy(() => import("./pages/Home"));
const Pilot = lazy(() => import("./pages/Pilot"));
const Forecast = lazy(() => import("./pages/Forecast"));
const Admin = lazy(() => import("./pages/Admin"));
const Docs = lazy(() => import("./pages/Docs"));
const Profile = lazy(() => import("./pages/Profile"));
const DxInfo = lazy(() => import("./pages/DxInfo"));
const EcouteDx = lazy(() => import("./pages/EcouteDx"));

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Switch>
        <Route path={"/"} component={Landing} />
        <Route path={"/app"} component={Home} />
        <Route path={"/pilot"} component={Pilot} />
        <Route path={"/forecast"} component={Forecast} />
        <Route path={"/admin"} component={Admin} />
        <Route path={"/docs"} component={Docs} />
        <Route path={"/profile"} component={Profile} />
        <Route path={"/dxinfo"} component={DxInfo} />
        <Route path={"/ecoute-dx"} component={EcouteDx} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ThemeProvider defaultTheme="dark" switchable>
          <TooltipProvider delayDuration={150}>
            <Toaster position="top-right" />
            <Router />
            <LocatorPromptModal />
          </TooltipProvider>
        </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;
