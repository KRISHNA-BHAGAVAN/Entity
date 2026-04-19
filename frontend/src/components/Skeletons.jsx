const baseBlock =
  "relative overflow-hidden rounded-xl bg-slate-200/70 before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.7)_40%,transparent_80%)] before:animate-[sds-shimmer_1.6s_infinite] motion-reduce:before:animate-none";

export const SkeletonBlock = ({ className = "" }) => (
  <div className={`${baseBlock} ${className}`} aria-hidden="true" />
);

export const AppSessionSkeleton = () => (
  <div className="h-screen grid place-items-center bg-[radial-gradient(circle_at_15%_20%,#dbeafe_0,#eff6ff_34%,#f8fafc_100%)]">
    <div className="w-[min(560px,92vw)] rounded-3xl border border-sky-100 bg-white/85 p-8 shadow-[0_30px_80px_-40px_rgba(14,116,144,0.45)] backdrop-blur">
      <div className="mb-6 flex items-center gap-3">
        <SkeletonBlock className="h-12 w-12 rounded-2xl" />
        <div className="w-full space-y-2">
          <SkeletonBlock className="h-4 w-32 rounded-lg" />
          <SkeletonBlock className="h-3 w-48 rounded-lg" />
        </div>
      </div>
      <div className="space-y-3">
        <SkeletonBlock className="h-3 w-full rounded-lg" />
        <SkeletonBlock className="h-3 w-11/12 rounded-lg" />
        <SkeletonBlock className="h-3 w-9/12 rounded-lg" />
      </div>
    </div>
  </div>
);

export const BYOKSettingsSkeleton = () => (
  <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
    <div className="mb-6 rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-6 shadow-sm">
      <SkeletonBlock className="mb-3 h-6 w-72" />
      <SkeletonBlock className="h-4 w-11/12" />
    </div>
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <SkeletonBlock className="mb-4 h-5 w-56" />
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonBlock className="h-11 w-full" />
          <SkeletonBlock className="h-11 w-full" />
          <SkeletonBlock className="h-11 w-full" />
          <SkeletonBlock className="h-11 w-full" />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <SkeletonBlock className="mb-4 h-5 w-40" />
        <div className="space-y-3">
          <SkeletonBlock className="h-18 w-full" />
          <SkeletonBlock className="h-18 w-full" />
        </div>
      </div>
    </div>
  </div>
);

export const SchemaDiscoverySkeleton = () => (
  <div className="h-screen overflow-hidden bg-white">
    <div className="h-14 border-b border-slate-200 px-4">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-8 w-8 rounded-lg" />
          <div className="space-y-2">
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonBlock className="h-3 w-52" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-8 w-32" />
          <SkeletonBlock className="h-8 w-28" />
        </div>
      </div>
    </div>
    <div className="grid h-[calc(100vh-56px)] gap-0 lg:grid-cols-2">
      <div className="border-r border-slate-200 bg-slate-50/60 p-5">
        <SkeletonBlock className="mb-4 h-8 w-40" />
        <SkeletonBlock className="mb-3 h-[26vh] w-full" />
        <SkeletonBlock className="mb-3 h-[26vh] w-full" />
        <SkeletonBlock className="h-[18vh] w-full" />
      </div>
      <div className="bg-white p-5">
        <SkeletonBlock className="mb-4 h-8 w-56" />
        <SkeletonBlock className="mb-3 h-12 w-full" />
        <SkeletonBlock className="mb-3 h-12 w-full" />
        <SkeletonBlock className="mb-3 h-12 w-full" />
        <SkeletonBlock className="h-40 w-full" />
      </div>
    </div>
  </div>
);

export const DashboardSkeleton = () => (
  <div className="px-8 py-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex items-end justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-8 w-72" />
        </div>
        <SkeletonBlock className="h-10 w-36" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5">
            <SkeletonBlock className="mb-3 h-4 w-3/5" />
            <SkeletonBlock className="mb-2 h-3 w-full" />
            <SkeletonBlock className="mb-6 h-3 w-11/12" />
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-7 w-20" />
              <SkeletonBlock className="h-7 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const UploadsSkeleton = () => (
  <div className="px-6 py-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-7 w-80" />
        </div>
        <SkeletonBlock className="h-10 w-48" />
      </div>
      <SkeletonBlock className="mb-6 h-36 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...Array(6)].map((_, idx) => (
          <SkeletonBlock key={idx} className="h-28 w-full" />
        ))}
      </div>
    </div>
  </div>
);

export const ReportColumnConfigSkeleton = () => (
  <div className="flex overflow-y-hidden">
    <div className="min-w-[600px] shrink-0 overflow-y-auto pr-1 space-y-3 mb-4 max-h-[480px] custom-scrollbar">
      {[...Array(6)].map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col gap-2 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-6 w-6 rounded-md" />
            <SkeletonBlock className="h-4 w-52" />
            <div className="ml-auto flex items-center gap-1">
              <SkeletonBlock className="h-7 w-7 rounded-md" />
              <SkeletonBlock className="h-7 w-7 rounded-md" />
            </div>
          </div>
          <div className="pl-8">
            <SkeletonBlock className="h-8 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>

    <div className="pl-4 border-l border-slate-100 flex flex-col justify-end w-full">
      <div className="mb-4 flex flex-wrap gap-2">
        <SkeletonBlock className="h-8 w-24 rounded-full" />
        <SkeletonBlock className="h-8 w-28 rounded-full" />
        <SkeletonBlock className="h-8 w-24 rounded-full" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <SkeletonBlock className="mb-3 h-3 w-40" />
        <SkeletonBlock className="mb-2 h-10 w-full rounded-md" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 flex-1 rounded-md" />
          <SkeletonBlock className="h-10 w-20 rounded-md" />
        </div>
      </div>
    </div>
  </div>
);

export const PanelContentSkeleton = ({ lines = 6 }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="mb-3 flex items-center gap-2">
      <SkeletonBlock className="h-7 w-24" />
      <SkeletonBlock className="h-7 w-20" />
    </div>
    <div className="space-y-2">
      {[...Array(lines)].map((_, idx) => (
        <SkeletonBlock key={idx} className={`h-3 ${idx % 2 ? "w-11/12" : "w-full"}`} />
      ))}
    </div>
  </div>
);

export const MarkdownSkeleton = () => (
  <div className="p-4 md:p-8">
    <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6">
      <SkeletonBlock className="mb-6 h-6 w-3/5" />
      <div className="space-y-3">
        {[...Array(12)].map((_, idx) => (
          <SkeletonBlock key={idx} className={`h-3 ${idx % 3 === 0 ? "w-5/6" : "w-full"}`} />
        ))}
      </div>
    </div>
  </div>
);
