import { Navigate, Route, Routes } from "react-router-dom";
import { LibraryPage } from "../features/projects/LibraryPage";
import { OverviewPage } from "../features/workspace/OverviewPage";
import { PlaceholderPage } from "../features/workspace/PlaceholderPage";
import { WorkspaceLayout } from "../features/workspace/WorkspaceLayout";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LibraryPage />} />
      <Route path="/p/:projectId" element={<WorkspaceLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="atlas" element={<PlaceholderPage section="atlas" />} />
        <Route path="entries" element={<PlaceholderPage section="entries" />} />
        <Route path="manuscript" element={<PlaceholderPage section="manuscript" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}