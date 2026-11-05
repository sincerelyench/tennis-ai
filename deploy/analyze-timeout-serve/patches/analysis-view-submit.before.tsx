    if (file.size < MIN_PLAYABLE_BYTES) {
      setPhase("error");
      setFormError(t("analysis.noPictureAfterConvert"));
      return;
    }
    setClipFile(file);
    setFileName(file.name);
    setFormError("");
    setPhase("submitting");
    setJobSnap(null);
    markSubmitting({
      jobId: `pending-${Date.now()}`,
      levelId: "",
      strokeId: stroke.id,
      fileName: file.name,
      title: analysisTitle(stroke.label, file.name),
      coachId: readCoachId()});
    const ready = await pingTai().catch(() => false);
    if (!ready) {
      clearActiveJob();
      setPhase("error");
      setFormError(t("analysis.serviceDown"));
      return;
    }
    const body = new FormData();
    const clipName = file.name.toLowerCase().endsWith(".mp4") ? file.name : `${file.name.replace(/\.[^.]+$/, "") || "clip"}.mp4`;
    body.append("video", file, clipName);
    body.append("level", "");
    body.append("stroke", stroke.apiStroke);
    body.append("title", analysisTitle(stroke.label, file.name));
    body.append("sample", "0");
    try {
      const response = await taiFetch("/api/analyze", { method: "POST", body, timeoutMs: 900_000 });
      const payload = (await response.json().catch(() => null)) as unknown;
      const jobId =
        payload && typeof payload === "object" && "job_id" in payload
          ? String((payload as { job_id?: string }).job_id || "")
          : "";
      if (!response.ok || !jobId) {
        clearActiveJob();
        setPhase("error");
        setFormError(apiErrorMessage(payload, t("analysis.submitFail"), response.status, locale));
        return;
      }
      setActiveJobId(jobId);
      startJobWatch({
        jobId,
        levelId: "",
        strokeId: stroke.id,
        fileName: file.name,
        title: analysisTitle(stroke.label, file.name),
        phase: "running",
        coachId: readCoachId()});
      setPhase("running");
      void persistClipBlob(jobId, file).then((ok) => {
        if (ok) return uploadAppClip(jobId, file);
        return false;
      });
    } catch (error) {
      clearActiveJob();
      setPhase("error");
      setFormError(error instanceof Error && error.message ? localizeJobError(locale, error.message) : t("analysis.networkDropped"));
    }
  }

  return (
    <div className={pageClass} data-page="analysis" data-job-id={activeJobId || undefined} data-analysis-screen={analyzing ? "progress" : "wizard"}>
      <div>
        <h1 className="text-base font-bold text-foreground">{t("analysis.title")}</h1>
        {analyzing ? null : (
          <div className="mt-2 flex flex-wrap gap-3">
