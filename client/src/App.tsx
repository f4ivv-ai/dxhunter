import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./contexts/I18nContext";
import { LocatorPromptModal } from "./components/LocatorPromptModal";
import { lazy, Suspense } from "react";

// Lazy-load pages for better code splitting
const Home = lazy(() => import("./pages/Home"));
const Pilot = lazy(() => import("./pages/Pilot"));
const Forecast = lazy(() => import("./pages/Forecast"));
const Docs = lazy(() => import("./pages/Docs"));
const Profile = lazy(() => import("./pages/Profile"));
const DxInfo = lazy(() => import("./pages/DxInfo"));
const EcouteDx = lazy(() => import("./pages/EcouteDx"));
const Login = lazy(() => import("./pages/Login"));

/** Console personnelle : tout est réservé à l'administrateur connecté. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!isAuthenticated) {
    window.location.replace(getLoginUrl(window.location.pathname));
    return null;
  }
  return (
    <>
      {children}
      <LocatorPromptModal />
    </>
  );
}

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Switch>
        <Route path={"/login"} component={Login} />
        <Route path={"/"}>
          <Redirect to="/app" />
        </Route>
        <Route>
          <RequireAuth>
            <Switch>
              <Route path={"/app"} component={Home} />
              <Route path={"/pilot"} component={Pilot} />
              <Route path={"/forecast"} component={Forecast} />
              <Route path={"/docs"} component={Docs} />
              <Route path={"/profile"} component={Profile} />
              <Route path={"/dxinfo"} component={DxInfo} />
              <Route path={"/ecoute-dx"} component={EcouteDx} />
              <Route path={"/404"} component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </RequireAuth>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <ThemeProvider defaultTheme="light" switchable>
          <TooltipProvider delayDuration={150}>
            <Toaster position="top-right" />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;
