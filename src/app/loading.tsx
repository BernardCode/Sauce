import { AppHeader } from "@/app/components/app-header";

export default function Loading() {
  return (
    <div className="app-page" data-page="loading">
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <div className="route-loading-page" role="status" aria-label="Loading page">
          <span className="sr-only">Loading</span>
          <div className="route-loading-title" />
          <div className="route-loading-panel">
            <div />
            <div />
            <div />
          </div>
        </div>
      </main>
    </div>
  );
}
