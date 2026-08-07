"use client";
"use no memo";

import { useState } from "react";

import { RecommendationForm } from "./recommendation-form";
import { RecommendationResults } from "./recommendation-results";

export function RecommendationPageClient() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <RecommendationForm onResults={setActiveRunId} />
      {activeRunId && <RecommendationResults runId={activeRunId} />}
    </div>
  );
}
